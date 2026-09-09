import { calendarToolResult } from './calendar-result.mjs'
import { searchCourseSchema } from './search-course-schema.mjs'
// Shared by stdio and Streamable HTTP. Keep schemas and behavior in one place.
export function registerCoreTools(server, { z, run, api, defaultCanvasUrl: DEFAULT_CANVAS_URL }) {
const courseId = z.string().describe('Exact published-course id returned by list_courses; not a course code or Canvas numeric id.')
const chapterId = z.string().describe('Chapter id.')
server.tool('whoami', 'Who this key acts as, its scopes, programme memberships, and whether it is an administrator.', {}, run(() => api('/api/me')))
server.tool('join_programme', 'Join a maintained programme (organisation). Only programmes whose institution domains match the student’s email can be joined.', { programmeId: z.string() }, run(({ programmeId }) => api('/api/account/programme', { method: 'POST', body: { programmeId } })))
server.tool('list_courses', 'List published study courses with chapters and progress counts. This is NOT the Canvas material inventory. A missing course does not mean its Canvas materials are absent. Use canvas_corpus_status to discover Canvas editions, then canvas_course_materials and search_course with courseCode.', {}, run(() => api('/api/courses')))
server.tool('get_course', 'Read one published study course: chapters, mastery items with the student’s mastery, and exam papers. courseId must be an exact id from list_courses. For Canvas-only courses or originals, use canvas_course_materials and search_course with courseCode; a missing published course does not imply missing Canvas materials.', { courseId }, run(({ courseId }) => api(`/api/courses/${encodeURIComponent(courseId)}`)))
server.tool('get_chapter', 'Chapter markdown content. relPath opens a linked file or sub-page inside the chapter folder.', { courseId, chapterId, relPath: z.string().optional() },
  run(({ courseId, chapterId, relPath }) => api(`/api/chapter/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}${relPath ? '/' + relPath.split('/').map(encodeURIComponent).join('/') : ''}`)))
server.tool('get_course_outline', 'Heading outline of every chapter in a course.', { courseId }, run(({ courseId }) => api(`/api/course-toc/${encodeURIComponent(courseId)}`)))
server.tool('list_materials', 'Files in a published course knowledge base (markdown, PDFs, images, code). For the separate Canvas original inventory, use canvas_course_materials with courseCode.', { courseId }, run(({ courseId }) => api('/api/materials', { query: { courseId } })))
server.tool('search_course', 'Search within a course across published material and authorised Canvas snapshots. Requires query and at least one of courseId, courseCode, or canonicalCourseId. Prefer courseCode for Canvas material, including courses absent from list_courses. Use canvas_corpus_status or get_academic_plan to discover codes. Results identify the academic-year edition and source path. Specify academicYear for a strict edition query; otherwise current and historical editions may be searched, with newer editions preferred.', searchCourseSchema,
  run(args => api('/api/retrieve', { method: 'POST', body: args })))
server.tool('search_regulations', 'Focused retrieval from official regulations for the active programme. Use for the Education and Examination Regulations, Board of Examiners, exam and resit procedures, registration, inspections, appeals, exemptions, hardship, fraud, projects, internships and curriculum transition rules. Results include the governing document, academic year and exact page; programme-restricted originals are not exposed.', {
  query: z.string(),
  academicYear: z.string().optional().describe('Exact academic year such as 2026-2027. Defaults to the active programme year.'),
  documentKind: z.enum(['education-examination-regulations', 'rules-regulations', 'board-of-examiners', 'exam-procedure', 'programme-policy', 'other']).optional(),
  limit: z.number().int().min(1).max(20).optional()
}, run((args) => api('/api/programme-policies/retrieve', { method: 'POST', body: args })))
server.tool('list_regulation_sources', 'List the official regulation sources indexed for the active programme and academic year. Returns reviewed metadata and coverage counts, never a programme-restricted original.', {
  academicYear: z.string().optional().describe('Exact academic year such as 2026-2027. Defaults to the active programme year.')
}, run(({ academicYear }) => api('/api/programme-policies', { query: { academicYear } })))
server.tool('canvas_corpus_status', 'Material collection consent, background sync jobs, versioned course editions, source counts, and last/next scrape times for the connected account.', {
  canvasUrl: z.string().url().optional()
}, run(({ canvasUrl }) => api('/api/account/integrations/canvas/corpus', { query: { canvasUrl: canvasUrl || DEFAULT_CANVAS_URL } })))
server.tool('canvas_corpus_sync', 'Queue a server-side refresh of authorised Canvas material. Collection must first be enabled by the user in the signed-in Wicker Study browser; an MCP key cannot grant or expand consent.', {
  canvasUrl: z.string().url().optional(),
  force: z.boolean().optional()
}, run(({ canvasUrl, force }) => api('/api/integrations/canvas/corpus/sync', { method: 'POST', body: { canvasUrl: canvasUrl || DEFAULT_CANVAS_URL, force } })))
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
server.tool('get_planning_context', 'Read the student’s saved exam scenario as a compact planning model. Recorded attempts and grades are explicitly separated from private choices such as a resit, following-year deferral, expected grade, or what-if outcome. Actual academic-calendar records are grouped into dated examination windows, so one window can contain a period’s primary exams and another period’s resits. Each course includes allowed session ids and course-specific roles derived from its teaching period, calendar, transcript fallback, and verified resit rules. Returns stable session ids and a revision; call this before suggesting or changing the plan.', {}, run(() => api('/api/planning/context')))
server.tool('list_known_programmes', 'The catalogue of known bachelor programmes.', {}, run(() => api('/api/editorial-programmes')))
server.tool('get_calendar', 'Unified calendar in one call: exam attempts, personal events, registration windows, the institution calendar, saved timetable feeds (lectures, tutorials, labs), and — when Canvas is connected — Canvas assignment deadlines and Canvas course events. This is the tool for "when is my next lecture", "where do I need to be", and "what is due this week". Events carry `category`, `courseCode`, and for Canvas items a `canvasStatus`; `problems` names any source that could not be read, which is how you tell an empty week from a missing timetable feed.', { from: z.string().date().optional().describe('Inclusive first calendar date (YYYY-MM-DD); omit for no lower bound.'), to: z.string().date().optional().describe('Inclusive last calendar date (YYYY-MM-DD). Use the same date as from for one full day.') },
  run(async ({ from, to }) => { const data = await api('/api/calendar/events'); return calendarToolResult(data, { from, to }) }))
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
server.tool('update_planning_objective', 'Update one course in the student’s private exam scenario without replacing the rest of the academic record. Call get_planning_context first, use a session id from that course’s planningRules.allowedSessionIds, inspect allowedDestinations for whether the shared window is a primary or resit route for that course, explain the exact change to the student, and pass the revision you read. Invalid sittings and stale revisions are rejected.', {
  courseId: z.string(),
  expectedRevision: z.number().int(),
  mode: z.enum(['current', 'resit', 'none']).optional(),
  targetSession: z.string().max(140).nullable().optional(),
  expectedGrade: z.number().min(0).max(100).nullable().optional(),
  outcome: z.enum(['actual', 'pass', 'fail']).optional()
}, run(({ courseId: id, expectedRevision, ...objective }) => api(`/api/planning/objectives/${encodeURIComponent(id)}`, { method: 'PATCH', body: { objective, expectedRevision } })))
server.tool('set_course_visibility', 'Archive/unarchive or reorder a course for the student.', { courseId, archived: z.boolean().optional(), order: z.number().int().optional() },
  run(({ courseId, archived, order }) => api(`/api/courses/${encodeURIComponent(courseId)}`, { method: 'PATCH', body: { archived, order } })))

// ── Canvas through the account connection (no local PAT) ──────────────────
server.tool('get_study_briefing',
  'The student\u2019s whole situation in one call, ranked: work Canvas marks missing, overdue hand-ins, upcoming exams, what is due this week, the week\u2019s lectures and tutorials with rooms, recent announcements, and their credits so far. Call this first for "what should I focus on", "what is due", "what is my week like", or any question about priorities \u2014 it replaces orchestrating get_calendar, canvas_updates and get_academic_plan yourself. `notConnected` lists sources that could not be read: say a timetable is not connected rather than reporting a quiet week.',
  { days: z.number().int().min(1).max(31).optional().describe('How far ahead to look. Default 7.') },
  run(({ days }) => api('/api/briefing', { query: { days } })))

server.tool('canvas_updates',
  'What is happening in the student’s Canvas courses right now: announcements, assignments with their submission state, Canvas course events, and the grade Canvas shows. This is the tool for "what was announced", "what is due", "what have I not handed in", and "how am I doing". Answers are cached for ten minutes; pass refresh:true only when the student says something is missing. Never returns the Canvas token.',
  {
    scope: z.enum(['current', 'all']).optional().describe('"current" (default) is the courses being taught now, plus any the student starred on their Canvas dashboard and the standing faculty spaces. "all" includes concluded enrolments.'),
    days: z.number().int().min(1).max(365).optional().describe('How far back to read announcements. Default 60.'),
    courseIds: z.array(z.string()).optional().describe('Restrict to these Canvas course ids. Overrides scope.'),
    parts: z.array(z.enum(['announcements', 'assignments', 'events', 'grades'])).optional().describe('Fetch only what is needed. Omitting this fetches all four.'),
    refresh: z.boolean().optional()
  },
  run(({ scope, days, courseIds, parts, refresh }) => api('/api/integrations/canvas/hub', {
    query: {
      canvasUrl: DEFAULT_CANVAS_URL,
      scope,
      days,
      courseIds: courseIds?.join(','),
      parts: parts?.join(','),
      refresh: refresh ? '1' : undefined
    }
  })))

server.tool('analyze_documents', 'Analyse supporting documents (transcript, exam schedule, timetable, academic calendar, curriculum) with AI and return a reviewable change set against the student’s plan. Uses the student’s intake allowance. Follow with apply_changes.', { kind: z.enum(['auto', 'academic-overview', 'transcript', 'exam-schedule', 'timetable', 'academic-calendar', 'curriculum']).optional(), description: z.string().optional(), documents: z.array(z.object({ name: z.string(), type: z.string().optional(), text: z.string().optional(), images: z.array(z.string()).optional() })) },
  run((body) => api('/api/academics/documents/analyze', { method: 'POST', body })))
server.tool('apply_changes', 'Apply accepted change objects (from analyze_documents or a calendar preview) to the active plan.', { changes: z.array(z.record(z.any())), expectedRevision: z.number().int() },
  run((body) => api('/api/academics/documents/apply', { method: 'POST', body })))
server.tool('preview_calendar', 'Parse an iCalendar link or pasted .ics text into a change set without saving.', { url: z.string().optional(), ics: z.string().optional() }, run((body) => api('/api/academics/calendars/preview', { method: 'POST', body })))
server.tool('save_calendar_link', 'Save a timetable/exam-schedule calendar link to the plan and get its events as a change set.', { url: z.string(), label: z.string().optional() }, run((body) => api('/api/academics/calendars', { method: 'POST', body })))
server.tool('sync_calendar_link', 'Re-fetch a saved calendar link and get new events as a change set.', { id: z.string() }, run(({ id }) => api(`/api/academics/calendars/${encodeURIComponent(id)}/sync`, { method: 'POST', body: {} })))
server.tool('remove_calendar_link', 'Remove a saved calendar link.', { id: z.string() }, run(({ id }) => api(`/api/academics/calendars/${encodeURIComponent(id)}`, { method: 'DELETE' })))


}
