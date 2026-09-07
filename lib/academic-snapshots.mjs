// Derived course snapshots remain separate from privately retained originals.
import { createHash, randomUUID } from 'node:crypto'
import { sql, userId, localRows, saveLocalRows } from './db.mjs'
import { compareAcademicWork, summariseAcademicWork } from './academic-work.mjs'
import { activeProgrammeId } from './programme-scope.mjs'

const TABLE = 'academic_snapshots'
export class AcademicSnapshotError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

function text(value, max = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Hash the derived rows, not the file. Two prints of an unchanged record differ
// byte for byte — the print date alone changes — but say exactly the same thing,
// and recording that as progress would be a lie.
export function snapshotHash(courses = []) {
  const canonical = courses
    .map((course) => [course.academicYear, course.periodCode, course.code, course.status, course.grade ?? '', course.creditsEarned ?? '', course.creditsTotal ?? ''].join('|'))
    .sort()
    .join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

function publicSnapshot(row) {
  return {
    id: row.id,
    kind: row.kind,
    sourceLabel: row.source_label ?? row.sourceLabel ?? null,
    printedOn: row.printed_on ?? row.printedOn ?? null,
    summary: row.summary,
    courses: row.courses,
    createdAt: new Date(row.created_at ?? row.createdAt).toISOString()
  }
}

export async function listAcademicSnapshots({ withCourses = false } = {}) {
  const programmeId = await activeProgrammeId()
  let rows
  if (sql) {
    rows = await sql`SELECT id, kind, source_label, printed_on, summary, courses, created_at
      FROM academic_snapshots WHERE user_id = ${userId()} AND programme_id = ${programmeId} ORDER BY created_at DESC`
  } else {
    rows = (await localRows(TABLE))
      .filter((row) => row.userId === userId() && (row.programmeId || programmeId) === programmeId)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  }
  return rows.map(publicSnapshot).map((snapshot) => withCourses ? snapshot : { ...snapshot, courses: undefined })
}

export async function listAllAcademicSnapshots({ withCourses = false } = {}) {
  let rows
  if (sql) {
    rows = await sql`SELECT id, kind, source_label, printed_on, summary, courses, created_at
      FROM academic_snapshots WHERE user_id = ${userId()} ORDER BY created_at DESC`
  } else {
    rows = (await localRows(TABLE))
      .filter((row) => row.userId === userId())
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  }
  return rows.map(publicSnapshot).map((snapshot) => withCourses ? snapshot : { ...snapshot, courses: undefined })
}

export async function latestAcademicSnapshot() {
  const [latest] = await listAcademicSnapshots({ withCourses: true })
  return latest || null
}

/**
 * Records one reading of an academic document.
 *
 * Returns the snapshot and what changed since the previous one, or
 * `{ unchanged: true }` when the record says exactly what it said last time.
 */
export async function recordAcademicSnapshot({ kind, sourceLabel, printedOn, courses, summary } = {}) {
  const programmeId = await activeProgrammeId()
  const rows = Array.isArray(courses) ? courses : []
  if (!rows.length) throw new AcademicSnapshotError('An academic snapshot needs at least one course row.')
  const snapshots = await listAcademicSnapshots({ withCourses: true })
  const previous = snapshots[0] || null
  const hash = snapshotHash(rows)
  if (snapshots.some((snapshot) => snapshot.id !== previous?.id && snapshotHash(snapshot.courses || []) === hash)) throw new AcademicSnapshotError('This is an older copy of the academic record. Keep the latest reading or upload a current export; the saved source has not been replaced.')
  if (previous && snapshotHash(previous.courses || []) === hash) {
    // A fresh deterministic reading can verify a legacy snapshot without
    // duplicating it in the document register or claiming new study progress.
    if (summary?.validation) {
      const verifiedSummary = { ...previous.summary, validation: summary.validation }
      if (sql) await sql`UPDATE academic_snapshots SET summary=${JSON.stringify(verifiedSummary)}::jsonb WHERE id=${previous.id} AND user_id=${userId()} AND programme_id=${programmeId}`
      else await saveLocalRows(TABLE, (await localRows(TABLE)).map((row) => row.id === previous.id && row.userId === userId() ? { ...row, summary: verifiedSummary } : row))
      return { unchanged: true, snapshot: { ...previous, summary: verifiedSummary }, progress: null }
    }
    return { unchanged: true, snapshot: previous, progress: null }
  }

  const snapshot = {
    id: randomUUID(),
    userId: userId(),
    programmeId,
    kind: text(kind, 40) || 'academic-work',
    sourceLabel: text(sourceLabel, 200) || null,
    printedOn: text(printedOn, 40) || null,
    contentHash: hash,
    summary: summary || summariseAcademicWork(rows),
    courses: rows,
    createdAt: new Date().toISOString()
  }

  if (sql) {
    // A different print of an identical record can still collide on the hash if
    // an earlier snapshot was superseded and re-uploaded; treat that as a no-op.
    const inserted = await sql`INSERT INTO academic_snapshots (id, user_id, programme_id, kind, source_label, printed_on, content_hash, summary, courses)
      VALUES (${snapshot.id}, ${snapshot.userId}, ${programmeId}, ${snapshot.kind}, ${snapshot.sourceLabel}, ${snapshot.printedOn}, ${snapshot.contentHash}, ${JSON.stringify(snapshot.summary)}::jsonb, ${JSON.stringify(snapshot.courses)}::jsonb)
      ON CONFLICT (user_id, programme_id, content_hash) DO NOTHING
      RETURNING id, kind, source_label, printed_on, summary, courses, created_at`
    if (!inserted.length) return { unchanged: true, snapshot: previous, progress: null }
  } else {
    const stored = await localRows(TABLE)
    if (stored.some((row) => row.userId === snapshot.userId && (row.programmeId || programmeId) === programmeId && row.contentHash === hash)) return { unchanged: true, snapshot: previous, progress: null }
    stored.push(snapshot)
    await saveLocalRows(TABLE, stored)
  }

  return {
    unchanged: false,
    snapshot: publicSnapshot({ ...snapshot, created_at: snapshot.createdAt, source_label: snapshot.sourceLabel, printed_on: snapshot.printedOn }),
    progress: compareAcademicWork(previous, snapshot)
  }
}

// The whole history as a series, for a progress chart, plus the movement
// between the two most recent readings.
export async function academicProgress() {
  const snapshots = await listAcademicSnapshots({ withCourses: true })
  if (!snapshots.length) return { snapshots: [], latest: null, since: null, series: [] }
  const [latest, previous = null] = snapshots
  return {
    // Course rows are derived record data, not the uploaded document. Keep
    // them in history so a student can inspect exactly which course changed
    // between two saved readings.
    snapshots,
    latest,
    since: previous ? compareAcademicWork(previous, latest) : null,
    series: [...snapshots].reverse().map((snapshot) => ({
      at: snapshot.createdAt,
      printedOn: snapshot.printedOn,
      earnedEcts: snapshot.summary?.earnedEcts ?? 0,
      passedCourses: snapshot.summary?.passedCourses ?? 0,
      weightedAverage: snapshot.summary?.weightedAverage ?? null
    }))
  }
}

export async function deleteAcademicSnapshots() {
  const programmeId = await activeProgrammeId()
  if (sql) return (await sql`DELETE FROM academic_snapshots WHERE user_id = ${userId()} AND programme_id = ${programmeId} RETURNING id`).length
  const stored = await localRows(TABLE)
  const mine = stored.filter((row) => row.userId === userId() && (row.programmeId || programmeId) === programmeId).length
  await saveLocalRows(TABLE, stored.filter((row) => row.userId !== userId() || (row.programmeId || programmeId) !== programmeId))
  return mine
}

export async function deleteAllAcademicSnapshots() {
  if (sql) return (await sql`DELETE FROM academic_snapshots WHERE user_id = ${userId()} RETURNING id`).length
  const stored = await localRows(TABLE)
  const mine = stored.filter((row) => row.userId === userId()).length
  await saveLocalRows(TABLE, stored.filter((row) => row.userId !== userId()))
  return mine
}

// Remove one derived reading without touching the current academic workspace.
// This is intentionally narrower than reset: deleting history never rewrites
// course attempts or credits that the student already reviewed and applied.
export async function deleteAcademicSnapshot(snapshotId) {
  const programmeId = await activeProgrammeId()
  const id = text(snapshotId, 100)
  if (!id) throw new AcademicSnapshotError('Choose a record version to remove.')
  const originals=await import('./academic-originals.mjs')
  await originals.removeOriginal('record',`${programmeId}:record:${id}`)
  await originals.removeOriginal('transcript',`${programmeId}:transcript:${id}`)
  if (sql) {
    const rows = await sql`DELETE FROM academic_snapshots WHERE id = ${id} AND user_id = ${userId()} AND programme_id = ${programmeId} RETURNING id`
    if (!rows.length) throw new AcademicSnapshotError('That record version was not found.', 404)
    return { removed: id }
  }
  const stored = await localRows(TABLE)
  const matches = stored.some((row) => row.id === id && row.userId === userId() && (row.programmeId || programmeId) === programmeId)
  if (!matches) throw new AcademicSnapshotError('That record version was not found.', 404)
  await saveLocalRows(TABLE, stored.filter((row) => !(row.id === id && row.userId === userId() && (row.programmeId || programmeId) === programmeId)))
  return { removed: id }
}
