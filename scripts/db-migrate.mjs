#!/usr/bin/env node
import '../lib/env.mjs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { splitSqlStatements } from '../lib/sql-statements.mjs'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)
const migrations = ['001_user_documents.sql', '002_editorial_content.sql', '003_editorial_retrieval.sql', '004_ai_usage.sql', '005_academic_intake_usage.sql', '006_activity_events.sql', '007_personal_tables.sql', '008_api_keys.sql', '009_editorial_admin.sql', '010_editorial_flashcards.sql', '011_calendars.sql', '012_api_key_expiry.sql', '013_programme_memberships.sql', '014_attempt_context.sql', '015_course_content_requests.sql', '016_editorial_workflow.sql', '017_canvas_connections.sql', '018_agent_authorizations.sql', '019_academic_snapshots.sql', '020_canvas_corpus.sql', '021_programme_scoped_study.sql', '022_priority_scans.sql']
const queries = [sql`SELECT pg_advisory_xact_lock(2026083001)`]
for (const migration of migrations) {
  const source = await readFile(resolve('db', migration), 'utf8')
  for (const statement of splitSqlStatements(source)) queries.push(sql.query(statement))
}
await sql.transaction(queries)
for (const migration of migrations) console.log(`Applied db/${migration}`)
