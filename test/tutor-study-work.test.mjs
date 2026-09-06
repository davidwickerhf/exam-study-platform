import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deletePersonalData } from '../lib/account-data.mjs'
import { readStudyWork, stageStudyWork, applyStudyWorkProposal, stageStudyProject, applyStudyProjectProposal, saveDiagnostic, answerDiagnostic, saveSubmissionReview, studyWorkOverview } from '../lib/study-work-store.mjs'
import { createAcademicProgramme, selectAcademicProgramme } from '../lib/academics.mjs'
import { parseTutorResponse } from '../lib/tutor-response.mjs'
import { courseAnnouncementContext } from '../lib/tutor-course-updates.mjs'
import { TUTOR_TOOLS } from '../lib/tutor-agent.mjs'
const isolated = fn => withRequestContext({ userId: `study-work-test-${randomUUID()}` }, async () => { try { await fn() } finally { await deletePersonalData() } })
const evidence = [{ id: 'source-one', sourceType: 'Course material', title: 'Processes', course: 'BCS2140' }]

test('personal work requires approval, is idempotent, and detects stale updates', () => isolated(async () => {
  const proposal = await stageStudyWork({ title: 'Finish Lab 1', kind: 'assignment', courseCode: 'BCS2140', status: 'todo', submittedAt: 'invented', grade: '10' })
  assert.equal((await readStudyWork()).items.length, 0)
  await applyStudyWorkProposal(proposal); await applyStudyWorkProposal(proposal)
  let state = await readStudyWork()
  assert.equal(state.items.length, 1); assert.equal(state.events.length, 1)
  assert.equal(state.items[0].grade, undefined); assert.equal(state.items[0].submittedAt, undefined)
  const done = await stageStudyWork({ id: state.items[0].id, status: 'done' })
  const stale = await stageStudyWork({ id: state.items[0].id, status: 'blocked', blocker: 'Need partner data' })
  await applyStudyWorkProposal(done)
  await assert.rejects(applyStudyWorkProposal(stale), /changed after/)
  state = await readStudyWork()
  assert.equal(studyWorkOverview(state).completed.length, 1)
  assert.equal(state.events.at(-1).previous.status, 'todo')
  assert.equal(state.events.at(-1).provenance, 'student-approved')
}))

test('concurrent tasks both survive atomic updates; programme and account isolation hold', () => isolated(async () => {
  const [one, two] = await Promise.all([stageStudyWork({ title: 'One' }), stageStudyWork({ title: 'Two' })])
  await Promise.all([applyStudyWorkProposal(one), applyStudyWorkProposal(two)])
  assert.equal((await readStudyWork()).items.length, 2)
  const original = one.payload.programmeId
  await createAcademicProgramme({ programme: 'Another programme' })
  assert.equal((await readStudyWork()).items.length, 0)
  await assert.rejects(applyStudyWorkProposal(one), /programme changed/)
  await selectAcademicProgramme(original)
  assert.equal((await readStudyWork()).items.length, 2)
  await isolated(async () => assert.equal((await readStudyWork()).items.length, 0))
}))

test('projects create milestones atomically and preserve hierarchy without inviting anyone', () => isolated(async () => {
  const project = await stageStudyProject({ title: 'Sensor project', courseCode: 'BCS3120', milestones: [{ title: 'Define scope', responsibility: 'Me' }, { title: 'Prototype', responsibility: 'Alex (as reported)' }] })
  await applyStudyProjectProposal(project); await applyStudyProjectProposal(project)
  const state = await readStudyWork()
  assert.equal(state.items.length, 3); assert.equal(state.events.length, 1)
  assert.equal(studyWorkOverview(state).items[0].children.length, 2)
  await assert.rejects(stageStudyWork({ id: state.items[0].id, parentId: state.items[1].id }), /cannot contain itself/)
  await assert.rejects(stageStudyWork({ title: 'Wrong course', courseCode: 'BCS2140', parentId: state.items[0].id }), /same course/)
}))

test('diagnostics keep answer keys server-side, score real answers, and persist one attempt per request', () => isolated(async () => {
  const input = { title: 'Processes check', courseCode: 'BCS2140', topic: 'Processes', questions: [1, 2].map(n => ({ prompt: `Question ${n}`, options: ['Correct', 'Incorrect'], correctIndex: 0, explanation: 'Reason from course material.' })) }
  await assert.rejects(saveDiagnostic(input, { operationId: 'no-source' }), /Retrieve course material/)
  const diagnostic = await saveDiagnostic(input, { operationId: 'diagnostic-one', evidence })
  assert.equal(diagnostic.questions[0].correctIndex, undefined)
  assert.equal(diagnostic.questions[0].explanation, undefined)
  await assert.rejects(answerDiagnostic(diagnostic.id, { 'q-1': 0 }, 'request-incomplete'), /every question/)
  const answered = await answerDiagnostic(diagnostic.id, { 'q-1': 0, 'q-2': 1 }, 'request-complete')
  await answerDiagnostic(diagnostic.id, { 'q-1': 0, 'q-2': 1 }, 'request-complete')
  assert.equal(answered.attempts[0].score, 1)
  assert.equal(answered.attempts[0].feedback[1].correct, false)
  assert.equal((await readStudyWork()).attempts.length, 1)
  assert.equal(studyWorkOverview(await readStudyWork()).diagnostics[0].attempts[0].total, 2)
  await isolated(async () => assert.rejects(answerDiagnostic(diagnostic.id, { 'q-1': 0, 'q-2': 0 }, 'another-account'), /not in your programme/))
}))

test('submission checks require retrieved draft and requirements and preserve concrete findings', () => isolated(async () => {
  const input = { title: 'Lab review', courseCode: 'BCS2140', summary: 'Add PID evidence.', attachmentIds: ['draft-one'], criteria: [{ criterion: 'Evidence of execution', status: 'missing', finding: 'No PID output is shown.' }] }
  await assert.rejects(saveSubmissionReview(input, { operationId: 'review-one', evidence }), /attached draft/)
  const review = await saveSubmissionReview(input, { operationId: 'review-one', evidence, attachments: [{ id: 'draft-one' }] })
  assert.equal(review.kind, 'formative-review')
  assert.equal((await readStudyWork()).reviews[0].criteria[0].status, 'missing')
}))

test('widget references resolve only to actual tool artifacts', () => {
  const output = { summary: 'Here is your checklist.', priorities: [], courses: [], drafts: [], detail: '', work: ['work-one', 'invented'], diagnostics: ['fake'], reviews: [] }
  const item = { id: 'work-one', title: 'Read syllabus', status: 'todo', kind: 'reading', responsibility: 'Me' }
  const parsed = parseTutorResponse(JSON.stringify(output), [], [], { work: new Map([[item.id, item]]) })
  assert.deepEqual(parsed.presentation.work, [item]); assert.deepEqual(parsed.presentation.diagnostics, [])
  assert.match(parsed.content, /Read syllabus/)
  for (const name of ['get_study_work', 'get_canvas_assignments', 'propose_study_project', 'prepare_diagnostic', 'prepare_submission_review', 'get_weekly_review', 'get_study_readiness']) assert.ok(TUTOR_TOOLS.some(tool => tool.function.name === name))
})

test('rule amendments beyond the old announcement excerpt remain available with date and author', () => {
  const item = courseAnnouncementContext({ id: 'canvas-1', courseCode: 'BCS3210', title: 'Course update', postedAt: '2026-09-04T10:00:00Z', author: 'Course coordinator', url: 'https://canvas.example/announcements/1', html: `<p>${'Welcome to the course. '.repeat(30)}</p><p>Attendance is now optional. We updated the coursebook.</p>` })
  assert.match(item.text, /Attendance is now optional/)
  assert.match(item.excerpt, /updated the coursebook/)
  assert.equal(item.mayAmendRules, true); assert.equal(item.author, 'Course coordinator')
  assert.equal(item.truncated, false)
})
