import test from 'node:test'
import assert from 'node:assert/strict'
import { programmesMatch, validateSetupSources } from '../lib/setup-validation.mjs'

test('programme comparison ignores degree wording', () => {
  assert.equal(programmesMatch('Bachelor of Science Computer Science', 'BSc Computer Science'), true)
  assert.equal(programmesMatch('Bachelor of Science Computer Science', 'Master of Arts European Studies'), false)
})

test('setup validation reports an explicit transcript mismatch', () => {
  const issues = validateSetupSources({ programmeName: 'BSc Computer Science', recordProgramme: 'MSc Data Science' })
  assert.equal(issues[0].id, 'programme-record-mismatch')
  assert.equal(issues[0].severity, 'error')
})

test('historical courses do not create a current-course warning', () => {
  const issues = validateSetupSources({
    selectedCourses: [{ code: 'BCS1000' }],
    recordCourses: [{ code: 'OLD1000', section: 'historical', status: 'passed' }]
  })
  assert.deepEqual(issues, [])
})
