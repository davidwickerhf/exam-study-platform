#!/usr/bin/env node
import '../lib/env.mjs'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { neon } from '@neondatabase/serverless'

const exec = promisify(execFile)
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const sql = neon(process.env.DATABASE_URL)

async function plainExtract(path) {
  const { stdout } = await exec('pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'], { maxBuffer: 64 * 1024 * 1024 })
  return stdout.split('\f').map((text, index) => ({ page: index + 1, text: text.trimEnd() })).filter((page) => page.text.trim())
}

async function ocrExtract(path) {
  const dir = await mkdtemp(join(tmpdir(), 'wicker-ocr-'))
  try {
    const prefix = join(dir, 'page')
    await exec('pdftoppm', ['-jpeg', '-r', '180', path, prefix], { maxBuffer: 8 * 1024 * 1024 })
    const { readdir } = await import('node:fs/promises')
    const images = (await readdir(dir)).filter((name) => name.endsWith('.jpg')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const pages = []
    for (const [index, image] of images.entries()) {
      const { stdout } = await exec('tesseract', [join(dir, image), 'stdout', '-l', 'eng'], { maxBuffer: 16 * 1024 * 1024 })
      if (stdout.trim()) pages.push({ page: index + 1, text: stdout.trimEnd() })
    }
    return pages
  } finally { await rm(dir, { recursive: true, force: true }) }
}

const rows = await sql`SELECT m.id, m.course_id, m.source_path, c.knowledge_base FROM editorial_materials m
  JOIN editorial_releases r ON r.id=m.release_id
  JOIN editorial_courses c ON c.release_id=m.release_id AND c.course_id=m.course_id
  WHERE r.active AND m.kind='pdf' AND coalesce(length(m.extracted_text), 0)=0`
for (const row of rows) {
  const path = resolve('content', row.knowledge_base, row.source_path)
  let pages = await plainExtract(path).catch(() => [])
  if (!pages.length) pages = await ocrExtract(path)
  const text = pages.map((page) => page.text).join('\n\n')
  if (!text.trim()) throw new Error(`No extractable text: ${row.course_id}/${row.source_path}`)
  await sql`UPDATE editorial_materials SET extracted_text=${text}, extracted_pages=${JSON.stringify(pages)}::jsonb WHERE id=${row.id}`
  console.log(`Extracted ${row.course_id}/${row.source_path}: ${pages.length} pages (${text.length} chars)`)
}
console.log(`Backfill complete: ${rows.length} PDFs processed.`)
