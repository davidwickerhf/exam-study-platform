import { sql } from './db.mjs'
import { examMaterialKind, sharedExamCourseCode } from './shared-exam-policy.mjs'

export { examMaterialKind, sharedExamCourseCode } from './shared-exam-policy.mjs'

function publicPaper(row) {
  return {
    id: row.snapshot_id,
    title: row.filename,
    kind: examMaterialKind({ filename: row.filename, sourcePath: row.source_path }),
    academicYear: row.academic_year,
    period: row.period,
    byteSize: Number(row.byte_size),
    url: `/api/shared-exam-papers/assets/${encodeURIComponent(row.asset_id)}`,
    downloadUrl: `/api/shared-exam-papers/assets/${encodeURIComponent(row.asset_id)}?download=1`
  }
}

// The same live checks guard both the index and every byte request. A revoked
// contribution, collection permission or retired snapshot disappears at once.
const releaseRows = ({ code = '', assetId = '' } = {}) => sql`SELECT DISTINCT ON (b.academic_year, s.asset_id)
    s.id AS snapshot_id, s.asset_id, s.source_path, a.filename, a.media_type,
    a.byte_size, a.sha256, a.expected_chunks, a.metadata, b.course_code,
    b.course_name, b.academic_year, b.period
  FROM shared_exam_paper_reviews review
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
  ORDER BY b.academic_year DESC, s.asset_id, s.last_seen_at DESC`

export async function publishedExamPapers(courseCode) {
  const code = sharedExamCourseCode(courseCode)
  if (!code || !sql) return { courseCode: code, courseName: null, papers: [] }
  const rows = (await releaseRows({ code })).filter(row => examMaterialKind({ filename: row.filename, sourcePath: row.source_path }))
  const [known] = rows.length ? [] : await sql`SELECT course_name FROM canvas_course_bindings WHERE upper(course_code)=${code} ORDER BY last_observed_at DESC LIMIT 1`
  return { courseCode: code, courseName: rows[0]?.course_name || known?.course_name || null,
    papers: rows.map(publicPaper).sort((a,b) => b.academicYear.localeCompare(a.academicYear) || a.title.localeCompare(b.title)) }
}

export async function sharedExamAsset(assetId) {
  if (!sql || !/^[A-Za-z0-9_-]{2,160}$/.test(String(assetId || ''))) return null
  const row = (await releaseRows({ assetId }))[0]
  if (!row || !examMaterialKind({ filename: row.filename, sourcePath: row.source_path })) return null
  return { id: row.asset_id, filename: row.filename, mediaType: row.media_type,
    byteSize: Number(row.byte_size), sha256: row.sha256,
    expectedChunks: Number(row.expected_chunks), localObjectKey: row.metadata?.localObjectKey || null }
}

export async function examPaperReviewQueue({ limit = 2000 } = {}) {
  if (!sql) return []
  const rows = await sql`SELECT s.id AS snapshot_id, s.asset_id, s.source_path, s.contributor_user_id,
    a.filename, a.byte_size, a.media_type, b.course_code, b.course_name, b.academic_year,
    b.period, b.edition_id, contribution.consent_status, review.status AS review_status,
    review.review_note, review.reviewed_at
    FROM canvas_source_snapshots s
    JOIN canvas_course_bindings b ON b.id=s.binding_id
    JOIN editorial_source_assets a ON a.id=s.asset_id
    JOIN editorial_contributions contribution ON contribution.id=s.contribution_id
    JOIN canvas_corpus_permissions permission ON permission.user_id=s.contributor_user_id AND permission.origin=b.origin
    LEFT JOIN shared_exam_paper_reviews review ON review.snapshot_id=s.id
    WHERE s.retired_at IS NULL AND s.sharing_mode='community' AND a.is_complete=true
      AND permission.collection_enabled=true AND permission.sharing_mode='community'
      AND lower(a.filename) LIKE '%.pdf'
      AND (a.filename ~* 'exam|paper|question|solution|answer|marking|rubric|midterm|resit|mock'
        OR s.source_path ~* 'exam|paper|midterm|resit|mock')
    ORDER BY b.academic_year DESC, b.course_code, s.last_seen_at DESC LIMIT ${Math.min(2000, Math.max(1, limit))}`
  return rows.filter(row => examMaterialKind({ filename: row.filename, sourcePath: row.source_path }))
    .map(row => ({ snapshotId: row.snapshot_id, assetId: row.asset_id,
      filename: row.filename, sourcePath: row.source_path,
      kind: examMaterialKind({ filename: row.filename, sourcePath: row.source_path }),
      byteSize: Number(row.byte_size), courseCode: row.course_code, courseName: row.course_name,
      academicYear: row.academic_year, period: row.period, editionId: row.edition_id,
      consentStatus: row.consent_status, status: row.review_status || 'pending',
      note: row.review_note || '', reviewedAt: row.reviewed_at }) )
}

export async function reviewExamPaper({ snapshotId, status, reviewerId, note = '' }) {
  if (!sql) throw Object.assign(new Error('Hosted storage is required.'), { status: 503 })
  if (!['approved', 'withheld'].includes(status) || !/^[A-Za-z0-9_-]{2,160}$/.test(String(snapshotId || '')))
    throw Object.assign(new Error('Choose a valid paper and review decision.'), { status: 400 })
  const [row] = await sql`SELECT s.id, s.source_path, a.filename, contribution.consent_status
    FROM canvas_source_snapshots s
    JOIN editorial_source_assets a ON a.id=s.asset_id
    JOIN editorial_contributions contribution ON contribution.id=s.contribution_id
    JOIN canvas_course_bindings b ON b.id=s.binding_id
    JOIN canvas_corpus_permissions permission ON permission.user_id=s.contributor_user_id AND permission.origin=b.origin
    WHERE s.id=${snapshotId} AND s.retired_at IS NULL AND s.sharing_mode='community'
      AND permission.collection_enabled=true AND permission.sharing_mode='community' AND a.is_complete=true`
  if (!row || !examMaterialKind({ filename: row.filename, sourcePath: row.source_path }))
    throw Object.assign(new Error('This exam paper is not eligible for review.'), { status: 404 })
  if (status === 'approved' && row.consent_status !== 'accepted')
    throw Object.assign(new Error('Accept the contribution rights review before releasing its original.'), { status: 409 })
  if (status === 'approved' && !String(note).trim())
    throw Object.assign(new Error('Record the basis for sharing this original with Maastricht members.'), { status: 400 })
  await sql`INSERT INTO shared_exam_paper_reviews(snapshot_id,status,reviewed_by,review_note,reviewed_at)
    VALUES(${snapshotId},${status},${reviewerId},${String(note).trim().slice(0,2000)},now())
    ON CONFLICT(snapshot_id) DO UPDATE SET status=excluded.status,reviewed_by=excluded.reviewed_by,
      review_note=excluded.review_note,reviewed_at=now()`
  return { snapshotId, status }
}
