/** Pure scenario-planning rules shared by the React surface and node:test. */

export const DEFAULT_OBJECTIVE = Object.freeze({ mode: 'current', outcome: 'actual' })

export function objectiveFor(workspace, courseId) {
  const held = workspace?.planning?.objectives?.[courseId]
  const objective = {
    mode: ['current', 'resit', 'none'].includes(held?.mode) ? held.mode : 'current',
    outcome: ['actual', 'pass', 'fail'].includes(held?.outcome) ? held.outcome : 'actual'
  }
  const expectedGrade = Number(held?.expectedGrade)
  if (held?.expectedGrade !== null && held?.expectedGrade !== '' && Number.isFinite(expectedGrade)) {
    objective.expectedGrade = Math.min(100, Math.max(0, expectedGrade))
  }
  if (typeof held?.targetSession === 'string' && held.targetSession.trim()) {
    objective.targetSession = held.targetSession.trim().slice(0, 140)
  }
  return objective
}

export function isPassed(course) {
  return (course?.attempts ?? []).some((attempt) => attempt.status === 'passed')
}

export function gateResolved(gate, workspace, projected = false) {
  const passed = (course) => {
    if (isPassed(course)) return true
    const objective = objectiveFor(workspace, course?.id)
    return projected && objective.mode !== 'none' && objective.outcome === 'pass'
  }
  const courses = workspace?.courses ?? []
  if (gate.type === 'course') return passed(courses.find((course) => course.id === gate.courseId))
  if (gate.type === 'all-level') return courses.filter((course) => course.yearLevel === gate.level && !course.hiddenFromStats).every(passed)
  const earned = courses
    .filter((course) => !course.hiddenFromStats && passed(course) && (gate.type !== 'credit-level' || course.yearLevel === gate.level))
    .reduce((total, course) => total + (Number(course.ects) || 0), 0)
  return earned >= (Number(gate.target) || 0)
}

export function plannerSummary(workspace) {
  const courses = workspace?.courses ?? []
  const counted = courses.filter((course) => !course.hiddenFromStats)
  const openCourses = courses.filter((course) => !isPassed(course))
  const projectedCourses = counted.filter((course) => {
    const objective = objectiveFor(workspace, course.id)
    return isPassed(course) || (objective.mode !== 'none' && objective.outcome === 'pass')
  })
  const earnedCredits = counted.filter(isPassed).reduce((total, course) => total + (Number(course.ects) || 0), 0)
  return {
    projectedCredits: projectedCourses.reduce((total, course) => total + (Number(course.ects) || 0), 0),
    totalCredits: counted.reduce((total, course) => total + (Number(course.ects) || 0), 0),
    earnedCredits,
    openCourses,
    plannedCount: openCourses.filter((course) => {
      const objective = objectiveFor(workspace, course.id)
      return objective.mode !== 'current' || objective.outcome !== 'actual'
    }).length,
    projectedGates: (workspace?.gates ?? []).filter((gate) => gateResolved(gate, workspace, true)).length
  }
}

const PERIOD_ORDER = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Semester 1', 'Semester 2', 'Year']

export function groupOpenCourses(courses) {
  const groups = new Map()
  for (const course of courses ?? []) {
    const level = course.yearLevel || 'Unassigned'
    groups.set(level, [...(groups.get(level) ?? []), course])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([level, held]) => ({
      level,
      ects: held.reduce((total, course) => total + (Number(course.ects) || 0), 0),
      courses: [...held].sort((left, right) => {
        const li = PERIOD_ORDER.indexOf(left.period)
        const ri = PERIOD_ORDER.indexOf(right.period)
        return (li < 0 ? PERIOD_ORDER.length : li) - (ri < 0 ? PERIOD_ORDER.length : ri) || String(left.code).localeCompare(String(right.code))
      })
    }))
}

export function planningInsights(workspace, { today = new Date() } = {}) {
  const midnight = new Date(today)
  midnight.setHours(0, 0, 0, 0)
  const courses = workspace?.courses ?? []
  const gates = workspace?.gates ?? []
  const open = courses.filter((course) => {
    const objective = objectiveFor(workspace, course.id)
    return !course.hiddenFromStats && !isPassed(course) && objective.mode !== 'none' && objective.outcome !== 'fail'
  })
  const courseGateIds = new Set(gates.filter((gate) => gate.type === 'course' && !gateResolved(gate, workspace)).map((gate) => gate.courseId))
  const priority = open.map((course) => {
    const active = (course.attempts ?? []).find((attempt) => attempt.status === 'upcoming')
    const parsed = active?.examDate ? new Date(`${active.examDate}T00:00:00`) : null
    const days = parsed && !Number.isNaN(parsed.getTime()) ? Math.ceil((parsed.getTime() - midnight.getTime()) / 86_400_000) : null
    let score = courseGateIds.has(course.id) ? 100 : 0
    if (days !== null) score += days <= 7 ? 30 : days <= 14 ? 20 : days <= 30 ? 10 : 0
    score += Math.min(20, (Number(course.ects) || 0) * 2)
    return { course, days, score, risk: score >= 100 ? 'critical' : score >= 30 ? 'high' : score >= 15 ? 'medium' : 'low' }
  }).sort((left, right) => right.score - left.score || String(left.course.code).localeCompare(String(right.course.code)))

  const periodMap = new Map()
  for (const item of priority) {
    const period = item.course.period || 'Unscheduled'
    const current = periodMap.get(period) || { period, ects: 0, count: 0 }
    periodMap.set(period, { period, ects: current.ects + (Number(item.course.ects) || 0), count: current.count + 1 })
  }

  const creditGates = gates.filter((gate) => ['total-credits', 'credit-level'].includes(gate.type) && !gateResolved(gate, workspace))
  const minimumPaths = creditGates.map((gate) => {
    const eligible = priority.map((item) => item.course)
      .filter((course) => gate.type !== 'credit-level' || course.yearLevel === gate.level)
      .sort((left, right) => right.ects - left.ects)
    const current = courses
      .filter((course) => !course.hiddenFromStats && isPassed(course) && (gate.type !== 'credit-level' || course.yearLevel === gate.level))
      .reduce((total, course) => total + (Number(course.ects) || 0), 0)
    let covered = current
    const route = []
    for (const course of eligible) {
      if (covered >= gate.target) break
      route.push(course)
      covered += Number(course.ects) || 0
    }
    return { gate, gap: Math.max(0, (Number(gate.target) || 0) - current), courses: route }
  })
  return { priority, periods: [...periodMap.values()], minimumPaths }
}

export function withObjective(workspace, courseId, patch) {
  const next = { ...objectiveFor(workspace, courseId), ...patch }
  if (patch?.expectedGrade === null || patch?.expectedGrade === '') delete next.expectedGrade
  if (patch?.targetSession === null || patch?.targetSession === '') delete next.targetSession
  return {
    ...workspace,
    planning: {
      ...(workspace.planning ?? {}),
      objectives: { ...(workspace.planning?.objectives ?? {}), [courseId]: next }
    }
  }
}

function recordedStatus(course) {
  if (isPassed(course)) return 'passed'
  if ((course?.attempts ?? []).some((attempt) => attempt.status === 'failed' || attempt.status === 'no-show')) return 'failed'
  if ((course?.attempts ?? []).some((attempt) => attempt.status === 'upcoming')) return 'registered'
  return 'not-recorded'
}

/** Stable destinations shared by the board, Tutor and external agents. */
export function planningSessions(workspace) {
  const sessions = []
  const seen = new Set()
  const add = (session) => {
    if (!session?.id || seen.has(session.id)) return
    seen.add(session.id)
    sessions.push(session)
  }
  if ((workspace?.courses ?? []).some((course) => /semester|year/i.test(String(course?.period || '')))) {
    add({ id: 'continuous-work', label: 'Coursework', academicYear: null, period: null, startsAt: null, endsAt: null, kind: 'continuous-work', resit: false })
  }
  for (const period of workspace?.planning?.academicPeriods ?? []) {
    if (!['exam-week', 'resit-week'].includes(period?.kind)) continue
    add({
      id: `calendar:${period.id}`,
      label: period.title,
      academicYear: period.academicYear || null,
      period: period.period ?? null,
      semester: period.semester ?? null,
      startsAt: period.date || null,
      endsAt: period.endDate || period.date || null,
      kind: period.kind,
      resit: Boolean(period.resit || period.kind === 'resit-week')
    })
  }
  const periods = [...new Set((workspace?.courses ?? []).map((course) => {
    const sourcePeriod = course.period || (course.attempts ?? []).find((attempt) => attempt.status === 'upcoming')?.period || (course.attempts ?? []).findLast?.((attempt) => attempt.period)?.period
    const match = String(sourcePeriod || '').match(/period\s*(\d+)/i)
    return match ? Number(match[1]) : null
  }).filter((value) => value !== null))].sort((left, right) => left - right)
  for (const period of periods) {
    if (!sessions.some((session) => !session.resit && session.period === period)) add({ id: `period:${period}`, label: `Period ${period} exams`, academicYear: null, period, semester: null, startsAt: null, endsAt: null, kind: 'exam-week', resit: false })
  }
  if (!sessions.some((session) => session.kind === 'exam-week' && !session.resit)) add({ id: 'current-sit', label: 'Current sitting', academicYear: null, period: null, semester: null, startsAt: null, endsAt: null, kind: 'exam-week', resit: false })
  if (!sessions.some((session) => session.resit)) add({ id: 'resit', label: 'Resit session', academicYear: null, period: null, semester: null, startsAt: null, endsAt: null, kind: 'resit-week', resit: true })
  add({ id: 'following-year', label: 'Following year', academicYear: null, period: null, startsAt: null, endsAt: null, kind: 'carry-over', resit: false })
  return sessions
}

function coursePeriodEvidence(course) {
  if (String(course?.period || '').trim()) return { label: String(course.period).trim(), source: 'current-course-record' }
  const attempt = (course?.attempts ?? []).find((item) => item.status === 'upcoming' && item.period) || [...(course?.attempts ?? [])].reverse().find((item) => item.period)
  return attempt?.period ? { label: String(attempt.period).trim(), source: 'transcript-attempt' } : { label: null, source: 'not-recorded' }
}

function periodCoordinates(label) {
  const periodMatch = String(label || '').match(/period\s*(\d+)/i)
  const semesterMatch = String(label || '').match(/semester\s*(\d+)/i)
  const period = periodMatch ? Number(periodMatch[1]) : null
  return { period, semester: semesterMatch ? Number(semesterMatch[1]) : period === null ? null : period <= 3 ? 1 : 2 }
}

/** Evidence-backed destinations for one course. Unknown evidence stays permissive and explicit. */
export function planningDestinations(workspace, courseId) {
  const course = (workspace?.courses ?? []).find((item) => item.id === courseId || String(item.code || '').toUpperCase() === String(courseId || '').toUpperCase())
  if (!course) throw new Error('That course is not in the active academic record.')
  const sessions = planningSessions(workspace)
  const evidence = coursePeriodEvidence(course)
  const coordinates = periodCoordinates(evidence.label)
  const continuous = /semester|year/i.test(String(evidence.label || ''))
  const assessment = course?.courseProfile?.assessment
  const resitRules = assessment?.status === 'confirmed' ? assessment.resitRules ?? [] : []
  const resitProhibited = resitRules.some((rule) => /\b(no resit|no retake|not eligible for (a )?resit|cannot be re(?:sat|taken))\b/i.test(typeof rule === 'string' ? rule : rule?.text || ''))

  let allowed
  if (!evidence.label) allowed = sessions
  else if (continuous) allowed = sessions.filter((session) => session.id === 'continuous-work' || session.kind === 'carry-over')
  else if (coordinates.period !== null) {
    const matching = sessions.filter((session) => {
      if (session.kind === 'carry-over') return true
      if (session.id === `period:${coordinates.period}`) return true
      if (!session.resit) return session.period === coordinates.period
      if (resitProhibited) return false
      if (session.id === 'resit') return true
      return session.period === coordinates.period || (session.period == null && session.semester === coordinates.semester)
    })
    allowed = matching
  } else allowed = sessions

  return {
    courseId: course.id,
    courseCode: course.code,
    teachingPeriod: evidence.label,
    evidenceSource: evidence.source,
    period: coordinates.period,
    semester: coordinates.semester,
    resitRules,
    allowedSessionIds: allowed.map((session) => session.id),
    destinations: sessions.map((session) => ({ ...session, allowed: allowed.some((item) => item.id === session.id), reason: allowed.some((item) => item.id === session.id) ? null : continuous ? 'This module is recorded as continuous coursework, not a dated exam.' : resitProhibited && session.resit ? 'A verified course rule does not allow a resit.' : `This course is recorded in ${evidence.label}; only its exam window, related resit, or a later year can be planned.` }))
  }
}

function effectivePlanningSession(workspace, course, sessions) {
  const objective = objectiveFor(workspace, course.id)
  if (objective.targetSession) return sessions.find((session) => session.id === objective.targetSession) || { id: objective.targetSession, label: objective.targetSession, unavailable: true }
  if (objective.mode === 'none') return sessions.find((session) => session.id === 'following-year') || null
  if (/semester|year/i.test(String(course?.period || ''))) return sessions.find((session) => session.id === 'continuous-work') || null
  const match = String(course?.period || '').match(/period\s*(\d+)/i)
  const period = match ? Number(match[1]) : null
  if (objective.mode === 'resit') return sessions.find((session) => session.resit && (period === null || session.period === period)) || sessions.find((session) => session.resit) || null
  const upcoming = (course?.attempts ?? []).find((attempt) => attempt.status === 'upcoming' && attempt.examDate)?.examDate
  if (upcoming) {
    const dated = sessions.find((session) => session.startsAt && session.endsAt && upcoming >= session.startsAt && upcoming <= session.endsAt)
    if (dated) return dated
  }
  return sessions.find((session) => !session.resit && session.period === period) || sessions.find((session) => session.id === 'current-sit') || null
}

/**
 * A compact, truth-labelled view of the plan for Tutor and MCP consumers.
 * Recorded attempts stay beside, but separate from, private scenario choices.
 */
export function planningContext(workspace) {
  const summary = plannerSummary(workspace)
  const sessions = planningSessions(workspace)
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  return {
    revision: Number(workspace?.revision) || 0,
    programme: workspace?.profile?.programme || null,
    academicYear: workspace?.profile?.academicYear || null,
    currentStudyYear: workspace?.programmeTemplate?.currentStudyYear || null,
    summary: {
      earnedCredits: summary.earnedCredits,
      projectedCredits: summary.projectedCredits,
      totalCredits: summary.totalCredits,
      plannedChanges: summary.plannedCount,
      resolvedProjectedGates: summary.projectedGates
    },
    courses: (workspace?.courses ?? []).map((course) => {
      const objective = objectiveFor(workspace, course.id)
      const plannedSession = effectivePlanningSession(workspace, course, sessions)
      const destinations = planningDestinations(workspace, course.id)
      return {
        id: course.id,
        code: course.code,
        name: course.name,
        ects: Number(course.ects) || 0,
        yearLevel: course.yearLevel || null,
        teachingPeriod: course.period || null,
        recordedStatus: recordedStatus(course),
        recordedAttempts: (course.attempts ?? []).map((attempt) => ({
          status: attempt.status,
          type: attempt.type || null,
          examDate: attempt.examDate || null,
          grade: attempt.grade ?? null,
          academicYear: attempt.academicYear || null
        })),
        objective,
        plannedSession: objective.targetSession ? sessionsById.get(objective.targetSession) || plannedSession : plannedSession,
        placementSource: objective.targetSession ? 'scenario-choice' : 'course-and-calendar',
        planningRules: {
          teachingPeriod: destinations.teachingPeriod,
          evidenceSource: destinations.evidenceSource,
          allowedSessionIds: destinations.allowedSessionIds,
          resitRules: destinations.resitRules
        }
      }
    }),
    gates: (workspace?.gates ?? []).map((gate) => ({
      id: gate.id,
      label: gate.label,
      type: gate.type,
      courseId: gate.courseId || null,
      level: gate.level || null,
      target: Number(gate.target) || 0,
      recordedResolved: gateResolved(gate, workspace, false),
      projectedResolved: gateResolved(gate, workspace, true)
    })),
    sessions,
    registrationDates: (workspace?.events ?? []).filter((event) => event.type === 'registration').map((event) => ({ id: event.id, title: event.title, date: event.date || null, endDate: event.endDate || null })),
    note: 'Recorded attempts are academic facts. Objectives, expected grades and planned sessions are private scenario choices.'
  }
}

/** Narrow, revision-safe mutations use this instead of replacing a workspace. */
export function updatePlanningObjective(workspace, courseId, patch = {}) {
  const course = (workspace?.courses ?? []).find((item) => item.id === courseId || String(item.code || '').toUpperCase() === String(courseId || '').toUpperCase())
  if (!course) throw new Error('That course is not in the active academic record.')
  const before = objectiveFor(workspace, course.id)
  const nextPatch = {}
  if (patch.mode !== undefined) {
    if (!['current', 'resit', 'none'].includes(patch.mode)) throw new Error('Planning mode must be current, resit, or none.')
    nextPatch.mode = patch.mode
  }
  if (patch.outcome !== undefined) {
    if (!['actual', 'pass', 'fail'].includes(patch.outcome)) throw new Error('Planning outcome must be actual, pass, or fail.')
    nextPatch.outcome = patch.outcome
  }
  if (patch.expectedGrade !== undefined) {
    if (patch.expectedGrade === null || patch.expectedGrade === '') {
      nextPatch.expectedGrade = null
      if (patch.outcome === undefined) nextPatch.outcome = 'actual'
    }
    else {
      const grade = Number(patch.expectedGrade)
      if (!Number.isFinite(grade)) throw new Error('Expected grade must be a number or null.')
      const maximum = Number(course.passMark) > 10 ? 100 : 10
      if (grade < 0 || grade > maximum) throw new Error(`Expected grade must be between 0 and ${maximum}.`)
      nextPatch.expectedGrade = grade
      if (patch.outcome === undefined) nextPatch.outcome = grade >= (Number(course.passMark) || 5.5) ? 'pass' : 'fail'
    }
  }
  if (patch.targetSession !== undefined) {
    if (patch.targetSession === null || patch.targetSession === '') nextPatch.targetSession = null
    else {
      const targetSession = String(patch.targetSession).trim()
      if (!planningSessions(workspace).some((session) => session.id === targetSession)) throw new Error('That exam session is not available in this plan.')
      if (!planningDestinations(workspace, course.id).allowedSessionIds.includes(targetSession)) throw new Error(`That sitting is not available for ${course.code || course.name} under its recorded teaching-period and resit rules.`)
      nextPatch.targetSession = targetSession
      const session = planningSessions(workspace).find((item) => item.id === targetSession)
      if (patch.mode === undefined) nextPatch.mode = session?.kind === 'carry-over' ? 'none' : session?.resit ? 'resit' : 'current'
    }
  }
  if (!Object.keys(nextPatch).length) throw new Error('Name at least one planning field to update.')
  const next = withObjective(workspace, course.id, nextPatch)
  return { workspace: next, course, before, after: objectiveFor(next, course.id) }
}

export function resetObjectives(workspace) {
  return { ...workspace, planning: { ...(workspace.planning ?? {}), objectives: {} } }
}
