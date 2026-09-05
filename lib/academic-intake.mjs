import { normalizeAcademicWorkspace } from './academics.mjs'

const cleanText = (value, max = 200) => String(value ?? '').trim().slice(0, max)
const normalizedCode = (value) => cleanText(value, 40).toUpperCase().replace(/\s+/g, '')
const normalizedName = (value) => cleanText(value, 240).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const decimal = (value) => {
  const number = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

function comparableAcademicYear(value) {
  return cleanText(value, 30).replace(/[–—/]/g, '-')
}

function attemptOrder(attempt) {
  const year = comparableAcademicYear(attempt.academicYear)
  return `${attempt.examDate || `${year.slice(0, 4) || '9999'}-99-99`}|${attempt.status === 'upcoming' ? '9' : '0'}`
}

const ATTEMPT_CONTEXT_FIELDS = ['courseCode', 'courseName', 'ects', 'yearLevel', 'period', 'curriculumVersion']

function fillAttemptContext(target, source) {
  for (const field of ATTEMPT_CONTEXT_FIELDS) {
    const missing = target[field] === null || target[field] === undefined || target[field] === ''
    const present = source[field] !== null && source[field] !== undefined && source[field] !== ''
    if (missing && present) target[field] = source[field]
  }
  return target
}

function uniqueAttempts(items = []) {
  const merged = []
  for (const attempt of items) {
    const exact = merged.find((item) => [comparableAcademicYear(item.academicYear), item.type, item.examDate, item.grade, item.status].join('|') === [comparableAcademicYear(attempt.academicYear), attempt.type, attempt.examDate, attempt.grade, attempt.status].join('|'))
    if (exact) { fillAttemptContext(exact, attempt); continue }
    const compatible = merged.find((item) => comparableAcademicYear(item.academicYear) === comparableAcademicYear(attempt.academicYear)
      && item.status === attempt.status && item.grade === attempt.grade && (!item.examDate || !attempt.examDate))
    if (compatible) {
      if (!compatible.examDate && attempt.examDate) {
        const context = Object.fromEntries(ATTEMPT_CONTEXT_FIELDS.map((field) => [field, compatible[field]]))
        Object.assign(compatible, attempt)
        fillAttemptContext(compatible, context)
      } else fillAttemptContext(compatible, attempt)
      continue
    }
    merged.push({ ...attempt })
  }
  return merged.sort((left, right) => attemptOrder(left).localeCompare(attemptOrder(right)))
}

function academicYearForDate(date) {
  const match = String(date || '').match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (!match) return ''
  const year = Number(match[1])
  const start = Number(match[2]) >= 9 ? year : year - 1
  return `${start}–${start + 1}`
}

function europeanDate(value) {
  const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

function inferAttemptTypes(courses) {
  const groups = new Map()
  for (const course of courses) {
    const key = normalizedCode(course.code) || normalizedName(course.name)
    if (!groups.has(key)) groups.set(key, [])
    for (const attempt of course.attempts || []) groups.get(key).push(attempt)
  }
  for (const attempts of groups.values()) {
    attempts.sort((left, right) => attemptOrder(left).localeCompare(attemptOrder(right)))
    attempts.forEach((attempt, index) => {
      if (!index) attempt.type = 'first'
      else attempt.type = comparableAcademicYear(attempt.academicYear) === comparableAcademicYear(attempts[index - 1].academicYear) ? 'resit' : 'carry-over'
    })
  }
  return courses
}

export function detectAcademicDocumentKind(rawText) {
  const source = String(rawText || '')
  if (/\bAcademic overview\b/i.test(source) || (/\bCurrent courses\b/i.test(source) && /\bFailed courses\b/i.test(source) && /\bCompleted courses\b/i.test(source))) return 'academic-overview'
  if (/\bTranscript\s*\/\s*Resultatenoverzicht\b/i.test(source) || /\bEND OF TRANSCRIPT\b/i.test(source)) return 'transcript'
  return null
}

function parseAcademicOverview(source) {
  if (detectAcademicDocumentKind(source) !== 'academic-overview') return []
  const lines = String(source).replace(/\r/g, '').split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
  const courses = []
  let section = null
  let pending = null
  const flush = (code) => {
    if (!pending || !code) return
    const grade = pending.result === '-' || /^NG$/i.test(pending.result) ? null : decimal(pending.result)
    const status = pending.section === 'current' ? 'upcoming' : pending.section === 'completed' ? 'passed' : 'failed'
    const periodNumber = Number(pending.block) >= 100 ? Math.trunc(Number(pending.block) / 100) : null
    courses.push({
      code: normalizedCode(code),
      name: pending.name,
      ects: pending.availableCredits || 0,
      yearLevel: '',
      period: periodNumber ? `Period ${periodNumber}` : '',
      passMark: 5.5,
      notes: pending.result === 'NG' ? 'Academic overview records this result as NG.' : '',
      programmeRequirement: pending.section === 'current' ? null : 'historical',
      attempts: [{ academicYear: `${pending.startYear}–${pending.endYear}`, type: 'first', examDate: null, grade, status }]
    })
    pending = null
  }
  for (const line of lines) {
    if (/^Current courses$/i.test(line)) { section = 'current'; pending = null; continue }
    if (/^Failed courses$/i.test(line)) { section = 'failed'; pending = null; continue }
    if (/^Completed courses$/i.test(line)) { section = 'completed'; pending = null; continue }
    const row = section && line.match(/^(20\d{2})[-–](20\d{2})-(\d{3})-\s+(.+?)\s+(NG|-|\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/i)
    if (row) {
      pending = { section, startYear: row[1], endYear: row[2], block: row[3], name: row[4].trim(), result: row[5].toUpperCase(), earnedCredits: decimal(row[6]), availableCredits: decimal(row[7]) }
      continue
    }
    const code = line.match(/^([A-Z]{2,10}\d{2,6}[A-Z]?)$/i)?.[1]
    if (code && pending) flush(code)
  }
  return inferAttemptTypes(courses)
}

function parseOfficialTranscript(source, codeByName = new Map()) {
  if (!/\bTranscript\s*\/\s*Resultatenoverzicht\b/i.test(source)) return []
  const rawLines = String(source).replace(/\r/g, '').split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
  const transcriptRow = /^(.+?)\s+(NG|\d+(?:[.,]\d+)?)\s+(\d{2}\.\d{2}\.\d{4})\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(?:\s+\d+)?$/i
  const transcriptBoundary = /^(Transcript\b|Bachelor\b|Master\b|BSc\b.*\byear\s+\d+|END OF TRANSCRIPT\b|Academic overview\b|Current courses\b|Failed courses\b|Completed courses\b|Grade\b|Course code\b|Earned credits\b|Minimum credits\b|Grade Point Average\b|20\d{2}\s*[-–])/i
  // Transcript course titles can wrap independently from their numeric
  // columns. Only join adjacent lines when the combined value becomes a full
  // dated result row, so document headings never get absorbed into a course.
  const lines = []
  for (let index = 0; index < rawLines.length; index += 1) {
    let line = rawLines[index]
    if (!transcriptRow.test(line) && !transcriptBoundary.test(line)) {
      let combined = line
      for (let lookahead = index + 1; lookahead < rawLines.length && lookahead <= index + 2; lookahead += 1) {
        combined = `${combined} ${rawLines[lookahead]}`
        if (!transcriptRow.test(combined)) continue
        line = combined
        index = lookahead
        break
      }
    }
    lines.push(line)
  }
  const courses = []
  let yearLevel = ''
  for (const line of lines) {
    const section = line.match(/^BSc CS year\s+(\d+)\b/i)
    if (section) { yearLevel = `Year ${section[1]}`; continue }
    const row = line.match(transcriptRow)
    if (!row || /^(Grade|Earned credits|Minimum credits|Grade Point Average)/i.test(row[1])) continue
    const name = row[1].trim()
    const examDate = europeanDate(row[3])
    const attemptedCredits = decimal(row[4]) || 0
    const earnedCredits = decimal(row[5]) || 0
    const grade = /^NG$/i.test(row[2]) ? null : decimal(row[2])
    courses.push({
      code: codeByName.get(normalizedName(name)) || '',
      name,
      ects: attemptedCredits,
      yearLevel,
      period: '',
      passMark: 5.5,
      notes: /^NG$/i.test(row[2]) ? 'Transcript records this result as NG.' : '',
      programmeRequirement: 'historical',
      attempts: [{ academicYear: academicYearForDate(examDate), type: 'first', examDate, grade, status: earnedCredits > 0 ? 'passed' : 'failed' }]
    })
  }
  return inferAttemptTypes(courses)
}

function canonicalCourseCodesByName(courses = []) {
  const grouped = new Map()
  for (const course of courses || []) {
    const name = normalizedName(course?.name)
    const code = normalizedCode(course?.code)
    if (!name || !code) continue
    const held = grouped.get(name) || { selected: new Set(), historical: [] }
    if (course.selectedCurriculum) held.selected.add(code)
    held.historical.push({ code, curriculumVersion: course.curriculumVersion || '' })
    grouped.set(name, held)
  }
  return new Map([...grouped.entries()].flatMap(([name, group]) => {
    if (group.selected.size === 1) return [[name, [...group.selected][0]]]
    if (group.selected.size > 1) return []
    const latest = [...group.historical].sort((left, right) => String(right.curriculumVersion).localeCompare(String(left.curriculumVersion)))[0]
    return latest?.code ? [[name, latest.code]] : []
  }))
}

/**
 * Fill a title-only transcript identity only when the selected programme's
 * official curriculum history assigns that exact title one unambiguous code.
 * This connects a course that moved between years/periods without projecting
 * a merely similar modern course onto an older record.
 */
function connectProgrammeCourseIdentities(courses, identityCourses, warnings) {
  const codes = canonicalCourseCodesByName(identityCourses)
  let connected = 0
  for (const course of courses) {
    if (normalizedCode(course.code)) continue
    const match = codes.get(normalizedName(course.name))
    if (!match) continue
    course.code = match
    for (const attempt of course.attempts || []) attempt.courseCode ||= match
    connected += 1
  }
  if (connected) warnings.push(`${connected} title-only transcript ${connected === 1 ? 'course was' : 'courses were'} connected to stable codes found across the selected programme's official curriculum editions.`)
}

export function mergeAcademicIntakeDrafts(primary = {}, supplement = {}) {
  const courses = (Array.isArray(primary?.courses) ? primary.courses : []).map((course) => structuredClone(course))
  for (const extra of Array.isArray(supplement?.courses) ? supplement.courses : []) {
    const extraCode = normalizedCode(extra?.code)
    const extraName = normalizedName(extra?.name)
    const held = courses.find((course) => {
      const heldCode = normalizedCode(course?.code)
      return extraCode && heldCode ? extraCode === heldCode : extraName && extraName === normalizedName(course?.name)
    })
    if (!held) {
      courses.push(structuredClone(extra))
      continue
    }
    held.code ||= extra.code
    held.name ||= extra.name
    held.ects ||= extra.ects
    held.yearLevel ||= extra.yearLevel
    held.period ||= extra.period
    held.attempts = [...(held.attempts || []), ...(extra.attempts || []).map((attempt) => structuredClone(attempt))]
  }
  return {
    ...supplement,
    ...primary,
    profile: { ...(supplement?.profile || {}), ...(primary?.profile || {}) },
    courses,
    events: [...(Array.isArray(primary?.events) ? primary.events : []), ...(Array.isArray(supplement?.events) ? supplement.events : [])],
    warnings: [...new Set([...(primary?.warnings || []), ...(supplement?.warnings || [])])]
  }
}

export function normalizeAcademicIntakeDraft(value, editorialCourses = [], { kind = 'auto', identityCourses = [] } = {}) {
  const warnings = Array.isArray(value?.warnings)
    ? value.warnings.map((warning) => cleanText(warning, 500)).filter(Boolean).slice(0, 20)
    : []
  const addWarning = (warning) => {
    const clean = cleanText(warning, 500)
    if (clean && warnings.length < 20 && !warnings.includes(clean)) warnings.push(clean)
  }
  const normalized = normalizeAcademicWorkspace({
    profile: value?.profile || {},
    courses: Array.isArray(value?.courses) ? value.courses.slice(0, 200) : [],
    events: Array.isArray(value?.events) ? value.events.slice(0, 100) : []
  })
  if (kind === 'transcript' && identityCourses.length) connectProgrammeCourseIdentities(normalized.courses, identityCourses, warnings)
  // Snapshot row-level course facts onto each sitting before records with the
  // same code are merged. The canonical course can later move between periods
  // or curriculum years without rewriting where an older attempt occurred.
  for (const course of normalized.courses) {
    course.attempts = course.attempts.map((attempt) => ({
      ...attempt,
      courseCode: attempt.courseCode || course.code,
      courseName: attempt.courseName || course.name,
      ects: attempt.ects ?? (course.ects || null),
      yearLevel: attempt.yearLevel || course.yearLevel,
      period: attempt.period || course.period,
      curriculumVersion: attempt.curriculumVersion || attempt.academicYear
    }))
  }
  const sourceEvents = Array.isArray(value?.events) ? value.events : []
  const events = normalized.events.map((event, index) => {
    const source = sourceEvents.find((item) => item?.id && String(item.id) === event.id)
      || sourceEvents.find((item) => cleanText(item?.title, 200) === event.title && String(item?.date || '') === event.date)
      || sourceEvents[index]
      || {}
    return {
      ...event,
      kind: ['period', 'exam-week', 'resit-week', 'study-week', 'project-week', 'holiday', 'intro', 'deadline', 'ceremony', 'other'].includes(source.kind) ? source.kind : 'other',
      period: source.period == null ? null : Number(source.period),
      semester: source.semester == null ? null : Number(source.semester),
      resit: source.resit === true,
      cohorts: Array.isArray(source.cohorts) ? source.cohorts.map((item) => cleanText(item, 40)).filter(Boolean).slice(0, 20) : [],
      academicYear: cleanText(source.academicYear, 30)
    }
  })

  const deduped = []
  const byKey = new Map()
  for (const course of normalized.courses) {
    const key = normalizedCode(course.code) || course.name.toLocaleLowerCase()
    const previous = byKey.get(key)
    if (!previous) {
      byKey.set(key, course)
      deduped.push(course)
      continue
    }
    const label = normalizedCode(course.code) || previous.name
    if (previous.name.toLocaleLowerCase() !== course.name.toLocaleLowerCase()) addWarning(`${label} appears with different course titles across the supplied records. Its attempts were grouped by course code; keep the current plan title unless the code itself changed.`)
    if (previous.ects && course.ects && previous.ects !== course.ects) addWarning(`${label} appears with different credit values across the supplied records. Historical transcript credits were not treated as the current curriculum value.`)
    if (previous.yearLevel && course.yearLevel && previous.yearLevel !== course.yearLevel) addWarning(`${label} appears in different study years or levels across the supplied records. Attempt years were preserved separately.`)
    if (previous.period && course.period && previous.period !== course.period) addWarning(`${label} appears in different teaching periods across the supplied records. Attempt years were preserved separately.`)
    previous.ects ||= course.ects
    previous.yearLevel ||= course.yearLevel
    previous.period ||= course.period
    previous.notes ||= course.notes
    previous.programmeRequirement ||= course.programmeRequirement
    previous.attempts = uniqueAttempts([...previous.attempts, ...course.attempts])
  }

  const editorialByCode = new Map(editorialCourses.map((course) => [normalizedCode(course.code), course]))
  const matched = []
  const unmatched = []
  const courses = deduped.map((course) => {
    const editorial = editorialByCode.get(normalizedCode(course.code)) || null
    const code = normalizedCode(course.code)
    ;(editorial ? matched : unmatched).push(code || course.name)
    const hasUpcoming = (course.attempts || []).some((attempt) => attempt.status === 'upcoming')
    const historical = kind === 'transcript' || kind === 'academic-overview' && !hasUpcoming
    const programmeRequirement = historical ? 'historical' : hasUpcoming && course.programmeRequirement === 'historical' ? null : course.programmeRequirement
    return { ...course, code, editorialCourseId: editorial?.id || null, programmeRequirement }
  })

  return {
    profile: normalized.profile,
    courses,
    events,
    warnings,
    connections: {
      total: courses.length,
      matched: matched.length,
      unmatched: unmatched.length,
      matchedLabels: matched,
      unmatchedLabels: unmatched
    }
  }
}

export function fallbackAcademicIntake(rawText, editorialCourses = [], { kind = 'auto', identityCourses = [] } = {}) {
  const source = String(rawText || '').replace(/\r/g, '')
  const lines = source.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const profile = { university: '', programme: '', academicYear: '', currentYearKey: '' }
  // An academic year is two consecutive years ("2026-2027", "2026/27"), never
  // the year-month prefix of an ISO date.
  for (const match of source.matchAll(/\b(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b(?![-–/]\d)/g)) {
    const first = Number(match[1])
    const second = match[2].length === 2 ? Number(match[1].slice(0, 2) + match[2]) : Number(match[2])
    if (second === first + 1) { profile.academicYear = `${first}–${second}`; break }
  }

  for (const line of lines) {
    const university = line.match(/^(?:university|institution|school)\s*[:\-]\s*(.+)$/i)
    if (university && !profile.university) profile.university = university[1]
    const programme = line.match(/^(?:programme|program|degree|course of study)\s*[:\-]\s*(.+)$/i)
    if (programme && !profile.programme) profile.programme = programme[1]
  }
  if (!profile.university && /\bMaastricht University\b/i.test(source)) profile.university = 'Maastricht University'
  if (!profile.programme) profile.programme = cleanText(source.match(/\b(Bachelor of Science in Computer Science)\b/i)?.[1], 200)

  const overviewCourses = parseAcademicOverview(source)
  const currentOverviewYears = overviewCourses.flatMap((course) => course.attempts || [])
    .filter((attempt) => attempt.status === 'upcoming' && attempt.academicYear)
    .map((attempt) => comparableAcademicYear(attempt.academicYear))
    .sort()
  if (currentOverviewYears.length) profile.academicYear = currentOverviewYears.at(-1).replace('-', '–')
  // Only another student-owned source may provide a missing transcript code.
  // Projecting today's maintained catalogue onto an old title would silently
  // rewrite historical curriculum identity.
  const codeByName = new Map()
  for (const course of overviewCourses) if (course.code) codeByName.set(normalizedName(course.name), normalizedCode(course.code))
  const transcriptCourses = parseOfficialTranscript(source, codeByName)
  const courses = [...overviewCourses, ...transcriptCourses]
  const specialisedCodes = new Set(overviewCourses.map((course) => normalizedCode(course.code)).filter(Boolean))
  const codePattern = /\b([A-Z]{2,10}\s*-?\s*\d{2,5}[A-Z]?)\b/i
  for (const line of overviewCourses.length || transcriptCourses.length ? [] : lines) {
    const codeMatch = line.match(codePattern)
    if (!codeMatch) continue
    const code = normalizedCode(codeMatch[1])
    if (new Set(['ECTS', 'PAGE', 'GRADE', 'RESULT', 'STUDENT']).has(code.match(/^[A-Z]+/)?.[0])) continue
    if (specialisedCodes.has(code) && normalizedCode(line) === code) continue
    const creditsMatch = line.match(/\b(\d+(?:[.,]\d+)?)\s*(?:ECTS|credits?|credit points?)\b/i)
    const gradeMatch = line.match(/\b(?:grade|result)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\b/i) || line.match(/\b(\d+(?:[.,]\d+)?)\s*(?:%|\/\s*(?:10|100))/)
    const statusMatch = line.match(/\b(passed|pass|failed|fail|upcoming|enrolled|registered|no[- ]show)\b/i)
    const dateMatch = line.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
    const rowYearMatch = line.match(/\b(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b(?![-–/]\d)/)
    const rowAcademicYear = rowYearMatch ? `${rowYearMatch[1]}–${rowYearMatch[2].length === 2 ? rowYearMatch[1].slice(0, 2) + rowYearMatch[2] : rowYearMatch[2]}` : profile.academicYear
    const attemptType = /\b(resit|retake|second attempt)\b/i.test(line) ? 'resit' : /\b(carry[- ]?over)\b/i.test(line) ? 'carry-over' : 'first'
    let name = line.slice((codeMatch.index || 0) + codeMatch[0].length)
      .replace(/\b\d+(?:\.\d+)?\s*(?:ECTS|credits?|credit points?)\b.*$/i, '')
      .replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, '')
    if (!name) name = code
    const status = statusMatch
      ? /fail/i.test(statusMatch[1]) ? 'failed' : /upcoming|enrolled|registered/i.test(statusMatch[1]) ? 'upcoming' : /no/i.test(statusMatch[1]) ? 'no-show' : 'passed'
      : null
    courses.push({
      code,
      name,
      ects: creditsMatch ? decimal(creditsMatch[1]) : 0,
      yearLevel: '',
      period: '',
      passMark: 5.5,
      notes: '',
      attempts: status || gradeMatch || dateMatch ? [{
        academicYear: rowAcademicYear,
        type: attemptType,
        examDate: dateMatch?.[1] || null,
        grade: gradeMatch ? decimal(gradeMatch[1]) : null,
        status: status || (gradeMatch ? 'passed' : 'upcoming')
      }] : []
    })
  }

  const warnings = []
  if (!courses.length) warnings.push('No course rows could be extracted automatically. Add or correct courses in the review step.')
  if (!profile.programme) warnings.push('The programme name was not explicit in the supplied text.')
  if (overviewCourses.length) warnings.push(`Academic overview recognised: ${overviewCourses.filter((course) => course.programmeRequirement !== 'historical').length} current rows and ${overviewCourses.filter((course) => course.programmeRequirement === 'historical').length} historical rows were separated.`)
  if (transcriptCourses.length) warnings.push(`Official transcript recognised: ${transcriptCourses.length} dated result rows were preserved as attempt history.`)
  const detected = detectAcademicDocumentKind(source)
  const effectiveKind = detected === 'academic-overview' && (kind === 'auto' || kind === 'transcript') ? 'academic-overview' : kind === 'auto' && detected ? detected : kind
  return normalizeAcademicIntakeDraft({ profile, courses, events: [], warnings }, editorialCourses, { kind: effectiveKind, identityCourses })
}
