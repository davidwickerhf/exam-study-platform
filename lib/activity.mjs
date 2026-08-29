import { readDocument, writeDocument } from './user-store.mjs'

// A bounded per-user ledger of study events. It powers the streak, the
// weekly summary, and the activity feed on Home. Events are appended by the
// server when a student answers, reviews, sits a mock, or resolves a mistake;
// nothing here is derived from editorial material.

export const ACTIVITY_TYPES = Object.freeze({
  answer: 'Answered a question',
  review: 'Reviewed a flashcard',
  mock: 'Completed a mock',
  resolve: 'Resolved a mistake',
  read: 'Read a chapter'
})

const RETENTION_DAYS = 120
const MAX_EVENTS = 4000

function dayKey(iso) {
  return String(iso).slice(0, 10)
}

function utcDay(offset = 0, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
  return d.toISOString().slice(0, 10)
}

export async function readActivity() {
  const value = await readDocument('activity', 'log', { events: [] })
  return Array.isArray(value.events) ? value.events : []
}

export async function recordActivity(type, meta = {}, { now = new Date() } = {}) {
  if (!ACTIVITY_TYPES[type]) throw new Error(`Unsupported activity type: ${type}`)
  const events = await readActivity()
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString()
  const event = {
    type,
    at: now.toISOString(),
    courseId: meta.courseId || null,
    chapterId: meta.chapterId || null,
    score: typeof meta.score === 'number' ? meta.score : null,
    label: meta.label ? String(meta.label).slice(0, 160) : null
  }
  const kept = events.filter((item) => item?.at >= cutoff)
  kept.push(event)
  await writeDocument('activity', 'log', { events: kept.slice(-MAX_EVENTS) })
  return event
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
