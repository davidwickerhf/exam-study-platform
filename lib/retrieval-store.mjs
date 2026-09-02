import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'
import { embedTexts, embeddingConfiguration } from './embeddings.mjs'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export function retrievalMode() { return sql ? 'neon-fts' : 'unavailable' }

const clean = (value, max = 1000) => String(value || '').trim().slice(0, max)
const sourceKinds = new Set(['syllabus', 'requirements', 'slides', 'pages', 'assessments', 'activities', 'readings', 'materials'])

function corpusRow(row, lexicalScore = 0, semanticScore = 0) {
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
    content: row.content,
    score: Math.max(Number(lexicalScore) || 0, Number(semanticScore) || 0),
    lexicalScore: Number(lexicalScore) || 0,
    semanticScore: Number(semanticScore) || 0,
    canvasUpdatedAt: row.canvas_updated_at || null,
    lastSeenAt: row.last_seen_at,
    current: !row.retired_at
  }
}

export async function retrieveCanvasCorpus({ query, courseCode = '', canonicalCourseId = '', academicYear = '', sourceType = '', includeHistorical = true, limit = 8 } = {}) {
  if (!sql) return []
  const cleaned = clean(query)
  const code = clean(courseCode, 80).toUpperCase()
  const canonical = clean(canonicalCourseId, 200)
  const year = clean(academicYear, 20)
  const kind = sourceKinds.has(clean(sourceType, 40).toLowerCase()) ? clean(sourceType, 40).toLowerCase() : ''
  if (!cleaned || (!code && !canonical)) return []
  const count = Math.max(1, Math.min(Number(limit) || 8, 20))
  const accountId = currentUserId()
  const base = await sql`SELECT c.id, c.asset_id, c.edition_id, b.canonical_course_id, b.course_code, b.course_name, b.academic_year, b.period,
      s.source_path, s.resource_type, s.canvas_updated_at, s.last_seen_at, s.retired_at, c.page_number, c.content,
      ts_rank_cd(c.search_vector, websearch_to_tsquery('english', ${cleaned}), 32) AS lexical_score
    FROM editorial_source_retrieval_chunks c
    JOIN canvas_source_snapshots s ON s.asset_id=c.asset_id AND s.binding_id IN (SELECT binding_id FROM canvas_corpus_access WHERE user_id=${accountId})
    JOIN canvas_course_bindings b ON b.id=s.binding_id AND b.edition_id=c.edition_id
    WHERE (${code}='' OR upper(b.course_code)=${code})
      AND (${canonical}='' OR b.canonical_course_id=${canonical})
      AND (${year}='' OR b.academic_year=${year})
      AND (${includeHistorical} OR s.retired_at IS NULL)
      AND (s.sharing_mode='community' OR s.contributor_user_id=${accountId})
      AND (${kind}='' OR s.resource_type=${kind} OR lower(s.source_path) LIKE ${`%${kind}%`})
      AND c.search_vector @@ websearch_to_tsquery('english', ${cleaned})
    ORDER BY (CASE WHEN ${year}<>'' AND b.academic_year=${year} THEN 1 ELSE 0 END) DESC,
      b.academic_year DESC, lexical_score DESC, s.last_seen_at DESC LIMIT ${count * 3}`
  const byId = new Map(base.map((row) => [String(row.id), corpusRow(row, row.lexical_score, 0)]))
  const embedding = embeddingConfiguration()
  if (embedding.configured) {
    try {
      const [vector] = await embedTexts([cleaned])
      if (vector) {
        const literal = `[${vector.join(',')}]`
        const semantic = await sql`SELECT c.id, c.asset_id, c.edition_id, b.canonical_course_id, b.course_code, b.course_name, b.academic_year, b.period,
            s.source_path, s.resource_type, s.canvas_updated_at, s.last_seen_at, s.retired_at, c.page_number, c.content,
            1 - (c.embedding <=> ${literal}::vector) AS semantic_score
          FROM editorial_source_retrieval_chunks c
          JOIN canvas_source_snapshots s ON s.asset_id=c.asset_id AND s.binding_id IN (SELECT binding_id FROM canvas_corpus_access WHERE user_id=${accountId})
          JOIN canvas_course_bindings b ON b.id=s.binding_id AND b.edition_id=c.edition_id
          WHERE c.embedding IS NOT NULL AND (${code}='' OR upper(b.course_code)=${code}) AND (${canonical}='' OR b.canonical_course_id=${canonical})
            AND (${year}='' OR b.academic_year=${year}) AND (${includeHistorical} OR s.retired_at IS NULL)
            AND (s.sharing_mode='community' OR s.contributor_user_id=${accountId})
            AND (${kind}='' OR s.resource_type=${kind} OR lower(s.source_path) LIKE ${`%${kind}%`})
          ORDER BY c.embedding <=> ${literal}::vector LIMIT ${count * 2}`
        for (const row of semantic) {
          const key = String(row.id)
          const held = byId.get(key)
          if (held) {
            held.semanticScore = Number(row.semantic_score) || 0
            held.score = held.lexicalScore * 0.55 + held.semanticScore * 0.45
          } else byId.set(key, corpusRow(row, 0, row.semantic_score))
        }
      }
    } catch { /* Semantic retrieval is an enhancement; FTS remains authoritative and available. */ }
  }
  return [...byId.values()]
    .sort((left, right) => right.score - left.score || String(right.academicYear).localeCompare(String(left.academicYear)))
    .slice(0, count)
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
    const edition = chunk.academicYear ? ` · ${chunk.academicYear}${chunk.period ? ` P${chunk.period}` : ''}` : ''
    return `[SOURCE ${index + 1}: ${chunk.sourcePath}${page}${edition}]\n${chunk.content}`
  }).join('\n\n')
}
