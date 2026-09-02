// Practice rules.
//
// Most of what follows pins a case that looks right and is quietly wrong: a
// question id that repeats across courses, a missing difficulty presented as
// "medium", a generator placeholder offered as an answer, and a mock nobody
// timed published as "0 min".

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SR_QUALITIES,
  agoLabel,
  cardLine,
  chapterFacets,
  courseFacets,
  difficultyLabel,
  filterQuestions,
  groupByChapter,
  groupMistakes,
  mockMinutes,
  mockPercent,
  passed,
  queueLine,
  questionKey,
  typeFacets,
  typeLabel,
  usableOptions
} from '../lib/v2/practice.mjs'
import { buildMockSession, gradeRequest, mockRemaining, mockTimeLabel, sampleQuestions } from '../lib/v2/practice.mjs'
import { practiceLocation } from '../lib/v2/practice.mjs'

const question = (overrides = {}) => ({
  id: 'gen-01-0',
  type: 'written',
  question: 'What is the greedy rule for interval selection?',
  expected: 'Earliest finish time.',
  courseId: 'alg',
  courseCode: 'BCS1540',
  courseName: 'Algorithmic Design',
  chapterId: '01',
  chapterName: 'Greedy Algorithms',
  ...overrides
})

test('an unknown type is shown as itself, not relabelled Written', () => {
  assert.equal(typeLabel('mc'), 'Best option')
  assert.equal(typeLabel('proof'), 'proof')
  assert.equal(typeLabel(''), null)
  assert.equal(typeLabel(undefined), null)
})

test('a question with no difficulty has no difficulty, not medium', () => {
  assert.equal(difficultyLabel({ difficulty: 'hard' }), 'Hard')
  assert.equal(difficultyLabel({ difficulty: 'HARD' }), 'Hard')
  // 62 of the 553 questions in the current bank arrive without one.
  assert.equal(difficultyLabel({}), null)
  assert.equal(difficultyLabel({ difficulty: 'trivial' }), null)
})

test('only a choice question offers choices', () => {
  const options = ['Earliest start', 'Shortest duration', 'Earliest finish', 'Latest finish']
  assert.deepEqual(usableOptions(question({ type: 'mc', options })), options)
  assert.deepEqual(usableOptions(question({ type: 'multi', options })), options)
  // A written question carries the same array; it is not a set of answers.
  assert.deepEqual(usableOptions(question({ type: 'written', options })), [])
})

test('the generator\'s placeholders are not answers', () => {
  // alg/01 ships eight questions whose options are literally these. The vanilla
  // flashcard view filtered blanks but not placeholders, and offered them.
  assert.deepEqual(usableOptions({ type: 'mc', options: ['string1', 'string2', 'string3'] }), [])
  assert.deepEqual(usableOptions({ type: 'mc', options: ['', '', '', ''] }), [])
  // One real choice among placeholders is not a choice either.
  assert.deepEqual(usableOptions({ type: 'mc', options: ['Earliest finish', 'string2', ''] }), [])
  assert.deepEqual(usableOptions({ type: 'mc', options: null }), [])
})

test('a question id is only unique inside its chapter', () => {
  // Every course numbers its chapter-01 questions the same way, so the bare id
  // is shared by five different questions.
  const alg = question({ courseId: 'alg', chapterId: '01', id: 'gen-01-4' })
  const nm = question({ courseId: 'nm', chapterId: '01', id: 'gen-01-4', courseCode: 'BCS2540' })
  assert.equal(alg.id, nm.id)
  assert.notEqual(questionKey(alg), questionKey(nm))
  assert.equal(questionKey(alg), 'alg/01/gen-01-4')
})

test('facets count what is in the bank, ordered by course code', () => {
  const bank = [
    question({ courseId: 'nm', courseCode: 'BCS2540', chapterId: '01', type: 'mc' }),
    question({ courseId: 'alg', courseCode: 'BCS1540', chapterId: '01', type: 'mc' }),
    question({ courseId: 'alg', courseCode: 'BCS1540', chapterId: '02', type: 'written' })
  ]
  assert.deepEqual(courseFacets(bank).map((facet) => [facet.code, facet.count]), [['BCS1540', 2], ['BCS2540', 1]])
  assert.deepEqual(chapterFacets(bank, 'alg').map((facet) => facet.key), ['alg/01', 'alg/02'])
  assert.deepEqual(chapterFacets(bank, 'all').length, 3)
  assert.deepEqual(typeFacets(bank).map((facet) => [facet.id, facet.count]), [['mc', 2], ['written', 1]])
})

test('the filter narrows on every axis at once, and `all` is no constraint', () => {
  const bank = [
    question({ courseId: 'alg', chapterId: '01', type: 'mc', question: 'Greedy interval selection' }),
    question({ courseId: 'alg', chapterId: '02', chapterName: 'Master Theorem', type: 'written', question: 'State it' }),
    question({ courseId: 'nm', chapterId: '01', chapterName: 'Root finding', type: 'mc', question: 'Newton iteration' })
  ]
  assert.equal(filterQuestions(bank).length, 3)
  assert.equal(filterQuestions(bank, { courseId: 'alg' }).length, 2)
  assert.equal(filterQuestions(bank, { chapterKey: 'alg/01' }).length, 1)
  assert.equal(filterQuestions(bank, { courseId: 'alg', type: 'mc' }).length, 1)
  assert.equal(filterQuestions(bank, { query: 'master' })[0].chapterId, '02')
  assert.equal(filterQuestions(bank, { courseId: 'nm', query: 'greedy' }).length, 0)
})

test('searching never reaches the answer', () => {
  const bank = [question({ question: 'Which rule applies?', expected: 'Earliest finish time' })]
  assert.equal(filterQuestions(bank, { query: 'earliest finish' }).length, 0)
  assert.equal(filterQuestions(bank, { query: 'which rule' }).length, 1)
})

test('chapters keep the order the bank returns them in', () => {
  const bank = [
    question({ chapterId: '01' }),
    question({ courseId: 'nm', chapterId: '01' }),
    question({ chapterId: '01' })
  ]
  const groups = groupByChapter(bank)
  assert.deepEqual(groups.map((group) => group.key), ['alg/01', 'nm/01'])
  assert.equal(groups[0].questions.length, 2)
})

test('the recall scale matches the server\'s SM-2 pass boundary', () => {
  assert.deepEqual(SR_QUALITIES.map((quality) => quality.value), [0, 1, 2, 3, 4, 5])
  // sm2() resets repetitions and schedules tomorrow for anything under 3.
  assert.deepEqual(SR_QUALITIES.map((quality) => passed(quality.value)), [false, false, false, true, true, true])
})

test('a card only reports the scheduling it was actually given', () => {
  assert.equal(cardLine({ repetitions: 3, ease: 2.5, interval: 6 }), 'Reps 3 · Ease 2.50 · Interval 6d')
  // A brand-new card really is at zero, and says so.
  assert.equal(cardLine({ repetitions: 0, ease: 2.5, interval: 0 }), 'Reps 0 · Ease 2.50 · Interval 0d')
  assert.equal(cardLine({}), '')
  assert.equal(cardLine(null), '')
})

test('a mock scored out of nothing has no percentage', () => {
  assert.equal(mockPercent({ totalScore: 7.5, totalMax: 10 }), 75)
  assert.equal(mockPercent({ totalScore: 0, totalMax: 10 }), 0)
  assert.equal(mockPercent({ totalScore: 7.5, totalMax: 0 }), null)
  assert.equal(mockPercent({ totalMax: 10 }), null)
  assert.equal(mockPercent(null), null)
})

test('a sitting nobody timed is not a sitting that took no time', () => {
  assert.equal(mockMinutes(1800), 30)
  assert.equal(mockMinutes(0), 0)
  // The vanilla table printed "0 min" here.
  assert.equal(mockMinutes(null), null)
  assert.equal(mockMinutes(undefined), null)
})

test('mistakes group by the chapter they came from, undated chapter included', () => {
  const groups = groupMistakes([
    { id: 'a', courseId: 'alg', chapterId: '01' },
    { id: 'b', courseId: 'alg', chapterId: '01' },
    { id: 'c', courseId: 'alg', chapterId: null },
    { id: 'd', courseId: 'nm', chapterId: '03' }
  ])
  assert.deepEqual(groups.map((group) => group.key), ['alg/01', 'alg/', 'nm/03'])
  assert.equal(groups[0].items.length, 2)
})

test('the queue line names both queues, and never claims one before it is read', () => {
  assert.equal(queueLine({ loaded: false }), 'Reading your queues…')
  assert.equal(queueLine({ loaded: true, dueCount: 0, mistakeCount: 0 }),
    'Both queues are clear. Work through the published bank, or sit a timed mock.')
  assert.equal(queueLine({ loaded: true, dueCount: 1, mistakeCount: 0 }),
    '1 item waiting — 1 flashcard due, 0 open mistakes.')
  assert.equal(queueLine({ loaded: true, dueCount: 2, mistakeCount: 1 }),
    '3 items waiting — 2 flashcards due, 1 open mistake.')
})

test('relative time coarsens, and absent stays absent', () => {
  const now = Date.parse('2026-09-02T12:00:00Z')
  assert.equal(agoLabel('2026-09-02T11:59:30Z', now), 'just now')
  assert.equal(agoLabel('2026-09-02T11:20:00Z', now), '40 min ago')
  assert.equal(agoLabel('2026-09-02T04:00:00Z', now), '8 h ago')
  assert.equal(agoLabel('2026-08-28T12:00:00Z', now), '5 d ago')
  assert.equal(agoLabel('2026-01-01T12:00:00Z', now), '2026-01-01')
  assert.equal(agoLabel(null, now), null)
  assert.equal(agoLabel('not a date', now), null)
})

test('grading uses the server envelope and trims the attempt', () => {
  const payload = gradeRequest(question(), '  earliest finish  ', 'BCS1540', 'Greedy Algorithms')
  assert.equal(payload.attempt, 'earliest finish')
  assert.deepEqual(payload._meta, { courseId: 'alg', chapterId: '01' })
  assert.equal(payload.question.question, question().question)
})

test('mock sampling is bounded and does not mutate the bank', () => {
  const bank = [question({ id: 'a' }), question({ id: 'b' }), question({ id: 'c' })]
  assert.deepEqual(sampleQuestions(bank, 2, () => 0).map((item) => item.id), ['a', 'b'])
  assert.equal(bank.length, 3)
  assert.equal(sampleQuestions(bank, 99, () => 0).length, 3)
})

test('mock clocks clamp at zero and format minutes', () => {
  assert.equal(mockRemaining(1_000, 1, 31_000), 30)
  assert.equal(mockRemaining(1_000, 1, 99_000), 0)
  assert.equal(mockTimeLabel(65), '1:05')
})

test('mock session totals preserve fractional grades', () => {
  const session = buildMockSession(
    { courseId: 'alg', chapterId: '01', startedAt: Date.parse('2026-09-02T10:00:00Z'), token: 'abc' },
    [{ score: 7.5 }, { score: 4 }],
    new Date('2026-09-02T10:12:00Z')
  )
  assert.equal(session.duration, 720)
  assert.equal(session.totalScore, 11.5)
  assert.equal(session.totalMax, 20)
})

test('legacy practice destinations map to URL-addressable V2 state', () => {
  assert.deepEqual(practiceLocation('/mistakes'), { tab: 'mistakes', sessionId: null })
  assert.deepEqual(practiceLocation('/sr'), { tab: 'flashcards', sessionId: null })
  assert.deepEqual(practiceLocation('/practice/mocks/mock%201'), { tab: 'mocks', sessionId: 'mock 1' })
})
