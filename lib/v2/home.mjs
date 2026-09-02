/**
 * What Home needs to know.
 *
 * Pure date rules shared by the React home surface and its node tests.
 */

const DAY = 86_400_000
const day = (value) => new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime()

export function localIsoDate(at = new Date()) {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
}

export function daysUntil(iso) {
  if (!iso) return null
  return Math.round((day(iso) - day(localIsoDate())) / DAY)
}

/**
 * Which week of the teaching period today falls in, and how many the period
 * has. The first day of a period is week 1: an earlier version floored the
 * elapsed-week count at one and then added one, so a period read "week 2 of 8"
 * on the morning it began.
 */
export function periodWeek(start, end, today) {
  if (!start || !end || !today) return { week: null, weeks: null }
  const total = Math.floor((day(end) - day(start)) / DAY)
  if (!Number.isFinite(total) || total < 0) return { week: null, weeks: null }
  // The period's last day belongs to its last week, so the span is inclusive.
  const weeks = Math.max(1, Math.ceil((total + 1) / 7))
  const elapsed = Math.floor((day(today) - day(start)) / DAY)
  if (!Number.isFinite(elapsed)) return { week: null, weeks }
  return { week: Math.min(weeks, Math.max(1, Math.floor(elapsed / 7) + 1)), weeks }
}

/**
 * A timetable note reads "08:30–10:30 · DUB30 0.050 · Type: Lecture …", where
 * the tail is staff names and a sync stamp. Only the room belongs in an agenda.
 */
export function roomOf(event) {
  const segments = String(event.notes ?? '').split('·').map((part) => part.trim()).filter(Boolean)
  const room = segments.find((segment, index) =>
    index > 0 && !/^\d{2}:\d{2}/.test(segment) && !/^(type|location\(s\)|staff|this appointment|last synchronised)/i.test(segment))
  return room && room.length <= 60 ? room : null
}

/** Canvas titles a deadline "BCS3120 · Quiz 1"; every row already has a course. */
export function deadlineTitle(event) {
  if (!event.courseCode) return event.title
  const escaped = event.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return event.title.replace(new RegExp(`^\\s*${escaped}\\s*[·:\\-–]\\s*`, 'i'), '') || event.title
}

export function dayEntries(events, today = localIsoDate()) {
  const on = (event) => event.start.slice(0, 10) === today
  const at = (value) => new Date(value.length > 10 ? value : `${value}T09:00:00`).getTime()
  return [
    ...events.filter((event) => event.category === 'timetable' && on(event)).map((event) => ({ event, kind: 'teaching' })),
    ...events.filter((event) => event.category === 'canvas-deadline' && on(event)).map((event) => ({ event, kind: 'due' }))
  ]
    .map((entry) => ({ ...entry, startsAt: at(entry.event.start), endsAt: entry.event.end ? at(entry.event.end) : null }))
    .filter((entry) => Number.isFinite(entry.startsAt))
    .sort((left, right) => left.startsAt - right.startsAt)
}

/**
 * The entry the hero shows: whatever is running, otherwise the next one due.
 * The rest of the day is everything after it, so both must agree on which
 * entry that is — computing them separately dropped the last class of the day
 * whenever the hero was something already in progress.
 */
export function leadEntry(entries, now = Date.now()) {
  return entries.find((entry) => entry.startsAt <= now && entry.endsAt !== null && entry.endsAt > now)
    ?? entries.find((entry) => entry.startsAt > now)
    ?? null
}

export function upcomingDeadlines(events, limit = 5, today = localIsoDate()) {
  return events
    .filter((event) => event.category === 'canvas-deadline' && !event.canvasDone)
    .filter((event) => event.start.slice(0, 10) > today)
    .sort((left, right) => left.start.localeCompare(right.start))
    .slice(0, limit)
}

export function clockOf(value) {
  return value.length > 10 ? value.slice(11, 16) : null
}

export function awayLabel(minutes) {
  if (minutes === null) return ''
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `in ${minutes} min`
  if (minutes < 600) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return `in ${hours}h${rest ? ` ${rest}m` : ''}`
  }
  return `in ${Math.round(minutes / 1440)} days`
}
