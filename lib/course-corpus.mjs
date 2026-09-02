import { createHash, randomUUID } from 'node:crypto'
import { sql } from './db.mjs'

const clean = (value, max = 300) => String(value ?? '').replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const slug = (value) => clean(value, 180).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const digest = (value, length = 24) => createHash('sha256').update(String(value)).digest('hex').slice(0, length)

export function academicYearFromCanvasCourse(course = {}) {
  const candidates = [course.term?.name, course.name, course.courseCode]
  for (const candidate of candidates) {
    const match = clean(candidate).match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/)
    if (match) return `${match[1]}-${match[2]}`
  }
  const date = course.term?.startAt || course.startAt
  if (!date) return ''
  const at = new Date(date)
  if (Number.isNaN(at.getTime())) return ''
  const first = at.getUTCMonth() >= 7 ? at.getUTCFullYear() : at.getUTCFullYear() - 1
  return `${first}-${first + 1}`
}

export function periodFromCanvasCourse(course = {}) {
  const source = [course.term?.name, course.name].map((value) => clean(value)).join(' ')
  const coded = source.match(/20\d{2}\s*[-/]\s*20\d{2}\s*[-–—]\s*(100|200|400|500)\b/)
  if (coded) return ({ 100: '1', 200: '2', 400: '4', 500: '5' })[coded[1]]
  const named = source.match(/\b(?:period|block)\s*([1-6])\b/i)
  return named?.[1] || ''
}

export function canonicalCanvasCourse({ origin, course } = {}) {
  const host = new URL(origin).hostname.toLowerCase()
  const code = clean(course?.courseCode, 80).toUpperCase()
  const name = clean(course?.displayName || course?.name, 300) || `Canvas course ${clean(course?.id, 80)}`
  // Course codes are stable across yearly Canvas shells. If Canvas has no code,
  // the normalized display name is the least surprising stable fallback.
  const identity = code || slug(name)
  const canonicalCourseId = `${slug(host)}:${slug(identity)}`
  const academicYear = academicYearFromCanvasCourse(course)
  const period = periodFromCanvasCourse(course)
  const editionKey = [canonicalCourseId, academicYear || 'undated', period || 'all'].join(':')
  return {
    canonicalCourseId,
    editionId: `canvas-ed-${digest(editionKey)}`,
    editionKey,
    courseCode: code,
    courseName: name,
    academicYear,
    period,
    institution: host,
    termName: clean(course?.term?.name, 300)
  }
}

// Current and upcoming courses are always synced. Older Canvas shells for the
// same stable course code are included too, so missing material in a new shell
// can be answered from a clearly labelled prior edition.
export function selectCanvasCorpusCourses(courses = []) {
  const active = courses.filter((course) => course.current || course.upcoming)
  const activeCodes = new Set(active.map((course) => clean(course.courseCode, 80).toUpperCase()).filter(Boolean))
  return courses.filter((course) => course.current || course.upcoming || activeCodes.has(clean(course.courseCode, 80).toUpperCase()))
}

export function retrievalEditionOrder(editions = [], { academicYear = '', includeHistorical = true } = {}) {
  const requested = clean(academicYear, 20)
  return [...editions]
    .filter((edition) => !requested || edition.academicYear === requested || includeHistorical)
    .sort((left, right) => {
      const leftExact = requested && left.academicYear === requested ? 1 : 0
      const rightExact = requested && right.academicYear === requested ? 1 : 0
      if (leftExact !== rightExact) return rightExact - leftExact
      return String(right.academicYear || '').localeCompare(String(left.academicYear || ''))
    })
}

export async function enqueueCanvasCatalogSync({ accountId, origin, force = false } = {}) {
  if (!sql) return { queued: false, mode: 'local', reason: 'Shared Canvas corpus requires DATABASE_URL.' }
  const user = clean(accountId, 200)
  const host = new URL(origin).origin
  if (!user) throw new Error('accountId is required')
  if (force) await sql`UPDATE canvas_sync_jobs SET status='cancelled', finished_at=now() WHERE user_id=${user} AND origin=${host} AND job_type='catalog' AND status='pending'`
  const rows = await sql`INSERT INTO canvas_sync_jobs (id, user_id, origin, job_type, priority, payload)
    VALUES (${`csj-${randomUUID()}`}, ${user}, ${host}, 'catalog', 100, ${JSON.stringify({ force })}::jsonb)
    ON CONFLICT DO NOTHING RETURNING id, status, created_at`
  if (rows.length) return { queued: true, jobId: rows[0].id, status: rows[0].status, createdAt: rows[0].created_at }
  const [existing] = await sql`SELECT id, status, created_at FROM canvas_sync_jobs WHERE user_id=${user} AND origin=${host} AND job_type='catalog' AND status IN ('pending','running') ORDER BY created_at DESC LIMIT 1`
  return { queued: false, deduplicated: true, jobId: existing?.id || null, status: existing?.status || null }
}

export async function canvasCorpusPermission({ accountId, origin } = {}) {
  if (!sql) return { collectionEnabled: false, sharingMode: 'private', mode: 'local' }
  const [row] = await sql`SELECT collection_enabled, sharing_mode, consent_version, consented_at, revoked_at, updated_at
    FROM canvas_corpus_permissions WHERE user_id=${accountId} AND origin=${new URL(origin).origin}`
  return row ? {
    collectionEnabled: row.collection_enabled,
    sharingMode: row.sharing_mode,
    consentVersion: row.consent_version,
    consentedAt: row.consented_at,
    revokedAt: row.revoked_at,
    updatedAt: row.updated_at
  } : { collectionEnabled: false, sharingMode: 'private', consentVersion: 'v1', consentedAt: null, revokedAt: null }
}

export async function setCanvasCorpusPermission({ accountId, origin, collectionEnabled, sharingMode = 'private' } = {}) {
  if (!sql) return { collectionEnabled: Boolean(collectionEnabled), sharingMode: sharingMode === 'community' ? 'community' : 'private', mode: 'local' }
  const host = new URL(origin).origin
  const enabled = collectionEnabled === true
  const mode = sharingMode === 'community' ? 'community' : 'private'
  await sql`INSERT INTO canvas_corpus_permissions
    (user_id, origin, collection_enabled, sharing_mode, consent_version, consented_at, revoked_at, updated_at)
    VALUES (${accountId}, ${host}, ${enabled}, ${mode}, 'v1', ${enabled ? new Date().toISOString() : null}::timestamptz, ${enabled ? null : new Date().toISOString()}::timestamptz, now())
    ON CONFLICT (user_id, origin) DO UPDATE SET collection_enabled=excluded.collection_enabled, sharing_mode=excluded.sharing_mode,
      consent_version='v1', consented_at=CASE WHEN excluded.collection_enabled THEN now() ELSE canvas_corpus_permissions.consented_at END,
      revoked_at=CASE WHEN excluded.collection_enabled THEN null ELSE now() END, updated_at=now()`
  await sql`UPDATE canvas_source_snapshots s SET sharing_mode=${mode}
    FROM canvas_course_bindings b WHERE s.binding_id=b.id AND b.origin=${host} AND s.contributor_user_id=${accountId}`
  if (mode === 'community' && enabled) {
    await sql`UPDATE editorial_contributions SET consent_status='candidate', reviewed_at=null, reviewed_by=null
      WHERE contributor_user_id=${accountId} AND id IN (SELECT contribution_id FROM canvas_source_snapshots WHERE contributor_user_id=${accountId}) AND consent_status='private'`
  } else {
    await sql`UPDATE editorial_contributions SET consent_status=CASE WHEN consent_status='accepted' THEN 'withdrawn' ELSE 'private' END,
      reviewed_at=CASE WHEN consent_status='accepted' THEN now() ELSE reviewed_at END,
      review_note=CASE WHEN consent_status='accepted' THEN concat_ws(E'\n', nullif(review_note,''), 'Contributor withdrew community sharing permission.') ELSE review_note END
      WHERE contributor_user_id=${accountId} AND id IN (SELECT contribution_id FROM canvas_source_snapshots WHERE contributor_user_id=${accountId}) AND consent_status IN ('candidate','accepted')`
  }
  if (!enabled) {
    await sql`UPDATE canvas_sync_jobs SET status='cancelled', finished_at=now(), error='Collection permission was revoked.'
      WHERE user_id=${accountId} AND origin=${host} AND status='pending'`
    return canvasCorpusPermission({ accountId, origin: host })
  }
  const permission = await canvasCorpusPermission({ accountId, origin: host })
  const sync = await enqueueCanvasCatalogSync({ accountId, origin: host, force: true })
  return { ...permission, sync }
}

export async function observeCanvasCorpusCourses({ accountId, origin, courses = [] } = {}) {
  if (!sql) return { observed: 0, queued: 0, mode: 'local' }
  const permission = await canvasCorpusPermission({ accountId, origin })
  if (!permission.collectionEnabled) return { observed: 0, queued: 0, consentRequired: true }
  const selected = selectCanvasCorpusCourses(courses)
  let queued = 0
  for (const course of selected) {
    const identity = canonicalCanvasCourse({ origin, course })
    await sql`INSERT INTO editorial_course_editions
      (id, canonical_course_id, institution, course_code, course_name, academic_year, period, edition_key, status, created_by, updated_at)
      VALUES (${identity.editionId}, ${identity.canonicalCourseId}, ${identity.institution}, ${identity.courseCode}, ${identity.courseName}, ${identity.academicYear}, ${identity.period}, ${identity.editionKey}, 'draft', ${accountId}, now())
      ON CONFLICT (edition_key) DO UPDATE SET course_code=excluded.course_code, course_name=excluded.course_name, updated_at=now()`
    const bindingId = `ccb-${digest(`${origin}:${course.id}`)}`
    await sql`INSERT INTO canvas_course_bindings
      (id, origin, canvas_course_id, edition_id, canonical_course_id, course_code, course_name, academic_year, period, term_name, last_observed_at, updated_at)
      VALUES (${bindingId}, ${origin}, ${String(course.id)}, ${identity.editionId}, ${identity.canonicalCourseId}, ${identity.courseCode}, ${identity.courseName}, ${identity.academicYear}, ${identity.period}, ${identity.termName}, now(), now())
      ON CONFLICT (origin, canvas_course_id) DO UPDATE SET edition_id=excluded.edition_id, canonical_course_id=excluded.canonical_course_id, course_code=excluded.course_code, course_name=excluded.course_name, academic_year=excluded.academic_year, period=excluded.period, term_name=excluded.term_name, last_observed_at=now(), updated_at=now()`
    await sql`INSERT INTO canvas_corpus_access (user_id, binding_id, first_observed_at, last_observed_at, sharing_mode)
      VALUES (${accountId}, ${bindingId}, now(), now(), ${permission.sharingMode}) ON CONFLICT (user_id, binding_id) DO UPDATE SET last_observed_at=now(), sharing_mode=excluded.sharing_mode`
    const rows = await sql`INSERT INTO canvas_sync_jobs (id, user_id, origin, binding_id, job_type, priority, payload)
      SELECT ${`csj-${randomUUID()}`}, ${accountId}, ${origin}, ${bindingId}, 'course', ${course.current ? 80 : course.upcoming ? 70 : 20}, ${JSON.stringify({ canvasCourseId: String(course.id) })}::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM canvas_course_bindings b WHERE b.id=${bindingId} AND b.last_synced_at IS NOT NULL AND b.next_sync_at > now()
      ) ON CONFLICT DO NOTHING RETURNING id`
    queued += rows.length
  }
  return { observed: selected.length, queued }
}

export async function canvasCorpusStatus({ accountId } = {}) {
  if (!sql) return { mode: 'local', available: false, courses: [], jobs: [] }
  const courses = await sql`SELECT b.id, b.course_code, b.course_name, b.academic_year, b.period, b.last_synced_at, b.next_sync_at,
      (SELECT count(*)::int FROM canvas_source_snapshots s WHERE s.binding_id=b.id AND s.retired_at IS NULL) AS sources
    FROM canvas_corpus_access a JOIN canvas_course_bindings b ON b.id=a.binding_id
    WHERE a.user_id=${accountId} ORDER BY b.academic_year DESC, b.course_code`
  const jobs = await sql`SELECT id, binding_id, job_type, status, attempts, error, created_at, started_at, finished_at
    FROM canvas_sync_jobs WHERE user_id=${accountId} ORDER BY created_at DESC LIMIT 50`
  return {
    mode: 'neon',
    available: true,
    courses: courses.map((row) => ({ id: row.id, courseCode: row.course_code, courseName: row.course_name, academicYear: row.academic_year, period: row.period, sources: Number(row.sources), lastSyncedAt: row.last_synced_at, nextSyncAt: row.next_sync_at })),
    jobs: jobs.map((row) => ({ id: row.id, bindingId: row.binding_id, type: row.job_type, status: row.status, attempts: row.attempts, error: row.error, createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at }))
  }
}
