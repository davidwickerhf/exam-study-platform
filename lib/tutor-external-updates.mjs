import { randomUUID } from 'node:crypto'
import { readDocument, compareAndSwapDocument } from './user-store.mjs'
import { activeProgrammeId, scopedDocumentKey } from './programme-scope.mjs'
import { readTutorAttendance, stageTutorAttendance } from './tutor-attendance.mjs'
import { TutorStoreError } from './tutor-store.mjs'

// Pending reviews never enter conversation retrieval or approved memory.
const keyFor = async id => scopedDocumentKey(await activeProgrammeId(), `pending-update:${id}`)
const clean = (value, max) => String(value || '').trim().slice(0, max)
const validDate = value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value

export async function prepareExternalTutorUpdate(input, { attendance = readTutorAttendance, now = () => Date.now() } = {}) {
  let proposal
  if (input.kind === 'attendance') {
    const state = await attendance({ courseCode: input.courseCode, from: input.from, to: input.to })
    proposal = stageTutorAttendance(state, { eventIds: input.eventIds, status: input.status, note: input.note })
  } else if (['preference', 'availability', 'context'].includes(input.kind)) {
    const fact = clean(input.text, 400)
    if (!fact) throw new TutorStoreError('Write the exact context to remember.')
    const startDate = clean(input.startDate, 10), endDate = clean(input.endDate, 10)
    if (!validDate(startDate) || !validDate(endDate) || (startDate && endDate && startDate > endDate)) throw new TutorStoreError('Choose valid context dates.')
    const weekdays = [...new Set(input.weekdays || [])]
    if (weekdays.some(day => !['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].includes(day))) throw new TutorStoreError('Choose valid weekdays.')
    proposal = { id: `proposal-${randomUUID()}`, type: 'remember-context', title: `Remember ${input.kind}`, summary: fact,
      detail: [fact, weekdays.length ? `Repeats: ${weekdays.join(', ')}` : '', startDate ? `From ${startDate}` : '', endDate ? `Until ${endDate}` : '', 'Used as personal context for future Tutor answers. This does not mark attendance or change your timetable.'].filter(Boolean).join('\n'),
      payload: { fact, kind: input.kind, weekdays, startDate, endDate }, reversible: true }
  } else throw new TutorStoreError('Choose attendance, preference, availability or context.')
  const update = { id: randomUUID(), revision: randomUUID(), status: 'pending', proposal, createdAt: new Date(now()).toISOString(), expiresAt: new Date(now() + 30 * 60_000).toISOString() }
  await compareAndSwapDocument('tutor', await keyFor(update.id), update, null)
  return { updateId: update.id, proposal, expiresAt: update.expiresAt, confirmationRequired: true }
}

export async function confirmExternalTutorUpdate({ updateId, confirmed }, execute, { now = () => Date.now() } = {}) {
  if (confirmed !== true) throw new TutorStoreError('The student must explicitly confirm this exact write.', 403)
  if (!/^[0-9a-f-]{36}$/.test(updateId || '')) throw new TutorStoreError('Choose a prepared update.')
  const key = await keyFor(updateId), held = await readDocument('tutor', key, null)
  if (!held) throw new TutorStoreError('This prepared update is not in the active account and programme.', 404)
  if (held.status === 'completed') return { receipt: held.receipt, duplicate: true }
  if (held.status !== 'pending') throw new TutorStoreError('This update is being applied or needs review. Inspect the current record before preparing another.', 409)
  if (Date.parse(held.expiresAt) <= now()) throw new TutorStoreError('This review expired. Prepare the change again.', 409)
  const applying = { ...held, revision: randomUUID(), status: 'applying' }
  await compareAndSwapDocument('tutor', key, applying, held.revision)
  try {
    const result = await execute(held.proposal)
    const receipt = { proposalId: held.proposal.id, proposalType: held.proposal.type, title: held.proposal.title, status: 'completed', at: new Date(now()).toISOString(), result }
    await compareAndSwapDocument('tutor', key, { ...applying, revision: randomUUID(), status: 'completed', receipt }, applying.revision)
    return { receipt, duplicate: false }
  } catch (error) {
    await compareAndSwapDocument('tutor', key, { ...applying, revision: randomUUID(), status: 'needs-review', error: error.message }, applying.revision).catch(() => {})
    throw error
  }
}
