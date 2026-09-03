import test from 'node:test'
import assert from 'node:assert/strict'
import { PREFERENCES_KEY, SEEN_AT_KEY, assignmentState, connectionOrigin, courseRows, filterAnnouncements, filterAssignments, isNewAnnouncement, markSeen, normalisePreferences, parsePreferences, readPreferences, readSeenAt, writePreferences } from '../lib/workspace/updates.mjs'

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
