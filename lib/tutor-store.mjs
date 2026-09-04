// What the tutor keeps between conversations.
//
// Three separate things, deliberately:
//
//   • Conversations. Each is its own document, listed through a light index, so
//     opening the tutor does not load a year of transcripts.
//   • Memory. Facts and plans the student explicitly approved. A proposal in a
//     conversation is not memory; the approval endpoint is the only writer.
//   • Preferences. How they want to be answered, not what is true about them.
//
// Memory and preferences ride in the system prompt on every turn; conversations
// do not, so nothing said in one leaks into another unless it was remembered on
// purpose.

import { randomUUID } from 'node:crypto'
import { deleteDocument, readDocument, writeDocument } from './user-store.mjs'
import { activeProgrammeId, scopedDocumentKey } from './programme-scope.mjs'

const NAMESPACE = 'tutor'
const INDEX = 'index'
async function documentKey(key) { return scopedDocumentKey(await activeProgrammeId(), key) }
export const MAX_CONVERSATIONS = 50
export const MAX_MESSAGES = 200
export const MAX_MEMORY = 60
export const MAX_PLANS = 40
export const MAX_ACTION_RECEIPTS = 120

export class TutorStoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

function text(value, max = 400) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// ── Conversations ─────────────────────────────────────────────────────────

export async function listConversations() {
  const index = await readDocument(NAMESPACE, await documentKey(INDEX), { items: [] })
  return (index.items || []).slice(0, MAX_CONVERSATIONS)
}

export async function readConversation(id) {
  if (!id) return null
  const stored = await readDocument(NAMESPACE, await documentKey(`c-${id}`), null)
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
  await writeDocument(NAMESPACE, await documentKey(`c-${next.id}`), next)
  const index = await readDocument(NAMESPACE, await documentKey(INDEX), { items: [] })
  const items = [summarise(next), ...(index.items || []).filter((item) => item.id !== next.id)].slice(0, MAX_CONVERSATIONS)
  await writeDocument(NAMESPACE, await documentKey(INDEX), { items })
  return next
}

export function newConversation() {
  const now = new Date().toISOString()
  return { id: randomUUID(), title: null, createdAt: now, updatedAt: now, messages: [] }
}

export async function deleteConversation(id) {
  const index = await readDocument(NAMESPACE, await documentKey(INDEX), { items: [] })
  const items = (index.items || []).filter((item) => item.id !== id)
  if (items.length === (index.items || []).length) return false
  await writeDocument(NAMESPACE, await documentKey(INDEX), { items })
  await deleteDocument(NAMESPACE, await documentKey(`c-${id}`))
  return true
}

export async function deleteAllTutorData() {
  const index = await readDocument(NAMESPACE, await documentKey(INDEX), { items: [] })
  for (const item of index.items || []) await deleteDocument(NAMESPACE, await documentKey(`c-${item.id}`))
  await deleteDocument(NAMESPACE, await documentKey(INDEX))
  await deleteDocument(NAMESPACE, await documentKey('memory'))
  await deleteDocument(NAMESPACE, await documentKey('actions'))
  return (index.items || []).length
}

export async function exportTutorData() {
  const conversations = []
  for (const item of await listConversations()) {
    const conversation = await readConversation(item.id)
    if (conversation) conversations.push(conversation)
  }
  return { conversations, memory: await readTutorMemory(), actions: await readTutorActionReceipts() }
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
  const stored = await readDocument(NAMESPACE, await documentKey('memory'), { facts: [], plans: [], preferences: {} })
  return {
    facts: (stored.facts || []).slice(0, MAX_MEMORY),
    plans: (stored.plans || []).slice(0, MAX_PLANS),
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
  await writeDocument(NAMESPACE, await documentKey('memory'), { ...memory, facts })
  return { stored: entry, duplicate: false, facts }
}

export async function forgetFact(id) {
  const memory = await readTutorMemory()
  const facts = memory.facts.filter((entry) => entry.id !== id)
  if (facts.length === memory.facts.length) return false
  await writeDocument(NAMESPACE, await documentKey('memory'), { ...memory, facts })
  return true
}

function day(value) {
  const candidate = String(value || '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null
}

export async function rememberPlan(value = {}) {
  const title = text(value.title || value.fact, 160)
  if (!title) throw new TutorStoreError('This plan needs a title.')
  const startDate = day(value.startDate || value.date)
  const endDate = day(value.endDate) || startDate
  const recurrence = ['none', 'weekly'].includes(value.recurrence) ? value.recurrence : 'none'
  const behaviour = text(value.behaviour, 400)
  const memory = await readTutorMemory()
  const duplicate = memory.plans.find((entry) => entry.title.toLowerCase() === title.toLowerCase()
    && entry.startDate === startDate && entry.endDate === endDate && entry.recurrence === recurrence)
  if (duplicate) return { stored: duplicate, duplicate: true, plans: memory.plans }
  const entry = {
    id: randomUUID().slice(0, 8),
    title,
    startDate,
    endDate,
    recurrence,
    behaviour,
    at: new Date().toISOString()
  }
  const plans = [entry, ...memory.plans].slice(0, MAX_PLANS)
  await writeDocument(NAMESPACE, await documentKey('memory'), { ...memory, plans })
  return { stored: entry, duplicate: false, plans }
}

export async function forgetPlan(id) {
  const memory = await readTutorMemory()
  const plans = memory.plans.filter((entry) => entry.id !== id)
  if (plans.length === memory.plans.length) return false
  await writeDocument(NAMESPACE, await documentKey('memory'), { ...memory, plans })
  return true
}

// Action receipts make approval idempotent. Reloading a conversation or
// double-clicking Approve must never create two calendar blocks or two sets.
export async function readTutorActionReceipts() {
  const stored = await readDocument(NAMESPACE, await documentKey('actions'), { items: [] })
  return (stored.items || []).slice(0, MAX_ACTION_RECEIPTS)
}

export async function tutorActionReceipt(id) {
  return (await readTutorActionReceipts()).find((entry) => entry.proposalId === id) || null
}

export async function saveTutorActionReceipt(receipt) {
  const proposalId = text(receipt?.proposalId, 120)
  if (!proposalId) throw new TutorStoreError('The action receipt needs a proposal id.')
  const items = await readTutorActionReceipts()
  const next = {
    ...receipt,
    proposalId,
    at: receipt.at || new Date().toISOString()
  }
  await writeDocument(NAMESPACE, await documentKey('actions'), {
    items: [next, ...items.filter((entry) => entry.proposalId !== proposalId)].slice(0, MAX_ACTION_RECEIPTS)
  })
  return next
}

export async function saveTutorPreferences(preferences) {
  const memory = await readTutorMemory()
  const next = normalisePreferences({ ...memory.preferences, ...preferences })
  await writeDocument(NAMESPACE, await documentKey('memory'), { ...memory, preferences: next })
  return next
}
