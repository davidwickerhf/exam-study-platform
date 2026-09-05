import { courseEarnedCredits } from '../academic-record-repair.mjs'
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

/**
 * The words an institution prints where a grade should be. A transcript may
 * record an outcome without a number — an exemption, a pass/fail unit, a
 * no-show — and every surface that reads the plan classified those strings for
 * itself. They are classified once, here.
 */
const PASS_WORD = /^(passed?|complete[d]?|sufficient|exempt|credit(ed)?)$/i
const FAIL_WORD = /^(failed?|no.?show|insufficient|absent|withdrawn)$/i
const OPEN_WORD = /^(upcoming|registered|scheduled|enrolled|in.?progress)$/i

const attemptWord = (attempt) => String(attempt?.status ?? '').trim()

/**
 * One status for a course, from the strongest evidence it carries.
 *
 * A grade outranks a word: a number is the institution's own arithmetic, and
 * the course's own pass mark decides it. Only when nothing is graded does the
 * recorded outcome word speak, and only then does a date make the course
 * "registered" rather than untouched.
 */
export function courseStatus(course) {
  const attempts = course?.attempts ?? []
  const best = bestAttempt(course)
  if (best) return best.grade >= (course.passMark ?? 5.5) ? 'passed' : 'failed'
  if (attempts.some((attempt) => PASS_WORD.test(attemptWord(attempt)))) return 'passed'
  if (attempts.some((attempt) => FAIL_WORD.test(attemptWord(attempt)))) return 'failed'
  const registered = attempts.some(
    (attempt) => attempt.examDate || attempt.registered || OPEN_WORD.test(attemptWord(attempt))
  )
  return registered ? 'registered' : 'not-recorded'
}

export const STATUS_LABEL = {
  passed: 'Passed',
  failed: 'Failed',
  registered: 'Registered',
  'not-recorded': 'Not recorded'
}

/**
 * State is a mark, not a hue. Every recorded state carries a glyph that
 * survives greyscale; an absent state carries an em-dash and no word at all,
 * because "Not recorded" printed on every row of a register is noise.
 */
export const STATUS_MARK = {
  passed: '✓',
  failed: '✗',
  registered: '·',
  'not-recorded': ''
}

export const ATTEMPT_STATUS = [
  ['upcoming', 'Upcoming'],
  ['passed', 'Passed'],
  ['failed', 'Failed'],
  ['no-show', 'No-show']
]

/** The requirement values the stored record accepts; anything else is dropped. */
export const PROGRAMME_REQUIREMENTS = [
  ['required', 'Required'],
  ['choice', 'Choice'],
  ['elective', 'Elective'],
  ['pathway', 'Pathway'],
  ['historical', 'Historical']
]

export const EVENT_TYPES = [
  ['deadline', 'Deadline'],
  ['registration', 'Registration'],
  ['ceremony', 'Ceremony'],
  ['other', 'Other']
]

/**
 * Credits count once, from a passing attempt. A resit that also passed does
 * not earn the credits twice, and a failed attempt earns nothing.
 */
export function earnedEcts(courses) {
  return (courses ?? [])
    .filter((course) => courseStatus(course) === 'passed')
    .reduce((total, course) => total + courseEarnedCredits(course), 0)
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

/**
 * One record's worth of change, applied to the whole plan.
 *
 * Planning saves the entire workspace under an optimistic revision, so every
 * edit used to rebuild that object by hand at its call site: ten spreads of
 * `{ ...workspace, courses: workspace.courses.map(...) }`, each one a chance to
 * drop a field the form never showed. The surgery lives here instead, and the
 * component says only what it meant.
 *
 * Returns the next workspace, or `null` when the patch would change nothing —
 * a composer submitted empty, or a record that is already gone. A caller that
 * gets `null` must not write: an unchanged PUT still burns the revision and
 * would make another tab's next save fail for no reason.
 */
export function applyWorkspaceEdit(workspace, patch) {
  if (!workspace || !patch) return null
  const courses = workspace.courses ?? []
  const gates = workspace.gates ?? []
  const events = workspace.events ?? []
  const findCourse = (id) => courses.find((course) => course.id === id) ?? null

  // Composers write only the fields they show. Everything the record already
  // carries — an editorial link, curriculum context, notes — is preserved by
  // merging under the normalized record rather than replacing it.
  const mergedCourse = (existing, input) => ({
    ...existing,
    ...courseRecord({ ...existing, ...input, attempts: existing.attempts ?? [] }, existing.id)
  })
  const mergedAttempt = (existing, input) => ({
    ...existing,
    ...attemptRecord({ ...existing, ...input }, existing.id)
  })
  const withCourse = (id, next) => ({
    ...workspace,
    courses: courses.map((course) => (course.id === id ? next(course) : course))
  })

  switch (patch.type) {
    case 'profile': {
      const values = Object.fromEntries(
        Object.entries(patch.values ?? {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      )
      if (!Object.keys(values).length) return null
      return { ...workspace, profile: { ...workspace.profile, ...values } }
    }

    case 'course:add': {
      const record = courseRecord(patch.input, patch.id ?? `course-${Date.now()}`)
      if (!record.name) return null
      return { ...workspace, courses: [...courses, record] }
    }
    case 'course:update': {
      const existing = findCourse(patch.id)
      if (!existing) return null
      const next = mergedCourse(existing, patch.input)
      if (!next.name) return null
      return withCourse(patch.id, () => next)
    }
    case 'course:remove': {
      if (!findCourse(patch.id)) return null
      return { ...workspace, courses: courses.filter((course) => course.id !== patch.id) }
    }

    case 'attempt:add': {
      if (!findCourse(patch.courseId)) return null
      const attempt = attemptRecord(patch.input, patch.id ?? `attempt-${Date.now()}`)
      return withCourse(patch.courseId, (course) => ({ ...course, attempts: [...(course.attempts ?? []), attempt] }))
    }
    case 'attempt:update': {
      const course = findCourse(patch.courseId)
      const existing = (course?.attempts ?? []).find((attempt) => attempt.id === patch.attemptId)
      if (!existing) return null
      return withCourse(patch.courseId, (item) => ({
        ...item,
        attempts: item.attempts.map((attempt) => (attempt.id === patch.attemptId ? mergedAttempt(existing, patch.input) : attempt))
      }))
    }
    case 'attempt:remove': {
      const course = findCourse(patch.courseId)
      const attempts = course?.attempts ?? []
      // Attempts written before the record carried ids are addressed by position.
      const gone = attempts.filter((attempt, index) =>
        attempt.id ? attempt.id !== patch.attemptId : index !== patch.index)
      if (!course || gone.length === attempts.length) return null
      return withCourse(patch.courseId, (item) => ({ ...item, attempts: gone }))
    }

    case 'gate:add': {
      const record = gateRecord(patch.input, patch.id ?? `gate-${Date.now()}`)
      if (!record.label) return null
      return { ...workspace, gates: [...gates, record] }
    }
    case 'gate:update': {
      const existing = gates.find((gate) => gate.id === patch.id)
      if (!existing) return null
      const record = gateRecord({ ...existing, ...patch.input }, existing.id)
      if (!record.label) return null
      return { ...workspace, gates: gates.map((gate) => (gate.id === patch.id ? { ...existing, ...record } : gate)) }
    }
    case 'gate:remove': {
      if (!gates.some((gate) => gate.id === patch.id)) return null
      return { ...workspace, gates: gates.filter((gate) => gate.id !== patch.id) }
    }

    case 'event:add': {
      const record = eventRecord(patch.input, patch.id ?? `event-${Date.now()}`)
      if (!record.title) return null
      return { ...workspace, events: [...events, record] }
    }
    case 'event:update': {
      const existing = events.find((event) => event.id === patch.id)
      if (!existing) return null
      const record = eventRecord({ ...existing, ...patch.input }, existing.id)
      if (!record.title) return null
      return { ...workspace, events: events.map((event) => (event.id === patch.id ? { ...existing, ...record } : event)) }
    }
    case 'event:remove': {
      if (!events.some((event) => event.id === patch.id)) return null
      return { ...workspace, events: events.filter((event) => event.id !== patch.id) }
    }

    default:
      throw new Error(`Unknown planning edit: ${String(patch.type)}`)
  }
}

export function planningTab(value) {
  const aliases = { curriculum: 'courses', credits: 'overview', requirements: 'overview', progress: 'overview', documents: 'overview' }
  const requested = aliases[String(value ?? '')] ?? String(value ?? '')
  return ['overview', 'courses', 'planner', 'settings'].includes(requested) ? requested : 'planner'
}
