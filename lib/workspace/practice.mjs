/**
 * Practice rules.
 *
 * Four sub-modes share one page and almost nothing else: a published question
 * bank, an SM-2 flashcard deck, the mistake bank and the mock log. What they
 * do share is a set of small judgements about the data that are easy to get
 * quietly wrong, so they live here rather than inside the page.
 *
 * Three of those judgements are corrections to the vanilla behaviour.
 *
 * 1. **A question id is not unique.** Ids are only unique inside a chapter —
 *    the bank has 553 questions under 214 distinct ids, because every course's
 *    chapter 01 numbers its generated questions `gen-01-0`, `gen-01-1`, and so
 *    on. Anything that identifies a question has to carry its course and
 *    chapter too, hence `questionKey`.
 *
 * 2. **Absent is not medium.** The vanilla card ran every question through a
 *    normaliser that turned a missing difficulty into `medium` and an
 *    unrecognised type into `written`. Sixty-two questions in the current bank
 *    carry no difficulty at all, and were being labelled medium. Here an
 *    absent difficulty is absent, and an unknown type is shown as itself.
 *
 * 3. **Only a choice question has choices.** Generated questions carry an
 *    `options` array whatever their type: usually four empty strings, and in
 *    one chapter the generator's literal placeholders `string1`, `string2`,
 *    `string3`. The vanilla flashcard view filtered blanks but not the
 *    placeholders, so those cards offered three fake answers. `usableOptions`
 *    is the single place that decides what counts as a real choice.
 */

export const QUESTION_TYPE_LABELS = {
  written: 'Written',
  calc: 'Calculation',
  tf: 'True/False',
  mc: 'Best option',
  multi: 'Multi-select',
  pseudocode: 'Pseudocode'
}

export const DIFFICULTIES = ['easy', 'medium', 'hard']

/** Question types that actually present a list of answers to choose between. */
export const CHOICE_TYPES = ['mc', 'multi']

/** What the question generator leaves behind when a schema field is unused. */
const OPTION_PLACEHOLDER = /^string\s*\d+$/i

/** An unrecognised type is reported as itself, never relabelled `Written`. */
export function typeLabel(type) {
  const key = String(type ?? '').trim()
  if (!key) return null
  return QUESTION_TYPE_LABELS[key] ?? key
}

/** Absent difficulty is absent — the card simply does not carry the mark. */
export function difficultyLabel(question) {
  const value = String(question?.difficulty ?? '').trim().toLowerCase()
  if (!DIFFICULTIES.includes(value)) return null
  return value[0].toUpperCase() + value.slice(1)
}

/**
 * The choices a question really offers. Blank slots and the generator's
 * `string1` placeholders are not answers, and a single surviving choice is not
 * a choice, so both collapse to nothing.
 */
export function usableOptions(question) {
  if (!CHOICE_TYPES.includes(String(question?.type ?? ''))) return []
  const options = (Array.isArray(question?.options) ? question.options : [])
    .map((option) => String(option ?? '').trim())
    .filter((option) => option && !OPTION_PLACEHOLDER.test(option))
  return options.length > 1 ? options : []
}

/** Ids repeat across chapters, so identity is course + chapter + id. */
export function questionKey(question) {
  return `${question?.courseId ?? ''}/${question?.chapterId ?? ''}/${question?.id ?? ''}`
}

/** Courses present in the bank, with how many questions each contributes. */
export function courseFacets(questions) {
  const facets = new Map()
  for (const question of questions ?? []) {
    const existing = facets.get(question.courseId)
    if (existing) existing.count += 1
    else facets.set(question.courseId, { id: question.courseId, code: question.courseCode ?? question.courseId, name: question.courseName ?? '', count: 1 })
  }
  return [...facets.values()].sort((left, right) => String(left.code).localeCompare(String(right.code)))
}

/** Chapters of one course, in chapter order, with their question counts. */
export function chapterFacets(questions, courseId) {
  const facets = new Map()
  for (const question of questions ?? []) {
    if (courseId && courseId !== 'all' && question.courseId !== courseId) continue
    const key = `${question.courseId}/${question.chapterId}`
    const existing = facets.get(key)
    if (existing) existing.count += 1
    else facets.set(key, { key, courseId: question.courseId, courseCode: question.courseCode ?? question.courseId, chapterId: question.chapterId, chapterName: question.chapterName ?? '', count: 1 })
  }
  return [...facets.values()].sort((left, right) =>
    String(left.courseCode).localeCompare(String(right.courseCode)) || String(left.chapterId).localeCompare(String(right.chapterId)))
}

/** Question types present in the bank, most common first. */
export function typeFacets(questions) {
  const facets = new Map()
  for (const question of questions ?? []) {
    const type = String(question.type ?? '').trim()
    if (!type) continue
    facets.set(type, (facets.get(type) ?? 0) + 1)
  }
  return [...facets.entries()]
    .map(([id, count]) => ({ id, label: typeLabel(id), count }))
    .sort((left, right) => right.count - left.count || String(left.id).localeCompare(String(right.id)))
}

/**
 * The browse filter. `all` is the absence of a constraint on every axis, and
 * the search runs over what a student can see on the row — the question, its
 * course code, its chapter and where it came from — not the answer, so
 * searching never reveals one.
 */
export function filterQuestions(questions, filter = {}) {
  const { courseId = 'all', chapterKey = 'all', type = 'all', query = '' } = filter
  const needle = String(query).trim().toLowerCase()
  return (questions ?? []).filter((question) => {
    if (courseId !== 'all' && question.courseId !== courseId) return false
    if (chapterKey !== 'all' && `${question.courseId}/${question.chapterId}` !== chapterKey) return false
    if (type !== 'all' && question.type !== type) return false
    if (!needle) return true
    const haystack = [question.question, question.courseCode, question.chapterName, question.source].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

/** Chapter sections, in the order the questions arrive from the bank. */
export function groupByChapter(questions) {
  const groups = new Map()
  for (const question of questions ?? []) {
    const key = `${question.courseId}/${question.chapterId}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        courseId: question.courseId,
        courseCode: question.courseCode ?? question.courseId,
        chapterId: question.chapterId,
        chapterName: question.chapterName ?? '',
        questions: []
      })
    }
    groups.get(key).questions.push(question)
  }
  return [...groups.values()]
}

/**
 * SM-2's recall scale, as the server implements it in `sm2()`: anything below
 * 3 resets the repetition count and puts the card back tomorrow.
 */
export const SR_PASS = 3

export const SR_QUALITIES = [
  { value: 0, label: 'Blackout', hint: 'no recall at all' },
  { value: 1, label: 'Wrong', hint: 'wrong, but it looked familiar' },
  { value: 2, label: 'Almost', hint: 'wrong, and the answer was obvious' },
  { value: 3, label: 'Difficult', hint: 'right, with serious effort' },
  { value: 4, label: 'Hesitant', hint: 'right, after a pause' },
  { value: 5, label: 'Perfect', hint: 'right, immediately' }
]

export function passed(quality) {
  return Number(quality) >= SR_PASS
}

/**
 * The scheduling state of one card. Each part is dropped when the server has
 * not recorded it rather than defaulting — a card claiming "Ease 2.50" it was
 * never given is a fabricated number.
 */
export function cardLine(card) {
  const parts = []
  if (Number.isFinite(Number(card?.repetitions))) parts.push(`Reps ${Number(card.repetitions)}`)
  if (Number.isFinite(Number(card?.ease))) parts.push(`Ease ${Number(card.ease).toFixed(2)}`)
  if (Number.isFinite(Number(card?.interval))) parts.push(`Interval ${Number(card.interval)}d`)
  return parts.join(' · ')
}

/** A mock's score as a percentage, or null when it was never scored out of anything. */
export function mockPercent(session) {
  const max = Number(session?.totalMax)
  const score = Number(session?.totalScore)
  if (!Number.isFinite(max) || max <= 0) return null
  if (!Number.isFinite(score)) return null
  return Math.round((score / max) * 100)
}

/**
 * A mock's length in whole minutes. The vanilla table ran `(duration || 0) / 60`,
 * so a session with no recorded duration was published as "0 min" — a claim
 * about a sitting nobody timed. Absent stays absent here.
 */
export function mockMinutes(seconds) {
  // Number(null) is 0, which is exactly the confusion this function exists to
  // avoid, so absence is checked before arithmetic.
  if (seconds === null || seconds === undefined || seconds === '') return null
  const value = Number(seconds)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value / 60)
}

/** Mistakes gathered by the chapter they came from, newest group first. */
export function groupMistakes(mistakes) {
  const groups = new Map()
  for (const mistake of mistakes ?? []) {
    const chapterId = mistake.chapterId ?? null
    const key = `${mistake.courseId ?? ''}/${chapterId ?? ''}`
    if (!groups.has(key)) groups.set(key, { key, courseId: mistake.courseId ?? null, chapterId, items: [] })
    groups.get(key).items.push(mistake)
  }
  return [...groups.values()]
}

/**
 * The one line under the title. It states both queues even when one of them is
 * empty, because "2 waiting" alone does not say which surface to open.
 */
export function queueLine({ dueCount, mistakeCount, loaded } = {}) {
  if (!loaded) return 'Reading your queues…'
  const due = Number(dueCount) || 0
  const open = Number(mistakeCount) || 0
  const total = due + open
  if (!total) return 'Both queues are clear. Work through the published bank, or sit a timed mock.'
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
  return `${plural(total, 'item')} waiting — ${plural(due, 'flashcard')} due, ${plural(open, 'open mistake')}.`
}

/** How long ago something happened, in the coarsest unit that still says it. */
export function agoLabel(iso, now = Date.now()) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const seconds = Math.round((now - then) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d ago`
  return new Date(iso).toISOString().slice(0, 10)
}

/** The grading service accepts one canonical envelope across questions, retries and mocks. */
export function gradeRequest(question, attempt, courseCode, chapterName) {
  return {
    courseCode,
    chapterName,
    question: {
      id: question.id, type: question.type, difficulty: question.difficulty,
      question: question.question, options: question.options, expected: question.expected, source: question.source
    },
    attempt: String(attempt ?? '').trim(),
    _meta: { courseId: question.courseId, chapterId: question.chapterId }
  }
}

/** Pick without replacement. The injected random source makes the rule testable. */
export function sampleQuestions(questions, count, random = Math.random) {
  const pool = [...(questions ?? [])]
  const wanted = Math.max(1, Math.min(pool.length, Math.trunc(Number(count) || 5)))
  const result = []
  while (result.length < wanted && pool.length) {
    result.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  }
  return result
}

export function mockRemaining(startedAt, minutes, now = Date.now()) {
  return Math.max(0, Math.ceil((Number(startedAt) + Math.max(1, Number(minutes) || 15) * 60_000 - now) / 1000))
}

export function mockTimeLabel(seconds) {
  const safe = Math.max(0, Math.trunc(Number(seconds) || 0))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export function buildMockSession(run, graded, submittedAt = new Date()) {
  const ended = submittedAt instanceof Date ? submittedAt : new Date(submittedAt)
  const questions = graded ?? []
  return {
    id: `mock-${ended.getTime()}-${String(run.token ?? 'v2')}`,
    courseId: run.courseId,
    chapterId: run.chapterId,
    startedAt: new Date(run.startedAt).toISOString(),
    submittedAt: ended.toISOString(),
    duration: Math.max(0, Math.round((ended.getTime() - run.startedAt) / 1000)),
    questions,
    totalScore: questions.reduce((sum, question) => sum + (Number(question.score) || 0), 0),
    totalMax: questions.length * 10
  }
}

export function practiceLocation(input) {
  const raw = String(input ?? '').replace(/^#?\/?/, '').split('/').filter(Boolean)
  if (raw[0] === 'mistakes') return { tab: 'mistakes', sessionId: null }
  if (raw[0] === 'sr') return { tab: 'flashcards', sessionId: null }
  if (raw[0] === 'mocks') return { tab: 'mocks', sessionId: raw[1] ? decodeURIComponent(raw[1]) : null }
  if (raw[0] === 'practice') raw.shift()
  const tab = ['questions', 'flashcards', 'mistakes', 'mocks'].includes(raw[0]) ? raw[0] : 'questions'
  return { tab, sessionId: tab === 'mocks' && raw[1] ? decodeURIComponent(raw[1]) : null }
}
