import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql, userId } from './db.mjs'
import { deleteActivity, readActivity, summariseStoredActivity } from './activity.mjs'
import { deleteStudyTables, exportStudyTables, summariseStudyTables, STUDY_TABLES } from './study-store.mjs'
import { deleteAcademicData, exportAcademicProgrammes, summariseAcademicTables } from './academics.mjs'
import { deleteOwnCourseContentRequests, exportOwnCourseContentRequests, summariseOwnCourseContentRequests } from './course-content-requests.mjs'
import { exportOwnEditorialContributions, summariseOwnEditorialContributions, withdrawOwnEditorialContributions } from './editorial-workflow.mjs'
import { deleteCanvasConnections, listCanvasConnections } from './canvas-connections.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const localRoot = resolve(root, 'data/users')

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function localUserRoot(id = userId()) {
  const target = resolve(localRoot, safeSegment(id))
  if (!target.startsWith(`${localRoot}/`)) throw new Error('Invalid personal-data path')
  return target
}

// Record families shown on the Data & privacy tab. `study` families are
// cleared by "Reset study data"; the others survive it.
export const RECORD_LABELS = Object.freeze({
  ...Object.fromEntries(STUDY_TABLES),
  activity: 'Study activity log',
  academics: 'Academic plan',
  ai: 'AI usage ledger',
  contentRequests: 'Course-content requests and source files',
  editorialContributions: 'Shared-course contributions',
  canvasConnections: 'Encrypted Canvas connections'
})

export async function summarisePersonalData() {
  const study = (await summariseStudyTables()).map((entry) => ({ namespace: entry.table, ...entry, study: true }))
  const activity = await summariseStoredActivity()
  const academics = await summariseAcademicTables()
  const ai = await summariseAiUsage()
  const contentRequests = await summariseOwnCourseContentRequests()
  const editorialContributions = sql ? await summariseOwnEditorialContributions() : { count: 0, bytes: 0, updatedAt: null }
  const canvasConnections = await listCanvasConnections()
  const namespaces = [
    ...study,
    { namespace: 'activity', label: RECORD_LABELS.activity, count: activity.count, bytes: activity.bytes, updatedAt: activity.updatedAt, study: true },
    { namespace: 'academics', label: RECORD_LABELS.academics, count: academics.programmes, bytes: null, updatedAt: academics.updatedAt, study: false,
      detail: academics.programmes ? `${academics.courses} courses · ${academics.attempts} attempts · ${academics.events} events` : null },
    { namespace: 'ai', label: RECORD_LABELS.ai, count: ai.count, bytes: ai.bytes, updatedAt: ai.updatedAt, study: false },
    { namespace: 'contentRequests', label: RECORD_LABELS.contentRequests, count: contentRequests.count, bytes: contentRequests.bytes, updatedAt: contentRequests.updatedAt, study: false },
    { namespace: 'editorialContributions', label: RECORD_LABELS.editorialContributions, count: editorialContributions.count, bytes: editorialContributions.bytes, updatedAt: editorialContributions.updatedAt, study: false,
      detail: editorialContributions.count ? 'Account deletion withdraws these sources from future editorial work; unshared source bytes are removed.' : null },
    { namespace: 'canvasConnections', label: RECORD_LABELS.canvasConnections, count: canvasConnections.length, bytes: null, updatedAt: canvasConnections[0]?.updatedAt || null, study: false,
      detail: canvasConnections.length ? 'Connection metadata only. Canvas Personal Access Tokens are never included in data exports.' : null }
  ].filter((entry) => entry.count > 0)
  return {
    namespaces,
    totals: {
      documents: namespaces.reduce((sum, entry) => sum + entry.count, 0),
      bytes: namespaces.reduce((sum, entry) => sum + (entry.bytes || 0), 0),
      updatedAt: namespaces.reduce((latest, entry) => (!latest || (entry.updatedAt && entry.updatedAt > latest) ? entry.updatedAt : latest), null)
    }
  }
}

async function summariseAiUsage() {
  if (sql) {
    const [row] = await sql`SELECT count(*)::int AS count, coalesce(sum(pg_column_size(e.*)), 0)::bigint AS bytes, max(created_at) AS updated_at FROM ai_usage_events e WHERE user_id = ${userId()}`
    return { count: Number(row.count), bytes: Number(row.bytes), updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null }
  }
  const { readDocument } = await import('./user-store.mjs')
  const events = (await readDocument('ai', 'usage', { events: [] })).events || []
  return { count: events.length, bytes: JSON.stringify(events).length, updatedAt: events[0]?.createdAt || null }
}

export async function deleteStudyData() {
  const tables = await deleteStudyTables()
  const activityEvents = await deleteActivity()
  return { documents: Object.values(tables).reduce((sum, count) => sum + count, 0), tables, aiUsageEvents: 0, activityEvents }
}

export async function exportPersonalData(identity = null) {
  const id = userId()
  let aiUsage
  if (sql) {
    const rows = await sql`SELECT feature, status, input_tokens, output_tokens, reserved_tokens, estimated, created_at, completed_at
      FROM ai_usage_events WHERE user_id = ${id} ORDER BY created_at DESC`
    aiUsage = rows.map((row) => ({
      feature: row.feature, status: row.status, inputTokens: Number(row.input_tokens || 0), outputTokens: Number(row.output_tokens || 0),
      reservedTokens: Number(row.reserved_tokens || 0), estimated: row.estimated, createdAt: row.created_at, completedAt: row.completed_at
    }))
  } else {
    const { readDocument } = await import('./user-store.mjs')
    aiUsage = (await readDocument('ai', 'usage', { events: [] })).events || []
  }
  return {
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
    account: identity || { id },
    study: await exportStudyTables(),
    academics: await exportAcademicProgrammes(),
    courseContentRequests: await exportOwnCourseContentRequests(),
    editorialContributions: sql ? await exportOwnEditorialContributions() : [],
    canvasConnections: await listCanvasConnections(),
    activity: await readActivity({ since: '1970-01-01T00:00:00.000Z' }),
    aiUsage
  }
}

export async function deletePersonalData() {
  const id = userId()
  const tables = await deleteStudyTables()
  const activityEvents = await deleteActivity()
  const programmes = await deleteAcademicData()
  const editorialContributions = sql ? await withdrawOwnEditorialContributions({ deleteAccount: true }) : 0
  const courseContentRequests = await deleteOwnCourseContentRequests()
  const canvasConnections = await deleteCanvasConnections()
  if (sql) {
    const [documents, aiUsage] = await sql.transaction([
      sql`DELETE FROM user_documents WHERE user_id = ${id} RETURNING document_key`,
      sql`DELETE FROM ai_usage_events WHERE user_id = ${id} RETURNING id`
    ])
    return { documents: documents.length, tables, programmes, courseContentRequests, editorialContributions, canvasConnections, aiUsageEvents: aiUsage.length, activityEvents }
  }
  const target = localUserRoot(id)
  if (existsSync(target)) await rm(target, { recursive: true, force: true })
  return { documents: 0, tables, programmes, courseContentRequests, editorialContributions, canvasConnections, aiUsageEvents: 0, activityEvents }
}
