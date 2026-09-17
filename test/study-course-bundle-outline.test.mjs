import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, controlStudyGeneration, OUTLINE_CORRECTION_KEY } from '../lib/study-version-pipeline.mjs'
import { startLocalStudy, nextLocalStudy, submitLocalStudy, addLocalStudyNotes } from '../lib/study-local-generation.mjs'
import { resolveOutlineGroups } from '../lib/study-version-content.mjs'
import { resolveCourseBundle } from '../lib/study-course-bundle.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

// A whole-course outline is one expensive call over every accepted source map.
// These tests pin the bounded correction that keeps a single coverage slip from
// discarding that work, with a mocked provider only: no model is called.
const billing = { source: 'platform', model: 'gpt-5-mini', maxJobUsd: 50 }
const PAGE = 'Adding disjoint quantities keeps their matching units. Subtraction checks the result. Ratios compare two totals, and estimates bound the remaining error.'
// Ten concepts under one mapped batch: the last repeats the first concept's
// name, so a correction (or auto-placement) must give both refs the same
// teaching home instead of splitting one concept in two. A gap this small
// (<=3, the deterministic-placement floor) would now be auto-placed, so the
// "still needs a correction" fixtures below deliberately drop more than that.
const MAP_TOPICS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Alpha']
  .map((title, i) => ({ id: i === 9 ? 'alpha-again' : title.toLowerCase(), title }))
const bundle = (first, second) => ({
  guides: [
    { id: 'g1', title: 'Guide one', topics: [{ id: 'chapter-one', title: 'Alpha work', topicRefs: first }] },
    { id: 'g2', title: 'Guide two', topics: [{ id: 'chapter-two', title: 'The rest', topicRefs: second }] }
  ], gaps: []
})
const ref = i => `map-0-topic-${i}`
// Covers all 10 refs, with both Alpha copies (0 and 9) kept in the same guide.
const COMPLETE = bundle([0, 1, 2, 3, 4, 9].map(ref), [5, 6, 7, 8].map(ref))
// Drops 6 of 10 concepts (above the 3-concept placement floor), including the
// second Alpha copy, so it must still reach a correction rather than being
// silently placed.
const OMITS_FIVE = bundle([0, 2].map(ref), [1, 3].map(ref))
// Covers all 10 refs (nothing missing) but splits the two Alpha copies across
// guides, so the only issue is duplicate ownership.
const SPLIT_OWNER = bundle([0, 1, 2, 3, 4].map(ref), [5, 6, 7, 8, 9].map(ref))

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
  const mock = provider([OMITS_FIVE, COMPLETE], ids)
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
  assert.match(correction, /map-0-topic-4/)
  assert.match(correction, /map-0-topic-9/)
  assert.match(correction, /"taughtIn":"chapter-one"/)
  assert.ok(correction.includes(JSON.stringify(OMITS_FIVE)))
  assert.equal(correction.includes('"text"'), false)
  // Accounting: the ledger records the attempt and the pending state is cleared.
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)
  assert.equal(planned.draft.outlineCorrection, undefined)
  const recorded = planned.draft.correctionHistory.filter(row => row.chapterId === OUTLINE_CORRECTION_KEY)
  assert.equal(recorded.length, 1)
  assert.equal(recorded[0].phase, 'course-outline')
  assert.equal(recorded[0].findings.length, 6)
}))

test('two rejected bundle outlines still reach an accepted plan inside the bound', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  const mock = provider([OMITS_FIVE, OMITS_FIVE, COMPLETE], ids)
  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(mock.outlines().length, 3)
  assert.deepEqual(mock.outlines().map(c => c.correctionAttempt), [undefined, 1, 2])
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 2)
  assert.equal(planned.draft.topics.length > 0, true)
}))

test('a third rejected bundle outline fails safely with the maps and the counter intact', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  const mock = provider([OMITS_FIVE, OMITS_FIVE, OMITS_FIVE], ids)
  const failed = await plan(version.id, mock.generate)
  assert.equal(failed.draft.status, 'failed')
  assert.equal(failed.draft.stage, 'outline')
  assert.match(failed.draft.error, /Outline omitted 6 mapped concepts/)
  assert.equal(failed.draft.maps.length, 1)
  assert.equal(failed.draft.maps[0].topics.length, 10)
  assert.equal(mock.outlines().length, 3)
  assert.equal(failed.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 2)
  assert.equal(failed.draft.outlineCorrection.exhausted, true)
  assert.equal(failed.draft.outlineCorrection.maxAttempts, 2)
  assert.deepEqual(failed.draft.outlineCorrection.issues.map(i => i.ref), [4, 5, 6, 7, 8, 9].map(ref))

  // Re-entering an exhausted outline buys nothing: same error, no new call.
  await controlStudyGeneration(version.id, 'retry')
  const again = await plan(version.id, mock.generate)
  assert.equal(again.draft.status, 'failed')
  assert.match(again.draft.error, /Outline omitted 6 mapped concepts/)
  assert.equal(mock.outlines().length, 3)
  assert.equal(again.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 2)
  assert.equal(again.draft.maps.length, 1)
}))

test('resuming an interrupted correction keeps the counter and never remaps', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  const mock = provider([OMITS_FIVE, COMPLETE], ids)
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
  // Six separate mapped batches (one concept each): dropping five of them stays
  // above the deterministic-placement floor, so it still needs a correction.
  await mutateStudyVersion(version.id, next => {
    next.draft.stage = 'outline'
    next.draft.maps = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta']
      .map((title, i) => ({ topics: [{ id: title.toLowerCase(), title, sourceIds: ids }], gaps: [] }))
  })
  const complete = { topics: [{ id: 'chapter-one', title: 'Everything', topicRefs: [0, 1, 2, 3, 4, 5].map(i => `map-${i}-topic-0`) }], gaps: [] }
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
  const outlines = [OMITS_FIVE, COMPLETE]
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
  assert.match(correction.prompt, /map-0-topic-4/)
  assert.equal(correction.status.corrections.outline.corrections, 1)
  assert.equal(correction.status.corrections.outline.exhausted, false)
  assert.deepEqual(correction.status.corrections.outline.issues.map(i => i.kind), Array(6).fill('missing-concept'))
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
  // The correction also respects the automatic 10-chapters-per-guide budget.
  const corrected = plannedBundle([[range(0, 9)], [range(9, 18)], [range(18, 27)], [range(27, 36)], [range(36, 43)]])
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

test('a course whose core evidence needs 60 chapters plans across six guides within the automatic budget', () => run(async () => {
  const version = await largeBundle(60)
  // Six guides, two planned chapters each, every chapter splitting into five parts.
  const proposal = plannedBundle(range(0, 6).map(g => range(0, 2).map(c => range(g * 10 + c * 5, g * 10 + c * 5 + 5))))
  const mock = provider([proposal], [])
  const planned = await plan(version.id, mock.generate)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(mock.outlines().length, 1)
  assert.equal(planned.draft.topics.length, 60)
  assert.equal(planned.draft.guides.length, 6)
  for (const guide of planned.draft.guides) assert.equal(planned.draft.topics.filter(t => t.guideId === guide.id).length, 10)
  const prompt = mock.outlines()[0].prompt
  assert.match(prompt, /AUTOMATIC SCOPE AND CHAPTER POLICY/)
  assert.match(prompt, /at most 60 chapters in total/)
  assert.match(prompt, /each guide should hold 3-10 chapters/)
  assert.match(prompt, /at most 2000 characters of core teaching evidence/)
  assert.match(prompt, /Part 2/)
  assert.match(prompt, /needs at least 60 chapters, so choose at least 6 guides/)
  assert.equal(/at most 24 chapters IN EACH GUIDE/.test(prompt), false)
  assert.equal(planned.draft.planningPolicy, 'scope-roles-v1')
  assert.equal(planned.draft.planning.budget.course, 60)
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

// DETERMINISTIC PLACEMENT. A whole-course outline regenerated over hundreds of
// mapped concepts reliably drops a handful of ids even after a correction, and
// retries rarely fix the same few. Below max(3, 2% of all mapped concepts) a
// missing concept is placed into an existing chapter instead of rejecting an
// otherwise-complete plan. These are pure function tests: no provider call.
function conceptMaps(n) {
  return [{ topics: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, title: `Concept ${i}`, sourceIds: [`e${i}`] })), gaps: [] }]
}
const mref = i => `map-0-topic-${i}`

test('a single missing concept is auto-placed into the chapter with the most refs from its source map', () => {
  const maps = conceptMaps(10)
  const proposal = {
    guides: [
      { id: 'g1', title: 'Guide one', topics: [{ id: 'chapter-one', title: 'Chapter one', topicRefs: [0, 1, 2, 3, 4, 5, 6].map(mref) }] },
      { id: 'g2', title: 'Guide two', topics: [{ id: 'chapter-two', title: 'Chapter two', topicRefs: [7, 8].map(mref) }] }
    ], gaps: []
  }
  // Concept 9 is missing; chapter-one already holds 7 same-map refs vs chapter-two's 2.
  const resolved = resolveCourseBundle(proposal, maps)
  assert.deepEqual(resolved.autoPlaced, [{ ref: mref(9), title: 'Concept 9', guideId: 'g1', chapterId: 'chapter-one', reason: 'same-source-map' }])
  const chapterOne = resolved.topics.find(t => t.id === 'chapter-one')
  assert.ok(chapterOne.sourceIds.includes('e9'))
  assert.ok(chapterOne.concepts.includes('Concept 9'))
  assert.equal(resolved.topics.find(t => t.id === 'chapter-two').sourceIds.includes('e9'), false)
})

test('three missing concepts are all auto-placed into the sibling-rich chapter with recorded reasons', () => {
  const maps = conceptMaps(13)
  const proposal = {
    guides: [
      { id: 'g1', title: 'Guide one', topics: [{ id: 'chapter-one', title: 'Chapter one', topicRefs: [0, 1, 2, 3, 4, 5, 6, 7].map(mref) }] },
      { id: 'g2', title: 'Guide two', topics: [{ id: 'chapter-two', title: 'Chapter two', topicRefs: [8, 9].map(mref) }] }
    ], gaps: []
  }
  // Concepts 10, 11 and 12 are missing, exactly the max(3, 2%) floor for 13
  // concepts; chapter-one holds 8 same-map refs vs chapter-two's 2.
  const resolved = resolveCourseBundle(proposal, maps)
  assert.equal(resolved.autoPlaced.length, 3)
  for (const i of [10, 11, 12]) {
    const entry = resolved.autoPlaced.find(p => p.ref === mref(i))
    assert.deepEqual(entry, { ref: mref(i), title: `Concept ${i}`, guideId: 'g1', chapterId: 'chapter-one', reason: 'same-source-map' })
  }
  const chapterOne = resolved.topics.find(t => t.id === 'chapter-one')
  for (const i of [10, 11, 12]) assert.ok(chapterOne.sourceIds.includes(`e${i}`))
})

test('placement tie-breaking is deterministic: source overlap first, then plan order', () => {
  const proposal = {
    guides: [
      { id: 'g1', title: 'Guide one', topics: [{ id: 'chapter-one', title: 'Chapter one', topicRefs: [0, 1].map(mref) }] },
      { id: 'g2', title: 'Guide two', topics: [{ id: 'chapter-two', title: 'Chapter two', topicRefs: [2, 3].map(mref) }] }
    ], gaps: []
  }
  // Chapters tie at 2 same-map refs each. The missing concept's evidence
  // overlaps chapter-two's sources, so overlap breaks the tie.
  const overlapMaps = [{ topics: [
    { id: 'c0', title: 'Concept 0', sourceIds: ['eA'] }, { id: 'c1', title: 'Concept 1', sourceIds: ['eB'] },
    { id: 'c2', title: 'Concept 2', sourceIds: ['eC'] }, { id: 'c3', title: 'Concept 3', sourceIds: ['eD'] },
    { id: 'c4', title: 'Concept 4', sourceIds: ['eC', 'eX'] }
  ], gaps: [] }]
  const resolvedOverlap = resolveCourseBundle(proposal, overlapMaps)
  assert.deepEqual(resolvedOverlap.autoPlaced, [{ ref: mref(4), title: 'Concept 4', guideId: 'g2', chapterId: 'chapter-two', reason: 'same-source-map' }])

  // Same tie, but every concept shares one identical source id: overlap ties
  // too, so the earliest chapter in plan order (chapter-one) wins.
  const orderMaps = [{ topics: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, title: `Concept ${i}`, sourceIds: ['shared'] })), gaps: [] }]
  const resolvedOrder = resolveCourseBundle(proposal, orderMaps)
  assert.deepEqual(resolvedOrder.autoPlaced, [{ ref: mref(4), title: 'Concept 4', guideId: 'g1', chapterId: 'chapter-one', reason: 'same-source-map' }])
})

test('a gap above the placement threshold still triggers a correction', () => {
  const maps = conceptMaps(100)
  // 96 of 100 assigned; the 4 missing exceed max(3, ceil(100*0.02)) = 3.
  const proposal = {
    guides: [
      { id: 'g1', title: 'Guide one', topics: [{ id: 'chapter-one', title: 'Chapter one', topicRefs: Array.from({ length: 60 }, (_, i) => mref(i)) }] },
      { id: 'g2', title: 'Guide two', topics: [{ id: 'chapter-two', title: 'Chapter two', topicRefs: Array.from({ length: 36 }, (_, i) => mref(60 + i)) }] }
    ], gaps: []
  }
  assert.throws(() => resolveCourseBundle(proposal, maps), /Outline omitted 4 mapped concepts/)
  try { resolveCourseBundle(proposal, maps); assert.fail('expected a rejection') } catch (error) {
    assert.deepEqual(error.outlineIssues.map(i => i.kind), Array(4).fill('missing-concept'))
  }
})

test('an unplaceable missing concept still rejects even under the threshold', () => {
  // The orphan concept comes from its own map, is never referenced by any
  // chapter, and shares no evidence with any assigned chapter: no chapter
  // holds a same-map sibling and none has a source-id overlap either.
  const maps = [
    { topics: [{ id: 'a', title: 'A', sourceIds: ['e0'] }, { id: 'b', title: 'B', sourceIds: ['e1'] }, { id: 'c', title: 'C', sourceIds: ['e2'] }], gaps: [] },
    { topics: [{ id: 'orphan', title: 'Orphan', sourceIds: ['e-orphan'] }], gaps: [] }
  ]
  const proposal = {
    guides: [
      { id: 'g1', title: 'Guide one', topics: [{ id: 'chapter-one', title: 'Chapter one', topicRefs: ['map-0-topic-0'] }] },
      { id: 'g2', title: 'Guide two', topics: [{ id: 'chapter-two', title: 'Chapter two', topicRefs: ['map-0-topic-1', 'map-0-topic-2'] }] }
    ], gaps: []
  }
  assert.throws(() => resolveCourseBundle(proposal, maps), /Outline omitted 1 mapped concepts: map-1-topic-0/)
})

test('single-guide resolveOutlineGroups places a missing concept the same way', () => {
  const maps = conceptMaps(5)
  const proposal = { topics: [
    { id: 'chapter-one', title: 'Chapter one', topicRefs: [0, 1, 2].map(mref) },
    { id: 'chapter-two', title: 'Chapter two', topicRefs: [3].map(mref) }
  ], gaps: [] }
  // Concept 4 is missing; chapter-one holds 3 same-map refs vs chapter-two's 1.
  const resolved = resolveOutlineGroups(proposal, maps)
  assert.deepEqual(resolved.autoPlaced, [{ ref: mref(4), title: 'Concept 4', guideId: null, chapterId: 'chapter-one', reason: 'same-source-map' }])
  const chapterOne = resolved.topics.find(t => t.id === 'chapter-one')
  assert.ok(chapterOne.sourceIds.includes('e4'))
  assert.equal('guideId' in chapterOne, false)
})

// A single map with many topics gives every concept a real same-map sibling
// (unlike largeBundle's one-topic-per-map layout), so a missing concept has
// somewhere deterministic to land; sized to reuse largeBundle's exact
// evidence budget (one 2000-character passage fills one post-split chapter).
async function siblingBundle(passages, passageSize = PASSAGE) {
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
    next.draft.maps = [{ topics: Array.from({ length: passages }, (_, i) => ({ id: `concept-${i}`, title: `Concept ${i}`, sourceIds: [`e-t-${i}`] })), gaps: [] }]
  })
  return version
}

test('placement that breaches a guide chapter cap after splitting still goes to correction', () => run(async () => {
  const version = await siblingBundle(42)
  // Guide 0's chapter already holds 40 same-map refs (its post-split ceiling);
  // concept 41 is missing and has no other candidate chapter.
  const proposal = {
    guides: [
      { id: 'guide-0', title: 'Guide 0', topics: [{ id: 'guide-0-chapter-0', title: 'Guide 0 chapter 0', topicRefs: range(0, 40).map(i => `map-0-topic-${i}`) }] },
      { id: 'guide-1', title: 'Guide 1', topics: [{ id: 'guide-1-chapter-0', title: 'Guide 1 chapter 0', topicRefs: ['map-0-topic-40'] }] }
    ], gaps: []
  }
  const mock = provider([proposal], [])
  await processStudyStep(version.id, { generate: mock.generate })
  const rejected = await ownStudyVersion(version.id)
  assert.equal(rejected.draft.stage, 'outline')
  assert.notEqual(rejected.draft.status, 'failed', rejected.draft.error || '')
  const pending = rejected.draft.outlineCorrection
  assert.equal(pending.correctable, true)
  assert.equal(pending.issues.length, 1)
  const [issue] = pending.issues
  // Placement silently absorbed concept 41 into guide-0's only chapter (its
  // 40 existing same-map siblings beat guide-1's 1), pushing it to 41 parts
  // after evidence-capacity splitting: a correctable ceiling breach, not a
  // missing-concept rejection.
  assert.equal(issue.kind, 'chapter-expansion')
  assert.equal(issue.guideId, 'guide-0')
  assert.equal(issue.count, 41)
  assert.equal(issue.limit, 40)
  assert.equal(issue.excess, 1)
}))

test('an exhausted outline correction with a persisted proposal resumes and is accepted with zero generate calls', () => run(async () => {
  const { version, ids } = await hostedFixture({ courseBundle: true })
  // Simulate a draft that was exhausted before deterministic placement
  // existed (exactly the real production shape): a proposal missing one
  // concept, corrected twice, still rejected, and saved as a failed draft.
  const proposal = {
    guides: [
      { id: 'guide-0', title: 'Guide 0', topics: [{ id: 'guide-0-chapter-0', title: 'Chapter 0', topicRefs: [0, 1, 2, 3, 4, 5, 6, 7].map(mref) }] },
      { id: 'guide-1', title: 'Guide 1', topics: [{ id: 'guide-1-chapter-0', title: 'Chapter 1', topicRefs: [8].map(mref) }] }
    ], gaps: []
  }
  await mutateStudyVersion(version.id, next => {
    next.draft.stage = 'outline'
    next.draft.status = 'failed'
    next.draft.maps = [{ topics: Array.from({ length: 10 }, (_, i) => ({ id: `concept-${i}`, title: `Concept ${i}`, sourceIds: ids })), gaps: [] }]
    next.draft.automaticRepairs = { [OUTLINE_CORRECTION_KEY]: 2 }
    next.draft.outlineCorrection = {
      proposal, issues: [{ severity: 'error', kind: 'missing-concept', ref: mref(9), title: 'Concept 9', taughtIn: null,
        detail: 'Mapped concept map-0-topic-9 is unassigned. Give it a teaching home.' }],
      overflow: 0, correctable: true, error: 'Outline omitted 1 mapped concepts: map-0-topic-9. Consolidate their teaching without dropping coverage.',
      status: 502, exhausted: true, maxAttempts: 2, at: new Date().toISOString(), corrections: 2
    }
  })
  await controlStudyGeneration(version.id, 'retry')
  const mock = provider([], ids)
  await processStudyStep(version.id, { generate: mock.generate })
  const planned = await ownStudyVersion(version.id)
  // Zero-cost resume: the saved proposal now passes under current rules
  // (concept 9 is placed into guide-0's sibling-rich chapter), so it is
  // accepted without buying a fresh proposal or resetting the ledger.
  assert.equal(mock.calls.length, 0)
  assert.equal(planned.draft.stage, 'chapters', planned.draft.error || '')
  assert.equal(planned.draft.outlineCorrection, undefined)
  assert.equal(planned.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 2)
  assert.equal(planned.draft.guides.length, 2)
  assert.deepEqual(planned.draft.planning.autoPlaced, [{ ref: mref(9), title: 'Concept 9', guideId: 'guide-0', chapterId: 'guide-0-chapter-0', reason: 'same-source-map' }])
}))
