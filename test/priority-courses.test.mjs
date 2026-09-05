import test from 'node:test'
import assert from 'node:assert/strict'
import { programmePriorityCourses } from '../lib/priority-courses.mjs'
import { supportedCourseAssessment } from '../lib/course-rule-evidence.mjs'
import { normalizeScan, priorityEvidenceCandidates } from '../lib/priority-evidence.mjs'
import { homePriorities } from '../lib/workspace/home.mjs'
const claim = (id, name) => ({ name, type: 'project', deadline: '2026-09-10', evidence: [{ chunkId: id }] })
test('current course rules include courses without editorial content and exclude older sittings', () => {
  const workspace = { profile: { academicYear: '2026–2027' }, courses: [{ id: 'record', code: 'BCS3300', name: 'Project 3-1' }] }
  const profile = { assessment: { status: 'confirmed', components: [claim(1, 'Project pitch')] } }
  const courses = programmePriorityCourses(workspace, [], [
    { courseCode: 'BCS3300', academicYear: '2025-2026', scannedAt: '2026-09-06', courseProfile: { assessment: { status: 'not-found' } } },
    { courseCode: 'BCS3300', academicYear: '2026-2027', scannedAt: '2026-09-05', courseProfile: profile }
  ])
  assert.equal(courses[0].courseProfile, profile)
  assert.equal(courses[0].id, 'BCS3300')
  assert.equal(homePriorities({ courses, now: Date.parse('2026-09-05') })[0].title, 'Project pitch')
  assert.equal(programmePriorityCourses(workspace, [], [{ courseCode: 'BCS3300', academicYear: '2025-2026', courseProfile: profile }])[0].courseProfile, null)
})
test('a disputed deadline does not discard independently supported attendance or components', () => {
  const course = { courseProfile: { assessment: { status: 'needs-review', components: [claim(1, 'Disputed'), claim(2, 'Supported')],
    attendanceEvidence: [{ text: 'Tutorial attendance is mandatory', activity: 'tutorial', evidence: [{ chunkId: 3 }] }], conflicts: [{ chunkIds: [1] }] } } }
  const supported = supportedCourseAssessment(course)
  assert.deepEqual(supported.components.map(c => c.name), ['Supported'])
  assert.equal(supported.attendanceRules.length, 1)
  assert.equal(course.courseProfile.assessment.status, 'needs-review')
})
test('null attendance and weight values remain unknown rather than zero', () => {
  const scan = normalizeScan({ status: 'confirmed', attendanceRules: [{ text: 'Tutorials required', activity: 'tutorial', allowedMisses: null, minimumAttendancePercent: null, evidence: [{ chunkId: 1 }] }], components: [{ name: 'Project', weightPercent: null, minimumPercent: null, evidence: [{ chunkId: 1 }] }] }, [{ chunkId: 1 }])
  assert.equal(scan.courseProfile.assessment.attendanceEvidence[0].allowedMisses, null)
  assert.equal(scan.courseProfile.assessment.components[0].weightPercent, null)
})
test('syllabus structure and introductory slides are read even without obligation keywords', () => {
  const candidates = priorityEvidenceCandidates([
    { chunkId: 1, sourceType: 'syllabus', filename: 'syllabus.pdf', content: 'The course consists of six weekly units.' },
    { chunkId: 2, sourceType: 'slides', filename: 'Lecture 01 Introduction.pdf', content: 'Meet on Tuesdays in teams of four.' },
    { chunkId: 3, sourceType: 'slides', filename: 'Lecture 08.pdf', content: 'Trees have vertices and edges.' }
  ])
  assert.deepEqual(candidates.map(c => c.chunkId), [1, 2])
})
test('a long syllabus cannot starve introductory slides from the evidence budget', () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({ chunkId: index + 1, filename: 'syllabus.pdf', sourceType: 'syllabus', content: 'Course structure' }))
  rows.push({ chunkId: 121, filename: 'Introduction.pdf', sourceType: 'slides', content: 'Course organisation' })
  assert.ok(priorityEvidenceCandidates(rows).some(row => row.chunkId === 121))
})
