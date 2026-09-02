// The academic record's rules, tested where they run.
//
// Credit and GPA arithmetic is the kind that looks right and is quietly wrong:
// a resit that also passed must not earn its credits twice, and a failed
// attempt must not drag an average it was never part of.

import test from 'node:test'
import assert from 'node:assert/strict'
import { attemptRecord, byYear, courseRecord, courseStatus, earnedEcts, eventRecord, gateRecord, planningTab, weightedGpa } from '../lib/workspace/academics.mjs'

const course = (code, ects, attempts = [], extra = {}) => ({
  id: code.toLowerCase(), code, name: code, ects, yearLevel: 'Year 1', period: 'Period 1',
  passMark: 5.5, programmeRequirement: 'required', attempts, ...extra
})

test('a course with no attempts is not recorded', () => {
  assert.equal(courseStatus(course('A', 4)), 'not-recorded')
})

test('a dated attempt with no grade is registered, not failed', () => {
  assert.equal(courseStatus(course('A', 4, [{ examDate: '2026-10-14' }])), 'registered')
})

test('the pass mark is the course\'s own, and the best attempt decides', () => {
  assert.equal(courseStatus(course('A', 4, [{ grade: 5.4 }])), 'failed')
  assert.equal(courseStatus(course('A', 4, [{ grade: 5.5 }])), 'passed')
  assert.equal(courseStatus(course('A', 4, [{ grade: 4 }, { grade: 7 }])), 'passed')
  assert.equal(courseStatus(course('A', 4, [{ grade: 7 }], { passMark: 8 })), 'failed')
})

test('credits are earned once, from a passing attempt', () => {
  // A resit that also passed is still one course worth of credit.
  assert.equal(earnedEcts([course('A', 4, [{ grade: 6 }, { grade: 8 }])]), 4)
  assert.equal(earnedEcts([course('A', 4, [{ grade: 4 }])]), 0)
  assert.equal(earnedEcts([course('A', 4, [{ grade: 6 }]), course('B', 6, [{ grade: 9 }])]), 10)
})

test('the average is weighted by credits and counts passes only', () => {
  const courses = [course('A', 4, [{ grade: 6 }]), course('B', 8, [{ grade: 9 }])]
  // (6·4 + 9·8) / 12 = 8
  assert.equal(weightedGpa(courses), 8)
  // A failed course is not in the average at all.
  assert.equal(weightedGpa([...courses, course('C', 4, [{ grade: 3 }])]), 8)
  assert.equal(weightedGpa([course('A', 4)]), null)
})

test('a resit is averaged at its best grade, not both', () => {
  assert.equal(weightedGpa([course('A', 4, [{ grade: 5.5 }, { grade: 9 }])]), 9)
})

test('years group in order and periods sort by teaching order, not name', () => {
  const groups = byYear([
    course('B', 4, [], { yearLevel: 'Year 2', period: 'Period 2' }),
    course('A', 6, [], { yearLevel: 'Year 1', period: 'Semester 1' }),
    course('C', 4, [], { yearLevel: 'Year 1', period: 'Period 1' })
  ])
  assert.deepEqual(groups.map((group) => group.level), ['Year 1', 'Year 2'])
  // Semester 1 teaches after Period 1, and sorts that way rather than alphabetically.
  assert.deepEqual(groups[0].courses.map((entry) => entry.code), ['C', 'A'])
  assert.equal(groups[0].ects, 10)
})

test('course composers normalize identity and numeric fields', () => {
  const record = courseRecord({ code: ' bcs1000 ', name: ' Intro ', ects: '6.5', passMark: '5.5' }, 'c1')
  assert.equal(record.code, 'BCS1000'); assert.equal(record.name, 'Intro'); assert.equal(record.ects, 6.5); assert.deepEqual(record.attempts, [])
})

test('attempt and requirement composers preserve absence', () => {
  assert.equal(attemptRecord({ grade: '', examDate: '' }, 'a1').grade, null)
  assert.equal(attemptRecord({ grade: '7.5' }, 'a2').grade, 7.5)
  assert.deepEqual(gateRecord({ label: ' Propedeuse ', target: '60' }, 'g1'), { id: 'g1', label: 'Propedeuse', section: 'progression', type: 'total-credits', courseId: null, level: null, target: 60 })
})

test('event composers trim text and keep an absent end date absent', () => {
  assert.deepEqual(eventRecord({ title: ' Registration ', date: '2026-09-12', endDate: '', type: 'deadline' }, 'e1'), { id: 'e1', title: 'Registration', date: '2026-09-12', endDate: null, type: 'deadline', notes: '' })
})

test('legacy planning tab aliases resolve to migrated tabs', () => {
  assert.equal(planningTab('curriculum'), 'courses'); assert.equal(planningTab('credits'), 'progress'); assert.equal(planningTab('requirements'), 'progress'); assert.equal(planningTab('unknown'), 'overview')
})
