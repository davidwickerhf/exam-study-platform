import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cataloguePath = fileURLToPath(new URL('../data/editorial-programmes.json', import.meta.url))
const text = (value, max = 300) => String(value ?? '').trim().slice(0, max)
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

function unique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`)
    seen.add(value)
  }
}

// A curriculum read off the university's own repository lists its electives but
// says nothing about how a student picks between them: there is no "choose one
// of these six". Editors wrote those groups by hand for one programme and one
// year, which does not scale to four programmes and eighty-nine electives.
//
// The offering itself carries the grouping. An elective belongs to a year and a
// teaching period, and that is exactly the question worth asking — "which of
// this period's electives are you taking?" — so the groups are derived from it.
// A version that declares its own groups keeps them; nothing is inferred over
// an editor's judgement.
const PERIOD_ORDER = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Semester 1', 'Semester 2', 'Year']

export function electiveGroupId(yearLevel, period) {
  const slug = (value) => text(value, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `electives-${slug(yearLevel) || 'unplaced'}-${slug(period) || 'unplaced'}`
}

function deriveElectiveGroups(courses) {
  const buckets = new Map()
  for (const course of courses) {
    if (course.requirement !== 'elective') continue
    const key = `${course.yearLevel}\u0000${course.period}`
    if (!buckets.has(key)) buckets.set(key, { yearLevel: course.yearLevel, period: course.period, courseIds: [] })
    buckets.get(key).courseIds.push(course.id)
  }
  return [...buckets.values()]
    .sort((left, right) =>
      String(left.yearLevel).localeCompare(String(right.yearLevel))
      || PERIOD_ORDER.indexOf(left.period) - PERIOD_ORDER.indexOf(right.period))
    .map((bucket) => ({
      id: electiveGroupId(bucket.yearLevel, bucket.period),
      label: [bucket.yearLevel, bucket.period === 'Year' ? 'Full year' : bucket.period].filter(Boolean).join(' · ') || 'Electives',
      description: `Optional courses offered in ${bucket.period === 'Year' ? 'this year' : bucket.period || 'this programme'}. Choose the ones you are taking.`,
      // Nothing here is compulsory and nothing caps the count: the programme
      // requires a total of elective credit, not a number of these courses.
      minSelections: 0,
      maxSelections: bucket.courseIds.length,
      pathwayId: null,
      courseIds: bucket.courseIds,
      derived: true,
      yearLevel: bucket.yearLevel,
      period: bucket.period
    }))
}

function normalizeCourse(value, index) {
  const id = text(value?.id, 100)
  const code = text(value?.code, 40).toUpperCase()
  const name = text(value?.name, 200)
  if (!id || !code || !name) throw new Error(`Editorial course ${index + 1} needs an id, code, and name.`)
  const requirement = ['required', 'choice', 'elective', 'pathway'].includes(value.requirement) ? value.requirement : 'required'
  return {
    id,
    code,
    name,
    ects: Math.max(0, finite(value.ects)),
    yearLevel: text(value.yearLevel, 40),
    period: text(value.period, 40),
    requirement,
    choiceGroupId: text(value.choiceGroupId, 100) || null,
    pathwayId: text(value.pathwayId, 100) || null,
    // What the university publishes about the course itself. Optional: a
    // programme whose curriculum has been imported but not yet enriched simply
    // has none of it, and every consumer has to cope with that.
    description: text(value.description, 6000) || null,
    coordinator: text(value.coordinator, 200) || null,
    department: text(value.department, 200) || null,
    prerequisites: text(value.prerequisites, 2000) || null,
    reading: text(value.reading, 4000) || null,
    teachingMethods: text(value.teachingMethods, 300) || null,
    assessmentMethods: text(value.assessmentMethods, 300) || null,
    // The teaching window as the repository states it, which is more precise
    // than the period label alone.
    startsOn: text(value.startsOn, 40) || null,
    endsOn: text(value.endsOn, 40) || null
  }
}

function normalizeVersion(value, programmeId) {
  const id = text(value?.id, 50)
  if (!id) throw new Error(`Programme ${programmeId} has a version without an id.`)
  const courses = (Array.isArray(value.courses) ? value.courses : []).map(normalizeCourse)
  unique(courses.map((course) => course.id), `${programmeId}/${id} course id`)
  unique(courses.map((course) => course.code), `${programmeId}/${id} course code`)
  const courseIds = new Set(courses.map((course) => course.id))
  const choiceGroups = (Array.isArray(value.choiceGroups) ? value.choiceGroups : []).map((group, index) => {
    const groupId = text(group?.id, 100)
    if (!groupId) throw new Error(`Choice group ${index + 1} in ${programmeId}/${id} needs an id.`)
    const ids = Array.isArray(group.courseIds) ? group.courseIds.map((item) => text(item, 100)).filter(Boolean) : []
    if (ids.some((courseId) => !courseIds.has(courseId))) throw new Error(`Choice group ${groupId} references an unknown course.`)
    return {
      id: groupId,
      label: text(group.label, 200),
      description: text(group.description, 500),
      minSelections: Math.max(0, Math.trunc(finite(group.minSelections))),
      maxSelections: Math.max(0, Math.trunc(finite(group.maxSelections))),
      pathwayId: text(group.pathwayId, 100) || null,
      courseIds: ids
    }
  })
  unique(choiceGroups.map((group) => group.id), `${programmeId}/${id} choice group id`)
  const groups = choiceGroups.length ? choiceGroups : deriveElectiveGroups(courses)
  const choiceGroupIds = new Set(groups.map((group) => group.id))
  const pathways = (Array.isArray(value.pathways) ? value.pathways : []).map((pathway, index) => {
    const pathwayId = text(pathway?.id, 100)
    if (!pathwayId) throw new Error(`Pathway ${index + 1} in ${programmeId}/${id} needs an id.`)
    const includedCourseIds = Array.isArray(pathway.includedCourseIds) ? pathway.includedCourseIds.map((item) => text(item, 100)).filter(Boolean) : []
    const includedChoiceGroupIds = Array.isArray(pathway.choiceGroupIds) ? pathway.choiceGroupIds.map((item) => text(item, 100)).filter(Boolean) : []
    if (includedCourseIds.some((courseId) => !courseIds.has(courseId))) throw new Error(`Pathway ${pathwayId} references an unknown course.`)
    if (includedChoiceGroupIds.some((groupId) => !choiceGroupIds.has(groupId))) throw new Error(`Pathway ${pathwayId} references an unknown choice group.`)
    return {
      id: pathwayId,
      label: text(pathway.label, 200),
      description: text(pathway.description, 500),
      includedCourseIds,
      choiceGroupIds: includedChoiceGroupIds
    }
  })
  unique(pathways.map((pathway) => pathway.id), `${programmeId}/${id} pathway id`)
  return {
    id,
    label: text(value.label, 200),
    status: value.status === 'current' ? 'current' : 'reference',
    lastVerified: text(value.lastVerified, 10),
    grading: { passMark: Math.max(0, finite(value.grading?.passMark, 5.5)) },
    sources: (Array.isArray(value.sources) ? value.sources : []).slice(0, 10).map((source) => ({ label: text(source?.label, 200), url: text(source?.url, 1000) })).filter((source) => source.label && /^https:\/\//.test(source.url)),
    courses,
    choiceGroups: groups,
    pathways,
    requirements: (Array.isArray(value.requirements) ? value.requirements : []).slice(0, 30).map((requirement, index) => ({
      id: text(requirement?.id || `requirement-${index + 1}`, 100),
      label: text(requirement?.label, 200),
      description: text(requirement?.description, 500)
    })).filter((requirement) => requirement.label)
  }
}

export function normalizeEditorialProgrammeCatalogue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an editorial programme catalogue object.')
  const programmes = (Array.isArray(value.programmes) ? value.programmes : []).map((programme, index) => {
    const id = text(programme?.id, 100)
    if (!id) throw new Error(`Editorial programme ${index + 1} needs an id.`)
    const versions = (Array.isArray(programme.versions) ? programme.versions : []).map((version) => normalizeVersion(version, id))
    unique(versions.map((version) => version.id), `${id} version id`)
    if (!versions.length) throw new Error(`Editorial programme ${id} needs at least one version.`)
    return {
      id,
      institution: {
        name: text(programme.institution?.name, 200),
        city: text(programme.institution?.city, 100),
        country: text(programme.institution?.country, 100),
        // Email domains that identify this institution's members; subdomains
        // (student.…) match automatically. Drives organisation auto-scoping.
        domains: [...new Set((Array.isArray(programme.institution?.domains) ? programme.institution.domains : []).map((domain) => text(domain, 100).toLowerCase().replace(/^@/, '')).filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)))].slice(0, 20)
      },
      name: text(programme.name, 200),
      degree: text(programme.degree, 100),
      durationYears: Math.max(0, Math.trunc(finite(programme.durationYears))),
      totalEcts: Math.max(0, finite(programme.totalEcts)),
      language: text(programme.language, 100),
      versions,
      // Institution-wide academic calendar, maintained editorially.
      calendar: (Array.isArray(programme.calendar) ? programme.calendar : []).slice(0, 500).map((event, index) => ({
        id: text(event?.id || `cal-event-${index + 1}`, 120),
        title: text(event?.title, 200),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(event?.date || '')) ? String(event.date) : null,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(event?.endDate || '')) ? String(event.endDate) : null,
        type: ['registration', 'deadline', 'ceremony', 'other'].includes(event?.type) ? event.type : 'other',
        kind: ['period', 'exam-week', 'resit-week', 'study-week', 'project-week', 'holiday', 'intro', 'deadline', 'ceremony', 'other'].includes(event?.kind) ? event.kind : 'other',
        period: Number.isInteger(Number(event?.period)) && Number(event?.period) > 0 ? Number(event.period) : null,
        semester: Number.isInteger(Number(event?.semester)) && Number(event?.semester) > 0 ? Number(event.semester) : null,
        resit: event?.resit === true,
        cohorts: (Array.isArray(event?.cohorts) ? event.cohorts : []).slice(0, 10).map((item) => text(item, 20)).filter(Boolean),
        notes: text(event?.notes, 2000),
        academicYear: text(event?.academicYear, 30)
      })).filter((event) => event.title && event.date)
    }
  })
  unique(programmes.map((programme) => programme.id), 'programme id')
  return { schemaVersion: 1, programmes }
}

let cachedCatalogue = null

export function loadEditorialProgrammeCatalogue() {
  if (!cachedCatalogue) cachedCatalogue = normalizeEditorialProgrammeCatalogue(JSON.parse(readFileSync(cataloguePath, 'utf8')))
  return structuredClone(cachedCatalogue)
}

// The repository file seeds the catalogue; once administrators manage it in
// the database the in-memory copy is replaced from there.
export function setEditorialProgrammeCatalogue(programmes) {
  cachedCatalogue = normalizeEditorialProgrammeCatalogue({ schemaVersion: 1, programmes })
  return structuredClone(cachedCatalogue)
}

export function loadEditorialProgrammeFile() {
  return normalizeEditorialProgrammeCatalogue(JSON.parse(readFileSync(cataloguePath, 'utf8'))).programmes
}

export function normalizeEditorialProgramme(programme) {
  return normalizeEditorialProgrammeCatalogue({ schemaVersion: 1, programmes: [programme] }).programmes[0]
}

export function findEditorialProgramme(programmeId, versionId) {
  const programme = loadEditorialProgrammeCatalogue().programmes.find((item) => item.id === programmeId)
  if (!programme) return null
  const version = programme.versions.find((item) => item.id === versionId) || programme.versions[0]
  return version ? { programme, version } : null
}
