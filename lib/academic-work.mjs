// The "Academic Work" overview a student prints from the Maastricht student
// portal (My Study). It is the authoritative record of what they are registered
// for and every attempt they have made, and it is rigidly structured — course
// code, description, result, credits — so it is read here by a parser rather
// than by a model. That makes it free, instant, repeatable, and it cannot
// invent a grade.
//
// The identity in the first column is a triple, not a course code:
//
//     2026-2027-100-BCS2120
//     └ academic year ┘ └┬┘ └──┬───┘
//                   period   course
//
// The same triple Canvas uses for its terms (2026_100 Period 1), which is what
// lets an attempt from this document line up with a Canvas course edition.

const PERIOD_NAMES = Object.freeze({
  '001': 'Year', '002': 'Semester 1', '003': 'Semester 2',
  100: 'Period 1', 200: 'Period 2', 300: 'Period 3',
  400: 'Period 4', 500: 'Period 5', 600: 'Period 6'
})

// Headings vary in case and wording between print runs; match on the noun.
const SECTIONS = [
  [/^current\s+courses?\b/i, 'current'],
  [/^(completed|passed|obtained)\s+(courses?|results?)\b/i, 'completed'],
  [/^failed\s+courses?\b/i, 'failed'],
  [/^(exempt|exemptions?)\b/i, 'exempt']
]

export class AcademicWorkError extends Error {}

function text(value, max = 300) {
  return String(value ?? '').replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Dutch decimals use a comma. "5,0" is five, not five thousand.
function decimal(value) {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseCourseIdentity(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{4})-(\d{3})-([A-Za-z]{2,6}\d{3,5}[A-Za-z]?)$/)
  if (!match) return null
  return {
    academicYear: `${match[1]}-${match[2]}`,
    periodCode: match[3],
    period: PERIOD_NAMES[match[3]] || PERIOD_NAMES[Number(match[3])] || null,
    code: match[4].toUpperCase()
  }
}

// A pass at Maastricht is 5.5 and above; 5.0 in the failed section is a fail
// even though it rounds to a pass elsewhere. The section the row sits in is
// what decides, and the grade is only used where the section does not say.
function attemptStatus(section, grade, result) {
  if (section === 'completed') return 'passed'
  if (section === 'failed') return result === 'NG' ? 'no-show' : 'failed'
  if (section === 'exempt') return 'exempt'
  if (grade != null) return grade >= 5.5 ? 'passed' : 'failed'
  return 'upcoming'
}

/**
 * Reads the extracted text of an Academic Work PDF.
 *
 * Line wrapping is the only real difficulty: the course code column wraps
 * ("2026-2027-100-" then "BCS2120" on the next line) and so does a long
 * description, so rows are reassembled before being matched.
 */
export function parseAcademicWork(input) {
  const raw = String(input || '')
  if (!raw.trim()) throw new AcademicWorkError('This file contained no readable text. If it is a scan, print the overview again from the student portal rather than photographing it.')

  const lines = raw.split(/\r?\n/).map((line) => line.replace(/ /g, ' ').trimEnd())
  const printedOn = raw.match(/printed on\s+(\d{1,2}\s+\w{3,}\s+\d{4})/i)?.[1] || null
  const studentNumber = raw.match(/\b(i\d{6,8})\b/)?.[1] || null
  const studentName = raw.match(/^\s*([^\n]{2,80}?)\s*\(Stud\.[^)]*\)\s*$/m)?.[1] || null
  const programme = raw.match(/^\s*(Bachelor|Master)\s+of\s+[^\n]{3,120}$/mi)?.[0]?.trim() || null

  // Glue a wrapped identity back onto the row that follows it.
  const joined = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^\d{4}-\d{4}-\d{3}-$/.test(trimmed) || /^\d{4}-\d{4}-\d{3}-\s*$/.test(trimmed)) { joined.push({ pending: trimmed }); continue }
    const previous = joined[joined.length - 1]
    if (previous?.pending) { joined[joined.length - 1] = { line: `${previous.pending}${trimmed}` }; continue }
    joined.push({ line: trimmed })
  }

  const courses = []
  let section = null
  for (const entry of joined) {
    const line = entry.line
    if (!line) continue
    const heading = SECTIONS.find(([pattern]) => pattern.test(line))
    if (heading) { section = heading[1]; continue }

    // The actual My Study printout often wraps the narrow first column in the
    // opposite direction to the variant above: the year and period stay on
    // the table row, while the course code is pushed onto the next visual
    // line. Keep the row until that code arrives. This is also how older
    // Academic Work printouts are laid out.
    const identityAfter = line.match(/^(\d{4})\s*[-–]\s*(\d{4})\s*-\s*(\d{3})\s*-\s+(.+?)\s+(-|NG|\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*$/i)
    if (identityAfter) {
      courses.push({
        pendingCode: true,
        academicYear: `${identityAfter[1]}-${identityAfter[2]}`,
        periodCode: identityAfter[3],
        period: PERIOD_NAMES[identityAfter[3]] || PERIOD_NAMES[Number(identityAfter[3])] || null,
        name: text(identityAfter[4], 200),
        result: identityAfter[5] === '-' ? null : identityAfter[5].toUpperCase(),
        creditsEarned: decimal(identityAfter[6]),
        creditsTotal: decimal(identityAfter[7]),
        section: section || 'current'
      })
      continue
    }

    const pendingCode = courses[courses.length - 1]
    const codeOnly = line.match(/^([A-Za-z]{2,10}\s*-?\s*\d{2,6}[A-Za-z]?)$/)?.[1]?.replace(/[\s-]+/g, '').toUpperCase()
    if (pendingCode?.pendingCode && codeOnly) {
      const grade = pendingCode.result && pendingCode.result !== 'NG' ? decimal(pendingCode.result) : null
      courses[courses.length - 1] = {
        academicYear: pendingCode.academicYear,
        periodCode: pendingCode.periodCode,
        period: pendingCode.period,
        code: codeOnly,
        name: pendingCode.name,
        result: pendingCode.result,
        grade,
        creditsEarned: pendingCode.creditsEarned,
        creditsTotal: pendingCode.creditsTotal,
        section: pendingCode.section,
        status: attemptStatus(pendingCode.section, grade, pendingCode.result)
      }
      continue
    }
    // A code split across lines leaves the identity alone on its own line.
    const identityOnly = line.match(/^(\d{4}-\d{4}-\d{3}-[A-Za-z]{2,6}\d{3,5}[A-Za-z]?)$/)
    if (identityOnly) { courses.push({ identity: parseCourseIdentity(identityOnly[1]), section, partial: true }); continue }

    const match = line.match(/^(\d{4}-\d{4}-\d{3}-[A-Za-z]{2,6}\d{3,5}[A-Za-z]?)\s+(.+?)\s+(-|NG|\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*$/)
    if (match) {
      const identity = parseCourseIdentity(match[1])
      if (!identity) continue
      const result = match[3] === '-' ? null : match[3]
      const grade = result && result !== 'NG' ? decimal(result) : null
      courses.push({
        ...identity,
        name: text(match[2], 200),
        result,
        grade,
        creditsEarned: decimal(match[4]),
        creditsTotal: decimal(match[5]),
        section: section || 'current',
        status: attemptStatus(section || 'current', grade, result)
      })
      continue
    }

    // The row above was an identity on its own; this line carries the rest.
    const previous = courses[courses.length - 1]
    if (previous?.partial) {
      const rest = line.match(/^(.+?)\s+(-|NG|\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*$/)
      if (rest && previous.identity) {
        const result = rest[2] === '-' ? null : rest[2]
        const grade = result && result !== 'NG' ? decimal(result) : null
        courses[courses.length - 1] = {
          ...previous.identity,
          name: text(rest[1], 200),
          result,
          grade,
          creditsEarned: decimal(rest[3]),
          creditsTotal: decimal(rest[4]),
          section: previous.section || 'current',
          status: attemptStatus(previous.section || 'current', grade, result)
        }
      }
    }
  }

  const rows = courses.filter((course) => course.code)
  if (!rows.length) throw new AcademicWorkError('No course rows were found. Make sure this is the “Academic Work” overview printed from My Study in the student portal.')

  return {
    kind: 'academic-work',
    printedOn,
    student: { name: text(studentName, 120) || null, number: studentNumber },
    programme: text(programme, 160) || null,
    courses: rows,
    summary: summariseAcademicWork(rows)
  }
}

export function summariseAcademicWork(courses = []) {
  const passed = courses.filter((course) => course.status === 'passed')
  const failed = courses.filter((course) => course.status === 'failed' || course.status === 'no-show')
  const current = courses.filter((course) => course.status === 'upcoming')
  const graded = passed.filter((course) => course.grade != null)
  return {
    earnedEcts: Number(passed.reduce((total, course) => total + (course.creditsEarned ?? course.creditsTotal ?? 0), 0).toFixed(1)),
    // A course is counted once however many times it was attempted.
    passedCourses: new Set(passed.map((course) => course.code)).size,
    failedAttempts: failed.length,
    currentCourses: current.length,
    weightedAverage: graded.length
      ? Number((graded.reduce((total, course) => total + course.grade * (course.creditsTotal || 1), 0) / graded.reduce((total, course) => total + (course.creditsTotal || 1), 0)).toFixed(2))
      : null,
    academicYears: [...new Set(courses.map((course) => course.academicYear))].sort()
  }
}

// What changed between two uploads. This is the whole point of keeping
// snapshots: a student wants to see the movement, not re-read the document.
export function compareAcademicWork(previous, next) {
  const key = (course) => `${course.academicYear}|${course.periodCode}|${course.code}`
  const before = new Map((previous?.courses || []).map((course) => [key(course), course]))
  const changes = []
  for (const course of next?.courses || []) {
    const old = before.get(key(course))
    if (!old) { changes.push({ type: 'new', course }); continue }
    if (old.status !== course.status || old.grade !== course.grade || old.creditsEarned !== course.creditsEarned || old.creditsTotal !== course.creditsTotal) {
      changes.push({
        type: 'changed',
        course,
        from: { status: old.status, grade: old.grade, creditsEarned: old.creditsEarned, creditsTotal: old.creditsTotal }
      })
    }
  }
  const beforeSummary = previous?.summary || summariseAcademicWork(previous?.courses || [])
  const afterSummary = next?.summary || summariseAcademicWork(next?.courses || [])
  return {
    changes,
    newlyPassed: changes.filter((change) => change.course.status === 'passed' && change.from?.status !== 'passed').map((change) => change.course),
    ectsDelta: Number((afterSummary.earnedEcts - beforeSummary.earnedEcts).toFixed(1)),
    passedDelta: afterSummary.passedCourses - beforeSummary.passedCourses,
    before: beforeSummary,
    after: afterSummary
  }
}
