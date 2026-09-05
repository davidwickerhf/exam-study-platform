#!/usr/bin/env node
import '../lib/env.mjs'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { promisify } from 'node:util'
import { neon } from '@neondatabase/serverless'
import { chunkProgrammePolicyText, validateProgrammePolicyPublication } from '../lib/programme-policy-sources.mjs'
import { embedTexts, embeddingConfiguration } from '../lib/embeddings.mjs'

const execFileAsync = promisify(execFile)
const checkOnly = process.argv.includes('--check')
if (!process.env.DATABASE_URL && !checkOnly) throw new Error('DATABASE_URL is required (or pass --check to verify the files without writing).')
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const directory = resolve(argument('directory', process.cwd()))
const manifestPath = resolve(argument('manifest', 'data/programme-policy-sources.json'))
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (!Array.isArray(manifest.sources) || !manifest.sources.length) throw new Error('The programme-policy manifest has no sources.')

async function extractPdf(path) {
  let stdout
  try {
    ;({ stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 }))
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('pdftotext is required (install Poppler).')
    throw error
  }
  const pages = stdout.split('\f').map((text, index) => ({ page: index + 1, text: text.trimEnd() })).filter((page) => page.text.trim())
  if (!pages.length) throw new Error(`${basename(path)} produced no searchable text.`)
  return pages
}

async function ensureAsset(definition, bytes, sha256) {
  let [asset] = await sql`SELECT * FROM editorial_source_assets WHERE sha256=${sha256}`
  if (!asset) {
    const id = `policy-asset-${sha256.slice(0, 24)}`
    ;[asset] = await sql`INSERT INTO editorial_source_assets
      (id, sha256, filename, media_type, byte_size, source_kind, expected_chunks, is_complete, extraction_status, metadata, created_by)
      VALUES (${id}, ${sha256}, ${definition.filename}, 'application/pdf', ${bytes.length}, 'file', ${Math.ceil(bytes.length / (512 * 1024))}, true, 'processing',
        ${JSON.stringify({ source: 'programme-policy', originalPrivate: true, provenance: definition.provenance || null })}::jsonb, 'programme-policy-import')
      RETURNING *`
  }
  const chunkSize = 512 * 1024
  for (let offset = 0, index = 0; offset < bytes.length; offset += chunkSize, index++) {
    await sql`INSERT INTO editorial_source_asset_chunks (asset_id, chunk_index, data)
      VALUES (${asset.id}, ${index}, ${bytes.subarray(offset, offset + chunkSize)})
      ON CONFLICT (asset_id, chunk_index) DO UPDATE SET data=excluded.data`
  }
  await sql`UPDATE editorial_source_assets SET filename=${definition.filename}, media_type='application/pdf', byte_size=${bytes.length},
    expected_chunks=${Math.ceil(bytes.length / chunkSize)}, is_complete=true, extraction_status='processing', updated_at=now() WHERE id=${asset.id}`
  return asset
}

async function indexSource(definition, asset, pages, sha256) {
  const publication = validateProgrammePolicyPublication(definition)
  const sourceId = `policy-${sha256.slice(0, 24)}`
  const fullText = pages.map((page) => page.text).join('\n\n')
  await sql`INSERT INTO programme_policy_sources
    (id, asset_id, title, document_kind, institution, academic_year, authority, source_url, visibility, rights_basis, original_downloadable, status, metadata, created_by, updated_at)
    VALUES (${sourceId}, ${asset.id}, ${definition.title}, ${definition.documentKind}, ${definition.institution || ''}, ${definition.academicYear || ''},
      ${definition.authority || ''}, ${publication.sourceUrl}, ${publication.visibility}, ${publication.rightsBasis}, ${publication.originalDownloadable}, 'draft',
      ${JSON.stringify({ filename: definition.filename, sha256, provenance: definition.provenance || null })}::jsonb, 'programme-policy-import', now())
    ON CONFLICT (id) DO UPDATE SET title=excluded.title, document_kind=excluded.document_kind, institution=excluded.institution,
      academic_year=excluded.academic_year, authority=excluded.authority, source_url=excluded.source_url, visibility=excluded.visibility,
      rights_basis=excluded.rights_basis, original_downloadable=excluded.original_downloadable, metadata=excluded.metadata, updated_at=now()`
  await sql`DELETE FROM programme_policy_source_programmes WHERE source_id=${sourceId}`
  for (const programmeId of [...new Set(definition.programmes || [])]) {
    await sql`INSERT INTO programme_policy_source_programmes (source_id, programme_id) VALUES (${sourceId}, ${programmeId})`
  }
  await sql`DELETE FROM programme_policy_retrieval_chunks WHERE source_id=${sourceId}`
  const records = pages.flatMap((page) => chunkProgrammePolicyText(page.text).map((content, chunkIndex) => ({ page: page.page, chunkIndex, content })))
  const embedding = embeddingConfiguration()
  for (let offset = 0; offset < records.length; offset += 40) {
    const batch = records.slice(offset, offset + 40)
    const vectors = embedding.configured ? await embedTexts(batch.map((record) => record.content)).catch(() => batch.map(() => null)) : batch.map(() => null)
    for (const [index, record] of batch.entries()) {
      const vector = vectors[index]
      if (vector) {
        const literal = `[${vector.join(',')}]`
        await sql`INSERT INTO programme_policy_retrieval_chunks
          (source_id, asset_id, page_number, chunk_index, content, metadata, embedding, embedding_model, embedded_at)
          VALUES (${sourceId}, ${asset.id}, ${record.page}, ${record.chunkIndex}, ${record.content}, ${JSON.stringify({ title: definition.title, provenance: definition.provenance || null })}::jsonb,
            ${literal}::vector, ${embedding.model}, now())`
      } else {
        await sql`INSERT INTO programme_policy_retrieval_chunks
          (source_id, asset_id, page_number, chunk_index, content, metadata)
          VALUES (${sourceId}, ${asset.id}, ${record.page}, ${record.chunkIndex}, ${record.content}, ${JSON.stringify({ title: definition.title, provenance: definition.provenance || null })}::jsonb)`
      }
    }
  }
  await sql`UPDATE editorial_source_assets SET content_sha256=${createHash('sha256').update(fullText).digest('hex')}, extracted_text=${fullText},
    extracted_pages=${JSON.stringify(pages)}::jsonb, extraction_status='complete', extraction_error=null, updated_at=now() WHERE id=${asset.id}`
  await sql`UPDATE programme_policy_sources SET status='indexed', updated_at=now() WHERE id=${sourceId}`
  return { sourceId, pages: pages.length, chunks: records.length, visibility: publication.visibility, programmes: definition.programmes || [] }
}

for (const definition of manifest.sources) {
  const path = resolve(directory, definition.filename)
  const bytes = await readFile(path)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (sha256 !== definition.sha256) throw new Error(`${definition.filename} does not match its reviewed SHA-256.`)
  const pages = await extractPdf(path)
  if (checkOnly) {
    const chunks = pages.reduce((count, page) => count + chunkProgrammePolicyText(page.text).length, 0)
    console.log(`${definition.filename}: hash verified, ${pages.length} pages, ${chunks} chunks, no database writes`)
    continue
  }
  const asset = await ensureAsset(definition, bytes, sha256)
  const result = await indexSource(definition, asset, pages, sha256)
  console.log(`${definition.filename}: ${result.pages} pages, ${result.chunks} chunks, ${result.visibility}, ${result.programmes.length} programmes`)
}
