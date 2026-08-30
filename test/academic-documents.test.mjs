import test from 'node:test'
import assert from 'node:assert/strict'
import { applyChanges, buildChangeSet, normalizeCalendarLink, parseIcs } from '../lib/academic-documents.mjs'
import { normalizeAcademicWorkspace } from '../lib/academics.mjs'

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:exam-1
DTSTART:20261014T090000Z
DTEND:20261014T120000Z
SUMMARY:BCS1520 Statistics exam
LOCATION:Hall A
END:VEVENT
BEGIN:VEVENT
UID:reg-1
DTSTART;VALUE=DATE:20261001
DTEND;VALUE=DATE:20261008
SUMMARY:Resit registration window
DESCRIPTION:Register via the student portal\\, before noon.
END:VEVENT
END:VCALENDAR`

test('parseIcs reads timed and all-day events with types and notes', () => {
  const events = parseIcs(ICS)
  assert.equal(events.length, 2)
  assert.deepEqual(events[0], { id: 'ics-exam-1', title: 'BCS1520 Statistics exam', date: '2026-10-14', endDate: null, type: 'deadline', notes: '09:00–12:00 · Hall A' })
  assert.equal(events[1].date, '2026-10-01')
  assert.equal(events[1].endDate, '2026-10-07')
  assert.equal(events[1].type, 'registration')
  assert.match(events[1].notes, /Register via the student portal, before noon\./)
})

test('calendar links accept webcal and reject other schemes', () => {
  assert.equal(normalizeCalendarLink('webcal://example.edu/feed.ics').url, 'https://example.edu/feed.ics')
  assert.throws(() => normalizeCalendarLink('ftp://x'), /http\(s\)/)
})

test('change sets diff a draft against the plan and apply selectively', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: { university: 'Maastricht University', programme: 'BSc Computer Science' },
    courses: [
      { id: 'c-stats', code: 'BCS1520', name: 'Statistics', ects: 4, attempts: [{ id: 'a1', academicYear: '2026-2027', type: 'first', examDate: null, grade: null, status: 'upcoming' }] },
      { id: 'c-alg', code: 'BCS1540', name: 'Algorithmic Design', ects: 4, attempts: [] }
    ],
    events: [{ id: 'e1', title: 'Resit registration window', date: '2026-10-01', endDate: '2026-10-07', type: 'registration', notes: '' }]
  })
  const draft = {
    profile: { university: '', programme: '', academicYear: '2026-2027' },
    courses: [
      { code: 'BCS1520', name: 'Statistics', ects: 4, attempts: [{ academicYear: '2026-2027', type: 'first', examDate: '2026-10-14', grade: null, status: 'upcoming' }] },
      { code: 'BCS1540', name: 'Algorithmic Design', ects: 4, attempts: [{ academicYear: '2025-2026', type: 'first', examDate: '2026-05-20', grade: 7.5, status: 'passed' }] },
      { code: 'BCS2999', name: 'Brand New Course', ects: 6, yearLevel: 'Year 2', period: 'Period 4', attempts: [] }
    ],
    events: [
      { title: 'Resit registration window', date: '2026-10-01', endDate: '2026-10-07', type: 'registration', notes: '' },
      { title: 'Graduation ceremony', date: '2027-07-01', endDate: null, type: 'ceremony', notes: '' }
    ],
    warnings: []
  }
  const set = buildChangeSet(workspace, draft, { kind: 'exam-schedule' })
  const kinds = set.changes.map((change) => change.kind).sort()
  assert.deepEqual(kinds, ['event', 'exam-date', 'new-course', 'profile', 'result'])
  const examDate = set.changes.find((change) => change.kind === 'exam-date')
  assert.equal(examDate.payload.attemptId, 'a1')
  assert.deepEqual(examDate.payload.updates, { examDate: '2026-10-14' })
  assert.equal(set.changes.find((change) => change.kind === 'new-course').selectedByDefault, false)
  assert.equal(set.reconciliation.status, 'attention')
  assert.deepEqual(set.reconciliation.unselected.map((item) => item.code), ['BCS2999'])

  const accepted = set.changes.filter((change) => change.kind !== 'new-course')
  const { workspace: next, applied } = applyChanges(workspace, accepted)
  assert.equal(applied.length, 4)
  assert.equal(next.courses.find((course) => course.id === 'c-stats').attempts[0].examDate, '2026-10-14')
  const alg = next.courses.find((course) => course.id === 'c-alg')
  assert.equal(alg.attempts.length, 1)
  assert.equal(alg.attempts[0].grade, 7.5)
  assert.equal(alg.attempts[0].status, 'passed')
  assert.equal(next.courses.length, 2)
  assert.equal(next.events.length, 2)
  assert.equal(next.profile.academicYear, '2026-2027')

  // Re-running the same draft proposes nothing that is already applied.
  const again = buildChangeSet(next, draft)
  assert.deepEqual(again.changes.map((change) => change.kind), ['new-course'])
})

test('a timetable cannot silently schedule a completed course or replace selected course facts', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: {},
    courses: [{ id: 'c-stats', code: 'BCS1520', name: 'Statistics', ects: 4, attempts: [{ id: 'a-passed', academicYear: '2025-2026', type: 'first', examDate: '2026-05-20', grade: 8, status: 'passed' }] }]
  })
  const set = buildChangeSet(workspace, {
    profile: {},
    courses: [{ code: 'BCS1520', name: 'Statistics', ects: 6, attempts: [{ academicYear: '2026-2027', type: 'first', examDate: '2026-10-14', grade: null, status: 'upcoming' }] }],
    events: []
  }, { kind: 'timetable', sourceLabel: 'Autumn timetable' })

  const courseConflict = set.changes.find((change) => change.kind === 'course-conflict')
  const attemptConflict = set.changes.find((change) => change.kind === 'attempt-conflict')
  assert.match(courseConflict.detail, /4 ECTS.*6 ECTS/)
  assert.match(attemptConflict.label, /scheduled although already completed/)
  assert.equal(courseConflict.selectedByDefault, false)
  assert.equal(attemptConflict.selectedByDefault, false)

  const unchanged = applyChanges(workspace, set.changes.filter((change) => change.selectedByDefault !== false)).workspace
  assert.equal(unchanged.courses[0].ects, 4)
  assert.equal(unchanged.courses[0].attempts.length, 1)
  assert.equal(unchanged.courses[0].attempts[0].status, 'passed')
})

test('events for an unselected course require that course to be added', () => {
  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [], events: [] })
  const set = buildChangeSet(workspace, {
    profile: {},
    courses: [],
    events: [{ title: 'BCS2999 Lecture', date: '2026-09-02', endDate: null, type: 'other', notes: '09:00–11:00' }]
  }, { kind: 'timetable', sourceLabel: 'Timetable' })
  const addCourse = set.changes.find((change) => change.kind === 'new-course')
  const addEvent = set.changes.find((change) => change.kind === 'event')

  assert.equal(addEvent.requiresCourseChangeId, addCourse.id)
  assert.equal(addEvent.selectedByDefault, false)
  assert.equal(applyChanges(workspace, [addEvent]).applied.length, 0)

  const applied = applyChanges(workspace, [addEvent, addCourse])
  assert.deepEqual(applied.applied, [addCourse.id, addEvent.id])
  assert.equal(applied.workspace.courses[0].code, 'BCS2999')
  assert.equal(applied.workspace.events.length, 1)
})

test('equivalent academic-year punctuation does not create a conflict', () => {
  const workspace = normalizeAcademicWorkspace({ profile: { academicYear: '2026-2027' }, courses: [], events: [] })
  const set = buildChangeSet(workspace, { profile: { academicYear: '2026–2027' }, courses: [], events: [] }, { kind: 'transcript' })
  assert.equal(set.changes.some((change) => change.payload?.field === 'academicYear'), false)
})
