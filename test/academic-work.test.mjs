import test from 'node:test'
import assert from 'node:assert/strict'
import { AcademicWorkError, compareAcademicWork, parseAcademicWork, parseCourseIdentity, summariseAcademicWork } from '../lib/academic-work.mjs'

// The structure of a real Academic Work print-out, with invented courses and
// grades: the real document carries a name, a student number, and a full grade
// history, none of which belongs in a public repository.
const OVERVIEW = `Maastricht University
printed on 30 Aug 2026

Example, Student (Stud. DACS)
i0000000

Bachelor of Science in Computer Science

Current courses
Course code Description Result Credits
2026-2027-002-BCS3300 Project 3-1 - 0,0/6,0
2026-2027-100-BCS2120 Introduction to Artificial Intelligence - 0,0/4,0
2026-2027-100-BCS2140 Operating Systems - 0,0/4,0
2026-2027-500-BCS2220 Principles of Programming Languages - 0,0/4,0

Completed courses
Course code Description Result Credits
2024-2025-100-BCS1110 Foundations of Computing 8,0 4,0/4,0
2024-2025-200-BCS1120 Discrete Mathematics 6,5 4,0/4,0
2023-2024-003-BCS1300 Project 1-2 7,0 10,0/10,0

Failed courses
Course code Description Result Credits
2025-2026-100-BCS2120 Introduction to Artificial Intelligence NG 0,0/4,0
2025-2026-500-BCS2220 Principles of Programming Languages 5,0 0,0/4,0
2024-2025-100-BCS2120 Introduction to Artificial Intelligence 2,0 0,0/4,0

This is not an official document issued by Maastricht University.
page 1/2`

test('an Academic Work overview is read without a model', () => {
  const result = parseAcademicWork(OVERVIEW)
  assert.equal(result.kind, 'academic-work')
  assert.equal(result.printedOn, '30 Aug 2026')
  assert.equal(result.student.number, 'i0000000')
  assert.equal(result.student.name, 'Example, Student')
  assert.equal(result.programme, 'Bachelor of Science in Computer Science')
  assert.equal(result.courses.length, 10)

  // The first column is an identity, not a course code: the same course in two
  // years is two attempts, and the period is what lines it up with Canvas.
  const registered = result.courses.find((course) => course.code === 'BCS3300')
  assert.deepEqual(
    { year: registered.academicYear, periodCode: registered.periodCode, period: registered.period, status: registered.status },
    { year: '2026-2027', periodCode: '002', period: 'Semester 1', status: 'upcoming' }
  )
  assert.equal(result.courses.find((course) => course.code === 'BCS2140').period, 'Period 1')

  // Dutch decimals use a comma.
  const passed = result.courses.find((course) => course.code === 'BCS1120')
  assert.deepEqual({ grade: passed.grade, earned: passed.creditsEarned, total: passed.creditsTotal, status: passed.status }, { grade: 6.5, earned: 4, total: 4, status: 'passed' })

  // The section decides, not the number: 5,0 sits under Failed courses and is a
  // fail, even though it would round to a pass.
  const nearMiss = result.courses.find((course) => course.code === 'BCS2220' && course.academicYear === '2025-2026')
  assert.deepEqual({ grade: nearMiss.grade, status: nearMiss.status }, { grade: 5, status: 'failed' })
  // NG is a no-show, which is not the same as a bad grade.
  const noShow = result.courses.find((course) => course.academicYear === '2025-2026' && course.code === 'BCS2120')
  assert.deepEqual({ result: noShow.result, grade: noShow.grade, status: noShow.status }, { result: 'NG', grade: null, status: 'no-show' })
})

test('the summary counts a retaken course once and weights the average by credits', () => {
  const summary = parseAcademicWork(OVERVIEW).summary
  assert.equal(summary.earnedEcts, 18)
  assert.equal(summary.passedCourses, 3)
  // Three failed attempts across two distinct courses.
  assert.equal(summary.failedAttempts, 3)
  assert.equal(summary.currentCourses, 4)
  // (8·4 + 6.5·4 + 7·10) / 18 = 128/18
  assert.equal(summary.weightedAverage, 7.11)
  assert.deepEqual(summary.academicYears, ['2023-2024', '2024-2025', '2025-2026', '2026-2027'])
})

test('a course code wrapped across two lines is still one row', () => {
  // The PDF column is narrow, so the identity often breaks after the period.
  const wrapped = `Current courses
Course code Description Result Credits
2026-2027-100-
BCS2120 Introduction to Artificial Intelligence - 0,0/4,0
2026-2027-100-BCS2140 Operating Systems - 0,0/4,0`
  const result = parseAcademicWork(wrapped)
  assert.deepEqual(result.courses.map((course) => course.code), ['BCS2120', 'BCS2140'])
  assert.equal(result.courses[0].name, 'Introduction to Artificial Intelligence')
})

test('the older My Study layout with the course code on the following line is read', () => {
  const printed = `Current courses
Course code Description Result Credits
2026-2027-100- Introduction to Artificial Intelligence - 0,0/4,0
BCS2120
Completed courses
2024-2025-200- Discrete Mathematics 7,5 4,0/4,0
BCS1120`
  const result = parseAcademicWork(printed)
  assert.deepEqual(result.courses.map(({ code, name, status }) => ({ code, name, status })), [
    { code: 'BCS2120', name: 'Introduction to Artificial Intelligence', status: 'upcoming' },
    { code: 'BCS1120', name: 'Discrete Mathematics', status: 'passed' }
  ])
})

test('identities that are not a Maastricht course triple are refused', () => {
  assert.equal(parseCourseIdentity('BCS2120'), null)
  assert.equal(parseCourseIdentity('2026-2027-100'), null)
  assert.equal(parseCourseIdentity(''), null)
  assert.deepEqual(parseCourseIdentity('2026-2027-400-BCS2410'), { academicYear: '2026-2027', periodCode: '400', period: 'Period 4', code: 'BCS2410' })
})

test('an unreadable or wrong document is refused with an actionable message', () => {
  assert.throws(() => parseAcademicWork(''), (error) => error instanceof AcademicWorkError && /no readable text/.test(error.message))
  assert.throws(() => parseAcademicWork('Some other PDF entirely.\nNothing tabular here.'), (error) => error instanceof AcademicWorkError && /Academic Work/.test(error.message))
})

test('two uploads are compared so the student sees the movement, not the document', () => {
  const before = parseAcademicWork(OVERVIEW)
  const after = parseAcademicWork(OVERVIEW
    // The retake passed.
    .replace('2025-2026-500-BCS2220 Principles of Programming Languages 5,0 0,0/4,0', '')
    .replace('2023-2024-003-BCS1300 Project 1-2 7,0 10,0/10,0', '2023-2024-003-BCS1300 Project 1-2 7,0 10,0/10,0\n2025-2026-500-BCS2220 Principles of Programming Languages 6,0 4,0/4,0'))

  const progress = compareAcademicWork(before, after)
  assert.equal(progress.ectsDelta, 4)
  assert.equal(progress.passedDelta, 1)
  assert.deepEqual(progress.newlyPassed.map((course) => course.code), ['BCS2220'])
  const changed = progress.changes.find((change) => change.course.code === 'BCS2220')
  assert.deepEqual({ type: changed.type, from: changed.from.status, to: changed.course.status }, { type: 'changed', from: 'failed', to: 'passed' })
})

test('comparing against nothing reports the whole first upload as progress', () => {
  const first = parseAcademicWork(OVERVIEW)
  const progress = compareAcademicWork(null, first)
  assert.equal(progress.ectsDelta, 18)
  assert.equal(progress.changes.length, 10)
  assert.ok(progress.changes.every((change) => change.type === 'new'))
  assert.deepEqual(summariseAcademicWork([]), { earnedEcts: 0, passedCourses: 0, failedAttempts: 0, currentCourses: 0, weightedAverage: null, academicYears: [] })
})

test('a snapshot records the derived record and never the document', async () => {
  const { academicProgress, deleteAcademicSnapshots, recordAcademicSnapshot, snapshotHash } = await import('../lib/academic-snapshots.mjs')
  const { withRequestContext } = await import('../lib/request-context.mjs')
  const { rm } = await import('node:fs/promises')
  const { randomUUID } = await import('node:crypto')
  const { dirname, join, resolve } = await import('node:path')
  const { fileURLToPath } = await import('node:url')

  const owner = `user_snap_${randomUUID().slice(0, 8)}`
  const asOwner = (callback) => withRequestContext({ userId: owner, mode: 'clerk' }, callback)
  try {
    const first = parseAcademicWork(OVERVIEW)
    const stored = await asOwner(() => recordAcademicSnapshot({ kind: first.kind, sourceLabel: 'Academic Work.pdf', printedOn: first.printedOn, courses: first.courses, summary: first.summary }))
    assert.equal(stored.unchanged, false)
    assert.equal(stored.snapshot.summary.earnedEcts, 18)
    // The first upload is progress from nothing.
    assert.equal(stored.progress.ectsDelta, 18)
    // Nothing resembling the document itself is kept.
    const serialised = JSON.stringify(stored.snapshot)
    assert.ok(!/not an official document|printed by the student|page 1\/2/.test(serialised), 'only derived rows are stored')

    // Printing the same record again changes the file but says nothing new.
    const reprint = parseAcademicWork(OVERVIEW.replace('30 Aug 2026', '14 Sep 2026'))
    assert.equal(snapshotHash(reprint.courses), snapshotHash(first.courses), 'the print date is not part of the record')
    const again = await asOwner(() => recordAcademicSnapshot({ kind: reprint.kind, sourceLabel: 'Academic Work.pdf', printedOn: reprint.printedOn, courses: reprint.courses, summary: reprint.summary }))
    assert.equal(again.unchanged, true)
    assert.equal(again.progress, null)

    const passedRetake = parseAcademicWork(OVERVIEW
      .replace('2025-2026-500-BCS2220 Principles of Programming Languages 5,0 0,0/4,0', '')
      .replace('2023-2024-003-BCS1300 Project 1-2 7,0 10,0/10,0', '2023-2024-003-BCS1300 Project 1-2 7,0 10,0/10,0\n2025-2026-500-BCS2220 Principles of Programming Languages 6,0 4,0/4,0'))
    const second = await asOwner(() => recordAcademicSnapshot({ kind: passedRetake.kind, sourceLabel: 'Academic Work.pdf', printedOn: '14 Sep 2026', courses: passedRetake.courses, summary: passedRetake.summary }))
    assert.equal(second.unchanged, false)
    assert.equal(second.progress.ectsDelta, 4)
    assert.deepEqual(second.progress.newlyPassed.map((course) => course.code), ['BCS2220'])

    const progress = await asOwner(() => academicProgress())
    assert.equal(progress.snapshots.length, 2)
    assert.equal(progress.since.ectsDelta, 4)
    assert.deepEqual(progress.series.map((point) => point.earnedEcts), [18, 22], 'the series runs oldest to newest')
    assert.equal(progress.snapshots[0].courses, undefined, 'a listing carries totals, not the whole record')
  } finally {
    await asOwner(() => deleteAcademicSnapshots())
    await rm(join(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data/users'), owner), { recursive: true, force: true })
  }
})
