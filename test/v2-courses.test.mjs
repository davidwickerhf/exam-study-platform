// Course study rules.
//
// Read-state lives in localStorage under the vanilla app's own key format, so
// the two halves of the product must agree about what has been read while both
// are running. That agreement is the thing worth pinning.

import test from 'node:test'
import assert from 'node:assert/strict'
import { academicCourseFor, byNextExam, canvasCourseQuery, chaptersRead, courseProgress, masteryPercent, nextExam, readChapters, readKey } from '../lib/v2/courses.mjs'

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
