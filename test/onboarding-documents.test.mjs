import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { withRequestContext } from '../lib/request-context.mjs'
import { readAcademicState, saveActiveAcademicWorkspace } from '../lib/academics.mjs'
import { rememberDocumentImport, removeOnboardingDocument, undoDocumentImport } from '../lib/onboarding-documents.mjs'
import { setupState } from '../lib/onboarding-runtime.mjs'
import { recordAcademicDocumentVersion } from '../lib/academic-document-register.mjs'

test('undo removes imported attempts but preserves later edits and new evidence', () => {
  const before = { courses: [{ id: 'c1', name: 'Math', attempts: [] }] }
  const after = { courses: [{ id: 'c1', name: 'Math', attempts: [{ id: 'a1', grade: 8 }] }] }
  const current = { courses: [{ id: 'c1', name: 'Edited title', attempts: [{ id: 'a1', grade: 8 }, { id: 'a2', grade: 9 }] }] }
  assert.deepEqual(undoDocumentImport(current, before, after), { courses: [{ id: 'c1', name: 'Edited title', attempts: [{ id: 'a2', grade: 9 }] }] })
  current.courses[0].attempts[0].grade = 7
  assert.equal(undoDocumentImport(current, before, after).courses[0].attempts[0].grade, 7)
})

test('removing a newly imported course preserves another source but clears its own attempts', () => {
  const imported = { id: 'c1', name: 'Math', attempts: [{ id: 'a1', grade: 8 }] }
  const current = { courses: [{ ...imported, attempts: [...imported.attempts, { id: 'a2', grade: 9 }] }] }
  assert.deepEqual(undoDocumentImport(current, { courses: [] }, { courses: [imported] }).courses[0].attempts, [{ id: 'a2', grade: 9 }])
})

test('connected state uses actual documents; removing an import clears context and permits replacement', async () => {
  const owner = `test-onboarding-${randomUUID()}`
  try {
    await withRequestContext({ userId: owner, mode: 'clerk' }, async () => {
      const initial = await readAcademicState()
      const seeded = await saveActiveAcademicWorkspace({ ...initial.workspace, profile: { ...initial.workspace.profile, programme: 'Test' }, courses: [{ id: 'c1', name: 'Math', code: 'MTH101', attempts: [{ id: 'manual', grade: 7, status: 'passed' }] }] }, initial.workspace.revision)
      assert.equal((await setupState()).transcript, false, 'manual grades are not a transcript')
      const updated = await saveActiveAcademicWorkspace({ ...seeded.workspace, courses: seeded.workspace.courses.map((course) => ({ ...course, attempts: [...course.attempts, { id: 'imported', grade: 8, status: 'passed' }] })) }, seeded.workspace.revision)
      await rememberDocumentImport('transcript', seeded.workspace, updated.workspace)
      await recordAcademicDocumentVersion({ kind: 'transcript', label: 'Results.pdf', fingerprint: 'first' })
      assert.equal((await setupState()).transcriptDocument.name, 'Results.pdf')
      await removeOnboardingDocument('transcript')
      assert.equal((await setupState()).transcript, false)
      assert.deepEqual((await readAcademicState()).workspace.courses[0].attempts.map((a) => a.id), ['manual'])
      await recordAcademicDocumentVersion({ kind: 'transcript', label: 'Replacement.pdf', fingerprint: 'first' })
      assert.equal((await setupState()).transcriptDocument.name, 'Replacement.pdf')
    })
  } finally { await rm(new URL(`../data/users/${owner}/`, import.meta.url), { recursive: true, force: true }) }
})

test('removing both sources never resurrects the first source through undo history', async () => {
  const owner = `test-onboarding-${randomUUID()}`
  try {
    await withRequestContext({ userId: owner, mode: 'clerk' }, async () => {
      const initial = await readAcademicState()
      const record = await saveActiveAcademicWorkspace({ ...initial.workspace, courses: [{ id: 'c1', name: 'Math', attempts: [{ id: 'overview', grade: 8, status: 'passed' }] }] }, initial.workspace.revision)
      await rememberDocumentImport('record', initial.workspace, record.workspace)
      const transcript = await saveActiveAcademicWorkspace({ ...record.workspace, courses: record.workspace.courses.map((course) => ({ ...course, attempts: [...course.attempts, { id: 'transcript', grade: 9, status: 'passed' }] })) }, record.workspace.revision)
      await rememberDocumentImport('transcript', record.workspace, transcript.workspace)
      await removeOnboardingDocument('record')
      assert.deepEqual((await readAcademicState()).workspace.courses[0].attempts.map((a) => a.id), ['transcript'])
      await removeOnboardingDocument('transcript')
      assert.equal((await readAcademicState()).workspace.courses.flatMap((c) => c.attempts).length, 0)
    })
  } finally { await rm(new URL(`../data/users/${owner}/`, import.meta.url), { recursive: true, force: true }) }
})
