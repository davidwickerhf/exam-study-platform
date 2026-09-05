import { TutorStoreError } from './tutor-store.mjs'

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
      .map(({ role, content, at, evidence, proposals, context }) => ({ role, content, at, evidence: evidence || [], proposals: proposals || [], context: context || null }))
  }
}
