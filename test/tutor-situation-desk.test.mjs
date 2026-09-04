import test from 'node:test'
import assert from 'node:assert/strict'
import { deletePersonalData } from '../lib/account-data.mjs'
import { evidenceFromTool, normalizeTutorContext, proposalFromTool } from '../lib/tutor-agent.mjs'
import { deleteTutorAttachment, listTutorAttachments, readTutorAttachment, saveTutorAttachment, searchTutorAttachments } from '../lib/tutor-attachments.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { readTutorMemory, rememberPlan, saveTutorActionReceipt, tutorActionReceipt } from '../lib/tutor-store.mjs'

test('Tutor source files are private, chunked and retrievable for the current user', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const owner = `tutor-source-owner-${suffix}`
  const stranger = `tutor-source-stranger-${suffix}`
  let id
  try {
    await withRequestContext({ userId: owner }, async () => {
      const source = await saveTutorAttachment({
        name: 'Algorithms syllabus.txt', type: 'text/plain',
        dataUrl: `data:text/plain;base64,${Buffer.from('Attendance rules').toString('base64')}`,
        text: 'BCS1540 requires attendance at the group project lab on Friday. The checkpoint is due at 17:00.',
        courseCode: 'BCS1540'
      })
      id = source.id
      assert.equal(source.private, true)
      assert.equal(source.status, 'indexed')
      assert.equal((await listTutorAttachments()).length, 1)
      assert.equal((await readTutorAttachment(source.id)).dataUrl.startsWith('data:text/plain;base64,'), true)
      const results = await searchTutorAttachments({ query: 'Friday group project checkpoint', courseCode: 'BCS1540' })
      assert.equal(results[0].attachment.id, source.id)
      assert.match(results[0].content, /group project lab/)
    })
    await withRequestContext({ userId: stranger }, async () => assert.equal((await listTutorAttachments()).length, 0))
    await withRequestContext({ userId: owner }, async () => {
      assert.equal(await deleteTutorAttachment(id), true)
      assert.equal(await readTutorAttachment(id), null)
    })
  } finally {
    await withRequestContext({ userId: owner }, () => deletePersonalData())
    await withRequestContext({ userId: stranger }, () => deletePersonalData())
  }
})

test('Documents uploads can retain DOCX originals in the shared private-source register', async () => {
  const userId = `documents-source-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await withRequestContext({ userId }, async () => {
      const type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const source = await saveTutorAttachment({
        name: 'Personal notes.docx',
        dataUrl: `data:${type};base64,${Buffer.from('fake-docx-bytes').toString('base64')}`,
        text: 'Personal revision notes about dynamic programming.',
        origin: 'documents'
      })
      assert.equal(source.origin, 'documents')
      assert.equal(source.type, type)
      assert.equal((await readTutorAttachment(source.id)).dataUrl.startsWith(`data:${type};base64,`), true)
      const fromCourseLens = await searchTutorAttachments({ query: 'dynamic programming', courseCode: 'BCS1540' })
      assert.equal(fromCourseLens[0].attachment.id, source.id)
    })
  } finally {
    await withRequestContext({ userId }, () => deletePersonalData())
  }
})

test('Tutor context stays bounded and course lenses do not discard attached sources', () => {
  const context = normalizeTutorContext({ courseCode: ' bcs1540 ', chapterName: 'Greedy', attachmentIds: ['a', 'a', '', 'b'] })
  assert.equal(context.courseCode, 'BCS1540')
  assert.deepEqual(context.attachmentIds, ['a', 'b'])
})

test('mutations remain proposals and evidence remains separate from prose', () => {
  const staged = { proposal: { id: 'proposal-1', type: 'calendar-event' } }
  assert.equal(proposalFromTool('propose_calendar_action', staged), staged.proposal)
  assert.equal(proposalFromTool('get_schedule', staged), null)
  const evidence = evidenceFromTool('get_schedule', { events: [{ when: '2026-09-08T10:00:00Z', category: 'timetable', course: 'BCS1540', title: 'Lab', room: 'C0.002' }] })
  assert.equal(evidence.length, 1)
  assert.equal(evidence[0].sourceType, 'Timetable')
  assert.match(evidence[0].location, /C0\.002/)
})

test('approved plans and action receipts are durable and idempotent', async () => {
  const userId = `tutor-actions-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await withRequestContext({ userId }, async () => {
      const first = await rememberPlan({ title: 'Work every Tuesday', recurrence: 'weekly', behaviour: 'Do not schedule study during work.' })
      const duplicate = await rememberPlan({ title: 'Work every Tuesday', recurrence: 'weekly', behaviour: 'Do not schedule study during work.' })
      assert.equal(duplicate.duplicate, true)
      assert.equal(duplicate.stored.id, first.stored.id)
      assert.equal((await readTutorMemory()).plans.length, 1)
      await saveTutorActionReceipt({ proposalId: 'proposal-stable', status: 'completed', result: { label: 'Plan remembered' } })
      await saveTutorActionReceipt({ proposalId: 'proposal-stable', status: 'completed', result: { label: 'Plan already remembered' } })
      assert.equal((await tutorActionReceipt('proposal-stable')).result.label, 'Plan already remembered')
    })
  } finally {
    await withRequestContext({ userId }, () => deletePersonalData())
  }
})
