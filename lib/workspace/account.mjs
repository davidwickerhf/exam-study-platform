/**
 * The account surface's rules.
 *
 * Plain ESM with a .d.mts beside it, for the same reason as lib/app/academics.mjs:
 * node:test imports the module the page uses, so there is one implementation of
 * each rule rather than a copy that drifts.
 *
 * Everything here is arithmetic and vocabulary. Nothing in this file touches a
 * secret: `mcpSnippet` deliberately builds its example around a placeholder so
 * a real key can never be written into markup, a log, or a URL.
 */

/**
 * Bytes as the storage table reads them. Absent is not zero — a record family
 * whose size the server cannot measure reports `null`, and that is a dash, not
 * "0 B".
 */
export function formatBytes(bytes) {
  if (bytes == null) return '—'
  const value = Number(bytes)
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function formatCount(value) {
  return new Intl.NumberFormat('en-GB').format(Math.max(0, Number(value) || 0))
}

/**
 * The size that sits beside a record count in a summary line.
 *
 * `formatBytes` is the table's vocabulary, where an exact 0 B is a true reading
 * of an empty family. In a summary line beside a non-zero count it is not: a
 * student with one stored record reading "1 · 0 B" concludes the page is
 * broken, not that the record is small. Anything the server measures below a
 * kilobyte is therefore reported as being under one, and an unmeasured total
 * returns null so the caller can leave the figure out entirely rather than
 * inventing a zero.
 */
export function approximateBytes(bytes) {
  if (bytes == null) return null
  const value = Number(bytes)
  if (!Number.isFinite(value) || value < 0) return null
  if (value < 1024) return value > 0 ? 'under 1 KB' : null
  return formatBytes(value)
}

/**
 * How much of an allowance is spent, 0–100.
 *
 * A limit that is missing or zero returns null rather than a number: an
 * unknown allowance is unknown, and the vanilla version's `Math.max(1, limit)`
 * quietly turned "no limit configured" into "100% used" the moment one request
 * had been made. Over-spend clamps to 100 so a reserved-token overshoot cannot
 * paint a bar past its track.
 */
export function meterPercent(used, limit) {
  const ceiling = Number(limit)
  if (!Number.isFinite(ceiling) || ceiling <= 0) return null
  const spent = Math.max(0, Number(used) || 0)
  return Math.min(100, Math.round((spent / ceiling) * 100))
}

const METER_SHAPE = [
  { id: 'chat', label: 'Tutor chat today', unit: 'requests', resets: 'day', limit: (l) => l?.chat?.requestsPerDay, used: (u) => u?.today?.requests?.chat, left: (r) => r?.chatToday },
  { id: 'exercises', label: 'Extra exercises today', unit: 'requests', resets: 'day', limit: (l) => l?.exercises?.requestsPerDay, used: (u) => u?.today?.requests?.exercises, left: (r) => r?.exercisesToday },
  { id: 'intake', label: 'Plan imports today', unit: 'requests', resets: 'day', limit: (l) => l?.intake?.requestsPerDay, used: (u) => u?.today?.requests?.intake, left: (r) => r?.intakeToday },
  { id: 'tokens-day', label: 'Tokens today', unit: 'tokens', resets: 'day', limit: (l) => l?.tokensPerDay, used: (u) => u?.today?.tokens, left: (r) => r?.tokensToday },
  { id: 'tokens-month', label: 'Tokens this month', unit: 'tokens', resets: 'month', limit: (l) => l?.tokensPerMonth, used: (u) => u?.month?.tokens, left: (r) => r?.tokensMonth }
]

/**
 * The five allowance meters, in the order the vanilla page showed them.
 * `remaining` comes from the server rather than being recomputed here: the
 * server subtracts reserved tokens for in-flight requests, and a second
 * subtraction in the browser would disagree with it.
 */
export function allowanceMeters(summary) {
  if (!summary) return []
  return METER_SHAPE.map((meter) => {
    const limit = Number(meter.limit(summary.limits)) || null
    const used = Math.max(0, Number(meter.used(summary.usage)) || 0)
    const left = meter.left(summary.remaining)
    return {
      id: meter.id,
      label: meter.label,
      unit: meter.unit,
      resets: meter.resets,
      used,
      limit,
      remaining: Number.isFinite(Number(left)) ? Number(left) : null,
      percent: meterPercent(used, limit)
    }
  })
}

// ----- Study record -------------------------------------------------------

/** "1" reads as a period; "Period 1" reads as a period. Both arrive here. */
export function periodLabel(value) {
  const period = String(value ?? '').replace(/^period\s*/i, '').trim()
  return period ? `Period ${period}` : null
}

/**
 * The courses the student is actually taking.
 *
 * Account used to count the maintained library — every published course on the
 * server — and label it "Active courses", so a first-year with three courses
 * this period read five. The student's own figure is resolved once, on the
 * server, from their academic record, their timetable and the current teaching
 * period; Courses and Home already count it, and Account counts the same thing
 * rather than a second, disagreeing definition of the same word.
 */
export function currentCourseFigure(calendar) {
  if (!calendar) return null
  const rows = Array.isArray(calendar.currentCourses) ? calendar.currentCourses : []
  return {
    count: rows.length,
    period: periodLabel(calendar.academicContext?.period),
    codes: rows.map((row) => String(row?.code ?? '').toUpperCase()).filter(Boolean)
  }
}

/**
 * Which programme to name, and what the shared-programme link is beside it.
 *
 * Two records answer "what are you studying": the student's own academic
 * workspace, and membership of an editorially maintained programme. They are
 * different facts, and the page used to show only the second — so a student
 * with a saved programme in Planning was told here that they had none. The
 * student's own record leads; membership is reported as the separate,
 * secondary fact it is.
 */
export function programmeFacts(summary, workspace) {
  const memberships = (Array.isArray(summary?.programmes) ? summary.programmes : [])
    .map((entry) => ({
      id: String(entry?.programmeId ?? ''),
      label: entry?.programme
        ? [entry.programme.degree, entry.programme.name].filter(Boolean).join(' ').trim()
        : String(entry?.programmeId ?? ''),
      admin: entry?.role === 'admin'
    }))
    .filter((entry) => entry.label)
  const recorded = String(workspace?.profile?.programme ?? '').trim()
  const local = summary?.account?.mode === 'local'
  const programme = recorded || memberships[0]?.label || null

  return {
    programme,
    source: recorded ? 'record' : memberships.length ? 'membership' : null,
    institution: (recorded && String(workspace?.profile?.university ?? '').trim()) || null,
    memberships,
    membership: memberships.length
      ? `Linked to ${memberships.map((entry) => entry.label).join(', ')}${memberships.some((entry) => entry.admin) ? ' · programme admin' : ''}`
      : local
        ? 'All programmes (local development)'
        : 'Not linked to a shared programme',
    // Only genuinely empty when neither record answers — a local account is
    // not missing a programme, it simply has every one.
    empty: !programme && !local
  }
}

// ----- Canvas material collection -----------------------------------------

const IMPORT_FAILURE = 'Unknown import error'
const RUNNING = new Set(['pending', 'running'])

/**
 * The Canvas import ledger, walked once.
 *
 * The Connections tab used to build this inline on every render — two nested
 * `Map` constructions, one of them running a `filter` over the whole failed
 * list per failed job, so a host with fifty broken imports did twenty-five
 * hundred comparisons on each of a four-second poll's re-renders. It is one
 * pass here, and it is the same arithmetic a test can hold still.
 *
 * `latestByCourse` keeps the last job the server sent for a course code, which
 * is the order the API already reports progress in.
 */
export function canvasCorpusSummary(status) {
  const jobs = Array.isArray(status?.jobs) ? status.jobs : []
  const courses = Array.isArray(status?.courses) ? status.courses : []
  const active = []
  const failed = []
  const latest = new Map()
  const failures = new Map()

  for (const job of jobs) {
    if (RUNNING.has(job?.status)) active.push(job)
    if (job?.status === 'failed') {
      failed.push(job)
      const reason = job.error || IMPORT_FAILURE
      const group = failures.get(reason)
      if (group) group.push(job)
      else failures.set(reason, [job])
    }
    if (job?.courseCode) latest.set(job.courseCode, job)
  }

  return {
    jobs,
    active,
    failed,
    latestByCourse: [...latest.values()],
    failureGroups: [...failures.entries()],
    courseEditions: courses.length,
    storedMaterials: courses.reduce((total, course) => total + (Number(course?.sources) || 0), 0)
  }
}

export const AI_FEATURE_LABEL = {
  chat: 'Tutor chat',
  exercises: 'Extra exercises',
  intake: 'Plan import'
}

/** A pending request reserves its ceiling; a finished one reports what it spent. */
export function requestTokens(event) {
  if (!event) return { input: 0, output: 0, estimated: false }
  const pending = event.status === 'pending'
  return {
    input: Math.max(0, Number(event.inputTokens) || 0),
    output: Math.max(0, Number(pending ? event.reservedTokens : event.outputTokens) || 0),
    estimated: Boolean(event.estimated) && event.status === 'completed'
  }
}

// ----- Data & privacy -----------------------------------------------------

/**
 * The storage table in two blocks: what "Reset study data" clears, and what
 * survives it. Order inside each block is the server's, which is already
 * meaningful (study tables first, then the ledgers around them).
 */
export function groupNamespaces(namespaces) {
  const list = Array.isArray(namespaces) ? namespaces : []
  const block = (entries) => ({
    entries,
    count: entries.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0),
    // A family whose size cannot be measured contributes nothing to the total
    // rather than counting as zero, and the block says so.
    bytes: entries.reduce((sum, entry) => sum + (Number(entry.bytes) || 0), 0),
    measured: entries.every((entry) => entry.bytes != null)
  })
  return {
    cleared: block(list.filter((entry) => entry.study)),
    kept: block(list.filter((entry) => !entry.study))
  }
}

/** The plain-language name of a record family, falling back to its namespace. */
export function namespaceLabel(entry) {
  return entry?.label || String(entry?.namespace ?? '').replace(/_/g, ' ') || 'Unknown record'
}

export const RESET_SCOPES = {
  study: {
    title: 'Reset your study data?',
    description: 'Your study record is cleared. Your account, academic plan, and AI usage ledger are kept.',
    action: 'Reset study data',
    removes: [
      'Reading progress, mastery, and course order',
      'Flashcards, spaced-repetition history, and mistakes',
      'Mock sessions, personal exercises, and the activity log'
    ]
  },
  everything: {
    title: 'Erase all personal data?',
    description: 'Every personal record is removed. Your sign-in stays, so you can start from an empty workspace.',
    action: 'Erase everything',
    removes: [
      'Reading progress, mastery, and course order',
      'Flashcards, spaced-repetition history, and mistakes',
      'Mock sessions, personal exercises, and the activity log',
      'Academic plan, programme choices, and AI usage ledger'
    ]
  }
}

/**
 * The server refuses anything but the exact word, and so does the button. The
 * comparison is deliberately exact — not trimmed, not case-folded — because a
 * confirmation the client accepts and the server rejects is worse than no
 * confirmation at all.
 */
export function confirmationMatches(typed, word) {
  return typed === word
}

// ----- API keys -----------------------------------------------------------

export const API_SCOPES = ['read', 'write', 'admin']

export const SCOPE_COPY = {
  read: 'Read courses, chapters, questions, progress, plan, and activity',
  write: 'Record answers, reviews, flashcards, mistakes, mocks, and plan changes',
  admin: 'Manage editorial content and the programme catalogue'
}

export const KEY_LIFETIMES = [
  ['30d', 'In 30 days'],
  ['90d', 'In 90 days'],
  ['1y', 'In 1 year']
]

/** Only an administrator is offered the admin scope; the server enforces it too. */
export function availableScopes(admin) {
  return admin ? [...API_SCOPES] : API_SCOPES.filter((scope) => scope !== 'admin')
}

/**
 * Mirrors lib/api-keys.mjs so the form cannot offer a key the server will
 * refuse: read is always granted, duplicates collapse, an unknown scope is an
 * error rather than a silent drop, and admin needs an administrator.
 */
export function normalizeScopes(scopes, { admin = false } = {}) {
  const requested = [...new Set((Array.isArray(scopes) ? scopes : ['read']).map((scope) => String(scope).trim().toLowerCase()).filter(Boolean))]
  const invalid = requested.filter((scope) => !API_SCOPES.includes(scope))
  if (invalid.length) throw new Error(`Unknown scope: ${invalid.join(', ')}`)
  if (requested.includes('admin') && !admin) throw new Error('Only administrators can create admin keys.')
  if (!requested.includes('read')) requested.unshift('read')
  return requested
}

/**
 * What a key is right now. Revocation wins over expiry — a key revoked before
 * its expiry date is revoked, and saying "expired" would misreport why it
 * stopped working.
 */
export function keyState(key, now = Date.now()) {
  if (!key) return 'active'
  if (key.revokedAt) return 'revoked'
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= now) return 'expired'
  return 'active'
}

export const KEY_STATE_LABEL = { active: 'Active', revoked: 'Revoked', expired: 'Expired' }

export function activeKeys(keys, now = Date.now()) {
  return (keys ?? []).filter((key) => keyState(key, now) === 'active')
}

/** The placeholder every example uses. A real secret never reaches this file. */
export const KEY_PLACEHOLDER = 'wsk_…'

/**
 * The agent/MCP setup snippet. It takes an origin and nothing else: there is
 * no parameter a caller could pass a live key through, so the snippet cannot
 * become a place a secret persists.
 */
export function mcpSnippet(origin) {
  const base = String(origin || '').replace(/\/+$/, '')
  return `curl -H "Authorization: Bearer ${KEY_PLACEHOLDER}" ${base}/api/courses

# MCP (Claude Desktop / Claude Code)
{
  "mcpServers": {
    "wicker-study": {
      "command": "npx",
      "args": ["-y", "wicker-study-mcp"],
      "env": { "WICKER_STUDY_URL": "${base}", "WICKER_STUDY_API_KEY": "${KEY_PLACEHOLDER}" }
    }
  }
}`
}

export function skillSnippet(origin) {
  const base = String(origin || '').replace(/\/+$/, '')
  return `mkdir -p ~/.claude/skills/wicker-study && curl -fsSL ${base}/skills/wicker-study/SKILL.md -o ~/.claude/skills/wicker-study/SKILL.md`
}

// ----- Activity -----------------------------------------------------------

export const ACTIVITY_LABEL = {
  answer: 'Answered a question',
  review: 'Reviewed a flashcard',
  mock: 'Completed a mock',
  resolve: 'Resolved a mistake',
  read: 'Read a chapter'
}

/**
 * The 28-day strip. Heights are relative to the busiest day, with a floor so a
 * single action is still visible and an empty day is still a mark rather than
 * nothing at all.
 */
export function activityBars(series, today = new Date().toISOString().slice(0, 10)) {
  const days = Array.isArray(series) ? series : []
  const max = Math.max(1, ...days.map((day) => Number(day.total) || 0))
  return days.map((day) => {
    const total = Number(day.total) || 0
    return {
      date: day.date,
      total,
      height: total ? Math.max(8, Math.round((total / max) * 100)) : 3,
      today: day.date === today
    }
  })
}

/** The week-over-week line, phrased so an unchanged week does not read as growth. */
export function weekTrend(activity) {
  if (!activity) return null
  const now = Number(activity.week?.total) || 0
  const before = Number(activity.previousWeek) || 0
  const delta = now - before
  return {
    now,
    before,
    delta,
    label: delta === 0 ? 'the same as the week before' : delta > 0 ? `${delta} more than the week before` : `${Math.abs(delta)} fewer than the week before`
  }
}
