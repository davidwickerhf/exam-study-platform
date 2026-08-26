#!/usr/bin/env node
import '../lib/env.mjs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const sql = neon(process.env.DATABASE_URL)
const migration = await readFile(resolve('db/003_editorial_retrieval.sql'), 'utf8')
for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) await sql.query(statement)

function chunkText(text, target = 1600, overlap = 220) {
  const normalized = String(text || '').replace(/[\uD800-\uDFFF]/g, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!normalized) return []
  const chunks = []
  let start = 0
  while (start < normalized.length) {
    let end = Math.min(start + target, normalized.length)
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf('\n\n', end), normalized.lastIndexOf('. ', end))
      if (boundary > start + Math.floor(target * .6)) end = boundary + 1
    }
    chunks.push(normalized.slice(start, end).trim())
    if (end >= normalized.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks.filter(Boolean)
}

const materials = await sql`SELECT m.id, m.course_id, m.source_path, m.kind, m.text_content, m.extracted_text, m.extracted_pages
  FROM editorial_materials m JOIN editorial_releases r ON r.id=m.release_id
  WHERE r.active AND coalesce(m.text_content, m.extracted_text, '') <> ''
  ORDER BY m.course_id, m.source_path`

let indexed = 0
await sql`TRUNCATE editorial_retrieval_chunks RESTART IDENTITY`
let batch = []
async function flush() {
  if (!batch.length) return
  await sql`INSERT INTO editorial_retrieval_chunks (material_id, course_id, source_path, page_number, chunk_index, content)
    SELECT material_id, course_id, source_path, page_number, chunk_index, content
    FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb)
      AS x(material_id bigint, course_id text, source_path text, page_number integer, chunk_index integer, content text)`
  batch = []
}
for (const material of materials) {
  const units = material.kind === 'pdf' && Array.isArray(material.extracted_pages)
    ? material.extracted_pages.map((page) => ({ page: Number(page.page), text: page.text }))
    : [{ page: null, text: material.text_content || material.extracted_text }]
  for (const unit of units) {
    for (const [chunkIndex, content] of chunkText(unit.text).entries()) {
      batch.push({ material_id: Number(material.id), course_id: material.course_id, source_path: material.source_path, page_number: unit.page, chunk_index: chunkIndex, content })
      indexed++
      if (batch.length >= 250) await flush()
    }
  }
}
await flush()
console.log(`Indexed ${indexed} retrieval chunks from ${materials.length} materials.`)
