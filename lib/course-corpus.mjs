import { createHash, randomUUID } from 'node:crypto'
import { sql } from './db.mjs'
import { loadEditorialProgrammeCatalogue } from './editorial-programmes.mjs'

const clean = (value, max = 300) => String(value ?? '').replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const slug = (value) => clean(value, 180).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const digest = (value, length = 24) => createHash('sha256').update(String(value)).digest('hex').slice(0, length)

let supportedCourseCodes = null
function supportedCodes() {
  if (!supportedCourseCodes) {
    supportedCourseCodes = new Set(loadEditorialProgrammeCatalogue().programmes.flatMap((programme) =>
      programme.versions.flatMap((version) => version.courses.map((course) => clean(course.code, 40).toUpperCase()))
    ).filter(Boolean))
  }
  return supportedCourseCodes
}

// Canvas also enrolls students in faculty announcements, communication hubs,
// communities and programme shells. Their enrollment is "active" but they are
// not academic courses and must never enter the material corpus. Resolve a
// course code from the Canvas code/name, then require it to exist in one of the
// maintained programmes Wicker actually offers.
export function supportedCanvasCourseCode(course = {}) {
  const catalogue = supportedCodes()
  for (const candidate of [course.courseCode, course.displayName, course.name]) {
    const matches = clean(candidate, 400).toUpperCase().match(/[A-Z]{2,4}[\s-]*\d{3,5}[A-Z]?/g) || []
    for (const match of matches) {
      const normalized = match.replace(/[\s-]/g, '')
      if (catalogue.has(normalized)) return normalized
    }
  }
  return ''
}

export function isSupportedCanvasCourse(course = {}) {
  return Boolean(supportedCanvasCourseCode(course))
}

export function academicYearFromCanvasCourse(course = {}) {
  const candidates = [course.term?.name, course.name, course.courseCode]
  for (const candidate of candidates) {
    const match = clean(candidate).match(/\b(20\d{2})\s*[-–—/]\s*(20\d{2})\b/)
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
  const academic = courses.map((course) => {
    const courseCode = supportedCanvasCourseCode(course)
    return courseCode ? { ...course, courseCode } : null
  }).filter(Boolean)
  const active = academic.filter((course) => course.current || course.upcoming)
  const activeCodes = new Set(active.map((course) => clean(course.courseCode, 80).toUpperCase()).filter(Boolean))
  return academic.filter((course) => course.current || course.upcoming || activeCodes.has(clean(course.courseCode, 80).toUpperCase()))
}

export function selectScheduledCanvasCourses(courses = [], { academicYear = '', periodNumber = null, now = new Date() } = {}) {
  const year = academicYear || `${now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1}-${now.getUTCMonth() >= 7 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()}`
  const latest = new Map()
  for (const course of courses) {
    const code = supportedCanvasCourseCode(course), edition = academicYearFromCanvasCourse(course), period = periodFromCanvasCourse(course)
    if (!code || !course.current || (edition && edition !== year) || (periodNumber && period && Number(period) !== Number(periodNumber))) continue
    const prior = latest.get(code)
    if (!prior || edition > academicYearFromCanvasCourse(prior) || (edition === academicYearFromCanvasCourse(prior) && String(course.id).localeCompare(String(prior.id), undefined, { numeric: true }) > 0)) latest.set(code, { ...course, courseCode: code })
  }
  return [...latest.values()]
}

export async function retireUnsupportedCanvasCorpusCourses({ accountId, origin, courses = [] } = {}) {
  if (!sql) return { retired: 0, cancelled: 0, mode: 'local' }
  const canvasCourseIds = [...new Set(courses.filter((course) => !isSupportedCanvasCourse(course)).map((course) => String(course?.id || '')).filter(Boolean))]
  if (!canvasCourseIds.length) return { retired: 0, cancelled: 0 }
  const bindings = await sql`SELECT id FROM canvas_course_bindings
    WHERE origin=${new URL(origin).origin} AND canvas_course_id=ANY(${canvasCourseIds}::text[])`
  const bindingIds = bindings.map((row) => row.id)
  if (!bindingIds.length) return { retired: 0, cancelled: 0 }
  const cancelled = await sql`UPDATE canvas_sync_jobs SET status='cancelled', finished_at=now(), error='Ignored because this Canvas space is not a supported academic course.'
    WHERE user_id=${accountId} AND binding_id=ANY(${bindingIds}::text[]) AND status='pending' RETURNING id`
  await sql`UPDATE canvas_source_snapshots SET retired_at=now()
    WHERE contributor_user_id=${accountId} AND binding_id=ANY(${bindingIds}::text[]) AND retired_at IS NULL`
  const retired = await sql`DELETE FROM canvas_corpus_access
    WHERE user_id=${accountId} AND binding_id=ANY(${bindingIds}::text[]) RETURNING binding_id`
  return { retired: retired.length, cancelled: cancelled.length }
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

/**
 * Canvas creates a new shell when a student retakes a course. The shell is an
 * edition, not another logical course. Collapse those shells for course-level
 * consumers while retaining the complete edition ledger for provenance.
 *
 * `sourceAssetIds` is an internal counting aid. Assets are content-addressed,
 * so taking the union avoids counting an unchanged handout twice merely
 * because it appeared in two yearly shells.
 */
export function aggregateCanvasCourseEditions(editions = []) {
  const groups = new Map()
  for (const raw of editions) {
    const courseCode = clean(raw?.courseCode, 80).toUpperCase()
    const canonicalCourseId = clean(raw?.canonicalCourseId, 240) || courseCode
    if (!canonicalCourseId && !courseCode) continue
    const key = canonicalCourseId || courseCode
    const edition = {
      id: raw.id,
      origin: raw.origin,
      canvasCourseId: raw.canvasCourseId,
      editionId: raw.editionId || null,
      courseCode,
      courseName: clean(raw.courseName, 300) || courseCode,
      academicYear: clean(raw.academicYear, 20),
      period: clean(raw.period, 20),
      sources: Math.max(0, Number(raw.sources) || 0),
      lastSyncedAt: raw.lastSyncedAt || null,
      nextSyncAt: raw.nextSyncAt || null
    }
    const held = groups.get(key) || { canonicalCourseId, courseCode, editions: [], sourceAssetIds: new Set(), fallbackSources: 0 }
    held.editions.push(edition)
    held.fallbackSources += edition.sources
    for (const assetId of Array.isArray(raw.sourceAssetIds) ? raw.sourceAssetIds : []) {
      if (assetId) held.sourceAssetIds.add(String(assetId))
    }
    groups.set(key, held)
  }

  return [...groups.values()].map((group) => {
    const editions = retrievalEditionOrder(group.editions)
    const latest = editions[0]
    const synced = editions.map((edition) => edition.lastSyncedAt).filter(Boolean).sort().at(-1) || null
    const next = editions.map((edition) => edition.nextSyncAt).filter(Boolean).sort().at(0) || null
    return {
      id: group.canonicalCourseId,
      canonicalCourseId: group.canonicalCourseId,
      courseCode: latest?.courseCode || group.courseCode,
      courseName: latest?.courseName || group.courseCode,
      academicYear: latest?.academicYear || '',
      period: latest?.period || '',
      academicYears: [...new Set(editions.map((edition) => edition.academicYear).filter(Boolean))],
      editionCount: editions.length,
      sources: group.sourceAssetIds.size || group.fallbackSources,
      lastSyncedAt: synced,
      nextSyncAt: next,
      editions
    }
  }).sort((left, right) => left.courseCode.localeCompare(right.courseCode))
}

export async function enqueueCanvasCatalogSync({ accountId, origin, force = false } = {}) {
  if (!sql) return { queued: false, mode: 'local', reason: 'Shared Canvas corpus requires DATABASE_URL.' }
  const user = clean(accountId, 200)
  const host = new URL(origin).origin
  if (!user) throw new Error('accountId is required')
  if (force) await sql`UPDATE canvas_sync_jobs SET status='cancelled', finished_at=now() WHERE user_id=${user} AND origin=${host} AND job_type='catalog' AND status='pending'`
  const syncId = `css-${randomUUID()}`
  const rows = await sql`INSERT INTO canvas_sync_jobs (id, user_id, origin, job_type, priority, payload)
    VALUES (${`csj-${randomUUID()}`}, ${user}, ${host}, 'catalog', 100, ${JSON.stringify({ force, syncId })}::jsonb)
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

export async function observeCanvasCorpusCourses({ accountId, origin, courses = [], explicit = false, force = false, syncId = '', automatic = false, timeContext = null, refreshPolicy = false } = {}) {
  if (!sql) return { observed: 0, queued: 0, mode: 'local' }
  const permission = await canvasCorpusPermission({ accountId, origin })
  if (!permission.collectionEnabled) return { observed: 0, queued: 0, consentRequired: true }
  const selected = explicit
    ? courses.map((course) => {
      const courseCode = supportedCanvasCourseCode(course)
      return courseCode ? { ...course, courseCode } : null
    }).filter(Boolean)
    : automatic ? selectScheduledCanvasCourses(courses, timeContext || {}) : selectCanvasCorpusCourses(courses)
  const ignored = courses.filter((course) => (explicit || course.current || course.upcoming) && !isSupportedCanvasCourse(course))
  const retired = await retireUnsupportedCanvasCorpusCourses({ accountId, origin, courses: ignored })
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
    if (force || explicit) await sql`UPDATE canvas_corpus_access SET sync_paused=false WHERE user_id=${accountId} AND binding_id=${bindingId}`
    if (force) await sql`UPDATE canvas_sync_jobs SET status='cancelled', finished_at=now(), error='Superseded by an explicit material refresh.'
      WHERE user_id=${accountId} AND binding_id=${bindingId} AND status='pending'`
    const rows = await sql`INSERT INTO canvas_sync_jobs (id, user_id, origin, binding_id, job_type, priority, payload)
      SELECT ${`csj-${randomUUID()}`}, ${accountId}, ${origin}, ${bindingId}, 'course', ${explicit ? 120 : course.current ? 80 : course.upcoming ? 70 : 20}, ${JSON.stringify({ canvasCourseId: String(course.id), explicit, force, scheduled: automatic, syncId: syncId || null })}::jsonb
      WHERE EXISTS (SELECT 1 FROM canvas_corpus_access a WHERE a.user_id=${accountId} AND a.binding_id=${bindingId} AND a.sync_paused=false) AND NOT EXISTS (
        SELECT 1 FROM canvas_course_bindings b WHERE b.id=${bindingId} AND ${!force} AND b.last_synced_at IS NOT NULL AND b.next_sync_at > now()
      ) ON CONFLICT DO NOTHING RETURNING id`
    queued += rows.length
  }
  if (refreshPolicy) {
    const ids = selectScheduledCanvasCourses(courses, timeContext || {}).map(course => String(course.id))
    await sql`UPDATE canvas_corpus_access access SET auto_refresh=(binding.canvas_course_id=ANY(${ids}::text[]))
      FROM canvas_course_bindings binding WHERE binding.id=access.binding_id AND access.user_id=${accountId} AND binding.origin=${origin}`
    await sql`UPDATE canvas_sync_jobs job SET status='cancelled',finished_at=now(),error='Automatic refresh now follows the latest current-period edition.'
      WHERE job.user_id=${accountId} AND job.origin=${origin} AND job.status='pending' AND job.payload->>'scheduled'='true' AND job.binding_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM canvas_corpus_access access WHERE access.user_id=job.user_id AND access.binding_id=job.binding_id AND access.auto_refresh=true)`
  }
  return { observed: selected.length, queued, ignored: ignored.length, retired: retired.retired, cancelled: retired.cancelled }
}

export async function enqueueCanvasCourseSync({ accountId, origin, course, force = true } = {}) {
  if (!course?.id) throw new Error('Choose a Canvas course to archive.')
  return observeCanvasCorpusCourses({ accountId, origin: new URL(origin).origin, courses: [course], explicit: true, force, syncId: `css-${randomUUID()}` })
}

export async function canvasCorpusStatus({ accountId, summary = false } = {}) {
  if (!sql) return { mode: 'local', available: false, courses: [], jobs: [] }
  const coursesRead = sql`SELECT b.id, b.origin, b.canvas_course_id, b.edition_id, b.canonical_course_id, b.course_code, b.course_name, b.academic_year, b.period, b.last_synced_at, b.next_sync_at,
      (SELECT count(DISTINCT s.asset_id)::int FROM canvas_source_snapshots s WHERE s.binding_id=b.id AND s.retired_at IS NULL
        AND (s.contributor_user_id=${accountId} OR (s.sharing_mode='community' AND EXISTS (
          SELECT 1 FROM editorial_contributions accepted WHERE accepted.id=s.contribution_id AND accepted.consent_status='accepted'
        )))) AS sources,
      ARRAY(SELECT DISTINCT s.asset_id FROM canvas_source_snapshots s WHERE s.binding_id=b.id AND s.retired_at IS NULL
        AND (s.contributor_user_id=${accountId} OR (s.sharing_mode='community' AND EXISTS (
          SELECT 1 FROM editorial_contributions accepted WHERE accepted.id=s.contribution_id AND accepted.consent_status='accepted'
        )))) AS source_asset_ids
    FROM canvas_corpus_access a JOIN canvas_course_bindings b ON b.id=a.binding_id
    WHERE a.user_id=${accountId} ORDER BY b.academic_year DESC, b.course_code`
  const jobsRead = sql`SELECT j.id, j.origin, j.binding_id, j.job_type, j.status, j.attempts, j.payload, j.result, j.error, j.run_after, j.created_at, j.started_at, j.finished_at,
      b.course_code, b.course_name, b.academic_year
    FROM canvas_sync_jobs j LEFT JOIN canvas_course_bindings b ON b.id=j.binding_id
    WHERE j.user_id=${accountId} AND (${!summary} OR j.job_type='catalog') AND (j.job_type='catalog' OR EXISTS (
      SELECT 1 FROM canvas_corpus_access access WHERE access.user_id=${accountId} AND access.binding_id=j.binding_id
    )) ORDER BY j.created_at DESC LIMIT ${summary ? 1 : 100}`
  // Keep durable progress for every accessible edition, independent of the
  // bounded run-history list (one busy course can otherwise fill all 100 rows).
  const latestJobsRead = sql`SELECT DISTINCT ON (j.binding_id) j.id, j.origin, j.binding_id, j.job_type, j.status, j.attempts, j.payload, j.result, j.error, j.created_at, j.started_at, j.finished_at,
      b.course_code, b.course_name, b.academic_year
    FROM canvas_sync_jobs j JOIN canvas_course_bindings b ON b.id=j.binding_id
    JOIN canvas_corpus_access a ON a.binding_id=j.binding_id AND a.user_id=j.user_id
    WHERE j.user_id=${accountId} AND j.job_type='course'
    ORDER BY j.binding_id, j.created_at DESC, j.id DESC`

  const [courses, jobs, latestJobs] = await Promise.all([coursesRead, jobsRead, latestJobsRead])
  return {
    mode: 'neon',
    available: true,
    courses: aggregateCanvasCourseEditions(courses.map((row) => ({
      id: row.id,
      origin: row.origin,
      canvasCourseId: row.canvas_course_id,
      editionId: row.edition_id,
      canonicalCourseId: row.canonical_course_id,
      courseCode: row.course_code,
      courseName: row.course_name,
      academicYear: row.academic_year,
      period: row.period,
      sources: Number(row.sources),
      sourceAssetIds: row.source_asset_ids,
      lastSyncedAt: row.last_synced_at,
      nextSyncAt: row.next_sync_at
    }))),
    latestJobs: latestJobs.map((row) => ({ id: row.id, bindingId: row.binding_id, syncId: row.payload?.syncId || row.id, origin: row.origin, type: row.job_type, status: row.status, attempts: row.attempts, result: row.result || {}, error: row.error, courseCode: row.course_code, courseName: row.course_name, academicYear: row.academic_year, createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at })),
    jobs: jobs.map((row) => ({ id: row.id, syncId: row.payload?.syncId || row.id, origin: row.origin, bindingId: row.binding_id, type: row.job_type, status: row.status, attempts: row.attempts, result: row.result || {}, error: row.error, courseCode: row.course_code, courseName: row.course_name, academicYear: row.academic_year, runAfter: row.run_after, createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at }))
  }
}

// A retry is a new audited job for exactly one owned course binding. Revoking
// the old lease prevents its worker from completing over the replacement.
export async function controlCanvasSyncJob({ accountId, jobId, action, database = sql } = {}) {
  if (!['stop', 'retry'].includes(action)) throw new Error('Choose Stop or Retry for this sync.')
  if (!database) throw new Error('Individual sync controls require hosted material collection.')
  const [job] = await database`SELECT j.* FROM canvas_sync_jobs j
    JOIN canvas_corpus_access a ON a.binding_id=j.binding_id AND a.user_id=j.user_id
    WHERE j.id=${jobId} AND j.user_id=${accountId} AND j.job_type='course'`
  if (!job) throw new Error('That course sync was not found in your account.')
  if (action === 'retry') {
    const [permission] = await database`SELECT collection_enabled FROM canvas_corpus_permissions WHERE user_id=${accountId} AND origin=${job.origin}`
    if (!permission?.collection_enabled) throw new Error('Enable material collection in Connections before retrying.')
  }
  const queries = [database`UPDATE canvas_corpus_access SET sync_paused=${action === 'stop'} WHERE user_id=${accountId} AND binding_id=${job.binding_id}`, database`UPDATE canvas_sync_jobs SET status='cancelled', error='Stopped by the student.', finished_at=now(), lease_token=null, heartbeat_at=null
    WHERE id=${jobId} AND user_id=${accountId} AND status IN ('pending', 'running') RETURNING id`]
  const nextId = `csj-${randomUUID()}`
  if (action === 'retry') queries.push(database`INSERT INTO canvas_sync_jobs (id, user_id, origin, binding_id, job_type, priority, payload)
    SELECT ${nextId}, j.user_id, j.origin, j.binding_id, 'course', 120,
      ${JSON.stringify({ ...job.payload, force: true, retryOf: job.id, syncId: `css-${randomUUID()}` })}::jsonb
    FROM canvas_sync_jobs j
    JOIN canvas_corpus_access a ON a.binding_id=j.binding_id AND a.user_id=j.user_id
    JOIN canvas_corpus_permissions p ON p.user_id=j.user_id AND p.origin=j.origin AND p.collection_enabled=true
    WHERE j.id=${jobId} AND j.user_id=${accountId}
    ON CONFLICT DO NOTHING RETURNING id`)
  const results = await database.transaction(queries)
  return { action, stopped: results[1].length > 0, queued: action === 'retry' && results[2].length > 0, jobId: results[2]?.[0]?.id || jobId }
}

export async function cancelPendingCanvasSyncs({ accountId, origin } = {}) {
  if (!sql) return { cancelled: 0, mode: 'local' }
  const host = new URL(origin).origin
  const rows = await sql`UPDATE canvas_sync_jobs SET status='cancelled', error='Cancelled by the student.', finished_at=now()
    WHERE user_id=${clean(accountId, 200)} AND origin=${host} AND status='pending' RETURNING id`
  return { cancelled: rows.length }
}

export async function listCanvasCorpusMaterials({ accountId, courseCode = '', academicYear = '' } = {}) {
  if (!sql) return []
  const code = String(courseCode || '').trim().toUpperCase().slice(0, 80)
  const year = String(academicYear || '').trim().slice(0, 20)
  const rows = await sql`SELECT DISTINCT ON (s.id)
      s.id AS snapshot_id, s.asset_id, s.source_path, s.resource_type, s.sha256,
      s.first_seen_at, s.last_seen_at, s.canvas_updated_at, s.retired_at, s.sharing_mode,
      a.filename, a.media_type, a.byte_size, a.is_complete,
      b.id AS binding_id, b.edition_id, b.course_code, b.course_name, b.academic_year, b.period, b.canonical_course_id
    FROM canvas_source_snapshots s
    JOIN canvas_course_bindings b ON b.id=s.binding_id
    JOIN canvas_corpus_access access ON access.binding_id=b.id AND access.user_id=${accountId}
    JOIN editorial_source_assets a ON a.id=s.asset_id
    WHERE (${code}='' OR upper(b.course_code)=${code})
      AND (${year}='' OR b.academic_year=${year})
      AND (s.contributor_user_id=${accountId} OR (s.sharing_mode='community' AND EXISTS (
        SELECT 1 FROM editorial_contributions accepted
        WHERE accepted.id=s.contribution_id AND accepted.consent_status='accepted'
      )))
    ORDER BY s.id, s.retired_at NULLS FIRST, s.last_seen_at DESC`
  return rows.map((row) => ({
    snapshotId: row.snapshot_id,
    bindingId: row.binding_id,
    editionId: row.edition_id,
    assetId: row.asset_id,
    filename: row.filename,
    sourcePath: row.source_path,
    sourceType: row.resource_type,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    sha256: row.sha256,
    courseCode: row.course_code,
    courseName: row.course_name,
    academicYear: row.academic_year,
    period: row.period,
    canonicalCourseId: row.canonical_course_id,
    sharingMode: row.sharing_mode,
    current: !row.retired_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    canvasUpdatedAt: row.canvas_updated_at,
    url: `/api/corpus/assets/${encodeURIComponent(row.asset_id)}`,
    downloadUrl: `/api/corpus/assets/${encodeURIComponent(row.asset_id)}?download=1`
  }))
}

export async function canvasCorpusAsset({ accountId, assetId } = {}) {
  if (!sql || !assetId) return null
  const [row] = await sql`SELECT a.id, a.filename, a.media_type, a.byte_size, a.sha256, a.expected_chunks, a.is_complete, a.metadata
    FROM editorial_source_assets a
    WHERE a.id=${assetId} AND a.is_complete=true AND EXISTS (
      SELECT 1 FROM canvas_source_snapshots s
      JOIN canvas_corpus_access access ON access.binding_id=s.binding_id AND access.user_id=${accountId}
      WHERE s.asset_id=a.id AND (s.contributor_user_id=${accountId} OR (s.sharing_mode='community' AND EXISTS (
        SELECT 1 FROM editorial_contributions accepted
        WHERE accepted.id=s.contribution_id AND accepted.consent_status='accepted'
      )))
    )`
  return row ? { id: row.id, filename: row.filename, mediaType: row.media_type, byteSize: Number(row.byte_size), sha256: row.sha256, expectedChunks: Number(row.expected_chunks), localObjectKey: row.metadata?.localObjectKey || null } : null
}

export async function canvasCorpusAssetChunks({ assetId, first = 0, last = Number.MAX_SAFE_INTEGER } = {}) {
  if (!sql) return []
  return sql`SELECT chunk_index, data FROM editorial_source_asset_chunks
    WHERE asset_id=${assetId} AND chunk_index BETWEEN ${Math.max(0, Number(first) || 0)} AND ${Math.max(0, Number(last) || 0)}
    ORDER BY chunk_index`
}
