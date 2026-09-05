import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { compareAcademicDocuments, validateDocumentRows, documentCredits } from '../lib/academic-document-check.mjs'
import { fallbackAcademicIntake } from '../lib/academic-intake.mjs'
import { parseAcademicWork } from '../lib/academic-work.mjs'
import { normalizeAcademicWorkspace } from '../lib/academics.mjs'
import { courseEarnedCredits } from '../lib/academic-record-repair.mjs'
import { buildChangeSet, applyChanges } from '../lib/academic-documents.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { createDocumentReview, readDocumentReviews, discardDocumentReviews, academicDocumentCheck } from '../lib/academic-document-review.mjs'
import { recordAcademicDocumentVersion, deleteAcademicDocumentRecord } from '../lib/academic-document-register.mjs'

const row = (values = {}) => ({ code: 'BCS2120', name: 'Introduction to Artificial Intelligence', academicYear: '2025-2026', examDate: null, grade: 7, status: 'passed', creditsEarned: 4, creditsTotal: 4, ...values })
const evidence = (rows) => ({ rows, validation: validateDocumentRows(rows), sourceLabel: 'Example.pdf' })
const transcript = (text) => `Transcript / Resultatenoverzicht\nBSc CS year 2 core courses\n${text}\nEND OF TRANSCRIPT`

test('independent sources agree on results, with current enrolments separate', () => {
  const record = evidence([row(), row({ academicYear: '2026-2027', grade: null, status: 'upcoming', creditsEarned: 0 })])
  const result = compareAcademicDocuments(record, evidence([row({ code: '', examDate: '2026-06-18' })]))
  assert.equal(result.status, 'confirmed')
  assert.equal(result.recordCredits, 4)
  assert.equal(result.transcriptCredits, 4)
  assert.equal(compareAcademicDocuments(record, null).status, 'awaiting-document')
})

test('a repeated year and swapped failed elective stay in history and earn no duplicate credits', () => {
  const history = [row({ academicYear: '2024-2025', grade: 4, status: 'failed', creditsEarned: 0 }), row(), row({ code: 'HPC101', name: 'High Performance Computing', grade: 3, status: 'failed', creditsTotal: 10, creditsEarned: 0 }), row({ code: 'SEC101', name: 'Computer Security', grade: 8, creditsTotal: 10, creditsEarned: 10 })]
  const result = compareAcademicDocuments(evidence(history), evidence(history))
  assert.equal(result.status, 'confirmed')
  assert.equal(result.counts.confirmed, 4)
  assert.equal(documentCredits([...history, row({ academicYear: '2026-2027' })]), 14)
})

test('same total does not hide conflicting grades, credits, identities or missing results', () => {
  assert.equal(compareAcademicDocuments(evidence([row()]), evidence([row({ grade: 8 })])).counts.conflict, 1)
  assert.equal(compareAcademicDocuments(evidence([row()]), evidence([row({ creditsTotal: 6 })])).counts.conflict, 1)
  assert.equal(compareAcademicDocuments(evidence([row(), row({ code: 'DIFFERENT' })]), evidence([row({ code: '' })])).counts.ambiguous, 1)
  const absent = compareAcademicDocuments(evidence([row()]), evidence([row({ academicYear: '2024-2025' })]))
  assert.equal(absent.counts['record-only'], 1)
  assert.equal(absent.counts['transcript-only'], 1)
  assert.equal(absent.status, 'attention')
})

test('one undated result cannot confirm two separate dated attempts', () => {
  const result = compareAcademicDocuments(evidence([row()]), evidence([row({ examDate: '2026-06-18' }), row({ examDate: '2026-07-18' })]))
  assert.equal(result.counts.confirmed, 1)
  assert.equal(result.counts.ambiguous, 1)
  assert.equal(result.status, 'attention')
})

test('unknown layouts and incomplete legacy evidence cannot claim corroboration', () => {
  const source = evidence([row()])
  assert.equal(compareAcademicDocuments({ ...source, validation: validateDocumentRows(source.rows, { supported: false }) }, source).status, 'attention')
  assert.equal(compareAcademicDocuments(evidence([]), evidence([])).status, 'attention')
})

test('known transcript rejects invalid dates, grade/credit contradictions and lost rows', () => {
  assert.throws(() => fallbackAcademicIntake(transcript('Logic 7,0 31.02.2026 4,00 4,00 1'), [], { kind: 'transcript' }), /invalid result date/)
  assert.throws(() => fallbackAcademicIntake(transcript('Logic 4,0 18.06.2026 4,00 4,00 1'), [], { kind: 'transcript' }), /disagree/)
  assert.throws(() => fallbackAcademicIntake(transcript('Logic 7,0 18.06.2026 4,00 4,00 1\nBroken result 19.06.2026 unreadable'), [], { kind: 'transcript' }), /2 course rows.*1 were read/)
  assert.throws(() => fallbackAcademicIntake(transcript('Logic 7,0 18.06.2026 4,00 4,00 1\nEarned credits: 8'), [], { kind: 'transcript' }), /states 8.*add up to 4/)
})

test('wrapped transcript headers and repeated rows cannot silently alter credits', () => {
  const draft = fallbackAcademicIntake(transcript('ECTS ECTS\nIntroduction to Artificial\nIntelligence 7,0 18.06.2026 4,00 4,00 1\nEarned credits: 4'), [], { kind: 'transcript' })
  assert.equal(draft.sourceEvidence.validation.earnedCredits, 4)
  assert.equal(draft.sourceEvidence.rows[0].name, 'Introduction to Artificial Intelligence')
  assert.throws(() => fallbackAcademicIntake(transcript('Logic 7,0 18.06.2026 4,00 4,00 1\nLogic 7,0 18.06.2026 4,00 4,00 1'), [], { kind: 'transcript' }), /repeated/)
})

test('Academic Work refuses partial parsing and contradictory section results', () => {
  const valid = 'Completed courses\n2025-2026-100-BCS2120 AI 7,0 4,0/4,0'
  assert.throws(() => parseAcademicWork(valid + '\n2025-2026-100-BCS2140 unreadable result'), /2 course rows.*1 were read/)
  assert.throws(() => parseAcademicWork(valid.replace('7,0', '4,0')), /disagree/)
  assert.equal(parseAcademicWork(valid).validation.status, 'read')
})

test('printed partial credit awards survive normalization and do not become full course ECTS', () => {
  const draft = fallbackAcademicIntake(transcript('Logic 7,0 18.06.2026 4,00 2,00 1'), [], { kind: 'transcript' })
  assert.equal(courseEarnedCredits(draft.courses[0]), 2)
  const workspace = normalizeAcademicWorkspace({ courses: [{ id: 'logic', code: '', name: 'Logic', ects: 4, attempts: draft.courses[0].attempts.map((a) => ({ ...a, creditsEarned: 4 })) }] })
  const changes = buildChangeSet(workspace, draft, { kind: 'transcript' }).changes
  const creditChange = changes.find((change) => change.issue === 'conflicting-attempt-credits')
  assert.ok(creditChange?.requiresDecision)
  assert.equal(creditChange.selectedByDefault, false)
  assert.equal(courseEarnedCredits(applyChanges(workspace, [creditChange]).workspace.courses[0]), 2)
})

test('reviews bind checked data to owner, revision and source removal; re-read evidence upgrades legacy versions', async () => {
  const owner = `test-document-check-${randomUUID()}`
  try {
    await withRequestContext({ userId: owner, mode: 'clerk' }, async () => {
      const source = evidence([row()])
      const changes = [{ id: 'result:1', payload: { grade: 7 } }]
      const id = await createDocumentReview({ evidence: source, changes, revision: 1 })
      assert.equal((await readDocumentReviews([id], changes, 1)).length, 1)
      await assert.rejects(() => readDocumentReviews([id], [{ id: 'result:1', payload: { grade: 9 } }], 1), /changed after/)
      await assert.rejects(() => readDocumentReviews([id], changes, 2), /programme changed/)
      await withRequestContext({ userId: `${owner}-other`, mode: 'clerk' }, async () => { await assert.rejects(() => readDocumentReviews([id], changes, 1), /expired/) })
      await recordAcademicDocumentVersion({ kind: 'transcript', fingerprint: 'old' })
      await recordAcademicDocumentVersion({ kind: 'transcript', fingerprint: 'old', evidence: source })
      await recordAcademicDocumentVersion({ kind: 'academic-overview', fingerprint: 'overview', evidence: source })
      assert.equal((await academicDocumentCheck()).status, 'confirmed')
      await deleteAcademicDocumentRecord({ kind: 'transcript' })
      assert.equal((await academicDocumentCheck()).status, 'awaiting-document')
      await discardDocumentReviews()
      await assert.rejects(() => readDocumentReviews([id], changes, 1), /expired/)
    })
  } finally {
    await rm(new URL(`../data/users/${owner}/`, import.meta.url), { recursive: true, force: true })
    await rm(new URL(`../data/users/${owner}-other/`, import.meta.url), { recursive: true, force: true })
  }
})


test('code-less transcript courses never match an unrelated code-less saved course', () => {
  const workspace = normalizeAcademicWorkspace({ courses: [{ id: 'old', name: 'Unrelated elective', code: '', ects: 10, attempts: [] }] })
  const draft = fallbackAcademicIntake(transcript('Logic 7,0 18.06.2026 4,00 4,00 1'), [], { kind: 'transcript' })
  const changes = buildChangeSet(workspace, draft, { kind: 'transcript' }).changes
  assert.ok(changes.some((change) => change.kind === 'history' && change.payload.course.name === 'Logic'))
  const saved = applyChanges(workspace, changes).workspace
  assert.equal(saved.courses.find((course) => course.id === 'old').attempts.length, 0)
  assert.equal(saved.courses.length, 2)
})

test('conflicting duplicate sitting rows are rejected before normalization can merge them', () => {
  assert.throws(() => fallbackAcademicIntake(transcript('Logic 7,0 18.06.2026 4,00 4,00 1\nLogic 8,0 18.06.2026 4,00 4,00 1'), [], { kind: 'transcript' }), /conflicting rows/)
  assert.throws(() => fallbackAcademicIntake(transcript('Logic 7,0 18.06.2026 4,00 4,00 1\nLogic 7,0 18.06.2026 4,00 2,00 1'), [], { kind: 'transcript' }), /conflicting rows/)
})
