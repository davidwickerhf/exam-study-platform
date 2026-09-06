import { TutorStoreError, saveConversation, conversationRevision, newConversation } from './tutor-store.mjs'

// Retry only the last unanswered turn, never an already answered question.
// Commit the replacement only after generation succeeds so failure preserves history.
export function conversationForTutorRetry(conversation, message) {
  const messages = conversation.messages || []
  const index = messages.findLastIndex(entry => entry.role === 'user')
  if (index < 0 || messages[index].content !== message || messages.slice(index + 1).some(entry => entry.role === 'assistant' && !entry.tool_calls?.length && String(entry.content || '').trim())) {
    throw new TutorStoreError('This question already has an answer or the conversation changed. Reopen it before retrying.', 409)
  }
  return { ...conversation, messages: messages.slice(0, index) }
}

// Tool-call narration is progress, never a completed answer. Keeping it out of
// visible history also makes legacy unanswered turns consistently retryable.
export function visibleTutorConversation(conversation) {
  if (!conversation) return null
  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    messages: (conversation.messages || [])
      .filter((message) => ['user', 'assistant'].includes(message.role) && String(message.content || '').trim() && !message.tool_calls?.length)
      .map(({ id, turnId, answerRevision, role, content, at, evidence, proposals, context, presentation }) => ({ id, turnId, answerRevision, role, content, at, ...(presentation ? { presentation } : {}), evidence: evidence || [], proposals: proposals || [], context: context || null }))
  }
}


export async function beginTutorTurn(stored, { message, context = {}, retry = false, id } = {}) {
  const base = stored ? retry ? conversationForTutorRetry(stored, message) : stored : { ...newConversation(), ...(id ? { id } : {}) }
  const at = new Date().toISOString()
  const pending = await saveConversation({ ...base,
    messages: retry && stored ? stored.messages : [...base.messages, { role: 'user', content: message, at, context }],
    reply: { status: 'pending', startedAt: at }
  }, { expectedRevision: conversationRevision(stored) })
  return { base, pending }
}

export async function completeTutorTurn({ base, pending }, turn) {
  const question = pending.messages.findLast(message => message.role === 'user')
  const added = turn.added.map(message => message.role === 'user' && message.content === question?.content ? { ...message, id: question.id, turnId: question.turnId } : message)
  return saveConversation({ ...pending, messages: [...base.messages, ...added], reply: { status: 'complete' } }, { expectedRevision: pending.revision })
}

export async function failTutorTurn({ pending }, error, stopped = false) {
  return saveConversation({ ...pending, reply: { status: stopped ? 'stopped' : 'failed', error: String(error?.message || 'Reply interrupted.').slice(0, 300) } }, { expectedRevision: pending.revision })
}


export function completedTutorRetry(conversation, message) {
  const messages = conversation?.messages || []
  const index = messages.findLastIndex(item => item.role === 'user')
  return index >= 0 && messages[index].content === message && messages.slice(index + 1).some(item => item.role === 'assistant' && !item.tool_calls?.length && String(item.content || '').trim())
}
