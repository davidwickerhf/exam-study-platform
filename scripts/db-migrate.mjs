#!/usr/bin/env node
import '../lib/env.mjs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)
for (const migration of ['001_user_documents.sql', '002_editorial_content.sql', '003_editorial_retrieval.sql', '004_ai_usage.sql', '005_academic_intake_usage.sql', '006_activity_events.sql']) {
  const source = await readFile(resolve('db', migration), 'utf8')
  for (const statement of source.split(';').map((part) => part.trim()).filter(Boolean)) await sql.query(statement)
  console.log(`Applied db/${migration}`)
}
