import test from 'node:test'
import assert from 'node:assert/strict'
import { tutorDocket, reusableTutorProposal } from '../lib/tutor-docket.mjs'
import { courseAnnouncementContext, selectCourseAnnouncements } from '../lib/tutor-course-updates.mjs'
import { partialTutorSummary, readModelStream } from '../lib/model-stream.mjs'
import { openTutorStream, tutorToolProgress } from '../lib/tutor-progress.mjs'
import { runToolLoop } from '../lib/model-loop.mjs'
import { workspaceInvalidationTargets } from '../lib/workspace/resource-cache.mjs'
import { homePriorities } from '../lib/workspace/home.mjs'
import { tutorStream } from '../lib/workspace/tutor-stream.ts'

test('new draft versions replace older ones and unrelated course/audience/purpose stays separate', () => {
  const old = { key: 'bcs3120-group-paper-choice', title: 'Message to your group', recipient: 'Project group', subject: 'Paper choice', body: 'Old' }
  const next = { ...old, title: 'Confirm preferences', body: 'Updated choices' }
  const unrelated = { ...old, key: 'bcs3120-coordinator-extension', recipient: 'Coordinator' }
  const messages = [{ presentation: { drafts: [old, unrelated] }, proposals: [{ id: 'same' }] }, { presentation: { drafts: [next] }, proposals: [{ id: 'same' }] }]
  assert.deepEqual(tutorDocket(messages).drafts, [next, unrelated])
  assert.equal(tutorDocket(messages).proposals.length, 1)
})
test('legacy paraphrased draft headings merge without hiding distinct requests', () => {
  const first = { title: 'Message to your project/paper group', recipient: 'Project group', subject: 'BCS3120 paper preferences', body: 'BCS3120 choices' }
  const updated = { ...first, title: 'Message to project/paper group — confirm preferences', subject: 'Confirm BCS3120 paper preferences' }
  const other = { ...updated, subject: 'BCS3120 project meeting availability', title: 'Find a meeting time' }
  assert.deepEqual(tutorDocket([{ presentation: { drafts: [first] } }, { presentation: { drafts: [updated, other] } }]).drafts, [updated, other])
})
test('repeated executable effects reuse proposals but changed effects do not', () => {
  const old = { id: 'old', type: 'study-work', payload: { programmeId: 'p', expectedItemRevision: null, item: { id: 'generated1', revision: 'r1', title: 'Prepare paper', status: 'todo' } } }
  const next = structuredClone(old); next.id = 'new'; next.payload.item.id = 'generated2'; next.payload.item.revision = 'r2'
  assert.equal(reusableTutorProposal([old], next), old)
  next.payload.item.status = 'done'
  assert.equal(reusableTutorProposal([old], next), undefined)
})
test('announcement search finds paper details beyond rule notices, keeping dates and course boundaries', () => {
  const paper = courseAnnouncementContext({ id: 'paper', courseCode: '2026-2027-100-BCS3120', title: 'Paper list updated', html: '<p>Paper 17 is MindScape. See the attached instructions.</p>', postedAt: '2026-09-04', author: 'Course team' })
  const rule = courseAnnouncementContext({ id: 'rule', courseCode: 'BCS3120', title: 'Attendance', html: 'Attendance is optional now.', postedAt: '2026-09-05' })
  assert.equal(paper.course, 'BCS3120')
  assert.equal(selectCourseAnnouncements([rule, paper, { ...paper, course: 'BCS3210' }], { query: 'actual paper list', courseCode: 'BCS3120' })[0].id, paper.id)
  assert.equal(selectCourseAnnouncements([rule, paper], { courseCode: 'BCS3120', rulesOnly: true })[0].id, rule.id)
  assert.deepEqual(selectCourseAnnouncements([rule], { query: 'MindScape' }), [])
})
test('stream preview exposes only the summary, handles split escapes, and stops at its end', () => {
  assert.equal(partialTutorSummary('{"summary":"Paper \\u00'), 'Paper ')
  assert.equal(partialTutorSummary('{"summary":"Paper \\u00e9\\nYes","detail":"private"}'), 'Paper é\nYes')
  assert.equal(partialTutorSummary('Internal narration'), '')
  assert.equal(partialTutorSummary('{"tool_calls":[]}'), '')
})
test('streamed completion assembles tools, usage and answer across split transport chunks', async () => {
  const parts = [{ choices: [{ delta: { content: '{"summary":"Hello' } }] }, { choices: [{ delta: { content: ' world"}' }, finish_reason: 'stop' }] }, { choices: [], usage: { total_tokens: 12 } }]
  const bytes = new TextEncoder().encode(parts.map(item => `data: ${JSON.stringify(item)}\n\n`).join('') + 'data: [DONE]\n\n')
  const updates = []
  const result = await readModelStream(new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7)); controller.close() } })), text => updates.push(partialTutorSummary(text)))
  assert.deepEqual(updates, ['Hello', 'Hello world'])
  assert.equal(result.message.content, '{"summary":"Hello world"}')
  assert.equal(result.usage.total_tokens, 12)
  const calls = [{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'get_schedule', arguments: '{"days":' } }] } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '7}' } }] }, finish_reason: 'tool_calls' }] }]
  const tools = await readModelStream(new Response(calls.map(item => `data: ${JSON.stringify(item)}\n\n`).join('')), () => assert.fail('tool arguments must not appear'))
  assert.equal(tools.message.tool_calls[0].function.arguments, '{"days":7}')
  await assert.rejects(readModelStream(new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'), () => {}), /interrupted/)
})
test('progress is emitted before work finishes, and emits no raw tool inputs', async () => {
  const frames = [], res = { writeHead() {}, flushHeaders() { frames.push('headers') }, write(value) { frames.push(JSON.parse(value)) } }
  const emit = openTutorStream(res)
  emit('progress', { message: tutorToolProgress('read_study_source', { courseCode: 'BCS3120', assetId: 'secret' }) })
  assert.deepEqual(frames, ['headers', { type: 'progress', message: 'Reading the indexed document for BCS3120…' }])
  let started = false
  await runToolLoop({ messages: [], tools: [], onModelStart: () => { started = true }, modelCall: async () => { assert.equal(started, true); return { message: { content: 'Answer' }, finishReason: 'stop' } } })
})
test('Tutor sends do not invalidate unrelated page caches; priorities use local assignment links', () => {
  const affected = workspaceInvalidationTargets('/api/tutor')
  assert.equal(affected('/api/tutor?view=history'), true)
  assert.equal(affected('/api/academics'), false)
  assert.equal(affected('/api/integrations/canvas/hub'), false)
  const [priority] = homePriorities({ assignments: [{ id: '12:34', courseCode: 'BCS3120', title: 'Paper choice', status: 'upcoming', dueAt: '2026-09-11', url: 'https://canvas.example/assignments/34' }], now: Date.parse('2026-09-06') })
  assert.equal(priority.href, '/app/updates?tab=assignments&assignment=12%3A34')
})

test('browser consumes live status and answer fragments before the final result, with explicit interruption errors', async () => {
  const original = globalThis.fetch
  const encoder = new TextEncoder(), seen = []
  try {
    globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) {
      const bytes = encoder.encode('{"type":"progress","message":"Checking announcements…"}\n{"type":"progress","stage":"answer-text","text":"Paper 17"}\n{"type":"result","result":{"saved":true}}\n')
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3))
      controller.close()
    } }), { headers: { 'content-type': 'application/x-ndjson' } })
    assert.deepEqual(await tutorStream('/api/tutor', {}, value => seen.push(value), value => seen.push(value)), { saved: true })
    assert.deepEqual(seen, ['Checking announcements…', 'Paper 17'])
    globalThis.fetch = async () => new Response('{"type":"progress","message":"Checking"}\n', { headers: { 'content-type': 'application/x-ndjson' } })
    await assert.rejects(tutorStream('/api/tutor', {}, () => {}), /interrupted/)
    globalThis.fetch = async () => new Response('{"type":"error","error":"Try again"}\n', { headers: { 'content-type': 'application/x-ndjson' } })
    await assert.rejects(tutorStream('/api/tutor', {}, () => {}), /Try again/)
  } finally { globalThis.fetch = original }
})
