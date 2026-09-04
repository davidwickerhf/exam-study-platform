import test from 'node:test'
import assert from 'node:assert/strict'
import {
  gateResolved,
  groupOpenCourses,
  objectiveFor,
  planningContext,
  planningDestinations,
  plannerSummary,
  planningInsights,
  planningSessions,
  resetObjectives,
  updatePlanningObjective,
  withObjective
} from '../lib/workspace/planner.mjs'

const course = (id, patch = {}) => ({
  id, code: id.toUpperCase(), name: `Course ${id}`, ects: 6, yearLevel: 'Year 1', period: 'Period 1', attempts: [], ...patch
})
const workspace = (patch = {}) => ({
  revision: 3,
  courses: [],
  gates: [],
  planning: { objectives: {}, periodAssignments: [], academicPeriods: [] },
  ...patch
})

test('an absent or malformed objective has the honest recorded default', () => {
  assert.deepEqual(objectiveFor(workspace(), 'a'), { mode: 'current', outcome: 'actual' })
  assert.deepEqual(objectiveFor(workspace({ planning: { objectives: { a: { mode: 'later', outcome: 'maybe' } } } }), 'a'), { mode: 'current', outcome: 'actual' })
})

test('a planning objective retains a bounded expected grade and named exam session', () => {
  const value = workspace({ planning: { objectives: { a: { mode: 'resit', outcome: 'pass', expectedGrade: 120, targetSession: '  resit-february  ' } } } })
  assert.deepEqual(objectiveFor(value, 'a'), { mode: 'resit', outcome: 'pass', expectedGrade: 100, targetSession: 'resit-february' })
  assert.deepEqual(withObjective(workspace(), 'a', { expectedGrade: 7.5, targetSession: 'period-2' }).planning.objectives.a, {
    mode: 'current', outcome: 'actual', expectedGrade: 7.5, targetSession: 'period-2'
  })
})

test('agent planning context separates recorded results from scenario choices', () => {
  const value = workspace({
    profile: { programme: 'BSc Computer Science', academicYear: '2026–2027' },
    programmeTemplate: { currentStudyYear: 'Year 1' },
    courses: [course('algo', { passMark: 5.5, attempts: [{ status: 'failed', grade: 4.8, examDate: '2026-10-12', type: 'first' }] })],
    planning: {
      objectives: { algo: { mode: 'resit', outcome: 'pass', expectedGrade: 7.5, targetSession: 'calendar:resit-1' } },
      academicPeriods: [{ id: 'resit-1', title: 'Period 1 resits', date: '2027-01-04', endDate: '2027-01-08', kind: 'resit-week', resit: true }]
    }
  })
  const context = planningContext(value)
  assert.equal(context.revision, 3)
  assert.equal(context.courses[0].recordedStatus, 'failed')
  assert.equal(context.courses[0].recordedAttempts[0].grade, 4.8)
  assert.equal(context.courses[0].objective.expectedGrade, 7.5)
  assert.equal(context.courses[0].plannedSession.label, 'Period 1 resits')
  assert.equal(context.courses[0].placementSource, 'scenario-choice')
  assert.ok(planningSessions(value).some((session) => session.id === 'following-year'))
})

test('planner exposes continuous coursework separately from exam sittings', () => {
  const value = workspace({ courses: [course('project', { period: 'Semester 1' }), course('exam')] })
  const sessions = planningSessions(value)
  assert.equal(sessions[0].id, 'continuous-work')
  assert.equal(sessions.find((session) => session.id === 'continuous-work').kind, 'continuous-work')
  assert.ok(sessions.some((session) => session.id === 'period:1'))
  const context = planningContext(value)
  assert.equal(context.courses.find((item) => item.id === 'project').plannedSession.id, 'continuous-work')
  assert.equal(context.courses.find((item) => item.id === 'exam').plannedSession.id, 'period:1')
  assert.equal(context.courses.find((item) => item.id === 'exam').placementSource, 'course-and-calendar')
  assert.deepEqual(planningDestinations(value, 'project').allowedSessionIds, ['continuous-work', 'following-year'])
})

test('teaching periods allow only the matching exam, related resit and later year', () => {
  const value = workspace({
    courses: [course('p1'), course('p2', { period: 'Period 2' })],
    planning: { objectives: {}, academicPeriods: [
      { id: 'exam-1', title: 'Period 1 exams', date: '2026-10-12', endDate: '2026-10-16', kind: 'exam-week', period: 1 },
      { id: 'exam-2', title: 'Period 2 exams', date: '2026-12-14', endDate: '2026-12-18', kind: 'exam-week', period: 2 },
      { id: 'resit-s1', title: 'Semester 1 resits', date: '2027-01-04', endDate: '2027-01-08', kind: 'resit-week', semester: 1, resit: true }
    ] }
  })
  const rules = planningDestinations(value, 'p1')
  assert.deepEqual(rules.allowedSessionIds, ['calendar:exam-1', 'calendar:resit-s1', 'following-year'])
  assert.equal(rules.destinations.find((item) => item.id === 'calendar:exam-2').allowed, false)
  assert.throws(() => updatePlanningObjective(value, 'p1', { targetSession: 'calendar:exam-2' }), /recorded teaching-period/)
})

test('overlapping calendar records become one examination window with course-specific roles', () => {
  const value = workspace({
    profile: { academicYear: '2026-2027' },
    courses: [course('p1'), course('p2', { period: 'Period 2' })],
    planning: { objectives: {}, academicPeriods: [
      { id: 'p2-primary', title: 'Period 2 exams', date: '2026-12-14', endDate: '2026-12-18', academicYear: '2026-2027', kind: 'exam-week', period: 2 },
      { id: 'p1-resit', title: 'Period 1 resits', date: '2026-12-14', endDate: '2026-12-18', academicYear: '2026-2027', kind: 'resit-week', period: 1, resit: true }
    ] }
  })
  const windows = planningSessions(value, { academicYear: '2026–2027', courses: value.courses })
  const shared = windows.find((session) => session.kind === 'exam-window')
  assert.equal(windows.filter((session) => session.kind === 'exam-window').length, 1)
  assert.equal(shared.label, 'Period 2 exams + Period 1 resits')
  assert.deepEqual(shared.offerings.map((offering) => [offering.period, offering.resit]), [[2, false], [1, true]])
  assert.equal(planningDestinations(value, 'p1').destinations.find((item) => item.id === shared.id).role, 'resit')
  assert.equal(planningDestinations(value, 'p2').destinations.find((item) => item.id === shared.id).role, 'primary')
  const context = planningContext(value)
  assert.equal(context.courses.find((item) => item.id === 'p1').planningRules.allowedDestinations.find((item) => item.sessionId === shared.id).role, 'resit')
  assert.equal(context.courses.find((item) => item.id === 'p2').planningRules.allowedDestinations.find((item) => item.sessionId === shared.id).role, 'primary')

  const updated = updatePlanningObjective(value, 'p1', { targetSession: 'calendar:p1-resit' })
  assert.equal(updated.after.targetSession, shared.id, 'legacy source ids resolve to the grouped canonical window')
  assert.equal(updated.after.mode, 'resit')
})

test('same-date resits from several periods share a dedicated resit window', () => {
  const value = workspace({
    courses: [course('p1'), course('p2', { period: 'Period 2' })],
    planning: { objectives: {}, academicPeriods: [
      { id: 'p1-resit', title: 'Period 1 resits', date: '2027-01-18', endDate: '2027-01-22', kind: 'resit-week', period: 1, resit: true },
      { id: 'p2-resit', title: 'Period 2 resits', date: '2027-01-18', endDate: '2027-01-22', kind: 'resit-week', period: 2, resit: true }
    ] }
  })
  const shared = planningSessions(value).find((session) => session.kind === 'exam-window')
  assert.equal(shared.label, 'Period 1 + Period 2 resits')
  assert.equal(shared.resit, true)
  assert.equal(planningSessions(value).filter((session) => session.id === 'resit').length, 0)
})

test('a transcript attempt supplies a missing teaching period and verified no-resit rules win', () => {
  const value = workspace({ courses: [course('history', {
    period: '',
    attempts: [{ status: 'failed', period: 'Period 2' }],
    courseProfile: { assessment: { status: 'confirmed', resitRules: ['No resit is available for this course.'] } }
  }), course('period-one')] })
  const rules = planningDestinations(value, 'history')
  assert.equal(rules.evidenceSource, 'transcript-attempt')
  assert.deepEqual(rules.allowedSessionIds, ['period:2', 'following-year'])
})

test('narrow planning updates validate the course, session, grade scale and inferred outcome', () => {
  const value = workspace({ courses: [course('algo', { passMark: 5.5 }), course('other', { period: 'Period 2' })] })
  const updated = updatePlanningObjective(value, 'ALGO', { targetSession: 'resit', expectedGrade: 7.2 })
  assert.equal(updated.course.id, 'algo')
  assert.deepEqual(updated.after, { mode: 'resit', outcome: 'pass', targetSession: 'resit', expectedGrade: 7.2 })
  assert.throws(() => updatePlanningObjective(value, 'missing', { mode: 'resit' }), /not in the active/)
  assert.throws(() => updatePlanningObjective(value, 'algo', { targetSession: 'invented-session' }), /not available/)
  assert.throws(() => updatePlanningObjective(value, 'algo', { targetSession: 'period:2' }), /recorded teaching-period/)
  assert.throws(() => updatePlanningObjective(value, 'algo', { expectedGrade: 70 }), /between 0 and 10/)
  assert.deepEqual(updatePlanningObjective(updated.workspace, 'algo', { expectedGrade: null }).after, { mode: 'resit', outcome: 'actual', targetSession: 'resit' })
})

test('recorded passes are fixed and projected passes count once', () => {
  const value = workspace({
    courses: [
      course('passed', { ects: 5, attempts: [{ status: 'passed' }] }),
      course('planned', { ects: 7 }),
      course('failed', { ects: 9 }),
      course('excluded', { ects: 30, hiddenFromStats: true, attempts: [{ status: 'passed' }] })
    ],
    planning: { objectives: { planned: { mode: 'resit', outcome: 'pass' }, failed: { mode: 'current', outcome: 'fail' } } }
  })
  assert.deepEqual(plannerSummary(value), {
    projectedCredits: 12,
    totalCredits: 21,
    earnedCredits: 5,
    openCourses: value.courses.slice(1, 3),
    plannedCount: 2,
    projectedGates: 0
  })
})

test('doing not sit blocks a pass assumption', () => {
  const value = workspace({
    courses: [course('a')],
    gates: [{ id: 'g', label: 'Pass A', type: 'course', courseId: 'a', target: 0 }],
    planning: { objectives: { a: { mode: 'none', outcome: 'pass' } } }
  })
  assert.equal(gateResolved(value.gates[0], value, true), false)
  assert.equal(plannerSummary(value).projectedCredits, 0)
})

test('total and level credit gates use only visible passed or projected courses', () => {
  const value = workspace({
    courses: [course('a', { ects: 10, attempts: [{ status: 'passed' }] }), course('b', { ects: 5 }), course('c', { ects: 20, yearLevel: 'Year 2', hiddenFromStats: true, attempts: [{ status: 'passed' }] })],
    gates: [
      { id: 'total', label: 'Fifteen', type: 'total-credits', target: 15 },
      { id: 'level', label: 'Year one', type: 'credit-level', level: 'Year 1', target: 15 }
    ],
    planning: { objectives: { b: { mode: 'current', outcome: 'pass' } } }
  })
  assert.equal(gateResolved(value.gates[0], value), false)
  assert.equal(gateResolved(value.gates[0], value, true), true)
  assert.equal(gateResolved(value.gates[1], value, true), true)
})

test('focus order prioritises an unmet named-course requirement', () => {
  const value = workspace({
    courses: [
      course('ordinary', { ects: 10, attempts: [{ status: 'upcoming', examDate: '2026-09-03' }] }),
      course('required', { ects: 5, period: 'Period 2' })
    ],
    gates: [{ id: 'g', label: 'Required course', type: 'course', courseId: 'required', target: 0 }]
  })
  const insights = planningInsights(value, { today: new Date('2026-09-02T12:00:00') })
  assert.equal(insights.priority[0].course.id, 'required')
  assert.equal(insights.priority[0].risk, 'critical')
  assert.equal(insights.priority[1].days, 1)
  assert.deepEqual(insights.periods, [
    { period: 'Period 2', ects: 5, count: 1 },
    { period: 'Period 1', ects: 10, count: 1 }
  ])
})

test('failed and omitted assumptions leave the focus order', () => {
  const value = workspace({
    courses: [course('fail'), course('omit'), course('keep')],
    planning: { objectives: { fail: { mode: 'current', outcome: 'fail' }, omit: { mode: 'none', outcome: 'actual' } } }
  })
  assert.deepEqual(planningInsights(value).priority.map((item) => item.course.id), ['keep'])
})

test('shortest route takes largest eligible credits until the target is covered', () => {
  const value = workspace({
    courses: [course('passed', { ects: 10, attempts: [{ status: 'passed' }] }), course('small', { ects: 5 }), course('large', { ects: 10 })],
    gates: [{ id: 'g', label: 'Twenty five', type: 'total-credits', target: 25 }]
  })
  const [path] = planningInsights(value).minimumPaths
  assert.equal(path.gap, 15)
  assert.deepEqual(path.courses.map((item) => item.id), ['large', 'small'])
})

test('updates preserve unrelated planning data and reset removes only objectives', () => {
  const original = workspace({ planning: { objectives: {}, periodAssignments: [{ id: 'period' }], academicPeriods: [{ id: 'calendar' }] } })
  const changed = withObjective(original, 'a', { outcome: 'pass' })
  assert.deepEqual(changed.planning.objectives.a, { mode: 'current', outcome: 'pass' })
  assert.equal(changed.planning.periodAssignments, original.planning.periodAssignments)
  const reset = resetObjectives(changed)
  assert.deepEqual(reset.planning.objectives, {})
  assert.equal(reset.planning.academicPeriods, original.planning.academicPeriods)
  assert.deepEqual(original.planning.objectives, {})
})

test('open course groups keep teaching-period order and unknown periods last', () => {
  const groups = groupOpenCourses([course('p6', { period: 'Period 6' }), course('p1'), course('unknown', { period: 'Intensive' })])
  assert.deepEqual(groups[0].courses.map((item) => item.id), ['p1', 'p6', 'unknown'])
})
