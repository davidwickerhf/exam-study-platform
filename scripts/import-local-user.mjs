#!/usr/bin/env node
import '../lib/env.mjs'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withRequestContext } from '../lib/request-context.mjs'
import { storageMode, writeDocument } from '../lib/user-store.mjs'

const userIdIndex = process.argv.indexOf('--user-id')
const userId = userIdIndex >= 0 ? process.argv[userIdIndex + 1] : ''
if (!userId || !userId.startsWith('user_')) {
  console.error('Usage: npm run user:import -- --user-id user_...')
  process.exit(1)
}
if (storageMode() !== 'neon') {
  console.error('DATABASE_URL must point to the migrated Neon database')
  process.exit(1)
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const imports = []
async function json(path) { return JSON.parse(await readFile(path, 'utf8')) }
async function stage(namespace, key, path) {
  if (existsSync(path)) imports.push({ namespace, key, value: await json(path) })
}

await stage('progress', 'study-state', resolve(root, 'data/study-state.json'))
await stage('learning', 'flashcards', resolve(root, 'data/flashcards.json'))
await stage('learning', 'spaced-repetition', resolve(root, 'data/sr-state.json'))
for (const [directory, namespace] of [['mistakes', 'mistakes'], ['mocks', 'mock-sessions']]) {
  const path = resolve(root, `data/${directory}`)
  if (!existsSync(path)) continue
  for (const file of await readdir(path)) {
    if (file.endsWith('.json')) await stage(namespace, file.slice(0, -5), resolve(path, file))
  }
}

await withRequestContext({ userId }, async () => {
  for (const document of imports) await writeDocument(document.namespace, document.key, document.value)
  await writeDocument('migration', 'legacy-v1', { importedAt: new Date().toISOString(), source: 'local-files', originalsPreserved: true })
})
console.log(`Imported ${imports.length} personal documents for ${userId}; local originals were not changed.`)
