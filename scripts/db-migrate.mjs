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
await sql.query(await readFile(resolve('db/001_user_documents.sql'), 'utf8'))
console.log('Applied db/001_user_documents.sql')
