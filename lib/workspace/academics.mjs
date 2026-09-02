/**
 * The academic record's rules.
 *
 * Plain ESM with a .d.mts beside it, for the same reason as lib/app/home.mjs:
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

export function courseRecord(input, id = `course-${Date.now()}`) {
  return { id, code: String(input?.code ?? '').trim().toUpperCase(), name: String(input?.name ?? '').trim(), ects: Math.max(0, Number(input?.ects) || 0), yearLevel: String(input?.yearLevel ?? '').trim(), period: String(input?.period ?? '').trim(), passMark: Math.max(0, Number(input?.passMark) || 5.5), programmeRequirement: String(input?.programmeRequirement ?? 'required'), attempts: Array.isArray(input?.attempts) ? input.attempts : [] }
}

export function attemptRecord(input, id = `attempt-${Date.now()}`) {
  const rawGrade = input?.grade === '' || input?.grade == null ? null : Number(input.grade)
  return { id, academicYear: String(input?.academicYear ?? '').trim(), type: String(input?.type ?? 'first'), examDate: String(input?.examDate ?? '').trim() || null, grade: Number.isFinite(rawGrade) ? rawGrade : null, status: String(input?.status ?? 'upcoming') }
}

export function gateRecord(input, id = `gate-${Date.now()}`) {
  return { id, label: String(input?.label ?? '').trim(), section: String(input?.section ?? 'progression'), type: String(input?.type ?? 'total-credits'), courseId: String(input?.courseId ?? '').trim() || null, level: String(input?.level ?? '').trim() || null, target: Math.max(0, Number(input?.target) || 0) }
}

export function eventRecord(input, id = `event-${Date.now()}`) {
  return { id, title: String(input?.title ?? '').trim(), date: String(input?.date ?? '').trim() || null, endDate: String(input?.endDate ?? '').trim() || null, type: String(input?.type ?? 'other'), notes: String(input?.notes ?? '').trim() }
}

export function planningTab(value) {
  const aliases = { curriculum: 'courses', credits: 'progress', requirements: 'progress' }
  const requested = aliases[String(value ?? '')] ?? String(value ?? '')
  return ['overview', 'courses', 'progress', 'documents', 'planner', 'settings'].includes(requested) ? requested : 'overview'
}
