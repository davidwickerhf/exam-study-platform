// Visual filtering and date projection never change the underlying deadline.
export function calendarLocalDay(event) {
  if (event.allDay || /^\d{4}-\d{2}-\d{2}$/.test(event.start)) return event.start.slice(0,10)
  const date = new Date(event.start)
  if (!Number.isFinite(date.getTime())) return event.start.slice(0,10)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function isCalendarDeadline(event) { return ['deadline','canvas-deadline'].includes(event.category) }
export function calendarFilterMatches(event, filters) {
  return !filters.length || filters.some(filter => {
    if (filter === 'required') return event.attendanceRequired === true
    if (filter === 'deadlines') return isCalendarDeadline(event) || event.category === 'exam'
    if (filter === 'unmarked') return event.attendanceEligible && (!event.attendanceStatus || event.attendanceStatus === 'unknown')
    return event.attendanceEligible && event.attendanceStatus === filter
  })
}
export function calendarDeadlineTime(event) {
  if (event.allDay || !isCalendarDeadline(event)) return ''
  return new Date(event.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false})
}
