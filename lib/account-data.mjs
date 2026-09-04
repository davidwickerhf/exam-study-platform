import { sql, userId } from './db.mjs'
import { deleteActivity, deleteAllActivity, readActivity, summariseStoredActivity } from './activity.mjs'
import { deleteStudyTables, exportStudyTables, summariseStudyTables, STUDY_TABLES } from './study-store.mjs'
import { deleteAcademicData, exportAcademicProgrammes, summariseAcademicTables } from './academics.mjs'
import { deleteOwnCourseContentRequests, exportOwnCourseContentRequests, summariseOwnCourseContentRequests } from './course-content-requests.mjs'
import { eraseOwnEditorialContributionData, exportOwnEditorialContributions, summariseOwnEditorialContributions } from './editorial-workflow.mjs'
import { deleteCanvasConnections, listCanvasConnections } from './canvas-connections.mjs'
import { deleteAllAcademicSnapshots, listAllAcademicSnapshots } from './academic-snapshots.mjs'
import { exportTutorData, listConversations, readTutorMemory } from './tutor-store.mjs'
import { exportTutorAttachments } from './tutor-attachments.mjs'
import { deleteAllDocuments, deleteNamespaces, listDocuments } from './user-store.mjs'
import { deleteOwnAgentAuthorizations } from './agent-authorization.mjs'

const ACCOUNT_DELETION_TABLES = Object.freeze([
  ...STUDY_TABLES.map(([table]) => table),
  'mock_session_answers',
  'activity_events',
  'academic_programmes',
  'academic_courses',
  'academic_attempts',
  'academic_events',
  'academic_gates',
  'agent_authorizations',
  'canvas_priority_scans',
  'canvas_sync_jobs',
  'canvas_source_snapshots',
  'canvas_corpus_access',
  'canvas_corpus_permissions',
  'programme_memberships',
  'api_keys',
  'editorial_contributions',
  'editorial_source_assets',
  'editorial_course_editions',
  'editorial_course_releases',
  'editorial_change_sets',
  'course_content_requests',
  'course_content_request_files',
  'canvas_connections',
  'academic_snapshots',
  'user_documents',
  'ai_usage_events'
])

export class AccountDeletionError extends Error {
  constructor(message, { code, partial = false, cause } = {}) {
    super(message, { cause })
    this.name = 'AccountDeletionError'
    this.code = code || 'ACCOUNT_DELETION_FAILED'
    this.partial = partial
  }
}

// Account erasure spans several repositories and cannot be one transaction
// with Clerk. Verify the complete SQL surface before the first destructive
// statement so a lagging deployment can fail safely instead of halfway.
async function assertAccountDeletionSchema() {
  if (!sql) return
  const rows = await sql.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [ACCOUNT_DELETION_TABLES]
  )
  const available = new Set(rows.map((row) => row.table_name))
  const missing = ACCOUNT_DELETION_TABLES.filter((table) => !available.has(table))
  if (missing.length) {
    const cause = new Error(`Account deletion schema is missing: ${missing.join(', ')}`)
    throw new AccountDeletionError(
      'Account deletion is temporarily unavailable while storage maintenance finishes. Nothing was deleted by this attempt. Please try again shortly.',
      { code: 'ACCOUNT_DELETION_SCHEMA_NOT_READY', cause }
    )
  }
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
  canvasConnections: 'Encrypted Canvas connections',
  academicSnapshots: 'Academic record history',
  academicDocumentRegister: 'Document revision register',
  tutor: 'Tutor conversations and memory',
  tutorAttachments: 'Private Tutor sources'
})

export async function summarisePersonalData() {
  const study = (await summariseStudyTables()).map((entry) => ({ namespace: entry.table, ...entry, study: true }))
  const activity = await summariseStoredActivity()
  const academics = await summariseAcademicTables()
  const ai = await summariseAiUsage()
  const contentRequests = await summariseOwnCourseContentRequests()
  const editorialContributions = sql ? await summariseOwnEditorialContributions() : { count: 0, bytes: 0, updatedAt: null }
  const canvasConnections = await listCanvasConnections()
  const academicSnapshots = await listAllAcademicSnapshots()
  const academicDocumentRegister = await listDocuments('academic-document-register')
  const allTutorAttachmentDocuments = await listDocuments('tutor-attachments')
  const [tutorConversations, tutorMemory] = await Promise.all([listConversations(), readTutorMemory()])
  const namespaces = [
    ...study,
    { namespace: 'activity', label: RECORD_LABELS.activity, count: activity.count, bytes: activity.bytes, updatedAt: activity.updatedAt, study: true },
    { namespace: 'academics', label: RECORD_LABELS.academics, count: academics.programmes, bytes: null, updatedAt: academics.updatedAt, study: false,
      detail: academics.programmes ? `${academics.courses} courses · ${academics.attempts} attempts · ${academics.events} events` : null },
    { namespace: 'ai', label: RECORD_LABELS.ai, count: ai.count, bytes: ai.bytes, updatedAt: ai.updatedAt, study: false },
    { namespace: 'contentRequests', label: RECORD_LABELS.contentRequests, count: contentRequests.count, bytes: contentRequests.bytes, updatedAt: contentRequests.updatedAt, study: false },
    { namespace: 'editorialContributions', label: RECORD_LABELS.editorialContributions, count: editorialContributions.count, bytes: editorialContributions.bytes, updatedAt: editorialContributions.updatedAt, study: false,
      detail: editorialContributions.count ? 'Private and pending sources can be erased. Material already accepted into the public library stays available under its sharing licence, without a link to your account.' : null },
    { namespace: 'canvasConnections', label: RECORD_LABELS.canvasConnections, count: canvasConnections.length, bytes: null, updatedAt: canvasConnections[0]?.updatedAt || null, study: false,
      detail: canvasConnections.length ? 'Connection metadata only. Canvas Personal Access Tokens are never included in data exports.' : null },
    { namespace: 'academicSnapshots', label: RECORD_LABELS.academicSnapshots, count: academicSnapshots.length, bytes: null, updatedAt: academicSnapshots[0]?.createdAt || null, study: false,
      detail: academicSnapshots.length ? 'Course results and totals read from transcripts you uploaded, kept so progress can be compared over time. The uploaded documents themselves are not stored.' : null },
    { namespace: 'academicDocumentRegister', label: RECORD_LABELS.academicDocumentRegister,
      count: academicDocumentRegister.reduce((sum, document) => sum + (Array.isArray(document.value?.versions) ? document.value.versions.length : 0), 0),
      bytes: academicDocumentRegister.reduce((sum, document) => sum + JSON.stringify(document.value || {}).length, 0),
      updatedAt: academicDocumentRegister.map((document) => document.updatedAt ? new Date(document.updatedAt).toISOString() : null).filter(Boolean).sort().at(-1) || null,
      study: false, detail: academicDocumentRegister.length ? 'Names, fingerprints and approved changes retained for version history. Original academic files are not stored.' : null },
    { namespace: 'tutor', label: RECORD_LABELS.tutor, count: tutorConversations.length + tutorMemory.facts.length, bytes: null, updatedAt: tutorConversations[0]?.updatedAt || null, study: false,
      detail: tutorConversations.length || tutorMemory.facts.length || tutorMemory.plans.length ? `${tutorConversations.length} conversation${tutorConversations.length === 1 ? '' : 's'}, ${tutorMemory.facts.length} remembered fact${tutorMemory.facts.length === 1 ? '' : 's'}, and ${tutorMemory.plans.length} approved plan${tutorMemory.plans.length === 1 ? '' : 's'}.` : null },
    { namespace: 'tutorAttachments', label: RECORD_LABELS.tutorAttachments,
      count: allTutorAttachmentDocuments.filter((document) => document.value?.id).length,
      bytes: allTutorAttachmentDocuments.filter((document) => document.value?.id).reduce((sum, document) => sum + Number(document.value?.size || 0), 0),
      updatedAt: allTutorAttachmentDocuments.map((document) => document.updatedAt ? new Date(document.updatedAt).toISOString() : document.value?.updatedAt || null).filter(Boolean).sort().at(-1) || null,
      study: false, detail: allTutorAttachmentDocuments.some((document) => document.value?.id) ? 'Files and pictures stored privately for Tutor retrieval. They are removed with account deletion or data erasure.' : null }
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

// Removes material supplied by the student without touching their current
// programme, progress, calendar, attendance, Tutor conversations or plans.
// Academic uploads are read in-browser, so only their revision metadata and
// derived snapshots exist here; Tutor/Document sources retain the original so
// they can be retrieved and are deleted in full.
export async function deleteUploadedData() {
  const academicSnapshots = await deleteAllAcademicSnapshots()
  const editorialContributions = sql ? await eraseOwnEditorialContributionData({ requestUploadsOnly: true }) : { retainedPublic: 0, removedPrivate: 0, deletedAssets: 0 }
  const courseContentRequests = await deleteOwnCourseContentRequests()
  const documents = await deleteNamespaces(['tutor-attachments', 'academic-document-register'])
  return { documents, academicSnapshots, courseContentRequests, editorialContributions }
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
    schemaVersion: 7,
    exportedAt: new Date().toISOString(),
    account: identity || { id },
    study: await exportStudyTables(),
    academics: await exportAcademicProgrammes(),
    courseContentRequests: await exportOwnCourseContentRequests(),
    editorialContributions: sql ? await exportOwnEditorialContributions() : [],
    canvasConnections: await listCanvasConnections(),
    tutor: await exportTutorData(),
    tutorAttachments: await exportTutorAttachments(),
    activity: await readActivity({ since: '1970-01-01T00:00:00.000Z' }),
    aiUsage
  }
}

export async function deletePersonalData() {
  const id = userId()
  await assertAccountDeletionSchema()
  let deletionStarted = false
  try {
    // Count Tutor records before academic workspaces are removed. Reading the
    // active Tutor index afterwards would lazily create a replacement default
    // programme in an account that is in the middle of being deleted.
    const tutor = (await listDocuments('tutor')).length
    deletionStarted = true
    const tables = await deleteStudyTables()
    const activityEvents = await deleteAllActivity()
    const programmes = await deleteAcademicData()
    const agentAuthorizations = await deleteOwnAgentAuthorizations()
    let accessRecords = { apiKeys: 0, programmeMemberships: 0, canvasCorpusPermissions: 0, canvasCorpusAccess: 0, canvasSourceSnapshots: 0, canvasSyncJobs: 0, canvasPriorityScans: 0 }
    if (sql) {
      // Canvas snapshots must go before editorial contributions: their asset
      // references intentionally prevent the source bytes being orphaned.
      const [priorityScans, syncJobs, sourceSnapshots, corpusAccess, corpusPermissions, memberships, apiKeys] = await sql.transaction([
        sql`DELETE FROM canvas_priority_scans WHERE user_id = ${id} RETURNING id`,
        sql`DELETE FROM canvas_sync_jobs WHERE user_id = ${id} RETURNING id`,
        sql`DELETE FROM canvas_source_snapshots WHERE contributor_user_id = ${id} RETURNING id`,
        sql`DELETE FROM canvas_corpus_access WHERE user_id = ${id} RETURNING binding_id`,
        sql`DELETE FROM canvas_corpus_permissions WHERE user_id = ${id} RETURNING origin`,
        sql`DELETE FROM programme_memberships WHERE user_id = ${id} RETURNING programme_id`,
        sql`DELETE FROM api_keys WHERE user_id = ${id} RETURNING id`
      ])
      accessRecords = {
        apiKeys: apiKeys.length,
        programmeMemberships: memberships.length,
        canvasCorpusPermissions: corpusPermissions.length,
        canvasCorpusAccess: corpusAccess.length,
        canvasSourceSnapshots: sourceSnapshots.length,
        canvasSyncJobs: syncJobs.length,
        canvasPriorityScans: priorityScans.length
      }
    }
    const editorialContributions = sql ? await eraseOwnEditorialContributionData() : { retainedPublic: 0, removedPrivate: 0, deletedAssets: 0 }
    const courseContentRequests = await deleteOwnCourseContentRequests()
    const canvasConnections = await deleteCanvasConnections()
    const academicSnapshots = await deleteAllAcademicSnapshots()
    if (sql) {
      const [documents, aiUsage] = await sql.transaction([
        sql`DELETE FROM user_documents WHERE user_id = ${id} RETURNING document_key`,
        sql`DELETE FROM ai_usage_events WHERE user_id = ${id} RETURNING id`
      ])
      return { documents: documents.length, tables, programmes, courseContentRequests, editorialContributions, canvasConnections, academicSnapshots, tutor, agentAuthorizations, accessRecords, aiUsageEvents: aiUsage.length, activityEvents }
    }
    const documents = await deleteAllDocuments()
    return { documents, tables, programmes, courseContentRequests, editorialContributions, canvasConnections, academicSnapshots, tutor, agentAuthorizations, accessRecords, aiUsageEvents: 0, activityEvents }
  } catch (cause) {
    if (cause instanceof AccountDeletionError) throw cause
    throw new AccountDeletionError(
      deletionStarted
        ? 'Account deletion did not finish. Some private Wicker data may already have been removed, but your sign-in identity remains. Please retry or contact privacy@study.wicker.life.'
        : 'Account deletion could not start. Nothing was deleted by this attempt. Please try again shortly.',
      { partial: deletionStarted, cause }
    )
  }
}
