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
  approximateBytes,
  canvasCorpusSummary,
  canvasSyncProgress,
  currentCourseFigure,
  periodLabel,
  programmeFacts,
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

// ----- What the figures on Profile actually mean --------------------------

test('a small stored record is small, not broken', () => {
  // The table's own vocabulary is unchanged: an empty family really is 0 B.
  assert.equal(formatBytes(0), '0 B')
  // Beside a non-zero count, "0 B" reads as a failed measurement, so the
  // summary line says the true thing instead.
  assert.equal(approximateBytes(400), 'under 1 KB')
  assert.equal(approximateBytes(4096), '4.0 KB')
  // Nothing to report is nothing, not a zero the caller has to render.
  assert.equal(approximateBytes(0), null)
  assert.equal(approximateBytes(null), null)
  assert.equal(approximateBytes(-1), null)
})

test('current courses come from the student record, never from the library', () => {
  const figure = currentCourseFigure({
    currentCourses: [{ code: 'bcs1110' }, { code: 'BCS1120' }, { code: 'BCS1130' }],
    academicContext: { period: 'Period 2' }
  })
  assert.equal(figure.count, 3)
  assert.equal(figure.period, 'Period 2')
  assert.deepEqual(figure.codes, ['BCS1110', 'BCS1120', 'BCS1130'])
  // A feed that answered with nothing is zero courses, not an unknown.
  assert.equal(currentCourseFigure({}).count, 0)
  // A feed that has not answered at all is unknown, and says so.
  assert.equal(currentCourseFigure(null), null)
})

test('a period reads as a period however the server spells it', () => {
  assert.equal(periodLabel('2'), 'Period 2')
  assert.equal(periodLabel('Period 2'), 'Period 2')
  assert.equal(periodLabel(''), null)
  assert.equal(periodLabel(null), null)
})

test('the programme a student recorded outranks the programme they are a member of', () => {
  const membership = [{ programmeId: 'p1', role: 'member', programme: { degree: 'BSc', name: 'Data Science' } }]

  // The bug this replaces: a saved academic programme, reported as none.
  const recorded = programmeFacts(
    { programmes: [], account: { mode: 'clerk' } },
    { profile: { programme: 'BSc Data Science and AI', university: 'Maastricht' } }
  )
  assert.equal(recorded.programme, 'BSc Data Science and AI')
  assert.equal(recorded.source, 'record')
  assert.equal(recorded.institution, 'Maastricht')
  assert.equal(recorded.membership, 'Not linked to a shared programme')
  assert.equal(recorded.empty, false)

  // With no record of their own, membership answers instead.
  const joined = programmeFacts({ programmes: membership, account: { mode: 'clerk' } }, null)
  assert.equal(joined.programme, 'BSc Data Science')
  assert.equal(joined.source, 'membership')

  // Admin is a fact about the membership, not about the programme.
  const admin = programmeFacts(
    { programmes: [{ ...membership[0], role: 'admin' }], account: { mode: 'clerk' } },
    null
  )
  assert.equal(admin.memberships[0].admin, true)
  assert.match(admin.membership, /programme admin/)

  // A local account has every programme; it is not missing one.
  const local = programmeFacts({ programmes: [], account: { mode: 'local' } }, null)
  assert.equal(local.empty, false)
  assert.equal(local.membership, 'All programmes (local development)')

  // Genuinely nothing recorded anywhere.
  assert.equal(programmeFacts({ programmes: [], account: { mode: 'clerk' } }, null).empty, true)
})

test('the Canvas import ledger is grouped in one pass', () => {
  const summary = canvasCorpusSummary({
    jobs: [
      { id: '1', status: 'running', courseCode: 'BCS1110' },
      { id: '2', status: 'failed', courseCode: 'BCS1120', error: 'Rate limited' },
      { id: '3', status: 'failed', courseCode: 'BCS1130', error: 'Rate limited' },
      { id: '4', status: 'failed', courseCode: 'BCS1140' },
      { id: '5', status: 'completed', courseCode: 'BCS1110' },
      { id: '6', status: 'pending' }
    ],
    courses: [{ sources: 12, editionCount: 2 }, { sources: 30, editionCount: 1 }]
  })
  assert.deepEqual(summary.active.map((job) => job.id), ['1', '6'])
  assert.deepEqual(summary.failed.map((job) => job.id), ['2', '3', '4'])
  // The server reports newest first, so an older completion cannot overwrite
  // the currently running job for the same course.
  assert.deepEqual(summary.latestByCourse.map((job) => job.id), ['1', '2', '3', '4'])
  // Repeated failures collapse to one row per reason, in first-seen order.
  assert.deepEqual(summary.failureGroups.map(([reason, jobs]) => [reason, jobs.length]), [
    ['Rate limited', 2],
    ['Unknown import error', 1]
  ])
  assert.equal(summary.courseEditions, 3)
  assert.equal(summary.storedMaterials, 42)

  // A server that has never run one is empty, not broken.
  const none = canvasCorpusSummary(null)
  assert.deepEqual(none.jobs, [])
  assert.equal(none.storedMaterials, 0)
})

test('Canvas sync progress matches the current course ledger', () => {
  const progress = canvasSyncProgress({ jobs: [
    { id: 'old', syncId: 'old-batch', type: 'course', status: 'failed', courseCode: 'OLD1000' },
    { id: 'catalog', syncId: 'batch-2', type: 'catalog', status: 'completed' },
    { id: 'one', syncId: 'batch-2', type: 'course', status: 'completed', courseCode: 'BCS1110', result: { indexed: 8 } },
    { id: 'two', syncId: 'batch-2', type: 'course', status: 'running', courseCode: 'BCS1120' },
    { id: 'three', syncId: 'batch-2', type: 'course', status: 'pending', courseCode: 'BCS1130' }
  ] })
  assert.equal(progress.active, true)
  assert.equal(progress.percent, 50)
  assert.equal(progress.totalCourses, 4)
  assert.equal(progress.settledCourses, 2)
  assert.equal(progress.completedCourses, 1)
  assert.equal(progress.indexedFiles, 8)
  assert.match(progress.stage, /BCS1120/)
  assert.equal(progress.jobs.some((job) => job.id === 'old'), true)
  assert.equal(canvasSyncProgress({ jobs: [] }).active, false)
})

test('Canvas sync progress ignores superseded active attempts and reports durable material', () => {
  const progress = canvasSyncProgress({
    jobs: [
      { id: 'new-complete', syncId: 'new', type: 'course', status: 'completed', courseCode: 'BCS2120', result: { indexed: 0 } },
      { id: 'new-running', syncId: 'new', type: 'course', status: 'running', courseCode: 'BCS3300' },
      { id: 'old-running', syncId: 'old', type: 'course', status: 'running', courseCode: 'BCS2120' },
      { id: 'old-catalog', syncId: 'old', type: 'catalog', status: 'running' }
    ],
    courses: [{ courseCode: 'BCS2120', sources: 28 }, { courseCode: 'BCS3300', sources: 12 }]
  })

  assert.equal(progress.active, true)
  assert.deepEqual(progress.activeJobs.map((job) => job.id), ['new-running'])
  assert.equal(progress.totalCourses, 2)
  assert.equal(progress.settledCourses, 1)
  assert.equal(progress.percent, 50)
  assert.equal(progress.indexedFiles, 40)
  assert.match(progress.stage, /BCS3300/)
})

test('Canvas progress keeps every repeated sitting and supersedes retries within only that edition', () => {
  const jobs = [
    { id: 'old-year-done', bindingId: '2024', courseCode: 'BCS2120', academicYear: '2024-2025', type: 'course', status: 'completed' },
    { id: 'current-running', bindingId: '2026', courseCode: 'BCS2120', academicYear: '2026-2027', type: 'course', status: 'running' },
    { id: 'middle-failed', bindingId: '2025', courseCode: 'BCS2120', academicYear: '2025-2026', type: 'course', status: 'failed' },
    { id: 'superseded', bindingId: '2026', courseCode: 'BCS2120', academicYear: '2026-2027', type: 'course', status: 'failed' },
  ]
  const summary = canvasCorpusSummary({ jobs })
  assert.equal(summary.latestByEdition.length, 3)
  assert.equal(summary.latestByEdition.some(job => job.id === 'superseded'), false)
  const progress = canvasSyncProgress({ jobs })
  assert.equal(progress.totalCourses, 3)
  assert.equal(progress.completedCourses, 1)
  assert.equal(progress.failedCourses, 1)
  assert.equal(progress.activeJobs[0].id, 'current-running')
  const truncated = canvasCorpusSummary({ jobs: jobs.slice(0, 1), latestJobs: jobs.slice(0, 3) })
  assert.equal(truncated.latestByEdition.length, 3, 'bounded run history must not hide the current sitting')
})
