import { normalizeAcademicWorkspace } from './academics.mjs'

const cleanText = (value, max = 200) => String(value ?? '').trim().slice(0, max)
const normalizedCode = (value) => cleanText(value, 40).toUpperCase().replace(/\s+/g, '')

function uniqueAttempts(items = []) {
  const seen = new Set()
  return items.filter((attempt) => {
    const key = [attempt.academicYear, attempt.type, attempt.examDate, attempt.grade, attempt.status].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizeAcademicIntakeDraft(value, editorialCourses = []) {
  const warnings = Array.isArray(value?.warnings)
    ? value.warnings.map((warning) => cleanText(warning, 500)).filter(Boolean).slice(0, 20)
    : []
  const normalized = normalizeAcademicWorkspace({
    profile: value?.profile || {},
    courses: Array.isArray(value?.courses) ? value.courses.slice(0, 200) : [],
    events: Array.isArray(value?.events) ? value.events.slice(0, 100) : []
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
    previous.ects ||= course.ects
    previous.yearLevel ||= course.yearLevel
    previous.period ||= course.period
    previous.notes ||= course.notes
    previous.attempts = uniqueAttempts([...previous.attempts, ...course.attempts])
  }

  const editorialByCode = new Map(editorialCourses.map((course) => [normalizedCode(course.code), course]))
  const matched = []
  const unmatched = []
  const courses = deduped.map((course) => {
    const editorial = editorialByCode.get(normalizedCode(course.code)) || null
    const code = normalizedCode(course.code)
    ;(editorial ? matched : unmatched).push(code || course.name)
    return { ...course, code, editorialCourseId: editorial?.id || null }
  })

  return {
    profile: normalized.profile,
    courses,
    events: normalized.events,
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

export function fallbackAcademicIntake(rawText, editorialCourses = []) {
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

  const courses = []
  const codePattern = /\b([A-Z]{2,10}\s*-?\s*\d{2,5}[A-Z]?)\b/i
  for (const line of lines) {
    const codeMatch = line.match(codePattern)
    if (!codeMatch) continue
    const code = normalizedCode(codeMatch[1])
    const creditsMatch = line.match(/\b(\d+(?:\.\d+)?)\s*(?:ECTS|credits?|credit points?)\b/i)
    const gradeMatch = line.match(/\b(\d+(?:\.\d+)?)\s*(?:%|\/\s*100)/)
    const statusMatch = line.match(/\b(passed|pass|failed|fail|upcoming|enrolled|registered|no[- ]show)\b/i)
    const dateMatch = line.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
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
      ects: creditsMatch ? Number(creditsMatch[1]) : 0,
      yearLevel: '',
      period: '',
      passMark: 5.5,
      notes: '',
      attempts: status || gradeMatch || dateMatch ? [{
        academicYear: profile.academicYear,
        type: 'first',
        examDate: dateMatch?.[1] || null,
        grade: gradeMatch ? Number(gradeMatch[1]) : null,
        status: status || (gradeMatch ? 'passed' : 'upcoming')
      }] : []
    })
  }

  const warnings = []
  if (!courses.length) warnings.push('No course rows could be extracted automatically. Add or correct courses in the review step.')
  if (!profile.programme) warnings.push('The programme name was not explicit in the supplied text.')
  return normalizeAcademicIntakeDraft({ profile, courses, events: [], warnings }, editorialCourses)
}
