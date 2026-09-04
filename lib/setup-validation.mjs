const words = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b(bachelor|master|of|science|arts|bsc|msc|ba|ma|programme|program)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter((word) => word.length > 2)

const code = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
const title = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(introduction to|intro to)\b/g, '')
  .replace(/\b(and|the|of)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
const currentRecord = (course) => course?.section === 'current' || course?.status === 'upcoming'
const placement = (course) => [course?.yearLevel, course?.period].filter(Boolean).join(' · ')

export function programmesMatch(selected, observed) {
  const left = new Set(words(selected))
  const right = new Set(words(observed))
  if (!left.size || !right.size) return true
  const shared = [...left].filter((word) => right.has(word)).length
  return shared / Math.min(left.size, right.size) >= 0.6
}

/**
 * Match an academic record against the whole selected curriculum and its
 * maintained editions. A student's current-year workspace is deliberately
 * not used as the catalogue: it contains only chosen electives and required
 * courses for one year, so comparing against it made every legitimate
 * elective and carry-over look like the wrong programme.
 */
export function reconcileProgrammeCourses({ selectedVersion = null, programmeVersions = [], selectedCourses = [], recordCourses = [], studyYear = '' } = {}) {
  const selected = selectedVersion?.courses || selectedCourses || []
  const versions = programmeVersions.length
    ? programmeVersions
    : [{ id: selectedVersion?.id || '', label: selectedVersion?.label || '', courses: selected }]
  const selectedByCode = new Map(selected.map((course) => [code(course.code), course]).filter(([key]) => key))
  const selectedByTitle = new Map()
  for (const course of selected) {
    const key = title(course.name)
    if (!key) continue
    const values = selectedByTitle.get(key) || []
    values.push(course)
    selectedByTitle.set(key, values)
  }
  const historyByCode = new Map()
  const historyByTitle = new Map()
  for (const version of versions) {
    for (const course of version.courses || []) {
      const item = { ...course, versionId: version.id, versionLabel: version.label || version.id }
      const codeKey = code(course.code)
      const titleKey = title(course.name)
      if (codeKey) historyByCode.set(codeKey, [...(historyByCode.get(codeKey) || []), item])
      if (titleKey) historyByTitle.set(titleKey, [...(historyByTitle.get(titleKey) || []), item])
    }
  }

  const records = recordCourses.map((record) => {
    const recordCode = code(record?.code)
    const recordTitle = title(record?.name)
    const exact = selectedByCode.get(recordCode) || null
    const sameTitle = selectedByTitle.get(recordTitle) || []
    const historicCode = historyByCode.get(recordCode) || []
    const historicTitle = historyByTitle.get(recordTitle) || []
    const selectedMatch = exact || (sameTitle.length === 1 ? sameTitle[0] : null)
    const historicMatch = historicCode[0] || historicTitle[0] || null
    const match = selectedMatch || historicMatch
    let status = 'outside'
    if (exact) status = exact.yearLevel && studyYear && exact.yearLevel !== studyYear ? 'other-year' : 'current'
    else if (selectedMatch) status = 'code-changed'
    else if (historicMatch) status = 'historical'

    return {
      code: String(record?.code || ''),
      name: String(record?.name || ''),
      academicYear: String(record?.academicYear || ''),
      yearLevel: String(record?.yearLevel || ''),
      period: String(record?.period || ''),
      section: String(record?.section || record?.status || ''),
      current: currentRecord(record),
      status,
      recognized: Boolean(match),
      matchedCode: String(match?.code || ''),
      matchedName: String(match?.name || ''),
      expectedYear: String(match?.yearLevel || ''),
      expectedPeriod: String(match?.period || ''),
      versions: [...new Set([...historicCode, ...historicTitle].map((item) => item.versionId).filter(Boolean))]
    }
  })

  const changes = []
  const seenChanges = new Set()
  for (const record of records.filter((item) => item.recognized)) {
    const family = historyByTitle.get(title(record.matchedName || record.name)) || historyByCode.get(code(record.matchedCode || record.code)) || []
    const positions = family.map((item) => ({ versionId: item.versionId, code: item.code, yearLevel: item.yearLevel, period: item.period, source: 'catalogue' }))
    const recordMoved = Boolean(
      (record.period && record.expectedPeriod && record.period !== record.expectedPeriod)
      || (record.yearLevel && record.expectedYear && record.yearLevel !== record.expectedYear)
    )
    if (record.academicYear && recordMoved) positions.push({ versionId: record.academicYear, code: record.code, yearLevel: record.yearLevel, period: record.period, source: 'academic-record' })
    const unique = [...new Map(positions.map((item) => [`${item.versionId}|${code(item.code)}|${placement(item)}`, item])).values()]
    const distinctCodes = new Set(unique.map((item) => code(item.code)).filter(Boolean))
    const distinctPlacements = new Set(unique.map(placement).filter(Boolean))
    if (record.status !== 'code-changed' && distinctCodes.size < 2 && distinctPlacements.size < 2 && !recordMoved) continue
    const key = title(record.matchedName || record.name) || code(record.matchedCode || record.code)
    if (seenChanges.has(key)) continue
    seenChanges.add(key)
    changes.push({
      id: key,
      name: record.matchedName || record.name,
      currentCode: record.matchedCode || record.code,
      kind: distinctCodes.size > 1 ? 'code-and-placement' : 'placement',
      placements: unique.sort((left, right) => String(right.versionId).localeCompare(String(left.versionId)))
    })
  }

  const current = records.filter((record) => record.current)
  const outside = current.filter((record) => !record.recognized)
  return {
    selectedVersionId: selectedVersion?.id || '',
    currentCount: current.length,
    recognizedCount: current.length - outside.length,
    outsideCount: outside.length,
    otherYearCount: current.filter((record) => record.status === 'other-year').length,
    historicalCount: records.filter((record) => record.status === 'historical' || record.status === 'code-changed').length,
    records,
    outside,
    changes
  }
}

export function validateSetupSources({ programmeName = '', recordProgramme = '', selectedVersion = null, programmeVersions = [], selectedCourses = [], recordCourses = [], studyYear = '' } = {}) {
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

  const reconciliation = reconcileProgrammeCourses({ selectedVersion, programmeVersions, selectedCourses, recordCourses, studyYear })
  const selected = selectedVersion?.courses || selectedCourses || []
  if (selected.length && reconciliation.currentCount && reconciliation.outsideCount / reconciliation.currentCount >= 0.6) {
    issues.push({
      id: 'current-courses-record-mismatch',
      step: 'record',
      relatedStep: 'programme',
      severity: 'warning',
      title: 'Most current courses are outside every maintained curriculum edition',
      detail: `${reconciliation.outside.slice(0, 4).map((course) => course.code).join(', ')}${reconciliation.outside.length > 4 ? ` and ${reconciliation.outside.length - 4} more` : ''} could not be found in the selected curriculum or its maintained history.`,
      recovery: 'Review the programme and curriculum edition. Electives, courses from another study year, and known historical codes are already treated as valid.',
      unexpectedCourses: reconciliation.outside.map((course) => ({ code: course.code, name: course.name, status: course.section || 'current' })),
      expectedCourses: selected.map((course) => ({ code: String(course?.code || ''), name: String(course?.name || '') })).filter((course) => course.code)
    })
  }
  return issues
}
