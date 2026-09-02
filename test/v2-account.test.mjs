// The account surface's rules, tested where they run.
//
// Two families of quiet wrongness live here. One is arithmetic that looks
// right — a percentage against a limit that does not exist, a size total that
// adds unmeasurable families as zero. The other is a scope or a confirmation
// the browser accepts and the server refuses, which is worse than no check at
// all because it fails after the student has already committed.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  KEY_PLACEHOLDER,
  activeKeys,
  activityBars,
  allowanceMeters,
  availableScopes,
  confirmationMatches,
  formatBytes,
  groupNamespaces,
  keyState,
  mcpSnippet,
  meterPercent,
  namespaceLabel,
  normalizeScopes,
  requestTokens,
  weekTrend
} from '../lib/workspace/account.mjs'

test('bytes read at the scale they are, and an unmeasured family is a dash', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1023), '1023 B')
  assert.equal(formatBytes(1024), '1.0 KB')
  // Under 10 KB keeps a decimal; above it, the decimal is noise.
  assert.equal(formatBytes(10 * 1024 - 1), '10.0 KB')
  assert.equal(formatBytes(10 * 1024), '10 KB')
  assert.equal(formatBytes(1024 * 1024), '1.0 MB')
  // Absent is not zero: a family whose size the server cannot measure is
  // reported as unknown, not as an empty one.
  assert.equal(formatBytes(null), '—')
  assert.equal(formatBytes(undefined), '—')
})

test('an allowance with no limit is unknown, not fully spent', () => {
  assert.equal(meterPercent(0, 40), 0)
  assert.equal(meterPercent(10, 40), 25)
  // Reserved tokens for an in-flight request can overshoot the limit; the bar
  // stops at its track rather than running past it.
  assert.equal(meterPercent(60, 40), 100)
  // The vanilla version clamped the limit to at least 1, which turned an
  // unconfigured allowance into "100% used" after a single request.
  assert.equal(meterPercent(1, 0), null)
  assert.equal(meterPercent(1, null), null)
})

const usage = {
  limits: {
    chat: { requestsPerDay: 40 },
    exercises: { requestsPerDay: 6 },
    intake: { requestsPerDay: 4 },
    tokensPerDay: 120000,
    tokensPerMonth: 1000000
  },
  usage: {
    today: { requests: { chat: 10, exercises: 0, intake: 1 }, tokens: 30000 },
    month: { requests: { chat: 90, exercises: 4, intake: 2 }, tokens: 250000 }
  },
  remaining: { chatToday: 30, exercisesToday: 6, intakeToday: 3, tokensToday: 90000, tokensMonth: 750000 }
}

test('the five meters read from the server, and remaining is never recomputed', () => {
  const meters = allowanceMeters(usage)
  assert.deepEqual(meters.map((meter) => meter.id), ['chat', 'exercises', 'intake', 'tokens-day', 'tokens-month'])
  assert.equal(meters[0].percent, 25)
  assert.equal(meters[3].used, 30000)
  assert.equal(meters[4].percent, 25)
  // The server subtracts tokens reserved by in-flight requests. Subtracting
  // again in the browser would disagree with the number that enforces the cap.
  const stale = allowanceMeters({ ...usage, remaining: { ...usage.remaining, tokensToday: 12345 } })
  assert.equal(stale[3].remaining, 12345)
  assert.deepEqual(allowanceMeters(null), [])
})

test('a pending request is shown at the tokens it reserved, not at zero', () => {
  assert.deepEqual(requestTokens({ status: 'pending', inputTokens: 0, outputTokens: 0, reservedTokens: 2400, estimated: true }), { input: 0, output: 2400, estimated: false })
  assert.deepEqual(requestTokens({ status: 'completed', inputTokens: 900, outputTokens: 120, reservedTokens: 0, estimated: true }), { input: 900, output: 120, estimated: true })
  // A failed request spent nothing and reserves nothing.
  assert.deepEqual(requestTokens({ status: 'failed', inputTokens: 0, outputTokens: 0, reservedTokens: 0, estimated: false }), { input: 0, output: 0, estimated: false })
})

const namespaces = [
  { namespace: 'item_progress', label: 'Question progress', count: 40, bytes: 4096, updatedAt: '2026-03-01T00:00:00.000Z', study: true },
  { namespace: 'activity', label: 'Study activity log', count: 120, bytes: 2048, updatedAt: '2026-03-02T00:00:00.000Z', study: true },
  { namespace: 'academics', label: 'Academic plan', count: 1, bytes: null, updatedAt: '2026-02-01T00:00:00.000Z', study: false },
  { namespace: 'ai', label: 'AI usage ledger', count: 9, bytes: 512, updatedAt: '2026-03-03T00:00:00.000Z', study: false }
]

test('the storage table splits by what a reset actually clears', () => {
  const { cleared, kept } = groupNamespaces(namespaces)
  assert.deepEqual(cleared.entries.map((entry) => entry.namespace), ['item_progress', 'activity'])
  assert.deepEqual(kept.entries.map((entry) => entry.namespace), ['academics', 'ai'])
  assert.equal(cleared.count, 160)
  assert.equal(cleared.bytes, 6144)
  assert.equal(cleared.measured, true)
  // The academic plan's size is not measurable, so the kept block's total is a
  // floor rather than a figure — and it says so instead of implying 0 bytes.
  assert.equal(kept.bytes, 512)
  assert.equal(kept.measured, false)
  assert.deepEqual(groupNamespaces(undefined), { cleared: { entries: [], count: 0, bytes: 0, measured: true }, kept: { entries: [], count: 0, bytes: 0, measured: true } })
})

test('a record family without a label falls back to a readable namespace', () => {
  assert.equal(namespaceLabel({ namespace: 'item_progress', label: 'Question progress' }), 'Question progress')
  assert.equal(namespaceLabel({ namespace: 'mock_sessions' }), 'mock sessions')
  assert.equal(namespaceLabel(null), 'Unknown record')
})

test('a confirmation the server would refuse is refused here too', () => {
  assert.equal(confirmationMatches('RESET', 'RESET'), true)
  // The server compares the exact string. Accepting these in the browser would
  // send the student through the dialog only to fail at the API.
  assert.equal(confirmationMatches('reset', 'RESET'), false)
  assert.equal(confirmationMatches(' RESET ', 'RESET'), false)
  assert.equal(confirmationMatches('DELETE', 'RESET'), false)
})

test('scopes match what the server will actually grant', () => {
  // read is implied by every key, and the server adds it if the form omits it.
  assert.deepEqual(normalizeScopes(['write']), ['read', 'write'])
  assert.deepEqual(normalizeScopes(['read', 'read', 'write']), ['read', 'write'])
  assert.deepEqual(normalizeScopes([]), ['read'])
  assert.deepEqual(normalizeScopes(['admin'], { admin: true }), ['read', 'admin'])
  // A non-administrator cannot mint an admin key, and finding that out here is
  // better than finding it out from a 400.
  assert.throws(() => normalizeScopes(['admin']), /administrators/)
  assert.throws(() => normalizeScopes(['delete']), /Unknown scope: delete/)
  assert.deepEqual(availableScopes(false), ['read', 'write'])
  assert.deepEqual(availableScopes(true), ['read', 'write', 'admin'])
})

test('a revoked key is revoked, even when its expiry has also passed', () => {
  const now = Date.parse('2026-06-01T00:00:00.000Z')
  assert.equal(keyState({ createdAt: '2026-01-01', expiresAt: '2026-12-01T00:00:00.000Z', revokedAt: null }, now), 'active')
  assert.equal(keyState({ expiresAt: '2026-05-01T00:00:00.000Z', revokedAt: null }, now), 'expired')
  // Saying "expired" would misreport why the key stopped working.
  assert.equal(keyState({ expiresAt: '2026-05-01T00:00:00.000Z', revokedAt: '2026-04-01T00:00:00.000Z' }, now), 'revoked')
  assert.equal(keyState({ expiresAt: null, revokedAt: null }, now), 'active')
  const keys = [
    { id: 'a', expiresAt: null, revokedAt: null },
    { id: 'b', expiresAt: '2026-05-01T00:00:00.000Z', revokedAt: null },
    { id: 'c', expiresAt: null, revokedAt: '2026-05-02T00:00:00.000Z' }
  ]
  assert.deepEqual(activeKeys(keys, now).map((key) => key.id), ['a'])
})

test('the setup snippet cannot carry a real secret', () => {
  const snippet = mcpSnippet('https://study.wicker.life/')
  // There is no parameter to pass a key through, and the origin loses its
  // trailing slash so the example URL is the one the server actually serves.
  assert.match(snippet, /https:\/\/study\.wicker\.life\/api\/courses/)
  assert.equal(snippet.includes(KEY_PLACEHOLDER), true)
  assert.equal(/wsk_[A-Za-z0-9_-]{8,}/.test(snippet), false)
})

test('activity bars scale to the busiest day and keep an empty day visible', () => {
  const bars = activityBars([
    { date: '2026-03-01', total: 0 },
    { date: '2026-03-02', total: 2 },
    { date: '2026-03-03', total: 8 }
  ], '2026-03-03')
  assert.deepEqual(bars.map((bar) => bar.height), [3, 25, 100])
  assert.deepEqual(bars.map((bar) => bar.today), [false, false, true])
  // One action on an otherwise busy month must still be a mark, not a hairline.
  const busy = activityBars([{ date: '2026-03-01', total: 1 }, { date: '2026-03-02', total: 200 }], '2026-03-02')
  assert.equal(busy[0].height, 8)
  assert.deepEqual(activityBars([]), [])
})

test('an unchanged week does not read as growth', () => {
  assert.equal(weekTrend({ week: { total: 12 }, previousWeek: 12 }).label, 'the same as the week before')
  assert.equal(weekTrend({ week: { total: 12 }, previousWeek: 5 }).label, '7 more than the week before')
  assert.equal(weekTrend({ week: { total: 3 }, previousWeek: 9 }).label, '6 fewer than the week before')
  assert.equal(weekTrend(null), null)
})
