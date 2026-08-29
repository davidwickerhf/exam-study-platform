import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'
import { deleteNamespaces, summariseNamespaces } from './user-store.mjs'
import { deleteActivity, readActivity, summariseStoredActivity } from './activity.mjs'

// Namespaces that hold the student's own study record. Resetting them keeps
// the account, the academic plan, and the AI usage ledger intact.
export const STUDY_NAMESPACES = Object.freeze(['progress', 'exercises', 'learning', 'mistakes', 'mock-sessions', 'activity', 'browser'])

export const NAMESPACE_LABELS = Object.freeze({
  progress: 'Study progress and course order',
  exercises: 'Personal extra exercises',
  learning: 'Flashcards and spaced repetition',
  mistakes: 'Mistake bank',
  'mock-sessions': 'Mock exam sessions',
  activity: 'Study activity log',
  browser: 'Synced reading positions',
  academics: 'Academic plan',
  ai: 'AI usage ledger',
  migration: 'Migration markers'
})

export async function summarisePersonalData() {
  const stored = (await summariseNamespaces()).filter((entry) => entry.namespace !== 'activity')
  const activity = await summariseStoredActivity()
  const namespaces = activity.count ? [...stored, { namespace: 'activity', ...activity }].sort((a, b) => a.namespace.localeCompare(b.namespace)) : stored
  return {
    namespaces: namespaces.map((entry) => ({ ...entry, label: NAMESPACE_LABELS[entry.namespace] || entry.namespace, study: STUDY_NAMESPACES.includes(entry.namespace) })),
    totals: {
      documents: namespaces.reduce((sum, entry) => sum + entry.count, 0),
      bytes: namespaces.reduce((sum, entry) => sum + entry.bytes, 0),
      updatedAt: namespaces.reduce((latest, entry) => (!latest || (entry.updatedAt && entry.updatedAt > latest) ? entry.updatedAt : latest), null)
    }
  }
}

export async function deleteStudyData() {
  const documents = await deleteNamespaces(STUDY_NAMESPACES.filter((namespace) => namespace !== 'activity'))
  const activityEvents = await deleteActivity()
  return { documents, aiUsageEvents: 0, activityEvents }
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const localRoot = resolve(root, 'data/users')
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function localUserRoot(userId = currentUserId()) {
  const target = resolve(localRoot, safeSegment(userId))
  if (!target.startsWith(`${localRoot}/`)) throw new Error('Invalid personal-data path')
  return target
}

export async function exportPersonalData(identity = null) {
  const userId = currentUserId()
  if (sql) {
    const [documents, aiUsage] = await sql.transaction([
      sql`SELECT namespace, document_key, value, created_at, updated_at
          FROM user_documents WHERE user_id = ${userId}
          ORDER BY namespace, document_key`,
      sql`SELECT feature, status, input_tokens, output_tokens, reserved_tokens, estimated, created_at, completed_at
          FROM ai_usage_events WHERE user_id = ${userId}
          ORDER BY created_at DESC`
    ], { readOnly: true })
    const activity = await readActivity({ since: '1970-01-01T00:00:00.000Z' })
    return {
      schemaVersion: 2,
      activity,
      exportedAt: new Date().toISOString(),
      account: identity || { id: userId },
      personalDocuments: documents.map((row) => ({
        namespace: row.namespace,
        key: row.document_key,
        value: row.value,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      aiUsage: aiUsage.map((row) => ({
        feature: row.feature,
        status: row.status,
        inputTokens: Number(row.input_tokens || 0),
        outputTokens: Number(row.output_tokens || 0),
        reservedTokens: Number(row.reserved_tokens || 0),
        estimated: row.estimated,
        createdAt: row.created_at,
        completedAt: row.completed_at
      }))
    }
  }

  const target = localUserRoot(userId)
  let documents = []
  if (existsSync(target)) {
    const { readdir, readFile } = await import('node:fs/promises')
    for (const namespace of await readdir(target, { withFileTypes: true })) {
      if (!namespace.isDirectory()) continue
      const directory = resolve(target, namespace.name)
      for (const file of await readdir(directory, { withFileTypes: true })) {
        if (!file.isFile() || !file.name.endsWith('.json')) continue
        try {
          const value = JSON.parse(await readFile(resolve(directory, file.name), 'utf8'))
          documents.push({ namespace: namespace.name, key: file.name.slice(0, -5), value })
        } catch {}
      }
    }
  }
  const usage = documents.find((document) => document.namespace === 'ai' && document.key === 'usage')
  const activity = documents.find((document) => document.namespace === 'activity' && document.key === 'log')
  documents = documents.filter((document) => !((document.namespace === 'ai' && document.key === 'usage') || (document.namespace === 'activity' && document.key === 'log')))
  return {
    schemaVersion: 2,
    activity: activity?.value?.events || [],
    exportedAt: new Date().toISOString(),
    account: identity || { id: userId },
    personalDocuments: documents,
    aiUsage: usage?.value?.events || []
  }
}

export async function deletePersonalData() {
  const userId = currentUserId()
  if (sql) {
    const [documents, aiUsage, activity] = await sql.transaction([
      sql`DELETE FROM user_documents WHERE user_id = ${userId} RETURNING document_key`,
      sql`DELETE FROM ai_usage_events WHERE user_id = ${userId} RETURNING id`,
      sql`DELETE FROM activity_events WHERE user_id = ${userId} RETURNING id`
    ])
    return { documents: documents.length, aiUsageEvents: aiUsage.length, activityEvents: activity.length }
  }
  const target = localUserRoot(userId)
  if (existsSync(target)) await rm(target, { recursive: true, force: true })
  return { documents: 0, aiUsageEvents: 0 }
}
