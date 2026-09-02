import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyHashTarget, mergeBrowserState, browserStateSnapshot } from '../lib/v2/migration.mjs'

test('completed legacy routes translate without swallowing unfinished workflows', () => {
  assert.equal(legacyHashTarget(''), '/v2')
  assert.equal(legacyHashTarget('#/course/a/chapter/b'), '/v2/courses/a/b')
  assert.equal(legacyHashTarget('#/course/a/chapter/b/assets/week 1.pdf'), '/v2/courses/a/b/assets/week%201.pdf')
  assert.equal(legacyHashTarget('#/course/a/mock-exam'), '/v2/courses/a/mock-exam')
  assert.equal(legacyHashTarget('#/course/a/item/topic 1'), '/v2/courses/a/item/topic%201')
  assert.equal(legacyHashTarget('#/calendar/listMonth'), '/v2/calendar?view=listMonth')
  assert.equal(legacyHashTarget('#/tutor/thread 1'), '/v2/tutor?conversation=thread%201')
  assert.equal(legacyHashTarget('#/updates/materials'), '/v2/updates?tab=materials')
  assert.equal(legacyHashTarget('#/account/connections'), '/v2/account?tab=connections')
  assert.equal(legacyHashTarget('#/planning/documents'), '/v2/planning?tab=documents')
  assert.equal(legacyHashTarget('#/practice/mocks/session 1'), '/v2/practice?tab=mocks&session=session%201')
  assert.equal(legacyHashTarget('#/mocks/session 1'), '/v2/practice?tab=mocks&session=session%201')
  assert.equal(legacyHashTarget('#/sr'), '/v2/practice?tab=flashcards')
  assert.equal(legacyHashTarget('#/planning/planner'), '/v2/planning?tab=planner')
  assert.equal(legacyHashTarget('#/planning/curriculum/course 1'), '/v2/planning?tab=courses&focus=course%201')
  assert.equal(legacyHashTarget('#/course-request/abc'), '/v2/course-request/abc')
  assert.equal(legacyHashTarget('#/admin'), '/v2/admin?tab=overview')
  assert.equal(legacyHashTarget('#/admin/intake'), '/v2/admin?tab=intake')
  assert.equal(legacyHashTarget('#/admin/programme/bcs'), '/v2/admin?tab=catalogue&programme=bcs')
  assert.equal(legacyHashTarget('#/admin/course/math/production'), '/v2/admin?tab=production&course=math')
  assert.equal(legacyHashTarget('#/account/admin'), '/v2/admin')
  assert.equal(legacyHashTarget('#/unknown/deep-link'), null)
  assert.equal(legacyHashTarget('#/course/%E0%A4%A'), null)
})

test('remote browser state wins when it exists and an empty remote never erases local state', () => {
  assert.deepEqual(mergeBrowserState({ local: 'yes', shared: 'old' }, { shared: 'new' }), { local: 'yes', shared: 'new' })
  assert.deepEqual(mergeBrowserState({ local: 'yes' }, {}), { local: 'yes' })
  const values = ['a', 'b']; const data = { a: '1', b: null }
  assert.deepEqual(browserStateSnapshot({ length: 2, key: i => values[i], getItem: key => data[key] }), data)
})
