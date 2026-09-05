/**
 * The course ledger's reconciliation.
 *
 * A student's courses arrive from four places that disagree with one another:
 * the maintained editorial library (what has been written), their own academic
 * record (what they are enrolled in and have sat), their private Canvas corpus
 * (what their institution actually published), and the programme catalogue
 * (what the degree says they will take). Each knows a different part of the
 * same course, and only the course code joins them.
 *
 * These are the rules for merging those four into one row per course, deciding
 * what a row can offer, and ordering and filtering the result. They are pure
 * so the page can render them and node:test can check them, rather than the
 * merge living inside a `useMemo` where neither is possible.
 *
 * Pass/fail is not re-derived here. `courseStatus` in academics.mjs is the one
 * definition of whether an attempt passed, and this asks it.
 */

import { courseStatus } from './academics.mjs'
import { compareByNextExam, nextExam } from './courses.mjs'
import { curriculumCourseIdentity, reconcileAcademicCourseIdentities } from '../course-identities.mjs'

/* ── Names and periods ───────────────────────────────────────────────────── */

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Canvas names carry their enrolment section — "Algorithms
 * (2025-2026-200-BCS1540)" — which is a registry fact, not the course's name.
 */
export function cleanCanvasName(name, code) {
  const text = String(name ?? '').trim()
  if (!code) return text
  const section = new RegExp(`\\s*\\(20\\d{2}-20\\d{2}-(?:100|200|400|500)-${escapeRegExp(code)}\\)\\s*$`, 'i')
  return text.replace(section, '').trim()
}

export function normalizedPeriod(value) {
  return String(value || '').replace(/^Period\s*/i, '').trim()
}

export function periodLabel(value) {
  const period = normalizedPeriod(value)
  return period ? `Period ${period}` : null
}

/* ── The merge ───────────────────────────────────────────────────────────── */

const key = (value) => String(value ?? '').trim().toUpperCase()

function corpusEditions(course) {
  return Array.isArray(course?.editions) && course.editions.length ? course.editions : [course]
}

function mergeCorpusCourse(left, right) {
  if (!left) return right
  const editions = [...corpusEditions(left), ...corpusEditions(right)]
  const seen = new Set()
  const unique = editions.filter((edition) => {
    const id = String(edition?.editionId || edition?.id || `${edition?.academicYear || ''}:${edition?.period || ''}`)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  }).sort((a, b) => String(b?.academicYear || '').localeCompare(String(a?.academicYear || '')))
  const latest = unique[0] || right
  return {
    ...left,
    ...latest,
    canonicalCourseId: right.canonicalCourseId || left.canonicalCourseId,
    courseCode: right.courseCode || left.courseCode,
    courseName: latest.courseName || right.courseName || left.courseName,
    sources: (Number(left.sources) || 0) + (Number(right.sources) || 0),
    editionCount: unique.length,
    academicYears: [...new Set(unique.map((edition) => edition?.academicYear).filter(Boolean))],
    editions: unique,
    lastSyncedAt: [left.lastSyncedAt, right.lastSyncedAt].filter(Boolean).sort().at(-1) || null
  }
}

/**
 * One row per course code, richest source winning each field.
 *
 * Order of application matters and is deliberate: the editorial library names
 * a course as it is taught, the academic record may rename it to the student's
 * own registry wording, Canvas fills in a course the other two have never
 * heard of. The catalogue then fills degree placement without replacing any
 * student-owned attempt data, including on rows that already have material.
 */
export function reconcileCourses({ editorial, academic, corpus, catalogue, programmeTemplate, currentCourses } = {}) {
  const rows = new Map()

  const programme = catalogue?.programmes?.find((entry) => entry.id === programmeTemplate?.programmeId)
  const version = programme?.versions?.find((entry) => entry.id === programmeTemplate?.versionId) ?? programme?.versions?.[0]
  const identity = programme && version
    ? curriculumCourseIdentity({ selectedVersion: version, programmeVersions: programme.versions || [] })
    : null
  const reconciledAcademic = identity
    ? reconcileAcademicCourseIdentities(academic ?? [], identity)
    : academic ?? []

  for (const course of editorial ?? []) {
    const canonical = identity?.canonicalCourse(course)
    const id = key(canonical?.code || course.code)
    if (!id) continue
    rows.set(id, { key: id, code: canonical?.code || course.code, name: course.name || canonical?.name, editorial: course, archived: Boolean(course.archived) })
  }

  for (const course of reconciledAcademic) {
    const canonical = identity?.canonicalCourse(course)
    const id = key(canonical?.code || course.catalogueCode || course.code || course.id)
    if (!id) continue
    const held = rows.get(id)
    rows.set(id, {
      ...held,
      key: id,
      code: course.code || held?.code || id,
      name: course.name || held?.name || course.code,
      academic: course,
      archived: held?.archived ?? false
    })
  }

  for (const course of corpus ?? []) {
    const sourceCode = course.courseCode || course.id
    const canonical = identity?.canonicalCourse({ code: sourceCode, name: cleanCanvasName(course.courseName || sourceCode, sourceCode) })
    const id = key(canonical?.code || sourceCode)
    if (!id) continue
    const held = rows.get(id)
    const mergedCorpus = mergeCorpusCourse(held?.corpus, course)
    rows.set(id, {
      ...held,
      key: id,
      code: held?.code || canonical?.code || course.courseCode || id,
      name: held?.name || canonical?.name || cleanCanvasName(course.courseName || course.courseCode, course.courseCode || id),
      corpus: mergedCorpus,
      archived: held?.archived ?? false
    })
  }

  for (const course of version?.courses ?? []) {
    const id = key(course.code)
    if (!id) continue
    const held = rows.get(id)
    const cataloguePlacement = { id: course.id, code: course.code, name: course.name, ects: course.ects, yearLevel: course.yearLevel, period: course.period, attempts: [] }
    rows.set(id, {
      ...held,
      key: id,
      code: held?.code || course.code,
      name: held?.name || course.name,
      // Catalogue fields fill gaps; a real record and its attempts always win.
      academic: held?.academic ? { ...cataloguePlacement, ...held.academic, attempts: held.academic.attempts ?? [] } : cataloguePlacement,
      archived: held?.archived ?? false
    })
  }

  // A timetable is evidence that a course is current even when it has not yet
  // appeared in the programme, record, Canvas corpus or maintained library.
  // Keep that evidence as its own source so it cannot inflate record coverage.
  for (const course of currentCourses ?? []) {
    const calendar = typeof course === 'string' ? { code: course, name: course } : course
    const canonical = identity?.canonicalCourse(calendar)
    const id = key(canonical?.code || calendar?.code)
    if (!id) continue
    const held = rows.get(id)
    rows.set(id, {
      ...held,
      key: id,
      code: held?.code || canonical?.code || calendar.code || id,
      name: held?.name || canonical?.name || calendar.name || calendar.code || id,
      calendar,
      archived: held?.archived ?? false
    })
  }

  return [...rows.values()]
}

/* ── Order ───────────────────────────────────────────────────────────────── */

/** Study-ready courses first, then recorded ones, then the merely catalogued. */
const tier = (entry) => (entry.editorial ? 0 : entry.academic ? 1 : 2)

/**
 * A total order over ledger rows: soonest exam first inside the study-ready
 * tier, course code inside the others.
 */
export function compareLedger(academicCourses, today) {
  const byExam = compareByNextExam(academicCourses, today)
  return (left, right) => {
    const rank = tier(left) - tier(right)
    if (rank) return rank
    if (left.editorial && right.editorial) {
      const order = byExam(left.editorial, right.editorial)
      if (order) return order
    }
    return String(left.code ?? '').localeCompare(String(right.code ?? '')) || String(left.key).localeCompare(String(right.key))
  }
}

export function courseLedger({ editorial, academic, corpus, catalogue, programmeTemplate, currentCourses, today } = {}) {
  return reconcileCourses({ editorial, academic, corpus, catalogue, programmeTemplate, currentCourses })
    .sort(compareLedger(academic ?? [], today))
}

/* ── What a row is ───────────────────────────────────────────────────────── */

export const SCOPES = ['current', 'future', 'passed', 'failed', 'all', 'archived']

/**
 * Where a course stands, asked of the academic record rather than guessed from
 * the wording of an attempt's status.
 */
export function ledgerStatus(entry, currentCodes) {
  const status = entry.academic ? courseStatus(entry.academic) : 'not-recorded'
  const passed = status === 'passed'
  const failed = status === 'failed'
  const current = !passed && !entry.archived && (Boolean(entry.calendar) || (currentCodes?.has?.(key(entry.code)) ?? false))
  return { status, passed, failed, current, future: !passed && !failed && !current && !entry.archived }
}

/** The codes the calendar says are being taught to this student right now. */
export function currentCodeSet(currentCourses) {
  return new Set((currentCourses ?? []).map((entry) => key(entry?.code ?? entry)))
}

/**
 * Degree progress is credit progress, not a count of differently sized
 * courses. Required courses map automatically; choice/elective/pathway
 * options map only after the student selected them or the record/timetable
 * proves they took them. A passed course is joined by stable code to today's
 * curriculum placement, so a historical Period 4 sitting can fulfil a course
 * that has since moved to Period 1 without losing its attempt provenance.
 */
export function degreeRunwayYears({ programme = null, version = null, programmeTemplate = null, academic = [], currentCodes = new Set() } = {}) {
  if (!version) return []
  const duration = Math.max(1, Number(programme?.durationYears) || 0)
  const totalEcts = Math.max(0, Number(programme?.totalEcts) || 0)
  const selectedIds = new Set(Object.values(programmeTemplate?.selectedChoices || {}).flat().map(String))
  const identity = programme && version
    ? curriculumCourseIdentity({ selectedVersion: version, programmeVersions: programme.versions || [] })
    : null
  const reconciledAcademic = identity ? reconcileAcademicCourseIdentities(academic || [], identity) : academic || []
  const academicByCode = new Map(reconciledAcademic.map((course) => [
    key(identity?.canonicalCourse(course)?.code || course.catalogueCode || course.code),
    course
  ]))
  const canonicalCurrentCodes = new Set([...currentCodes].map((code) => identity?.canonicalCourse({ code })?.code || code).map(key))
  const labels = [...new Set([
    ...Array.from({ length: duration }, (_, index) => `Year ${index + 1}`),
    ...(version.courses || []).map((course) => course.yearLevel).filter(Boolean)
  ])].sort((left, right) => Number(String(left).match(/\d+/)?.[0] || 0) - Number(String(right).match(/\d+/)?.[0] || 0) || String(left).localeCompare(String(right)))
  const baseTarget = duration && totalEcts ? totalEcts / duration : 0

  return labels.map((label, index) => {
    const courses = (version.courses || []).filter((course) => course.yearLevel === label)
    const required = courses.filter((course) => course.requirement === 'required')
    const options = courses.filter((course) => course.requirement !== 'required')
    const selected = options.filter((course) => {
      const recorded = academicByCode.get(key(course.code))
      return selectedIds.has(String(course.id))
        || Boolean(recorded?.attempts?.length)
        || canonicalCurrentCodes.has(key(course.code))
    })
    const mapped = [...required, ...selected]
    const passed = courses.filter((course) => {
      const recorded = academicByCode.get(key(course.code))
      return recorded && courseStatus(recorded) === 'passed'
    })
    const targetEcts = baseTarget
      ? Number((index === labels.length - 1 ? totalEcts - baseTarget * (labels.length - 1) : baseTarget).toFixed(1))
      : mapped.reduce((sum, course) => sum + (Number(course.ects) || 0), 0)
    const mappedEcts = Number(mapped.reduce((sum, course) => sum + (Number(course.ects) || 0), 0).toFixed(1))
    const earnedEcts = Number(passed.reduce((sum, course) => sum + (Number(course.ects) || 0), 0).toFixed(1))
    const running = courses.filter((course) => canonicalCurrentCodes.has(key(course.code)) && !passed.some((entry) => key(entry.code) === key(course.code))).length
    return {
      label,
      targetEcts,
      mappedEcts,
      earnedEcts,
      openChoiceEcts: Number(Math.max(0, targetEcts - mappedEcts).toFixed(1)),
      overplannedEcts: Number(Math.max(0, mappedEcts - targetEcts).toFixed(1)),
      choiceOptions: options.length,
      selectedChoices: selected.length,
      running,
      current: label === programmeTemplate?.currentStudyYear
    }
  })
}

/**
 * What a row leads to, stated rather than implied.
 *
 * Three destinations wore the same clothes in the old ledger: a course with
 * material, a course that has to be requested, and a course whose only trace
 * is a Canvas import. A row now carries the name of its own action.
 */
export function rowDestination(entry) {
  const chapters = entry.editorial?.chapters?.length ?? 0
  if (entry.editorial) {
    return {
      kind: 'study',
      href: `/app/courses/${entry.editorial.id}`,
      action: chapters ? `${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}` : 'Open course',
      chapters
    }
  }
  if (entry.academic?.id) {
    return { kind: 'request', href: `/app/course-request/${entry.academic.id}`, action: 'Request this course', chapters: 0 }
  }
  if (entry.calendar && !entry.corpus) {
    return { kind: 'calendar', href: '/app/calendar', action: 'Open calendar', chapters: 0 }
  }
  return {
    kind: 'canvas',
    href: `/app/updates?tab=materials&courseCode=${encodeURIComponent(entry.code)}`,
    action: 'See Canvas material',
    chapters: 0
  }
}

/** One line about the material behind a row, for rows with no chapters. */
export function materialSummary(entry) {
  if (entry.editorial?.chapters?.length) return null
  if (entry.corpus?.sources) return `${entry.corpus.sources} sources indexed`
  if (entry.corpus) return 'Material import queued'
  if (entry.editorial) return 'No chapters published'
  if (entry.calendar && !entry.academic) return 'Timetable only'
  return 'Course record only'
}

/**
 * Material availability is intentionally narrower than academic coverage.
 * A study record can place a course, but only Canvas and the maintained
 * library contain retrievable learning material. Each real channel therefore
 * accounts for half of this small availability measure.
 */
export function courseMaterialCoverage(entry) {
  const library = Boolean(entry?.editorial?.chapters?.length)
  const canvas = Boolean(entry?.corpus?.sources)
  const available = Number(library) + Number(canvas)
  return {
    percent: available * 50,
    available,
    total: 2,
    detail: available ? `${available} of 2 material channels` : 'No material channel',
    library,
    canvas
  }
}

/** Source-family coverage over the courses the calendar calls current. */
export function currentSourceCoverage({ ledger = [], currentCourses = [], academic = [] } = {}) {
  const current = filterLedger(ledger, { scope: 'current', currentCourses })
  const total = current.length
  const row = (id, covered) => ({ id, covered, total, percent: total ? Math.round((covered / total) * 100) : null })
  return [
    row('record', current.filter((entry) => Boolean(entry.academic)).length),
    row('canvas', current.filter((entry) => Boolean(entry.corpus?.sources)).length),
    row('library', current.filter((entry) => Boolean(entry.editorial?.chapters?.length)).length)
  ]
}

/* ── Narrowing ───────────────────────────────────────────────────────────── */

export function filterLedger(ledger, { query = '', scope = 'current', currentCourses = [] } = {}) {
  const needle = String(query).trim().toLowerCase()
  const currentCodes = currentCodeSet(currentCourses)
  return (ledger ?? []).filter((entry) => {
    if (needle && !`${entry.code} ${entry.name}`.toLowerCase().includes(needle)) return false
    if (scope === 'all') return true
    if (scope === 'archived') return Boolean(entry.archived)
    const value = ledgerStatus(entry, currentCodes)
    return Boolean(value[scope])
  })
}

/**
 * Dated exams first in date order, then the rest by teaching period. Also a
 * comparator, and also memoised — the same reason as compareByNextExam.
 */
export function comparePeriod(academicCourses, today) {
  const seen = new Map()
  const exam = (entry) => {
    if (!seen.has(entry)) seen.set(entry, entry.editorial ? nextExam(entry.editorial, academicCourses, today) : null)
    return seen.get(entry)
  }
  return (left, right) => {
    const a = exam(left)
    const b = exam(right)
    if (a && b) return a.date.localeCompare(b.date) || left.code.localeCompare(right.code)
    if (a) return -1
    if (b) return 1
    return String(left.academic?.period || '99').localeCompare(String(right.academic?.period || '99'))
      || left.code.localeCompare(right.code)
  }
}

export function sortLedger(ledger, { sort = 'period', academic = [], today } = {}) {
  const rows = [...(ledger ?? [])]
  if (sort === 'code') return rows.sort((left, right) => left.code.localeCompare(right.code))
  if (sort === 'name') return rows.sort((left, right) => left.name.localeCompare(right.name) || left.code.localeCompare(right.code))
  if (sort === 'year') {
    return rows.sort((left, right) =>
      String(left.academic?.yearLevel || '').localeCompare(String(right.academic?.yearLevel || ''))
      || String(left.academic?.period || '').localeCompare(String(right.academic?.period || ''))
      || left.code.localeCompare(right.code))
  }
  return rows.sort(comparePeriod(academic, today))
}
