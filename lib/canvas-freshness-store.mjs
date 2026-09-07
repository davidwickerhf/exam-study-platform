import { randomUUID } from 'node:crypto'
import { sql } from './db.mjs'
import { canvasAccessTokenForUser } from './canvas-connections.mjs'
import { collectCanvasMetadata, compareCanvasMetadata, replayCanvasMetadata, FRESHNESS_NAMESPACE } from './canvas-freshness.mjs'

export async function runCanvasFreshnessCheck(job, binding, { commit = queries => sql.transaction([sql`SELECT 1 / count(*)::int FROM (SELECT id FROM canvas_sync_jobs WHERE id=${job.id} AND lease_token=${job.lease_token} AND status='running' FOR UPDATE) held`, ...queries]) } = {}) {
  const [baselineJob] = await sql`SELECT id,finished_at FROM canvas_sync_jobs WHERE user_id=${job.user_id} AND binding_id=${binding.id}
    AND status='completed' AND job_type='course' AND coalesce(payload->>'stage','') NOT IN ('priorities','freshness') ORDER BY finished_at DESC LIMIT 1`
  const checkpoints = baselineJob ? await sql`SELECT key,value FROM canvas_sync_checkpoints WHERE job_id=${baselineJob.id}` : []
  const [stored] = await sql`SELECT value FROM user_documents WHERE user_id=${job.user_id} AND namespace=${FRESHNESS_NAMESPACE} AND document_key=${binding.id}`
  const { token } = await canvasAccessTokenForUser({ accountId: job.user_id, canvasUrl: binding.origin })
  const options = { origin: binding.origin, courseId: binding.canvas_course_id }
  const baseline = await collectCanvasMetadata({ ...options, replay: true, fetchImpl: replayCanvasMetadata(checkpoints) })
  const current = await collectCanvasMetadata({ ...options, token })
  const result = { ...compareCanvasMetadata(baseline, current, stored?.value?.baselineId === baselineJob?.id ? stored.value : null),
    baselineId: baselineJob?.id || null, lastScrapedAt: baselineJob?.finished_at || null, requests: current.requests, bytes: current.bytes }
  await commit([sql`INSERT INTO user_documents(user_id,namespace,document_key,value,updated_at)
    VALUES(${job.user_id},${FRESHNESS_NAMESPACE},${binding.id},${JSON.stringify(result)}::jsonb,now())
    ON CONFLICT(user_id,namespace,document_key) DO UPDATE SET value=excluded.value,updated_at=now()`])
  job.log?.({ stage: 'discovery', message: result.status === 'updates' ? `${result.changes.length} Canvas changes found. Refresh this course to collect them.` : result.status === 'partial' ? 'Some Canvas sources could not be compared. Saved material is unchanged.' : 'Canvas metadata matches your last successful scrape.' })
  return { metadataOnly: true, changes: result.changes.length, status: result.status }
}

// Scope every read and action through the requesting student's own access,
// never a shared binding's last_synced_at or another contributor's snapshot.
export async function canvasFreshnessStatus({ accountId, courseCode, academicYear = '' }) {
  if (!sql) return { courses: [] }
  if (!/^[A-Z]{2,4}\d{3,5}[A-Z]?$/.test(courseCode || '')) return { courses: [] }
  const rows = await sql`SELECT b.id,b.origin,b.canvas_course_id,b.academic_year,a.auto_refresh,a.sync_paused,
      d.value, p.refresh_enabled,p.refresh_updates_minutes,
      last.id AS baseline_id,last.finished_at,
      active.id AS active_id,active.payload->>'stage' AS active_stage
    FROM canvas_corpus_access a JOIN canvas_course_bindings b ON b.id=a.binding_id
    JOIN canvas_corpus_permissions p ON p.user_id=a.user_id AND p.origin=b.origin AND p.collection_enabled=true
    LEFT JOIN user_documents d ON d.user_id=a.user_id AND d.namespace=${FRESHNESS_NAMESPACE} AND d.document_key=b.id
    LEFT JOIN LATERAL (SELECT id,finished_at FROM canvas_sync_jobs j WHERE j.user_id=a.user_id AND j.binding_id=b.id
      AND j.status='completed' AND j.job_type='course' AND coalesce(j.payload->>'stage','') NOT IN ('priorities','freshness') ORDER BY finished_at DESC LIMIT 1) last ON true
    LEFT JOIN LATERAL (SELECT id,payload FROM canvas_sync_jobs j WHERE j.user_id=a.user_id AND j.binding_id=b.id
      AND j.status IN ('pending','running') ORDER BY j.created_at DESC LIMIT 1) active ON true
    WHERE a.user_id=${accountId} AND b.course_code=${courseCode}
      AND (${!academicYear || academicYear === 'all'} OR b.academic_year=${academicYear})
    ORDER BY b.academic_year DESC,b.id`
  return { courses: rows.map(row => ({
    bindingId: row.id, canvasUrl: row.origin, canvasCourseId: row.canvas_course_id, academicYear: row.academic_year,
    active: row.auto_refresh, paused: row.sync_paused, automatic: row.refresh_enabled, checkMinutes: row.refresh_updates_minutes,
    lastScrapedAt: row.finished_at || null, busy: row.active_id ? row.active_stage === 'freshness' ? 'checking' : 'syncing' : null,
    ...(row.value?.baselineId === row.baseline_id ? row.value : { status: 'unchecked', changes: [], unchecked: [], checkedAt: null })
  })) }
}

export async function enqueueCanvasFreshnessCheck({ accountId, bindingId }) {
  if (!sql) return { queued: false }
  const rows = await sql`INSERT INTO canvas_sync_jobs(id,user_id,origin,binding_id,job_type,priority,payload)
    SELECT ${`csj-${randomUUID()}`},a.user_id,b.origin,b.id,'course',90,'{"stage":"freshness"}'::jsonb
    FROM canvas_corpus_access a JOIN canvas_course_bindings b ON b.id=a.binding_id
    JOIN canvas_corpus_permissions p ON p.user_id=a.user_id AND p.origin=b.origin AND p.collection_enabled=true
    WHERE a.user_id=${accountId} AND a.binding_id=${bindingId} AND a.sync_paused=false
      AND NOT EXISTS(SELECT 1 FROM canvas_sync_jobs recent WHERE recent.user_id=a.user_id AND recent.binding_id=a.binding_id
        AND recent.payload->>'stage'='freshness' AND recent.created_at>now()-interval '5 minutes')
    ON CONFLICT DO NOTHING RETURNING id`
  return { queued: rows.length > 0, cooldownMinutes: 5 }
}
