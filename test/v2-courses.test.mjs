// Course study rules.
//
// Read-state lives in localStorage under the vanilla app's own key format, so
// the two halves of the product must agree about what has been read while both
// are running. That agreement is the thing worth pinning.

import test from 'node:test'
import assert from 'node:assert/strict'
import { academicCourseFor, byNextExam, canvasCourseQuery, chaptersRead, compareByNextExam, courseProgress, isMaterialPath, masteryPercent, materialName, nextExam, readChapters, readKey } from '../lib/workspace/courses.mjs'
import {
  cleanCanvasName,
  courseMaterialCoverage,
  courseLedger,
  currentSourceCoverage,
  degreeRunwayYears,
  filterLedger,
  ledgerStatus,
  materialSummary,
  periodLabel,
  reconcileCourses,
  rowDestination,
  sortLedger
} from '../lib/workspace/course-ledger.mjs'

const course = (id, code, chapters = [], items = []) => ({
  id, code, name: code, chapters: chapters.map((c) => ({ id: c, name: c })), items
})

/** A minimal stand-in for Storage, in key order. */
const storage = (keys) => ({
  length: keys.length,
  key: (index) => keys[index] ?? null
})

test('read-state is read from the vanilla app\'s own keys', () => {
  assert.equal(readKey('alg', '01'), 'chapter-read:alg/01')
  const read = readChapters(storage(['chapter-read:alg/01', 'unrelated', 'chapter-read:stat/03']))
  assert.deepEqual([...read].sort(), ['alg/01', 'stat/03'])
})

test('no storage at all is no reads, not a crash', () => {
  assert.equal(readChapters(null).size, 0)
})

test('only this course\'s chapters count towards its progress', () => {
  const read = readChapters(storage(['chapter-read:alg/01', 'chapter-read:stat/01']))
  const alg = course('alg', 'BCS1540', ['01', '02', '03', '04'])
  assert.equal(chaptersRead(alg, read), 1)
  assert.deepEqual(courseProgress(alg, read), { total: 4, done: 1, percent: 25, mastery: null })
})

test('a course with no chapters reports zero rather than dividing by it', () => {
  assert.deepEqual(courseProgress(course('x', 'X'), new Set()), { total: 0, done: 0, percent: 0, mastery: null })
})

test('mastery is a share of the 0-4 scale, and absent when nothing is set up', () => {
  assert.equal(masteryPercent(course('a', 'A', [], [{ mastery: 4 }, { mastery: 2 }])), 75)
  assert.equal(masteryPercent(course('a', 'A', [], [{ mastery: 0 }, { mastery: 0 }])), 0)
  // No items is unknown, not zero — the distinction the ledger has to show.
  assert.equal(masteryPercent(course('a', 'A', [], [])), null)
})

test('the next exam is the soonest one still ahead, matched by code', () => {
  const academic = [{ code: 'bcs1540', attempts: [
    { examDate: '2026-09-01', type: 'Exam' },
    { examDate: '2026-10-14', type: 'Exam' },
    { examDate: '2026-12-01', type: 'Resit' }
  ] }]
  const exam = nextExam(course('alg', 'BCS1540'), academic, '2026-09-02')
  assert.equal(exam.date, '2026-10-14')
  assert.equal(exam.days, 42)
  // Case does not decide whether a student's own record matches their course.
  assert.equal(nextExam(course('alg', 'bcs1540'), academic, '2026-09-02').date, '2026-10-14')
  assert.equal(nextExam(course('other', 'BCS9999'), academic, '2026-09-02'), null)
})

test('a course with only past attempts has no next exam', () => {
  const academic = [{ code: 'BCS1540', attempts: [{ examDate: '2026-01-01' }] }]
  assert.equal(nextExam(course('alg', 'BCS1540'), academic, '2026-09-02'), null)
})

test('courses order by the exam that comes first, undated ones last', () => {
  const academic = [
    { code: 'B', attempts: [{ examDate: '2026-10-20' }] },
    { code: 'C', attempts: [{ examDate: '2026-09-30' }] }
  ]
  const ordered = byNextExam(
    [course('a', 'A'), course('b', 'B'), course('c', 'C')],
    academic,
    '2026-09-02'
  )
  assert.deepEqual(ordered.map((entry) => entry.code), ['C', 'B', 'A'])
})

test('course context joins private planning by normalized course code', () => {
  const academic = [{ code: ' bcs1540 ', attempts: [] }]
  assert.equal(academicCourseFor(course('alg', 'BCS1540'), academic), academic[0])
  assert.equal(academicCourseFor(course('x', ''), academic), null)
})

test('Canvas archive search prefers the stable course code', () => {
  assert.equal(canvasCourseQuery({ code: ' BCS1540 ', name: 'Algorithms' }), 'BCS1540')
  assert.equal(canvasCourseQuery({ code: '', name: ' Algorithms ' }), 'Algorithms')
})

// ── The comparator ─────────────────────────────────────────────────────────
// The ledger used to order itself by calling byNextExam from inside its own
// comparator, which sorts once per comparison and is not a total order. The
// rule is now the comparator, and these pin that it behaves like one.

test('the exam order is a comparator, usable on its own', () => {
  const academic = [
    { code: 'B', attempts: [{ examDate: '2026-10-20' }] },
    { code: 'C', attempts: [{ examDate: '2026-09-30' }] }
  ]
  const compare = compareByNextExam(academic, '2026-09-02')
  assert.ok(compare(course('c', 'C'), course('b', 'B')) < 0)
  assert.ok(compare(course('b', 'B'), course('a', 'A')) < 0)
  assert.equal(compare(course('a', 'A'), course('a', 'A')), 0)
})

test('the comparator is antisymmetric and transitive over the whole ledger', () => {
  const academic = [
    { code: 'B', attempts: [{ examDate: '2026-10-20' }] },
    { code: 'C', attempts: [{ examDate: '2026-09-30' }] },
    { code: 'D', attempts: [{ examDate: '2026-09-30' }] }
  ]
  const compare = compareByNextExam(academic, '2026-09-02')
  const all = ['A', 'B', 'C', 'D', 'E'].map((code) => course(code.toLowerCase(), code))
  for (const left of all) {
    for (const right of all) {
      assert.equal(Math.sign(compare(left, right)) + Math.sign(compare(right, left)), 0)
    }
  }
  // C and D share a date, so the code decides rather than the array order.
  assert.ok(compare(all[2], all[3]) < 0)
  assert.deepEqual([...all].reverse().sort(compare).map((entry) => entry.code), ['C', 'D', 'B', 'A', 'E'])
})

// ── Reconciliation ─────────────────────────────────────────────────────────
// Four sources describe the same course and only the code joins them.

const corpusCourse = (code, name, extra = {}) => ({ id: `canvas-${code}`, courseCode: code, courseName: name, sources: 0, ...extra })

test('one row per course code, whatever the case each source uses', () => {
  const rows = reconcileCourses({
    editorial: [{ id: 'alg', code: 'BCS1540', name: 'Algorithms', chapters: [{ id: '01', name: 'One' }] }],
    academic: [{ id: 'rec-1', code: 'bcs1540', name: 'Algorithms and Data Structures', attempts: [] }],
    corpus: [corpusCourse('BCS1540', 'Algorithms (2025-2026-200-BCS1540)', { sources: 7 })]
  })
  assert.equal(rows.length, 1)
  const [row] = rows
  assert.equal(row.key, 'BCS1540')
  assert.equal(row.editorial.id, 'alg')
  assert.equal(row.academic.id, 'rec-1')
  assert.equal(row.corpus.sources, 7)
  // The student's own record names their own course; Canvas, which knows the
  // course least well, never overwrites a name the other two supplied.
  assert.equal(row.name, 'Algorithms and Data Structures')
})

test('Canvas retake editions contribute to one course row and retain both years', () => {
  const [row] = reconcileCourses({
    corpus: [
      corpusCourse('BCS2140', 'Operating Systems (2024-2025-100-BCS2140)', { id: 'old', academicYear: '2024-2025', period: '1', sources: 18 }),
      corpusCourse('bcs2140', 'Operating Systems (2026-2027-100-BCS2140)', { id: 'new', academicYear: '2026-2027', period: '1', sources: 24 })
    ]
  })
  assert.equal(row.code, 'BCS2140')
  assert.equal(row.corpus.sources, 42)
  assert.equal(row.corpus.editionCount, 2)
  assert.deepEqual(row.corpus.academicYears, ['2026-2027', '2024-2025'])
  assert.deepEqual(row.corpus.editions.map((edition) => edition.id), ['new', 'old'])
})

test('the degree runway counts ECTS and keeps unchosen elective credit visible', () => {
  const years = degreeRunwayYears({
    programme: { durationYears: 3, totalEcts: 180 },
    version: { courses: [
      { id: 'core', code: 'BCS2510', name: 'Core', yearLevel: 'Year 3', requirement: 'required', ects: 30 },
      { id: 'elective-a', code: 'BCS3120', name: 'Elective A', yearLevel: 'Year 3', requirement: 'elective', ects: 4 },
      { id: 'elective-b', code: 'BCS3130', name: 'Elective B', yearLevel: 'Year 3', requirement: 'elective', ects: 4 }
    ] },
    programmeTemplate: { currentStudyYear: 'Year 3', selectedChoices: { year3: ['elective-a'] } },
    academic: [
      { code: 'BCS2510', ects: 30, attempts: [{ status: 'passed', grade: 7 }] },
      { code: 'BCS3130', ects: 4, attempts: [{ status: 'passed', grade: 8, academicYear: '2024-2025', period: 'Period 4' }] }
    ],
    currentCodes: new Set()
  })
  const year = years.find((entry) => entry.label === 'Year 3')

  assert.equal(year.targetEcts, 60)
  assert.equal(year.earnedEcts, 34)
  assert.equal(year.mappedEcts, 38, 'the selected elective and passed historical elective both map into the current curriculum')
  assert.equal(year.openChoiceEcts, 22)
})

test('a recoded course is one passed row under the selected curriculum identity', () => {
  const catalogue = { programmes: [{ id: 'cs', durationYears: 3, totalEcts: 180, versions: [
    { id: '2026', courses: [{ id: 'current-os', code: 'BCS2140', name: 'Operating Systems', ects: 4, yearLevel: 'Year 3', period: 'Period 1', requirement: 'required' }] },
    { id: '2025', courses: [{ id: 'old-os', code: 'BCS3420', name: 'Operating Systems', ects: 4, yearLevel: 'Year 2', period: 'Period 4', requirement: 'required' }] }
  ] }] }
  const rows = reconcileCourses({
    catalogue,
    programmeTemplate: { programmeId: 'cs', versionId: '2026', currentStudyYear: 'Year 3' },
    academic: [{ id: 'historical-os', code: 'BCS3420', name: 'Operating Systems', ects: 4, yearLevel: 'Year 2', period: 'Period 4', programmeRequirement: 'historical', attempts: [{ id: 'old-sitting', academicYear: '2024-2025', status: 'passed', grade: 7 }] }]
  })

  assert.equal(rows.length, 1)
  assert.equal(rows[0].code, 'BCS2140')
  assert.equal(rows[0].academic.yearLevel, 'Year 3')
  assert.equal(rows[0].academic.attempts[0].courseCode, 'BCS3420')
  assert.equal(ledgerStatus(rows[0], new Set()).passed, true)
})

test('Canvas fills in a course nothing else has heard of, minus its section', () => {
  const [row] = reconcileCourses({ corpus: [corpusCourse('BCS2410', 'Embedded Programming (2025-2026-400-BCS2410)')] })
  assert.equal(row.name, 'Embedded Programming')
  assert.equal(row.code, 'BCS2410')
  assert.equal(row.archived, false)
})

test('the section suffix is stripped for the row\'s own code, not any code', () => {
  assert.equal(cleanCanvasName('Statistics (2025-2026-100-BCS1520)', 'BCS1520'), 'Statistics')
  assert.equal(cleanCanvasName('Statistics (2025-2026-100-BCS1520)', 'BCS1540'), 'Statistics (2025-2026-100-BCS1520)')
  // A code is data, not a pattern.
  assert.equal(cleanCanvasName('Odd (2025-2026-100-A.C)', 'A.C'), 'Odd')
  assert.equal(cleanCanvasName('Plain name', ''), 'Plain name')
})

test('the catalogue preserves richer course identity and adds missing courses', () => {
  const catalogue = { programmes: [{ id: 'p', versions: [{ id: 'v', courses: [
    { id: 'cat-1', code: 'BCS1540', name: 'Catalogue name' },
    { id: 'cat-2', code: 'BCS3000', name: 'Later course', period: '4' }
  ] }] }] }
  const rows = reconcileCourses({
    editorial: [{ id: 'alg', code: 'BCS1540', name: 'Algorithms' }],
    catalogue,
    programmeTemplate: { programmeId: 'p', versionId: 'v' }
  })
  assert.deepEqual(rows.map((row) => row.name), ['Algorithms', 'Later course'])
  // A catalogued course records no attempt, so nothing can read one from it.
  assert.deepEqual(rows[1].academic.attempts, [])
})

test('archived stays with the editorial record it came from', () => {
  const rows = reconcileCourses({
    editorial: [{ id: 'old', code: 'BCS1000', name: 'Retired', archived: true }],
    academic: [{ id: 'rec', code: 'BCS1000', attempts: [] }]
  })
  assert.equal(rows[0].archived, true)
})

test('the ledger orders study-ready courses by exam, then records, then the rest', () => {
  const academic = [{ code: 'BCS1540', attempts: [{ examDate: '2026-10-20' }] }, { code: 'BCS1520', attempts: [{ examDate: '2026-09-30' }] }]
  const ledger = courseLedger({
    editorial: [
      { id: 'alg', code: 'BCS1540', name: 'Algorithms' },
      { id: 'stat', code: 'BCS1520', name: 'Statistics' }
    ],
    academic: [...academic, { id: 'rec', code: 'BCS2410', name: 'Embedded', attempts: [] }],
    corpus: [corpusCourse('BCS9000', 'Only in Canvas')],
    today: '2026-09-02'
  })
  assert.deepEqual(ledger.map((row) => row.code), ['BCS1520', 'BCS1540', 'BCS2410', 'BCS9000'])
})

// ── What a row offers ──────────────────────────────────────────────────────

test('a row states its own destination rather than hiding three of them', () => {
  const study = rowDestination({ key: 'A', code: 'A', name: 'A', editorial: { id: 'alg', code: 'A', chapters: [{ id: '01' }, { id: '02' }] }, archived: false })
  assert.deepEqual(study, { kind: 'study', href: '/app/courses/alg', action: '2 chapters', chapters: 2 })

  const single = rowDestination({ key: 'B', code: 'B', name: 'B', editorial: { id: 'one', code: 'B', chapters: [{ id: '01' }] }, archived: false })
  assert.equal(single.action, '1 chapter')

  const request = rowDestination({ key: 'C', code: 'C', name: 'C', academic: { id: 'rec-9', code: 'C' }, archived: false })
  assert.deepEqual(request, { kind: 'request', href: '/app/course-request/rec-9', action: 'Request this course', chapters: 0 })

  const canvas = rowDestination({ key: 'D E', code: 'D E', name: 'D', archived: false })
  assert.equal(canvas.kind, 'canvas')
  assert.equal(canvas.href, '/app/updates?tab=materials&courseCode=D%20E')
  assert.equal(canvas.action, 'See Canvas material')

  const timetable = rowDestination({ key: 'F', code: 'F', name: 'Field lab', calendar: { code: 'F' }, archived: false })
  assert.deepEqual(timetable, { kind: 'calendar', href: '/app/calendar', action: 'Open calendar', chapters: 0 })
})

test('material summary names what is behind a row with no chapters', () => {
  assert.equal(materialSummary({ editorial: { chapters: [{ id: '01' }] } }), null)
  assert.equal(materialSummary({ editorial: { chapters: [] } }), 'No chapters published')
  assert.equal(materialSummary({ corpus: { sources: 12 } }), '12 sources indexed')
  assert.equal(materialSummary({ corpus: { sources: 0 } }), 'Material import queued')
  assert.equal(materialSummary({ calendar: { code: 'Y' } }), 'Timetable only')
  assert.equal(materialSummary({ academic: { code: 'X' } }), 'Course record only')
})

test('a timetable-only current course remains in the register and coverage denominator', () => {
  const currentCourses = [{ code: 'LAB9000', name: 'Field lab', reasons: ['timetable'], outsidePlan: true }]
  const ledger = courseLedger({ currentCourses, today: '2026-09-03' })

  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].name, 'Field lab')
  assert.deepEqual(filterLedger(ledger, { scope: 'current', currentCourses }).map((row) => row.code), ['LAB9000'])
  assert.deepEqual(currentSourceCoverage({ ledger, currentCourses, academic: [] }), [
    { id: 'record', covered: 0, total: 1, percent: 0 },
    { id: 'canvas', covered: 0, total: 1, percent: 0 },
    { id: 'library', covered: 0, total: 1, percent: 0 }
  ])
})

test('catalogue placement enriches a maintained course without replacing its material', () => {
  const [entry] = courseLedger({
    editorial: [{ id: 'study-a', code: 'A', name: 'Algorithms', chapters: [{ id: '01' }] }],
    catalogue: { programmes: [{ id: 'p', versions: [{ id: 'v', courses: [{ id: 'catalogue-a', code: 'A', name: 'Algorithms', yearLevel: 'Year 2', period: '3' }] }] }] },
    programmeTemplate: { programmeId: 'p', versionId: 'v' }
  })
  assert.equal(entry.editorial.id, 'study-a')
  assert.equal(entry.academic.yearLevel, 'Year 2')
  assert.equal(entry.academic.period, '3')
  assert.deepEqual(entry.academic.attempts, [])
})

test('material coverage counts only retrievable material channels', () => {
  assert.deepEqual(courseMaterialCoverage({}), { percent: 0, available: 0, total: 2, detail: 'No material channel', library: false, canvas: false })
  assert.equal(courseMaterialCoverage({ editorial: { chapters: [{ id: '01' }] } }).percent, 50)
  assert.equal(courseMaterialCoverage({ editorial: { chapters: [{ id: '01' }] }, corpus: { sources: 4 } }).percent, 100)
})

test('source coverage is scoped to calendar-current courses', () => {
  const ledger = [
    { key: 'A', code: 'A', editorial: { chapters: [{ id: '01' }] }, corpus: { sources: 3 }, academic: { code: 'A', attempts: [] }, archived: false },
    { key: 'B', code: 'B', academic: { code: 'B', attempts: [] }, archived: false },
    { key: 'C', code: 'C', editorial: { chapters: [{ id: '01' }] }, academic: { code: 'C', attempts: [] }, archived: false }
  ]
  assert.deepEqual(currentSourceCoverage({ ledger, currentCourses: ['A', 'B'], academic: [{ code: 'A' }, { code: 'B' }] }), [
    { id: 'record', covered: 2, total: 2, percent: 100 },
    { id: 'canvas', covered: 1, total: 2, percent: 50 },
    { id: 'library', covered: 1, total: 2, percent: 50 }
  ])
})

// ── Narrowing ──────────────────────────────────────────────────────────────
// Pass and fail are academics.mjs's definition, asked rather than re-guessed
// from the wording of an attempt's status.

const ledgerFixture = () => [
  { key: 'PASS', code: 'PASS', name: 'Passed course', academic: { code: 'PASS', passMark: 5.5, attempts: [{ grade: 7.5 }] }, archived: false },
  { key: 'FAIL', code: 'FAIL', name: 'Failed course', academic: { code: 'FAIL', passMark: 5.5, attempts: [{ grade: 4 }] }, archived: false },
  { key: 'NOW', code: 'NOW', name: 'Running course', academic: { code: 'NOW', attempts: [{ examDate: '2026-11-01' }] }, archived: false },
  { key: 'LATER', code: 'LATER', name: 'Later course', academic: { code: 'LATER', attempts: [] }, archived: false },
  { key: 'GONE', code: 'GONE', name: 'Archived course', editorial: { id: 'gone', code: 'GONE', archived: true }, archived: true }
]

test('each scope selects the courses it names', () => {
  const ledger = ledgerFixture()
  const scope = (value) => filterLedger(ledger, { scope: value, currentCourses: [{ code: 'now' }] }).map((row) => row.code)
  assert.deepEqual(scope('passed'), ['PASS'])
  assert.deepEqual(scope('failed'), ['FAIL'])
  assert.deepEqual(scope('current'), ['NOW'])
  // A failed course is outstanding, but it has its own scope; "future" is what
  // has not been attempted at all.
  assert.deepEqual(scope('future'), ['LATER'])
  assert.deepEqual(scope('archived'), ['GONE'])
  assert.deepEqual(scope('all').length, 5)
})

test('a passed course is never also current, however the calendar reads', () => {
  const rows = filterLedger(ledgerFixture(), { scope: 'current', currentCourses: [{ code: 'PASS' }, { code: 'NOW' }] })
  assert.deepEqual(rows.map((row) => row.code), ['NOW'])
})

test('search narrows on code and name together', () => {
  const ledger = ledgerFixture()
  assert.deepEqual(filterLedger(ledger, { scope: 'all', query: 'archived' }).map((row) => row.code), ['GONE'])
  assert.deepEqual(filterLedger(ledger, { scope: 'all', query: 'fail' }).map((row) => row.code), ['FAIL'])
  assert.deepEqual(filterLedger(ledger, { scope: 'all', query: '  ' }).length, 5)
})

test('every sort is a total order over the same rows', () => {
  const ledger = ledgerFixture()
  const codes = (sort) => sortLedger(ledger, { sort, academic: [], today: '2026-09-02' }).map((row) => row.code)
  assert.deepEqual(codes('code'), ['FAIL', 'GONE', 'LATER', 'NOW', 'PASS'])
  assert.deepEqual(codes('name').length, 5)
  assert.deepEqual(codes('period').length, 5)
  // Sorting does not consume the ledger it was given.
  assert.equal(ledger.length, 5)
})

test('period sort puts dated exams first, then teaching period', () => {
  const academic = [{ code: 'B', attempts: [{ examDate: '2026-10-20' }] }]
  const rows = sortLedger([
    { key: 'A', code: 'A', name: 'A', academic: { code: 'A', period: '4', attempts: [] }, archived: false },
    { key: 'C', code: 'C', name: 'C', academic: { code: 'C', period: '2', attempts: [] }, archived: false },
    { key: 'B', code: 'B', name: 'B', editorial: { id: 'b', code: 'B' }, archived: false }
  ], { sort: 'period', academic, today: '2026-09-02' })
  assert.deepEqual(rows.map((row) => row.code), ['B', 'C', 'A'])
})

test('a period is labelled once, not twice', () => {
  assert.equal(periodLabel('2'), 'Period 2')
  assert.equal(periodLabel('Period 2'), 'Period 2')
  assert.equal(periodLabel(''), null)
  assert.equal(periodLabel(null), null)
})

// ── Sources are named, never pathed ────────────────────────────────────────

test('a cited source is named the way a student would name it', () => {
  assert.equal(materialName('Materials/02 Lecture Slides/cs1540-week1-intro-greedy_flattened.pdf'), 'Lecture slides, week 1')
  assert.equal(materialName('Materials/04 Tutorial Exercises/Week1-ExercisesSlide.pdf'), 'Tutorial exercises, week 1')
  assert.equal(materialName('Materials/00 Exam Critical/Formula Sheet 2026.pdf'), 'Formula Sheet 2026')
  assert.equal(materialName('Materials/Lecture 6 - ARM ISA - Operations.pdf'), 'Lecture 6 - ARM ISA - Operations')
  assert.equal(materialName('Materials/05 Homework/Homework2-DynamicProgramming.pdf'), 'Homework 2 Dynamic Programming')
  // A folder is a shelf, and the root is the whole shelf.
  assert.equal(materialName('Materials/01 Lectures/'), 'Lectures')
  assert.equal(materialName('Materials/'), 'Course material')
  assert.equal(materialName(''), 'Course material')
})

test('only real documents become a named source', () => {
  assert.equal(isMaterialPath('Materials/01 Lectures/Lecture 1.pdf'), true)
  assert.equal(isMaterialPath('exam-model-solutions.pdf'), true)
  assert.equal(isMaterialPath('O(n log n)'), false)
  assert.equal(isMaterialPath('array.sort'), false)
  assert.equal(isMaterialPath(''), false)
  assert.equal(isMaterialPath('a\nb.pdf'), false)
})
