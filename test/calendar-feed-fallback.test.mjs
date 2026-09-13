import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { observeCalendarFeeds, savedCalendarFeeds } from '../lib/calendar-changes.mjs'
import { aggregateCalendar, calendarFeedsWithFallback } from '../lib/calendar-feed.mjs'
import { calendarToolResult } from '../mcp/calendar-result.mjs'
import { fetchCalendar } from '../lib/academic-documents.mjs'

const link = { id: 'feed', label: 'Timetable', url: 'https://example.com/private.ics' }
const event = { id: 'class', title: 'Lecture', date: '2026-09-14', startTime: '09:00', endTime: '11:00', location: 'Room A' }
const unavailable = async () => { throw new Error('The timetable server could not be reached.') }

test('an outage keeps a scoped saved timetable with times, room and explicit MCP freshness', async () => {
  const userId = `test-calendar-fallback-${randomUUID()}`
  await withRequestContext({ userId }, async () => {
    try {
      const savedAt = '2026-09-13T12:00:00.000Z'
      await observeCalendarFeeds('default', [{ link, events: [event, { ...event, id: 'cancelled', cancelled: true }] }], { now: new Date(savedAt) })
      const result = await calendarFeedsWithFallback('default', [link], { readFeed: unavailable })
      assert.equal(result.freshFeeds.length, 0)
      assert.equal(result.problems[0].usingSaved, true)
      assert.equal(result.problems[0].savedAt, savedAt)
      const calendar = aggregateCalendar({ workspace: {}, feeds: result.feeds })
      assert.equal(calendar.events.length, 1)
      assert.equal(calendar.events[0].start, '2026-09-14T09:00:00')
      assert.equal(calendar.events[0].end, '2026-09-14T11:00:00')
      assert.equal(calendar.events[0].location, 'Room A')
      assert.equal(calendar.events[0].stale, true)
      const mcp = calendarToolResult({ ...calendar, problems: result.problems }, { from: '2026-09-14', to: '2026-09-14' })
      assert.equal(mcp.events[0].savedAt, savedAt)
      assert.equal(mcp.problems[0].usingSaved, true)
      await observeCalendarFeeds('default', result.freshFeeds, { activeFeedIds: [link.id] })
      assert.equal((await savedCalendarFeeds('default', [link]))[0].savedAt, savedAt)
      assert.deepEqual(await savedCalendarFeeds('other-programme', [link]), [])
      assert.deepEqual(await savedCalendarFeeds('default', [{ ...link, url: 'https://example.com/replaced.ics' }]), [])
      await withRequestContext({ userId: `other-${userId}` }, async () => {
        assert.deepEqual(await savedCalendarFeeds('default', [link]), [])
      })
      const recovered = await calendarFeedsWithFallback('default', [link], { readFeed: async () => [{ ...event, startTime: '10:00' }] })
      assert.deepEqual(recovered.problems, [])
      assert.equal(recovered.freshFeeds.length, 1)
      assert.equal(recovered.feeds[0].events[0].startTime, '10:00')
      assert.equal(recovered.feeds[0].savedAt, undefined)
      const empty = await calendarFeedsWithFallback('default', [link], { readFeed: async () => [] })
      assert.deepEqual(empty.feeds[0].events, [])
      const missing = await calendarFeedsWithFallback('other-programme', [link], { readFeed: unavailable })
      assert.deepEqual(missing.feeds, [])
      assert.equal(missing.problems[0].usingSaved, false)
    } finally { await deleteAllDocuments() }
  })
})

test('feed connection timeouts explain refresh failure without exposing the private URL', async () => {
  await assert.rejects(fetchCalendar('https://example.com/private.ics', { fetchImpl: async () => {
    throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })
  } }), /timetable server did not respond in time/)
})
