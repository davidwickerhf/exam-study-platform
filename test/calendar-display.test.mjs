import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarFilterMatches, calendarLocalDay, isCalendarDeadline, calendarDeadlineTime } from '../lib/calendar-display.mjs'
test('calendar chips select matching events with union semantics and preserve mandatory attended sessions',()=>{
 const required={attendanceEligible:true,attendanceRequired:true,attendanceStatus:'attended',category:'timetable'}
 assert.equal(calendarFilterMatches(required,[]),true)
 assert.equal(calendarFilterMatches(required,['required']),true)
 assert.equal(calendarFilterMatches(required,['attended']),true)
 assert.equal(calendarFilterMatches(required,['missed']),false)
 assert.equal(calendarFilterMatches(required,['missed','required']),true)
 assert.equal(calendarFilterMatches({attendanceEligible:true},['unmarked']),true)
 assert.equal(calendarFilterMatches({category:'canvas-deadline',canvasDone:true},['deadlines']),true)
 assert.equal(calendarFilterMatches({category:'exam'},['deadlines']),true)
})
test('deadline display uses the viewer local date while preserving the exact due time',()=>{
 const event={category:'canvas-deadline',start:'2026-09-08T21:59:59Z',allDay:false}
 const date=new Date(event.start)
 const expected=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
 assert.equal(calendarLocalDay(event),expected)
 assert.equal(isCalendarDeadline(event),true)
 assert.equal(calendarDeadlineTime(event),date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}))
 assert.equal(event.start,'2026-09-08T21:59:59Z')
 assert.equal(calendarLocalDay({start:'2026-09-08',allDay:true}),'2026-09-08')
})
