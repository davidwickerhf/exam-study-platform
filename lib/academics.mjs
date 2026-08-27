import { readDocument, writeDocument } from './user-store.mjs'
import { deleteDocument } from './user-store.mjs'
import { randomUUID } from 'node:crypto'

const NAMESPACE = 'academics'
const KEY = 'workspace'
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
    courses: [],
    events: [],
    gates: [],
    planning: { objectives: {} }
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

export function normalizeAcademicWorkspace(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an academic workspace object.')
  if (Array.isArray(value.courses) && value.courses.length > MAX_COURSES) throw new Error(`A workspace supports at most ${MAX_COURSES} courses.`)
  if (Array.isArray(value.events) && value.events.length > MAX_EVENTS) throw new Error(`A workspace supports at most ${MAX_EVENTS} events.`)
  const profile = value.profile && typeof value.profile === 'object' ? value.profile : {}
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
      objectives: value.planning.objectives && typeof value.planning.objectives === 'object' ? structuredClone(value.planning.objectives) : {}
    } : { objectives: {} }
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

export async function readAcademicWorkspace() {
  const value = await readDocument(NAMESPACE, KEY, emptyAcademicWorkspace())
  const workspace = normalizeAcademicWorkspace(value)
  return { workspace, summary: academicSummary(workspace) }
}

export async function saveAcademicWorkspace(value) {
  const workspace = normalizeAcademicWorkspace(value)
  await writeDocument(NAMESPACE, KEY, workspace)
  return { workspace, summary: academicSummary(workspace) }
}

const indexFallback = () => ({ schemaVersion: 1, activeProgrammeId: 'default', programmes: [{ id: 'default', programme: '', academicYear: '' }] })

function normalizeIndex(value) {
  const programmes = Array.isArray(value?.programmes) ? value.programmes.slice(0, 30).map((item) => ({
    id: text(item?.id, 100), programme: text(item?.programme, 200), academicYear: text(item?.academicYear, 30)
  })).filter((item) => item.id) : []
  const safe = programmes.length ? programmes : indexFallback().programmes
  const activeProgrammeId = safe.some((item) => item.id === value?.activeProgrammeId) ? value.activeProgrammeId : safe[0].id
  return { schemaVersion: 1, activeProgrammeId, programmes: safe }
}

export async function readAcademicState() {
  const index = normalizeIndex(await readDocument(NAMESPACE, 'index', indexFallback()))
  const raw = await readDocument(NAMESPACE, `programme:${index.activeProgrammeId}`, null)
  // Migrate the initial single-workspace increment without losing data.
  const legacy = raw || (index.activeProgrammeId === 'default' ? await readDocument(NAMESPACE, KEY, null) : null)
  const workspace = normalizeAcademicWorkspace(legacy || { ...emptyAcademicWorkspace(), id: index.activeProgrammeId })
  workspace.id = index.activeProgrammeId
  return { index, workspace, summary: academicSummary(workspace) }
}

export async function createAcademicProgramme(profile = {}) {
  const index = normalizeIndex(await readDocument(NAMESPACE, 'index', indexFallback()))
  const id = `programme-${randomUUID()}`
  const workspace = normalizeAcademicWorkspace({ ...emptyAcademicWorkspace(), id, profile })
  const meta = { id, programme: workspace.profile.programme, academicYear: workspace.profile.academicYear }
  const nextIndex = { ...index, activeProgrammeId: id, programmes: [...index.programmes, meta] }
  await writeDocument(NAMESPACE, `programme:${id}`, workspace)
  await writeDocument(NAMESPACE, 'index', nextIndex)
  return { index: nextIndex, workspace, summary: academicSummary(workspace) }
}

export async function selectAcademicProgramme(id) {
  const index = normalizeIndex(await readDocument(NAMESPACE, 'index', indexFallback()))
  if (!index.programmes.some((item) => item.id === id)) throw new Error('Programme not found.')
  await writeDocument(NAMESPACE, 'index', { ...index, activeProgrammeId: id })
  return readAcademicState()
}

export async function saveActiveAcademicWorkspace(value, expectedRevision) {
  const state = await readAcademicState()
  if (Number(expectedRevision) !== state.workspace.revision) throw new Error('This programme changed in another tab. Reload before saving again.')
  const workspace = normalizeAcademicWorkspace({ ...value, id: state.workspace.id, revision: state.workspace.revision + 1 })
  await writeDocument(NAMESPACE, `programme:${workspace.id}`, workspace)
  const index = { ...state.index, programmes: state.index.programmes.map((item) => item.id === workspace.id
    ? { ...item, programme: workspace.profile.programme, academicYear: workspace.profile.academicYear }
    : item) }
  await writeDocument(NAMESPACE, 'index', index)
  return { index, workspace, summary: academicSummary(workspace) }
}

export async function deleteAcademicProgramme(id) {
  const index = normalizeIndex(await readDocument(NAMESPACE, 'index', indexFallback()))
  if (!index.programmes.some((item) => item.id === id)) throw new Error('Programme not found.')
  if (index.programmes.length === 1) throw new Error('Create another programme before deleting this one.')
  const programmes = index.programmes.filter((item) => item.id !== id)
  const nextIndex = { ...index, programmes, activeProgrammeId: index.activeProgrammeId === id ? programmes[0].id : index.activeProgrammeId }
  await deleteDocument(NAMESPACE, `programme:${id}`)
  await writeDocument(NAMESPACE, 'index', nextIndex)
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
  const index = normalizeIndex(await readDocument(NAMESPACE, 'index', indexFallback()))
  const id = `programme-${randomUUID()}`
  const imported = { ...workspace, id, revision: 0 }
  const meta = { id, programme: imported.profile.programme || 'Imported programme', academicYear: imported.profile.academicYear }
  const nextIndex = { ...index, activeProgrammeId: id, programmes: [...index.programmes, meta] }
  await writeDocument(NAMESPACE, `programme:${id}`, imported)
  await writeDocument(NAMESPACE, 'index', nextIndex)
  return { index: nextIndex, workspace: imported, summary: academicSummary(imported), importReport: { matched, unmatched, rejected } }
}
