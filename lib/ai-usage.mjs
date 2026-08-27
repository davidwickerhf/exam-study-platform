import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'
import { readDocument, writeDocument } from './user-store.mjs'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

function positiveInt(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const AI_LIMITS = Object.freeze({
  chat: Object.freeze({
    requestsPerMinute: positiveInt('AI_CHAT_REQUESTS_PER_MINUTE', 6),
    requestsPerDay: positiveInt('AI_CHAT_REQUESTS_PER_DAY', 40),
    maxOutputTokens: positiveInt('AI_CHAT_MAX_OUTPUT_TOKENS', 2400)
  }),
  exercises: Object.freeze({
    requestsPerMinute: positiveInt('AI_EXERCISE_REQUESTS_PER_MINUTE', 2),
    requestsPerDay: positiveInt('AI_EXERCISE_REQUESTS_PER_DAY', 6),
    maxOutputTokens: positiveInt('AI_EXERCISE_MAX_OUTPUT_TOKENS', 8000)
  }),
  intake: Object.freeze({
    requestsPerMinute: positiveInt('AI_INTAKE_REQUESTS_PER_MINUTE', 2),
    requestsPerDay: positiveInt('AI_INTAKE_REQUESTS_PER_DAY', 4),
    maxOutputTokens: positiveInt('AI_INTAKE_MAX_OUTPUT_TOKENS', 6000)
  }),
  tokensPerDay: positiveInt('AI_TOKENS_PER_DAY', 120000),
  tokensPerMonth: positiveInt('AI_TOKENS_PER_MONTH', 1000000)
})

export class AiLimitError extends Error {
  constructor(message, { feature, retryAfter, reason, summary }) {
    super(message)
    this.name = 'AiLimitError'
    this.code = 'AI_RATE_LIMITED'
    this.status = 429
    this.feature = feature
    this.retryAfter = retryAfter
    this.reason = reason
    this.summary = summary
  }
}

export function estimateTokens(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '')
  return Math.max(1, Math.ceil(text.length / 4))
}

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function secondsUntil(date) {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000))
}

function normalizeEvent(row) {
  return {
    id: row.id,
    feature: row.feature,
    status: row.status,
    inputTokens: Number(row.input_tokens || row.inputTokens || 0),
    outputTokens: Number(row.output_tokens || row.outputTokens || 0),
    reservedTokens: Number(row.reserved_tokens || row.reservedTokens || 0),
    estimated: row.estimated !== false,
    createdAt: new Date(row.created_at || row.createdAt).toISOString()
  }
}

async function readEvents() {
  const userId = currentUserId()
  const month = startOfUtcMonth().toISOString()
  if (sql) {
    const rows = await sql`SELECT id, feature, status, input_tokens, output_tokens, reserved_tokens, estimated, created_at
      FROM ai_usage_events
      WHERE user_id = ${userId} AND created_at >= ${month}::timestamptz
      ORDER BY created_at DESC`
    return rows.map(normalizeEvent)
  }
  const value = await readDocument('ai', 'usage', { events: [] })
  return (value.events || []).map(normalizeEvent).filter((event) => event.createdAt >= month)
}

function tally(events, since) {
  const selected = events.filter((event) => event.createdAt >= since.toISOString())
  const completed = selected.filter((event) => event.status === 'completed')
  const pendingCutoff = new Date(Date.now() - 15 * 60_000).toISOString()
  const pending = selected.filter((event) => event.status === 'pending' && event.createdAt >= pendingCutoff)
  const byFeature = { chat: 0, exercises: 0, intake: 0 }
  for (const event of selected) byFeature[event.feature] = (byFeature[event.feature] || 0) + 1
  const inputTokens = completed.reduce((sum, event) => sum + event.inputTokens, 0)
  const outputTokens = completed.reduce((sum, event) => sum + event.outputTokens, 0)
  const reservedTokens = pending.reduce((sum, event) => sum + event.reservedTokens, 0)
  return { requests: byFeature, inputTokens, outputTokens, reservedTokens, tokens: inputTokens + outputTokens + reservedTokens }
}

function buildSummary(events) {
  const now = new Date()
  const minute = tally(events, new Date(now.getTime() - 60_000))
  const today = tally(events, startOfUtcDay(now))
  const month = tally(events, startOfUtcMonth(now))
  return {
    limits: AI_LIMITS,
    usage: { minute, today, month },
    remaining: {
      chatToday: Math.max(0, AI_LIMITS.chat.requestsPerDay - today.requests.chat),
      exercisesToday: Math.max(0, AI_LIMITS.exercises.requestsPerDay - today.requests.exercises),
      intakeToday: Math.max(0, AI_LIMITS.intake.requestsPerDay - today.requests.intake),
      tokensToday: Math.max(0, AI_LIMITS.tokensPerDay - today.tokens),
      tokensMonth: Math.max(0, AI_LIMITS.tokensPerMonth - month.tokens)
    },
    resetsAt: {
      day: new Date(startOfUtcDay(now).getTime() + 86_400_000).toISOString(),
      month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
    }
  }
}

export async function getAiUsageSummary() {
  return buildSummary(await readEvents())
}

async function storeLocalEvents(events) {
  const cutoff = new Date(Date.now() - 35 * 86_400_000).toISOString()
  await writeDocument('ai', 'usage', { events: events.filter((event) => event.createdAt >= cutoff) })
}

export async function reserveAiUsage(feature, { inputTokens, maxOutputTokens, metadata = {} } = {}) {
  const limits = AI_LIMITS[feature]
  if (!limits) throw new Error(`Unsupported AI feature: ${feature}`)
  const events = await readEvents()
  const summary = buildSummary(events)
  const minuteUsed = summary.usage.minute.requests[feature] || 0
  const dayUsed = summary.usage.today.requests[feature] || 0
  const reservedTokens = Math.max(1, Number(inputTokens) || 1) + Math.max(1, Number(maxOutputTokens) || limits.maxOutputTokens)
  const nextMinute = new Date(Date.now() + 60_000)
  const nextDay = new Date(summary.resetsAt.day)
  const nextMonth = new Date(summary.resetsAt.month)

  let reason = null
  let retryAt = nextDay
  if (minuteUsed >= limits.requestsPerMinute) { reason = 'minute_requests'; retryAt = nextMinute }
  else if (dayUsed >= limits.requestsPerDay) reason = 'daily_requests'
  else if (summary.usage.today.tokens + reservedTokens > AI_LIMITS.tokensPerDay) reason = 'daily_tokens'
  else if (summary.usage.month.tokens + reservedTokens > AI_LIMITS.tokensPerMonth) { reason = 'monthly_tokens'; retryAt = nextMonth }
  if (reason) {
    throw new AiLimitError(
      reason === 'minute_requests'
        ? 'You have sent several requests in a short period. Try again in a minute.'
        : reason === 'daily_requests'
          ? `You have used today’s ${feature === 'chat' ? 'tutor chat' : feature === 'exercises' ? 'extra exercise' : 'academic plan import'} allowance. It resets tomorrow.`
          : `Your AI token allowance is used for this ${reason === 'monthly_tokens' ? 'month' : 'day'}.`,
      { feature, reason, retryAfter: secondsUntil(retryAt), summary }
    )
  }

  const event = {
    id: randomUUID(), feature, status: 'pending', inputTokens: 0, outputTokens: 0,
    reservedTokens, estimated: true, createdAt: new Date().toISOString(), metadata
  }
  if (sql) {
    const userId = currentUserId()
    await sql`INSERT INTO ai_usage_events
      (id, user_id, feature, status, reserved_tokens, estimated, metadata)
      VALUES (${event.id}, ${userId}, ${feature}, 'pending', ${reservedTokens}, true, ${JSON.stringify(metadata)}::jsonb)`
  } else {
    await storeLocalEvents([event, ...events])
  }
  return { id: event.id, feature, summary: buildSummary([event, ...events]) }
}

export async function completeAiUsage(reservation, { inputTokens, outputTokens, estimated = true } = {}) {
  if (!reservation?.id) return
  const input = Math.max(0, Number(inputTokens) || 0)
  const output = Math.max(0, Number(outputTokens) || 0)
  if (sql) {
    const userId = currentUserId()
    await sql`UPDATE ai_usage_events SET status = 'completed', input_tokens = ${input}, output_tokens = ${output},
      reserved_tokens = 0, estimated = ${Boolean(estimated)}, completed_at = now()
      WHERE id = ${reservation.id} AND user_id = ${userId}`
  } else {
    const events = await readEvents()
    const event = events.find((item) => item.id === reservation.id)
    if (event) Object.assign(event, { status: 'completed', inputTokens: input, outputTokens: output, reservedTokens: 0, estimated: Boolean(estimated) })
    await storeLocalEvents(events)
  }
}

export async function failAiUsage(reservation) {
  if (!reservation?.id) return
  if (sql) {
    const userId = currentUserId()
    await sql`UPDATE ai_usage_events SET status = 'failed', reserved_tokens = 0, completed_at = now()
      WHERE id = ${reservation.id} AND user_id = ${userId}`
  } else {
    const events = await readEvents()
    const event = events.find((item) => item.id === reservation.id)
    if (event) Object.assign(event, { status: 'failed', reservedTokens: 0 })
    await storeLocalEvents(events)
  }
}
