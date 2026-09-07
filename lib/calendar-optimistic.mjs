// Change only the affected event and counters. Feed contents, rule evidence,
// other attendance marks and the selected event remain independent of a save.
export function patchCalendarAttendance(payload, eventId, status, now = Date.now()) {
  if (!payload) return payload
  const target = payload.events.find(event => event.id === eventId)
  if (!target || !target.attendanceEligible) return payload
  const previous = target.attendanceStatus || 'unknown'
  const from = previous === 'unknown' ? 'unmarked' : previous, to = status === 'unknown' ? 'unmarked' : status
  const past = new Date(target.end || target.start).getTime() < now
  const counts = row => {
    if (!row || !past || from === to) return row
    const next = { ...row, [from]: Math.max(0, (row[from] || 0) - 1), [to]: (row[to] || 0) + 1 }
    if (target.attendanceRequired) for (const [key, delta] of [[from,-1],[to,1]]) {
      const required = `required${key[0].toUpperCase()}${key.slice(1)}`
      if (required in next) next[required] = Math.max(0, next[required] + delta)
    }
    const marked = next.attended + next.missed
    next.rate = marked ? Math.round(next.attended / marked * 100) : null
    if ('requiredAttended' in next) {
      const requiredMarked = next.requiredAttended + next.requiredMissed
      next.requiredRate = requiredMarked ? Math.round(next.requiredAttended / requiredMarked * 100) : null
      next.allowedMissesRemaining = next.allowedMisses == null ? null : Math.max(0, next.allowedMisses - next.requiredMissed)
      next.atRisk = next.allowedMisses != null ? next.requiredMissed >= next.allowedMisses : next.minimumAttendancePercent != null && requiredMarked > 0 ? next.requiredRate < next.minimumAttendancePercent : false
    }
    return next
  }
  const courses = payload.attendance?.courses?.map(row => row.courseCode === target.courseCode ? counts(row) : row)
  const summary = payload.attendance?.summary ? { ...counts(payload.attendance.summary) } : null
  if (summary && courses) summary.atRiskCourses = courses.filter(row => row.atRisk).length
  return { ...payload, events: payload.events.map(event => event.id === eventId ? { ...event, attendanceStatus: status } : event),
    ...(payload.attendance ? { attendance: { ...payload.attendance, summary, ...(courses ? { courses } : {}) } } : {}) }
}
