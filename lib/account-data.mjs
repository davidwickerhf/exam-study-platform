import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'

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
    return {
      schemaVersion: 1,
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
  documents = documents.filter((document) => !(document.namespace === 'ai' && document.key === 'usage'))
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: identity || { id: userId },
    personalDocuments: documents,
    aiUsage: usage?.value?.events || []
  }
}

export async function deletePersonalData() {
  const userId = currentUserId()
  if (sql) {
    const [documents, aiUsage] = await sql.transaction([
      sql`DELETE FROM user_documents WHERE user_id = ${userId} RETURNING document_key`,
      sql`DELETE FROM ai_usage_events WHERE user_id = ${userId} RETURNING id`
    ])
    return { documents: documents.length, aiUsageEvents: aiUsage.length }
  }
  const target = localUserRoot(userId)
  if (existsSync(target)) await rm(target, { recursive: true, force: true })
  return { documents: 0, aiUsageEvents: 0 }
}
