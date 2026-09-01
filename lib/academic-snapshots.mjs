// Keeping a history of a student's academic record without keeping their
// documents. Each upload contributes one snapshot — the derived course rows and
// totals — and progress is the diff between two of them. The uploaded PDF is
// never stored: it carries a full grade history and a student number, and the
// product's position is that uploads are read, not retained.

import { createHash, randomUUID } from 'node:crypto'
import { sql, userId, localRows, saveLocalRows } from './db.mjs'
import { compareAcademicWork, summariseAcademicWork } from './academic-work.mjs'

const TABLE = 'academic_snapshots'
export const MAX_SNAPSHOTS = 60

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
  let rows
  if (sql) {
    rows = await sql`SELECT id, kind, source_label, printed_on, summary, courses, created_at
      FROM academic_snapshots WHERE user_id = ${userId()} ORDER BY created_at DESC LIMIT ${MAX_SNAPSHOTS}`
  } else {
    rows = (await localRows(TABLE))
      .filter((row) => row.userId === userId())
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, MAX_SNAPSHOTS)
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
  const rows = Array.isArray(courses) ? courses : []
  if (!rows.length) throw new AcademicSnapshotError('An academic snapshot needs at least one course row.')
  const previous = await latestAcademicSnapshot()
  const hash = snapshotHash(rows)
  if (previous && snapshotHash(previous.courses || []) === hash) {
    return { unchanged: true, snapshot: previous, progress: null }
  }

  const snapshot = {
    id: randomUUID(),
    userId: userId(),
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
    const inserted = await sql`INSERT INTO academic_snapshots (id, user_id, kind, source_label, printed_on, content_hash, summary, courses)
      VALUES (${snapshot.id}, ${snapshot.userId}, ${snapshot.kind}, ${snapshot.sourceLabel}, ${snapshot.printedOn}, ${snapshot.contentHash}, ${JSON.stringify(snapshot.summary)}::jsonb, ${JSON.stringify(snapshot.courses)}::jsonb)
      ON CONFLICT (user_id, content_hash) DO NOTHING
      RETURNING id, kind, source_label, printed_on, summary, courses, created_at`
    if (!inserted.length) return { unchanged: true, snapshot: previous, progress: null }
  } else {
    const stored = await localRows(TABLE)
    if (stored.some((row) => row.userId === snapshot.userId && row.contentHash === hash)) return { unchanged: true, snapshot: previous, progress: null }
    stored.push(snapshot)
    const mine = stored.filter((row) => row.userId === snapshot.userId).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    const keep = new Set(mine.slice(0, MAX_SNAPSHOTS).map((row) => row.id))
    await saveLocalRows(TABLE, stored.filter((row) => row.userId !== snapshot.userId || keep.has(row.id)))
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
    snapshots: snapshots.map((snapshot) => ({ ...snapshot, courses: undefined })),
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
  if (sql) return (await sql`DELETE FROM academic_snapshots WHERE user_id = ${userId()} RETURNING id`).length
  const stored = await localRows(TABLE)
  const mine = stored.filter((row) => row.userId === userId()).length
  await saveLocalRows(TABLE, stored.filter((row) => row.userId !== userId()))
  return mine
}
