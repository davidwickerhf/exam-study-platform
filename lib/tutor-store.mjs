// What the tutor keeps between conversations.
//
// Three separate things, deliberately:
//
//   • Conversations. Each is its own document, listed through a light index, so
//     opening the tutor does not load a year of transcripts.
//   • Memory. Facts the student asked to be remembered — a resit in January, a
//     supervisor's name, a deadline that is not in Canvas. Written only when
//     the student asks, and removable one at a time.
//   • Preferences. How they want to be answered, not what is true about them.
//
// Memory and preferences ride in the system prompt on every turn; conversations
// do not, so nothing said in one leaks into another unless it was remembered on
// purpose.

import { randomUUID } from 'node:crypto'
import { deleteDocument, readDocument, writeDocument } from './user-store.mjs'

const NAMESPACE = 'tutor'
const INDEX = 'index'
export const MAX_CONVERSATIONS = 50
export const MAX_MESSAGES = 200
export const MAX_MEMORY = 60

export class TutorStoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

function text(value, max = 400) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// ── Conversations ─────────────────────────────────────────────────────────

export async function listConversations() {
  const index = await readDocument(NAMESPACE, INDEX, { items: [] })
  return (index.items || []).slice(0, MAX_CONVERSATIONS)
}

export async function readConversation(id) {
  if (!id) return null
  const stored = await readDocument(NAMESPACE, `c-${id}`, null)
  return stored?.id ? stored : null
}

function summarise(conversation) {
  const first = (conversation.messages || []).find((message) => message.role === 'user' && text(message.content))
  return {
    id: conversation.id,
    title: conversation.title || text(first?.content, 70) || 'New conversation',
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: (conversation.messages || []).filter((message) => ['user', 'assistant'].includes(message.role)).length
  }
}

export async function saveConversation(conversation) {
  const next = {
    ...conversation,
    updatedAt: new Date().toISOString(),
    // Trim the middle, never the ends: the opening sets the subject and the
    // recent turns carry the thread.
    messages: (conversation.messages || []).length > MAX_MESSAGES
      ? [...conversation.messages.slice(0, 6), ...conversation.messages.slice(-(MAX_MESSAGES - 6))]
      : conversation.messages || []
  }
  await writeDocument(NAMESPACE, `c-${next.id}`, next)
  const index = await readDocument(NAMESPACE, INDEX, { items: [] })
  const items = [summarise(next), ...(index.items || []).filter((item) => item.id !== next.id)].slice(0, MAX_CONVERSATIONS)
  await writeDocument(NAMESPACE, INDEX, { items })
  return next
}

export function newConversation() {
  const now = new Date().toISOString()
  return { id: randomUUID(), title: null, createdAt: now, updatedAt: now, messages: [] }
}

export async function deleteConversation(id) {
  const index = await readDocument(NAMESPACE, INDEX, { items: [] })
  const items = (index.items || []).filter((item) => item.id !== id)
  if (items.length === (index.items || []).length) return false
  await writeDocument(NAMESPACE, INDEX, { items })
  await deleteDocument(NAMESPACE, `c-${id}`)
  return true
}

export async function deleteAllTutorData() {
  const index = await readDocument(NAMESPACE, INDEX, { items: [] })
  for (const item of index.items || []) await deleteDocument(NAMESPACE, `c-${item.id}`)
  await deleteDocument(NAMESPACE, INDEX)
  await deleteDocument(NAMESPACE, 'memory')
  return (index.items || []).length
}

// ── Memory and preferences ────────────────────────────────────────────────

export const TUTOR_PREFERENCES = Object.freeze({
  answerLength: { label: 'Answer length', options: ['brief', 'normal', 'thorough'], fallback: 'normal' },
  tone: { label: 'Tone', options: ['direct', 'warm'], fallback: 'direct' },
  proactive: { label: 'Volunteer next steps', options: ['yes', 'no'], fallback: 'yes' }
})

function normalisePreferences(value = {}) {
  const out = {}
  for (const [key, spec] of Object.entries(TUTOR_PREFERENCES)) {
    out[key] = spec.options.includes(value?.[key]) ? value[key] : spec.fallback
  }
  return out
}

export async function readTutorMemory() {
  const stored = await readDocument(NAMESPACE, 'memory', { facts: [], preferences: {} })
  return {
    facts: (stored.facts || []).slice(0, MAX_MEMORY),
    preferences: normalisePreferences(stored.preferences)
  }
}

export async function rememberFact(fact) {
  const content = text(fact, 400)
  if (!content) throw new TutorStoreError('There is nothing to remember.')
  const memory = await readTutorMemory()
  // Saying the same thing twice is not two facts.
  const existing = memory.facts.find((entry) => entry.fact.toLowerCase() === content.toLowerCase())
  if (existing) return { stored: existing, duplicate: true, facts: memory.facts }
  const entry = { id: randomUUID().slice(0, 8), fact: content, at: new Date().toISOString() }
  const facts = [entry, ...memory.facts].slice(0, MAX_MEMORY)
  await writeDocument(NAMESPACE, 'memory', { ...memory, facts })
  return { stored: entry, duplicate: false, facts }
}

export async function forgetFact(id) {
  const memory = await readTutorMemory()
  const facts = memory.facts.filter((entry) => entry.id !== id)
  if (facts.length === memory.facts.length) return false
  await writeDocument(NAMESPACE, 'memory', { ...memory, facts })
  return true
}

export async function saveTutorPreferences(preferences) {
  const memory = await readTutorMemory()
  const next = normalisePreferences({ ...memory.preferences, ...preferences })
  await writeDocument(NAMESPACE, 'memory', { ...memory, preferences: next })
  return next
}
