import { localDay } from './study-briefing.mjs'
import { randomUUID } from 'node:crypto'
import { readDocument, compareAndSwapDocument, DocumentConflictError } from './user-store.mjs'
import { activeProgrammeId, scopedDocumentKey } from './programme-scope.mjs'

const NAMESPACE = 'study-work'
export class StudyWorkError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
export const WORK_KINDS = ['assignment', 'project', 'milestone', 'catch-up', 'reading', 'exercise']
export const WORK_STATUSES = ['todo', 'in-progress', 'blocked', 'done', 'archived']
export const field = (value, max = 500) => String(value ?? '').replace(/\0/g, '').trim().slice(0, max)
export const studyWorkDate = value => {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new StudyWorkError('Use a valid date in YYYY-MM-DD format.')
  return value
}
const empty = () => ({ schemaVersion: 1, revision: null, items: [], diagnostics: [], reviews: [], attempts: [], events: [] })
const key = programmeId => scopedDocumentKey(programmeId, 'workspace')
export async function readStudyWork() { return readDocument(NAMESPACE, key(await activeProgrammeId()), empty()) }

// One atomic document contains records and their audit events. Every mutation
// has an idempotency key; an item revision protects against stale proposals,
// while a document revision permits safe retries of unrelated simultaneous work.
async function mutate(operationId, change) {
  const documentKey = key(await activeProgrammeId())
  for (let retry = 0; retry < 5; retry++) {
    const current = await readDocument(NAMESPACE, documentKey, empty())
    const existing = current.events.find(event => event.id === operationId)
    if (existing) return { state: current, event: existing, duplicate: true }
    const next = structuredClone(current)
    const event = change(next)
    const at = new Date().toISOString()
    const storedEvent = { ...event, id: operationId, at }
    next.events.push(storedEvent)
    next.revision = randomUUID()
    next.updatedAt = at
    try {
      await compareAndSwapDocument(NAMESPACE, documentKey, next, current.revision)
      return { state: next, event: storedEvent, duplicate: false }
    } catch (error) { if (!(error instanceof DocumentConflictError) || retry === 4) throw error }
  }
}

export function normalizeWorkItem(input, existing = null) {
  const kind = input.kind ?? existing?.kind ?? 'catch-up'
  const status = input.status ?? existing?.status ?? 'todo'
  if (!WORK_KINDS.includes(kind) || !WORK_STATUSES.includes(status)) throw new StudyWorkError('This task type or personal completion status is not supported.')
  const title = field(input.title ?? existing?.title, 180)
  if (!title) throw new StudyWorkError('A tracked item needs a title.')
  return { ...existing, id: existing?.id || `work-${randomUUID()}`, revision: randomUUID(), kind, status, title,
    courseCode: field(input.courseCode ?? existing?.courseCode, 40).toUpperCase(),
    detail: field(input.detail ?? existing?.detail, 2400),
    dueDate: studyWorkDate(input.dueDate === undefined ? existing?.dueDate : input.dueDate),
    parentId: field(input.parentId ?? existing?.parentId, 100) || null,
    responsibility: field(input.responsibility ?? existing?.responsibility ?? 'Me', 180),
    blocker: status === 'blocked' ? field(input.blocker ?? existing?.blocker, 600) : '',
    // Canvas observations are read separately. The model cannot write submission
    // or grade state by adding fields to a personal task.
    source: existing?.source || null,
    createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }
}

function validateParent(items, item) {
  if (!item.parentId) return
  const parent = items.find(entry => entry.id === item.parentId && entry.status !== 'archived')
  if (!parent || !['project', 'milestone'].includes(parent.kind)) throw new StudyWorkError('Choose an existing project or milestone as the parent.')
  if (parent.courseCode !== item.courseCode) throw new StudyWorkError('A milestone must belong to the same course as its project.')
  let ancestor = parent
  const seen = new Set([item.id])
  while (ancestor) {
    if (seen.has(ancestor.id)) throw new StudyWorkError('A project cannot contain itself.')
    seen.add(ancestor.id)
    ancestor = items.find(entry => entry.id === ancestor.parentId)
  }
}

export async function stageStudyWork(input, { source = null } = {}) {
  const state = await readStudyWork()
  const existing = input.id ? state.items.find(item => item.id === input.id) : null
  if (input.id && !existing) throw new StudyWorkError('That tracked item is not in this programme workspace.', 404)
  const item = normalizeWorkItem(input, existing)
  if (!existing && source) item.source = source
  validateParent(state.items, item)
  return { id: `proposal-${randomUUID()}`, type: 'study-work', title: existing ? `Update: ${item.title}` : `Track: ${item.title}`,
    summary: `${item.courseCode || 'Study work'} · ${item.kind} · ${item.status}`,
    detail: [existing ? `Personal status: ${existing.status} → ${item.status}` : 'Add to your personal study checklist.', item.dueDate ? `Target date: ${item.dueDate}` : '', `Responsibility: ${item.responsibility}`, item.blocker ? `Blocked by: ${item.blocker}` : '', item.detail, 'Does not submit work, change Canvas status or notify anyone.'].filter(Boolean).join('\n'),
    payload: { programmeId: await activeProgrammeId(), expectedItemRevision: existing?.revision || null, item }, reversible: true }
}

export async function applyStudyWorkProposal(proposal) {
  if (proposal.payload.programmeId !== await activeProgrammeId()) throw new StudyWorkError('The active programme changed. Prepare this task update again.', 409)
  return mutate(proposal.id, state => {
    const index = state.items.findIndex(item => item.id === proposal.payload.item.id)
    const existing = state.items[index] || null
    if ((existing?.revision || null) !== proposal.payload.expectedItemRevision) throw new StudyWorkError('This task changed after Tutor prepared it. Review its latest state before updating.', 409)
    const item = normalizeWorkItem(proposal.payload.item, { ...proposal.payload.item, ...(existing || {}) })
    validateParent(state.items, item)
    if (index < 0) state.items.push(item); else state.items[index] = item
    return { type: existing ? 'work-updated' : 'work-created', itemId: item.id, courseCode: item.courseCode, title: item.title, before: existing?.status || null, after: item.status, provenance: 'student-approved', previous: existing, current: item }
  })
}

export async function stageStudyProject(input) {
  if (!Array.isArray(input.milestones) || !input.milestones.length || input.milestones.length > 12) throw new StudyWorkError('A project needs 1–12 milestones.')
  const project = normalizeWorkItem({ ...input, kind: 'project', status: 'todo', parentId: null })
  const milestones = input.milestones.map(item => normalizeWorkItem({ ...item, courseCode: project.courseCode, kind: 'milestone', parentId: project.id, status: 'todo' }))
  return { id: `proposal-${randomUUID()}`, type: 'study-project', title: `Track project: ${project.title}`, summary: `${project.courseCode} · ${milestones.length} milestones`,
    detail: milestones.map(item => `${item.title} · ${item.responsibility}${item.dueDate ? ` · target ${item.dueDate}` : ''}`).join('\n') + '\nPrivate project tracker. No invitations or messages are sent.',
    payload: { programmeId: await activeProgrammeId(), items: [project, ...milestones] }, reversible: true }
}

export async function applyStudyProjectProposal(proposal) {
  if (proposal.payload.programmeId !== await activeProgrammeId()) throw new StudyWorkError('The active programme changed. Prepare this project again.', 409)
  return mutate(proposal.id, state => {
    for (const item of proposal.payload.items) {
      if (state.items.some(existing => existing.id === item.id)) throw new StudyWorkError('This project already exists. Reload its latest state.', 409)
      validateParent(state.items, item)
      state.items.push(item)
    }
    return { type: 'project-created', itemId: proposal.payload.items[0].id, courseCode: proposal.payload.items[0].courseCode, title: proposal.payload.items[0].title, itemIds: proposal.payload.items.map(item => item.id), provenance: 'student-approved' }
  })
}

export function publicDiagnostic(diagnostic, state) {
  const attempts = state.attempts.filter(attempt => attempt.diagnosticId === diagnostic.id)
  return { id: diagnostic.id, title: diagnostic.title, courseCode: diagnostic.courseCode, topic: diagnostic.topic, evidence: diagnostic.evidence, createdAt: diagnostic.createdAt,
    questions: diagnostic.questions.map(({ id, prompt, options }) => ({ id, prompt, options })),
    attempts: attempts.map(({ id, score, total, at, feedback }) => ({ id, score, total, at, feedback })) }
}

export async function readDiagnostic(id) {
  const state = await readStudyWork()
  const diagnostic = state.diagnostics.find(item => item.id === id)
  if (!diagnostic) throw new StudyWorkError('This diagnostic is not in your programme workspace.', 404)
  return publicDiagnostic(diagnostic, state)
}

export async function saveDiagnostic(input, { operationId, evidence = [] }) {
  if (!Array.isArray(input.questions) || input.questions.length < 2 || input.questions.length > 8) throw new StudyWorkError('A diagnostic needs 2–8 questions.')
  const questions = input.questions.map((question, index) => {
    const options = (question.options || []).map(option => field(option, 600))
    if (!field(question.prompt) || options.length < 2 || options.length > 5 || options.some(option => !option) || new Set(options).size !== options.length || !Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= options.length || !field(question.explanation)) throw new StudyWorkError('Each diagnostic question needs distinct options, one valid answer and an explanation.')
    return { id: `q-${index + 1}`, prompt: field(question.prompt, 1600), options, correctIndex: question.correctIndex, explanation: field(question.explanation, 1600) }
  })
  if (!evidence.length) throw new StudyWorkError('Retrieve course material before preparing a diagnostic.')
  const diagnostic = { id: `diagnostic-${randomUUID()}`, title: field(input.title, 180) || 'Readiness check', courseCode: field(input.courseCode, 40).toUpperCase(), topic: field(input.topic, 180), questions, evidence, createdAt: new Date().toISOString() }
  const saved = await mutate(operationId, state => { state.diagnostics.push(diagnostic); return { type: 'diagnostic-created', diagnosticId: diagnostic.id, courseCode: diagnostic.courseCode, title: diagnostic.title } })
  return publicDiagnostic(saved.state.diagnostics.find(item => item.id === saved.event.diagnosticId), saved.state)
}

export async function answerDiagnostic(id, answers, operationId) {
  if (!/^[\w-]{8,100}$/.test(operationId || '')) throw new StudyWorkError('A diagnostic submission needs a request identifier.')
  const result = await mutate(`diagnostic-attempt:${operationId}`, state => {
    const diagnostic = state.diagnostics.find(item => item.id === id)
    if (!diagnostic) throw new StudyWorkError('This diagnostic is not in your programme workspace.', 404)
    if (!answers || diagnostic.questions.some(question => !Number.isInteger(answers[question.id]) || answers[question.id] < 0 || answers[question.id] >= question.options.length)) throw new StudyWorkError('Answer every question before checking your results.')
    const feedback = diagnostic.questions.map(question => ({ questionId: question.id, prompt: question.prompt, chosen: question.options[answers[question.id]], correct: answers[question.id] === question.correctIndex, answer: question.options[question.correctIndex], explanation: question.explanation }))
    const attempt = { id: `attempt-${randomUUID()}`, diagnosticId: id, courseCode: diagnostic.courseCode, topic: diagnostic.topic, answers, feedback, score: feedback.filter(item => item.correct).length, total: feedback.length, at: new Date().toISOString() }
    state.attempts.push(attempt)
    return { type: 'diagnostic-answered', diagnosticId: id, attemptId: attempt.id, courseCode: diagnostic.courseCode, title: diagnostic.title, score: attempt.score, total: attempt.total }
  })
  if (result.event.diagnosticId !== id) throw new StudyWorkError('That submission identifier belongs to a different diagnostic.', 409)
  return publicDiagnostic(result.state.diagnostics.find(item => item.id === id), result.state)
}

export async function saveSubmissionReview(input, { operationId, evidence = [], attachments = [] }) {
  if (!evidence.length || !attachments.length) throw new StudyWorkError('A submission review needs retrieved requirements and the student’s attached draft.')
  const attachmentIds = [...new Set(input.attachmentIds || [])].filter(id => attachments.some(item => item.id === id))
  if (!attachmentIds.length || !Array.isArray(input.criteria) || !input.criteria.length || input.criteria.length > 12) throw new StudyWorkError('Choose an attached draft and 1–12 review criteria.')
  const criteria = input.criteria.map(item => {
    if (!['met', 'missing', 'needs-review'].includes(item.status) || !field(item.criterion) || !field(item.finding)) throw new StudyWorkError('Each review criterion needs a finding and a valid status.')
    return { criterion: field(item.criterion, 400), status: item.status, finding: field(item.finding, 1600) }
  })
  const review = { id: `review-${randomUUID()}`, title: field(input.title, 180) || 'Submission check', courseCode: field(input.courseCode, 40).toUpperCase(), summary: field(input.summary, 1600), attachmentIds, criteria, evidence, createdAt: new Date().toISOString(), kind: 'formative-review' }
  const result = await mutate(operationId, state => { state.reviews.push(review); return { type: 'submission-reviewed', reviewId: review.id, courseCode: review.courseCode, title: review.title } })
  return result.state.reviews.find(item => item.id === result.event.reviewId)
}

export function studyWorkOverview(state, { courseCode = '', from = '', to = localDay() } = {}) {
  const code = field(courseCode, 40).toUpperCase()
  const items = state.items.filter(item => (!code || item.courseCode === code) && item.status !== 'archived')
  return { items: items.map(item => ({ ...item, children: items.filter(child => child.parentId === item.id).map(child => ({ id: child.id, title: child.title, status: child.status })), statusSource: 'Personal checklist; not proof of Canvas submission or grading' })),
    completed: state.events.filter(event => event.after === 'done' && (!code || event.courseCode === code) && (!from || localDay(event.at) >= from) && localDay(event.at) <= to),
    blocked: items.filter(item => item.status === 'blocked'), overdue: items.filter(item => item.dueDate && item.dueDate < to && !['done', 'archived'].includes(item.status)),
    diagnostics: state.diagnostics.filter(item => !code || item.courseCode === code).map(item => publicDiagnostic(item, state)),
    reviews: state.reviews.filter(item => !code || item.courseCode === code),
    recentEvents: state.events.filter(event => (!code || event.courseCode === code) && (!from || localDay(event.at) >= from) && localDay(event.at) <= to).slice(-60).reverse(),
    from: from || null, to }
}
