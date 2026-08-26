import { neon } from '@neondatabase/serverless'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export function retrievalMode() { return sql ? 'neon-fts' : 'unavailable' }

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
    return `[SOURCE ${index + 1}: ${chunk.sourcePath}${page}]\n${chunk.content}`
  }).join('\n\n')
}
