import test from 'node:test'
import assert from 'node:assert/strict'
import {calendarEventEmphasis} from '../lib/calendar-emphasis.mjs'
test('mandatory requirement stays prominent after attendance is marked',()=>{
  for (const attendanceStatus of ['unknown','attended','missed','excused']) assert.deepEqual(calendarEventEmphasis({attendanceRequired:true,attendanceStatus}),{label:'Mandatory attendance',tone:'required'})
})
test('calendar separates missing attendance evidence, explicit optionality and dated obligations',()=>{
  assert.equal(calendarEventEmphasis({attendanceEligible:true}).tone,'unknown')
  assert.equal(calendarEventEmphasis({attendanceEligible:true,attendanceRequired:false}).tone,'unknown')
  assert.equal(calendarEventEmphasis({attendanceEligible:true,attendanceRequired:false,attendancePolicy:{source:'syllabus'}}).label,'Attendance optional')
  assert.equal(calendarEventEmphasis({category:'exam'}).label,'Exam')
  assert.equal(calendarEventEmphasis({category:'canvas-deadline'}).tone,'deadline')
  assert.equal(calendarEventEmphasis({category:'canvas-deadline',canvasDone:true}).tone,'neutral')
})
