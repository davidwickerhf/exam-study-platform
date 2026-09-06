export function calendarEventEmphasis(event) {
  if (event.attendanceRequired === true) return {label:'Mandatory attendance',tone:'required'}
  if (event.category === 'exam') return {label:'Exam',tone:'deadline'}
  if (['deadline','canvas-deadline'].includes(event.category)) return {label:event.canvasDone ? 'Submitted' : 'Deadline',tone:event.canvasDone ? 'neutral' : 'deadline'}
  if (event.attendanceEligible) return event.attendanceRequired === false && event.attendancePolicy
    ? {label:'Attendance optional',tone:'neutral'} : {label:'Attendance requirement unknown',tone:'unknown'}
  return {label:'',tone:'neutral'}
}
