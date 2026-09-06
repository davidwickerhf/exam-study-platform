import { stableTutorMessages } from './feedback-contract.mjs'
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
// Relevant past conversation excerpts are retrieved within the same account
// and programme. Approved facts/plans remain separate from historical statements.

import { randomUUID } from 'node:crypto'
import { deleteDocument, listDocuments, readDocument, writeDocument, compareAndSwapDocument, DocumentConflictError } from './user-store.mjs'
import { activeProgrammeId, scopedDocumentKey } from './programme-scope.mjs'

import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
const NAMESPACE = 'tutor'
const INDEX = 'index'
async function documentKey(key) { return scopedDocumentKey(await activeProgrammeId(), key) }
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

async function conversationDocuments() {
  const prefix = (await documentKey('c-')).replace(/[^a-zA-Z0-9_.-]/g, '_')
  return (await listDocuments(NAMESPACE)).filter(item => item.key.startsWith(prefix) && item.value?.id && Array.isArray(item.value?.messages)).map(item => item.value)
}

export async function listConversations() {
  if (!sql) return (await conversationDocuments()).map(summarise).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const prefix = await documentKey('c-')
  // Query the canonical documents, not the old capped index. This also recovers
  // older conversations that had fallen outside its 50-item window.
  const rows = await sql`SELECT value->>'id' AS id, value->>'title' AS title,
    value->>'createdAt' AS created_at, value->>'updatedAt' AS updated_at,
    (SELECT left(m->>'content',70) FROM jsonb_array_elements(value->'messages') m WHERE m->>'role'='user' LIMIT 1) AS first_message,
    (SELECT count(*)::int FROM jsonb_array_elements(value->'messages') m WHERE m->>'role' IN ('user','assistant') AND CASE WHEN jsonb_typeof(m->'tool_calls')='array' THEN jsonb_array_length(m->'tool_calls') ELSE 0 END=0) AS message_count
    FROM user_documents WHERE user_id=${currentUserId()} AND namespace=${NAMESPACE}
      AND left(document_key,length(${prefix}))=${prefix} AND value ? 'id'
    ORDER BY updated_at DESC`
  return rows.map(row => ({ id: row.id, title: row.title || row.first_message || 'New conversation', createdAt: row.created_at, updatedAt: row.updated_at, messageCount: row.message_count }))
}

export async function readConversation(id) {
  if (!id) return null
  const stored = await readDocument(NAMESPACE, await documentKey(`c-${id}`), null)
  return stored?.id ? { ...stored, messages: stableTutorMessages(stored) } : null
}

function summarise(conversation) {
  const first = (conversation.messages || []).find((message) => message.role === 'user' && text(message.content))
  return {
    id: conversation.id,
    title: conversation.title || text(first?.content, 70) || 'New conversation',
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: (conversation.messages || []).filter((message) => ['user', 'assistant'].includes(message.role) && !message.tool_calls?.length && String(message.content || '').trim()).length
  }
}

const writes = new Map()
async function localConversationWrite(key, work) {
  const lock = `${currentUserId()}:${key}`
  const previous = writes.get(lock) || Promise.resolve()
  const next = previous.catch(() => {}).then(work)
  writes.set(lock, next)
  try { return await next } finally { if (writes.get(lock) === next) writes.delete(lock) }
}

export function conversationRevision(conversation) { return conversation?.revision || conversation?.updatedAt || null }

export async function saveConversation(conversation, { expectedRevision } = {}) {
  const messages = stableTutorMessages(conversation)
  const latestQuestion = messages.findLastIndex(item => item.role === 'user')
  // Retain every visible chat message. Large internal lookup payloads are only
  // needed for the latest turn; old answers retain their cited evidence.
  const transcript = messages.filter((item, index) => index >= latestQuestion || item.role !== 'tool' && !item.tool_calls?.length)
  const next = { ...conversation, revision: randomUUID(), updatedAt: new Date().toISOString(), messages: transcript }
  const key = await documentKey(`c-${next.id}`)
  // No transcript retention cap. Model context has its own bounded retrieval.
  if (expectedRevision === undefined) await writeDocument(NAMESPACE, key, next)
  else if (sql) {
    const rows = expectedRevision === null
      ? await sql`INSERT INTO user_documents(user_id,namespace,document_key,value,updated_at)
          VALUES (${currentUserId()},${NAMESPACE},${key},${JSON.stringify(next)}::jsonb,now())
          ON CONFLICT DO NOTHING RETURNING document_key`
      : await sql`UPDATE user_documents SET value=${JSON.stringify(next)}::jsonb,updated_at=now()
          WHERE user_id=${currentUserId()} AND namespace=${NAMESPACE} AND document_key=${key}
          AND coalesce(value->>'revision',value->>'updatedAt')=${expectedRevision} RETURNING document_key`
    if (!rows.length) throw new TutorStoreError('This conversation changed in another tab. Reopen it to see the latest messages.', 409)
  } else await localConversationWrite(key, async () => {
    const held = await readDocument(NAMESPACE, key, null)
    if (conversationRevision(held) !== expectedRevision) throw new TutorStoreError('This conversation changed in another tab. Reopen it to see the latest messages.', 409)
    await writeDocument(NAMESPACE, key, next)
  })
  return next
}

export function newConversation() {
  const now = new Date().toISOString()
  return { id: randomUUID(), title: null, createdAt: now, updatedAt: now, messages: [] }
}

export async function deleteConversation(id) {
  return deleteDocument(NAMESPACE, await documentKey(`c-${id}`))
}

export async function deleteAllTutorData() {
  const conversations = await listConversations()
  for (const item of conversations) await deleteConversation(item.id)
  await deleteDocument(NAMESPACE, await documentKey(INDEX))
  await deleteDocument(NAMESPACE, await documentKey('memory'))
  await deleteDocument(NAMESPACE, await documentKey('actions'))
  return conversations.length
}

export async function exportTutorData() {
  const conversations = []
  for (const item of await listConversations()) {
    const conversation = await readConversation(item.id)
    if (conversation) conversations.push(conversation)
  }
  return { conversations, memory: await readTutorMemory(), actions: await readTutorActionReceipts() }
}

const HISTORY_STOP_WORDS = new Set('i me my we our you your the a an is are was were to of and or in on for it this that about what did do have had said talked remember conversation'.split(' '))
export function tutorHistoryTerms(query) {
  return [...new Set((String(query).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []).filter(word => !HISTORY_STOP_WORDS.has(word)))].slice(0, 16)
}

export async function searchTutorHistory({ query = '', excludeConversationId = '', currentConversationId = '', limit = 6 } = {}) {
  const size = Math.min(8, Math.max(1, Number(limit) || 6))
  const terms = tutorHistoryTerms(query)
  let matches
  if (sql) {
    const prefix = await documentKey('c-')
    const tsQuery = terms.map(word => `'${word}'`).join(' | ')
    matches = await sql`SELECT d.value->>'id' AS conversation_id, d.value->>'title' AS title,
      m.ordinality::int AS position, m.message->>'role' AS role,
      left(m.message->>'content',2400) AS content,
      coalesce(m.message->>'at',d.value->>'updatedAt') AS at,
      CASE WHEN ${tsQuery}='' THEN 0 ELSE ts_rank_cd(to_tsvector('simple',m.message->>'content'),to_tsquery('simple',${tsQuery})) END AS score
      FROM user_documents d CROSS JOIN LATERAL jsonb_array_elements(d.value->'messages') WITH ORDINALITY AS m(message,ordinality)
      WHERE d.user_id=${currentUserId()} AND d.namespace=${NAMESPACE}
        AND left(d.document_key,length(${prefix}))=${prefix} AND d.value->>'id'<>${excludeConversationId}
        AND (d.value->>'id'<>${currentConversationId} OR m.ordinality < (SELECT max(recent.ordinality) FROM jsonb_array_elements(d.value->'messages') WITH ORDINALITY AS recent(message,ordinality) WHERE recent.message->>'role'='user'))
        AND m.message->>'role' IN ('user','assistant') AND CASE WHEN jsonb_typeof(m.message->'tool_calls')='array' THEN jsonb_array_length(m.message->'tool_calls') ELSE 0 END=0
        AND length(trim(m.message->>'content'))>0
      ORDER BY score DESC, at DESC, position DESC LIMIT ${size}`
  } else {
    matches = (await conversationDocuments()).filter(item => item.id !== excludeConversationId).flatMap(conversation => conversation.messages.map((message, index) => ({
      currentTurn: conversation.id === currentConversationId && index >= conversation.messages.findLastIndex(item => item.role === 'user'),
      conversation_id: conversation.id, title: conversation.title, position: index + 1, role: message.role,
      content: String(message.content || ''), at: message.at || conversation.updatedAt, toolCalls: message.tool_calls,
      score: terms.reduce((sum, term) => sum + Number(String(message.content || '').toLowerCase().includes(term)), 0)
    }))).filter(item => !item.currentTurn && ['user', 'assistant'].includes(item.role) && !item.toolCalls?.length && item.content.trim())
      .sort((a, b) => b.score - a.score || b.at.localeCompare(a.at) || b.position - a.position).slice(0, size)
  }
  return matches.map(item => ({ id: `chat:${item.conversation_id}:${item.position}`, conversationId: item.conversation_id,
    title: item.title || 'Past conversation', role: item.role, at: item.at, content: item.content.slice(0, 2400),
    url: `/app/tutor?conversation=${encodeURIComponent(item.conversation_id)}`, historical: true }))
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

async function updateMemory(change) {
  const key = await documentKey('memory')
  for (let attempt = 0; attempt < 8; attempt++) {
    const stored = await readDocument(NAMESPACE, key, null)
    const memory = { facts: [], plans: [], preferences: {}, ...stored }
    const { next, result } = change(memory)
    if (!next) return result
    try {
      await compareAndSwapDocument(NAMESPACE, key, { ...next, revision: randomUUID() }, stored?.revision || null,
        stored && !stored.revision ? { legacyValue: stored } : {})
      return result
    } catch (error) { if (!(error instanceof DocumentConflictError) || attempt === 7) throw error }
  }
}

export async function rememberFact(fact, context = {}) {
  const content = text(fact, 400)
  if (!content) throw new TutorStoreError('There is nothing to remember.')
  const metadata = ['preference', 'availability', 'context'].includes(context.kind)
    ? { kind: context.kind, weekdays: [...new Set(context.weekdays || [])].sort(), startDate: context.startDate || '', endDate: context.endDate || '' } : {}
  return updateMemory(memory => {
    const existing = memory.facts.find(entry => entry.fact.toLowerCase() === content.toLowerCase() && JSON.stringify(entry.kind ? { kind: entry.kind, weekdays: [...(entry.weekdays || [])].sort(), startDate: entry.startDate || '', endDate: entry.endDate || '' } : {}) === JSON.stringify(metadata))
    if (existing) return { result: { stored: existing, duplicate: true, facts: memory.facts } }
    const entry = { id: randomUUID().slice(0, 8), fact: content, ...metadata, at: new Date().toISOString() }
    const facts = [entry, ...memory.facts].slice(0, MAX_MEMORY)
    return { next: { ...memory, facts }, result: { stored: entry, duplicate: false, facts } }
  })
}

export async function forgetFact(id) {
  return updateMemory(memory => {
    const facts = memory.facts.filter(entry => entry.id !== id)
    return facts.length === memory.facts.length ? { result: false } : { next: { ...memory, facts }, result: true }
  })
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
  return updateMemory(memory => {
  const duplicate = memory.plans.find((entry) => entry.title.toLowerCase() === title.toLowerCase()
    && entry.startDate === startDate && entry.endDate === endDate && entry.recurrence === recurrence)
  if (duplicate) return { result: { stored: duplicate, duplicate: true, plans: memory.plans } }
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
  return { next: { ...memory, plans }, result: { stored: entry, duplicate: false, plans } }
  })
}

export async function forgetPlan(id) {
  return updateMemory(memory => {
    const plans = memory.plans.filter(entry => entry.id !== id)
    return plans.length === memory.plans.length ? { result: false } : { next: { ...memory, plans }, result: true }
  })
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
  return updateMemory(memory => {
    const next = normalisePreferences({ ...memory.preferences, ...preferences })
    return { next: { ...memory, preferences: next }, result: next }
  })
}
