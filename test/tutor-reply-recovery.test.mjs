import test from 'node:test'
import assert from 'node:assert/strict'
import { runToolLoop, abortable } from '../lib/model-loop.mjs'
import { createTutorToolRunner, tutorToolResultForModel } from '../lib/tutor-agent.mjs'
import { conversationForTutorRetry } from '../lib/tutor-turns.mjs'

const call = { id: 'lookup', type: 'function', function: { name: 'get_schedule', arguments: '{}' } }
const question = () => [{ role: 'user', content: 'What did I miss last week?' }]

test('tool-only rounds reserve a tools-disabled final answer and sum usage', async () => {
  const requests = []
  const result = await runToolLoop({ messages: question(), tools: [{ type: 'function' }], maxRounds: 2, runTool: async () => ({ events: ['Lab'] }), modelCall: async (_, options) => {
    requests.push(options)
    return { message: requests.length <= 2 ? { role: 'assistant', content: null, tool_calls: [call] } : { role: 'assistant', content: 'Check the missed lab instructions.' }, usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }
  } })
  assert.equal(result.added.at(-1).content, 'Check the missed lab instructions.')
  assert.deepEqual(requests.at(-1).tools, [])
  assert.equal(result.usage.total_tokens, 45)
  assert.equal(result.exhausted, true)
})

test('reasoning-only empty output gets one larger answer request, not repeated empty rounds', async () => {
  const budgets = []
  const result = await runToolLoop({ messages: question(), tools: [], maxOutputTokens: 2200, modelCall: async (_, options) => {
    budgets.push(options.maxOutputTokens)
    return budgets.length === 1 ? { message: { content: '' }, finishReason: 'length' } : { message: { content: 'Your timetable records a lab.' }, finishReason: 'stop' }
  } })
  assert.deepEqual(budgets, [2200, 8192])
  assert.equal(result.added.length, 1)
})

test('persistent empty output rejects instead of becoming a successful unanswered conversation', async () => {
  let requests = 0
  await assert.rejects(runToolLoop({ messages: question(), tools: [], modelCall: async () => { requests++; return { message: { content: '' }, finishReason: 'length' } } }), /could not finish an answer/)
  assert.equal(requests, 2)
})

test('tool narration does not substitute for a final answer', async () => {
  await assert.rejects(runToolLoop({ messages: question(), tools: [{ type: 'function' }], maxRounds: 1, runTool: async () => ({}), modelCall: async (_, options) => ({ message: options.tools.length ? { content: 'Checking…', tool_calls: [call] } : { content: '', tool_calls: [call] } }) }), /could not finish an answer/)
})

test('truncated tool arguments are never executed', async () => {
  let ran = false
  await assert.rejects(runToolLoop({ messages: question(), tools: [], runTool: async () => { ran = true }, modelCall: async () => ({ message: { tool_calls: [call] }, finishReason: 'length' }) }), /could not finish reading/)
  assert.equal(ran, false)
})

test('large tool evidence stays parseable and explicitly incomplete', async () => {
  let requests = 0
  await runToolLoop({ messages: question(), tools: [], runTool: async () => ({ content: 'x'.repeat(80_000) }), modelCall: async messages => {
    if (++requests === 1) return { message: { tool_calls: [call] } }
    const source = JSON.parse(messages.at(-1).content)
    assert.equal(source.truncated, true)
    assert.match(source.note, /incomplete/)
    return { message: { content: 'There are gaps in the available evidence.' } }
  } })
})

test('turn deadline interrupts stuck tools and starts no further model request', async () => {
  const controller = new AbortController()
  let requests = 0
  const pending = runToolLoop({ messages: question(), signal: controller.signal, modelCall: async () => { requests++; return { message: { tool_calls: [call] } } }, runTool: () => { controller.abort(new Error('deadline')); return new Promise(() => {}) } })
  await assert.rejects(pending, /deadline/)
  assert.equal(requests, 1)
  await assert.rejects(abortable(() => assert.fail('cancelled work must not start'), controller.signal), /deadline/)
})

test('retry replaces only the last unanswered turn and preserves earlier answers', () => {
  const earlier = [{ role: 'user', content: 'Earlier' }, { role: 'assistant', content: 'Earlier reply' }]
  const stored = { id: 'thread', messages: [...earlier, ...question(), { role: 'assistant', content: '', tool_calls: [call] }, { role: 'tool', content: '{}' }] }
  assert.deepEqual(conversationForTutorRetry(stored, question()[0].content).messages, earlier)
  assert.equal(stored.messages.length, 5)
  assert.throws(() => conversationForTutorRetry(stored, 'A different question'), /conversation changed/)
  assert.throws(() => conversationForTutorRetry({ ...stored, messages: [...stored.messages, { role: 'assistant', content: 'An answer' }] }, question()[0].content), /already has an answer/)
})


test('independent source lookups overlap while results retain call order', async () => {
  const started = []
  let release
  const barrier = new Promise(resolve => { release = resolve })
  let requests = 0
  const result = await runToolLoop({ messages: question(), tools: [], parallelTools: true, reasoningEffort: 'low', runTool: async name => {
    started.push(name)
    if (started.length === 2) release()
    await barrier
    return { name }
  }, modelCall: async (_, options) => {
    assert.equal(options.reasoningEffort, 'low')
    return ++requests === 1 ? { message: { tool_calls: [call, { ...call, id: 'obligations', function: { name: 'get_course_obligations', arguments: '{}' } }] } } : { message: { content: 'Answer' } }
  } })
  assert.deepEqual(started, ['get_schedule', 'get_course_obligations'])
  assert.deepEqual(result.added.filter(item => item.role === 'tool').map(item => item.tool_call_id), ['lookup', 'obligations'])
})

test('repeated reads are shared only within a turn; proposals are never cached', async () => {
  let calls = 0
  const run = async () => ({ call: ++calls })
  const reader = createTutorToolRunner({}, run)
  const pair = await Promise.all([reader('get_schedule', { from: 'a', to: 'b' }), reader('get_schedule', { to: 'b', from: 'a' })])
  assert.equal(calls, 1)
  assert.deepEqual(pair[0], pair[1])
  await createTutorToolRunner({}, run)('get_schedule', { from: 'a', to: 'b' })
  await reader('propose_calendar_action', {})
  await reader('propose_calendar_action', {})
  assert.equal(calls, 4)
})

test('compact obligation context preserves claims and conflicts while removing repeated citations', () => {
  const evidence = Array.from({ length: 2000 }, (_, chunkId) => ({ chunkId }))
  const original = { obligations: [{ courseCode: 'BCS2140', status: 'needs-review', attendanceRules: [{ text: 'Labs are compulsory', evidence }], components: [{ name: 'Project', minimumPercent: 55, evidence }], conflicts: [{ title: 'Attendance threshold unclear', chunkIds: evidence.map(item => item.chunkId) }], resitRules: ['Resit available'] }], evidence: evidence.map(item => ({ id: item.chunkId, excerpt: 'Lab policy' })) }
  const compact = tutorToolResultForModel('get_course_obligations', original)
  assert.equal(compact.obligations[0].status, 'needs-review')
  assert.equal(compact.obligations[0].attendanceRules[0].text, 'Labs are compulsory')
  assert.equal(compact.obligations[0].components[0].minimumPercent, 55)
  assert.equal(compact.obligations[0].conflicts[0].title, 'Attendance threshold unclear')
  assert.deepEqual(compact.obligations[0].resitRules, ['Resit available'])
  assert.ok(JSON.stringify(compact).length < JSON.stringify(original).length / 10)
  assert.equal(original.obligations[0].attendanceRules[0].evidence.length, 2000)
})
