import test from 'node:test'
import assert from 'node:assert/strict'
import {courseTimetableEvidence} from '../lib/priority-timetable.mjs'
test('reconciliation sees course booking times without importing another course, year, or a derived label',()=>{
  const event={attendanceEligible:true,courseCode:'BCS1000',start:'2026-09-08T16:00:00',end:'2026-09-08T18:00:00',activity:'lab',sourceActivity:'Tutorial',notes:'private detail'}
  assert.deepEqual(courseTimetableEvidence([event,{...event,courseCode:'BCS2000'},{...event,start:'2025-09-08T16:00:00'},{...event,attendanceEligible:false}],{course_code:'BCS1000',academic_year:'2026-2027'}),[{start:event.start,end:event.end,timetableLabel:'Tutorial'}])
})
