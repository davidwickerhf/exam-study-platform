import { randomUUID } from 'node:crypto'

const EVENT_TYPES = new Set(['study', 'deadline', 'appointment', 'other'])
const clean = (value, max = 500) => String(value ?? '').replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

function dateOnly(value) {
  const text = clean(value, 40).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const parsed = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : null
}

function dateTime(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function normalizePersonalCalendarEvent(value, index = 0) {
  if (!value || typeof value !== 'object') return null
  const title = clean(value.title, 200)
  const allDay = value.allDay === true
  const start = allDay ? dateOnly(value.start) : dateTime(value.start)
  const rawEnd = allDay ? dateOnly(value.end) : dateTime(value.end)
  const end = rawEnd && start && rawEnd > start ? rawEnd : null
  if (!title || !start) return null
  return {
    id: clean(value.id || `personal-${index + 1}`, 120),
    calendarId: clean(value.calendarId, 80) || 'wicker',
    title,
    start,
    end,
    allDay,
    type: EVENT_TYPES.has(value.type) ? value.type : 'other',
    courseId: clean(value.courseId, 100) || null,
    courseCode: clean(value.courseCode, 40).toUpperCase() || null,
    courseName: clean(value.courseName, 200) || null,
    location: clean(value.location, 300),
    notes: clean(value.notes, 2000),
    sourceEventId: clean(value.sourceEventId, 240) || null,
    createdAt: dateTime(value.createdAt) || new Date().toISOString(),
    updatedAt: dateTime(value.updatedAt) || new Date().toISOString()
  }
}

export function createPersonalCalendarEvent(input, now = new Date()) {
  const timestamp = now instanceof Date ? now.toISOString() : dateTime(now) || new Date().toISOString()
  const event = normalizePersonalCalendarEvent({ ...input, id: `personal-${randomUUID()}`, createdAt: timestamp, updatedAt: timestamp })
  if (!event) throw new Error('A calendar event needs a title and a valid start date.')
  return event
}

export function savePersonalCalendarEvent(events = [], input, now = new Date()) {
  const current = (Array.isArray(events) ? events : []).map(normalizePersonalCalendarEvent).filter(Boolean)
  const existing = current.find((event) => event.id === input?.id)
  if (!existing) return [...current, createPersonalCalendarEvent(input, now)].slice(-1000)
  const updated = normalizePersonalCalendarEvent({ ...existing, ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: now instanceof Date ? now.toISOString() : now })
  if (!updated) throw new Error('A calendar event needs a title and a valid start date.')
  return current.map((event) => event.id === existing.id ? updated : event)
}

export function removePersonalCalendarEvent(events = [], id) {
  const current = (Array.isArray(events) ? events : []).map(normalizePersonalCalendarEvent).filter(Boolean)
  const next = current.filter((event) => event.id !== id)
  if (next.length === current.length) throw new Error('Unknown Wicker calendar event.')
  return next
}

