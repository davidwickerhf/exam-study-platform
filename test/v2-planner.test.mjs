import test from 'node:test'
import assert from 'node:assert/strict'
import {
  gateResolved,
  groupOpenCourses,
  objectiveFor,
  plannerSummary,
  planningInsights,
  resetObjectives,
  withObjective
} from '../lib/v2/planner.mjs'

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
