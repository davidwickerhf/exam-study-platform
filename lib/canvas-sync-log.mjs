import { sql } from './db.mjs'

export const SYNC_STAGES = ['queue', 'discovery', 'download', 'extraction', 'indexing', 'rules']
// Logs contain deliberately chosen operational messages, never request bodies,
// source excerpts, provider responses, download URLs, or credentials.
export function safeSyncEvent(event) {
  if (!SYNC_STAGES.includes(event.stage)) throw new Error('Unknown sync stage.')
  const clean = value => String(value || '').replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/(?:bearer\s+|(?:access[_-]?token|api[_-]?key|authorization)\s*[:=]\s*)\S+/gi, '[redacted]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 240)
  const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 2147483647) : null
  return { stage: event.stage, level: ['warning', 'error'].includes(event.level) ? event.level : 'info',
    message: clean(event.message), item: event.item ? clean(event.item) : null,
    completed: count(event.completed), total: count(event.total) }
}

export async function recordCanvasSyncEvent(job, event, database = sql) {
  if (!database) return
  const safe = safeSyncEvent(event)
  // A stopped or superseded worker must not append apparent progress.
  try {
    await database`INSERT INTO canvas_sync_events (job_id, attempt, stage, level, message, item, completed, total)
      SELECT id, attempts, ${safe.stage}, ${safe.level}, ${safe.message}, ${safe.item}, ${safe.completed}, ${safe.total}
      FROM canvas_sync_jobs WHERE id=${job.id} AND user_id=${job.user_id} AND lease_token=${job.lease_token} AND status='running'`
  } catch { console.warn('Canvas progress event could not be recorded.') }
}

export async function canvasSyncLog({ accountId, jobId = '', before = '', stage = '', level = '', database = sql } = {}) {
  if (!accountId) throw new Error('An account is required.')
  if (before && (!/^[1-9][0-9]{0,18}$/.test(before) || BigInt(before) > 9223372036854775807n)) throw new Error('Invalid event cursor.')
  if (stage && !SYNC_STAGES.includes(stage)) throw new Error('Unknown sync stage.')
  if (level && level !== 'attention') throw new Error('Unknown event filter.')
  if (!database) return { available: false, jobs: [], events: [], nextCursor: null, selectedJobId: jobId }
  const jobs = await database`SELECT j.id, j.job_type AS type, j.status, j.attempts,
      j.created_at AS "createdAt", j.started_at AS "startedAt", j.finished_at AS "finishedAt",
      j.heartbeat_at AS "heartbeatAt", j.run_after AS "runAfter",
      b.course_code AS "courseCode", b.course_name AS "courseName", b.academic_year AS "academicYear",
      latest.stage, latest.message AS "lastMessage", latest.created_at AS "lastEventAt", latest.completed, latest.total
    FROM canvas_sync_jobs j LEFT JOIN canvas_course_bindings b ON b.id=j.binding_id
    LEFT JOIN LATERAL (SELECT stage, message, created_at, completed, total FROM canvas_sync_events
      WHERE job_id=j.id ORDER BY id DESC LIMIT 1) latest ON true
    WHERE j.user_id=${accountId} AND (j.job_type='catalog' OR EXISTS (
      SELECT 1 FROM canvas_corpus_access a WHERE a.user_id=${accountId} AND a.binding_id=j.binding_id))
    ORDER BY (j.id=${jobId}) DESC, (j.status IN ('pending', 'running')) DESC, j.created_at DESC LIMIT 100`
  if (jobId && !jobs.some(job => job.id === jobId)) throw new Error('That sync was not found in your account.')
  const events = await database`SELECT e.id::text, e.job_id AS "jobId", e.attempt, e.stage, e.level, e.message, e.item,
      e.completed, e.total, e.created_at AS "createdAt", b.course_code AS "courseCode", b.academic_year AS "academicYear", j.job_type AS type
    FROM canvas_sync_events e JOIN canvas_sync_jobs j ON j.id=e.job_id
    LEFT JOIN canvas_course_bindings b ON b.id=j.binding_id
    WHERE j.user_id=${accountId} AND (j.job_type='catalog' OR EXISTS (
      SELECT 1 FROM canvas_corpus_access a WHERE a.user_id=${accountId} AND a.binding_id=j.binding_id))
      AND (${jobId}='' OR j.id=${jobId}) AND (${before}='' OR e.id < NULLIF(${before}, '')::bigint)
      AND (${stage}='' OR e.stage=${stage}) AND (${level}='' OR e.level IN ('warning', 'error'))
    ORDER BY e.id DESC LIMIT 101`
  return { available: true, jobs, events: events.slice(0, 100), nextCursor: events.length > 100 ? String(events[99].id) : null, selectedJobId: jobId }
}
