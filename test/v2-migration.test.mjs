import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyHashTarget, mergeBrowserState, browserStateSnapshot } from '../lib/workspace/migration.mjs'

test('completed legacy routes translate without swallowing unfinished workflows', () => {
  assert.equal(legacyHashTarget(''), '/app')
  assert.equal(legacyHashTarget('#/course/a/chapter/b'), '/app/courses/a/b')
  assert.equal(legacyHashTarget('#/course/a/chapter/b/assets/week 1.pdf'), '/app/courses/a/b/assets/week%201.pdf')
  assert.equal(legacyHashTarget('#/course/a/mock-exam'), '/app/courses/a/mock-exam')
  assert.equal(legacyHashTarget('#/course/a/item/topic 1'), '/app/courses/a/item/topic%201')
  assert.equal(legacyHashTarget('#/calendar/listMonth'), '/app/calendar?view=listMonth')
  assert.equal(legacyHashTarget('#/tutor/thread 1'), '/app/tutor?conversation=thread%201')
  assert.equal(legacyHashTarget('#/updates/materials'), '/app/updates?tab=materials')
  assert.equal(legacyHashTarget('#/account/connections'), '/app/settings?tab=connections')
  assert.equal(legacyHashTarget('#/planning/documents'), '/app/documents')
  assert.equal(legacyHashTarget('#/practice/mocks/session 1'), '/app/practice?tab=mocks&session=session%201')
  assert.equal(legacyHashTarget('#/mocks/session 1'), '/app/practice?tab=mocks&session=session%201')
  assert.equal(legacyHashTarget('#/sr'), '/app/practice?tab=flashcards')
  assert.equal(legacyHashTarget('#/planning/planner'), '/app/planning?tab=planner')
  assert.equal(legacyHashTarget('#/planning/curriculum/course 1'), '/app/planning?tab=courses&focus=course%201')
  assert.equal(legacyHashTarget('#/course-request/abc'), '/app/course-request/abc')
  assert.equal(legacyHashTarget('#/admin'), '/app/admin?tab=overview')
  assert.equal(legacyHashTarget('#/admin/intake'), '/app/admin?tab=intake')
  assert.equal(legacyHashTarget('#/admin/programme/bcs'), '/app/admin?tab=catalogue&programme=bcs')
  assert.equal(legacyHashTarget('#/admin/course/math/production'), '/app/admin?tab=production&course=math')
  assert.equal(legacyHashTarget('#/account/admin'), '/app/admin')
  assert.equal(legacyHashTarget('#/unknown/deep-link'), null)
  assert.equal(legacyHashTarget('#/course/%E0%A4%A'), null)
})

test('remote browser state wins when it exists and an empty remote never erases local state', () => {
  assert.deepEqual(mergeBrowserState({ local: 'yes', shared: 'old' }, { shared: 'new' }), { local: 'yes', shared: 'new' })
  assert.deepEqual(mergeBrowserState({ local: 'yes' }, {}), { local: 'yes' })
  const values = ['a', 'b']; const data = { a: '1', b: null }
  assert.deepEqual(browserStateSnapshot({ length: 2, key: i => values[i], getItem: key => data[key] }), data)
})
