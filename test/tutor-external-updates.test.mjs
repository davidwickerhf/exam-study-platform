import test from 'node:test'
import assert from 'node:assert/strict'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, writeDocument, readDocument, compareAndSwapDocument } from '../lib/user-store.mjs'
import { activeProgrammeId, scopedDocumentKey } from '../lib/programme-scope.mjs'
import { createAcademicProgramme, selectAcademicProgramme } from '../lib/academics.mjs'
import { prepareExternalTutorUpdate as prepare, confirmExternalTutorUpdate as confirm } from '../lib/tutor-external-updates.mjs'
import { rememberFact, readTutorMemory, saveTutorPreferences, rememberPlan, forgetFact } from '../lib/tutor-store.mjs'
import { tutorSystemPrompt } from '../lib/tutor-agent.mjs'

async function fixture(run) {
  const userId = `external-updates-${crypto.randomUUID()}`
  try { return await withRequestContext({ userId }, () => run(userId)) }
  finally { await withRequestContext({ userId }, deleteAllDocuments) }
}
const execute = proposal => rememberFact(proposal.payload.fact, proposal.payload)

test('context is reviewed before memory changes; exact confirmed update is idempotent and shared with Tutor', () => fixture(async () => {
  const prepared = await prepare({ kind: 'availability', text: 'I work Tuesdays and Fridays.', weekdays: ['tuesday', 'friday'], endDate: '2026-12-31' })
  assert.match(prepared.proposal.detail, /tuesday, friday/)
  assert.equal((await readTutorMemory()).facts.length, 0)
  await assert.rejects(confirm({ updateId: prepared.updateId, confirmed: false }, execute), /explicitly confirm/)
  const outcomes = await Promise.allSettled([confirm({ updateId: prepared.updateId, confirmed: true }, execute), confirm({ updateId: prepared.updateId, confirmed: true }, execute)])
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal((await confirm({ updateId: prepared.updateId, confirmed: true }, execute)).duplicate, true)
  const memory = await readTutorMemory()
  assert.equal(memory.facts.length, 1)
  assert.equal(memory.facts[0].fact, 'I work Tuesdays and Fridays.')
  assert.match(tutorSystemPrompt({ memory, today: '2026-09-06' }), /I work Tuesdays and Fridays/)
  assert.doesNotMatch(tutorSystemPrompt({ memory, today: '2027-01-01' }), /I work Tuesdays and Fridays/)
  await forgetFact(memory.facts[0].id)
  assert.equal((await readTutorMemory()).facts.length, 0)
}))

test('reviews expire and cannot cross account or programme boundaries', () => fixture(async owner => {
  const prepared = await prepare({ kind: 'preference', text: 'Explain with diagrams.' }, { now: () => 0 })
  await assert.rejects(confirm({ updateId: prepared.updateId, confirmed: true }, execute, { now: () => 31 * 60000 }), /expired/)
  await withRequestContext({ userId: `${owner}-other` }, async () => {
    try { await assert.rejects(confirm({ updateId: prepared.updateId, confirmed: true }, execute), /active account/)}
    finally { await deleteAllDocuments() }
  })
  const previous = await activeProgrammeId()
  await createAcademicProgramme({ programme: 'Other programme' })
  await assert.rejects(confirm({ updateId: prepared.updateId, confirmed: true }, execute), /active account/)
  await selectAcademicProgramme(previous)
  assert.equal((await readTutorMemory()).facts.length, 0)
}))

test('an uncertain write is not blindly retried', () => fixture(async () => {
  const prepared = await prepare({ kind: 'context', text: 'I handle project testing.' })
  let calls = 0
  const fail = async () => { calls++; throw new Error('Connection lost after write') }
  await assert.rejects(confirm({ updateId: prepared.updateId, confirmed: true }, fail), /Connection lost/)
  await assert.rejects(confirm({ updateId: prepared.updateId, confirmed: true }, fail), /needs review/)
  assert.equal(calls, 1)
}))

test('attendance review only accepts known completed timetable sessions', () => fixture(async () => {
  const events = [{ id: 'past', courseCode: 'BCS2140', category: 'timetable', attendanceEligible: true, start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z' }, { id: 'future', category: 'timetable', attendanceEligible: true, start: '2099-01-01T10:00:00Z' }]
  const attendance = async () => ({ workspace: { id: 'default', planning: { attendanceRecords: [] } }, events })
  await assert.rejects(prepare({ kind: 'attendance', eventIds: ['unknown'], status: 'missed' }, { attendance }), /completed teaching/)
  await assert.rejects(prepare({ kind: 'attendance', eventIds: ['future'], status: 'missed' }, { attendance }), /completed teaching/)
  const review = await prepare({ kind: 'attendance', eventIds: ['past'], status: 'attended' }, { attendance })
  assert.match(review.proposal.detail, /unknown → attended/)
  assert.equal(review.proposal.payload.entries[0].event.id, 'past')
}))

test('legacy memory upgrades atomically without losing concurrent facts, plans or preferences', () => fixture(async () => {
  const key = scopedDocumentKey(await activeProgrammeId(), 'memory')
  await writeDocument('tutor', key, { facts: [{ id: 'old', fact: 'Existing context' }], plans: [], preferences: {} })
  await Promise.all([rememberFact('New context'), rememberFact('Another context'), rememberPlan({ title: 'Work', recurrence: 'weekly' }), saveTutorPreferences({ tone: 'warm' })])
  const memory = await readTutorMemory()
  assert.equal(memory.facts.length, 3)
  assert.equal(memory.plans.length, 1)
  assert.equal(memory.preferences.tone, 'warm')
  assert.ok((await readDocument('tutor', key, null)).revision)
  await writeDocument('test', 'legacy', { value: 1 })
  await assert.rejects(compareAndSwapDocument('test', 'legacy', { revision: 'new' }, null), /record changed/)
  await assert.rejects(compareAndSwapDocument('test', 'legacy', { revision: 'new' }, null, { legacyValue: { value: 2 } }), /record changed/)
}))
