// Source-scoped undo data contains only derived fields, never original files.
import { readDocument, writeDocument, deleteDocument } from './user-store.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
import { readAcademicState, saveActiveAcademicWorkspace } from './academics.mjs'
import { listAcademicSnapshots, deleteAcademicSnapshot } from './academic-snapshots.mjs'
import { listAcademicDocumentRecords, deleteAcademicDocumentRecord } from './academic-document-register.mjs'

const NAMESPACE = 'onboarding-document-context'
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const object = (v) => v && typeof v === 'object' && !Array.isArray(v)

// Three-way undo: restore imported values only while they still match the
// import. Arrays with IDs are merged by identity, preserving later additions.
export function undoDocumentImport(current, before, after) {
  if (equal(before, after)) return current
  if (equal(current, after)) return structuredClone(before)
  if (Array.isArray(current) && Array.isArray(before) && Array.isArray(after)
    && [...current, ...before, ...after].every((row) => row?.id)) {
    return current.flatMap((row) => {
      const old = before.find((item) => item.id === row.id)
      const imported = after.find((item) => item.id === row.id)
      if (!imported) return [row]
      if (!old) return equal(row, imported) ? [] : [Array.isArray(imported.attempts) ? undoDocumentImport(row, { ...imported, attempts: [] }, imported) : row]
      return [undoDocumentImport(row, old, imported)]
    }).concat(before.filter((row) => !after.some((item) => item.id === row.id) && !current.some((item) => item.id === row.id)))
  }
  if (object(current) && object(before) && object(after)) {
    const next = { ...current }
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (['revision', 'updatedAt'].includes(key)) continue
      const value = undoDocumentImport(current[key], before[key], after[key])
      if (value === undefined) delete next[key]
      else next[key] = value
    }
    return next
  }
  return current
}

export async function rememberDocumentImport(kind, before, after) {
  const key = `${await activeProgrammeId()}:${kind}`
  const history = await readDocument(NAMESPACE, key, [])
  const fields = Object.keys(after).filter((field) => !['revision', 'updatedAt'].includes(field) && !equal(before[field], after[field]))
  const pick = (workspace) => Object.fromEntries(fields.map((field) => [field, workspace[field]]))
  await writeDocument(NAMESPACE, key, [...history, { before: pick(before), after: pick(after) }])
}

export async function hasDocumentImportContext(kind) {
  return (await readDocument(NAMESPACE, `${await activeProgrammeId()}:${kind}`, null)) !== null
}

export async function removeOnboardingDocument(kind) {
  if (!['record', 'transcript'].includes(kind)) throw new Error('Choose an academic record or transcript.')
  const key = `${await activeProgrammeId()}:${kind}`
  const storedHistory = await readDocument(NAMESPACE, key, null)
  const history = storedHistory || []
  const snapshots = (await listAcademicSnapshots({ withCourses: true })).filter((row) => kind === 'record' ? row.kind !== 'transcript' : row.kind === 'transcript')
  const { workspace } = await readAcademicState()
  let next = structuredClone(workspace)
  for (const entry of [...history].reverse()) next = undoDocumentImport(next, entry.before, entry.after)
  // Legacy Academic Work imports predate provenance. Only undated attempts
  // explicitly matching the source can be removed; dated transcript evidence stays.
  if (!history.length && snapshots.length) {
    const rows = snapshots.flatMap((snapshot) => snapshot.courses || [])
    const year = (v) => String(v || '').replace(/[–—/]/g, '-')
    next.courses = next.courses.map((course) => ({ ...course, attempts: course.attempts.filter((attempt) => !rows.some((row) =>
      row.code === (attempt.courseCode || course.code) && !attempt.examDate && year(row.academicYear) === year(attempt.academicYear)
      && (row.status === 'exempt' ? 'passed' : row.status) === attempt.status && (row.grade ?? null) === (attempt.grade ?? null)
    )) })).filter((course) => course.attempts.length || !course.notes?.includes('Reconciled from the uploaded Academic Work record.'))
  }
  await saveActiveAcademicWorkspace(next, workspace.revision)
  for (const snapshot of snapshots) await deleteAcademicSnapshot(snapshot.id)
  const records = (await listAcademicDocumentRecords()).filter((record) => kind === 'record' ? record.kind === 'academic-overview' : record.kind === 'transcript')
  for (const record of records) await deleteAcademicDocumentRecord({ kind: record.kind })
  // Rebase the other source's undo history so removing it later cannot
  // resurrect fields from the source being erased now.
  const otherKey = `${await activeProgrammeId()}:${kind === 'record' ? 'transcript' : 'record'}`
  const otherHistory = await readDocument(NAMESPACE, otherKey, [])
  if (otherHistory.length) await writeDocument(NAMESPACE, otherKey, otherHistory.map((entry) => ({
    before: undoDocumentImport(entry.before, next, workspace),
    after: undoDocumentImport(entry.after, next, workspace)
  })))
  await deleteDocument(NAMESPACE, key)
  return { removed: kind, legacyContext: kind === 'transcript' && storedHistory === null && records.length > 0 }
}
