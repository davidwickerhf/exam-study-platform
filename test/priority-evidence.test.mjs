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
  const rows=Array.from({length:50},(_,i)=>({chunkId:i+1,sourceType:'syllabus',filename:'manual.pdf',content:`Assignment ${i} is due.`}))
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
