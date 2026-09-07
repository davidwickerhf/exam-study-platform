export function calendarCourseTone(event) {
  const key = String(event.courseCode || event.category || 'calendar').trim().toUpperCase()
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 6
}

export function calendarEventEmphasis(event) {
  if (event.attendanceAssessed) return {label:'Assessed attendance',tone:'required'}
  if (event.attendanceRequired === true) return {label:'Mandatory attendance',tone:'required'}
  if (event.category === 'exam') return {label:'Exam',tone:'deadline'}
  if (['deadline','canvas-deadline'].includes(event.category)) return {label:event.canvasDone ? 'Submitted' : 'Deadline',tone:event.canvasDone ? 'neutral' : 'deadline'}
  if (event.attendanceEligible) return event.attendanceRequired === false && event.attendancePolicy
    ? {label:'Attendance optional',tone:'neutral'} : {label:'Attendance requirement unknown',tone:'unknown'}
  return {label:'',tone:'neutral'}
}
