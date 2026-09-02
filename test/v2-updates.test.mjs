import test from 'node:test'
import assert from 'node:assert/strict'
import { assignmentState, connectionOrigin, courseRows, filterAnnouncements, filterAssignments, isNewAnnouncement, normalisePreferences, parsePreferences } from '../lib/v2/updates.mjs'

test('stored update preferences are validated', () => {
  assert.deepEqual(normalisePreferences({ scope: 'all', days: '90', assignmentState: 'done' }).scope, 'all')
  assert.equal(normalisePreferences({ days: '999', assignmentSort: 'nope' }).days, '30')
  assert.deepEqual(parsePreferences('{broken'), normalisePreferences())
})
test('announcement freshness respects Canvas when known and the local watermark otherwise', () => {
  assert.equal(isNewAnnouncement({ read: false }), true)
  assert.equal(isNewAnnouncement({ read: true, postedAt: '2026-02-01' }, '2026-01-01'), false)
  assert.equal(isNewAnnouncement({ read: null, postedAt: '2026-02-01' }, '2026-01-01'), true)
  assert.deepEqual(filterAnnouncements([{ id: 'b', title: 'Exam', postedAt: '2026-02-02' }, { id: 'a', title: 'Hello', postedAt: '2026-02-01' }], { query: 'exam' }).map(x => x.id), ['b'])
})
test('assignments filter and sort without treating offline work as done', () => {
  assert.equal(assignmentState('offline'), 'offline')
  const rows = filterAssignments([{ id: 'later', title: 'B', status: 'upcoming', dueAt: '2026-04-02' }, { id: 'first', title: 'A', status: 'missing', dueAt: '2026-04-01' }, { id: 'done', title: 'C', status: 'graded' }])
  assert.deepEqual(rows.map(x => x.id), ['first', 'later'])
})
test('course rows retain selected courses and join honest counts', () => {
  const rows = courseRows({ selectedCourseIds: ['1'], courses: [{ id: '1', current: false }, { id: '2', current: false }], announcements: [{ courseId: '1' }], assignments: [{ courseId: '1', status: 'missing' }], grades: [] })
  assert.equal(rows.length, 1); assert.equal(rows[0].announcementCount, 1); assert.equal(rows[0].openCount, 1)
})
test('only secure Canvas origins are accepted by the client helper', () => {
  assert.equal(connectionOrigin('https://canvas.example.edu/path'), 'https://canvas.example.edu')
  assert.equal(connectionOrigin('http://canvas.example.edu'), null)
})
