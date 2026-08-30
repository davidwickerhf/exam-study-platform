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
