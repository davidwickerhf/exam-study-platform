import test from 'node:test'
import assert from 'node:assert/strict'
import { patchCalendarAttendance } from '../lib/calendar-optimistic.mjs'
import { calendarCourseTone } from '../lib/calendar-emphasis.mjs'
const now=Date.parse('2026-09-07T17:00:00Z')
const base={id:'lab',title:'OS',courseCode:'BCS2140',start:'2026-09-07T09:00:00Z',end:'2026-09-07T11:00:00Z',attendanceStatus:'unknown',attendanceEligible:true,attendanceRequired:true,attendanceRule:'Labs are mandatory'}
const payload={events:[base,{...base,id:'other',courseCode:'BCS2120'}],attendance:{summary:{attended:0,missed:0,excused:0,unmarked:2,requiredMissed:0,requiredUnmarked:2,rate:null,atRiskCourses:0},courses:[{courseCode:'BCS2140',attended:0,missed:0,excused:0,unmarked:1,requiredAttended:0,requiredMissed:0,requiredExcused:0,requiredUnmarked:1,allowedMisses:1,rate:null,atRisk:false}]}}
test('optimistic marks update event, totals and required-attendance risk without modifying source evidence',()=>{
 const original=structuredClone(payload),next=patchCalendarAttendance(payload,'lab','missed',now)
 assert.deepEqual(payload,original)
 assert.equal(next.events[0].attendanceStatus,'missed')
 assert.equal(next.events[0].attendanceRule,'Labs are mandatory')
 assert.equal(next.events[1],payload.events[1])
 assert.equal(next.attendance.summary.missed,1)
 assert.equal(next.attendance.summary.unmarked,1)
 assert.equal(next.attendance.summary.atRiskCourses,1)
 assert.equal(next.attendance.courses[0].allowedMissesRemaining,0)
})
test('rollback only restores the targeted event, retaining other intervening marks',()=>{
 const pending=patchCalendarAttendance(payload,'lab','attended',now)
 const other=patchCalendarAttendance(pending,'other','excused',now)
 const restored=patchCalendarAttendance(other,'lab','unknown',now)
 assert.equal(restored.events[0].attendanceStatus,'unknown')
 assert.equal(restored.events[1].attendanceStatus,'excused')
 assert.equal(restored.attendance.summary.attended,0)
 assert.equal(restored.attendance.summary.excused,1)
})
test('clearing a mark reverses its totals; in-progress sessions do not count as completed',()=>{
 const marked=patchCalendarAttendance(payload,'lab','attended',now)
 assert.equal(marked.attendance.summary.rate,100)
 const cleared=patchCalendarAttendance(marked,'lab','unknown',now)
 assert.equal(cleared.attendance.summary.rate,null)
 assert.equal(cleared.attendance.summary.unmarked,2)
 const ongoing=patchCalendarAttendance(payload,'lab','attended',Date.parse('2026-09-07T10:00:00Z'))
 assert.equal(ongoing.attendance.summary.attended,0)
})
test('course color remains stable across retakes, selection and attendance changes',()=>{
 assert.equal(calendarCourseTone(base),calendarCourseTone({...base,id:'new-year',attendanceStatus:'missed'}))
 assert.equal(calendarCourseTone(base),calendarCourseTone({...base,courseCode:' bcs2140 '}))
 assert.notEqual(calendarCourseTone(base),calendarCourseTone({...base,courseCode:'BCS2120'}))
})
