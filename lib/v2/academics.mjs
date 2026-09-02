/**
 * The academic record's rules.
 *
 * Plain ESM with a .d.mts beside it, for the same reason as lib/v2/home.mjs:
 * node:test imports the module the page uses, so there is one implementation
 * of each rule rather than a copy that drifts.
 */

/** A pass is the best graded attempt at or above the course's own pass mark. */
export function bestAttempt(course) {
  const graded = (course.attempts ?? []).filter((attempt) => typeof attempt.grade === 'number')
  if (!graded.length) return null
  return graded.reduce((best, attempt) => (attempt.grade > best.grade ? attempt : best))
}

export function courseStatus(course) {
  const best = bestAttempt(course)
  if (!best) {
    const registered = (course.attempts ?? []).some((attempt) => attempt.examDate || attempt.registered)
    return registered ? 'registered' : 'not-recorded'
  }
  return best.grade >= (course.passMark ?? 5.5) ? 'passed' : 'failed'
}

export const STATUS_LABEL = {
  passed: 'Passed',
  failed: 'Failed',
  registered: 'Registered',
  'not-recorded': 'Not recorded'
}

/**
 * Credits count once, from a passing attempt. A resit that also passed does
 * not earn the credits twice, and a failed attempt earns nothing.
 */
export function earnedEcts(courses) {
  return (courses ?? [])
    .filter((course) => courseStatus(course) === 'passed')
    .reduce((total, course) => total + (course.ects ?? 0), 0)
}

export function plannedEcts(courses) {
  return (courses ?? []).reduce((total, course) => total + (course.ects ?? 0), 0)
}

/** Weighted by credits, over passed attempts only, so a resit does not drag. */
export function weightedGpa(courses) {
  let weight = 0
  let total = 0
  for (const course of courses ?? []) {
    if (courseStatus(course) !== 'passed') continue
    const best = bestAttempt(course)
    if (!best) continue
    weight += course.ects ?? 0
    total += best.grade * (course.ects ?? 0)
  }
  return weight ? Math.round((total / weight) * 100) / 100 : null
}

const PERIOD_ORDER = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Semester 1', 'Semester 2', 'Year']

/** Year groups in reading order, each period inside them in teaching order. */
export function byYear(courses) {
  const groups = new Map()
  for (const course of courses ?? []) {
    const level = course.yearLevel || 'Unassigned'
    groups.set(level, [...(groups.get(level) ?? []), course])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([level, list]) => ({
      level,
      ects: list.reduce((total, course) => total + (course.ects ?? 0), 0),
      courses: [...list].sort((left, right) =>
        PERIOD_ORDER.indexOf(left.period) - PERIOD_ORDER.indexOf(right.period)
        || String(left.code).localeCompare(String(right.code)))
    }))
}
