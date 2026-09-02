import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarPayload, calendarResultLine } from '../lib/v2/admin-calendar.mjs'

test('a feed URL is normalized and keeps the selected mode', () => {
  assert.deepEqual(calendarPayload({ source: 'url', url: ' https://example.test/calendar.ics ', replace: false }), [{ url: 'https://example.test/calendar.ics', replace: false }])
  assert.throws(() => calendarPayload({ source: 'url', url: 'not a url' }), /valid calendar feed URL/)
  assert.throws(() => calendarPayload({ source: 'url', url: 'file:///tmp/private.ics' }), /http, https or webcal/)
})

test('multiple files replace only once and then merge', () => {
  assert.deepEqual(calendarPayload({ source: 'file', replace: true, files: [{ name: 'a.ics', text: 'A' }, { name: 'b.ics', text: 'B' }] }), [{ ics: 'A', replace: true }, { ics: 'B', replace: false }])
  assert.throws(() => calendarPayload({ source: 'file', files: [] }), /at least one/)
})

test('the result says whether dates replaced or merged', () => {
  assert.equal(calendarResultLine({ read: 1, count: 20, replaced: true }, 'Computer Science'), '1 date read · 20 now published to Computer Science (replaced).')
  assert.equal(calendarResultLine({ read: 2, count: 22, replaced: false }, 'Computer Science'), '2 dates read · 22 now published to Computer Science (merged).')
})
