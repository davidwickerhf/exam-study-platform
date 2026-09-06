import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTutorResponse, TUTOR_RESPONSE_FORMAT } from '../lib/tutor-response.mjs'
import { runToolLoop } from '../lib/model-loop.mjs'
import { runTutorTool, tutorSystemPrompt } from '../lib/tutor-agent.mjs'
import { visibleTutorConversation } from '../lib/tutor-turns.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { saveConversation, readConversation, searchTutorHistory, deleteConversation } from '../lib/tutor-store.mjs'

const answer = overrides => ({ summary: 'Check whether the missed OS lab can still be graded. I prepared a follow-up draft and a suggested study block.', priorities: [], courses: [], drafts: [], detail: '', ...overrides })
const priority = overrides => ({ urgency: 'soon', title: 'Prepare Lab 1', course: 'BCS2140', timing: '9 Sept', action: 'Complete the lab quiz.', consequence: 'Lab attendance affects grading.', uncertainty: 'The course team must confirm whether your absence can be excused.', proposalIds: [], ...overrides })

test('recovery widgets rank urgency, preserve uncertainty and only link real proposals', () => {
  const result = parseTutorResponse(JSON.stringify(answer({ priorities: [priority(), priority({ urgency: 'now', title: 'Follow up on the missed lab', proposalIds: ['real', 'invented', 'real'] })] })), [{ id: 'real' }])
  assert.equal(result.presentation.priorities[0].urgency, 'now')
  assert.deepEqual(result.presentation.priorities[0].proposalIds, ['real'])
  assert.match(result.content, /must confirm/)
  assert.equal(result.presentation.priorities[1].timing, '9 Sept')
})

test('invalid structured output fails visibly instead of exposing JSON or silently losing fields', () => {
  for (const content of ['not json', '{}', 'null', JSON.stringify(answer({ summary: '' })), JSON.stringify(answer({ priorities: [priority({ urgency: 'critical' })] })), JSON.stringify(answer({ courses: [null] }))]) {
    assert.throws(() => parseTutorResponse(content), /Tutor/)
  }
})

test('conceptual answers keep complete Markdown and math without unnecessary widgets', () => {
  const summary = 'For **Bayes’ rule**, $P(A|B)=P(B|A)P(A)/P(B)$.\n\n1. Identify the prior.\n2. Update with evidence.'
  const result = parseTutorResponse(JSON.stringify(answer({ summary })))
  assert.equal(result.content, summary)
  assert.deepEqual(result.presentation.priorities, [])
})

test('agenda, progress and decision widgets retain scope, uncertainty and real action links in recall', () => {
  const parsed = parseTutorResponse(JSON.stringify(answer({
    agenda: [{ title: 'Lab quiz', course: 'BCS2140', when: '9 Sept, 23:59', location: 'Canvas', kind: 'deadline', note: 'Submission deadline, not a class.' }],
    metrics: [{ label: 'Credits', value: '92 ECTS', source: 'Transcript', status: 'needs-checking', note: 'Compare against the academic work overview.' }, { label: 'Projected total', value: '96 ECTS', source: 'Exam plan', status: 'scenario', note: 'Assumes the planned pass.' }],
    options: [{ title: 'Current sitting', outcome: 'Keep the current plan.', tradeoff: 'Less preparation time.', uncertainty: 'Exam date is not confirmed.', proposalIds: ['real', 'invented'] }]
  })), [{ id: 'real', title: 'Update exam plan', summary: 'Current sitting' }])
  assert.equal(parsed.presentation.agenda[0].kind, 'deadline')
  assert.equal(parsed.presentation.metrics[0].status, 'needs-checking')
  assert.equal(parsed.presentation.metrics[1].status, 'scenario')
  assert.deepEqual(parsed.presentation.options[0].proposalIds, ['real'])
  assert.match(parsed.content, /Submission deadline, not a class/)
  assert.match(parsed.content, /Exam date is not confirmed/)
  assert.match(parsed.content, /approval required/)
})

test('tool loop stages a real approval-only action before its structured final answer', async () => {
  const staged = []
  let calls = 0
  const turn = await runToolLoop({ messages: [{ role: 'user', content: 'Help me recover from a missed lab.' }], tools: [], responseFormat: TUTOR_RESPONSE_FORMAT,
    runTool: runTutorTool,
    onToolCall: (_name, _args, result) => { if (result.proposal) staged.push(result.proposal) },
    modelCall: async (_messages, options) => {
      assert.deepEqual(options.responseFormat, TUTOR_RESPONSE_FORMAT)
      if (calls++ === 0) return { message: { role: 'assistant', content: '', tool_calls: [{ id: 'calendar', type: 'function', function: { name: 'propose_calendar_action', arguments: JSON.stringify({ title: 'OS Lab 1 catch-up', date: '2026-09-07', kind: 'study', notes: 'Suggested study day, not a submission deadline.' }) } }] } }
      return { message: { role: 'assistant', content: JSON.stringify(answer({ priorities: [priority({ proposalIds: [staged[0].id] })] })) } }
    }
  })
  assert.equal(staged.length, 1)
  assert.equal(staged[0].type, 'calendar-event')
  assert.equal(staged[0].payload.date, '2026-09-07')
  assert.match(staged[0].detail, /Suggested study day/)
  const parsed = parseTutorResponse(turn.added.at(-1).content, staged)
  assert.deepEqual(parsed.presentation.priorities[0].proposalIds, [staged[0].id])
})

test('reserved final pass keeps the response contract when research rounds are exhausted', async () => {
  let calls = 0
  const turn = await runToolLoop({ messages: [], tools: [], maxRounds: 1, responseFormat: TUTOR_RESPONSE_FORMAT, runTool: async () => ({}),
    modelCall: async (_messages, options) => {
      assert.deepEqual(options.responseFormat, TUTOR_RESPONSE_FORMAT)
      return ++calls === 1 ? { message: { content: '' }, finishReason: 'length' } : { message: { content: JSON.stringify(answer()) }, finishReason: 'stop' }
    }
  })
  assert.equal(turn.exhausted, true)
  assert.ok(parseTutorResponse(turn.added.at(-1).content).presentation)
})

test('widgets and unsent drafts survive reload and contribute to historical recall', async () => {
  const userId = `tutor-widgets-${Date.now()}`
  await withRequestContext({ userId }, async () => {
    try {
      const parsed = parseTutorResponse(JSON.stringify(answer({ courses: [{ course: 'BCS2140', missed: 'You reported missing Lab 1.', recovery: 'Review Unix processes.' }], drafts: [{ title: 'OS lab follow-up', recipient: 'OS course team', subject: 'Lab 1 absence', body: 'Following up on my earlier email: could you confirm my options for the missed lab?' }] })))
      await saveConversation({ id: 'widget-history', title: 'Lab recovery', messages: [{ role: 'assistant', ...parsed }] })
      const restored = visibleTutorConversation(await readConversation('widget-history'))
      assert.equal(restored.messages[0].presentation.drafts[0].subject, 'Lab 1 absence')
      const recalled = await searchTutorHistory({ query: 'Unix processes' })
      assert.ok(recalled.some(item => item.content.includes('Unix processes')))
      assert.match(recalled[0].content, /Unsent email draft/)
    } finally { await deleteConversation('widget-history') }
  })
})

test('prompt directs useful proposals, concise widgets and explicit uncertainty without email sending', () => {
  const prompt = tutorSystemPrompt({ memory: {}, context: {} })
  assert.match(prompt, /prepare 1–3 useful, concrete actions/)
  assert.match(prompt, /250 words visible/)
  assert.match(prompt, /Do not label a future quiz as already missed/)
  assert.match(prompt, /there is no sending tool/)
  assert.match(prompt, /Never speculate about unofficial exceptions/)
})
