// Electives are the half of the curriculum nobody can fill in for the student,
// and until setup asks, the dashboard is describing someone else's degree.
//
// Two things are worth pinning down. The groups are derived from the offering
// rather than written by an editor, so the derivation has to stay faithful to
// what the university publishes. And the courses setup writes have to be the
// same courses the planner recognises: they were not, so re-saving from
// programme settings silently listed every chosen course twice.

import test from 'node:test'
import assert from 'node:assert/strict'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { loadEditorialProgrammeCatalogue } from '../lib/editorial-programmes.mjs'
import { applyProgramme, chooseElectives, electiveChoices, relevantElectiveGroups, setupState } from '../lib/onboarding-runtime.mjs'
import { readAcademicState } from '../lib/academics.mjs'

const CS = 'maastricht-university-bsc-computer-science'
const version = () => {
  const programme = loadEditorialProgrammeCatalogue().programmes.find((entry) => entry.id === CS)
  return programme.versions.find((entry) => entry.id === '2026-2027')
}

const asNewStudent = (body) => withRequestContext(
  { userId: `electives-${Date.now()}-${Math.random().toString(16).slice(2)}` },
  async () => { try { return await body() } finally { await deleteAllDocuments() } }
)

test('every elective in a scraped curriculum is offered in exactly one group', () => {
  for (const programme of loadEditorialProgrammeCatalogue().programmes) {
    for (const entry of programme.versions) {
      const derived = entry.choiceGroups.filter((group) => group.derived)
      if (!derived.length) continue
      const electives = entry.courses.filter((course) => course.requirement === 'elective').map((course) => course.id)
      const grouped = derived.flatMap((group) => group.courseIds)
      assert.deepEqual([...grouped].sort(), [...electives].sort(), `${programme.name} groups every elective once`)
    }
  }
})

test('a derived group never contains a required course', () => {
  const entry = version()
  const required = new Set(entry.courses.filter((course) => course.requirement === 'required').map((course) => course.id))
  for (const group of entry.choiceGroups) {
    for (const courseId of group.courseIds) assert.ok(!required.has(courseId), `${courseId} is required, not a choice`)
  }
})

test('the relevant groups are this period, the semester around it, and the year', () => {
  const groups = relevantElectiveGroups(version(), { studyYear: 'Year 3', period: 'Period 1' })
  assert.deepEqual(groups.map((group) => group.period).sort(), ['Period 1', 'Semester 1', 'Year'])
  // A different year's electives are not this student's business right now.
  assert.ok(groups.every((group) => group.yearLevel === 'Year 3'))
})

test('a period with no electives asks nothing', () => {
  assert.deepEqual(relevantElectiveGroups(version(), { studyYear: 'Year 1', period: 'Period 1' }), [])
})

test('setup records a choice, and changing it later does not duplicate the course', async () => {
  await asNewStudent(async () => {
    await applyProgramme({ programmeId: CS, studyYear: 3 })
    const offered = await electiveChoices({ scope: 'current' })
    assert.equal(offered.period, 'Period 1', 'the academic calendar places the student in Period 1')
    const group = offered.groups.find((entry) => entry.period === 'Period 1')
    assert.ok(group, 'this period has electives to choose from')

    await chooseElectives({ groupId: group.id, courseIds: group.courses.slice(0, 2).map((course) => course.id) })
    let { workspace } = await readAcademicState()
    const codes = workspace.courses.map((course) => course.code)
    assert.equal(new Set(codes).size, codes.length, 'no course appears twice')
    assert.deepEqual(workspace.programmeTemplate.selectedChoices[group.id], group.courses.slice(0, 2).map((course) => course.id))

    // Every course setup writes must be recognisable to the planner, which
    // matches on the template id rather than the workspace id.
    for (const course of workspace.courses) assert.ok(course.templateCourseId, `${course.code} carries its template id`)

    // Choosing again with one fewer drops it rather than accumulating.
    await chooseElectives({ groupId: group.id, courseIds: [group.courses[0].id] })
    ;({ workspace } = await readAcademicState())
    const after = workspace.courses.map((course) => course.code)
    assert.equal(new Set(after).size, after.length)
    assert.ok(after.includes(group.courses[0].code))
    assert.ok(!after.includes(group.courses[1].code), 'a dropped elective with no attempts leaves the plan')
  })
})

test('a choice can be recorded by course code, without naming the group', async () => {
  await asNewStudent(async () => {
    await applyProgramme({ programmeId: CS, studyYear: 3 })
    const offered = await electiveChoices({ scope: 'current' })
    const group = offered.groups.find((entry) => entry.period === 'Period 1')
    // The assistant reads codes out to the student; requiring ids and a group
    // forced a lookup it kept skipping, and then nothing was recorded at all.
    const result = await chooseElectives({ courseIds: [group.courses[0].code, group.courses[1].code.toLowerCase()] })
    assert.equal(result.group, group.label)
    const { workspace } = await readAcademicState()
    assert.deepEqual(workspace.programmeTemplate.selectedChoices[group.id], [group.courses[0].id, group.courses[1].id])
  })
})

test('courses spanning two groups are refused rather than guessed', async () => {
  await asNewStudent(async () => {
    await applyProgramme({ programmeId: CS, studyYear: 3 })
    const offered = await electiveChoices({ scope: 'current' })
    const first = offered.groups.find((entry) => entry.period === 'Period 1')
    const second = offered.groups.find((entry) => entry.period !== 'Period 1' && entry.courses.length)
    await assert.rejects(
      () => chooseElectives({ courseIds: [first.courses[0].code, second.courses[0].code] }),
      /not all in one elective group/
    )
  })
})

test('a course cannot be chosen from a group that does not offer it', async () => {
  await asNewStudent(async () => {
    await applyProgramme({ programmeId: CS, studyYear: 3 })
    const offered = await electiveChoices({ scope: 'current' })
    const group = offered.groups.find((entry) => entry.period === 'Period 1')
    await assert.rejects(() => chooseElectives({ groupId: group.id, courseIds: ['bcs1110'] }), /not offered/)
  })
})

test('setup counts an unanswered elective group as outstanding', async () => {
  await asNewStudent(async () => {
    await applyProgramme({ programmeId: CS, studyYear: 3 })
    const before = await setupState()
    assert.ok(before.electivesPending > 0, 'the plan is not complete until the student has been asked')
    assert.equal(before.electives, false)

    const offered = await electiveChoices({ scope: 'current' })
    for (const group of offered.groups) await chooseElectives({ groupId: group.id, courseIds: [] })

    const after = await setupState()
    // Answering "none of these" is an answer.
    assert.equal(after.electivesPending, 0)
    assert.equal(after.electives, true)
  })
})

test('electives are not chosen for the student by setting a programme', async () => {
  await asNewStudent(async () => {
    const applied = await applyProgramme({ programmeId: CS, studyYear: 3 })
    const { workspace } = await readAcademicState()
    assert.ok(workspace.courses.every((course) => course.programmeRequirement === 'required'))
    assert.ok(applied.nextStep.includes('list_electives'), 'the assistant is told there is still a question to ask')
  })
})
