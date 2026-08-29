import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'
import { readDocument, writeDocument, deleteDocument } from './user-store.mjs'

// A per-user ledger of study events. It powers the streak, the weekly
// summary, and the activity feed on Home. Events are appended by the server
// when a student answers, reviews, sits a mock, or resolves a mistake;
// nothing here is derived from editorial material.
//
// On Neon the ledger is the `activity_events` table (db/006). Without a
// DATABASE_URL (local development and tests) it is a bounded JSON document.

export const ACTIVITY_TYPES = Object.freeze({
  answer: 'Answered a question',
  review: 'Reviewed a flashcard',
  mock: 'Completed a mock',
  resolve: 'Resolved a mistake',
  read: 'Read a chapter'
})

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
const RETENTION_DAYS = 120
const MAX_LOCAL_EVENTS = 4000

function dayKey(iso) {
  return String(iso).slice(0, 10)
}

function utcDay(offset = 0, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
  return d.toISOString().slice(0, 10)
}

function normalizeEvent(row) {
  return {
    type: row.type,
    at: new Date(row.created_at || row.at).toISOString(),
    courseId: row.course_id ?? row.courseId ?? null,
    chapterId: row.chapter_id ?? row.chapterId ?? null,
    score: row.score == null ? null : Number(row.score),
    label: row.label ?? null
  }
}

export async function readActivity({ since = null } = {}) {
  const userId = currentUserId()
  const cutoff = since || new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()
  if (sql) {
    const rows = await sql`SELECT type, course_id, chapter_id, score, label, created_at
      FROM activity_events WHERE user_id = ${userId} AND created_at >= ${cutoff}::timestamptz
      ORDER BY created_at ASC`
    return rows.map(normalizeEvent)
  }
  const value = await readDocument('activity', 'log', { events: [] })
  return (Array.isArray(value.events) ? value.events : []).filter((event) => event?.at >= cutoff).map(normalizeEvent)
}

export async function recordActivity(type, meta = {}, { now = new Date() } = {}) {
  if (!ACTIVITY_TYPES[type]) throw new Error(`Unsupported activity type: ${type}`)
  const event = {
    type,
    at: now.toISOString(),
    courseId: meta.courseId ? String(meta.courseId) : null,
    chapterId: meta.chapterId ? String(meta.chapterId) : null,
    score: typeof meta.score === 'number' && Number.isFinite(meta.score) ? Math.min(10, Math.max(0, Math.round(meta.score * 10) / 10)) : null,
    label: meta.label ? String(meta.label).slice(0, 160) : null
  }
  if (sql) {
    const userId = currentUserId()
    await sql`INSERT INTO activity_events (id, user_id, type, course_id, chapter_id, score, label, created_at)
      VALUES (${randomUUID()}, ${userId}, ${event.type}, ${event.courseId}, ${event.chapterId}, ${event.score}, ${event.label}, ${event.at}::timestamptz)`
    return event
  }
  const events = await readActivity()
  events.push(event)
  await writeDocument('activity', 'log', { events: events.slice(-MAX_LOCAL_EVENTS) })
  return event
}

export async function deleteActivity() {
  const userId = currentUserId()
  if (sql) {
    const rows = await sql`DELETE FROM activity_events WHERE user_id = ${userId} RETURNING id`
    return rows.length
  }
  const events = await readActivity()
  await deleteDocument('activity', 'log')
  return events.length
}

export async function summariseStoredActivity() {
  const userId = currentUserId()
  if (sql) {
    const [row] = await sql`SELECT count(*)::int AS count, max(created_at) AS updated_at,
      coalesce(sum(pg_column_size(activity_events.*)), 0)::bigint AS bytes
      FROM activity_events WHERE user_id = ${userId}`
    return { count: Number(row?.count || 0), bytes: Number(row?.bytes || 0), updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null }
  }
  const events = await readActivity({ since: '1970-01-01T00:00:00.000Z' })
  return { count: events.length, bytes: JSON.stringify(events).length, updatedAt: events.length ? events[events.length - 1].at : null }
}

export function summariseActivity(events, { now = new Date(), days = 28 } = {}) {
  const byDay = new Map()
  for (const event of events) {
    const key = dayKey(event.at)
    if (!byDay.has(key)) byDay.set(key, { date: key, total: 0, answer: 0, review: 0, mock: 0, resolve: 0, read: 0 })
    const bucket = byDay.get(key)
    bucket.total += 1
    if (bucket[event.type] != null) bucket[event.type] += 1
  }

  const series = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = utcDay(-offset, now)
    series.push(byDay.get(key) || { date: key, total: 0, answer: 0, review: 0, mock: 0, resolve: 0, read: 0 })
  }

  // Streak: consecutive days ending today (or yesterday, so a streak is not
  // broken before the student has had a chance to study today).
  let streak = 0
  let offset = byDay.has(utcDay(0, now)) ? 0 : 1
  while (byDay.has(utcDay(-offset, now))) { streak += 1; offset += 1 }

  const weekStart = utcDay(-6, now)
  const week = { total: 0, answer: 0, review: 0, mock: 0, resolve: 0, read: 0 }
  for (const bucket of byDay.values()) {
    if (bucket.date < weekStart) continue
    for (const key of Object.keys(week)) week[key] += bucket[key]
  }

  const previousStart = utcDay(-13, now)
  let previousWeek = 0
  for (const bucket of byDay.values()) if (bucket.date >= previousStart && bucket.date < weekStart) previousWeek += bucket.total

  const activeDays = series.filter((bucket) => bucket.total > 0).length
  const scores = events.filter((event) => event.type === 'answer' && typeof event.score === 'number')
  const averageScore = scores.length ? Math.round((scores.reduce((sum, event) => sum + event.score, 0) / scores.length) * 10) / 10 : null

  return {
    days,
    series,
    streak,
    week,
    previousWeek,
    activeDays,
    averageScore,
    recent: [...events].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12)
  }
}

export async function getActivitySummary(options = {}) {
  return summariseActivity(await readActivity(), options)
}
