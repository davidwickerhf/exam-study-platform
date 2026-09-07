import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceOverview, attendancePolicyForEvent, upsertAttendanceRecord } from '../lib/attendance.mjs'
import { normalizeAcademicWorkspace } from '../lib/academics.mjs'

const courses = [{
  id: 'stats', code: 'BCS1520', name: 'Statistics',
  courseProfile: { assessment: { status: 'confirmed', attendanceEvidence: [{ text: 'Tutorial attendance is mandatory. Up to 2 absences are allowed.', activity: 'tutorial', allowedMisses: 2, evidence: [{ chunkId: 7 }] }] } }
}]

const event = (patch = {}) => ({ id: 'feed:main:t1', title: 'BCS1520 · Statistics', start: '2026-09-01T09:00:00Z', end: '2026-09-01T11:00:00Z', category: 'timetable', courseId: 'stats', courseCode: 'BCS1520', courseName: 'Statistics', activity: 'Tutorial', attendanceEligible: true, ...patch })

test('attendance policy binds only a verified rule for the same teaching kind', () => {
  assert.equal(attendancePolicyForEvent(event(), courses[0]).allowedMisses, 2)
  assert.equal(attendancePolicyForEvent(event({ activity: 'Lecture' }), courses[0]), null)
  assert.equal(attendancePolicyForEvent(event(), { ...courses[0], courseProfile: { assessment: { status: 'needs-review', attendanceRules: ['Tutorials are mandatory.'] } } }), null)
})

test('mandatory labs are preserved while unmatched tutorials stay unknown; optional needs explicit evidence', () => {
  const course = {code:'BCS1520', courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'Lab attendance is mandatory.',activity:'lab',evidence:[{chunkId:8}]},
    {text:'Lecture attendance is not required.',activity:'lecture',evidence:[{chunkId:9}]}
  ]}}}
  const result = attendanceOverview([event(),event({id:'lecture',activity:'Lecture'})],[],[course])
  assert.equal(result.events[0].attendanceRequired,null)
  assert.equal(result.events[1].attendanceRequired,false)
  assert.equal(result.courses[0].unknownRequirementSessions,1)
  assert.equal(result.courses[0].unmatchedRules[0].activity,'lab')
  assert.equal(attendancePolicyForEvent(event({activity:'Practical'}),course).required,true)
})
test('current attendance rules never classify a prior academic year and conflicting rules remain unknown', () => {
  assert.equal(attendancePolicyForEvent(event({start:'2025-09-03T09:00:00Z'}),{...courses[0],ruleAcademicYear:'2026-2027'}),null)
  const course = { ...courses[0], courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'Tutorials are mandatory.',activity:'tutorial'}, {text:'Tutorials are optional.',activity:'tutorial'}
  ]}}}
  assert.equal(attendancePolicyForEvent(event(),course),null)
})

test('attendance records are replaced per occurrence and unknown clears the mark', () => {
  const missed = upsertAttendanceRecord([], event(), 'missed', 'Work shift', '2026-09-02T10:00:00Z')
  assert.equal(missed.length, 1)
  assert.equal(missed[0].status, 'missed')
  const attended = upsertAttendanceRecord(missed, event(), 'attended', '', '2026-09-02T11:00:00Z')
  assert.equal(attended.length, 1)
  assert.equal(attended[0].status, 'attended')
  assert.deepEqual(upsertAttendanceRecord(attended, event(), 'unknown'), [])
})

test('attendance overview keeps unknown neutral and reports the verified allowance', () => {
  const events = [event(), event({ id: 'feed:main:t2', start: '2026-09-03T09:00:00Z', end: '2026-09-03T11:00:00Z' }), event({ id: 'feed:main:l1', activity: 'Lecture', start: '2026-09-02T13:00:00Z', end: '2026-09-02T15:00:00Z' })]
  const records = upsertAttendanceRecord(upsertAttendanceRecord([], events[0], 'missed'), events[2], 'attended')
  const result = attendanceOverview(events, records, courses, { now: new Date('2026-09-04T00:00:00Z').getTime() })
  assert.equal(result.summary.rate, 50)
  assert.equal(result.summary.unmarked, 1)
  assert.equal(result.courses[0].requiredMissed, 1)
  assert.equal(result.courses[0].allowedMissesRemaining, 1)
  assert.equal(result.events[2].attendanceRequired, null)
})

test('academic workspace normalization persists only valid attendance records', () => {
  const record = upsertAttendanceRecord([], event(), 'attended')[0]
  const workspace = normalizeAcademicWorkspace({ profile: {}, planning: { attendanceRecords: [record, { status: 'missed' }] } })
  assert.equal(workspace.planning.attendanceRecords.length, 1)
  assert.equal(workspace.planning.attendanceRecords[0].eventId, event().id)
})

test('assessed debate participation is visible without declaring every tutorial mandatory',()=>{
  const course={code:'BCS1520',ruleAcademicYear:'2026-2027',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[{text:'Attendance and participation in these debates counts for 10% of your final grade (pass/fail)',activity:'debate',participationAssessed:true,evidence:[{chunkId:1}]}]}}}
  const unknown=attendanceOverview([event()],[],[course])
  assert.equal(unknown.courses[0].unmatchedRules[0].assessed,true)
  assert.equal(unknown.events[0].attendanceRequired,null)
  const matched=attendanceOverview([event({activity:'Debate'})],[],[course])
  assert.equal(matched.events[0].attendanceAssessed,true)
  assert.equal(matched.events[0].attendanceRequired,null,'graded participation does not prove compulsory attendance')
  assert.equal(matched.courses[0].unknownRequirementSessions,0)
})

test('a description activity resolves generic timetable events without making lectures mandatory', () => {
  const generic = event({activity:'Timetable',notes:'11:00–13:00 · Type: Tutorial\nLocation: Main building'})
  assert.equal(attendancePolicyForEvent(generic,courses[0]).required,true)
  assert.equal(attendancePolicyForEvent({...generic,notes:'Type: Lecture\nTutorial questions will be discussed.'},courses[0]),null)
})

test('structured optional and assessed attendance do not depend on model wording', () => {
  const course={courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'You may choose whether to attend these sessions.',activity:'tutorial',requirement:'optional',evidence:[{chunkId:1}]}
  ]}}}
  assert.equal(attendancePolicyForEvent(event(),course).required,false)
})

test('professor rules override timetable optionality and unrelated activity notes do not override its Type', () => {
  assert.equal(attendancePolicyForEvent(event({notes:'Tutorial attendance is optional.'}),courses[0]).required,true)
  assert.equal(attendancePolicyForEvent(event({activity:'Timetable',notes:'Type: Lecture. Tutorials are mandatory.'}),courses[0]),null)
})

test('numbered graded lab requirements do not turn unrelated labs into compulsory sessions',()=>{
  const course={courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[{text:'Attendance at graded labs 1–5 is mandatory.',activity:'lab',requirement:'required',scope:{kind:'specific',labels:['Lab 1','Lab 2','Lab 3','Lab 4','Lab 5'],dates:[]}}]}}}
  const base={activity:'lab',start:'2026-09-08T09:00:00Z',title:'Operating Systems'}
  assert.equal(attendancePolicyForEvent({...base,notes:'Type: Lab'},course),null)
  assert.equal(attendancePolicyForEvent({...base,notes:'Type: Lab; Lab 6'},course),null)
  assert.equal(attendancePolicyForEvent({...base,notes:'Type: Lab; Lab 10'},course),null)
  assert.equal(attendancePolicyForEvent({...base,notes:'Type: Lab; Lab 2'},course)?.required,true)
})

test('project rules match project meetings and openings without affecting lectures in a project course', () => {
  const course={courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'Project meetings are mandatory, including the online Project Opening.',activity:'project',requirement:'required',allowedMisses:3,scope:{kind:'all'},evidence:[{chunkId:1}]},
    {text:'Missing the Project Defense results in NG.',activity:'project',requirement:'required',allowedMisses:0,scope:{kind:'specific',labels:['Project Defense'],dates:[]},evidence:[{chunkId:2}]}
  ]}}}
  const base={title:'Project 3-1',start:'2026-09-08T09:00:00Z',activity:'Timetable',notes:'Type: Project'}
  assert.equal(attendancePolicyForEvent(base,course)?.allowedMisses,3)
  assert.equal(attendancePolicyForEvent({...base,title:'Project Opening',activity:'Project Opening'},course)?.required,true)
  assert.equal(attendancePolicyForEvent({...base,title:'Project Defense'},course)?.allowedMisses,0)
  assert.equal(attendancePolicyForEvent({...base,notes:'Type: Lecture'},course),null)
  assert.equal(attendancePolicyForEvent({...base,notes:'Type: Tutorial'},course),null)
})

test('a named exception overrides a general rule but equally scoped conflicts remain unresolved', () => {
  const general={text:'Project meetings are mandatory.',activity:'project',requirement:'required',scope:{kind:'all'}}
  const exception={text:'The optional Project Clinic is available for questions.',activity:'project',requirement:'optional',scope:{kind:'specific',labels:['Project Clinic'],dates:[]}}
  const course=rules=>({courseProfile:{assessment:{status:'confirmed',attendanceEvidence:rules}}})
  const event={title:'Project Clinic',activity:'Project',start:'2026-09-08T09:00:00Z'}
  assert.equal(attendancePolicyForEvent(event,course([general,exception]))?.required,false)
  assert.equal(attendancePolicyForEvent(event,course([general,exception,{...exception,requirement:'required'}])),null)
})

test('project assessment absences cannot borrow the ordinary meeting allowance', () => {
  const course={code:'BCS1520',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'Project meetings are mandatory.',activity:'project',requirement:'required',allowedMisses:3,scope:{kind:'all'}},
    {text:'The Project Defense is mandatory.',activity:'project',requirement:'required',allowedMisses:0,scope:{kind:'specific',labels:['Project Defense'],dates:[]}}
  ]}}}
  const defense=event({id:'defense',title:'Project Defense',activity:'Project'})
  const meeting=event({id:'meeting',title:'Project meeting',activity:'Project'})
  const opts={now:new Date('2026-09-05').getTime()}
  const clear=attendanceOverview([defense,meeting],[],[course],opts).courses[0]
  assert.equal(clear.atRisk,false)
  assert.equal(clear.allowedMisses,null,'different pools must not imply one shared allowance')
  const missed=upsertAttendanceRecord([],defense,'missed')
  assert.equal(attendanceOverview([defense,meeting],missed,[course],opts).courses[0].atRisk,true)
  assert.equal(attendanceOverview([meeting,defense],missed,[course],opts).courses[0].atRisk,true)
})

test('unclassified project skill-class rules cannot override project meeting allowances', () => {
  const course={courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'Project meetings are mandatory.',activity:'project',requirement:'required',allowedMisses:3},
    {text:'Project skill classes are mandatory.',activity:'other',requirement:'required',allowedMisses:2}
  ]}}}
  assert.equal(attendancePolicyForEvent({activity:'Project',title:'Project 3-1'},course)?.allowedMisses,3)
  assert.equal(attendancePolicyForEvent({activity:'Class',title:'Project skill class'},course)?.allowedMisses,2)
})

test('explicitly shared lab and tutorial pools combine marks despite activity-specific wording', () => {
  const course={code:'BCS1520',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:['lab','tutorial'].map(activity=>({
    text:'Attendance for '+activity+' counts in a combined tutorials-and-labs pool: at least 80% is required.',
    activity,requirement:'required',minimumAttendancePercent:80,scope:{kind:'all'},evidence:[{chunkId:1}]
  }))}}}
  const events=Array.from({length:5},(_,i)=>event({id:'pool-'+i,activity:i===4?'Lab':'Tutorial'}))
  const records=events.reduce((held,e,i)=>upsertAttendanceRecord(held,e,i===4?'missed':'attended'),[])
  const row=attendanceOverview(events,records,[course],{now:new Date('2026-09-05').getTime()}).courses[0]
  assert.equal(row.minimumAttendancePercent,80)
  assert.equal(row.requiredRate,80)
  assert.equal(row.atRisk,false,'one missed lab must be counted with the four attended tutorials in the shared pool')
})

test('dated labs match a sole generic timetable tutorial, without claiming lectures or ambiguous tutorials', () => {
  const course={code:'BCS1520',ruleAcademicYear:'2026-2027',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'Lab 1 attendance is required on September 1.',activity:'lab',requirement:'required',scope:{kind:'specific',labels:['Lab 1'],dates:['2026-09-01']},evidence:[{chunkId:7}]}
  ]}}}
  const tutorial=event(), lecture=event({id:'lecture',activity:'Lecture',start:'2026-09-01T07:00:00Z'})
  const result=attendanceOverview([lecture,tutorial],[],[course])
  assert.equal(result.events[0].attendanceRequired,null)
  assert.equal(result.events[1].attendanceRequired,true)
  assert.equal(attendanceOverview([tutorial,event({id:'other',start:'2026-09-01T13:00:00Z'})],[],[course]).events[0].attendanceRequired,null)
  assert.equal(attendanceOverview([event({start:'2026-09-02T09:00:00Z'})],[],[course]).events[0].attendanceRequired,null)
})

test('a dated all-student lab waiver overrides the pool and mandatory timetable marker but not other days', () => {
  const course={code:'BCS1520',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'Tutorial attendance is mandatory.',activity:'tutorial',requirement:'required',scope:{kind:'all'}},
    {text:'Attendance for Lab 2 on September 1 is waived for everyone.',activity:'lab',requirement:'optional',scope:{kind:'specific',labels:['Lab 2'],dates:['2026-09-01']},evidence:[{chunkId:10}]}
  ]}}}
  const result=attendanceOverview([event({notes:'Type: Tutorial; attendance mandatory'}),event({id:'next',start:'2026-09-08T09:00:00Z'})],[],[course])
  assert.deepEqual(result.events.map(e=>e.attendanceRequired),[false,true])
})

test('professor lesson plans correct timetable activity before applying the general attendance pool',()=>{
  const course={code:'BCS1520',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {text:'Labs are mandatory; two absences allowed.',activity:'lab',requirement:'required',allowedMisses:2,evidence:[{chunkId:1}]}
  ],sessionMappings:[{activity:'lab',text:'September 1, 11:00: lab.',dates:['2026-09-01'],times:['11:00'],evidence:[{chunkId:2}]}]}}}
  const sessions=[event({activity:'Lecture',notes:'Type: Lecture; attendance optional'}),event({id:'other',activity:'Lecture',start:'2026-09-01T13:00:00Z'})]
  const result=attendanceOverview(sessions,[],[course])
  assert.equal(result.events[0].attendanceRequired,true)
  assert.equal(result.events[0].attendancePolicy.allowedMisses,2)
  assert.deepEqual(result.events[0].attendancePolicy.evidence.map(e=>e.chunkId),[1,2])
  assert.equal(result.events[1].attendanceRequired,null)
})

test('conflicting professor schedules do not fall back to an unreliable timetable requirement',()=>{
  const mappings=['lab','lecture'].map(activity=>({activity,dates:['2026-09-01'],times:['11:00'],evidence:[{chunkId:2}]}))
  const course={...courses[0],courseProfile:{assessment:{...courses[0].courseProfile.assessment,sessionMappings:mappings}}}
  assert.equal(attendanceOverview([event({notes:'Type: Tutorial; attendance mandatory'})],[],[course]).events[0].attendanceRequired,null)
})

test('a professor’s dated tutorial correction applies to a sole combined booking with floating local time',()=>{
  const course={...courses[0],courseProfile:{assessment:{...courses[0].courseProfile.assessment,sessionMappings:[{activity:'tutorial',dates:['2026-09-01'],times:[],evidence:[{chunkId:3}]}]}}}
  const block=event({activity:'Lecture',notes:'Type: Lecture',start:'2026-09-01T13:30:00',end:'2026-09-01T18:00:00'})
  assert.equal(attendanceOverview([block],[],[course]).events[0].attendanceRequired,true)
  course.courseProfile.assessment.sessionMappings[0].times=['13:30']
  assert.equal(attendanceOverview([block],[],[course]).events[0].attendanceRequired,true)
})

test('numbered lab scopes use professor lesson-plan labels even when timetable titles omit them',()=>{
  const course={code:'BCS1520',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {activity:'lab',text:'Attendance at Labs 1–5 is mandatory.',requirement:'required',scope:{kind:'specific',labels:['Lab 1','Lab 2','Lab 3','Lab 4','Lab 5'],dates:[]},evidence:[{chunkId:1}]}
  ],sessionMappings:[
    {activity:'lab',text:'Lab 2',dates:['2026-09-01'],times:[],evidence:[{chunkId:2}]},
    {activity:'lab',text:'Lab 6',dates:['2026-10-01'],times:[],evidence:[{chunkId:3}]}
  ]}}}
  const events=[event(),event({id:'six',start:'2026-10-01T09:00:00Z'})]
  const result=attendanceOverview(events,[],[course]).events
  assert.equal(result[0].attendanceRequired,true)
  assert.equal(result[0].activity,'lab')
  assert.equal(result[1].attendanceRequired,null,'a later ungraded lab does not inherit Labs 1–5 requirements')
})

test('a combined lecture/tutorial booking applies the compulsory tutorial rule and its own allowance',()=>{
  const course={code:'BCS1520',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[
    {activity:'lecture',text:'Lecture attendance is optional.',requirement:'optional',evidence:[{chunkId:1}]},
    {activity:'tutorial',text:'Tutorial attendance is mandatory; two absences allowed.',requirement:'required',allowedMisses:2,evidence:[{chunkId:2}]}
  ],sessionMappings:['lecture','tutorial'].map(activity=>({activity,text:activity,dates:['2026-09-01'],times:[],evidence:[{chunkId:3}]}))}}}
  const result=attendanceOverview([event({activity:'Lecture',notes:'Type: Lecture',start:'2026-09-01T13:30:00',end:'2026-09-01T18:00:00'})],[],[course]).events[0]
  assert.equal(result.attendanceRequired,true)
  assert.equal(result.activity,'tutorial')
  assert.equal(result.attendancePolicy.allowedMisses,2)
})
