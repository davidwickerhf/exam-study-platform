/**
 * Course study rules.
 *
 * Two things about the data are worth stating rather than discovering later.
 *
 * Chapter read-state lives in localStorage under `chapter-read:<course>/<id>`,
 * not on the server, so it is per-browser rather than per-account. The key
 * format is kept exactly so the migrated pages and the vanilla ones agree
 * about what has been read.
 *
 * Item mastery is a 0–4 scale the student sets by hand, and it lives on the
 * server in /api/state. The vanilla ledger showed a single "mastery %" that
 * blended reads, practice scores and flashcard state through several client
 * caches. Rather than publish a different number under the same label, the
 * migrated ledger reports the two things it can actually source — chapters
 * read, and mastery across the course's items — and names each of them.
 */

export const MASTERY_MAX = 4

export const READ_KEY_PREFIX = 'chapter-read:'

/**
 * Set by a course page when a chapter is opened from its register, read by the
 * chapter's back link. When they agree, "back" is a real history step and the
 * browser restores the register's scroll position for free.
 */
export const COURSE_RETURN_KEY = 'course-return'

export function readKey(courseId, chapterId) {
  return `${READ_KEY_PREFIX}${courseId}/${chapterId}`
}

/** Reads the vanilla app's own store, so both halves agree. */
export function readChapters(storage) {
  const read = new Set()
  if (!storage) return read
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key && key.startsWith(READ_KEY_PREFIX)) read.add(key.slice(READ_KEY_PREFIX.length))
  }
  return read
}

export function chaptersRead(course, read) {
  return (course.chapters ?? []).filter((chapter) => read.has(`${course.id}/${chapter.id}`)).length
}

/** Average of the mastery the student has set, as a percentage of the scale. */
export function masteryPercent(course) {
  const items = course.items ?? []
  if (!items.length) return null
  const total = items.reduce((sum, item) => sum + (Number(item.mastery) || 0), 0)
  return Math.round((total / (items.length * MASTERY_MAX)) * 100)
}

export function courseProgress(course, read) {
  const total = (course.chapters ?? []).length
  const done = chaptersRead(course, read)
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
    mastery: masteryPercent(course)
  }
}

/**
 * The soonest recorded exam for a course, matched to the academic record by
 * course code. A catalogue date is not a plan date, so it is reported
 * separately rather than mixed in.
 */
export function nextExam(course, academicCourses, today) {
  const match = (academicCourses ?? []).find((entry) =>
    String(entry.code ?? '').toUpperCase() === String(course.code ?? '').toUpperCase())
  if (!match) return null
  const dated = (match.attempts ?? [])
    .filter((attempt) => attempt.examDate && attempt.examDate.slice(0, 10) >= today)
    .sort((left, right) => left.examDate.localeCompare(right.examDate))
  if (!dated.length) return null
  const date = dated[0].examDate.slice(0, 10)
  const days = Math.round(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000)
  return { date, days, type: dated[0].type ?? null }
}

/**
 * A comparator, not a sort.
 *
 * Ordering a ledger needs the *rule*, not a sorted copy: calling a sorting
 * function from inside another comparator sorts once per comparison and does
 * not describe a total order. This returns the rule itself, and memoises each
 * course's next exam so a sort resolves it once per course rather than once
 * per comparison.
 */
export function compareByNextExam(academicCourses, today) {
  const seen = new Map()
  const exam = (course) => {
    if (!seen.has(course)) seen.set(course, nextExam(course, academicCourses, today))
    return seen.get(course)
  }
  return (left, right) => {
    const a = exam(left)
    const b = exam(right)
    if (a && b) return a.days - b.days || String(left.code ?? '').localeCompare(String(right.code ?? ''))
    if (a) return -1
    if (b) return 1
    return String(left.code ?? '').localeCompare(String(right.code ?? ''))
  }
}

/** Soonest exam first; courses with no date sit after those that have one. */
export function byNextExam(courses, academicCourses, today) {
  return [...courses].sort(compareByNextExam(academicCourses, today))
}

export function academicCourseFor(course, academicCourses) {
  const code = String(course?.code ?? '').trim().toUpperCase()
  return code ? (academicCourses ?? []).find((entry) => String(entry?.code ?? '').trim().toUpperCase() === code) ?? null : null
}

export function canvasCourseQuery(course) {
  return String(course?.code ?? '').trim() || String(course?.name ?? '').trim()
}

/* ── Source material, named rather than pathed ───────────────────────────────
 * Authored chapters cite their sources as repository paths
 * (`Materials/02 Lecture Slides/cs1540-week1-intro-greedy_flattened.pdf`).
 * A path is a fact about a disk, not about a course, and the design forbids
 * showing one. These rules turn a path into the name a student would use for
 * the same document — the shelf it sits on and the week it belongs to.
 * -------------------------------------------------------------------------- */

const DOCUMENT_FILE = /\.(pdf|pptx?|docx?|ipynb|xlsx?|csv|zip|md)$/i

/** True for the code spans that are really a document, not an identifier. */
export function isMaterialPath(value) {
  const text = String(value ?? '').trim()
  if (!text || text.length > 200 || text.includes('\n')) return false
  return /^materials\//i.test(text) || DOCUMENT_FILE.test(text)
}

/** "02 Lecture Slides" is a shelf label with a sort key stuck on the front. */
const shelf = (segment) => {
  const label = String(segment ?? '').replace(/^\d+[\s._-]*/, '').trim()
  return label ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : null
}

const readable = (filename) =>
  String(filename)
    .replace(/\.[^./]+$/, '')
    // A course code in a filename repeats what the page already says.
    .replace(/^[A-Za-z]{2,4}[\s._-]?\d{3,4}[\s._-]+/, '')
    .replace(/[_]+/g, ' ')
    // `week1-intro-greedy` is three words; `Lecture 6 - ARM ISA` is punctuation.
    .replace(/(\S)-(?=\S)/g, '$1 ')
    .replace(/\b(flattened|flat)\b/gi, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b([A-Za-z]{3,})(\d{1,4})\b/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()

const sentence = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '')

/**
 * The human name for a cited source: "Lecture slides, week 1" rather than
 * `Materials/02 Lecture Slides/cs1540-week1-intro-greedy_flattened.pdf`.
 */
export function materialName(path) {
  const text = String(path ?? '').trim().replace(/^\.?\//, '')
  if (!text) return 'Course material'
  const segments = text.split('/').filter(Boolean)
  const parts = /^materials$/i.test(segments[0] ?? '') ? segments.slice(1) : segments
  if (!parts.length) return 'Course material'
  const last = parts[parts.length - 1]
  if (text.endsWith('/')) return shelf(last) ?? 'Course material'
  const kind = parts.length > 1 ? shelf(parts[parts.length - 2]) : null
  const base = readable(last)
  const week = base.match(/\bweek\s*(\d+)/i)
  if (week) {
    const rest = base.replace(/\bweek\s*\d+\b/i, '').replace(/\s+/g, ' ').trim()
    const label = kind || sentence(rest)
    return label ? `${label}, week ${Number(week[1])}` : `Week ${Number(week[1])}`
  }
  return sentence(base) || kind || 'Course material'
}
