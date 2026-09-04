// The academic record's rules, tested where they run.
//
// Credit and GPA arithmetic is the kind that looks right and is quietly wrong:
// a resit that also passed must not earn its credits twice, and a failed
// attempt must not drag an average it was never part of.

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWorkspaceEdit, attemptRecord, byYear, courseRecord, courseStatus, earnedEcts, eventRecord, gateRecord, planningTab, weightedGpa } from '../lib/workspace/academics.mjs'

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

test('a recorded outcome word is read when no grade was printed', () => {
  // A transcript may record an outcome without a number — a pass/fail unit, an
  // exemption, a no-show. Every planning surface used to classify those strings
  // for itself; they are classified here, once.
  assert.equal(courseStatus(course('A', 4, [{ status: 'passed' }])), 'passed')
  assert.equal(courseStatus(course('A', 4, [{ status: 'Exempt' }])), 'passed')
  assert.equal(courseStatus(course('A', 4, [{ status: 'no-show' }])), 'failed')
  assert.equal(courseStatus(course('A', 4, [{ status: 'upcoming' }])), 'registered')
  // A number is the institution's own arithmetic and outranks its own word.
  assert.equal(courseStatus(course('A', 4, [{ status: 'failed', grade: 8 }])), 'passed')
  // A word-only pass earns its credits but cannot enter an average of grades.
  assert.equal(earnedEcts([course('A', 4, [{ status: 'passed' }])]), 4)
  assert.equal(weightedGpa([course('A', 4, [{ status: 'passed' }])]), null)
})

// ── applyWorkspaceEdit ───────────────────────────────────────────────────
// Planning saves the whole workspace, so every edit used to rebuild that
// object by hand at its call site. These are the mistakes that made:
// a preserved field silently dropped, and a write that changed nothing.

const plan = (patch = {}) => ({
  id: 'p1', revision: 4,
  profile: { university: 'UM', programme: 'BSc', academicYear: '2026–2027' },
  courses: [], gates: [], events: [], ...patch
})

test('an edit that changes nothing is not a save', () => {
  // An unchanged PUT still burns the revision, so a no-op must not write.
  assert.equal(applyWorkspaceEdit(plan(), { type: 'course:add', input: { name: '  ' } }), null)
  assert.equal(applyWorkspaceEdit(plan(), { type: 'course:remove', id: 'gone' }), null)
  assert.equal(applyWorkspaceEdit(plan(), { type: 'course:update', id: 'gone', input: { name: 'x' } }), null)
  assert.equal(applyWorkspaceEdit(plan(), { type: 'event:add', input: { title: '' } }), null)
  assert.equal(applyWorkspaceEdit(plan(), { type: 'gate:add', input: { label: '' } }), null)
  assert.equal(applyWorkspaceEdit(plan(), { type: 'profile', values: {} }), null)
  assert.throws(() => applyWorkspaceEdit(plan(), { type: 'course:teleport' }), /Unknown planning edit/)
})

test('editing a course keeps the fields its form never showed', () => {
  // The composer writes seven fields; the record carries more. Rebuilding it
  // from the form alone dropped the editorial link and the curriculum notes.
  const existing = { ...course('BCS1000', 6, [{ id: 'a1', grade: 7 }]), editorialCourseId: 'ed-1', notes: 'Room C1.02', hiddenFromStats: true }
  const next = applyWorkspaceEdit(plan({ courses: [existing] }), { type: 'course:update', id: 'bcs1000', input: { ects: '7.5', period: 'Period 2' } })
  assert.equal(next.courses[0].ects, 7.5)
  assert.equal(next.courses[0].period, 'Period 2')
  assert.equal(next.courses[0].editorialCourseId, 'ed-1')
  assert.equal(next.courses[0].notes, 'Room C1.02')
  assert.equal(next.courses[0].hiddenFromStats, true)
  // Attempts are edited through their own patches, never by the course form.
  assert.deepEqual(next.courses[0].attempts, existing.attempts)
})

test('every edit leaves the record it was read from untouched', () => {
  const original = plan({ courses: [course('A', 4)], events: [{ id: 'e1', title: 'Registration', date: '2026-09-12', type: 'deadline' }] })
  const snapshot = JSON.parse(JSON.stringify(original))
  applyWorkspaceEdit(original, { type: 'course:add', input: { name: 'B', ects: 5 } })
  applyWorkspaceEdit(original, { type: 'attempt:add', courseId: 'a', input: { grade: '8' } })
  applyWorkspaceEdit(original, { type: 'event:remove', id: 'e1' })
  assert.deepEqual(original, snapshot)
})

test('attempts are added, corrected, and removed against one named course', () => {
  const start = plan({ courses: [course('A', 4), course('B', 6)] })
  const added = applyWorkspaceEdit(start, { type: 'attempt:add', courseId: 'a', input: { grade: '4', examDate: '2026-10-14' }, id: 'at-1' })
  assert.equal(added.courses[0].attempts.length, 1)
  assert.deepEqual(added.courses[1].attempts, [])
  assert.equal(courseStatus(added.courses[0]), 'failed')

  const corrected = applyWorkspaceEdit(added, { type: 'attempt:update', courseId: 'a', attemptId: 'at-1', input: { grade: '8' } })
  assert.equal(corrected.courses[0].attempts[0].grade, 8)
  // The sitting keeps the date it was recorded under.
  assert.equal(corrected.courses[0].attempts[0].examDate, '2026-10-14')
  assert.equal(courseStatus(corrected.courses[0]), 'passed')

  assert.equal(applyWorkspaceEdit(corrected, { type: 'attempt:remove', courseId: 'a', attemptId: 'nope' }), null)
  assert.deepEqual(applyWorkspaceEdit(corrected, { type: 'attempt:remove', courseId: 'a', attemptId: 'at-1' }).courses[0].attempts, [])
})

test('an attempt written before ids existed is still removable by position', () => {
  const start = plan({ courses: [course('A', 4, [{ grade: 6 }, { grade: 7 }])] })
  const next = applyWorkspaceEdit(start, { type: 'attempt:remove', courseId: 'a', index: 0 })
  assert.deepEqual(next.courses[0].attempts.map((attempt) => attempt.grade), [7])
})

test('profile edits merge one fact at a time and trim what they write', () => {
  const next = applyWorkspaceEdit(plan(), { type: 'profile', values: { academicYear: '  2027–2028  ' } })
  assert.equal(next.profile.academicYear, '2027–2028')
  assert.equal(next.profile.programme, 'BSc')
  assert.equal(next.profile.university, 'UM')
})

test('requirements and events are edited in place and removed by id', () => {
  const withGate = applyWorkspaceEdit(plan(), { type: 'gate:add', input: { label: 'Propedeuse', target: '60' }, id: 'g1' })
  assert.equal(withGate.gates[0].target, 60)
  const retargeted = applyWorkspaceEdit(withGate, { type: 'gate:update', id: 'g1', input: { target: '45' } })
  assert.equal(retargeted.gates[0].label, 'Propedeuse')
  assert.equal(retargeted.gates[0].target, 45)
  assert.deepEqual(applyWorkspaceEdit(retargeted, { type: 'gate:remove', id: 'g1' }).gates, [])

  const withEvent = applyWorkspaceEdit(plan(), { type: 'event:add', input: { title: 'Resit closes', date: '2026-11-01', type: 'deadline' }, id: 'e1' })
  const renamed = applyWorkspaceEdit(withEvent, { type: 'event:update', id: 'e1', input: { title: 'Resit registration closes' } })
  assert.equal(renamed.events[0].title, 'Resit registration closes')
  assert.equal(renamed.events[0].date, '2026-11-01')
  assert.deepEqual(applyWorkspaceEdit(renamed, { type: 'event:remove', id: 'e1' }).events, [])
})

test('legacy planning tab aliases resolve to migrated tabs', () => {
  assert.equal(planningTab('curriculum'), 'courses'); assert.equal(planningTab('credits'), 'overview'); assert.equal(planningTab('requirements'), 'overview'); assert.equal(planningTab('progress'), 'overview'); assert.equal(planningTab('unknown'), 'planner')
})
