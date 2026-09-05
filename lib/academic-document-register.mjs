// A programme-scoped register of the documents a student has asked Wicker to
// read. The original file is deliberately not retained. Each entry keeps the
// source name, a one-way fingerprint, the derived impact and a dated version,
// so the student can inspect progression and remove one reading without
// exposing the original PDF to long-term storage.

import { randomUUID } from 'node:crypto'
import { activeProgrammeId } from './programme-scope.mjs'
import { deleteDocument, listDocuments, readDocument, writeDocument } from './user-store.mjs'

const NAMESPACE = 'academic-document-register'
const KINDS = new Set(['transcript', 'exam-schedule', 'timetable', 'academic-calendar', 'curriculum', 'academic-overview', 'other'])

export class AcademicDocumentRegisterError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

function clean(value, max = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizedKind(value) {
  const kind = clean(value, 60).toLowerCase()
  if (!kind || kind === 'auto') return 'other'
  return KINDS.has(kind) ? kind : 'other'
}

function keyFor(programmeId, kind) { return `${programmeId}:${kind}` }

function publicRecord(record) {
  return {
    id: record.id,
    kind: record.kind,
    label: record.label,
    programmeId: record.programmeId,
    versions: [...(record.versions || [])].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  }
}

export async function listAcademicDocumentRecords() {
  const programmeId = await activeProgrammeId()
  const rows = await listDocuments(NAMESPACE)
  return rows
    .map((row) => row.value)
    .filter((record) => record?.programmeId === programmeId && Array.isArray(record.versions) && record.versions.length)
    .map(publicRecord)
    .sort((left, right) => String(right.versions[0]?.createdAt).localeCompare(String(left.versions[0]?.createdAt)))
}

export async function recordAcademicDocumentVersion({ kind: rawKind, label, fingerprint, sources, impact, evidence = null } = {}) {
  const programmeId = await activeProgrammeId()
  const kind = normalizedKind(rawKind)
  const sourceRows = Array.isArray(sources) ? sources.slice(0, 6).map((source) => ({
    name: clean(source?.name, 240) || 'Document',
    type: clean(source?.type, 100) || null,
    size: Number.isFinite(Number(source?.size)) ? Math.max(0, Number(source.size)) : null
  })) : []
  const sourceLabel = clean(label, 240) || sourceRows[0]?.name || 'Document'
  const hash = clean(fingerprint, 160)
  if (!hash) throw new AcademicDocumentRegisterError('A document fingerprint is required.')
  const key = keyFor(programmeId, kind)
  const held = await readDocument(NAMESPACE, key, null)
  const record = held && held.programmeId === programmeId
    ? held
    : { id: randomUUID(), kind, label: sourceLabel, programmeId, versions: [] }
  if (record.versions.some((version) => version.fingerprint === hash)) {
    if (evidence) {
      record.versions = record.versions.map((version) => version.fingerprint === hash ? { ...version, evidence } : version)
      await writeDocument(NAMESPACE, key, record)
    }
    return { unchanged: true, record: publicRecord(record) }
  }
  const version = {
    id: randomUUID(),
    sourceLabel,
    evidence,
    sources: sourceRows,
    fingerprint: hash,
    impact: impact && typeof impact === 'object' ? impact : null,
    createdAt: new Date().toISOString()
  }
  record.label = sourceLabel
  record.versions = [version, ...record.versions]
  await writeDocument(NAMESPACE, key, record)
  return { unchanged: false, version, record: publicRecord(record) }
}

export async function deleteAcademicDocumentVersion({ kind: rawKind, versionId } = {}) {
  const programmeId = await activeProgrammeId()
  const kind = normalizedKind(rawKind)
  const id = clean(versionId, 100)
  if (!id) throw new AcademicDocumentRegisterError('Choose a document version to remove.')
  const key = keyFor(programmeId, kind)
  const record = await readDocument(NAMESPACE, key, null)
  if (!record || record.programmeId !== programmeId) throw new AcademicDocumentRegisterError('That document was not found.', 404)
  const next = record.versions.filter((version) => version.id !== id)
  if (next.length === record.versions.length) throw new AcademicDocumentRegisterError('That document version was not found.', 404)
  if (!next.length) await deleteDocument(NAMESPACE, key)
  else await writeDocument(NAMESPACE, key, { ...record, versions: next })
  return { removed: id, recordRemoved: !next.length }
}

export async function deleteAcademicDocumentRecord({ kind: rawKind } = {}) {
  const programmeId = await activeProgrammeId()
  const kind = normalizedKind(rawKind)
  const removed = await deleteDocument(NAMESPACE, keyFor(programmeId, kind))
  if (!removed) throw new AcademicDocumentRegisterError('That document was not found.', 404)
  return { removed: kind }
}
