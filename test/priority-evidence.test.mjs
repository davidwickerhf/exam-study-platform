import test from 'node:test'
import assert from 'node:assert/strict'
import { extractPriorityEvidence, mergePriorityExtractions, priorityEvidenceBatches, priorityEvidenceCandidates, priorityJsonObject, priorityScanSetupIssue } from '../lib/priority-evidence.mjs'

test('priority retrieval keeps obligation evidence and ranks authoritative sources first', () => {
  const rows = [
    { chunkId: 3, sourceType: 'slides', content: 'The group project is due on 18 October.', filename: 'week-1.pdf' },
    { chunkId: 2, sourceType: 'materials', content: 'Welcome to the course.', filename: 'readme.txt' },
    { chunkId: 1, sourceType: 'syllabus', content: 'Attendance at every tutorial is mandatory.', filename: 'syllabus.pdf' }
  ]
  assert.deepEqual(priorityEvidenceCandidates(rows).map((row) => row.chunkId), [1, 3])
})

test('priority retrieval does not turn ordinary teaching content into an obligation', () => {
  assert.deepEqual(priorityEvidenceCandidates([{ chunkId: 1, sourceType: 'slides', content: 'A graph has vertices and edges.' }]), [])
})

test('priority evidence is split into bounded batches without losing rows', () => {
  const rows = Array.from({ length: 50 }, (_, index) => ({ chunkId: index + 1, content: 'x'.repeat(100) }))
  const batches = priorityEvidenceBatches(rows, { maxRows: 18, maxCharacters: 10_000 })
  assert.deepEqual(batches.map((batch) => batch.length), [18, 18, 14])
  assert.deepEqual(batches.flat().map((row) => row.chunkId), rows.map((row) => row.chunkId))
})

test('priority JSON parser accepts multipart model content', () => {
  assert.deepEqual(priorityJsonObject([{ type: 'text', text: '{"status":"not-found"}' }]), { status: 'not-found' })
})

test('priority extraction merges duplicate claims and their evidence', () => {
  const merged = mergePriorityExtractions([
    { status: 'confirmed', attendanceRules: [], components: [{ name: 'Final exam', type: 'exam', evidence: [{ chunkId: 1 }] }], overallPassRules: [], resitRules: [], conflicts: [] },
    { status: 'confirmed', attendanceRules: [], components: [{ name: 'Final exam', type: 'exam', evidence: [{ chunkId: 2 }] }], overallPassRules: [], resitRules: [], conflicts: [] }
  ])
  assert.equal(merged.status, 'confirmed')
  assert.equal(merged.components.length, 1)
  assert.deepEqual(merged.components[0].evidence, [{ chunkId: 1 }, { chunkId: 2 }])
})

test('a malformed priority response is isolated by splitting its batch', async () => {
  const calls = []
  const model = async (messages, options) => {
    if(messages.at(-1).content.includes('FINAL RECONCILIATION')) return {message:{content:messages.at(-1).content.split('Draft to correct:\n')[1]}}
    const ids = [...messages.at(-1).content.matchAll(/\[chunk:(\d+)/g)].map((match) => Number(match[1]))
    calls.push({ ids, responseFormat: options.responseFormat })
    if (ids.length > 6) return { message: { content: '' } }
    return { message: { content: JSON.stringify({
      status: 'confirmed', attendanceRules: [],
      components: [{ name: `Work ${ids[0]}`, type: 'assignment', weightPercent: null, minimumPercent: null, deadline: null, deadlineText: '', notes: '', evidence: [{ chunkId: ids[0] }] }],
      overallPassRules: [], resitRules: [], conflicts: []
    }) } }
  }
  const rows = Array.from({ length: 12 }, (_, index) => ({ chunkId: index + 1, sourceType: 'syllabus', filename: 'manual.pdf', content: `Assignment ${index + 1} is required.` }))
  const result = await extractPriorityEvidence({ course_code: 'TEST1000', course_name: 'Testing' }, rows, model)
  assert.equal(result.status, 'confirmed')
  assert.equal(result.components.length, 2)
  assert.equal(calls.length, 3)
  assert.equal(calls[0].responseFormat.type, 'json_schema')
})

test('setup groups failed priority extraction without pretending the programme is wrong', () => {
  const issue = priorityScanSetupIssue([
    { courseCode: 'BCS3120', status: 'needs-review' },
    { courseCode: 'BCS2120', status: 'needs-review' },
    { courseCode: 'BCS3130', status: 'confirmed' }
  ])
  assert.equal(issue.step, 'canvas')
  assert.match(issue.title, /2 courses need another priority scan/)
  assert.match(issue.detail, /stored and searchable/)
  assert.match(issue.recovery, /Canvas sync/)
})

test('recurring scan has a hard call ceiling and reuses successful evidence batches', async () => {
  const rows=Array.from({length:250},(_,i)=>({chunkId:i+1,sourceType:'syllabus',filename:'manual.pdf',content:`Assignment ${i} is due.`}))
  const values=new Map(),cache={load:async key=>values.get(key),save:async(key,result)=>values.set(key,result)}
  let calls=0
  const model=async()=>{calls++;return {message:{content:JSON.stringify({status:'not-found',attendanceRules:[],components:[],conflicts:[]})}}}
  const first=await extractPriorityEvidence({},rows,model,{cache,maxCalls:1})
  assert.equal(calls,1)
  assert.equal(first.status,'needs-review')
  assert.ok(first.conflicts.every(c=>c.title==='Priority scan allowance reached'))
  await extractPriorityEvidence({},rows,model,{cache,maxCalls:2})
  assert.equal(calls,3)
  await extractPriorityEvidence({},rows,model,{cache,maxCalls:2})
  assert.equal(calls,3,'unchanged successful passages never call the model again')
  await extractPriorityEvidence({},[{...rows[0],content:'A changed deadline.'},...rows.slice(1)],model,{cache,maxCalls:2})
  assert.equal(calls,4,'only the changed batch is reanalysed')
})

test('malformed responses cannot multiply into an unbounded retry tree', async () => {
  let calls=0
  const result=await extractPriorityEvidence({},Array.from({length:100},(_,i)=>({chunkId:i,content:'Required attendance'})),async()=>{calls++;throw new Error('Malformed result')})
  assert.equal(calls,4)
  assert.equal(result.status,'needs-review')
})

test('announcements remain visible and cross-batch deadline conflicts are not silently merged', () => {
  const selected=priorityEvidenceCandidates([{chunkId:1,sourcePath:'course-announcements/extension.md',filename:'extension.md',content:'The submission deadline has changed.',sourceType:'materials'}])
  assert.equal(selected[0].sourceType,'announcements')
  const result=mergePriorityExtractions(['2026-09-10','2026-09-17'].map((deadline,i)=>({status:'confirmed',components:[{name:'Project',type:'project',deadline,evidence:[{chunkId:i+1}]}]})))
  assert.equal(result.status,'needs-review')
  assert.deepEqual(result.conflicts[0].chunkIds,[1,2])
  assert.match(result.conflicts[0].detail,/2026-09-10 \/ 2026-09-17/)
})

test('provider throttling is not labelled as the platform scan allowance', async()=>{
  let calls=0
  const result=await extractPriorityEvidence({},[{chunkId:1,content:'Labs are mandatory.'}],async()=>{calls++;throw Object.assign(new Error('Provider throttled'),{status:429})})
  assert.equal(calls,1)
  assert.equal(result.conflicts[0].title,'Priority AI provider unavailable')
})

test('attendance selection excludes vendor code and keeps amendments with adjacent context', async () => {
  const {attendanceEvidenceCandidates}=await import('../lib/priority-evidence.mjs')
  const rows=[
    {chunkId:1,filename:'coursebook.pdf',sourceType:'readings',content:'Attendance: tutorials and labs are compulsory.'},
    {chunkId:2,filename:'coursebook.pdf',sourceType:'readings',content:'An exception applies to students with an approved exemption.'},
    {chunkId:3,filename:'updated--discussion-1.html',sourceType:'materials',content:'The attendance requirement was reduced from nine to eight sessions.'},
    {chunkId:4,filename:'lecture1_intro.pdf',sourceType:'slides',page:4,content:'Course schedule and structure.'},
    {chunkId:5,filename:'lab.zip',sourceType:'assessments',content:'#define REQUIRED_CONFIG 1\n/* Required class setup */'}
  ]
  assert.deepEqual(attendanceEvidenceCandidates(rows).map(row=>row.chunkId),[1,2,3,4])
  assert.ok(!priorityEvidenceCandidates(rows).some(row=>row.chunkId===5))
})

test('attendance is reconciled before generic obligations and survives unrelated provider failure', async () => {
  const {normalizeScan}=await import('../lib/priority-evidence.mjs')
  const {supportedCourseAssessment}=await import('../lib/course-rule-evidence.mjs')
  const attendanceRows=[
    {chunkId:1,filename:'coursebook.pdf',sourceType:'syllabus',content:'At least eight lab/tutorial sessions are required.'},
    {chunkId:2,filename:'lecture1.pdf',sourceType:'slides',content:'Attend nine sessions.'},
    {chunkId:3,filename:'updated--discussion.html',sourceType:'announcements',content:'Mandatory attendance was reduced from nine to eight sessions.'}
  ]
  let calls=0
  const model=async messages=>{
    calls++
    if(calls>1) throw Object.assign(new Error('Provider unavailable'),{status:429})
    const prompt=messages.at(-1).content
    assert.match(prompt,/dedicated attendance pass/)
    for(const row of attendanceRows) assert.ok(prompt.includes(row.content))
    assert.match(prompt,/explicitly superseded value/)
    return {message:{content:JSON.stringify({status:'confirmed',attendanceRules:[{text:'Attend at least eight lab/tutorial sessions.',activity:'tutorial',requirement:'required',evidence:[{chunkId:1},{chunkId:3}]}],components:[],conflicts:[]})}}
  }
  const extracted=await extractPriorityEvidence({},[...attendanceRows,{chunkId:4,content:'An unrelated assessment.'}],model,{attendanceRows})
  const normalized=normalizeScan(extracted,attendanceRows)
  assert.equal(normalized.status,'needs-review')
  const supported=supportedCourseAssessment(normalized)
  assert.equal(supported.attendanceEvidence[0].requirement,'required')
  assert.match(supported.attendanceEvidence[0].text,/eight/)
  assert.equal(calls,2)
  // A genuine attendance conflict remains blocked even with a successful
  // overall model status; a check cannot bypass source disagreement.
  const disputed=normalizeScan({...extracted,attendanceCheck:{status:'needs-review',conflicts:[{title:'Attendance conflict',chunkIds:[1,3]}]}},attendanceRows)
  assert.equal(supportedCourseAssessment(disputed),null)
})

test('identical combined requirements retain both lab and tutorial activity records',()=>{
  const value=mergePriorityExtractions([{status:'confirmed',attendanceRules:['lab','tutorial'].map(activity=>({activity,text:'Attend eight combined sessions.',evidence:[{chunkId:1}]}))}])
  assert.deepEqual(value.attendanceRules.map(rule=>rule.activity),['lab','tutorial'])
})

test('project actions preserve relative timing, exact offsets and source references',async()=>{
  const {normalizeScan}=await import('../lib/priority-evidence.mjs')
  const rows=[{chunkId:1,assetId:'source-1',filename:'project.pdf',page:2}]
  const actions=[
    {title:'Register your team',parent:'Group project',kind:'team',deadline:null,deadlineText:'Before your pitch',prerequisite:'Choose a topic first',notes:'Teams of four',evidence:[{chunkId:1}]},
    {title:'Upload slides',parent:'Group project',kind:'submission',deadline:null,deadlineText:'One hour before your presentation',evidence:[{chunkId:1}]},
    {title:'Submit report',parent:'Group project',kind:'submission',deadline:'2026-10-04T23:59:00+02:00',evidence:[{chunkId:1}]},
    {title:'Invented step',evidence:[{chunkId:999}]}
  ]
  const result=normalizeScan({status:'confirmed',actions},rows).courseProfile.assessment
  assert.equal(result.status,'confirmed')
  assert.equal(result.actions.length,3)
  assert.equal(result.actions[1].deadline,null)
  assert.equal(result.actions[1].deadlineText,'One hour before your presentation')
  assert.equal(result.actions[2].deadline,'2026-10-04T23:59:00+02:00')
  assert.equal(result.actions[0].evidence[0].assetId,'source-1')
  assert.equal(result.actions[0].prerequisite,'Choose a topic first')
})

test('priority dates reject impossible days and timestamps without an offset',async()=>{
  const {validPriorityDeadline}=await import('../lib/priority-evidence.mjs')
  for(const date of ['2026-02-30','2026-13-01','2026-10-04T23:59','tomorrow'])assert.equal(validPriorityDeadline(date),null)
  assert.equal(validPriorityDeadline('2026-10-04'),'2026-10-04')
})

test('explicit amendments reach every obligation batch and semantic conflicts are cached',async()=>{
  const rows=[{chunkId:1,sourceType:'announcements',content:'The project deadline is extended from 2 October to 4 October.'},...Array.from({length:120},(_,i)=>({chunkId:i+2,sourceType:'slides',content:'Project due 2 October.'}))]
  const cacheValues=new Map(),cache={load:async k=>cacheValues.get(k),save:async(k,v)=>cacheValues.set(k,v)}
  let calls=0
  const model=async messages=>{calls++;assert.match(messages.at(-1).content,/extended from 2 October to 4 October/);return {message:{content:JSON.stringify({status:'needs-review',conflicts:[{title:'A separate genuine conflict',detail:'Unresolved',chunkIds:[2]}]})}}}
  await extractPriorityEvidence({},rows,model,{cache})
  await extractPriorityEvidence({},rows,model,{cache})
  assert.equal(calls,2,'semantic review does not repeatedly consume the budget needed to finish other batches')
})

test('one-call production scans resume through final reconciliation without losing attendance to another conflict',async()=>{
  const rows=[{chunkId:1,filename:'manual.pdf',content:'Labs are compulsory. Prepare the project pitch before approval.'}]
  const values=new Map(),cache={load:async key=>values.get(key),save:async(key,value)=>values.set(key,value)}
  const rule={activity:'lab',requirement:'required',text:'Labs are compulsory.',evidence:[{chunkId:1}]}
  const action={title:'Prepare the pitch',parent:'Project',deadline:null,deadlineText:'Before approval',evidence:[{chunkId:1}]}
  let calls=0
  const model=async (messages,options)=>{
    calls++
    const prompt=messages.at(-1).content
    if(prompt.includes('FINAL RECONCILIATION')){
      assert.equal(options.model,'gpt-5.4')
      return {message:{content:JSON.stringify({status:'needs-review',attendanceRules:[rule],actions:[action],components:[],conflicts:[{title:'Conflicting project grade weights',detail:'Project weight differs between sources',chunkIds:[2]}]})}}
    }
    if(prompt.includes('dedicated attendance pass'))assert.equal(options.model,'gpt-5.4')
    return {message:{content:JSON.stringify({status:'confirmed',attendanceRules:[rule],actions:[action],components:[],conflicts:[]})}}
  }
  const opts={maxCalls:1,cache,attendanceRows:rows}
  const first=await extractPriorityEvidence({},rows,model,opts)
  assert.equal(calls,1)
  assert.ok(first.conflicts.some(c=>c.title==='Priority scan allowance reached'))
  const second=await extractPriorityEvidence({},rows,model,opts)
  assert.equal(calls,2)
  assert.ok(second.conflicts.some(c=>c.title==='Priority scan allowance reached'))
  const third=await extractPriorityEvidence({},rows,model,opts)
  assert.equal(calls,3)
  assert.equal(third.attendanceCheck.status,'confirmed')
  assert.equal(third.actions[0].deadlineText,'Before approval')
  await extractPriorityEvidence({},rows,model,opts)
  assert.equal(calls,3,'the final reconciliation is reused too')
})

test('identical attendance text for different dated sessions survives merge and legacy recovery',async()=>{
  const {recoverLiteralAttendance}=await import('../lib/priority-evidence.mjs')
  const rules=['2026-09-02','2026-09-09'].map((date,i)=>({text:'Graded labs require attendance.',activity:'lab',requirement:'required',scope:{kind:'specific',labels:[`Lab ${i+1}`],dates:[date]},evidence:[{chunkId:1}]}))
  assert.equal(mergePriorityExtractions([{status:'confirmed',attendanceRules:rules}]).attendanceRules.length,2)
  const profile={assessment:{status:'confirmed',attendanceEvidence:rules}}
  assert.equal(recoverLiteralAttendance(profile,[{chunkId:2,sourceType:'syllabus',content:'Lectures are optional.'}]).assessment.attendanceEvidence.length,3)
})
