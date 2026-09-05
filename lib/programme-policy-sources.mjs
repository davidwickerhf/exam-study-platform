import { neon } from '@neondatabase/serverless'
import { embedTexts, embeddingConfiguration } from './embeddings.mjs'
import reviewedPolicyManifest from '../data/programme-policy-sources.json' with { type: 'json' }

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

const clean = (value, max = 1000) => String(value || '').trim().slice(0, max)
export const normaliseAcademicYear = (value) => clean(value, 30).replace(/[–—]/g, '-').replace(/\s+/g, '')

export const PROGRAMME_POLICY_KINDS = Object.freeze([
  'education-examination-regulations',
  'rules-regulations',
  'board-of-examiners',
  'exam-procedure',
  'programme-policy',
  'other'
])

const PUBLIC_RIGHTS = new Set(['official-publication', 'written-permission'])

export function validateProgrammePolicyPublication({ visibility = 'programme', rightsBasis = 'institution-member-reference', sourceUrl = '', originalDownloadable = false } = {}) {
  if (!['programme', 'university', 'public'].includes(visibility)) throw new Error('Programme policy visibility must be programme, university or public.')
  if (!['institution-member-reference', ...PUBLIC_RIGHTS].includes(rightsBasis)) throw new Error('Unknown programme policy rights basis.')
  if (visibility === 'public' && (!PUBLIC_RIGHTS.has(rightsBasis) || !clean(sourceUrl, 2000))) {
    throw new Error('Public programme policy sources require an official source URL and either official-publication or written-permission rights.')
  }
  if (originalDownloadable && visibility !== 'public') throw new Error('A programme-restricted original cannot be downloadable.')
  return { visibility, rightsBasis, sourceUrl: clean(sourceUrl, 2000) || null, originalDownloadable: Boolean(originalDownloadable) }
}

export function reviewedProgrammePolicyByHash(sha256) {
  const hash = clean(sha256, 64).toLowerCase()
  return reviewedPolicyManifest.sources.find((source) => source.sha256 === hash) || null
}

export async function promoteReviewedProgrammePolicyAsset({ assetId, sha256, editionId } = {}) {
  if (!sql) return null
  const definition = reviewedProgrammePolicyByHash(sha256)
  if (!definition) return null
  const publication = validateProgrammePolicyPublication(definition)
  const sourceId = `policy-${definition.sha256.slice(0, 24)}`
  const metadata = { filename: definition.filename, sha256: definition.sha256, provenance: definition.provenance || null }
  await sql`INSERT INTO programme_policy_sources
    (id, asset_id, title, document_kind, institution, academic_year, authority, source_url, visibility, rights_basis, original_downloadable, status, metadata, created_by, updated_at)
    VALUES (${sourceId}, ${assetId}, ${definition.title}, ${definition.documentKind}, ${definition.institution || ''}, ${definition.academicYear || ''},
      ${definition.authority || ''}, ${publication.sourceUrl}, ${publication.visibility}, ${publication.rightsBasis}, ${publication.originalDownloadable}, 'draft',
      ${JSON.stringify(metadata)}::jsonb, 'reviewed-canvas-policy', now())
    ON CONFLICT (id) DO UPDATE SET asset_id=excluded.asset_id, title=excluded.title, document_kind=excluded.document_kind,
      institution=excluded.institution, academic_year=excluded.academic_year, authority=excluded.authority, source_url=excluded.source_url,
      visibility=excluded.visibility, rights_basis=excluded.rights_basis, original_downloadable=excluded.original_downloadable,
      metadata=excluded.metadata, updated_at=now()`
  for (const programmeId of [...new Set(definition.programmes || [])]) {
    await sql`INSERT INTO programme_policy_source_programmes (source_id, programme_id) VALUES (${sourceId}, ${programmeId}) ON CONFLICT DO NOTHING`
  }
  await sql`INSERT INTO programme_policy_retrieval_chunks
    (source_id, asset_id, page_number, chunk_index, content, metadata, embedding, embedding_model, embedded_at)
    SELECT ${sourceId}, source.asset_id, source.page_number, source.chunk_index, source.content,
      ${JSON.stringify({ title: definition.title, provenance: definition.provenance || null })}::jsonb,
      source.embedding, source.embedding_model, source.embedded_at
    FROM editorial_source_retrieval_chunks source
    WHERE source.edition_id=${editionId} AND source.asset_id=${assetId}
    ON CONFLICT (source_id, page_number, chunk_index) DO UPDATE SET content=excluded.content, metadata=excluded.metadata,
      embedding=excluded.embedding, embedding_model=excluded.embedding_model, embedded_at=excluded.embedded_at`
  const [coverage] = await sql`SELECT count(*)::int AS chunks, max(page_number)::int AS pages FROM programme_policy_retrieval_chunks WHERE source_id=${sourceId}`
  const indexed = Number(coverage?.chunks) > 0
  await sql`UPDATE programme_policy_sources SET status=${indexed ? 'indexed' : 'draft'}, updated_at=now() WHERE id=${sourceId}`
  return { sourceId, title: definition.title, chunks: Number(coverage?.chunks) || 0, pages: Number(coverage?.pages) || null, indexed }
}

export function chunkProgrammePolicyText(value, target = 1800, overlap = 240) {
  const normalized = String(value || '').replace(/[\uD800-\uDFFF]/g, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!normalized) return []
  const chunks = []
  let start = 0
  while (start < normalized.length) {
    let end = Math.min(start + target, normalized.length)
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf('\n\n', end), normalized.lastIndexOf('. ', end))
      if (boundary > start + Math.floor(target * 0.6)) end = boundary + 1
    }
    chunks.push(normalized.slice(start, end).trim())
    if (end >= normalized.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks.filter(Boolean)
}

function metadataObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  try { return JSON.parse(String(value || '{}')) }
  catch { return {} }
}

function policyRow(row, lexicalScore = 0, semanticScore = 0) {
  const publicSource = row.visibility === 'public'
  const metadata = metadataObject(row.source_metadata)
  return {
    corpus: 'programme-policy',
    policySourceId: row.source_id,
    assetId: row.asset_id,
    title: row.title,
    sourcePath: row.title,
    sourceType: row.document_kind,
    documentKind: row.document_kind,
    institution: row.institution,
    authority: row.authority,
    academicYear: row.academic_year,
    page: row.page_number == null ? null : Number(row.page_number),
    chunkIndex: row.chunk_index == null ? null : Number(row.chunk_index),
    content: row.content,
    visibility: row.visibility,
    sourceUrl: publicSource ? row.source_url : null,
    materialUrl: publicSource ? row.source_url : null,
    originalDownloadable: publicSource && Boolean(row.original_downloadable),
    sourceProvenance: metadata.provenance || null,
    score: Math.max(Number(lexicalScore) || 0, Number(semanticScore) || 0),
    lexicalScore: Number(lexicalScore) || 0,
    semanticScore: Number(semanticScore) || 0,
    current: row.status === 'indexed'
  }
}

function scopeKinds(kinds) {
  const requested = Array.isArray(kinds) ? kinds : kinds ? [kinds] : []
  return [...new Set(requested.map((kind) => clean(kind, 80)).filter((kind) => PROGRAMME_POLICY_KINDS.includes(kind)))]
}

export async function listProgrammePolicySources({ programmeId = '', academicYear = '' } = {}) {
  if (!sql) return []
  const programme = clean(programmeId, 240)
  const year = normaliseAcademicYear(academicYear)
  const rows = await sql`SELECT s.id, s.title, s.document_kind, s.institution, s.academic_year, s.authority,
      s.source_url, s.visibility, s.original_downloadable, s.status, s.metadata, s.updated_at,
      (SELECT count(*)::int FROM programme_policy_retrieval_chunks c WHERE c.source_id=s.id) AS chunks,
      (SELECT max(c.page_number)::int FROM programme_policy_retrieval_chunks c WHERE c.source_id=s.id) AS pages
    FROM programme_policy_sources s
    WHERE s.status='indexed'
      AND (${year}='' OR s.academic_year='' OR s.academic_year=${year})
      AND (s.visibility IN ('public', 'university') OR (${programme}<>'' AND EXISTS (
        SELECT 1 FROM programme_policy_source_programmes p WHERE p.source_id=s.id AND p.programme_id=${programme}
      )))
    ORDER BY s.academic_year DESC, s.document_kind, s.title`
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    documentKind: row.document_kind,
    institution: row.institution,
    academicYear: row.academic_year,
    authority: row.authority,
    visibility: row.visibility,
    sourceUrl: row.visibility === 'public' ? row.source_url : null,
    originalDownloadable: row.visibility === 'public' && Boolean(row.original_downloadable),
    sourceProvenance: metadataObject(row.metadata).provenance || null,
    pages: Number(row.pages) || null,
    chunks: Number(row.chunks) || 0,
    updatedAt: row.updated_at
  }))
}

export async function retrieveProgrammePolicies({ query, programmeId = '', academicYear = '', kinds = [], limit = 8 } = {}) {
  if (!sql) return []
  const searched = clean(query)
  if (!searched) return []
  const programme = clean(programmeId, 240)
  const year = normaliseAcademicYear(academicYear)
  const selectedKinds = scopeKinds(kinds)
  const count = Math.max(1, Math.min(Number(limit) || 8, 20))
  const rows = await sql`SELECT c.id, c.source_id, c.asset_id, c.page_number, c.chunk_index, c.content,
      s.title, s.document_kind, s.institution, s.academic_year, s.authority, s.source_url,
      s.visibility, s.original_downloadable, s.status, s.metadata AS source_metadata,
      ts_rank_cd(c.search_vector, websearch_to_tsquery('english', ${searched}), 32) AS lexical_score
    FROM programme_policy_retrieval_chunks c
    JOIN programme_policy_sources s ON s.id=c.source_id
    WHERE s.status='indexed'
      AND (${year}='' OR s.academic_year='' OR s.academic_year=${year})
      AND (${selectedKinds.length === 0} OR s.document_kind = ANY(${selectedKinds}::text[]))
      AND (s.visibility IN ('public', 'university') OR (${programme}<>'' AND EXISTS (
        SELECT 1 FROM programme_policy_source_programmes p WHERE p.source_id=s.id AND p.programme_id=${programme}
      )))
      AND c.search_vector @@ websearch_to_tsquery('english', ${searched})
    ORDER BY (CASE WHEN ${year}<>'' AND s.academic_year=${year} THEN 1 ELSE 0 END) DESC,
      lexical_score DESC, s.updated_at DESC, c.page_number NULLS FIRST
    LIMIT ${count * 3}`
  const byId = new Map(rows.map((row) => [String(row.id), policyRow(row, row.lexical_score, 0)]))
  const embedding = embeddingConfiguration()
  if (embedding.configured) {
    try {
      const [vector] = await embedTexts([searched])
      if (vector) {
        const literal = `[${vector.join(',')}]`
        const semantic = await sql`SELECT c.id, c.source_id, c.asset_id, c.page_number, c.chunk_index, c.content,
            s.title, s.document_kind, s.institution, s.academic_year, s.authority, s.source_url,
            s.visibility, s.original_downloadable, s.status, s.metadata AS source_metadata,
            1 - (c.embedding <=> ${literal}::vector) AS semantic_score
          FROM programme_policy_retrieval_chunks c
          JOIN programme_policy_sources s ON s.id=c.source_id
          WHERE s.status='indexed' AND c.embedding IS NOT NULL
            AND (${year}='' OR s.academic_year='' OR s.academic_year=${year})
            AND (${selectedKinds.length === 0} OR s.document_kind = ANY(${selectedKinds}::text[]))
            AND (s.visibility IN ('public', 'university') OR (${programme}<>'' AND EXISTS (
              SELECT 1 FROM programme_policy_source_programmes p WHERE p.source_id=s.id AND p.programme_id=${programme}
            )))
          ORDER BY c.embedding <=> ${literal}::vector LIMIT ${count * 2}`
        for (const row of semantic) {
          const key = String(row.id)
          const held = byId.get(key)
          if (held) {
            held.semanticScore = Number(row.semantic_score) || 0
            held.score = held.lexicalScore * 0.55 + held.semanticScore * 0.45
          } else byId.set(key, policyRow(row, 0, row.semantic_score))
        }
      }
    } catch { /* Full-text retrieval stays available if embeddings fail. */ }
  }
  return [...byId.values()]
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || Number(left.page || 0) - Number(right.page || 0))
    .slice(0, count)
}
