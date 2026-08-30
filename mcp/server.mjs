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
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

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

const server = new McpServer({ name: 'wicker-study', version: '1.1.0' })
const courseId = z.string().describe('Course id (e.g. "sec"). Use list_courses to discover ids.')
const chapterId = z.string().describe('Chapter id (e.g. "02").')

const COURSE_SOURCE_EXTENSIONS = new Set(['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt', '.md', '.csv', '.tex', '.html', '.htm', '.png', '.jpg', '.jpeg', '.webp'])
const SOURCE_MIME = { '.pdf': 'application/pdf', '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.tex': 'text/x-tex', '.html': 'text/html', '.htm': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const EDITORIAL_CHUNK_BYTES = 512 * 1024
const MAX_EDITORIAL_FILE_BYTES = 100 * 1024 * 1024

async function inventoryCourseFolder(folderPath) {
  const root = await realpath(resolve(folderPath))
  const rootStat = await lstat(root)
  if (!rootStat.isDirectory()) throw new Error('folderPath must point to a directory.')
  const files = []
  const ignored = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const path = resolve(directory, entry.name)
      if (!path.startsWith(`${root}${sep}`)) throw new Error('A folder entry resolved outside the selected course directory.')
      if (entry.isSymbolicLink()) { ignored.push({ path: relative(root, path), reason: 'symbolic link' }); continue }
      if (entry.isDirectory()) { await visit(path); continue }
      if (!entry.isFile()) continue
      const extension = extname(entry.name).toLowerCase()
      const sourcePath = relative(root, path).split(sep).join('/')
      if (!COURSE_SOURCE_EXTENSIONS.has(extension)) { ignored.push({ path: sourcePath, reason: 'unsupported type' }); continue }
      const details = await lstat(path)
      if (!details.size || details.size > MAX_EDITORIAL_FILE_BYTES) { ignored.push({ path: sourcePath, reason: details.size ? 'over 100 MB' : 'empty file' }); continue }
      const bytes = await readFile(path)
      files.push({ path, relativePath: sourcePath, name: entry.name, type: SOURCE_MIME[extension] || 'application/octet-stream', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
      if (files.length > 250) throw new Error('A course-folder sync is limited to 250 supported files.')
    }
  }
  await visit(root)
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { numeric: true }))
  return { root, files, ignored }
}

function publicInventory(inventory) {
  return { root: inventory.root, files: inventory.files.map(({ path: _path, ...file }) => file), ignored: inventory.ignored, totals: { files: inventory.files.length, bytes: inventory.files.reduce((sum, file) => sum + file.size, 0) } }
}

async function syncCourseFolder(args) {
  const inventory = await inventoryCourseFolder(args.folderPath)
  let edition = null
  let editionWorkspace = null
  if (args.editionId) {
    editionWorkspace = await api(`/api/admin/editorial-editions/${encodeURIComponent(args.editionId)}`)
    edition = editionWorkspace.editions?.[0]
    if (!edition) throw new Error(`Unknown course edition: ${args.editionId}`)
  }
  if (!edition && (!args.courseName || !args.courseCode)) throw new Error('courseCode and courseName are required when creating a new edition.')
  const workspace = await api('/api/admin/editorial-workspace')
  const matching = edition || workspace.editions?.find((candidate) => candidate.courseCode === String(args.courseCode || '').toUpperCase() && candidate.academicYear === String(args.academicYear || '') && candidate.period === String(args.period || '')) || null
  if (matching && !editionWorkspace) editionWorkspace = await api(`/api/admin/editorial-editions/${encodeURIComponent(matching.id)}`)
  const currentSources = matching ? (editionWorkspace?.sources || []).filter((source) => source.contribution.editionId === matching.id && source.contribution.consentStatus === 'accepted') : []
  const currentByPath = new Map(currentSources.map((source) => [source.contribution.sourcePath, source]))
  const localPaths = new Set(inventory.files.map((file) => file.relativePath))
  const plan = {
    edition: matching,
    add: inventory.files.filter((file) => !currentByPath.has(file.relativePath)).map((file) => file.relativePath),
    replace: inventory.files.filter((file) => currentByPath.has(file.relativePath) && currentByPath.get(file.relativePath).sha256 !== file.sha256).map((file) => file.relativePath),
    reuse: inventory.files.filter((file) => currentByPath.get(file.relativePath)?.sha256 === file.sha256).map((file) => file.relativePath),
    retire: currentSources.filter((source) => source.contribution.sourcePath && !localPaths.has(source.contribution.sourcePath)).map((source) => source.contribution.sourcePath),
    inventory: publicInventory(inventory)
  }
  if (args.dryRun !== false) return { dryRun: true, ...plan, next: 'Run again with dryRun=false after reviewing add/replace/retire. Set replaceManifest=true only if this folder is the authoritative complete source set.' }
  if (!edition) {
    edition = await api('/api/admin/editorial-editions', { method: 'POST', body: { programmeId: args.programmeId, canonicalCourseId: args.canonicalCourseId, institution: args.institution, courseCode: args.courseCode, courseName: args.courseName, academicYear: args.academicYear, period: args.period } })
  }
  const registered = await api(`/api/admin/editorial-editions/${encodeURIComponent(edition.id)}/sources`, {
    method: 'POST',
    body: {
      rightsBasis: 'admin-supplied',
      replaceManifest: args.replaceManifest === true,
      sources: inventory.files.map(({ path: _path, ...file }) => file)
    }
  })
  let uploaded = 0
  let reused = 0
  for (const source of registered.sources || []) {
    const file = inventory.files.find((candidate) => candidate.sha256 === source.sha256)
    if (!file) continue
    if (!source.uploadRequired) { reused++; continue }
    const bytes = await readFile(file.path)
    for (let offset = 0, chunkIndex = 0; offset < bytes.length; offset += EDITORIAL_CHUNK_BYTES, chunkIndex++) {
      const chunk = bytes.subarray(offset, Math.min(offset + EDITORIAL_CHUNK_BYTES, bytes.length))
      await api(`/api/admin/editorial-editions/${encodeURIComponent(edition.id)}/sources/${encodeURIComponent(source.id)}/chunks`, { method: 'POST', body: { chunkIndex, base64: chunk.toString('base64') } })
    }
    uploaded++
  }
  return { dryRun: false, edition, uploaded, reused, replaceManifest: args.replaceManifest === true, plan }
}

// ── Read ─────────────────────────────────────────────────────────────────
server.tool('whoami', 'Who this key acts as, its scopes, programme memberships, and whether it is an administrator.', {}, run(() => api('/api/me')))
server.tool('join_programme', 'Join a maintained programme (organisation). Only programmes whose institution domains match the student’s email can be joined.', { programmeId: z.string() }, run(({ programmeId }) => api('/api/account/programme', { method: 'POST', body: { programmeId } })))
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
server.tool('get_calendar', 'Unified calendar: exams, deadlines, registration windows, institution dates, and timetable feed events.', { from: z.string().optional().describe('ISO date; omit for everything'), to: z.string().optional() },
  run(async ({ from, to }) => { const data = await api('/api/calendar/events'); const events = data.events.filter((e) => (!from || String(e.start) >= from) && (!to || String(e.start) <= to)); return { ...data, events } }))
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

server.tool('analyze_documents', 'Analyse supporting documents (transcript, exam schedule, timetable, academic calendar, curriculum) with AI and return a reviewable change set against the student’s plan. Uses the student’s intake allowance. Follow with apply_changes.', { kind: z.enum(['auto', 'transcript', 'exam-schedule', 'timetable', 'academic-calendar', 'curriculum']).optional(), description: z.string().optional(), documents: z.array(z.object({ name: z.string(), type: z.string().optional(), text: z.string().optional(), images: z.array(z.string()).optional() })) },
  run((body) => api('/api/academics/documents/analyze', { method: 'POST', body })))
server.tool('apply_changes', 'Apply accepted change objects (from analyze_documents or a calendar preview) to the active plan.', { changes: z.array(z.record(z.any())), expectedRevision: z.number().int() },
  run((body) => api('/api/academics/documents/apply', { method: 'POST', body })))
server.tool('preview_calendar', 'Parse an iCalendar link or pasted .ics text into a change set without saving.', { url: z.string().optional(), ics: z.string().optional() }, run((body) => api('/api/academics/calendars/preview', { method: 'POST', body })))
server.tool('save_calendar_link', 'Save a timetable/exam-schedule calendar link to the plan and get its events as a change set.', { url: z.string(), label: z.string().optional() }, run((body) => api('/api/academics/calendars', { method: 'POST', body })))
server.tool('sync_calendar_link', 'Re-fetch a saved calendar link and get new events as a change set.', { id: z.string() }, run(({ id }) => api(`/api/academics/calendars/${encodeURIComponent(id)}/sync`, { method: 'POST', body: {} })))
server.tool('remove_calendar_link', 'Remove a saved calendar link.', { id: z.string() }, run(({ id }) => api(`/api/academics/calendars/${encodeURIComponent(id)}`, { method: 'DELETE' })))

// ── Admin (editorial content; requires an admin key) ─────────────────────
const adminCourse = (courseId) => `/api/admin/courses/${encodeURIComponent(courseId)}`
server.tool('admin_status', 'Active release and content counts.', {}, run(() => api('/api/admin/status')))
server.tool('admin_inventory_course_folder', 'Read a local course-material folder without changing Wicker Study. Returns supported files, SHA-256 hashes, ignored files, and byte totals.', { folderPath: z.string() }, run(({ folderPath }) => inventoryCourseFolder(folderPath).then(publicInventory)))
server.tool('admin_upsert_course_edition', 'Create or update a private, versioned course edition before sources or drafts are published.', { id: z.string().optional(), programmeId: z.string().optional(), canonicalCourseId: z.string().optional(), institution: z.string().optional(), courseCode: z.string(), courseName: z.string(), academicYear: z.string().optional(), period: z.string().optional(), editionKey: z.string().optional() }, run((body) => api('/api/admin/editorial-editions', { method: 'POST', body })))
server.tool('admin_register_course_urls', 'Register public web sources for an existing edition. They are fetched with SSRF protection during extraction.', { editionId: z.string(), urls: z.array(z.string().url()).min(1).max(30), rightsBasis: z.enum(['public-source', 'authorised-course-material', 'admin-supplied']).default('public-source') }, run(({ editionId, urls, rightsBasis }) => api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/sources`, { method: 'POST', body: { rightsBasis, sources: urls.map((url, index) => ({ url, name: `linked-source-${index + 1}.html`, relativePath: url })) } })))
server.tool('admin_sync_course_folder', 'Create or update a versioned course edition from a local folder. Defaults to a dry run. Unchanged files are reused by hash; changed paths supersede older sources. Set replaceManifest only when the folder is the authoritative complete source set.', {
  folderPath: z.string(), editionId: z.string().optional(), programmeId: z.string().optional(), canonicalCourseId: z.string().optional(), institution: z.string().optional(), courseCode: z.string().optional(), courseName: z.string().optional(), academicYear: z.string().optional(), period: z.string().optional(), dryRun: z.boolean().default(true), replaceManifest: z.boolean().default(false)
}, run(syncCourseFolder))
server.tool('admin_list_editorial_workspace', 'List compact course-edition summaries, or pass editionId for its sources, rights decisions, topics, jobs, artifacts, estimates, and releases.', { editionId: z.string().optional() }, run(({ editionId }) => api('/api/admin/editorial-workspace', { query: { editionId } })))
server.tool('admin_prepare_content_request', 'Turn a student request into a candidate shared edition. Fails if the student kept sources private.', { requestId: z.string() }, run(({ requestId }) => api(`/api/admin/content-requests/${encodeURIComponent(requestId)}/prepare`, { method: 'POST', body: {} })))
server.tool('admin_review_contribution', 'Accept, reject, or withdraw a source contribution after rights review.', { contributionId: z.string(), status: z.enum(['accepted', 'rejected', 'withdrawn']), reviewNote: z.string().optional() }, run(({ contributionId, ...body }) => api(`/api/admin/editorial-contributions/${encodeURIComponent(contributionId)}`, { method: 'PUT', body })))
server.tool('admin_estimate_course_generation', 'Estimate generation tokens and show cached/reusable artifact counts. This never starts generation.', { editionId: z.string() }, run(({ editionId }) => api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/estimate`)))
server.tool('admin_queue_course_generation', 'Queue study pages, exercises, flashcards, and/or quality review. Requires an explicit confirmed=true after showing the token estimate.', { editionId: z.string(), types: z.array(z.enum(['study-pages', 'exercises', 'flashcards', 'quality'])).optional(), confirmed: z.literal(true) }, run(({ editionId, types }) => api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/generate`, { method: 'POST', body: { types } })))
server.tool('admin_process_course_pipeline', 'Run pending extraction/mapping/generation jobs. useAi must be true for AI mapping or draft generation. untilIdle repeats bounded API calls; inspect failures and artifacts afterward.', { editionId: z.string(), types: z.array(z.enum(['extract', 'map', 'study-pages', 'exercises', 'flashcards', 'quality'])).optional(), useAi: z.boolean().default(false), limit: z.number().int().min(1).max(25).default(5), untilIdle: z.boolean().default(false), maxRuns: z.number().int().min(1).max(40).default(12) }, run(async ({ editionId, types, useAi, limit, untilIdle, maxRuns }) => {
  const runs = []
  for (let index = 0; index < (untilIdle ? maxRuns : 1); index++) {
    const result = await api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/process`, { method: 'POST', body: { useAi, limit, types } })
    runs.push(result)
    if (!untilIdle || result.remaining === 0 || result.processed === 0) break
  }
  return { runs, remaining: runs.at(-1)?.remaining ?? null, processed: runs.reduce((sum, runResult) => sum + Number(runResult.processed || 0), 0) }
}))
server.tool('admin_review_course_artifact', 'Edit or approve/reject one generated course artifact. Keep review notes for editorial audit.', { artifactId: z.string(), status: z.enum(['draft', 'review', 'approved', 'rejected']).optional(), title: z.string().optional(), definition: z.record(z.any()).optional(), reviewNote: z.string().optional() }, run(({ artifactId, ...body }) => api(`/api/admin/editorial-artifacts/${encodeURIComponent(artifactId)}`, { method: 'PUT', body })))
server.tool('admin_publish_course_edition', 'Publish only approved, evidence-linked artifacts. confirmation must exactly match the edition course code; publication is not reversible through this tool.', { editionId: z.string(), confirmation: z.string() }, run(({ editionId, confirmation }) => api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/publish`, { method: 'POST', body: { confirmation } })))
server.tool('admin_list_members', 'Members of a programme organisation with roles.', { programmeId: z.string() }, run(({ programmeId }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}/members`)))
server.tool('admin_set_member', 'Add a user to a programme or change their role (member | admin). Granting admin needs a global administrator.', { programmeId: z.string(), userId: z.string(), role: z.enum(['member', 'admin']).default('member') }, run(({ programmeId, userId, role }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}/members/${encodeURIComponent(userId)}`, { method: 'PUT', body: { role } })))
server.tool('admin_remove_member', 'Remove a user from a programme organisation.', { programmeId: z.string(), userId: z.string() }, run(({ programmeId, userId }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })))
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
server.tool('admin_extract_material', 'Re-extract text from a stored PDF and rebuild its retrieval index.', { courseId, sourcePath: z.string() }, run(({ courseId, sourcePath }) => api(`${adminCourse(courseId)}/materials/extract`, { method: 'POST', query: { path: sourcePath }, body: {} })))
server.tool('admin_list_flashcards', 'Editorial flashcards for a course or one chapter.', { courseId, chapterId: chapterId.optional() },
  run(({ courseId, chapterId }) => api(chapterId ? `${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/flashcards` : `${adminCourse(courseId)}/flashcards`)))
server.tool('admin_replace_flashcards', 'Replace a chapter’s editorial flashcards.', { courseId, chapterId, cards: z.array(z.object({ id: z.string().optional(), front: z.string(), back: z.string(), source: z.string().optional() })) },
  run(({ courseId, chapterId, cards }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/flashcards`, { method: 'PUT', body: { cards } })))
server.tool('admin_upsert_flashcard', 'Create or update one editorial flashcard.', { courseId, chapterId, id: z.string().optional(), front: z.string(), back: z.string(), source: z.string().optional() },
  run(({ courseId, chapterId, id, ...card }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/flashcards/${encodeURIComponent(id || 'new')}`, { method: 'PUT', body: { ...card, ...(id ? { id } : {}) } })))
server.tool('admin_delete_flashcard', 'Delete one editorial flashcard.', { courseId, cardId: z.string() }, run(({ courseId, cardId }) => api(`${adminCourse(courseId)}/flashcards/${encodeURIComponent(cardId)}`, { method: 'DELETE' })))
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
server.tool('admin_set_programme_calendar', 'Set the institution-wide academic calendar for a known programme from events, an .ics text, a calendar URL, or documents (AI-analysed).', { programmeId: z.string(), events: z.array(z.record(z.any())).optional(), ics: z.string().optional(), url: z.string().optional(), documents: z.array(z.record(z.any())).optional(), replace: z.boolean().optional() },
  run(({ programmeId, ...body }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}/calendar`, { method: 'PUT', body })))
server.tool('admin_delete_programme', 'Remove a known programme from the catalogue.', { programmeId: z.string() }, run(({ programmeId }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}`, { method: 'DELETE' })))

server.resource('manifest', 'wicker-study://manifest', { description: 'HTTP API manifest with every endpoint and scope' }, async () => ({ contents: [{ uri: 'wicker-study://manifest', mimeType: 'application/json', text: JSON.stringify(await api('/api/agent/manifest'), null, 2) }] }))

const transport = new StdioServerTransport()
await server.connect(transport)
