const codeKey = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
const titleKey = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(introduction to|intro to)\b/g, '')
  .replace(/\b(and|the|of)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

/**
 * Build the stable identities implied by the university's own curriculum
 * history. Each official course joins its code and exact normalized title;
 * that lets a later edition bridge either a rename or a recode. A component
 * only receives a canonical identity when it ends in exactly one course in
 * the selected curriculum, so two genuinely distinct current courses are
 * never collapsed merely because an old title was vague.
 */
export function curriculumCourseIdentity({ selectedVersion = null, programmeVersions = [] } = {}) {
  const parent = new Map()
  const find = (node) => {
    if (!parent.has(node)) parent.set(node, node)
    const held = parent.get(node)
    if (held !== node) parent.set(node, find(held))
    return parent.get(node)
  }
  const union = (left, right) => {
    const a = find(left)
    const b = find(right)
    if (a !== b) parent.set(b, a)
  }
  const versions = programmeVersions.length
    ? programmeVersions
    : selectedVersion ? [selectedVersion] : []
  for (const version of versions) {
    for (const course of version?.courses || []) {
      const code = codeKey(course.code)
      const title = titleKey(course.name)
      if (code && title) union(`code:${code}`, `title:${title}`)
    }
  }

  const selectedByRoot = new Map()
  for (const course of selectedVersion?.courses || []) {
    const node = codeKey(course.code) ? `code:${codeKey(course.code)}` : `title:${titleKey(course.name)}`
    const root = find(node)
    const held = selectedByRoot.get(root) || []
    held.push(course)
    selectedByRoot.set(root, held)
  }
  const canonicalByRoot = new Map([...selectedByRoot.entries()].filter(([, courses]) => courses.length === 1).map(([root, courses]) => [root, courses[0]]))
  const canonicalCourse = (course) => {
    const code = codeKey(course?.code)
    const title = titleKey(course?.name)
    const nodes = [code ? `code:${code}` : '', title ? `title:${title}` : ''].filter(Boolean)
    const matches = nodes.map((node) => canonicalByRoot.get(find(node))).filter(Boolean)
    const unique = [...new Map(matches.map((match) => [codeKey(match.code), match])).values()]
    return unique.length === 1 ? unique[0] : null
  }
  return { canonicalCourse, codeKey, titleKey }
}

function attemptFingerprint(attempt) {
  return [
    String(attempt?.academicYear || '').replace(/\s/g, ''),
    attempt?.examDate || '',
    attempt?.type || 'first',
    attempt?.status || 'upcoming',
    attempt?.grade == null ? '' : Number(attempt.grade)
  ].join('|')
}

/**
 * Reconcile already-saved records after a curriculum edition changes. The
 * canonical row adopts today's official identity and placement; attempts keep
 * their historical identity. This is idempotent and deliberately exact.
 */
export function reconcileAcademicCourseIdentities(courses = [], identity) {
  if (!identity?.canonicalCourse) return courses
  const grouped = new Map()
  for (const course of courses || []) {
    const canonical = identity.canonicalCourse(course)
    const canonicalCode = canonical?.code || course.code || ''
    const groupKey = canonical
      ? `canonical:${identity.codeKey(canonicalCode)}`
      : identity.codeKey(course.code) ? `code:${identity.codeKey(course.code)}` : `record:${course.id}`
    const held = grouped.get(groupKey) || { canonical, records: [] }
    held.records.push(course)
    grouped.set(groupKey, held)
  }

  return [...grouped.values()].map(({ canonical, records }) => {
    const canonicalCode = canonical?.code || records[0]?.code || ''
    const preferred = records.find((course) => identity.codeKey(course.code) === identity.codeKey(canonicalCode))
      || records.find((course) => course.programmeRequirement !== 'historical')
      || records[0]
    const attempts = []
    const seen = new Set()
    for (const record of records) {
      for (const rawAttempt of record.attempts || []) {
        const attempt = {
          ...rawAttempt,
          courseCode: rawAttempt.courseCode || record.code || '',
          courseName: rawAttempt.courseName || record.name || '',
          ects: rawAttempt.ects ?? record.ects ?? null,
          yearLevel: rawAttempt.yearLevel || record.yearLevel || '',
          period: rawAttempt.period || record.period || ''
        }
        const fingerprint = attemptFingerprint(attempt)
        if (seen.has(fingerprint)) continue
        seen.add(fingerprint)
        attempts.push(attempt)
      }
    }
    return {
      ...preferred,
      ...(canonical ? {
        code: canonical.code,
        name: canonical.name,
        ects: canonical.ects,
        yearLevel: canonical.yearLevel,
        period: canonical.period,
        templateCourseId: canonical.id,
        programmeRequirement: canonical.requirement
      } : {}),
      attempts
    }
  })
}
