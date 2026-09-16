import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, controlStudyGeneration, OUTLINE_CORRECTION_KEY } from '../lib/study-version-pipeline.mjs'
import { startLocalStudy, nextLocalStudy, submitLocalStudy, addLocalStudyNotes } from '../lib/study-local-generation.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

// A whole-course outline is one expensive call over every accepted source map.
// These tests pin the bounded correction that keeps a single coverage slip from
// discarding that work, with a mocked provider only: no model is called.
const billing = { source: 'platform', model: 'gpt-5-mini', maxJobUsd: 50 }
const PAGE = 'Adding disjoint quantities keeps their matching units. Subtraction checks the result. Ratios compare two totals, and estimates bound the remaining error.'
// The fourth concept repeats the first concept's name: a correction must give
// both refs the same teaching home instead of splitting one concept in two.
const MAP_TOPICS = [{ id: 'alpha', title: 'Alpha' }, { id: 'beta', title: 'Beta' }, { id: 'gamma', title: 'Gamma' }, { id: 'alpha-again', title: 'Alpha' }]
const bundle = (first, second) => ({
  guides: [
    { id: 'g1', title: 'Guide one', topics: [{ id: 'chapter-one', title: 'Alpha work', topicRefs: first }] },
    { id: 'g2', title: 'Guide two', topics: [{ id: 'chapter-two', title: 'Beta and gamma', topicRefs: second }] }
  ], gaps: []
})
const COMPLETE = bundle(['map-0-topic-0', 'map-0-topic-3'], ['map-0-topic-1', 'map-0-topic-2'])
const OMITS_TWO = bundle(['map-0-topic-0'], ['map-0-topic-1'])
const SPLIT_OWNER = bundle(['map-0-topic-0', 'map-0-topic-1'], ['map-0-topic-2', 'map-0-topic-3'])

function provider(outlines, ids) {
  const calls = []
  return {
    calls,
    outlines: () => calls.filter(c => c.phase === 'course-outline'),
    generate: async (prompt, options) => {
      const phase = options.usageMetadata?.phase || null
      calls.push({ phase, prompt, correctionAttempt: options.usageMetadata?.correctionAttempt })
      if (phase === 'source-mapping') return { topics: MAP_TOPICS.map(topic => ({ ...topic, sourceIds: ids })), gaps: [] }
      if (phase === 'course-outline') {
        if (!outlines.length) throw new Error('unexpected extra outline call')
        return outlines.shift()
      }
      throw new Error(`unexpected phase ${phase}`)
    }
  }
}
async function hostedFixture(options = {}) {
  const note = await addStudyNote({ ...course, title: 'Course notes' }, [{ page: 1, text: PAGE }])
  const snapshot = await readStudySourceSnapshot(course, [note.id], { courseBundle: options.courseBundle === true })
  const version = await createStudyVersion(course, 'programme-test', snapshot, { ...options, billing, title: 'Whole course plan' })
  return { version, ids: version.draft.snapshot.chunks.map(c => c.id) }
}
// Drive only the planning stages: authoring is covered elsewhere.
async function plan(id, generate, steps = 10) {
  for (let i = 0; i < steps; i++) {
    const version = await ownStudyVersion(id)
    if (['failed', 'stopped', 'complete'].includes(version.draft.status)) break
    if (!['mapping', 'outline'].includes(version.draft.stage)) break
    await processStudyStep(id, { generate })
  }
  return ownStudyVersion(id)
}
const run = fn => withRequestContext({ userId: `outline-${randomUUID()}`, mode: 'local' }, async () => {
  try { await fn() } finally { await deleteAllDocuments() }
})

test('a bundle outline that drops mapped concepts is corrected once with the exact issues', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  const mock = provider([OMITS_TWO, COMPLETE], ids)
  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(planned.draft.maps.length, 1)
  assert.equal(planned.draft.guides.length, 2)
  const outlines = mock.outlines()
  assert.equal(outlines.length, 2)
  assert.equal(mock.calls.filter(c => c.phase === 'source-mapping').length, 1)
  // The correction carries the rejected proposal and the dropped refs, not the
  // evidence again, and points the repeated concept at its existing home.
  const correction = outlines[1].prompt
  assert.equal(outlines[1].correctionAttempt, 1)
  assert.match(correction, /OUTLINE CORRECTION/)
  assert.match(correction, /map-0-topic-2/)
  assert.match(correction, /map-0-topic-3/)
  assert.match(correction, /"taughtIn":"chapter-one"/)
  assert.ok(correction.includes(JSON.stringify(OMITS_TWO)))
  assert.equal(correction.includes('"text"'), false)
  // Accounting: the ledger records the attempt and the pending state is cleared.
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)
  assert.equal(planned.draft.outlineCorrection, undefined)
  const recorded = planned.draft.correctionHistory.filter(row => row.chapterId === OUTLINE_CORRECTION_KEY)
  assert.equal(recorded.length, 1)
  assert.equal(recorded[0].phase, 'course-outline')
  assert.equal(recorded[0].findings.length, 2)
}))

test('two rejected bundle outlines still reach an accepted plan inside the bound', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  const mock = provider([OMITS_TWO, OMITS_TWO, COMPLETE], ids)
  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(mock.outlines().length, 3)
  assert.deepEqual(mock.outlines().map(c => c.correctionAttempt), [undefined, 1, 2])
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 2)
  assert.equal(planned.draft.topics.length > 0, true)
}))

test('a third rejected bundle outline fails safely with the maps and the counter intact', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  const mock = provider([OMITS_TWO, OMITS_TWO, OMITS_TWO], ids)
  const failed = await plan(version.id, mock.generate)
  assert.equal(failed.draft.status, 'failed')
  assert.equal(failed.draft.stage, 'outline')
  assert.match(failed.draft.error, /Outline omitted 2 mapped concepts/)
  assert.equal(failed.draft.maps.length, 1)
  assert.equal(failed.draft.maps[0].topics.length, 4)
  assert.equal(mock.outlines().length, 3)
  assert.equal(failed.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 2)
  assert.equal(failed.draft.outlineCorrection.exhausted, true)
  assert.equal(failed.draft.outlineCorrection.maxAttempts, 2)
  assert.deepEqual(failed.draft.outlineCorrection.issues.map(i => i.ref), ['map-0-topic-2', 'map-0-topic-3'])

  // Re-entering an exhausted outline buys nothing: same error, no new call.
  await controlStudyGeneration(version.id, 'retry')
  const again = await plan(version.id, mock.generate)
  assert.equal(again.draft.status, 'failed')
  assert.match(again.draft.error, /Outline omitted 2 mapped concepts/)
  assert.equal(mock.outlines().length, 3)
  assert.equal(again.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 2)
  assert.equal(again.draft.maps.length, 1)
}))

test('resuming an interrupted correction keeps the counter and never remaps', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  const mock = provider([OMITS_TWO, COMPLETE], ids)
  await processStudyStep(version.id, { generate: mock.generate })
  await processStudyStep(version.id, { generate: mock.generate })
  const rejected = await ownStudyVersion(version.id)
  assert.equal(rejected.draft.stage, 'outline')
  assert.equal(rejected.draft.outlineCorrection.corrections, 1)
  // Interrupt the run the way a lost worker does, then resume it.
  await mutateStudyVersion(version.id, next => { next.draft.status = 'failed'; next.draft.lease = null })
  await controlStudyGeneration(version.id, 'retry')
  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(mock.calls.filter(c => c.phase === 'source-mapping').length, 1)
  assert.equal(mock.outlines().length, 2)
  assert.match(mock.outlines()[1].prompt, /OUTLINE CORRECTION/)
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)
}))

test('a concept split across two guides is corrected rather than failing the run', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  const mock = provider([SPLIT_OWNER, COMPLETE], ids)
  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  const correction = mock.outlines()[1].prompt
  assert.match(correction, /"kind":"duplicate-owner"/)
  assert.match(correction, /"taughtIn":"g1"/)
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)
}))

test('a combined single-guide outline gets the same bounded correction', () => run(async () => {
  const { version, ids } = await hostedFixture()
  await mutateStudyVersion(version.id, next => {
    next.draft.stage = 'outline'
    next.draft.maps = [{ topics: [{ id: 'alpha', title: 'Alpha', sourceIds: ids }], gaps: [] },
      { topics: [{ id: 'beta', title: 'Beta', sourceIds: ids }], gaps: [] }]
  })
  const complete = { topics: [{ id: 'chapter-one', title: 'Alpha and beta', topicRefs: ['map-0-topic-0', 'map-1-topic-0'] }], gaps: [] }
  const omitted = { topics: [{ id: 'chapter-one', title: 'Alpha only', topicRefs: ['map-0-topic-0'] }], gaps: [] }
  const mock = provider([omitted, complete], ids)
  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(mock.outlines().length, 2)
  assert.match(mock.outlines()[1].prompt, /map-1-topic-0/)
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)
  assert.equal(planned.draft.topics.length, 1)
}))

test('the local protocol returns the outline correction as its next request and accepts the repair', () => run(async () => {
  const note = await addLocalStudyNotes({ ...course, title: 'Course evidence', pages: [{ page: 1, text: PAGE }] })
  const { version } = await startLocalStudy({ ...course, sourceKeys: [note.id], courseBundle: true })
  const ids = (await ownStudyVersion(version.id)).draft.snapshot.chunks.map(c => c.id)
  const responses = { 'source-mapping': 0, 'course-outline': 0 }
  const outlines = [OMITS_TWO, COMPLETE]
  let correction = null, status = null
  for (let i = 0; i < 8; i++) {
    const next = await nextLocalStudy(version.id)
    status = next.version
    if (!next.request) break
    const phase = next.request.usageMetadata?.phase
    if (phase !== 'source-mapping' && phase !== 'course-outline') break
    responses[phase]++
    if (phase === 'course-outline' && responses['course-outline'] === 2) correction = { prompt: next.request.prompt, status }
    const response = phase === 'source-mapping'
      ? { topics: MAP_TOPICS.map(topic => ({ ...topic, sourceIds: ids })), gaps: [] }
      : outlines.shift()
    const submitted = await submitLocalStudy(version.id, { requestId: next.request.id, contractId: next.request.contractId, response })
    assert.equal(submitted.accepted, true)
  }
  // The rejection is reported as a correctable request, never as a dead run.
  assert.equal(responses['source-mapping'], 1)
  assert.equal(responses['course-outline'], 2)
  assert.ok(correction, 'no correction request was issued')
  assert.match(correction.prompt, /OUTLINE CORRECTION/)
  assert.match(correction.prompt, /map-0-topic-2/)
  assert.equal(correction.status.corrections.outline.corrections, 1)
  assert.equal(correction.status.corrections.outline.exhausted, false)
  assert.deepEqual(correction.status.corrections.outline.issues.map(i => i.kind), ['missing-concept', 'missing-concept'])
  const saved = await ownStudyVersion(version.id)
  assert.equal(saved.draft.status !== 'failed', true, saved.draft.error || '')
  assert.equal(saved.draft.guides.length, 2)
  assert.equal(saved.draft.outlineCorrection, undefined)
  assert.equal(saved.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)
}))

// CHAPTER CEILINGS ARE PER GUIDE. A large course is simulated with a shared
// course-manual scope passage that leaves 2000 characters per chapter, so each
// 2000-character teaching passage fills exactly one chapter. No model is called.
const SCOPE = 70000, PASSAGE = 2000
async function largeBundle(passages, passageSize = PASSAGE) {
  const notes = await addStudyNote({ ...course, title: 'Course notes' }, [{ page: 1, text: PAGE }])
  const manual = await addStudyNote({ ...course, title: 'Course manual' }, [{ page: 1, text: PAGE }])
  const snapshot = await readStudySourceSnapshot(course, [notes.id, manual.id], { courseBundle: true })
  const version = await createStudyVersion(course, 'programme-test', snapshot, { courseBundle: true, billing, title: 'Whole course plan' })
  await mutateStudyVersion(version.id, next => {
    const scopeKey = next.draft.snapshot.sources.find(s => s.title === 'Course manual').key
    const key = next.draft.snapshot.sources.find(s => s.key !== scopeKey).key
    next.draft.snapshot.chunks = [{ id: 'e-scope', sourceKey: scopeKey, text: 's'.repeat(SCOPE) },
      ...Array.from({ length: passages }, (_, i) => ({ id: `e-t-${i}`, sourceKey: key, text: 'x'.repeat(passageSize) }))]
    next.draft.stage = 'outline'
    next.draft.maps = Array.from({ length: passages }, (_, i) => ({ topics: [{ id: `concept-${i}`, title: `Concept ${i}`, sourceIds: [`e-t-${i}`] }], gaps: [] }))
  })
  return version
}
// guides: [[[passage indexes of chapter], ...], ...]
const plannedBundle = guides => ({
  guides: guides.map((chapters, g) => ({ id: `guide-${g}`, title: `Guide ${g}`,
    topics: chapters.map((refs, c) => ({ id: `guide-${g}-chapter-${c}`, title: `Guide ${g} chapter ${c}`, topicRefs: refs.map(i => `map-${i}-topic-0`) })) })),
  gaps: []
})
const range = (from, to) => Array.from({ length: to - from }, (_, i) => from + i)

test('a guide that expands past its chapter ceiling is corrected with the expansion issues', () => run(async () => {
  const version = await largeBundle(43)
  // Guide 0 plans one chapter whose 42 passages split into 42 parts.
  const overfull = plannedBundle([[range(0, 42)], [[42]]])
  const corrected = plannedBundle([[range(0, 21)], [range(21, 43)]])
  const mock = provider([overfull, corrected], [])
  await processStudyStep(version.id, { generate: mock.generate })
  const rejected = await ownStudyVersion(version.id)
  assert.equal(rejected.draft.stage, 'outline')
  assert.notEqual(rejected.draft.status, 'failed', rejected.draft.error || '')
  const pending = rejected.draft.outlineCorrection
  assert.deepEqual(pending.proposal, overfull)
  assert.equal(pending.correctable, true)
  assert.equal(pending.exhausted, false)
  assert.equal(pending.status, 422)
  assert.equal(pending.issues.length, 1)
  const [issue] = pending.issues
  assert.equal(issue.kind, 'chapter-expansion')
  assert.equal(issue.guideId, 'guide-0')
  assert.equal(issue.count, 42)
  assert.equal(issue.limit, 40)
  assert.equal(issue.excess, 2)
  assert.deepEqual(issue.expandedChapters, [{ topicId: 'guide-0-chapter-0', parts: 42, evidenceCharacters: 42 * PASSAGE }])
  assert.equal(rejected.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)

  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(mock.outlines().length, 2)
  const correction = mock.outlines()[1].prompt
  assert.match(correction, /OUTLINE CORRECTION/)
  assert.match(correction, /"kind":"chapter-expansion"/)
  assert.match(correction, /"parts":42/)
  assert.equal(planned.draft.outlineCorrection, undefined)
  assert.equal(planned.draft.topics.length, 43)
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)
}))

test('a course whose evidence needs about 60 chapters plans across four guides', () => run(async () => {
  const version = await largeBundle(60)
  // Four guides, three planned chapters each, every chapter splitting into five parts.
  const proposal = plannedBundle(range(0, 4).map(g => range(0, 3).map(c => range(g * 15 + c * 5, g * 15 + c * 5 + 5))))
  const mock = provider([proposal], [])
  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(mock.outlines().length, 1)
  assert.equal(planned.draft.topics.length, 60)
  assert.equal(planned.draft.guides.length, 4)
  for (const guide of planned.draft.guides) assert.equal(planned.draft.topics.filter(t => t.guideId === guide.id).length, 15)
  const prompt = mock.outlines()[0].prompt
  assert.match(prompt, /CHAPTER BUDGET \(per guide, not per course\)/)
  assert.match(prompt, /at most 24 chapters IN EACH GUIDE/)
  assert.match(prompt, /at most 40 chapters/)
  assert.match(prompt, /at most 2000 characters of teaching evidence/)
  assert.match(prompt, /Part 2/)
  assert.match(prompt, /needs at least 60 chapters and therefore at least 2 guides/)
  assert.equal(/At most 40 chapters in total/.test(prompt), false)
}))

test('a non-correctable outline failure still persists the paid proposal', () => run(async () => {
  // One passage exceeds the chapter allowance: no regrouping can fix it.
  const version = await largeBundle(2, PASSAGE + 1)
  const proposal = plannedBundle([[[0]], [[1]]])
  const mock = provider([proposal, proposal], [])
  const failed = await plan(version.id, mock.generate)
  assert.equal(failed.draft.status, 'failed')
  assert.equal(failed.draft.stage, 'outline')
  assert.match(failed.draft.error, /exceeds the remaining chapter allowance/)
  assert.deepEqual(failed.draft.outlineCorrection.proposal, proposal)
  assert.equal(failed.draft.outlineCorrection.correctable, false)
  assert.deepEqual(failed.draft.outlineCorrection.issues, [])
  assert.equal(failed.draft.automaticRepairs?.[OUTLINE_CORRECTION_KEY] || 0, 0)
  // A retry behaves as before: a fresh proposal, never a correction of this one.
  await controlStudyGeneration(version.id, 'retry')
  await plan(version.id, mock.generate)
  assert.equal(mock.outlines().length, 2)
  assert.equal(/OUTLINE CORRECTION/.test(mock.outlines()[1].prompt), false)
}))
