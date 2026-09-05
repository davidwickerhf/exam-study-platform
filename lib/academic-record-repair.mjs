// Repair the exact page-header contamination emitted by older transcript imports.
// Identity requires a unique title AND a matching recorded result; no fuzzy match.
export function transcriptCourseTitle(value) {
  return String(value || '').replace(/^(?:ECTS\s+)+/i, '')
    .replace(/^BSc\s+CS\s+year\s+\d+\s+(?:core\s+courses|electives)\s+/i, '').trim()
}
const titleKey = value => transcriptCourseTitle(value).toLowerCase().replace(/\bai\b/g, 'artificial intelligence').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const yearKey = value => String(value || '').replace(/[–—/]/g, '-')
const sameResult = (a, b) => a.status === b.status && a.grade === b.grade && yearKey(a.academicYear) === yearKey(b.academicYear) && (a.ects == null || b.ects == null || Number(a.ects) === Number(b.ects)) && (!a.examDate || !b.examDate || a.examDate === b.examDate)

export function repairTranscriptDuplicates(workspace) {
  const courses = structuredClone(workspace.courses || [])
  const aliases = new Map()
  for (const orphan of courses) {
    if (orphan.code || !/^ECTS\s+ECTS\s+BSc\s+CS\s+year\s+\d+\s+(?:core\s+courses|electives)\s+/i.test(orphan.name)) continue
    const matches = courses.filter(course => course.code && titleKey(course.name) === titleKey(orphan.name)
      && orphan.attempts?.length && orphan.attempts.every(a => course.attempts.some(b => sameResult(a, b))))
    if (matches.length !== 1) continue
    const target = matches[0]
    for (const attempt of orphan.attempts) {
      const held = target.attempts.find(a => sameResult(a, attempt))
      if (!held.examDate && attempt.examDate) held.examDate = attempt.examDate
      for (const field of ['ects', 'yearLevel', 'period', 'curriculumVersion']) if (held[field] == null || held[field] === '') held[field] = attempt[field]
    }
    aliases.set(orphan.id, target.id)
  }
  if (!aliases.size) return workspace
  const id = value => aliases.get(value) || value
  const planning = workspace.planning || {}
  return { ...workspace, courses: courses.filter(course => !aliases.has(course.id)),
    gates: (workspace.gates || []).map(gate => ({ ...gate, courseId: id(gate.courseId) })),
    planning: { ...planning,
      objectives: Object.fromEntries(Object.entries(planning.objectives || {}).sort(([a], [b]) => Number(aliases.has(b)) - Number(aliases.has(a))).map(([key, value]) => [id(key), value])),
      periodAssignments: (planning.periodAssignments || []).map(period => ({ ...period, courseIds: [...new Set((period.courseIds || []).map(id))] }))
    }
  }
}

export function courseEarnedCredits(course) {
  const passed = (course.attempts || []).filter(a => typeof a.grade === 'number' ? a.grade >= (course.passMark ?? 5.5) : a.status === 'passed')
    .sort((a, b) => String(a.examDate || a.academicYear || '').localeCompare(String(b.examDate || b.academicYear || '')))
  return passed.length ? Number(passed[0].creditsEarned ?? passed[0].ects ?? course.ects) || 0 : 0
}
