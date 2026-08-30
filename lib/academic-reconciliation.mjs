// Cross-source academic reconciliation.
//
// The active academic workspace is the student's canonical plan. Imported
// transcripts, timetables, schedules, curricula, and calendar feeds are
// evidence against that plan: they may confirm a selected course, mention a
// course that is not selected, omit an expected current course, or contradict
// an existing fact. This module handles the course-coverage part of that
// comparison without mutating the workspace.

const clean = (value, max = 300) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export function normalizedCourseCode(value) {
  return clean(value, 40).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function normalizedCourseName(value) {
  return clean(value, 200)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const NON_COURSE_PREFIXES = new Set(['ROOM', 'HALL', 'WEEK', 'PERIOD', 'GROUP', 'SEMESTER', 'YEAR', 'BLOCK', 'LECTURE', 'TUTORIAL'])
// Keep generic detection deliberately narrower than exact selected-course
// matching. This avoids treating phrases such as "Elective 13:00" as a
// course while still recognising conventional codes such as BCS1520, CS-101,
// and INF 2030A.
const COURSE_CODE_PATTERN = /\b([A-Za-z]{2,6}\s*-?\s*\d{3,6}[A-Za-z]?)\b/g

function genericCodes(text) {
  const codes = []
  for (const match of clean(text, 4000).matchAll(COURSE_CODE_PATTERN)) {
    const code = normalizedCourseCode(match[1])
    const prefix = code.match(/^[A-Z]+/)?.[0] || ''
    if (!code || NON_COURSE_PREFIXES.has(prefix) || codes.includes(code)) continue
    codes.push(code)
  }
  return codes
}

function courseMaps(courses = []) {
  const byCode = new Map()
  const byName = new Map()
  for (const course of courses) {
    const code = normalizedCourseCode(course?.code)
    const name = normalizedCourseName(course?.name)
    if (code && !byCode.has(code)) byCode.set(code, course)
    if (name && !byName.has(name)) byName.set(name, course)
  }
  return { byCode, byName }
}

export function courseReferenceInText(value, courses = []) {
  const source = clean(value, 4000)
  if (!source) return null
  const lower = source.toLowerCase()
  const maps = courseMaps(courses)
  for (const [courseCode, course] of maps.byCode) {
    const parts = courseCode.match(/^([A-Z]+)(\d.*)$/)
    const flexible = parts ? `${parts[1]}[-\\s]*${parts[2]}` : courseCode
    if (new RegExp(`(^|[^A-Z0-9])${flexible}([^A-Z0-9]|$)`, 'i').test(source)) return { course, code: courseCode, matchedBy: 'code' }
  }
  for (const [name, course] of maps.byName) {
    if (name.length >= 5 && normalizedCourseName(lower).includes(name)) return { course, code: normalizedCourseCode(course.code), matchedBy: 'name' }
  }
  const code = genericCodes(source)[0] || null
  return code ? { course: maps.byCode.get(code) || null, code, matchedBy: 'code' } : null
}

function scopeCourses(workspace, kind) {
  const courses = (workspace?.courses || []).filter((course) => !course.hiddenFromStats && course.programmeRequirement !== 'historical')
  const completed = (course) => (course.attempts || []).some((attempt) => ['passed', 'failed', 'no-show'].includes(attempt.status))
  const upcoming = (course) => (course.attempts || []).some((attempt) => attempt.status === 'upcoming')

  if (kind === 'transcript') return courses.filter(completed)
  if (kind === 'curriculum') return courses
  if (kind !== 'timetable' && kind !== 'exam-schedule') return []

  const currentYear = normalizedCourseName(workspace?.programmeTemplate?.currentStudyYear || workspace?.profile?.currentYearKey)
  const sameYear = currentYear ? courses.filter((course) => normalizedCourseName(course.yearLevel) === currentYear) : []
  if (sameYear.length) return sameYear
  const scheduled = courses.filter(upcoming)
  if (scheduled.length) return scheduled
  return courses.filter((course) => !completed(course))
}

function observedEvidence(draft = {}, sourceLabel = 'Uploaded source') {
  const observed = new Map()
  const add = ({ code, name, evidence, event = null }) => {
    const normalizedCode = normalizedCourseCode(code)
    const normalizedName = normalizedCourseName(name)
    if (!normalizedCode && !normalizedName) return
    const key = normalizedCode ? `code:${normalizedCode}` : `name:${normalizedName}`
    const current = observed.get(key) || { key, code: normalizedCode, name: clean(name || normalizedCode, 200), evidence: [], events: [] }
    if (!current.name && name) current.name = clean(name, 200)
    if (evidence && !current.evidence.includes(evidence)) current.evidence.push(clean(evidence, 300))
    if (event) current.events.push(event)
    observed.set(key, current)
  }

  for (const course of draft?.courses || []) {
    add({ code: course.code, name: course.name, evidence: `${sourceLabel}: course record` })
  }

  const draftCourses = draft?.courses || []
  for (const event of draft?.events || []) {
    const text = `${event.title || ''} ${event.notes || ''}`
    const explicit = courseReferenceInText(text, draftCourses)
    if (explicit) add({ code: explicit.code, name: explicit.course?.name || explicit.code, evidence: event.title || sourceLabel, event })
    for (const code of genericCodes(text)) add({ code, name: code, evidence: event.title || sourceLabel, event })
  }
  return [...observed.values()]
}

function mergeObservedWithPlan(observed, courses) {
  const maps = courseMaps(courses)
  return observed.map((item) => {
    const match = (item.code && maps.byCode.get(item.code)) || maps.byName.get(normalizedCourseName(item.name)) || null
    return { ...item, course: match }
  })
}

export function reconcileAcademicSource(workspace, draft, { kind = 'auto', sourceLabel = 'Uploaded source' } = {}) {
  const courses = workspace?.courses || []
  const observed = mergeObservedWithPlan(observedEvidence(draft, sourceLabel), courses)
  const matched = observed.filter((item) => item.course).map((item) => ({
    key: item.key,
    courseId: item.course.id,
    code: item.course.code || item.code,
    name: item.course.name,
    evidence: item.evidence
  }))
  const unselected = observed.filter((item) => !item.course).map((item) => ({
    key: item.key,
    code: item.code,
    name: item.name || item.code || 'Unidentified course',
    evidence: item.evidence,
    events: item.events
  }))

  const coveredIds = new Set(matched.map((item) => item.courseId))
  const expected = scopeCourses(workspace, kind)
  const coverageRelevant = ['transcript', 'timetable', 'exam-schedule', 'curriculum'].includes(kind) && observed.length > 0
  const missing = coverageRelevant
    ? expected.filter((course) => !coveredIds.has(course.id)).map((course) => ({ courseId: course.id, code: course.code, name: course.name }))
    : []

  return {
    kind,
    sourceLabel,
    status: unselected.length ? 'attention' : missing.length ? 'review' : observed.length ? 'aligned' : 'not-applicable',
    coverage: { observed: observed.length, matched: matched.length, selectedInScope: expected.length, missing: missing.length },
    matched,
    unselected,
    missing,
    conflicts: []
  }
}
