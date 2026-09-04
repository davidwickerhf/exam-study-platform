import { createHash } from 'node:crypto'
import { readDocument, writeDocument } from './user-store.mjs'

const NAMESPACE = 'calendar-feed-state'
const MAX_EVENTS_PER_FEED = 500
const MAX_NOTICES = 50

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max)
const fingerprint = (value) => createHash('sha256').update(value).digest('hex').slice(0, 20)

function compactEvent(event) {
  return {
    id: clean(event.id, 160),
    title: clean(event.title, 200),
    date: clean(event.date, 10),
    endDate: clean(event.endDate, 10) || null,
    startTime: clean(event.startTime, 5) || null,
    endTime: clean(event.endTime, 5) || null,
    location: clean(event.location, 200) || null,
    status: event.cancelled ? 'CANCELLED' : clean(event.status, 30).toUpperCase() || null,
    sequence: Number.isFinite(Number(event.sequence)) ? Number(event.sequence) : null,
    lastModified: clean(event.lastModified, 40) || null
  }
}

const eventMoment = (event) => [event.date, event.startTime, event.endDate, event.endTime].filter(Boolean).join(' · ')

export function calendarFeedChanges(previous = [], current = [], { feedId = 'calendar', feedLabel = 'Timetable', detectedAt = new Date().toISOString(), today = detectedAt.slice(0, 10) } = {}) {
  const before = new Map(previous.map((event) => [event.id, compactEvent(event)]))
  const notices = []
  for (const raw of current) {
    const event = compactEvent(raw)
    if (!event.id || event.date < today) continue
    const prior = before.get(event.id)
    let kind = null
    let detail = ''
    if (event.status === 'CANCELLED' && prior?.status !== 'CANCELLED') {
      kind = 'cancelled'
      detail = prior ? `Was scheduled ${eventMoment(prior)}${prior.location ? ` · ${prior.location}` : ''}.` : `Marked cancelled for ${eventMoment(event)}.`
    } else if (prior && prior.status !== 'CANCELLED') {
      const moved = eventMoment(prior) !== eventMoment(event)
      const roomChanged = (prior.location || '') !== (event.location || '')
      const renamed = prior.title !== event.title
      if (moved) {
        kind = 'rescheduled'
        detail = `${eventMoment(prior)} → ${eventMoment(event)}${roomChanged && event.location ? ` · ${event.location}` : ''}`
      } else if (roomChanged) {
        kind = 'room-changed'
        detail = `${prior.location || 'No room'} → ${event.location || 'No room listed'}`
      } else if (renamed) {
        kind = 'updated'
        detail = `${prior.title} → ${event.title}`
      }
    }
    if (!kind) continue
    const signature = [feedId, event.id, kind, eventMoment(prior || {}), eventMoment(event), prior?.location, event.location, prior?.title, event.title].join('|')
    notices.push({
      id: `calendar-change-${fingerprint(signature)}`,
      feedId,
      feedLabel: clean(feedLabel, 120) || 'Timetable',
      eventId: event.id,
      kind,
      title: event.title,
      detail,
      date: event.date,
      detectedAt
    })
  }
  return notices
}

function snapshot(events) {
  return events.slice(0, MAX_EVENTS_PER_FEED).map(compactEvent)
}

export async function observeCalendarFeeds(workspaceId, feeds, { now = new Date(), activeFeedIds = feeds.map((feed) => feed?.link?.id) } = {}) {
  const key = clean(workspaceId, 100) || 'default'
  const held = await readDocument(NAMESPACE, key, { schemaVersion: 1, feeds: {}, notices: [] })
  const next = { schemaVersion: 1, feeds: { ...(held?.feeds || {}) }, notices: Array.isArray(held?.notices) ? held.notices : [] }
  const detectedAt = now.toISOString()
  // `feeds` contains successful fetches. Track configured ids separately so a
  // transient network failure cannot erase the baseline required to detect a
  // change on the next successful refresh.
  const active = new Set(activeFeedIds.map((id) => clean(id, 100)).filter(Boolean))
  let changed = false

  for (const feed of feeds) {
    const id = clean(feed?.link?.id, 100)
    if (!id) continue
    const events = snapshot(feed.events || [])
    const heldFeed = next.feeds[id]
    const prior = heldFeed?.url === feed.link.url ? heldFeed : null
    const additions = calendarFeedChanges(prior?.events || [], events, { feedId: id, feedLabel: feed.link.label, detectedAt })
    const known = new Set(next.notices.map((notice) => notice.id))
    for (const notice of additions) if (!known.has(notice.id)) { next.notices.push(notice); known.add(notice.id); changed = true }
    const serial = JSON.stringify(events)
    if (!prior || prior.url !== feed.link.url || JSON.stringify(prior.events) !== serial) {
      next.feeds[id] = { url: feed.link.url, label: feed.link.label, observedAt: detectedAt, events }
      changed = true
    }
  }

  for (const id of Object.keys(next.feeds)) if (!active.has(id)) { delete next.feeds[id]; changed = true }
  next.notices = next.notices.slice(-MAX_NOTICES)
  if (changed) await writeDocument(NAMESPACE, key, next)
  return next.notices.sort((left, right) => right.detectedAt.localeCompare(left.detectedAt))
}

export async function dismissCalendarNotice(workspaceId, noticeId) {
  const key = clean(workspaceId, 100) || 'default'
  const held = await readDocument(NAMESPACE, key, { schemaVersion: 1, feeds: {}, notices: [] })
  const notices = (Array.isArray(held?.notices) ? held.notices : []).filter((notice) => notice.id !== noticeId)
  if (notices.length === (held?.notices || []).length) return false
  await writeDocument(NAMESPACE, key, { schemaVersion: 1, feeds: held?.feeds || {}, notices })
  return true
}
