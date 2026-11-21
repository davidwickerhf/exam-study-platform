import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, normalizeStudyOutline, studyOutlineCapacity, OUTLINE_CORRECTION_KEY } from '../lib/study-version-pipeline.mjs'
import { resolveCourseBundle, courseBundlePrompt } from '../lib/study-course-bundle.mjs'
import { courseBundlePolicy, outlinePlanningStale, assertBundleChapterShape, COURSE_BUNDLE_PLANNING_POLICY } from '../lib/study-course-scope-policy.mjs'
import { pilotPlanReady } from '../scripts/verification/study-pilot-planning.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

// AUTOMATIC SCOPE ROLES AND CHAPTER BUDGET for whole-course bundles. Mocked
// provider and synthetic evidence only: no model is called.
const ref = i => `map-0-topic-${i}`
const text = (n, c = 'x') => c.repeat(n)
// A current lecture, a current Unity code file, an older-edition lecture and the
// current course manual (shared scope context).
function courseSnapshot(codeSize = 8000) {
  return {
    sources: [
      { key: 'lecture', title: 'Lecture 1.pdf', sourcePath: 'Lectures/Lecture 1.pdf', academicYear: course.academicYear },
      { key: 'code', title: 'Main.cs', sourcePath: 'Project/Assets/Main.cs', academicYear: course.academicYear },
      { key: 'old', title: 'Old lecture.pdf', sourcePath: 'Archive/Old lecture.pdf', academicYear: '2024-2025', historical: true },
      { key: 'manual', title: 'Course manual', sourcePath: 'Course manual.pdf', academicYear: course.academicYear }
    ],
    chunks: [
      { id: 'l0', sourceKey: 'lecture', text: text(30000) }, { id: 'l1', sourceKey: 'lecture', text: text(30000) }, { id: 'l2', sourceKey: 'lecture', text: text(30000) },
      { id: 'c0', sourceKey: 'code', text: text(codeSize) }, { id: 'c1', sourceKey: 'code', text: text(40000) },
      { id: 'o0', sourceKey: 'old', text: text(20000) }, { id: 'o1', sourceKey: 'old', text: text(20000) },
      { id: 's0', sourceKey: 'manual', text: text(1000, 's') }
    ]
  }
}
const MAPS = [{ topics: [
  { id: 'adaptive', title: 'Adaptive interfaces', sourceIds: ['l0', 'l1', 'o0'] },
  { id: 'unity', title: 'Unity scene setup', sourceIds: ['c0', 'c1'] },
  { id: 'rubric', title: 'Legacy grading rubric', sourceIds: ['o1'] },
  { id: 'mixed', title: 'Mixed-initiative design', sourceIds: ['l2'] }
], gaps: [] }]
const policyFor = snapshot => courseBundlePolicy(snapshot, course, MAPS, studyOutlineCapacity(snapshot, course, { bundle: true }))
const CITED = { topicRefs: [ref(2)], reason: 'The current course manual assesses the 2026 rubric only.', scopeSourceIds: ['s0'] }
const proposal = ({ excluded = [CITED], mixed = [ref(3)] } = {}) => ({
  guides: [
    { id: 'adaptive-guide', title: 'Adaptive UIs', topics: [{ id: 'adaptive', title: 'Adaptive interfaces', role: 'core', topicRefs: [ref(0)], supportingRefs: [ref(1)] }] },
    { id: 'mixed-guide', title: 'Mixed initiative', topics: [{ id: 'mixed', title: 'Mixed-initiative design', role: 'core', topicRefs: mixed, supportingRefs: [] }] }
  ], excluded, gaps: []
})
const rejection = fn => { try { fn() } catch (error) { return error } assert.fail('expected a correctable rejection') }

test('the chapter budget is derived from core evidence only and stated in the prompt', () => {
  const policy = policyFor(courseSnapshot())
  assert.equal(policy.version, COURSE_BUNDLE_PLANNING_POLICY)
  // Current lecture evidence for current concepts plus historical lecture evidence
  // for the historical-only concept; code is excluded from the budget.
  assert.equal(policy.coreTeachingCharacters, 110000)
  assert.equal(policy.practicalCharacters, 48000)
  assert.deepEqual(policy.evidenceClasses, { current: [ref(0), ref(3)], 'historical-only': [ref(2)], 'practical-only': [ref(1)], 'scope-only': [] })
  assert.equal(policy.courseChapterBudget, 6)
  assert.equal(policy.guideChapterMax, 10)
  // Ten times more code does not change the budget.
  assert.equal(policyFor(courseSnapshot(400000)).courseChapterBudget, 6)
  const noisyMaps=structuredClone(MAPS)
  noisyMaps[0].gaps=['VERBOSE-SAVED-MAPPER-GAP '.repeat(40)]
  const prompt = courseBundlePrompt(course, noisyMaps, null, studyOutlineCapacity(courseSnapshot(), course, { bundle: true }), policy)
  assert.match(prompt, /AUTOMATIC SCOPE AND CHAPTER POLICY/)
  assert.match(prompt, /at most 6 chapters in total/)
  assert.match(prompt, /derived from 110000 characters of core teaching evidence/)
  assert.match(prompt, /the 48000 characters of code, archives and datasets are excluded/)
  assert.match(prompt, /excluded:\[\{topicRefs,reason,scopeSourceIds\}\]/)
  // The compact per-concept core-evidence size list, and the instruction that
  // numbered parts are a fallback, not a plan.
  assert.match(prompt, /CORE EVIDENCE SIZE PER CONCEPT/)
  assert.match(prompt, new RegExp(`${ref(0)}:60000`))
  assert.match(prompt, new RegExp(`${ref(1)}:0`))
  assert.match(prompt, /will be sent back for correction/)
  assert.match(prompt, /not numbered parts/)
  const mapped=JSON.parse(prompt.split('Mapped concepts: ')[1].split('\nSource gaps:')[0])
  assert.deepEqual(Object.keys(mapped[0]).sort(),['id','ref','title'])
  assert.doesNotMatch(prompt,/"evidenceSizes"|"scopeEvidenceIds"|VERBOSE-SAVED-MAPPER-GAP/)
  assert.ok(resolveCourseBundle(proposal(),noisyMaps,policy).gaps.some(gap=>gap.includes('VERBOSE-SAVED-MAPPER-GAP')),'the resolver restores gaps omitted from the prompt')
})

test('a cited exclusion counts as covered and is reported as a scope note', () => {
  const policy = policyFor(courseSnapshot())
  const result = resolveCourseBundle(proposal(), MAPS, policy)
  assert.deepEqual(result.excluded, [{ ref: ref(2), title: 'Legacy grading rubric', reason: CITED.reason, scopeSourceIds: ['s0'] }])
  assert.ok(result.gaps.some(gap => /^Scope note: “Legacy grading rubric” is not taught/.test(gap)))
  assert.deepEqual(result.topics[0].conceptEvidence.map(c => [c.title, c.role]), [['Adaptive interfaces', 'core'], ['Unity scene setup', 'supporting']])
  assert.equal(result.autoPlaced.length, 0)
})

test('an uncited exclusion, or one citing code, is a correctable issue', () => {
  const policy = policyFor(courseSnapshot())
  const uncited = rejection(() => resolveCourseBundle(proposal({ excluded: [{ ...CITED, scopeSourceIds: [] }] }), MAPS, policy))
  assert.equal(uncited.status, 422)
  assert.deepEqual(uncited.outlineIssues.map(i => i.kind), ['unjustified-exclusion'])
  const code = rejection(() => resolveCourseBundle(proposal({ excluded: [{ ...CITED, scopeSourceIds: ['c0'] }] }), MAPS, policy))
  assert.deepEqual(code.outlineIssues[0].uncitedSourceIds, ['c0'])
})

test('an exclusion share above the limit is a correctable issue', () => {
  const policy = policyFor(courseSnapshot())
  const excessive = { ...proposal({ excluded: [{ ...CITED, topicRefs: [ref(1), ref(2)] }] }) }
  excessive.guides[0].topics[0].supportingRefs = []
  const error = rejection(() => resolveCourseBundle(excessive, MAPS, policy))
  const issue = error.outlineIssues.find(i => i.kind === 'excessive-exclusion')
  assert.equal(issue.count, 2)
  assert.equal(issue.limit, 1)
})

test('a concept that is both excluded and taught is rejected', () => {
  const error = rejection(() => resolveCourseBundle(proposal({ mixed: [ref(3), ref(2)] }), MAPS, policyFor(courseSnapshot())))
  assert.deepEqual(error.outlineIssues.map(i => [i.kind, i.ref, i.taughtIn]), [['excluded-concept-taught', ref(2), 'mixed-guide']])
})

test('supporting code and duplicate historical evidence no longer cause part splits; the trim is recorded', () => {
  const snapshot = courseSnapshot(), policy = policyFor(snapshot)
  const resolved = resolveCourseBundle(proposal(), MAPS, policy)
  // Without the policy the chapter's 128000 characters split into two parts.
  assert.equal(normalizeStudyOutline(resolved, snapshot, [], course).topics.filter(t => t.guideId === 'adaptive-guide').length, 2)
  const outline = normalizeStudyOutline(resolved, snapshot, [], course, policy)
  const adaptive = outline.topics.filter(t => t.guideId === 'adaptive-guide')
  assert.equal(adaptive.length, 1)
  assert.equal(adaptive[0].title, 'Adaptive interfaces')
  // Core lecture evidence is kept whole; the practical-only concept keeps its first
  // passage; the rest is trimmed by relevance and recorded.
  assert.deepEqual(adaptive[0].sourceIds, ['l0', 'l1', 'c0'])
  assert.deepEqual(outline.evidenceTrims, [{ topicId: 'adaptive', guideId: 'adaptive-guide', trimmedSourceIds: ['o0', 'c1'], trimmedCharacters: 60000,
    conceptsWithoutEvidence: [], reason: outline.evidenceTrims[0].reason }])
})

// Pipeline fixtures: a shared 70000-character course manual leaves 2000
// characters per chapter, so each 2000-character passage fills one chapter.
const billing = { source: 'platform', model: 'gpt-5-mini', maxJobUsd: 50 }
const PAGE = 'Adding disjoint quantities keeps their matching units. Subtraction checks the result.'
const run = fn => withRequestContext({ userId: `scope-${randomUUID()}`, mode: 'local' }, async () => {
  try { await fn() } finally { await deleteAllDocuments() }
})
async function bundleVersion(passages) {
  const notes = await addStudyNote({ ...course, title: 'Course notes' }, [{ page: 1, text: PAGE }])
  const manual = await addStudyNote({ ...course, title: 'Course manual' }, [{ page: 1, text: PAGE }])
  const snapshot = await readStudySourceSnapshot(course, [notes.id, manual.id], { courseBundle: true })
  const version = await createStudyVersion(course, 'programme-test', snapshot, { courseBundle: true, billing, title: 'Whole course plan' })
  await mutateStudyVersion(version.id, next => {
    const scopeKey = next.draft.snapshot.sources.find(s => s.title === 'Course manual').key
    const key = next.draft.snapshot.sources.find(s => s.key !== scopeKey).key
    next.draft.snapshot.chunks = [{ id: 'e-scope', sourceKey: scopeKey, text: text(70000, 's') },
      ...Array.from({ length: passages }, (_, i) => ({ id: `e-t-${i}`, sourceKey: key, text: text(2000) }))]
    next.draft.stage = 'outline'
    next.draft.maps = Array.from({ length: passages }, (_, i) => ({ topics: [{ id: `concept-${i}`, title: `Concept ${i}`, sourceIds: [`e-t-${i}`] }], gaps: [] }))
  })
  return version
}
const planned = counts => {
  let next = 0
  return { guides: counts.map((n, g) => ({ id: `guide-${g}`, title: `Guide ${g}`,
    topics: Array.from({ length: n }, (_, c) => ({ id: `guide-${g}-chapter-${c}`, title: `Guide ${g} chapter ${c}`, topicRefs: [`map-${next++}-topic-0`] })) })), gaps: [] }
}
function provider(outlines) {
  const calls = []
  return { calls, generate: async (prompt, options) => {
    const phase = options.usageMetadata?.phase || null
    calls.push({ phase, prompt })
    if (phase !== 'course-outline' || !outlines.length) throw new Error(`unexpected ${phase} call`)
    return outlines.shift()
  } }
}

test('a chapter budget breach goes through the bounded outline correction', () => run(async () => {
  const version = await bundleVersion(12)
  const mock = provider([planned([11, 1]), planned([6, 6])])
  await processStudyStep(version.id, { generate: mock.generate })
  const rejected = await ownStudyVersion(version.id)
  assert.equal(rejected.draft.stage, 'outline')
  assert.notEqual(rejected.draft.status, 'failed', rejected.draft.error || '')
  assert.deepEqual(rejected.draft.outlineCorrection.issues.map(i => [i.kind, i.guideId, i.count, i.limit]), [['guide-chapter-budget', 'guide-0', 11, 10]])
  assert.equal(rejected.draft.automaticRepairs[OUTLINE_CORRECTION_KEY], 1)
  await processStudyStep(version.id, { generate: mock.generate })
  const accepted = await ownStudyVersion(version.id)
  assert.equal(accepted.draft.stage, 'chapters', accepted.draft.error || '')
  assert.match(mock.calls[1].prompt, /"kind":"guide-chapter-budget"/)
  assert.equal(accepted.draft.planningPolicy, COURSE_BUNDLE_PLANNING_POLICY)
  assert.equal(accepted.draft.planningBudget.course, 15)
  assert.deepEqual(accepted.draft.scopeExclusions, [])
}))

test('a stale planned draft with no authored chapters replans from its saved maps', () => run(async () => {
  const version = await bundleVersion(6)
  await mutateStudyVersion(version.id, next => {
    Object.assign(next.draft, { stage: 'chapters', guides: [{ id: 'old-a', title: 'Old A' }, { id: 'old-b', title: 'Old B' }],
      topics: Array.from({ length: 6 }, (_, i) => ({ id: `old-${i}`, title: `Old ${i}`, guideId: i < 3 ? 'old-a' : 'old-b', sourceIds: [`e-t-${i}`] })),
      planning: { plannedChapters: 6, baselineReviewTasks: 24 }, automaticRepairs: { [OUTLINE_CORRECTION_KEY]: 2, 'other-chapter': 1 },
      correctionHistory: [{ chapterId: OUTLINE_CORRECTION_KEY, kind: 'automatic', attempt: 2 }] })
  })
  const before = await ownStudyVersion(version.id)
  assert.equal(outlinePlanningStale(before.draft), true)
  assert.equal(pilotPlanReady(before.draft), false)
  // Authored work or saved teaching plans are never replanned.
  assert.equal(outlinePlanningStale({ ...before.draft, chapters: [{ id: 'old-0' }] }), false)
  assert.equal(outlinePlanningStale({ ...before.draft, teachingPlans: { 'old-0': {} } }), false)
  const mock = provider([planned([3, 3])])
  await processStudyStep(version.id, { generate: mock.generate })
  const after = await ownStudyVersion(version.id)
  assert.equal(after.draft.stage, 'chapters', after.draft.error || '')
  assert.deepEqual(mock.calls.map(c => c.phase), ['course-outline'])
  assert.deepEqual(after.draft.maps, before.draft.maps)
  assert.deepEqual(after.draft.guides.map(g => g.id), ['guide-0', 'guide-1'])
  assert.equal(after.draft.planningPolicy, COURSE_BUNDLE_PLANNING_POLICY)
  assert.deepEqual(after.draft.automaticRepairs, { 'other-chapter': 1 })
  assert.deepEqual(after.draft.correctionHistory, before.draft.correctionHistory)
  assert.equal(after.draft.replannedOutlines.length, 1)
  assert.equal(after.draft.replannedOutlines[0].chapters, 6)
  assert.equal(after.draft.replannedOutlines[0].outlineCorrections, 2)
  assert.equal(outlinePlanningStale(after.draft), false)
  assert.equal(pilotPlanReady(after.draft), true)
}))

// PLANNED CHAPTER SHAPE. Aggregate budgets can pass while a bundle still has
// almost no real chapter structure: one giant per-guide topic that the split
// then explodes into a wall of "· Part N" chapters. assertBundleChapterShape
// catches that shape before/alongside the aggregate checks.
const shapePolicy = { availableChapterCharacters: 3000, guideChapterMin: 3, guideChapterMax: 10 }

test('a planned chapter needing more than a 2-part fallback is a correctable oversized-chapter issue', () => {
  const expansion = [{ topicId: 't1', title: 'Giant topic', guideId: 'g1', parts: 3, evidenceCharacters: 9000 }]
  const guides = [{ id: 'g1', title: 'Guide one' }]
  const error = rejection(() => assertBundleChapterShape(expansion, guides, shapePolicy))
  assert.equal(error.status, 422)
  const oversized = error.outlineIssues.find(i => i.kind === 'oversized-chapter')
  assert.deepEqual(oversized, {
    severity: 'error', kind: 'oversized-chapter', guideId: 'g1', guideTitle: 'Guide one', topicId: 't1', topicTitle: 'Giant topic',
    coreCharacters: 9000, charactersPerChapter: 3000, minimumChapters: 3, detail: oversized.detail
  })
  // The same guide also under-plans overall: one chapter cannot hold evidence
  // that needs three, so a shortfall is reported alongside it.
  assert.ok(error.outlineIssues.some(i => i.kind === 'guide-chapter-shortfall'))
})

test('a 2-part fallback split is not an oversized-chapter issue', () => {
  const expansion = [
    { topicId: 't1', title: 'Two-part topic', guideId: 'g1', parts: 2, evidenceCharacters: 6000 },
    { topicId: 't2', title: 'Padding topic', guideId: 'g1', parts: 1, evidenceCharacters: 0 }
  ]
  const guides = [{ id: 'g1', title: 'Guide one' }]
  assert.doesNotThrow(() => assertBundleChapterShape(expansion, guides, shapePolicy))
})

test('a guide planning too few chapters for its core evidence is a correctable guide-chapter-shortfall issue', () => {
  const expansion = [{ topicId: 't1', title: 'Chapter one', guideId: 'g1', parts: 1, evidenceCharacters: 9000 }]
  const guides = [{ id: 'g1', title: 'Guide one' }]
  const error = rejection(() => assertBundleChapterShape(expansion, guides, shapePolicy))
  assert.deepEqual(error.outlineIssues.map(i => i.kind), ['guide-chapter-shortfall'])
  assert.deepEqual(error.outlineIssues[0], {
    severity: 'error', kind: 'guide-chapter-shortfall', guideId: 'g1', guideTitle: 'Guide one', plannedChapters: 1, requiredChapters: 3,
    guideCoreCharacters: 9000, charactersPerChapter: 3000, detail: error.outlineIssues[0].detail
  })
})

test('a draft planned under the superseded scope-roles-v1 policy is stale under v2', () => {
  const base = { guides: [{ id: 'g' }], topics: [{ id: 't' }], stage: 'chapters', chapters: [] }
  assert.equal(outlinePlanningStale({ ...base, planningPolicy: 'scope-roles-v1' }), true)
  assert.equal(outlinePlanningStale({ ...base, planningPolicy: COURSE_BUNDLE_PLANNING_POLICY }), false)
})

test('a single giant topic per guide is corrected into distinct chapters', () => run(async () => {
  const version = await bundleVersion(10)
  // Guide 0 plans one giant chapter for 9 of the 10 concepts; guide 1 plans
  // the remaining one. Exactly the production shape: a bundle proposal that
  // technically covers every concept but has no real per-chapter structure.
  const giant = {
    guides: [
      { id: 'guide-0', title: 'Guide 0', topics: [{ id: 'guide-0-chapter-0', title: 'Guide 0 chapter 0', topicRefs: Array.from({ length: 9 }, (_, i) => `map-${i}-topic-0`) }] },
      { id: 'guide-1', title: 'Guide 1', topics: [{ id: 'guide-1-chapter-0', title: 'Guide 1 chapter 0', topicRefs: ['map-9-topic-0'] }] }
    ], gaps: []
  }
  const corrected = planned([9, 1])
  const mock = provider([giant, corrected])
  await processStudyStep(version.id, { generate: mock.generate })
  const rejected = await ownStudyVersion(version.id)
  assert.equal(rejected.draft.stage, 'outline')
  assert.notEqual(rejected.draft.status, 'failed', rejected.draft.error || '')
  const kinds = rejected.draft.outlineCorrection.issues.map(i => i.kind).sort()
  assert.deepEqual(kinds, ['guide-chapter-shortfall', 'oversized-chapter'])
  const oversized = rejected.draft.outlineCorrection.issues.find(i => i.kind === 'oversized-chapter')
  assert.equal(oversized.guideId, 'guide-0')
  assert.equal(oversized.minimumChapters, 9)
  const shortfall = rejected.draft.outlineCorrection.issues.find(i => i.kind === 'guide-chapter-shortfall')
  assert.equal(shortfall.guideId, 'guide-0')
  assert.equal(shortfall.plannedChapters, 1)
  assert.equal(shortfall.requiredChapters, 9)

  await processStudyStep(version.id, { generate: mock.generate })
  const accepted = await ownStudyVersion(version.id)
  assert.equal(accepted.draft.stage, 'chapters', accepted.draft.error || '')
  assert.equal(accepted.draft.topics.length, 10)
  // The corrected plan needed no part splits at all.
  assert.equal(accepted.draft.topics.every(t => !t.title.includes('Part')), true)
}))
