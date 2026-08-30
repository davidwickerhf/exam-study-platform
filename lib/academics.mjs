import { randomUUID } from 'node:crypto'
import { sql, userId, localRows, saveLocalRows, iso } from './db.mjs'

const MAX_COURSES = 500
const MAX_ATTEMPTS = 50
const MAX_EVENTS = 500

const text = (value, max = 200) => String(value ?? '').trim().slice(0, max)
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const isoDate = (value) => {
  if (value === null || value === undefined || value === '') return null
  const date = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}

export function emptyAcademicWorkspace() {
  return {
    schemaVersion: 1,
    id: 'default',
    revision: 0,
    profile: { university: '', programme: '', academicYear: '', currentYearKey: '', gpaIncludesFailedCourses: false },
    programmeTemplate: null,
    courses: [],
    events: [],
    gates: [],
    planning: { objectives: {}, periodAssignments: [], academicPeriods: [] },
    calendars: []
  }
}

function normalizeAttempt(value, index) {
  const status = ['upcoming', 'passed', 'failed', 'no-show'].includes(value?.status) ? value.status : 'upcoming'
  const type = ['first', 'resit', 'carry-over', 'other'].includes(value?.type) ? value.type : 'first'
  const rawGrade = value?.grade === null || value?.grade === '' || value?.grade === undefined ? null : finite(value.grade, null)
  const grade = rawGrade === null ? null : Math.min(100, Math.max(0, rawGrade))
  return {
    id: text(value?.id || `attempt-${index + 1}`, 100),
    academicYear: text(value?.academicYear, 30),
    type,
    examDate: isoDate(value?.examDate),
    grade,
    status
  }
}

function normalizeCourse(value, index) {
  if (!value || typeof value !== 'object') throw new Error(`Course ${index + 1} must be an object.`)
  const code = text(value.code, 40).toUpperCase()
  const name = text(value.name, 200)
  if (!name) throw new Error(`Course ${index + 1} needs a name.`)
  const attempts = Array.isArray(value.attempts) ? value.attempts.slice(0, MAX_ATTEMPTS).map(normalizeAttempt) : []
  return {
    id: text(value.id || `course-${index + 1}`, 100),
    code,
    editorialCourseId: text(value.editorialCourseId, 100) || null,
    templateCourseId: text(value.templateCourseId, 100) || null,
    programmeRequirement: ['required', 'choice', 'elective', 'pathway', 'historical'].includes(value.programmeRequirement) ? value.programmeRequirement : null,
    choiceGroupId: text(value.choiceGroupId, 100) || null,
    pathwayId: text(value.pathwayId, 100) || null,
    name,
    ects: Math.max(0, finite(value.ects)),
    yearLevel: text(value.yearLevel, 40),
    period: text(value.period, 40),
    passMark: Math.min(100, Math.max(0, finite(value.passMark, 5.5))),
    notes: text(value.notes, 2000),
    hiddenFromStats: value.hiddenFromStats === true,
    attempts
  }
}

function normalizeEvent(value, index) {
  if (!value || typeof value !== 'object') throw new Error(`Event ${index + 1} must be an object.`)
  const title = text(value.title, 200)
  if (!title) throw new Error(`Event ${index + 1} needs a title.`)
  return {
    id: text(value.id || `event-${index + 1}`, 100),
    title,
    date: isoDate(value.date),
    endDate: isoDate(value.endDate),
    type: ['registration', 'deadline', 'ceremony', 'other'].includes(value.type) ? value.type : 'other',
    notes: text(value.notes, 2000)
  }
}

const ACADEMIC_PERIOD_KINDS = new Set(['period', 'exam-week', 'resit-week', 'study-week', 'project-week', 'holiday', 'intro', 'deadline', 'ceremony', 'other'])

function normalizeAcademicPeriod(value, index) {
  if (!value || typeof value !== 'object') return null
  const title = text(value.title, 200)
  const date = isoDate(value.date)
  if (!title || !date) return null
  return {
    id: text(value.id || `academic-period-${index + 1}`, 100),
    title,
    date,
    endDate: isoDate(value.endDate),
    type: ['registration', 'deadline', 'ceremony', 'other'].includes(value.type) ? value.type : 'other',
    kind: ACADEMIC_PERIOD_KINDS.has(value.kind) ? value.kind : 'other',
    period: value.period == null || value.period === '' ? null : Math.max(1, Math.min(12, Math.trunc(finite(value.period)))),
    semester: value.semester == null || value.semester === '' ? null : Math.max(1, Math.min(4, Math.trunc(finite(value.semester)))),
    resit: value.resit === true,
    cohorts: (Array.isArray(value.cohorts) ? value.cohorts : []).slice(0, 20).map((item) => text(item, 40)).filter(Boolean),
    academicYear: text(value.academicYear, 30),
    notes: text(value.notes, 2000),
    sourceLabel: text(value.sourceLabel, 160)
  }
}

function normalizePeriodAssignment(value, index) {
  if (!value || typeof value !== 'object') return null
  const academicYear = text(value.academicYear, 30)
  const period = text(value.period, 40)
  if (!academicYear || !period) return null
  return {
    id: text(value.id || `period-assignment-${index + 1}`, 100),
    academicYear,
    period,
    courseIds: [...new Set((Array.isArray(value.courseIds) ? value.courseIds : []).slice(0, MAX_COURSES).map((item) => text(item, 100)).filter(Boolean))],
    source: value.source === 'calendar' ? 'calendar' : 'manual',
    updatedAt: value.updatedAt ? String(value.updatedAt).slice(0, 40) : null
  }
}

function planningFromStored(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { objectives: {}, periodAssignments: [], academicPeriods: [] }
  if ('objectives' in value || 'periodAssignments' in value || 'academicPeriods' in value) return value
  // Rows written before period-aware planning stored the objectives object
  // directly in the JSONB column.
  return { objectives: value, periodAssignments: [], academicPeriods: [] }
}

export function normalizeAcademicWorkspace(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an academic workspace object.')
  if (Array.isArray(value.courses) && value.courses.length > MAX_COURSES) throw new Error(`A workspace supports at most ${MAX_COURSES} courses.`)
  if (Array.isArray(value.events) && value.events.length > MAX_EVENTS) throw new Error(`A workspace supports at most ${MAX_EVENTS} events.`)
  const profile = value.profile && typeof value.profile === 'object' ? value.profile : {}
  const rawTemplate = value.programmeTemplate && typeof value.programmeTemplate === 'object' && !Array.isArray(value.programmeTemplate) ? value.programmeTemplate : null
  const selectedChoices = rawTemplate?.selectedChoices && typeof rawTemplate.selectedChoices === 'object' && !Array.isArray(rawTemplate.selectedChoices)
    ? Object.fromEntries(Object.entries(rawTemplate.selectedChoices).slice(0, 50).map(([groupId, courseIds]) => [
      text(groupId, 100),
      (Array.isArray(courseIds) ? courseIds : [courseIds]).slice(0, 30).map((courseId) => text(courseId, 100)).filter(Boolean)
    ]).filter(([groupId]) => groupId))
    : {}
  return {
    schemaVersion: 1,
    id: text(value.id || 'default', 100),
    revision: Math.max(0, Math.trunc(finite(value.revision))),
    profile: {
      university: text(profile.university, 200),
      programme: text(profile.programme, 200),
      academicYear: text(profile.academicYear, 30),
      currentYearKey: text(profile.currentYearKey, 30),
      gpaIncludesFailedCourses: profile.gpaIncludesFailedCourses === true
    },
    programmeTemplate: rawTemplate && text(rawTemplate.programmeId, 100) && text(rawTemplate.versionId, 50) ? {
      programmeId: text(rawTemplate.programmeId, 100),
      versionId: text(rawTemplate.versionId, 50),
      currentStudyYear: text(rawTemplate.currentStudyYear, 40),
      pathwayId: text(rawTemplate.pathwayId, 100) || null,
      selectedChoices
    } : null,
    courses: (Array.isArray(value.courses) ? value.courses : []).map(normalizeCourse),
    events: (Array.isArray(value.events) ? value.events : []).map(normalizeEvent),
    gates: Array.isArray(value.gates) ? value.gates.slice(0, 100).map((gate, index) => ({
      id: text(gate?.id || `gate-${index + 1}`, 100),
      label: text(gate?.label, 200),
      section: ['progression', 'completion', 'thesis', 'other'].includes(gate?.section) ? gate.section : 'progression',
      type: ['course', 'credit-level', 'all-level', 'total-credits'].includes(gate?.type) ? gate.type : 'course',
      courseId: text(gate?.courseId, 100) || null,
      level: text(gate?.level, 40) || null,
      target: Math.max(0, finite(gate?.target))
    })).filter((gate) => gate.label) : [],
    planning: value.planning && typeof value.planning === 'object' ? {
      objectives: value.planning.objectives && typeof value.planning.objectives === 'object' ? structuredClone(value.planning.objectives) : {},
      periodAssignments: (Array.isArray(value.planning.periodAssignments) ? value.planning.periodAssignments : []).slice(0, 50).map(normalizePeriodAssignment).filter(Boolean),
      academicPeriods: (Array.isArray(value.planning.academicPeriods) ? value.planning.academicPeriods : []).slice(0, 300).map(normalizeAcademicPeriod).filter(Boolean)
    } : { objectives: {}, periodAssignments: [], academicPeriods: [] },
    calendars: (Array.isArray(value.calendars) ? value.calendars : []).slice(0, 20).map((link, index) => ({
      id: text(link?.id || `cal-${index + 1}`, 100),
      label: text(link?.label, 120) || 'Calendar',
      url: text(link?.url, 1000),
      lastSyncedAt: link?.lastSyncedAt ? String(link.lastSyncedAt).slice(0, 40) : null,
      eventCount: Math.max(0, Math.trunc(finite(link?.eventCount))),
      rangeStart: isoDate(link?.rangeStart),
      rangeEnd: isoDate(link?.rangeEnd),
      matchedCourseCount: Math.max(0, Math.trunc(finite(link?.matchedCourseCount))),
      unselectedCourseCount: Math.max(0, Math.trunc(finite(link?.unselectedCourseCount)))
    })).filter((link) => /^https?:\/\//.test(link.url))
  }
}

export function academicSummary(workspace) {
  const courses = workspace.courses.filter((course) => !course.hiddenFromStats)
  const passed = courses.filter((course) => course.attempts.some((attempt) => attempt.status === 'passed'))
  const earnedEcts = passed.reduce((sum, course) => sum + course.ects, 0)
  const graded = courses.flatMap((course) => {
    const completed = course.attempts.filter((attempt) => attempt.grade !== null && (attempt.status === 'passed' || (workspace.profile.gpaIncludesFailedCourses && attempt.status === 'failed')))
    const latest = completed.at(-1)
    return latest ? [{ grade: latest.grade, ects: course.ects }] : []
  })
  const weight = graded.reduce((sum, item) => sum + item.ects, 0)
  const gpa = weight ? Math.round((graded.reduce((sum, item) => sum + item.grade * item.ects, 0) / weight) * 100) / 100 : null
  const upcoming = courses.flatMap((course) => course.attempts
    .filter((attempt) => attempt.status === 'upcoming' && attempt.examDate)
    .map((attempt) => ({ courseId: course.id, code: course.code, name: course.name, ects: course.ects, ...attempt })))
    .sort((a, b) => a.examDate.localeCompare(b.examDate))
  return { earnedEcts, gpa, passedCourses: passed.length, totalCourses: courses.length, upcoming }
}

// ── Persistence: one row per programme, child tables for courses, attempts,
// events, and gates. Saving a workspace replaces its children in full.

function dateOnly(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function programmeFromRows(row, courses, attempts, events, gates) {
  const attemptsByCourse = new Map()
  for (const attempt of attempts) {
    if (!attemptsByCourse.has(attempt.course_id)) attemptsByCourse.set(attempt.course_id, [])
    attemptsByCourse.get(attempt.course_id).push({ id: attempt.id, academicYear: attempt.academic_year, type: attempt.type, examDate: dateOnly(attempt.exam_date), grade: attempt.grade == null ? null : Number(attempt.grade), status: attempt.status })
  }
  return {
    schemaVersion: 1,
    id: row.id,
    revision: Number(row.revision || 0),
    profile: { university: row.university, programme: row.programme, academicYear: row.academic_year, currentYearKey: row.current_year_key, gpaIncludesFailedCourses: Boolean(row.gpa_includes_failed) },
    programmeTemplate: row.template_programme_id ? { programmeId: row.template_programme_id, versionId: row.template_version_id, currentStudyYear: row.template_current_study_year || '', pathwayId: row.template_pathway_id || null, selectedChoices: row.template_selected_choices || {} } : null,
    courses: courses.map((course) => ({
      id: course.id, code: course.code, editorialCourseId: course.editorial_course_id, templateCourseId: course.template_course_id, programmeRequirement: course.programme_requirement,
      choiceGroupId: course.choice_group_id, pathwayId: course.pathway_id, name: course.name, ects: Number(course.ects), yearLevel: course.year_level, period: course.period,
      passMark: Number(course.pass_mark), notes: course.notes, hiddenFromStats: Boolean(course.hidden_from_stats), attempts: attemptsByCourse.get(course.id) || []
    })),
    events: events.map((event) => ({ id: event.id, title: event.title, date: dateOnly(event.date), endDate: dateOnly(event.end_date), type: event.type, notes: event.notes })),
    gates: gates.map((gate) => ({ id: gate.id, label: gate.label, section: gate.section, type: gate.type, courseId: gate.course_id, level: gate.level, target: Number(gate.target) })),
    planning: planningFromStored(row.planning_objectives),
    calendars: Array.isArray(row.calendars) ? row.calendars : []
  }
}

async function listProgrammeRows() {
  if (sql) {
    const rows = await sql`SELECT id, programme, academic_year, is_active, created_at FROM academic_programmes WHERE user_id = ${userId()} ORDER BY created_at, id`
    return rows.map((row) => ({ id: row.id, programme: row.programme, academicYear: row.academic_year, isActive: Boolean(row.is_active), createdAt: iso(row.created_at) }))
  }
  return (await localRows('academic_programmes')).map((row) => ({ id: row.workspace.id, programme: row.workspace.profile.programme, academicYear: row.workspace.profile.academicYear, isActive: Boolean(row.isActive), createdAt: row.createdAt }))
}

async function loadProgramme(id) {
  if (sql) {
    const [row] = await sql`SELECT * FROM academic_programmes WHERE user_id = ${userId()} AND id = ${id}`
    if (!row) return null
    const [courses, attempts, events, gates] = await Promise.all([
      sql`SELECT * FROM academic_courses WHERE user_id = ${userId()} AND programme_id = ${id} ORDER BY position`,
      sql`SELECT * FROM academic_attempts WHERE user_id = ${userId()} AND programme_id = ${id} ORDER BY position`,
      sql`SELECT * FROM academic_events WHERE user_id = ${userId()} AND programme_id = ${id} ORDER BY position`,
      sql`SELECT * FROM academic_gates WHERE user_id = ${userId()} AND programme_id = ${id} ORDER BY position`
    ])
    return programmeFromRows(row, courses, attempts, events, gates)
  }
  const found = (await localRows('academic_programmes')).find((row) => row.workspace.id === id)
  return found ? structuredClone(found.workspace) : null
}

async function storeProgramme(workspace, { active } = {}) {
  if (sql) {
    const uid = userId()
    const template = workspace.programmeTemplate
    await sql`INSERT INTO academic_programmes (user_id, id, revision, is_active, university, programme, academic_year, current_year_key, gpa_includes_failed,
        template_programme_id, template_version_id, template_current_study_year, template_pathway_id, template_selected_choices, planning_objectives, calendars, updated_at)
      VALUES (${uid}, ${workspace.id}, ${workspace.revision}, ${active === true}, ${workspace.profile.university}, ${workspace.profile.programme}, ${workspace.profile.academicYear},
        ${workspace.profile.currentYearKey}, ${workspace.profile.gpaIncludesFailedCourses}, ${template?.programmeId ?? null}, ${template?.versionId ?? null}, ${template?.currentStudyYear ?? null},
        ${template?.pathwayId ?? null}, ${JSON.stringify(template?.selectedChoices || {})}::jsonb, ${JSON.stringify(workspace.planning || { objectives: {}, periodAssignments: [], academicPeriods: [] })}::jsonb, ${JSON.stringify(workspace.calendars || [])}::jsonb, now())
      ON CONFLICT (user_id, id) DO UPDATE SET revision = excluded.revision, is_active = CASE WHEN ${active === undefined} THEN academic_programmes.is_active ELSE excluded.is_active END,
        university = excluded.university, programme = excluded.programme, academic_year = excluded.academic_year, current_year_key = excluded.current_year_key,
        gpa_includes_failed = excluded.gpa_includes_failed, template_programme_id = excluded.template_programme_id, template_version_id = excluded.template_version_id,
        template_current_study_year = excluded.template_current_study_year, template_pathway_id = excluded.template_pathway_id, template_selected_choices = excluded.template_selected_choices,
        planning_objectives = excluded.planning_objectives, calendars = excluded.calendars, updated_at = now()`
    await sql`DELETE FROM academic_courses WHERE user_id = ${uid} AND programme_id = ${workspace.id}`
    await sql`DELETE FROM academic_events WHERE user_id = ${uid} AND programme_id = ${workspace.id}`
    await sql`DELETE FROM academic_gates WHERE user_id = ${uid} AND programme_id = ${workspace.id}`
    for (const [position, course] of workspace.courses.entries()) {
      await sql`INSERT INTO academic_courses (user_id, programme_id, id, position, code, name, editorial_course_id, template_course_id, programme_requirement, choice_group_id, pathway_id, ects, year_level, period, pass_mark, notes, hidden_from_stats)
        VALUES (${uid}, ${workspace.id}, ${course.id}, ${position}, ${course.code}, ${course.name}, ${course.editorialCourseId}, ${course.templateCourseId}, ${course.programmeRequirement}, ${course.choiceGroupId}, ${course.pathwayId},
          ${course.ects}, ${course.yearLevel}, ${course.period}, ${course.passMark}, ${course.notes}, ${course.hiddenFromStats})`
      for (const [index, attempt] of course.attempts.entries()) {
        await sql`INSERT INTO academic_attempts (user_id, programme_id, course_id, id, position, academic_year, type, exam_date, grade, status)
          VALUES (${uid}, ${workspace.id}, ${course.id}, ${attempt.id}, ${index}, ${attempt.academicYear}, ${attempt.type}, ${attempt.examDate}, ${attempt.grade}, ${attempt.status})
          ON CONFLICT DO NOTHING`
      }
    }
    for (const [position, event] of workspace.events.entries()) {
      await sql`INSERT INTO academic_events (user_id, programme_id, id, position, title, date, end_date, type, notes)
        VALUES (${uid}, ${workspace.id}, ${event.id}, ${position}, ${event.title}, ${event.date}, ${event.endDate}, ${event.type}, ${event.notes}) ON CONFLICT DO NOTHING`
    }
    for (const [position, gate] of workspace.gates.entries()) {
      await sql`INSERT INTO academic_gates (user_id, programme_id, id, position, label, section, type, course_id, level, target)
        VALUES (${uid}, ${workspace.id}, ${gate.id}, ${position}, ${gate.label}, ${gate.section}, ${gate.type}, ${gate.courseId}, ${gate.level}, ${gate.target}) ON CONFLICT DO NOTHING`
    }
    return
  }
  const rows = await localRows('academic_programmes')
  const existing = rows.find((row) => row.workspace.id === workspace.id)
  if (existing) {
    existing.workspace = structuredClone(workspace)
    if (active !== undefined) existing.isActive = active
  } else {
    rows.push({ workspace: structuredClone(workspace), isActive: active === true, createdAt: new Date().toISOString() })
  }
  await saveLocalRows('academic_programmes', rows)
}

async function setActiveProgramme(id) {
  if (sql) {
    await sql`UPDATE academic_programmes SET is_active = (id = ${id}) WHERE user_id = ${userId()}`
    return
  }
  const rows = await localRows('academic_programmes')
  for (const row of rows) row.isActive = row.workspace.id === id
  await saveLocalRows('academic_programmes', rows)
}

async function removeProgramme(id) {
  if (sql) {
    await sql`DELETE FROM academic_programmes WHERE user_id = ${userId()} AND id = ${id}`
    return
  }
  await saveLocalRows('academic_programmes', (await localRows('academic_programmes')).filter((row) => row.workspace.id !== id))
}

// A student always has a programme. The first one is materialised lazily so
// creating or importing a second programme never discards it.
async function ensureDefaultProgramme() {
  if ((await listProgrammeRows()).length) return
  await storeProgramme(normalizeAcademicWorkspace(emptyAcademicWorkspace()), { active: true })
}

async function readIndex() {
  const rows = await listProgrammeRows()
  if (!rows.length) return { schemaVersion: 1, activeProgrammeId: 'default', programmes: [{ id: 'default', programme: '', academicYear: '' }], empty: true }
  const active = rows.find((row) => row.isActive) || rows[0]
  return { schemaVersion: 1, activeProgrammeId: active.id, programmes: rows.map(({ id, programme, academicYear }) => ({ id, programme, academicYear })) }
}

export async function readAcademicWorkspace() {
  const { workspace, summary } = await readAcademicState()
  return { workspace, summary }
}

export async function saveAcademicWorkspace(value) {
  const state = await readAcademicState()
  const workspace = normalizeAcademicWorkspace({ ...value, id: state.workspace.id })
  await storeProgramme(workspace, { active: true })
  return { workspace, summary: academicSummary(workspace) }
}

export async function readAcademicState() {
  const index = await readIndex()
  const stored = index.empty ? null : await loadProgramme(index.activeProgrammeId)
  const workspace = normalizeAcademicWorkspace(stored || { ...emptyAcademicWorkspace(), id: index.activeProgrammeId })
  workspace.id = index.activeProgrammeId
  delete index.empty
  return { index, workspace, summary: academicSummary(workspace) }
}

export async function createAcademicProgramme(profile = {}) {
  await ensureDefaultProgramme()
  const id = `programme-${randomUUID()}`
  const workspace = normalizeAcademicWorkspace({ ...emptyAcademicWorkspace(), id, profile })
  await storeProgramme(workspace, { active: false })
  await setActiveProgramme(id)
  const index = await readIndex()
  delete index.empty
  return { index, workspace, summary: academicSummary(workspace) }
}

export async function selectAcademicProgramme(id) {
  const index = await readIndex()
  if (!index.programmes.some((item) => item.id === id)) throw new Error('Programme not found.')
  await setActiveProgramme(id)
  return readAcademicState()
}

export async function saveActiveAcademicWorkspace(value, expectedRevision) {
  const state = await readAcademicState()
  if (Number(expectedRevision) !== state.workspace.revision) throw new Error('This programme changed in another tab. Reload before saving again.')
  const workspace = normalizeAcademicWorkspace({ ...value, id: state.workspace.id, revision: state.workspace.revision + 1 })
  await storeProgramme(workspace, { active: true })
  const index = await readIndex()
  delete index.empty
  return { index, workspace, summary: academicSummary(workspace) }
}

export async function deleteAcademicProgramme(id) {
  const index = await readIndex()
  if (index.empty || !index.programmes.some((item) => item.id === id)) throw new Error('Programme not found.')
  if (index.programmes.length === 1) throw new Error('Create another programme before deleting this one.')
  const wasActive = index.activeProgrammeId === id
  await removeProgramme(id)
  if (wasActive) await setActiveProgramme(index.programmes.find((item) => item.id !== id).id)
  return readAcademicState()
}

export async function importAcademicProgramme(value, editorialCourses = []) {
  const candidate = value?.data && typeof value.data === 'object' ? value.data : value
  if (!candidate || typeof candidate !== 'object' || !candidate.profile || !Array.isArray(candidate.courses)) throw new Error('Expected an academics AppStore or export bundle.')
  const rejected = []
  const workspace = normalizeAcademicWorkspace({ ...candidate, courses: [], events: [] })
  workspace.courses = candidate.courses.flatMap((course, index) => {
    try { return normalizeAcademicWorkspace({ profile: {}, courses: [course] }).courses }
    catch (error) { rejected.push({ type: 'course', index, label: text(course?.code || course?.name || `Course ${index + 1}`), reason: error.message }); return [] }
  })
  workspace.events = (Array.isArray(candidate.events) ? candidate.events : []).flatMap((event, index) => {
    try { return normalizeAcademicWorkspace({ profile: {}, events: [event] }).events }
    catch (error) { rejected.push({ type: 'event', index, label: text(event?.title || `Event ${index + 1}`), reason: error.message }); return [] }
  })
  const editorialByCode = new Map(editorialCourses.map((course) => [text(course.code, 40).toUpperCase(), course.id]))
  const matched = []
  const unmatched = []
  workspace.courses = workspace.courses.map((course) => {
    const editorialCourseId = editorialByCode.get(course.code) || null
    ;(editorialCourseId ? matched : unmatched).push(course.code || course.name)
    return { ...course, editorialCourseId }
  })
  await ensureDefaultProgramme()
  const id = `programme-${randomUUID()}`
  const imported = { ...workspace, id, revision: 0 }
  if (!imported.profile.programme) imported.profile.programme = 'Imported programme'
  await storeProgramme(imported, { active: false })
  await setActiveProgramme(id)
  const index = await readIndex()
  delete index.empty
  return { index, workspace: imported, summary: academicSummary(imported), importReport: { matched, unmatched, rejected } }
}

export async function storeImportedProgramme(value, active = false) {
  const workspace = normalizeAcademicWorkspace(value)
  await storeProgramme(workspace, { active })
  return workspace
}

export async function summariseAcademicTables() {
  if (sql) {
    const [row] = await sql`SELECT (SELECT count(*) FROM academic_programmes WHERE user_id = ${userId()})::int AS programmes,
      (SELECT count(*) FROM academic_courses WHERE user_id = ${userId()})::int AS courses,
      (SELECT count(*) FROM academic_attempts WHERE user_id = ${userId()})::int AS attempts,
      (SELECT count(*) FROM academic_events WHERE user_id = ${userId()})::int AS events,
      (SELECT max(updated_at) FROM academic_programmes WHERE user_id = ${userId()}) AS updated_at`
    return { programmes: Number(row.programmes), courses: Number(row.courses), attempts: Number(row.attempts), events: Number(row.events), updatedAt: iso(row.updated_at) }
  }
  const rows = await localRows('academic_programmes')
  const courses = rows.flatMap((row) => row.workspace.courses)
  return { programmes: rows.length, courses: courses.length, attempts: courses.reduce((sum, course) => sum + course.attempts.length, 0), events: rows.reduce((sum, row) => sum + row.workspace.events.length, 0), updatedAt: rows.length ? new Date().toISOString() : null }
}

export async function exportAcademicProgrammes() {
  const out = []
  for (const row of await listProgrammeRows()) out.push({ ...(await loadProgramme(row.id)), active: row.isActive })
  return out
}

export async function deleteAcademicData() {
  if (sql) {
    const rows = await sql`DELETE FROM academic_programmes WHERE user_id = ${userId()} RETURNING id`
    return rows.length
  }
  const count = (await localRows('academic_programmes')).length
  await saveLocalRows('academic_programmes', [])
  return count
}
