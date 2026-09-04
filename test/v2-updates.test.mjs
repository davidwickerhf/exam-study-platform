import test from 'node:test'
import assert from 'node:assert/strict'
import { PREFERENCES_KEY, SEEN_AT_KEY, assignmentState, canRecordAnnouncementVisit, connectionOrigin, courseRows, filterAnnouncements, filterAssignments, isNewAnnouncement, markSeen, normalisePreferences, parsePreferences, readPreferences, readSeenAt, stableCanvasCourseCode, updateBriefing, writePreferences } from '../lib/workspace/updates.mjs'

test('stored update preferences are validated', () => {
  assert.deepEqual(normalisePreferences({ scope: 'all', days: '90', assignmentState: 'done' }).scope, 'all')
  assert.equal(normalisePreferences({ days: '999', assignmentSort: 'nope' }).days, '30')
  assert.deepEqual(parsePreferences('{broken'), normalisePreferences())
})
test('announcement freshness is measured only against the previous successful visit', () => {
  assert.equal(isNewAnnouncement({ read: false }), false)
  assert.equal(isNewAnnouncement({ read: true, postedAt: '2026-02-01' }, '2026-01-01'), true)
  assert.equal(isNewAnnouncement({ read: false, postedAt: '2025-12-01' }, '2026-01-01'), false)
  assert.deepEqual(filterAnnouncements([{ id: 'b', title: 'Exam', postedAt: '2026-02-02' }, { id: 'a', title: 'Hello', postedAt: '2026-02-01' }], { query: 'exam' }).map(x => x.id), ['b'])
})
test('a partial announcement response cannot advance the visit watermark', () => {
  assert.equal(canRecordAnnouncementVisit({ connected: true, problems: [] }), true)
  assert.equal(canRecordAnnouncementVisit({ connected: true, truncated: true, problems: [] }), false)
  assert.equal(canRecordAnnouncementVisit({ connected: true, problems: [{ part: 'announcements' }] }), false)
  assert.equal(canRecordAnnouncementVisit({ connected: false, problems: [] }), false)
})
test('assignments filter and sort without treating offline work as done', () => {
  assert.equal(assignmentState('offline'), 'offline')
  const rows = filterAssignments([{ id: 'later', title: 'B', status: 'upcoming', dueAt: '2026-04-02' }, { id: 'first', title: 'A', status: 'missing', dueAt: '2026-04-01' }, { id: 'done', title: 'C', status: 'graded' }])
  assert.deepEqual(rows.map(x => x.id), ['first', 'later'])
})
test('the briefing counts open work and names only the next future deadline', () => {
  const now = new Date('2026-09-03T12:00:00Z').getTime()
  const briefing = updateBriefing({
    announcements: [
      { postedAt: '2026-09-03T10:00:00Z', read: null },
      { postedAt: '2026-09-01T10:00:00Z', read: null }
    ],
    assignments: [
      { id: 'late', status: 'overdue', dueAt: '2026-09-02T10:00:00Z' },
      { id: 'next', status: 'upcoming', dueAt: '2026-09-06T10:00:00Z' },
      { id: 'offline', status: 'offline', dueAt: '2026-09-08T10:00:00Z' },
      { id: 'done', status: 'submitted', dueAt: '2026-09-05T10:00:00Z' }
    ]
  }, { since: '2026-09-02T00:00:00Z', now })
  assert.equal(briefing.newAnnouncements, 1)
  assert.equal(briefing.openAssignments, 2)
  assert.equal(briefing.nextDeadline.id, 'next')
})
test('the briefing never turns partial Canvas failures into plausible zeroes', () => {
  const briefing = updateBriefing({
    announcements: [],
    assignments: [],
    truncated: true,
    problems: [{ part: 'assignments' }, { part: 'announcements' }]
  }, { since: '2026-09-02T00:00:00Z' })
  assert.equal(briefing.newAnnouncements, null)
  assert.equal(briefing.openAssignments, null)
  assert.equal(briefing.nextDeadline, null)
  assert.equal(briefing.truncated, true)
})
test('course rows retain selected courses and join honest counts', () => {
  const rows = courseRows({ selectedCourseIds: ['1'], courses: [{ id: '1', current: false }, { id: '2', current: false }], announcements: [{ courseId: '1' }], assignments: [{ courseId: '1', status: 'missing' }], grades: [] })
  assert.equal(rows.length, 1); assert.equal(rows[0].announcementCount, 1); assert.equal(rows[0].openCount, 1)
})
test('course rows mark affected summary counts unavailable', () => {
  const [row] = courseRows({ selectedCourseIds: ['1'], courses: [{ id: '1' }], announcements: [], assignments: [], grades: [], problems: [{ part: 'assignments' }] })
  assert.equal(row.announcementCount, 0)
  assert.equal(row.openCount, null)
})
test('retake shells become one Canvas course while each edition remains inspectable', () => {
  const rows = courseRows({
    selectedCourseIds: ['new'],
    courses: [
      { id: 'old', courseCode: '2024-2025-100-BCS2140', name: 'Operating Systems', term: { name: '2024-2025' } },
      { id: 'new', courseCode: '2026-2027-100-BCS2140', name: 'Operating Systems', current: true, term: { name: '2026-2027' } }
    ],
    announcements: [{ courseId: 'old' }, { courseId: 'new' }],
    assignments: [{ courseId: 'new', status: 'missing' }],
    grades: []
  }, 'all')
  assert.equal(stableCanvasCourseCode({ courseCode: '2026-2027-100-BCS2140' }), 'BCS2140')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].courseCode, 'BCS2140')
  assert.equal(rows[0].editionCount, 2)
  assert.equal(rows[0].announcementCount, 2)
  assert.deepEqual(rows[0].editions.map((edition) => edition.id), ['new', 'old'])
})
test('only secure Canvas origins are accepted by the client helper', () => {
  assert.equal(connectionOrigin('https://canvas.example.edu/path'), 'https://canvas.example.edu')
  assert.equal(connectionOrigin('http://canvas.example.edu'), null)
})

// ----- Where the preferences live -----------------------------------------

/** A Storage the tests can hold still, including one that refuses. */
const memoryStore = () => {
  const held = new Map()
  return {
    getItem: (key) => (held.has(key) ? held.get(key) : null),
    setItem: (key, value) => held.set(key, String(value)),
    held
  }
}

const hostileStore = () => ({
  getItem() { throw new Error('storage is not available') },
  setItem() { throw new Error('quota exceeded') }
})

test('preferences survive a round trip through storage, validated on the way in', () => {
  const store = memoryStore()
  writePreferences({ scope: 'all', days: '90', assignmentState: 'done' }, store)
  assert.equal(store.held.get(PREFERENCES_KEY), JSON.stringify(normalisePreferences({ scope: 'all', days: '90', assignmentState: 'done' })))
  assert.equal(readPreferences(store).scope, 'all')

  // Anything the store hands back that is not a preference set is defaults.
  store.held.set(PREFERENCES_KEY, '{broken')
  assert.deepEqual(readPreferences(store), normalisePreferences())

  // A tampered value is still normalised rather than trusted.
  store.held.set(PREFERENCES_KEY, JSON.stringify({ days: '999', scope: 'everything' }))
  assert.equal(readPreferences(store).days, '30')
  assert.equal(readPreferences(store).scope, 'current')
})

test('a browser that refuses storage costs a preference, not the page', () => {
  const store = hostileStore()
  // The private-window case: reading throws, and the page still renders.
  assert.deepEqual(readPreferences(store), normalisePreferences())
  assert.equal(readSeenAt(store), '')
  // Writing throws too, and is simply not persisted.
  assert.doesNotThrow(() => writePreferences({ scope: 'all' }, store))
  assert.doesNotThrow(() => markSeen('2026-03-01T00:00:00.000Z', store))
  // The caller still gets back a usable value for this session.
  assert.equal(writePreferences({ scope: 'all' }, store).scope, 'all')
})

test('the seen-at watermark is written and read under one agreed key', () => {
  const store = memoryStore()
  assert.equal(readSeenAt(store), '')
  markSeen('2026-03-01T09:00:00.000Z', store)
  assert.equal(store.held.get(SEEN_AT_KEY), '2026-03-01T09:00:00.000Z')
  assert.equal(readSeenAt(store), '2026-03-01T09:00:00.000Z')
  // And it is the watermark announcement freshness is measured against.
  assert.equal(isNewAnnouncement({ postedAt: '2026-03-02T10:00:00.000Z' }, readSeenAt(store)), true)
  assert.equal(isNewAnnouncement({ postedAt: '2026-02-28T10:00:00.000Z' }, readSeenAt(store)), false)
})
