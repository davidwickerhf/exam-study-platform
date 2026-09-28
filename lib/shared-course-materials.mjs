import { sql } from './db.mjs'
import { examMaterialKind, sharedExamCourseCode } from './shared-exam-policy.mjs'

function categoryFor(row) {
  return row.review_category || examMaterialKind({ filename: row.filename, sourcePath: row.source_path }) || 'material'
}

function publicMaterial(row) {
  return {
    id: row.snapshot_id, title: row.filename, category: categoryFor(row),
    academicYear: row.academic_year, period: row.period,
    sourceType: row.resource_type, mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    url: `/api/shared-materials/assets/${encodeURIComponent(row.asset_id)}`,
    downloadUrl: `/api/shared-materials/assets/${encodeURIComponent(row.asset_id)}?download=1`
  }
}

// A release is valid only while its source, contributor consent and original
// asset remain live. Each original request repeats these checks.
const releaseRows = ({ code = '', assetId = '' } = {}) => sql`SELECT DISTINCT ON (b.course_code, b.academic_year, s.asset_id)
    s.id AS snapshot_id, s.asset_id, s.source_path, s.resource_type,
    review.category AS review_category, a.filename, a.media_type, a.byte_size,
    a.sha256, a.expected_chunks, a.metadata, b.course_code, b.course_name,
    b.academic_year, b.period
  FROM shared_course_material_reviews review
  JOIN canvas_source_snapshots s ON s.id=review.snapshot_id
  JOIN canvas_course_bindings b ON b.id=s.binding_id
  JOIN editorial_source_assets a ON a.id=s.asset_id
  JOIN editorial_contributions contribution ON contribution.id=s.contribution_id
  JOIN canvas_corpus_permissions permission ON permission.user_id=s.contributor_user_id AND permission.origin=b.origin
  WHERE review.status='approved' AND s.retired_at IS NULL AND s.sharing_mode='community'
    AND contribution.consent_status='accepted' AND permission.collection_enabled=true
    AND permission.sharing_mode='community' AND a.is_complete=true
    AND (${code}='' OR upper(b.course_code)=${code})
    AND (${assetId}='' OR a.id=${assetId})
  ORDER BY b.course_code, b.academic_year DESC, s.asset_id, s.last_seen_at DESC`

export async function publishedCourseMaterials(courseCode, { examsOnly = false } = {}) {
  const code = sharedExamCourseCode(courseCode)
  if (!code || !sql) return { courseCode: code, courseName: null, materials: [] }
  const rows = await releaseRows({ code })
  const [known] = rows.length ? [] : await sql`SELECT course_name FROM canvas_course_bindings WHERE upper(course_code)=${code} ORDER BY last_observed_at DESC LIMIT 1`
  const materials = rows.filter(row => !examsOnly || ['paper', 'solutions'].includes(categoryFor(row)))
    .map(publicMaterial).sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.title.localeCompare(b.title))
  return { courseCode: code, courseName: rows[0]?.course_name || known?.course_name || null, materials }
}

export async function sharedCourseMaterialAsset(assetId, { examsOnly = false } = {}) {
  if (!sql || !/^[A-Za-z0-9_-]{2,160}$/.test(String(assetId || ''))) return null
  const row = (await releaseRows({ assetId }))[0]
  if (!row || (examsOnly && !['paper', 'solutions'].includes(categoryFor(row)))) return null
  return { id: row.asset_id, filename: row.filename, mediaType: row.media_type,
    byteSize: Number(row.byte_size), sha256: row.sha256,
    expectedChunks: Number(row.expected_chunks), localObjectKey: row.metadata?.localObjectKey || null }
}

export async function sharedMaterialIndex(courseCode, query = '') {
  const code = sharedExamCourseCode(courseCode)
  if (!sql || !code) return { courseCode: code, passages: [] }
  const term = String(query || '').trim().slice(0, 120)
  const rows = await sql`SELECT a.filename, b.academic_year, chunk.page_number,
      left(chunk.content, 800) AS excerpt, s.asset_id
    FROM shared_course_material_reviews review
    JOIN canvas_source_snapshots s ON s.id=review.snapshot_id
    JOIN canvas_course_bindings b ON b.id=s.binding_id
    JOIN editorial_source_assets a ON a.id=s.asset_id
    JOIN editorial_contributions contribution ON contribution.id=s.contribution_id
    JOIN canvas_corpus_permissions permission ON permission.user_id=s.contributor_user_id AND permission.origin=b.origin
    JOIN editorial_source_retrieval_chunks chunk ON chunk.asset_id=s.asset_id AND chunk.edition_id=b.edition_id
    WHERE review.status='approved' AND upper(b.course_code)=${code}
      AND s.retired_at IS NULL AND s.sharing_mode='community' AND a.is_complete=true
      AND contribution.consent_status='accepted' AND permission.collection_enabled=true
      AND permission.sharing_mode='community'
      AND (${term}='' OR chunk.search_vector @@ plainto_tsquery('english', ${term}) OR chunk.content ILIKE ${`%${term}%`})
    ORDER BY b.academic_year DESC, a.filename, chunk.page_number NULLS LAST, chunk.chunk_index
    LIMIT 100`
  return { courseCode: code, passages: rows.map(row => ({ title: row.filename,
    academicYear: row.academic_year, page: row.page_number, excerpt: row.excerpt,
    url: `/api/shared-materials/assets/${encodeURIComponent(row.asset_id)}` })) }
}

export async function sharedCourseQuestions(courseCode) {
  const code = sharedExamCourseCode(courseCode)
  if (!sql || !code) return { courseCode: code, questions: [] }
  const rows = await sql`SELECT chapter.name AS chapter_name, question.definition
    FROM editorial_questions question
    JOIN editorial_releases release ON release.id=question.release_id AND release.active=true
    JOIN editorial_courses course ON course.release_id=question.release_id AND course.course_id=question.course_id
    JOIN editorial_chapters chapter ON chapter.release_id=question.release_id AND chapter.course_id=question.course_id AND chapter.chapter_id=question.chapter_id
    WHERE upper(course.code)=${code} ORDER BY chapter.position, question.position LIMIT 300`
  return { courseCode: code, questions: rows.map(row => ({ chapter: row.chapter_name,
    ...row.definition, provenance: 'Wicker practice question' })) }
}

export async function sharedMaterialReviewQueue({ search = '', limit = 2000 } = {}) {
  if (!sql) return []
  const term = `%${String(search).trim().slice(0, 120)}%`
  const rows = await sql`SELECT s.id AS snapshot_id, s.asset_id, s.source_path, s.resource_type,
      a.filename, a.byte_size, a.media_type, b.course_code, b.course_name,
      b.academic_year, b.edition_id, contribution.consent_status,
      review.status AS review_status, review.category AS review_category,
      review.review_note, review.reviewed_at
    FROM canvas_source_snapshots s
    JOIN canvas_course_bindings b ON b.id=s.binding_id
    JOIN editorial_source_assets a ON a.id=s.asset_id
    JOIN editorial_contributions contribution ON contribution.id=s.contribution_id
    JOIN canvas_corpus_permissions permission ON permission.user_id=s.contributor_user_id AND permission.origin=b.origin
    LEFT JOIN shared_course_material_reviews review ON review.snapshot_id=s.id
    WHERE s.retired_at IS NULL AND s.sharing_mode='community' AND a.is_complete=true
      AND permission.collection_enabled=true AND permission.sharing_mode='community'
      AND (${term}='%%' OR b.course_code ILIKE ${term} OR a.filename ILIKE ${term} OR b.academic_year ILIKE ${term})
    ORDER BY b.academic_year DESC, b.course_code, s.last_seen_at DESC LIMIT ${Math.min(2000, Math.max(1, limit))}`
  return rows.map(row => ({ snapshotId: row.snapshot_id, assetId: row.asset_id,
      filename: row.filename, sourcePath: row.source_path, sourceType: row.resource_type,
      category: categoryFor(row), courseCode: row.course_code, courseName: row.course_name,
      academicYear: row.academic_year, editionId: row.edition_id,
      byteSize: Number(row.byte_size), mediaType: row.media_type,
      consentStatus: row.consent_status, status: row.review_status || 'pending',
      note: row.review_note || '', reviewedAt: row.reviewed_at }))
}

export async function reviewSharedCourseMaterials({ items, reviewerId, note, acceptContributions = false, status = 'approved' } = {}) {
  if (!sql) throw Object.assign(new Error('Hosted storage is required.'), { status: 503 })
  if (!['approved', 'withheld'].includes(status)) throw Object.assign(new Error('Invalid review decision.'), { status: 400 })
  const input = Array.isArray(items) ? items : []
  if (!input.length || input.length > 100) throw Object.assign(new Error('Review between 1 and 100 source records at a time.'), { status: 400 })
  const ids = [...new Set(input.map(item => String(item?.snapshotId || '')))]
  if (ids.length !== input.length || ids.some(id => !/^[A-Za-z0-9_-]{2,160}$/.test(id)))
    throw Object.assign(new Error('Choose distinct valid source records.'), { status: 400 })
  const reviewNote = String(note || '').trim().slice(0, 2000)
  if (status === 'approved' && !reviewNote) throw Object.assign(new Error('Record the basis for sharing these originals.'), { status: 400 })
  const rows = await sql`SELECT s.id AS snapshot_id, s.source_path, s.contribution_id,
      a.filename, contribution.consent_status
    FROM canvas_source_snapshots s
    JOIN canvas_course_bindings b ON b.id=s.binding_id
    JOIN editorial_source_assets a ON a.id=s.asset_id
    JOIN editorial_contributions contribution ON contribution.id=s.contribution_id
    JOIN canvas_corpus_permissions permission ON permission.user_id=s.contributor_user_id AND permission.origin=b.origin
    WHERE s.id=ANY(${ids}) AND s.retired_at IS NULL AND s.sharing_mode='community'
      AND permission.collection_enabled=true AND permission.sharing_mode='community' AND a.is_complete=true`
  if (rows.length !== ids.length)
    throw Object.assign(new Error('One or more sources are unavailable.'), { status: 409 })
  if (status === 'approved' && rows.some(row => row.consent_status !== 'accepted' && !(acceptContributions && row.consent_status === 'candidate')))
    throw Object.assign(new Error('Accept or explicitly review each contribution before releasing its original.'), { status: 409 })
  const byId = new Map(rows.map(row => [row.snapshot_id, row]))
  const decisions = input.map(item => {
    const row = byId.get(item.snapshotId)
    const suggested = examMaterialKind({ filename: row.filename, sourcePath: row.source_path }) || 'material'
    const category = ['paper', 'solutions', 'material'].includes(item.category) ? item.category : suggested
    return { snapshot_id: item.snapshotId, category }
  })
  const contributionIds = [...new Set(rows.map(row => row.contribution_id))]
  const queries = []
  if (status === 'approved' && acceptContributions) queries.push(sql`UPDATE editorial_contributions
    SET consent_status='accepted', review_note=${reviewNote}, reviewed_at=now(), reviewed_by=${reviewerId}
    WHERE id=ANY(${contributionIds}) AND consent_status='candidate'`)
  queries.push(sql`INSERT INTO shared_course_material_reviews(snapshot_id,status,category,reviewed_by,review_note,reviewed_at)
    SELECT choice.snapshot_id, ${status}, choice.category, ${reviewerId}, ${reviewNote}, now()
    FROM jsonb_to_recordset(${JSON.stringify(decisions)}::jsonb) AS choice(snapshot_id text, category text)
    ON CONFLICT(snapshot_id) DO UPDATE SET status=excluded.status,category=excluded.category,
      reviewed_by=excluded.reviewed_by,review_note=excluded.review_note,reviewed_at=now()`)
  await sql.transaction(queries)
  return { reviewed: rows.length, status }
}
