import test from 'node:test'
import assert from 'node:assert/strict'
import { loadEditorialProgrammeCatalogue, workspaceProgrammeCatalogue } from '../lib/editorial-programmes.mjs'
import { curriculumCourseIdentity } from '../lib/course-identities.mjs'

test('workspace catalogue preserves every historical identity and placement in a small payload', () => {
  const catalogue = loadEditorialProgrammeCatalogue()
  for (const programme of catalogue.programmes) {
    const result = workspaceProgrammeCatalogue(catalogue, programme.id)
    assert.equal(result.programmes.length, 1)
    const reduced = result.programmes[0]
    assert.equal(reduced.versions.length, programme.versions.length)
    assert.ok(JSON.stringify(result).length < JSON.stringify(catalogue).length / 4)
    for (const version of programme.versions) {
      const compactVersion = reduced.versions.find(item => item.id === version.id)
      assert.deepEqual(compactVersion.choiceGroups, version.choiceGroups)
      const full = curriculumCourseIdentity({ selectedVersion: version, programmeVersions: programme.versions })
      const compact = curriculumCourseIdentity({ selectedVersion: compactVersion, programmeVersions: reduced.versions })
      for (const course of version.courses) {
        const expected = full.canonicalCourse(course), actual = compact.canonicalCourse(course)
        for (const field of ['code', 'name', 'ects', 'yearLevel', 'period']) assert.equal(actual?.[field], expected?.[field])
      }
    }
  }
  assert.deepEqual(workspaceProgrammeCatalogue(catalogue, null).programmes, [])
})
