#!/usr/bin/env node
// Wicker Study MCP server — a thin stdio wrapper over the HTTP API so agents
// (Claude Desktop, Claude Code, Cursor, …) can read course material and a
// student's record, record study activity, and — with an admin key —
// maintain editorial content.
//
//   WICKER_STUDY_URL=https://study.wicker.life WICKER_STUDY_API_KEY=wsk_… npm run mcp

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const baseUrl = (process.env.WICKER_STUDY_URL || 'http://localhost:4177').replace(/\/+$/, '')
const apiKey = process.env.WICKER_STUDY_API_KEY || ''
if (!apiKey) {
  console.error('WICKER_STUDY_API_KEY is required (create one under Account → API access).')
  process.exit(1)
}

async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(baseUrl + path)
  for (const [key, value] of Object.entries(query || {})) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const text = await response.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${data?.error || text.slice(0, 300)}`)
  return data
}

const json = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] })
const failed = (error) => ({ isError: true, content: [{ type: 'text', text: error.message }] })
const run = (fn) => async (args) => { try { return json(await fn(args)) } catch (error) { return failed(error) } }

const server = new McpServer({ name: 'wicker-study', version: '1.0.0' })
const courseId = z.string().describe('Course id (e.g. "sec"). Use list_courses to discover ids.')
const chapterId = z.string().describe('Chapter id (e.g. "02").')

// ── Read ─────────────────────────────────────────────────────────────────
server.tool('whoami', 'Who this key acts as, its scopes, and whether it is an administrator.', {}, run(() => api('/api/me')))
server.tool('list_courses', 'Courses with chapters and progress counts.', {}, run(() => api('/api/courses')))
server.tool('get_course', 'One course: chapters, mastery items with the student’s mastery, exam papers.', { courseId }, run(({ courseId }) => api(`/api/courses/${encodeURIComponent(courseId)}`)))
server.tool('get_chapter', 'Chapter markdown content. relPath opens a linked file or sub-page inside the chapter folder.', { courseId, chapterId, relPath: z.string().optional() },
  run(({ courseId, chapterId, relPath }) => api(`/api/chapter/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}${relPath ? '/' + relPath.split('/').map(encodeURIComponent).join('/') : ''}`)))
server.tool('get_course_outline', 'Heading outline of every chapter in a course.', { courseId }, run(({ courseId }) => api(`/api/course-toc/${encodeURIComponent(courseId)}`)))
server.tool('list_materials', 'Files in a course knowledge base (markdown, PDFs, images, code).', { courseId }, run(({ courseId }) => api('/api/materials', { query: { courseId } })))
server.tool('search_course', 'Full-text retrieval over course material (hosted deployments).', { courseId, query: z.string(), limit: z.number().int().min(1).max(20).optional() },
  run(({ courseId, query, limit }) => api('/api/retrieve', { method: 'POST', body: { courseId, query, limit } })))
server.tool('list_questions', 'Published questions for a chapter plus the student’s personal extra exercises.', { courseId, chapterId },
  run(({ courseId, chapterId }) => api(`/api/questions/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`)))
server.tool('get_practice_queue', 'Every published question across active courses (optionally one course).', { courseId: courseId.optional(), limit: z.number().int().min(1).max(500).optional() },
  run(async ({ courseId, limit }) => { const data = await api('/api/practice'); const questions = (data.questions || []).filter((q) => !courseId || q.courseId === courseId); return { courses: data.courses, total: questions.length, questions: questions.slice(0, limit || 50) } }))
server.tool('get_progress', 'Mastery per course and item for the student.', {},
  run(async () => { const state = await api('/api/state'); return { doneThreshold: state.meta?.doneThreshold ?? 3, courses: state.courses.map((c) => ({ id: c.id, code: c.code, name: c.name, archived: Boolean(c.archived), items: (c.items || []).map((i) => ({ id: i.id, title: i.title, mastery: i.mastery ?? 0, updatedAt: i.masteryUpdatedAt || null })) })) } }))
server.tool('list_flashcards', 'Flashcards for a course by chapter, with spaced-repetition state.', { courseId }, run(({ courseId }) => api(`/api/flashcards/${encodeURIComponent(courseId)}`)))
server.tool('list_due_cards', 'Question-level spaced-repetition cards that are due now.', {}, run(() => api('/api/sr/due')))
server.tool('list_mistakes', 'Mistake bank.', { open: z.boolean().optional().describe('Only unresolved mistakes (default true).') }, run(({ open }) => api('/api/mistakes', { query: { open: open === false ? undefined : 'true' } })))
server.tool('list_mock_sessions', 'Completed mock sessions.', {}, run(() => api('/api/mocks')))
server.tool('get_mock_session', 'One mock session with every answer and correction.', { sessionId: z.string() }, run(({ sessionId }) => api(`/api/mocks/${encodeURIComponent(sessionId)}`)))
server.tool('get_academic_plan', 'Active academic programme: courses, attempts, exam dates, events, gates, summary.', {}, run(() => api('/api/academics')))
server.tool('list_known_programmes', 'The catalogue of known bachelor programmes.', {}, run(() => api('/api/editorial-programmes')))
server.tool('get_activity', 'Study activity series, streak, weekly totals, recent events.', { days: z.number().int().min(7).max(120).optional() }, run(({ days }) => api('/api/activity', { query: { days } })))
server.tool('get_account_summary', 'What is stored for the account, per record family.', {}, run(() => api('/api/account/summary')))

// ── Write ────────────────────────────────────────────────────────────────
server.tool('submit_answer', 'Grade an answer to a published question (uses the student’s AI allowance) and record it.', { courseId, chapterId, questionId: z.string(), attempt: z.string() },
  run(async ({ courseId, chapterId, questionId, attempt }) => {
    const [course, bank] = await Promise.all([api(`/api/courses/${encodeURIComponent(courseId)}`), api(`/api/questions/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`)])
    const question = (bank.questions || []).find((q) => q.id === questionId)
    if (!question) throw new Error(`Unknown question ${questionId} in ${courseId}/${chapterId}`)
    const chapter = (course.chapters || []).find((c) => c.id === chapterId)
    return api('/api/grade', { method: 'POST', body: { courseCode: course.code, chapterName: chapter?.name || chapterId, question, attempt, _meta: { courseId, chapterId } } })
  }))
server.tool('set_mastery', 'Set mastery (0–4) on a study item.', { itemId: z.string(), mastery: z.number().int().min(0).max(4), note: z.string().optional() },
  run(({ itemId, mastery, note }) => api(`/api/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: { mastery, note } })))
server.tool('review_card', 'Review a question-level spaced-repetition card (quality 0–5).', { questionId: z.string(), quality: z.number().int().min(0).max(5) },
  run(({ questionId, quality }) => api('/api/sr/review', { method: 'POST', body: { questionId, quality } })))
server.tool('add_to_deck', 'Add a question to the spaced-repetition deck.', { questionId: z.string() }, run(({ questionId }) => api('/api/sr/add', { method: 'POST', body: { questionId } })))
server.tool('create_flashcard', 'Create a personal flashcard in a chapter.', { courseId, chapterId, front: z.string(), back: z.string() },
  run(({ courseId, chapterId, front, back }) => api(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`, { method: 'POST', body: { front, back } })))
server.tool('review_flashcard', 'Review a flashcard (quality 0–5).', { courseId, chapterId, cardId: z.string(), quality: z.number().int().min(0).max(5) },
  run(({ courseId, chapterId, cardId, quality }) => api(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(cardId)}/review`, { method: 'POST', body: { quality } })))
server.tool('resolve_mistake', 'Mark a mistake as resolved.', { mistakeId: z.string() }, run(({ mistakeId }) => api(`/api/mistakes/${encodeURIComponent(mistakeId)}/resolve`, { method: 'POST', body: {} })))
server.tool('record_chapter_read', 'Record that the student read a chapter.', { courseId, chapterId, label: z.string().optional() },
  run(({ courseId, chapterId, label }) => api('/api/activity', { method: 'POST', body: { type: 'read', courseId, chapterId, label } })))
server.tool('save_academic_plan', 'Save the active academic programme workspace. Pass the revision you read to avoid overwriting concurrent edits.', { workspace: z.record(z.any()), expectedRevision: z.number().int() },
  run(({ workspace, expectedRevision }) => api('/api/academics', { method: 'PUT', body: { workspace, expectedRevision } })))
server.tool('set_course_visibility', 'Archive/unarchive or reorder a course for the student.', { courseId, archived: z.boolean().optional(), order: z.number().int().optional() },
  run(({ courseId, archived, order }) => api(`/api/courses/${encodeURIComponent(courseId)}`, { method: 'PATCH', body: { archived, order } })))

// ── Admin (editorial content; requires an admin key) ─────────────────────
const adminCourse = (courseId) => `/api/admin/courses/${encodeURIComponent(courseId)}`
server.tool('admin_status', 'Active release and content counts.', {}, run(() => api('/api/admin/status')))
server.tool('admin_upsert_course', 'Create or update a course.', { courseId, code: z.string().optional(), name: z.string().optional(), shortName: z.string().optional(), exam: z.string().optional(), role: z.string().optional(), accent: z.string().optional(), knowledgeBase: z.string().optional(), visualStyle: z.string().optional(), examProfile: z.string().optional(), position: z.number().int().optional(), extra: z.record(z.any()).optional() },
  run(({ courseId, ...body }) => api(adminCourse(courseId), { method: 'PUT', body })))
server.tool('admin_delete_course', 'Delete a course and everything under it. Irreversible.', { courseId }, run(({ courseId }) => api(adminCourse(courseId), { method: 'DELETE' })))
server.tool('admin_upsert_chapter', 'Create or update a chapter. sourcePath is the markdown file inside the course knowledge base (create it with admin_put_material).', { courseId, chapterId, name: z.string().optional(), sourcePath: z.string().optional(), position: z.number().int().optional(), extra: z.record(z.any()).optional() },
  run(({ courseId, chapterId, ...body }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}`, { method: 'PUT', body })))
server.tool('admin_delete_chapter', 'Delete a chapter and its published questions.', { courseId, chapterId }, run(({ courseId, chapterId }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}`, { method: 'DELETE' })))
server.tool('admin_list_materials', 'Files in a course knowledge base with sizes and hashes.', { courseId }, run(({ courseId }) => api(`${adminCourse(courseId)}/materials`)))
server.tool('admin_put_material', 'Create or replace a file in a course knowledge base. Text goes in `content`; binary in `base64`. Text is re-indexed for the tutor.', { courseId, sourcePath: z.string(), content: z.string().optional(), base64: z.string().optional(), mediaType: z.string().optional() },
  run(({ courseId, sourcePath, ...body }) => api(`${adminCourse(courseId)}/materials`, { method: 'PUT', query: { path: sourcePath }, body })))
server.tool('admin_delete_material', 'Delete a file from a course knowledge base.', { courseId, sourcePath: z.string() }, run(({ courseId, sourcePath }) => api(`${adminCourse(courseId)}/materials`, { method: 'DELETE', query: { path: sourcePath } })))
server.tool('admin_upsert_item', 'Create or update a mastery item (topic/skill) in a course.', { courseId, itemId: z.string(), definition: z.record(z.any()).describe('{ title, type?, category?, chapterId?, position?, … }') },
  run(({ courseId, itemId, definition }) => api(`${adminCourse(courseId)}/items/${encodeURIComponent(itemId)}`, { method: 'PUT', body: definition })))
server.tool('admin_delete_item', 'Delete a mastery item.', { courseId, itemId: z.string() }, run(({ courseId, itemId }) => api(`${adminCourse(courseId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })))
server.tool('admin_upsert_paper', 'Register a mock exam or tutorial paper (PDF paths inside the knowledge base).', { courseId, type: z.enum(['mock-exam', 'tutorial']), paperId: z.string(), label: z.string().optional(), questionPath: z.string().optional(), solutionsPath: z.string().optional(), position: z.number().int().optional() },
  run(({ courseId, type, paperId, ...body }) => api(`${adminCourse(courseId)}/papers/${type}/${encodeURIComponent(paperId)}`, { method: 'PUT', body })))
server.tool('admin_delete_paper', 'Remove a paper.', { courseId, type: z.enum(['mock-exam', 'tutorial']), paperId: z.string() }, run(({ courseId, type, paperId }) => api(`${adminCourse(courseId)}/papers/${type}/${encodeURIComponent(paperId)}`, { method: 'DELETE' })))
server.tool('admin_list_questions', 'Published question bank of a chapter (editorial only).', { courseId, chapterId }, run(({ courseId, chapterId }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/questions`)))
server.tool('admin_replace_questions', 'Replace a chapter’s whole question bank.', { courseId, chapterId, questions: z.array(z.record(z.any())) },
  run(({ courseId, chapterId, questions }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/questions`, { method: 'PUT', body: { questions } })))
server.tool('admin_upsert_question', 'Create or update one published question. Shape: { id, type, question, expected?, options?, answer?, difficulty?, source? }.', { courseId, chapterId, question: z.record(z.any()) },
  run(({ courseId, chapterId, question }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/questions/${encodeURIComponent(question.id || 'new')}`, { method: 'PUT', body: question })))
server.tool('admin_delete_question', 'Delete one published question.', { courseId, chapterId, questionId: z.string() }, run(({ courseId, chapterId, questionId }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' })))
server.tool('admin_list_programmes', 'Programme catalogue as stored.', {}, run(() => api('/api/admin/programmes')))
server.tool('admin_upsert_programme', 'Create or update a known bachelor programme. Definition: { institution: { name, city?, country? }, name, degree, durationYears, totalEcts, language, versions: [{ id, label, status, courses: [{ id, code, name, ects, yearLevel, period, requirement }], choiceGroups?, pathways?, requirements? }] }.', { programmeId: z.string(), definition: z.record(z.any()) },
  run(({ programmeId, definition }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}`, { method: 'PUT', body: definition })))
server.tool('admin_delete_programme', 'Remove a known programme from the catalogue.', { programmeId: z.string() }, run(({ programmeId }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}`, { method: 'DELETE' })))

server.resource('manifest', 'wicker-study://manifest', { description: 'HTTP API manifest with every endpoint and scope' }, async () => ({ contents: [{ uri: 'wicker-study://manifest', mimeType: 'application/json', text: JSON.stringify(await api('/api/agent/manifest'), null, 2) }] }))

const transport = new StdioServerTransport()
await server.connect(transport)
