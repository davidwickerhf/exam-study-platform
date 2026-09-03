import test from 'node:test'
import assert from 'node:assert/strict'
import { editorialShellFromState } from '../lib/editorial-store.mjs'

test('workspace shell retains the course directory without exposing the full study inventory', () => {
  const shell = editorialShellFromState({
    meta: { schemaVersion: 7, doneThreshold: 3, title: 'Study', timezone: 'Europe/Amsterdam', privateNote: 'omit this' },
    dailyBlocks: [{ id: 'morning', itemIds: ['item-1'] }],
    courses: [{
      id: 'num', code: 'BCS2540', name: 'Numerical Methods', shortName: 'NM', accent: '#4d5',
      knowledgeBase: 'numerical-methods', chapters: [{ id: '01', name: 'Errors', file: '01.md', hidden: true }],
      courseProfile: { description: 'large overview', assessment: { status: 'confirmed', attendanceRules: ['Labs are mandatory.'], components: [{ name: 'Group project', type: 'project', weightPercent: 30, deadline: '2026-10-01', evidence: [{ chunkId: 42 }] }] } },
      items: [{ id: 'item-1', prompt: 'large private item' }],
      mockExams: [{ id: 'mock-1' }], tutorials: [{ id: 'tutorial-1' }]
    }]
  })

  assert.equal(shell.meta.privateNote, undefined)
  assert.equal(shell.courses[0].items.length, 0)
  assert.equal(shell.courses[0].mockExams.length, 0)
  assert.equal(shell.courses[0].tutorials.length, 0)
  assert.deepEqual(shell.courses[0].chapters, [{ id: '01', name: 'Errors', file: '01.md' }])
  assert.deepEqual(shell.courses[0].courseProfile, { assessment: { status: 'confirmed', attendanceRules: ['Labs are mandatory.'], components: [{ name: 'Group project', type: 'project', weightPercent: 30, minimumPercent: undefined, deadline: '2026-10-01', deadlineText: undefined, notes: undefined }] } })
  assert.equal(shell.courses[0].courseProfile.description, undefined)
  assert.equal(shell.courses[0].courseProfile.assessment.components[0].evidence, undefined)
  assert.deepEqual(shell.dailyBlocks, [{ id: 'morning', itemIds: ['item-1'] }])
})
