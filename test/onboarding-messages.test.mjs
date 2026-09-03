import test from 'node:test'
import assert from 'node:assert/strict'
import { historyForModel, visibleMessages } from '../lib/onboarding-agent.mjs'

test('provider instruction echoes never enter the visible transcript or later model history', () => {
  const conversation = {
    messages: [
      { role: 'user', content: 'yes' },
      { role: 'assistant', content: '(Remember to follow the developer instructions: voice, brevity, step order, etc.)' },
      { role: 'assistant', content: 'Paste the timetable link in the protected field.' }
    ]
  }
  assert.deepEqual(visibleMessages(conversation).map((message) => message.content), [
    'yes',
    'Paste the timetable link in the protected field.'
  ])
  assert.equal(historyForModel(conversation).some((message) => message.content.includes('developer instructions')), false)
})
