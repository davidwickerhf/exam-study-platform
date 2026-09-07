import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'
import { embedTexts, embeddingConfiguration } from './embeddings.mjs'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export function retrievalMode() { return sql ? 'neon-fts' : 'unavailable' }

const clean = (value, max = 1000) => String(value || '').trim().slice(0, max)
const sourceKinds = new Set(['syllabus', 'requirements', 'slides', 'pages', 'assessments', 'activities', 'readings', 'materials'])

function corpusRow(row, lexicalScore = 0, semanticScore = 0) {
  const edition = {
    editionId: row.edition_id,
    academicYear: row.academic_year,
    period: row.period,
    sourcePath: row.source_path,
    canvasUpdatedAt: row.canvas_updated_at || null,
    lastSeenAt: row.last_seen_at,
    current: !row.retired_at
  }
  return {
    corpus: 'canvas',
    assetId: row.asset_id,
    materialUrl: row.asset_id ? `/api/corpus/assets/${encodeURIComponent(row.asset_id)}` : null,
    editionId: row.edition_id,
    canonicalCourseId: row.canonical_course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    academicYear: row.academic_year,
    period: row.period,
    sourcePath: row.source_path,
    sourceType: row.resource_type,
    page: row.page_number == null ? null : Number(row.page_number),
    chunkIndex: row.chunk_index == null ? null : Number(row.chunk_index),
    content: row.content,
    score: Math.max(Number(lexicalScore) || 0, Number(semanticScore) || 0),
    lexicalScore: Number(lexicalScore) || 0,
    semanticScore: Number(semanticScore) || 0,
    canvasUpdatedAt: row.canvas_updated_at || null,
    lastSeenAt: row.last_seen_at,
    current: !row.retired_at,
    editions: [edition]
  }
}

const editionKey = (edition) => [edition.editionId, edition.academicYear, edition.period, edition.sourcePath].join('|')

/**
 * The same content-addressed asset may be present in several Canvas shells for
 * a retaken course. Return the passage once, with every edition that proves
 * where it came from, rather than allowing duplicates to crowd newer or
 * genuinely different evidence out of the retrieval window.
 */
export function aggregateCanvasCorpusChunks(chunks = [], limit = 8) {
  const grouped = new Map()
  for (const chunk of chunks) {
    const key = chunk.assetId
      ? `${chunk.assetId}|${chunk.page ?? ''}|${chunk.chunkIndex ?? ''}`
      : `${chunk.editionId ?? ''}|${chunk.sourcePath ?? ''}|${chunk.page ?? ''}|${chunk.chunkIndex ?? ''}`
    const held = grouped.get(key)
    if (!held) {
      grouped.set(key, { ...chunk, editions: [...(chunk.editions || [])] })
      continue
    }
    held.lexicalScore = Math.max(Number(held.lexicalScore) || 0, Number(chunk.lexicalScore) || 0)
    held.semanticScore = Math.max(Number(held.semanticScore) || 0, Number(chunk.semanticScore) || 0)
    held.score = Math.max(Number(held.score) || 0, Number(chunk.score) || 0)
    const known = new Set(held.editions.map(editionKey))
    for (const edition of chunk.editions || []) {
      if (!known.has(editionKey(edition))) held.editions.push(edition)
    }
    held.current = held.editions.some((edition) => edition.current)
  }
  for (const chunk of grouped.values()) {
    chunk.editions.sort((left, right) => String(right.academicYear || '').localeCompare(String(left.academicYear || '')))
    const latest = chunk.editions[0]
    if (latest) {
      chunk.editionId = latest.editionId
      chunk.academicYear = latest.academicYear
      chunk.period = latest.period
      chunk.sourcePath = latest.sourcePath
      chunk.canvasUpdatedAt = latest.canvasUpdatedAt
      chunk.lastSeenAt = latest.lastSeenAt
    }
  }
  return [...grouped.values()]
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || String(right.academicYear || '').localeCompare(String(left.academicYear || '')))
    .slice(0, Math.max(1, Number(limit) || 8))
}

export async function retrieveCanvasCorpus({ query, courseCode = '', canonicalCourseId = '', academicYear = '', sourceType = '', includeHistorical = true, limit = 8, database = sql } = {}) {
  const sql = database
  if (!sql) return []
  const cleaned = clean(query)
  const code = clean(courseCode, 80).toUpperCase()
  const canonical = clean(canonicalCourseId, 200)
  const year = clean(academicYear, 20)
  // "Materials" is the Tutor's umbrella term, not just the importer's folder
  // classification. Paper-list slides, for example, are classified as readings.
  const requestedKind = clean(sourceType, 40).toLowerCase()
  const kind = requestedKind !== 'materials' && sourceKinds.has(requestedKind) ? requestedKind : ''
  if (!cleaned || (!code && !canonical)) return []
  const count = Math.max(1, Math.min(Number(limit) || 8, 20))
  const accountId = currentUserId()
  const base = await sql`SELECT c.id, c.asset_id, c.edition_id, c.chunk_index, b.canonical_course_id, b.course_code, b.course_name, b.academic_year, b.period,
      s.source_path, s.resource_type, s.canvas_updated_at, s.last_seen_at, s.retired_at, c.page_number, c.content,
      ts_rank_cd(c.search_vector, websearch_to_tsquery('english', ${cleaned}), 32) AS lexical_score
    FROM editorial_source_retrieval_chunks c
    JOIN canvas_source_snapshots s ON s.asset_id=c.asset_id AND s.binding_id IN (SELECT binding_id FROM canvas_corpus_access WHERE user_id=${accountId})
    JOIN canvas_course_bindings b ON b.id=s.binding_id AND b.edition_id=c.edition_id
    WHERE (${code}='' OR upper(b.course_code)=${code})
      AND (${canonical}='' OR b.canonical_course_id=${canonical})
      AND (${year}='' OR b.academic_year=${year})
      AND (${includeHistorical} OR s.retired_at IS NULL)
      AND (s.contributor_user_id=${accountId} OR (s.sharing_mode='community' AND EXISTS (
        SELECT 1 FROM editorial_contributions accepted
        WHERE accepted.id=s.contribution_id AND accepted.consent_status='accepted'
      )))
      AND (${kind}='' OR s.resource_type=${kind} OR lower(s.source_path) LIKE ${`%${kind}%`})
      AND c.search_vector @@ websearch_to_tsquery('english', ${cleaned})
    ORDER BY (CASE WHEN ${year}<>'' AND b.academic_year=${year} THEN 1 ELSE 0 END) DESC,
      b.academic_year DESC, lexical_score DESC, s.last_seen_at DESC LIMIT ${count * 3}`
  // Lexical ranks and cosine similarity use incompatible scales. Fuse ranks
  // so a direct "paper list" hit is not buried by merely related passages.
  const byId = new Map()
  for (const row of base) {
    if (!byId.has(String(row.id))) byId.set(String(row.id), { ...corpusRow(row, row.lexical_score, 0), score: 1/(61+byId.size) })
  }
  const embedding = embeddingConfiguration()
  if (embedding.configured) {
    try {
      const [vector] = await embedTexts([cleaned])
      if (vector) {
        const literal = `[${vector.join(',')}]`
        const semantic = await sql`SELECT c.id, c.asset_id, c.edition_id, c.chunk_index, b.canonical_course_id, b.course_code, b.course_name, b.academic_year, b.period,
            s.source_path, s.resource_type, s.canvas_updated_at, s.last_seen_at, s.retired_at, c.page_number, c.content,
            1 - (c.embedding <=> ${literal}::vector) AS semantic_score
          FROM editorial_source_retrieval_chunks c
          JOIN canvas_source_snapshots s ON s.asset_id=c.asset_id AND s.binding_id IN (SELECT binding_id FROM canvas_corpus_access WHERE user_id=${accountId})
          JOIN canvas_course_bindings b ON b.id=s.binding_id AND b.edition_id=c.edition_id
          WHERE c.embedding IS NOT NULL AND (${code}='' OR upper(b.course_code)=${code}) AND (${canonical}='' OR b.canonical_course_id=${canonical})
            AND (${year}='' OR b.academic_year=${year}) AND (${includeHistorical} OR s.retired_at IS NULL)
            AND (s.contributor_user_id=${accountId} OR (s.sharing_mode='community' AND EXISTS (
              SELECT 1 FROM editorial_contributions accepted
              WHERE accepted.id=s.contribution_id AND accepted.consent_status='accepted'
            )))
            AND (${kind}='' OR s.resource_type=${kind} OR lower(s.source_path) LIKE ${`%${kind}%`})
          ORDER BY c.embedding <=> ${literal}::vector LIMIT ${count * 2}`
        const seen = new Set()
        for (const row of semantic) {
          const key = String(row.id)
          // Multiple source paths can point to the same content-addressed
          // passage. It gets one vote per retriever, not one per joined row.
          if (seen.has(key)) continue
          const rank = seen.size
          seen.add(key)
          const held = byId.get(key)
          if (held) {
            held.semanticScore = Number(row.semantic_score) || 0
            held.score += 1/(61+rank)
          } else byId.set(key, {...corpusRow(row, 0, row.semantic_score),score:1/(61+rank)})
        }
      }
    } catch { /* Semantic retrieval is an enhancement; FTS remains authoritative and available. */ }
  }
  const matches = aggregateCanvasCorpusChunks([...byId.values()], count)
  // Import folder labels are hints, not evidence that a document is absent.
  if (!matches.length && kind) return retrieveCanvasCorpus({query,courseCode,canonicalCourseId,academicYear,includeHistorical,limit,sourceType:'',database})
  return matches
}

/** Read surrounding indexed passages under the same access rules as search. */
export async function readCanvasSource({assetId, courseCode, offset=0, database=sql}={}) {
  if (!database) throw new Error('Course source storage is unavailable.')
  const accountId=currentUserId(), code=clean(courseCode,80).toUpperCase(), id=clean(assetId,100)
  if (!accountId || !code || !/^esa-[a-zA-Z0-9-]+$/.test(id)) throw new Error('A course and a valid source ID are required.')
  const start=Math.max(0,Math.min(100000,Math.floor(Number(offset)||0)))
  const rows=await database`SELECT c.asset_id,c.edition_id,c.page_number,c.chunk_index,c.content,
      b.canonical_course_id,b.course_code,b.course_name,b.academic_year,b.period,
      s.source_path,s.resource_type,s.canvas_updated_at,s.last_seen_at,s.retired_at
    FROM editorial_source_retrieval_chunks c
    JOIN LATERAL (SELECT snap.* FROM canvas_source_snapshots snap
      JOIN canvas_course_bindings binding ON binding.id=snap.binding_id AND binding.edition_id=c.edition_id
      JOIN canvas_corpus_access access ON access.binding_id=binding.id AND access.user_id=${accountId}
      WHERE snap.asset_id=c.asset_id AND upper(binding.course_code)=${code} AND snap.retired_at IS NULL
        AND (snap.contributor_user_id=${accountId} OR (snap.sharing_mode='community' AND EXISTS(
          SELECT 1 FROM editorial_contributions accepted WHERE accepted.id=snap.contribution_id AND accepted.consent_status='accepted')))
      ORDER BY snap.last_seen_at DESC LIMIT 1) s ON true
    JOIN canvas_course_bindings b ON b.id=s.binding_id
    WHERE c.asset_id=${id}
    ORDER BY b.academic_year DESC,c.page_number NULLS FIRST,c.chunk_index OFFSET ${start} LIMIT 13`
  const chunks=rows.slice(0,12).map(row=>corpusRow(row))
  return {chunks,nextOffset:rows.length>12?start+12:null}
}

export async function retrieveCourseContent({ query, courseId, sourcePath = null, limit = 8 }) {
  if (!sql) return []
  const cleaned = String(query || '').trim().slice(0, 1000)
  if (!cleaned || !courseId) return []
  const count = Math.max(1, Math.min(Number(limit) || 8, 20))
  const rows = sourcePath
    ? await sql`SELECT course_id, source_path, page_number, content,
        ts_rank_cd(search_vector, websearch_to_tsquery('english', ${cleaned}), 32) AS score
      FROM editorial_retrieval_chunks
      WHERE course_id=${courseId} AND source_path=${sourcePath}
        AND search_vector @@ websearch_to_tsquery('english', ${cleaned})
      ORDER BY score DESC, page_number NULLS FIRST, chunk_index LIMIT ${count}`
    : await sql`SELECT course_id, source_path, page_number, content,
        ts_rank_cd(search_vector, websearch_to_tsquery('english', ${cleaned}), 32) AS score
      FROM editorial_retrieval_chunks
      WHERE course_id=${courseId}
        AND search_vector @@ websearch_to_tsquery('english', ${cleaned})
      ORDER BY score DESC, page_number NULLS FIRST, chunk_index LIMIT ${count}`
  return rows.map((row) => ({
    courseId: row.course_id,
    sourcePath: row.source_path,
    page: row.page_number == null ? null : Number(row.page_number),
    content: row.content,
    score: Number(row.score)
  }))
}

export function formatRetrievalContext(chunks) {
  return chunks.map((chunk, index) => {
    const page = chunk.page ? `, p. ${chunk.page}` : ''
    const policy = chunk.corpus === 'programme-policy'
      ? ` · ${[chunk.authority, chunk.academicYear].filter(Boolean).join(' · ')}`
      : ''
    const labels = [...new Set((chunk.editions || [])
      .map((edition) => edition.academicYear ? `${edition.academicYear}${edition.period ? ` P${edition.period}` : ''}` : '')
      .filter(Boolean))]
    const edition = labels.length
      ? ` · ${labels.length > 1 ? 'editions ' : ''}${labels.join('; ')}`
      : chunk.academicYear ? ` · ${chunk.academicYear}${chunk.period ? ` P${chunk.period}` : ''}` : ''
    return `[SOURCE ${index + 1}: ${chunk.sourcePath}${page}${edition}${policy}]\n${chunk.content}`
  }).join('\n\n')
}
