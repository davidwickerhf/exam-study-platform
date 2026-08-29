import test from 'node:test'
import assert from 'node:assert/strict'
import { recordActivity, readActivity, summariseActivity } from '../lib/activity.mjs'
import { deletePersonalData, deleteStudyData, summarisePersonalData } from '../lib/account-data.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { readDocument, writeDocument } from '../lib/user-store.mjs'

test('activity summary computes streak, weekly totals, and series', () => {
  const now = new Date('2026-08-29T10:00:00Z')
  const at = (daysAgo, hour = 9) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10) + `T0${hour}:00:00.000Z`
  const events = [
    { type: 'answer', at: at(0), score: 8 },
    { type: 'review', at: at(0) },
    { type: 'answer', at: at(1), score: 6 },
    { type: 'mock', at: at(2), score: 7 },
    { type: 'resolve', at: at(9) }
  ]
  const summary = summariseActivity(events, { now, days: 14 })
  assert.equal(summary.streak, 3)
  assert.equal(summary.week.total, 4)
  assert.equal(summary.week.answer, 2)
  assert.equal(summary.previousWeek, 1)
  assert.equal(summary.series.length, 14)
  assert.equal(summary.series.at(-1).total, 2)
  assert.equal(summary.averageScore, 7)
  assert.equal(summary.recent[0].type, 'answer')
})

test('streak survives a day that has not been studied yet', () => {
  const now = new Date('2026-08-29T06:00:00Z')
  const events = [{ type: 'answer', at: '2026-08-28T20:00:00.000Z' }, { type: 'answer', at: '2026-08-27T20:00:00.000Z' }]
  assert.equal(summariseActivity(events, { now }).streak, 2)
})

test('activity is recorded per user and study reset keeps plan and AI ledger', async () => {
  const userId = `test-activity-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await withRequestContext({ userId }, async () => {
      await recordActivity('answer', { courseId: 'sec', chapterId: '01', score: 9, label: 'What is a nonce?' })
      await recordActivity('review', {})
      await writeDocument('academics', 'workspace', { keep: true })
      await writeDocument('ai', 'usage', { events: [] })
      const events = await readActivity()
      assert.equal(events.length, 2)
      assert.equal(events[0].courseId, 'sec')

      const summary = await summarisePersonalData()
      assert.equal(summary.totals.documents, 3)
      assert.ok(summary.namespaces.find((entry) => entry.namespace === 'activity')?.study)
      assert.equal(summary.namespaces.find((entry) => entry.namespace === 'academics')?.study, false)

      const removed = await deleteStudyData()
      assert.equal(removed.documents, 1)
      assert.deepEqual(await readActivity(), [])
      assert.deepEqual(await readDocument('academics', 'workspace', {}), { keep: true })
      assert.deepEqual(await readDocument('ai', 'usage', {}), { events: [] })
    })
  } finally {
    await withRequestContext({ userId }, () => deletePersonalData())
  }
})
