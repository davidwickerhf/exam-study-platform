import { randomUUID } from 'node:crypto'
import { activeProgrammeId } from './programme-scope.mjs'
import { readDocument, writeDocument, deleteDocument, listDocuments } from './user-store.mjs'
import { listAcademicSnapshots } from './academic-snapshots.mjs'
import { listAcademicDocumentRecords } from './academic-document-register.mjs'
import { compareAcademicDocuments, validateDocumentRows } from './academic-document-check.mjs'

const NAMESPACE = 'academic-document-reviews'
export async function createDocumentReview({ evidence, changes, revision }) {
  const programmeId = await activeProgrammeId()
  const now = Date.now()
  for (const row of await listDocuments(NAMESPACE)) {
    if (row.value?.expiresAt < now) await deleteDocument(NAMESPACE, row.key)
  }
  const id = randomUUID()
  await writeDocument(NAMESPACE, `${programmeId}:${id}`, { programmeId, evidence, changes, revision, expiresAt: now + 60 * 60_000 })
  return id
}

export async function readDocumentReviews(ids, changes, revision) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 8) throw new Error('Read the academic document again before applying its results.')
  const programmeId = await activeProgrammeId()
  const reviews = []
  for (const id of ids) {
    const review = await readDocument(NAMESPACE, `${programmeId}:${id}`, null)
    if (!review || review.expiresAt < Date.now() || review.revision !== revision) throw new Error('This document review expired or the programme changed. Read the document again.')
    reviews.push(review)
  }
  for (const change of changes || []) {
    if (!reviews.some((review) => review.changes.some((held) => JSON.stringify(held) === JSON.stringify(change)))) throw new Error('A proposed result changed after it was checked. Read the document again.')
  }
  return reviews
}

export async function discardDocumentReviews() {
  const programmeId = await activeProgrammeId()
  for (const row of await listDocuments(NAMESPACE)) if (row.value?.programmeId === programmeId) await deleteDocument(NAMESPACE, row.key)
}

export async function academicDocumentEvidence() {
  const snapshots = await listAcademicSnapshots({ withCourses: true })
  const snapshot = snapshots.find((item) => item.kind !== 'transcript')
  const records = await listAcademicDocumentRecords()
  const latestTranscript = records.find((item) => item.kind === 'transcript')?.versions?.[0]
  const overview = records.find((item) => item.kind === 'academic-overview')?.versions?.[0]
  const record = overview?.evidence && (!snapshot || overview.createdAt >= snapshot.createdAt) ? overview.evidence : snapshot ? { rows: snapshot.courses, sourceLabel: snapshot.sourceLabel, validation: snapshot.summary?.validation || validateDocumentRows(snapshot.courses, { supported: false }) } : null
  const transcript = latestTranscript?.evidence || null
  return { record, transcript }
}

export async function academicDocumentCheck() {
  const { record, transcript } = await academicDocumentEvidence()
  return compareAcademicDocuments(record, transcript)
}
