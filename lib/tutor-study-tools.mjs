import { createHash } from 'node:crypto'
import { readStudyWork, studyWorkOverview, stageStudyWork, stageStudyProject, saveDiagnostic, saveSubmissionReview, StudyWorkError, studyWorkDate, field, WORK_KINDS, WORK_STATUSES } from './study-work-store.mjs'
import { readAcademicState } from './academics.mjs'
import { loadEditorialState } from './editorial-store.mjs'
import { listItemProgress, listMistakes, listMockSessions } from './study-store.mjs'
import { readActivity } from './activity.mjs'
import { listCanvasConnections, canvasAccessToken } from './canvas-connections.mjs'
import { fetchCanvasHub } from './canvas-hub.mjs'
import { listTutorAttachments } from './tutor-attachments.mjs'
import { localDay } from './study-briefing.mjs'

const str = { type: 'string' }
const tool = (name, description, properties, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } })
const itemFields = { title: str, courseCode: str, detail: str, dueDate: { type: 'string', description: 'Optional target date YYYY-MM-DD. Empty clears it. Never invent a source deadline.' }, responsibility: { type: 'string', description: 'Me or the responsibility the student reports. No contact or invitation is created.' } }
export const STUDY_TOOLS = [
  tool('get_study_work', 'Read persistent personal assignments, catch-up checklists, project milestones, blockers, diagnostic results and submission reviews. Include this in today/weekly priority answers. Personal done is distinct from Canvas submitted/graded. Returns record IDs for work widgets and later updates.', { courseCode: str }),
  tool('get_canvas_assignments', 'Read Canvas assignment submission and grading observations. Use for whether work is actually submitted, graded or missing, and to obtain a sourceKey before tracking a Canvas assignment. Does not submit anything or change Canvas.', { courseCode: str }),
  tool('propose_study_work', 'Stage creation or update of one personal task for approval. Can track assignments, catch-up work, readings, exercises and project milestones. Read get_study_work before changing an existing id. Set done only from the student’s explicit completion report. Canvas submission/grade state is read-only and remains separate.', { ...itemFields, id: str, kind: { type: 'string', enum: WORK_KINDS }, status: { type: 'string', enum: WORK_STATUSES }, parentId: str, blocker: str, sourceKey: { type: 'string', description: 'For a Canvas assignment, exact key returned by get_canvas_assignments in this turn.' } }),
  tool('propose_study_project', 'Stage a private project tracker with 1–12 milestones for approval, atomically. Include deliverables, the student’s responsibilities, target dates and blockers without contacting teammates. Dates not in source material are proposed targets, not official deadlines.', { ...itemFields, milestones: { type: 'array', items: { type: 'object', properties: itemFields, required: ['title'] } } }, ['title', 'courseCode', 'milestones']),
  tool('prepare_diagnostic', 'Create a short interactive formative diagnostic after retrieving course material. This generates a study artifact, not a grade or plan change. The student answers in a widget; the server scores against the saved key and records the attempt. Use 2–8 clear multiple-choice questions, one correct option each, with teaching explanations. Never claim exam readiness from this small sample alone.', { title: str, courseCode: str, topic: str, evidenceIds: { type: 'array', items: str }, questions: { type: 'array', items: { type: 'object', properties: { prompt: str, options: { type: 'array', items: str }, correctIndex: { type: 'integer' }, explanation: str }, required: ['prompt', 'options', 'correctIndex', 'explanation'] } } }, ['title', 'courseCode', 'topic', 'evidenceIds', 'questions']),
  tool('prepare_submission_review', 'Save a formative check of a student draft against retrieved assignment requirements/rubric. The draft must be attached and its content retrieved in this turn. Mark each criterion met, missing or needs-review with a concrete finding; do not fabricate a grade, plagiarism verdict, submission or unseen content. The review widget preserves source provenance and can seed proposed follow-up tasks.', { title: str, courseCode: str, summary: str, attachmentIds: { type: 'array', items: str }, evidenceIds: { type: 'array', items: str }, criteria: { type: 'array', items: { type: 'object', properties: { criterion: str, status: { type: 'string', enum: ['met', 'missing', 'needs-review'] }, finding: str }, required: ['criterion', 'status', 'finding'] } } }, ['title', 'courseCode', 'summary', 'attachmentIds', 'evidenceIds', 'criteria']),
  tool('get_study_readiness', 'Read topic self-ratings, open mistakes, actual practice activity, diagnostic attempts and completed mock results for one course. Returns coverage gaps explicitly. Use to choose targeted practice or assess exam preparation; do not turn self-ratings or a short diagnostic into a pass probability.', { courseCode: str }, ['courseCode']),
  tool('get_weekly_review', 'Read what the student completed, what remains overdue or blocked, practice activity and diagnostic results in a date range. Uses persistent work history, not just conversation claims. Combine with briefing and Canvas observations for external deadlines/submissions.', { courseCode: str, from: { type: 'string', description: 'Optional inclusive YYYY-MM-DD; default last 7 days.' }, to: { type: 'string', description: 'Optional inclusive YYYY-MM-DD; default today.' } })
]

export const STUDY_CAPABILITIES = Object.freeze([
  { id: 'tasks', label: 'Assignments and catch-up', read: ['get_study_work', 'get_canvas_assignments'], propose: ['propose_study_work'] },
  { id: 'projects', label: 'Group project milestones', read: ['get_study_work'], propose: ['propose_study_project', 'propose_study_work'] },
  { id: 'diagnostics', label: 'Readiness checks', read: ['get_study_readiness'], prepare: ['prepare_diagnostic'], studentAction: 'answer diagnostic' },
  { id: 'submissions', label: 'Submission checks', read: ['search_study_sources'], prepare: ['prepare_submission_review'] },
  { id: 'practice', label: 'Focused practice', read: ['get_study_readiness'], propose: ['propose_practice_set'] },
  { id: 'review', label: 'Weekly and exam readiness', read: ['get_weekly_review', 'get_study_readiness', 'get_briefing'] },
  { id: 'attendance', label: 'Attendance', read: ['get_attendance', 'get_course_obligations'], propose: ['propose_attendance_update'] }
])

async function recognisedCourse(code) {
  const [{ workspace }, editorial] = await Promise.all([readAcademicState(), loadEditorialState(new URL('../data/study-state.template.json', import.meta.url))])
  const wanted = field(code, 40).toUpperCase()
  const course = workspace.courses.find(item => item.code?.toUpperCase() === wanted)
  if (!course) throw new StudyWorkError('Choose a course in your active programme workspace.')
  const published = editorial.courses.find(item => item.code?.toUpperCase() === wanted)
  return { course, published, ids: new Set([course.id, course.editorialCourseId, published?.id].filter(Boolean)) }
}

export async function readCanvasAssignments({ courseCode = '' } = {}) {
  const connections = await listCanvasConnections()
  const results = await Promise.all(connections.map(async connection => {
    try {
      const { token } = await canvasAccessToken({ canvasUrl: connection.origin })
      const hub = await fetchCanvasHub({ origin: connection.origin, token, scope: 'current', parts: ['assignments'], days: 60 })
      return { items: hub.assignments.map(item => ({ ...item, sourceKey: `${connection.origin}/assignments/${item.id}`, observedAt: new Date().toISOString() })), problems: hub.problems || [] }
    } catch (error) { return { items: [], problems: [{ error: error.message }] } }
  }))
  const matching = results.flatMap(result => result.items).filter(item => !courseCode || item.courseCode === field(courseCode, 40).toUpperCase())
  return { assignments: matching.slice(0, 150), omitted: Math.max(0, matching.length - 150), note: !connections.length ? 'Canvas is not connected. Submission and grading status are unknown.' : results.some(result => result.problems.length) ? 'Some Canvas assignment observations could not be read.' : 'Canvas observations are separate from personal completion. Offline work may not have a reliable submission status in Canvas.' }
}

function sourceEvidence(runtime, ids, courseCode) {
  const requested = new Set(Array.isArray(ids) ? ids : [])
  return [...(runtime.evidence?.values() || [])].filter(item => requested.has(item.id) && (!item.course || item.course.toUpperCase() === field(courseCode, 40).toUpperCase()) && !['Past conversation', 'Personal study work'].includes(item.sourceType)).slice(0, 12)
}
function artifactOperation(runtime, name, args) { return `${name}:${runtime.turnId}:${createHash('sha256').update(JSON.stringify(args)).digest('hex').slice(0, 20)}` }

export const STUDY_HANDLERS = {
  async get_canvas_assignments(args = {}, runtime = {}) {
    const result = await readCanvasAssignments(args)
    runtime.assignments ||= new Map()
    for (const item of result.assignments) runtime.assignments.set(item.sourceKey, item)
    return result
  },
  async get_study_work(args = {}, runtime = {}) {
    const state = await readStudyWork()
    const result = studyWorkOverview(state, args)
    let observations = null
    if (result.items.some(item => item.source?.sourceKey)) observations = await STUDY_HANDLERS.get_canvas_assignments(args, runtime)
    result.items = result.items.map(item => ({ ...item, canvas: item.source?.sourceKey ? observations?.assignments.find(assignment => assignment.sourceKey === item.source.sourceKey) || null : null }))
    if (observations) result.canvasNote = observations.note
    return result
  },
  async propose_study_work(args, runtime = {}) {
    const current = args.id ? (await readStudyWork()).items.find(item => item.id === args.id) : null
    const code = args.courseCode || current?.courseCode
    if (code) await recognisedCourse(code)
    const source = args.sourceKey ? runtime.assignments?.get(args.sourceKey) : null
    if (args.sourceKey && (!source || source.courseCode !== field(code, 40).toUpperCase())) throw new StudyWorkError('Read the matching Canvas assignment before linking this task.')
    return { proposal: await stageStudyWork(args, { source: source ? { sourceKey: source.sourceKey, title: source.title, url: source.url, courseCode: source.courseCode } : null }) }
  },
  async propose_study_project(args) { await recognisedCourse(args.courseCode); return { proposal: await stageStudyProject(args) } },
  async prepare_diagnostic(args, runtime = {}) {
    await recognisedCourse(args.courseCode)
    const evidence = sourceEvidence(runtime, args.evidenceIds, args.courseCode)
    return { diagnostic: await saveDiagnostic(args, { evidence, operationId: artifactOperation(runtime, 'diagnostic', args) }) }
  },
  async prepare_submission_review(args, runtime = {}) {
    await recognisedCourse(args.courseCode)
    const evidence = sourceEvidence(runtime, args.evidenceIds, args.courseCode)
    const draftEvidence = [...(runtime.evidence?.values() || [])].filter(item => item.sourceType === 'Private Tutor source')
    const attachments = (await listTutorAttachments()).filter(item => draftEvidence.some(source => source.url?.includes(`/attachments/${item.id}/`) || source.id?.includes(item.id)))
    return { review: await saveSubmissionReview(args, { evidence: evidence.filter(item => item.sourceType !== 'Private Tutor source'), attachments, operationId: artifactOperation(runtime, 'review', args) }) }
  },
  async get_study_readiness({ courseCode }) {
    const { course, published, ids } = await recognisedCourse(courseCode)
    const since = new Date(Date.now() - 28 * 86400000).toISOString()
    const [state, progress, mistakes, mocks, activity] = await Promise.all([readStudyWork(), listItemProgress(), listMistakes({ open: true }), listMockSessions(), readActivity({ since })])
    const chapters = published?.chapters || []
    return { courseCode: course.code, since,
      topicSelfRatings: progress.filter(item => ids.has(item.courseId)).map(item => ({ topic: chapters.find(chapter => chapter.id === item.itemId)?.name || item.itemId, rating: item.mastery ?? null, scale: '0–4, self-reported', updatedAt: item.masteryUpdatedAt })),
      practiceActivity: activity.filter(item => ids.has(item.courseId)),
      openMistakes: mistakes.filter(item => ids.has(item.courseId)).slice(0, 30),
      mockResults: mocks.filter(item => ids.has(item.courseId) && item.submittedAt).slice(0, 10),
      diagnostics: state.attempts.filter(item => item.courseCode === course.code).slice(-12),
      coverage: { publishedTopics: chapters.length, ratedTopics: progress.filter(item => ids.has(item.courseId) && item.mastery != null).length },
      note: 'Self-ratings, formative diagnostic samples, practice activity and mock results are separate evidence. No automatic pass probability or readiness verdict is established. Unrated topics are unknown.' }
  },
  async get_weekly_review({ courseCode = '', from = '', to = '' } = {}) {
    const end = to || localDay()
    const start = from || localDay(new Date(Date.now() - 6 * 86400000))
    studyWorkDate(start); studyWorkDate(end)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new StudyWorkError('Choose a valid weekly review range.')
    const course = courseCode ? await recognisedCourse(courseCode) : null
    const [state, activity] = await Promise.all([readStudyWork(), readActivity({ since: new Date(Date.parse(`${start}T00:00:00Z`) - 86400000).toISOString() })])
    return { ...studyWorkOverview(state, { courseCode, from: start, to: end }), activity: activity.filter(item => (!course || course.ids.has(item.courseId)) && localDay(item.at) >= start && localDay(item.at) <= end), note: 'Completed means personally marked done. Canvas submitted/graded states must be checked separately. Earlier completed work remains in history if it was later reopened.' }
  }
}
