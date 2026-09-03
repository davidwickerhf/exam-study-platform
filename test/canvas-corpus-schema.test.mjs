import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../db/020_canvas_corpus.sql', import.meta.url), 'utf8')
const priorityMigration = await readFile(new URL('../db/022_priority_scans.sql', import.meta.url), 'utf8')
const priorityEvidence = await readFile(new URL('../lib/priority-evidence.mjs', import.meta.url), 'utf8')
const retrieval = await readFile(new URL('../lib/retrieval-store.mjs', import.meta.url), 'utf8')
const worker = await readFile(new URL('../lib/canvas-corpus-worker.mjs', import.meta.url), 'utf8')
const corpus = await readFile(new URL('../lib/course-corpus.mjs', import.meta.url), 'utf8')
const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8')

test('Canvas connection and material collection are separate explicit permissions', () => {
  assert.match(migration, /canvas_corpus_permissions/)
  assert.match(migration, /sharing_mode[^\n]+private[^\n]+community/)
  assert.match(migration, /collection_enabled BOOLEAN NOT NULL DEFAULT FALSE/)
})

test('private snapshots stay account-scoped while community snapshots can be reused by enrolled accounts', () => {
  assert.match(migration, /contributor_user_id TEXT NOT NULL/)
  assert.match(retrieval, /s\.sharing_mode='community' OR s\.contributor_user_id=\$\{accountId\}/)
  assert.match(worker, /permission\.sharing_mode === 'community' \? 'candidate' : 'private'/)
})

test('the durable worker versions sources and schedules freshness checks', () => {
  assert.match(migration, /canvas_sync_jobs/)
  assert.match(migration, /manifest_hash/)
  assert.match(migration, /canvas_source_snapshots/)
  assert.match(worker, /last_synced_at=now\(\), next_sync_at=/)
  assert.match(worker, /sha256/)
  assert.match(priorityMigration, /ON canvas_sync_jobs \(user_id, binding_id\)/)
  assert.match(worker, /recent\.user_id=access\.user_id/)
  assert.match(worker, /failed\.status='failed'.+FAILURE_COOLDOWN_HOURS/)
})

test('revoking material collection removes derived priority scans from the workspace', () => {
  assert.match(priorityEvidence, /canvas_corpus_permissions p/)
  assert.match(priorityEvidence, /p\.collection_enabled=true/)
})

test('retrieval supports embeddings and explicit academic-year editions', () => {
  assert.match(migration, /embedding vector\(1536\)/)
  assert.match(retrieval, /academicYear/)
  assert.match(retrieval, /courseCode/)
  assert.match(retrieval, /canvasUpdatedAt/)
})

test('original documents and local media retain the same account authorization boundary', () => {
  assert.match(corpus, /canvasCorpusAsset/)
  assert.match(corpus, /s\.sharing_mode='community' OR s\.contributor_user_id=\$\{accountId\}/)
  assert.match(worker, /localObjectKey/)
  assert.match(server, /Accept-Ranges/)
  assert.match(server, /\/api\\\/corpus\\\/assets/)
})

test('accounts can force a refresh or explicitly archive an out-of-period course', () => {
  assert.match(worker, /job\.payload\?\.force/)
  assert.match(corpus, /explicit \? courses : selectCanvasCorpusCourses/)
  assert.match(corpus, /enqueueCanvasCourseSync/)
})
