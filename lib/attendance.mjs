const TEACHING_KIND = /\b(lecture|tutorial|practical|lab(?:oratory)?|workshop|seminar|class|colloquium|exercise(?: class)?)s?\b/gi
const REQUIRED = /\b(mandatory|required|compulsory|must attend|attendance requirement)\b/i
const OPTIONAL = /\b(optional|not mandatory|attendance is not required)\b/i
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
  const text = clean(typeof rule === 'string' ? rule : rule?.text, 800)
  return {
    text,
    activity: clean(typeof rule === 'string' ? attendanceActivity(rule) : rule?.activity || attendanceActivity(text), 40).toLowerCase(),
    allowedMisses: finiteInteger(rule?.allowedMisses) ?? allowanceFromText(text),
    minimumAttendancePercent: finitePercent(rule?.minimumAttendancePercent) ?? minimumFromText(text),
    excusedPolicy: clean(rule?.excusedPolicy, 300),
    evidence: Array.isArray(rule?.evidence) ? rule.evidence.slice(0, 20) : []
  }
}

export function attendancePolicyForEvent(event, course) {
  const assessment = course?.courseProfile?.assessment
  const eventText = [event?.activity, event?.sourceTitle, event?.title, event?.notes].filter(Boolean).join(' ')
  const eventKinds = new Set(teachingKinds(eventText))
  const directRequired = REQUIRED.test(eventText) && !OPTIONAL.test(eventText)
  if (directRequired) {
    return { required: true, text: 'This timetable appointment is marked as mandatory.', activity: attendanceActivity(eventText), allowedMisses: allowanceFromText(eventText), minimumAttendancePercent: minimumFromText(eventText), excusedPolicy: '', evidence: [], source: 'Timetable' }
  }
  if (assessment?.status !== 'confirmed') return null
  const candidates = Array.isArray(assessment.attendanceEvidence) && assessment.attendanceEvidence.length
    ? assessment.attendanceEvidence
    : assessment.attendanceRules || []
  for (const candidate of candidates) {
    const policy = normalizedPolicy(candidate)
    if (!policy.text || !REQUIRED.test(policy.text) || OPTIONAL.test(policy.text)) continue
    const named = teachingKinds([policy.activity, policy.text].join(' '))
    if (!named.length || !named.some((kind) => eventKinds.has(kind))) continue
    return { ...policy, required: true, source: 'Verified course rule' }
  }
  return null
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
      attendanceRequired: Boolean(policy?.required),
      attendanceRule: policy?.text || null,
      attendancePolicy: policy ? { allowedMisses: policy.allowedMisses, minimumAttendancePercent: policy.minimumAttendancePercent, excusedPolicy: policy.excusedPolicy, source: policy.source, evidence: policy.evidence } : null
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
    return {
      ...course,
      rate: marked ? Math.round((course.attended / marked) * 100) : null,
      requiredRate: requiredMarked ? Math.round((course.requiredAttended / requiredMarked) * 100) : null,
      allowedMissesRemaining: course.allowedMisses == null ? null : Math.max(0, course.allowedMisses - course.requiredMissed),
      atRisk: course.allowedMisses != null ? course.requiredMissed >= course.allowedMisses : course.minimumAttendancePercent != null && requiredMarked > 0 ? (course.requiredAttended / requiredMarked) * 100 < course.minimumAttendancePercent : false
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
