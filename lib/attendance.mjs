import { supportedCourseAssessment } from './course-rule-evidence.mjs'
const TEACHING_KIND = /\b(lecture|tutorial|practical|lab(?:oratory)?|workshop|seminar|debate|project|class|colloquium|exercise(?: class)?)(?:s|es)?\b/gi
const REQUIRED = /\b(mandatory|required|compulsory|must attend|attendance requirement)\b/i
const OPTIONAL = /\b(optional|voluntary|not (?:mandatory|required|compulsory)|no attendance requirement)\b/i
const STATUSES = new Set(['attended', 'missed', 'excused'])

const clean = (value, max = 500) => String(value ?? '').replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

export function attendanceActivity(value) {
  const source = clean(value, 600)
  const match = [...source.matchAll(TEACHING_KIND)][0]
  if (!match) return 'teaching session'
  const kind = match[1].toLowerCase().replace('laboratory', 'lab').replace('exercise class', 'exercise')
  return kind === 'practical' ? 'lab' : kind
}

function teachingKinds(value) {
  return [...clean(value, 1200).matchAll(TEACHING_KIND)].map((match) => match[1].toLowerCase().replace('laboratory', 'lab').replace('exercise class', 'exercise').replace('practical', 'lab'))
}

function finiteInteger(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null
}

function finitePercent(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

function allowanceFromText(value) {
  const text = clean(value, 800)
  const direct = text.match(/(?:up to|maximum(?: of)?|no more than|allowed(?: to miss)?|may miss)\s*(\d+)\s*(?:absences?|miss(?:ed|es)?|sessions?|classes?)/i)
    || text.match(/(\d+)\s*(?:absences?|miss(?:ed|es)?)\s*(?:are|is)?\s*(?:allowed|permitted)/i)
  return direct ? finiteInteger(direct[1]) : null
}

function minimumFromText(value) {
  const text = clean(value, 800)
  const direct = text.match(/(?:minimum(?: attendance)?(?: of)?|attend(?:ance)?(?: of| at least)?|at least)\s*(\d+(?:\.\d+)?)\s*%/i)
  return direct ? finitePercent(direct[1]) : null
}

function normalizedPolicy(rule) {
  const text = clean(typeof rule === 'string' ? rule : rule?.text, 1500)
  return {
    text,
    requirement: ['required','optional','assessed'].includes(rule?.requirement) ? rule.requirement : null,
    participationAssessed: rule?.participationAssessed === true,
    scope: rule?.scope || null,
    activity: clean(typeof rule === 'string' ? attendanceActivity(rule) : rule?.activity || attendanceActivity(text), 40).toLowerCase(),
    allowedMisses: finiteInteger(rule?.allowedMisses) ?? allowanceFromText(text),
    minimumAttendancePercent: finitePercent(rule?.minimumAttendancePercent) ?? minimumFromText(text),
    excusedPolicy: clean(rule?.excusedPolicy, 300),
    evidence: Array.isArray(rule?.evidence) ? rule.evidence.slice(0, 20) : []
  }
}

function requirementFor(text, activity) {
  const kinds = teachingKinds(activity)
  const clauses = text.split(/[.;\n]|\b(?:but|whereas|while)\b/i).filter(clause => {
    const named = teachingKinds(clause)
    return !named.length || named.some(kind => kinds.includes(kind))
  })
  const values = clauses.map(clause => OPTIONAL.test(clause) ? false : REQUIRED.test(clause) ? true : null).filter(v => v !== null)
  return values.length && new Set(values).size === 1 ? values[0] : null
}
function confirmedPolicies(course) {
  const assessment = supportedCourseAssessment(course)
  if (assessment?.status !== 'confirmed') return []
  return (assessment.attendanceEvidence?.length ? assessment.attendanceEvidence : assessment.attendanceRules || []).map(normalizedPolicy)
}
function sameRuleYear(event, course) {
  if (!course?.ruleAcademicYear) return true
  const date = String(event.start || '')
  const year = event.academicYear || (/^\d{4}-\d{2}/.test(date) ? `${Number(date.slice(0,4)) - (Number(date.slice(5,7)) < 8 ? 1 : 0)}-${Number(date.slice(0,4)) + (Number(date.slice(5,7)) >= 8 ? 1 : 0)}` : '')
  return year === course.ruleAcademicYear
}

export function attendancePolicyForEvent(event, course) {
  const eventText = [event?.activity, event?.sourceTitle, event?.title, event?.notes].filter(Boolean).join(' ')
  const labelled = String(event?.notes || '').match(/\bType:\s*([^\n;]+)/i)?.[1]
  const activity = teachingKinds(labelled).length ? attendanceActivity(labelled) : teachingKinds(event?.activity).length ? event.activity : eventText
  const eventKinds = new Set(teachingKinds(activity))
  const directRequirement = requirementFor(eventText, activity)
  if (directRequirement !== null) {
    return { required: directRequirement, text: `This timetable appointment is marked as ${directRequirement ? 'mandatory' : 'optional'}.`, activity: attendanceActivity(eventText), allowedMisses: allowanceFromText(eventText), minimumAttendancePercent: minimumFromText(eventText), excusedPolicy: '', evidence: [], source: 'Timetable' }
  }
  if (!sameRuleYear(event, course)) return null
  const matches = []
  for (const policy of confirmedPolicies(course)) {
    if (!policy.text) continue
    if (policy.scope?.kind === 'specific') {
      const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
      const text = ` ${normalized(eventText)} `
      const day = event.start ? new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(event.start)) : ''
      const matchesLabel = (policy.scope.labels || []).some(label=>text.includes(` ${normalized(label)} `))
      if (!matchesLabel && !(policy.scope.dates || []).includes(day)) continue
    }
    const named = teachingKinds(policy.activity).length ? teachingKinds(policy.activity)
      : teachingKinds(policy.text).filter(kind => kind !== 'project')
    // A course/project name in an unclassified rule does not make it a project-meeting rule.
    if (!named.length || !named.some((kind) => eventKinds.has(kind))) continue
    const required = policy.participationAssessed ? null : policy.requirement === 'required' ? true : policy.requirement === 'optional' ? false : requirementFor(policy.text, activity)
    if (required !== null || policy.participationAssessed) matches.push({ ...policy, required, source: 'Verified course rule' })
  }
  // A named assessment's stricter allowance must not be hidden by the
  // general project-meeting allowance. Equally specific disagreements remain unknown.
  const scoped = matches.filter(policy => policy.scope?.kind === 'specific')
  const applicable = scoped.length ? scoped : matches
  return applicable.length && new Set(applicable.map(p => p.required)).size === 1
    ? applicable.sort((a,b) => (a.allowedMisses ?? Infinity) - (b.allowedMisses ?? Infinity))[0] : null
}

export function normalizeAttendanceRecord(value, index = 0) {
  if (!value || typeof value !== 'object') return null
  const eventId = clean(value.eventId, 240)
  const startsAt = clean(value.startsAt, 50)
  const status = STATUSES.has(value.status) ? value.status : null
  if (!eventId || !startsAt || !status || Number.isNaN(new Date(startsAt).getTime())) return null
  return {
    id: clean(value.id || `attendance-${index + 1}`, 260),
    eventId,
    courseId: clean(value.courseId, 100) || null,
    courseCode: clean(value.courseCode, 40).toUpperCase() || null,
    courseName: clean(value.courseName, 200) || null,
    title: clean(value.title, 240) || 'Teaching session',
    activity: clean(value.activity || attendanceActivity(value.title), 40).toLowerCase(),
    startsAt: new Date(startsAt).toISOString(),
    endsAt: value.endsAt && !Number.isNaN(new Date(value.endsAt).getTime()) ? new Date(value.endsAt).toISOString() : null,
    status,
    note: clean(value.note, 500),
    recordedAt: value.recordedAt && !Number.isNaN(new Date(value.recordedAt).getTime()) ? new Date(value.recordedAt).toISOString() : new Date().toISOString()
  }
}

export function attendanceRecordForEvent(event, status, note = '', recordedAt = new Date()) {
  return normalizeAttendanceRecord({
    id: `attendance:${event.id}`,
    eventId: event.id,
    courseId: event.courseId,
    courseCode: event.courseCode,
    courseName: event.courseName,
    title: event.title,
    activity: event.activity || attendanceActivity([event.title, event.notes].filter(Boolean).join(' ')),
    startsAt: event.start,
    endsAt: event.end,
    status,
    note,
    recordedAt: recordedAt instanceof Date ? recordedAt.toISOString() : recordedAt
  })
}

export function upsertAttendanceRecord(records = [], event, status, note = '', recordedAt = new Date()) {
  const current = (Array.isArray(records) ? records : []).map(normalizeAttendanceRecord).filter(Boolean)
  if (status === 'unknown' || status === null) return current.filter((record) => record.eventId !== event.id)
  const record = attendanceRecordForEvent(event, status, note, recordedAt)
  if (!record) throw new Error('Attendance can only be recorded for a dated teaching session.')
  return [...current.filter((item) => item.eventId !== event.id), record].slice(-5000)
}

export function attendanceOverview(events = [], records = [], courses = [], { now = Date.now() } = {}) {
  const byEvent = new Map((Array.isArray(records) ? records : []).map(normalizeAttendanceRecord).filter(Boolean).map((record) => [record.eventId, record]))
  const courseByCode = new Map((courses || []).map((course) => [String(course.code || '').toUpperCase(), course]))
  const annotated = events.map((event) => {
    if (!event.attendanceEligible) return event
    const course = courseByCode.get(String(event.courseCode || '').toUpperCase())
    const policy = attendancePolicyForEvent(event, course)
    const record = byEvent.get(event.id) || null
    return {
      ...event,
      attendanceStatus: record?.status || 'unknown',
      attendanceNote: record?.note || '',
      attendanceRecordedAt: record?.recordedAt || null,
      attendanceRequired: policy?.required ?? null,
      attendanceAssessed: policy?.participationAssessed === true,
      attendanceRule: policy?.text || null,
      attendancePolicy: policy ? { scope: policy.scope || null, allowedMisses: policy.allowedMisses, minimumAttendancePercent: policy.minimumAttendancePercent, excusedPolicy: policy.excusedPolicy, source: policy.source, evidence: policy.evidence } : null
    }
  })
  const eligible = annotated.filter((event) => event.attendanceEligible)
  const byCourse = new Map()
  for (const event of eligible) {
    const code = event.courseCode || 'Other'
    const current = byCourse.get(code) || { courseId: event.courseId || null, editorialCourseId: event.editorialCourseId || null, courseCode: event.courseCode || null, courseName: event.courseName || event.title, scheduled: 0, past: 0, attended: 0, missed: 0, excused: 0, unmarked: 0, requiredScheduled: 0, requiredPast: 0, requiredAttended: 0, requiredMissed: 0, requiredExcused: 0, requiredUnmarked: 0, allowedMisses: null, minimumAttendancePercent: null, rule: null, ruleSource: null }
    current.scheduled += 1
    if (event.attendanceRequired) {
      current.requiredScheduled += 1
      if (event.attendancePolicy?.allowedMisses != null) current.allowedMisses = event.attendancePolicy.allowedMisses
      if (event.attendancePolicy?.minimumAttendancePercent != null) current.minimumAttendancePercent = event.attendancePolicy.minimumAttendancePercent
      current.rule ||= event.attendanceRule
      current.ruleSource ||= event.attendancePolicy?.source || null
    }
    const past = new Date(event.end || event.start).getTime() < now
    if (past) {
      current.past += 1
      if (event.attendanceRequired) current.requiredPast += 1
      const status = event.attendanceStatus || 'unknown'
      current[status === 'unknown' ? 'unmarked' : status] += 1
      if (event.attendanceRequired) current[`required${status === 'unknown' ? 'Unmarked' : status[0].toUpperCase() + status.slice(1)}`] += 1
    }
    byCourse.set(code, current)
  }
  const courseRows = [...byCourse.values()].map((course) => {
    const marked = course.attended + course.missed
    const requiredMarked = course.requiredAttended + course.requiredMissed
    // Distinct rules have distinct absence pools (e.g. meetings vs skill classes).
    // Never let the final calendar row overwrite the course's displayed allowance.
    const pools = new Map()
    for (const event of eligible.filter(item => item.courseCode === course.courseCode && item.attendanceRequired)) {
      const policy = event.attendancePolicy
      const key = JSON.stringify([event.attendanceRule, policy.scope || null])
      const pool = pools.get(key) || {allowed:policy.allowedMisses, minimum:policy.minimumAttendancePercent, missed:0, attended:0}
      if (new Date(event.end || event.start).getTime() < now) {
        if (event.attendanceStatus === 'missed') pool.missed++
        if (event.attendanceStatus === 'attended') pool.attended++
      }
      pools.set(key,pool)
    }
    const singlePool = pools.size === 1 ? [...pools.values()][0] : null
    return {
      ...course,
      allowedMisses: singlePool?.allowed ?? null,
      minimumAttendancePercent: singlePool?.minimum ?? null,
      ruleAcademicYear: courseByCode.get(String(course.courseCode || '').toUpperCase())?.ruleAcademicYear || '',
      ruleExtractionStatus: courseByCode.get(String(course.courseCode || '').toUpperCase())?.priorityScan?.status || null,
      unknownRequirementSessions: eligible.filter(event => event.courseCode === course.courseCode && event.attendanceRequired == null && !event.attendanceAssessed).length,
      unmatchedRules: confirmedPolicies(courseByCode.get(String(course.courseCode || '').toUpperCase())).filter(policy =>
        (policy.participationAssessed || requirementFor(policy.text, policy.activity) === true) &&
        eligible.some(event => event.courseCode === course.courseCode && sameRuleYear(event, courseByCode.get(String(course.courseCode || '').toUpperCase()))) &&
        !eligible.some(event => event.courseCode === course.courseCode && event.attendanceRule === policy.text)
      ).map(policy => ({ text: policy.text, activity: policy.activity, source: 'Verified course rule', assessed:policy.participationAssessed, evidence:policy.evidence })),
      rate: marked ? Math.round((course.attended / marked) * 100) : null,
      requiredRate: requiredMarked ? Math.round((course.requiredAttended / requiredMarked) * 100) : null,
      allowedMissesRemaining: singlePool?.allowed == null ? null : Math.max(0, singlePool.allowed - singlePool.missed),
      atRisk: [...pools.values()].some(pool => pool.allowed != null ? pool.missed > 0 && pool.missed >= pool.allowed : pool.minimum != null && pool.attended + pool.missed > 0 && pool.attended / (pool.attended + pool.missed) * 100 < pool.minimum)
    }
  }).sort((left, right) => Number(right.atRisk) - Number(left.atRisk) || (right.requiredScheduled - left.requiredScheduled) || String(left.courseCode).localeCompare(String(right.courseCode)))
  const total = courseRows.reduce((sum, course) => ({
    scheduled: sum.scheduled + course.scheduled,
    past: sum.past + course.past,
    attended: sum.attended + course.attended,
    missed: sum.missed + course.missed,
    excused: sum.excused + course.excused,
    unmarked: sum.unmarked + course.unmarked,
    requiredMissed: sum.requiredMissed + course.requiredMissed,
    requiredUnmarked: sum.requiredUnmarked + course.requiredUnmarked
  }), { scheduled: 0, past: 0, attended: 0, missed: 0, excused: 0, unmarked: 0, requiredMissed: 0, requiredUnmarked: 0 })
  const marked = total.attended + total.missed
  return { events: annotated, summary: { ...total, rate: marked ? Math.round((total.attended / marked) * 100) : null, atRiskCourses: courseRows.filter((course) => course.atRisk).length }, courses: courseRows }
}
