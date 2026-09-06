import test from 'node:test'
import assert from 'node:assert/strict'
import { canvasRefreshWindow, validateCanvasRefreshSettings, CANVAS_REFRESH_DEFAULTS } from '../lib/canvas-refresh-policy.mjs'
import { selectScheduledCanvasCourses, periodFromCanvasCourse } from '../lib/course-corpus.mjs'
const calendar = [
 {kind:'period',academicYear:'2025-2026',period:6,date:'2026-06-01',endDate:'2026-06-30'},
 {kind:'period',academicYear:'2026-2027',period:1,date:'2026-09-01',endDate:'2026-10-25'},
 {kind:'period',academicYear:'2026-2027',period:2,date:'2026-10-26',endDate:'2026-12-20'},
]
const courses = [
 {id:'1',courseCode:'BCS2120',name:'AI 2025-2026 period 1',concluded:true},
 {id:'2',courseCode:'BCS2120',name:'AI 2026-2027 period 1',current:true},
 {id:'3',courseCode:'BCS2130',name:'UI 2026-2027 period 2',current:true},
]
const selection = date => selectScheduledCanvasCourses(courses, {now:new Date(date),refreshWindow:canvasRefreshWindow(calendar,{date:new Date(date)})}).map(c=>c.id)
test('scheduled courses change on the calendar boundary without visiting the app',()=>{
 assert.deepEqual(selection('2026-10-25'),['2'])
 assert.deepEqual(selection('2026-10-26'),['3'])
})
test('summer watches ending and upcoming years, latest retake only',()=>{
 const now = new Date('2026-08-10')
 const window=canvasRefreshWindow(calendar,{date:now})
 assert.equal(window.mode,'break'); assert.deepEqual(window.years,['2025-2026','2026-2027'])
 const list=[...courses,{id:'4',courseCode:'BCS2140',name:'OS 2025-2026 period 4',concluded:true},
 {id:'5',courseCode:'BCS2140',name:'OS 2026-2027 period 1',upcoming:true,term:{startAt:'2026-09-01'}}]
 assert.deepEqual(selectScheduledCanvasCourses(list,{now,refreshWindow:window}).map(c=>c.id),['2','3','5'])
})
test('completion and missing programme pause; stale calendars do not poll ancient cohorts',()=>{
 for(const option of [{hasProgramme:false},{studyStatus:'completed'}]){
  const window=canvasRefreshWindow(calendar,{date:new Date('2026-09-10'),...option})
  assert.equal(window.mode,'paused');assert.deepEqual(selectScheduledCanvasCourses(courses,{refreshWindow:window}),[])
 }
 const stale=canvasRefreshWindow(calendar,{date:new Date('2030-02-10')})
 assert.equal(stale.mode,'calendar-unavailable');assert.deepEqual(stale.years,['2029-2030'])
 assert.deepEqual(selectScheduledCanvasCourses(courses,{refreshWindow:stale}),[])
})
test('unknown next-year calendar in August retains summer updates',()=>{
 const window=canvasRefreshWindow([],{date:new Date('2026-08-15')})
 assert.ok(window.years.includes('2025-2026'));assert.ok(window.years.includes('2026-2027'))
})
test('settings validate strict bounded frequencies and explicit status',()=>{
 assert.deepEqual(validateCanvasRefreshSettings(CANVAS_REFRESH_DEFAULTS),CANVAS_REFRESH_DEFAULTS)
 for(const changed of [{enabled:'true'},{updatesMinutes:1},{materialsMinutes:-1},{studyStatus:'auto'},{updatesMinutes:NaN}]) assert.throws(()=>validateCanvasRefreshSettings({...CANVAS_REFRESH_DEFAULTS,...changed}))
})

test('short periods three and six are recognised from Canvas term codes',()=>{
 assert.equal(periodFromCanvasCourse({name:'2026-2027-300-BCS2120'}),'3')
 assert.equal(periodFromCanvasCourse({name:'2026-2027-600-BCS2120'}),'6')
})
