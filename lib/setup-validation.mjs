const words = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b(bachelor|master|of|science|arts|bsc|msc|ba|ma|programme|program)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter((word) => word.length > 2)

export function programmesMatch(selected, observed) {
  const left = new Set(words(selected))
  const right = new Set(words(observed))
  if (!left.size || !right.size) return true
  const shared = [...left].filter((word) => right.has(word)).length
  return shared / Math.min(left.size, right.size) >= 0.6
}

export function validateSetupSources({ programmeName = '', recordProgramme = '', selectedCourses = [], recordCourses = [] } = {}) {
  const issues = []
  if (programmeName && recordProgramme && !programmesMatch(programmeName, recordProgramme)) {
    issues.push({
      id: 'programme-record-mismatch',
      step: 'record',
      relatedStep: 'programme',
      severity: 'error',
      title: 'Programme and academic record disagree',
      detail: `Your workspace is set to “${programmeName}”, but the uploaded record identifies “${recordProgramme}”.`,
      recovery: 'Choose the correct programme or replace the academic record before relying on credits and course status.'
    })
  }

  const expected = new Set(selectedCourses.map((course) => String(course?.code || '').trim().toUpperCase()).filter(Boolean))
  const current = recordCourses.filter((course) => course?.section === 'current' || course?.status === 'upcoming')
  const unexpected = current.filter((course) => course?.code && !expected.has(String(course.code).toUpperCase()))
  if (expected.size && current.length && unexpected.length / current.length >= 0.6) {
    issues.push({
      id: 'current-courses-record-mismatch',
      step: 'record',
      relatedStep: 'programme',
      severity: 'warning',
      title: 'Most current courses are outside the selected programme',
      detail: `${unexpected.slice(0, 4).map((course) => course.code).join(', ')}${unexpected.length > 4 ? ` and ${unexpected.length - 4} more` : ''} are not in the current workspace plan.`,
      recovery: 'Review the programme and study year. Historical passed and failed courses are not treated as conflicts.',
      unexpectedCourses: unexpected.map((course) => ({ code: String(course.code || ''), name: String(course.name || ''), status: String(course.status || course.section || 'current') })),
      expectedCourses: selectedCourses.map((course) => ({ code: String(course?.code || ''), name: String(course?.name || '') })).filter((course) => course.code)
    })
  }
  return issues
}
