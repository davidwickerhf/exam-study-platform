/** Pure scenario-planning rules shared by the React surface and node:test. */

export const DEFAULT_OBJECTIVE = Object.freeze({ mode: 'current', outcome: 'actual' })

export function objectiveFor(workspace, courseId) {
  const held = workspace?.planning?.objectives?.[courseId]
  return {
    mode: ['current', 'resit', 'none'].includes(held?.mode) ? held.mode : 'current',
    outcome: ['actual', 'pass', 'fail'].includes(held?.outcome) ? held.outcome : 'actual'
  }
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
  return {
    ...workspace,
    planning: {
      ...(workspace.planning ?? {}),
      objectives: { ...(workspace.planning?.objectives ?? {}), [courseId]: next }
    }
  }
}

export function resetObjectives(workspace) {
  return { ...workspace, planning: { ...(workspace.planning ?? {}), objectives: {} } }
}
