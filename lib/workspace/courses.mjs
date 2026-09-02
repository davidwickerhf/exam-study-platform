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

/** Soonest exam first; courses with no date sit after those that have one. */
export function byNextExam(courses, academicCourses, today) {
  return [...courses].sort((left, right) => {
    const a = nextExam(left, academicCourses, today)
    const b = nextExam(right, academicCourses, today)
    if (a && b) return a.days - b.days
    if (a) return -1
    if (b) return 1
    return String(left.code).localeCompare(String(right.code))
  })
}

export function academicCourseFor(course, academicCourses) {
  const code = String(course?.code ?? '').trim().toUpperCase()
  return code ? (academicCourses ?? []).find((entry) => String(entry?.code ?? '').trim().toUpperCase() === code) ?? null : null
}

export function canvasCourseQuery(course) {
  return String(course?.code ?? '').trim() || String(course?.name ?? '').trim()
}
