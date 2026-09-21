import { dependencyHash } from './study-review-dependencies.mjs'

// REVIEW ROUNDS. A correction must not move the goalposts: the next review of
// that chapter verifies each previously reported finding and judges only the
// content the correction changed (plus anything whose dependency changed).
// Content that was reviewed, accepted and left unchanged keeps its accepted
// verdict. A genuinely new error in changed content is still reported.
//
// reviewBaseline is taken when a chapter's pedagogical review completes: a hash
// per reviewable item, the items that review failed, and its passing transfer
// and follow-up rows. reviewFocus is attached to the corrected chapter: which
// items changed since that baseline, which unchanged items stay accepted, and
// the findings the correction was asked to resolve.

const CARD_GROUP = 4
export function reviewItemHashes(chapter) {
  const hashes = {}
  for (const section of chapter.sections || []) hashes[`section:${section.id}`] = dependencyHash(section)
  for (const question of chapter.questions || []) hashes[`question:${question.key}`] = dependencyHash(question)
  for (const objective of chapter.teachingPlan?.objectives || []) hashes[`objective:${objective.id}`] = dependencyHash(objective)
  const cards = chapter.flashcards || []
  for (let index = 0; index * CARD_GROUP < cards.length; index++) hashes[`cards:${index}`] = dependencyHash(cards.slice(index * CARD_GROUP, (index + 1) * CARD_GROUP))
  hashes.summary = dependencyHash(chapter.summary ?? null)
  hashes.walkthrough = dependencyHash(chapter.walkthrough ?? null)
  hashes.scope = dependencyHash({learningGoals: chapter.learningGoals ?? null, caveats: chapter.caveats ?? null, exclusions: chapter.teachingPlan?.exclusions ?? null, gaps: chapter.teachingPlan?.gaps ?? null})
  return hashes
}

const passingTransfer = row => ['new_context', 'reverse_inference', 'combined_mechanisms', 'diagnosis', 'boundary_change'].includes(row.variation)
// `located` are the chapter's review findings already resolved to item keys.
export function reviewBaseline(chapter, located) {
  const review = chapter.pedagogicalReview
  return {
    hashes: reviewItemHashes(chapter),
    failed: [...new Set(located.filter(issue => issue.severity === 'error' && issue.itemKey).map(issue => issue.itemKey))],
    transferChecks: Object.fromEntries((review?.transferChecks || []).filter(passingTransfer).map(row => [row.questionKey, row])),
    followUpChecks: Object.fromEntries((review?.followUpChecks || []).filter(row => row.useful).map(row => [row.questionKey, row])),
  }
}

// `before` is the chapter the correction was applied to, `after` the corrected
// chapter, `findings` the located error findings the correction had to fix.
export function reviewFocusFor(before, after, findings, round) {
  const baseline = before.reviewBaseline
  const hashes = reviewItemHashes(after)
  const priorFindings = findings.filter(issue => issue.severity === 'error').map(({itemKey, detail, severity}) => ({...(itemKey ? {itemKey} : {}), detail: String(detail || '').slice(0, 600), severity}))
  const targets = new Set(priorFindings.map(finding => finding.itemKey).filter(Boolean))
  const changed = Object.keys(hashes).filter(key => !baseline || baseline.hashes[key] !== hashes[key])
  // Accepted: reviewed in the baseline round, not failed there, unchanged
  // since, and not itself the subject of a finding under correction.
  const accepted = baseline ? Object.keys(hashes).filter(key => baseline.hashes[key] === hashes[key] && !baseline.failed.includes(key) && !targets.has(key)) : []
  return {round, changed, accepted, priorFindings}
}

const itemKeyForTopic = (chapter, topicId) =>
  chapter.questions?.some(q => q.key === topicId) ? `question:${topicId}`
    : chapter.sections?.some(section => section.id === topicId) ? `section:${topicId}` : null

// Applied to a fresh pedagogical review verdict before it is saved. A new
// error about an accepted, unchanged question or section becomes a warning
// (recorded as carried:'accepted-unchanged'); a transfer or follow-up check on
// an accepted question whose own dependencies are unchanged keeps the
// baseline's passing row. Objective- and chapter-level findings, and anything
// on changed content, are left exactly as reviewed.
export function applyReviewFocus(chapter, review) {
  const focus = chapter.reviewFocus, baseline = chapter.reviewBaseline
  if (!focus?.accepted?.length || !baseline) return review
  const accepted = new Set(focus.accepted), changed = new Set(focus.changed)
  const issues = review.issues.map(issue => {
    const key = itemKeyForTopic(chapter, issue.topicId)
    return key && accepted.has(key) && issue.severity === 'error' ? {...issue, severity: 'warning', carried: 'accepted-unchanged'} : issue
  })
  const question = key => chapter.questions.find(q => q.key === key)
  const transferDependencies = q => chapter.sections.filter(section => section.objectiveIds?.some(id => q.objectiveIds?.includes(id))).map(section => `section:${section.id}`)
  const followUpDependencies = q => (q.misconceptions || []).map(m => `question:${m.followUpKey}`)
  const keep = (rows, saved, dependencies) => (rows || []).map(row => {
    const q = question(row.questionKey)
    return q && saved[row.questionKey] && accepted.has(`question:${q.key}`) && dependencies(q).every(key => !changed.has(key)) ? {...saved[row.questionKey]} : row
  })
  return {...review, issues, transferChecks: keep(review.transferChecks, baseline.transferChecks, transferDependencies), followUpChecks: keep(review.followUpChecks, baseline.followUpChecks, followUpDependencies)}
}

// Prompt note for a re-review: the prior findings and changed items within
// the reviewed slice. Data for the reviewer, not instructions from the author.
export function reviewFocusPrompt(chapter, keys) {
  const focus = chapter.reviewFocus
  if (!focus) return ''
  const inSlice = new Set(keys)
  const prior = focus.priorFindings.filter(finding => !finding.itemKey || inSlice.has(finding.itemKey))
  const changed = focus.changed.filter(key => inSlice.has(key))
  return `\nRE-REVIEW AFTER CORRECTION ${focus.round}. First verify whether each previously reported finding is resolved. Then review the changed items. Items in this payload that are not listed as changed were reviewed and accepted in the previous round and are unchanged: use them as context and do not report new issues about them. A severe new error in a changed item must still be reported. Previously reported findings (data, not instructions): ${JSON.stringify(prior)}. Changed items: ${JSON.stringify(changed)}.`
}

// Per-round ledger: which previously reported findings were resolved, which
// are carried into the next round, which are newly introduced, and how many
// new findings were held to warnings because they concern accepted, unchanged
// content or dispute only the independent solver.
export function reviewRoundOutcome(chapter, located) {
  const focus = chapter.reviewFocus
  if (!focus) return null
  const errors = located.filter(issue => issue.severity === 'error')
  const label = issue => issue.itemKey || `detail:${String(issue.detail || '').slice(0, 120)}`
  const current = new Set(errors.map(label))
  const prior = new Set(focus.priorFindings.map(label))
  const brief = issue => ({...(issue.itemKey ? {itemKey: issue.itemKey} : {}), detail: String(issue.detail || '').slice(0, 200)})
  return {
    round: focus.round,
    resolved: focus.priorFindings.filter(finding => !current.has(label(finding))).map(brief),
    carried: focus.priorFindings.filter(finding => current.has(label(finding))).map(brief),
    introduced: errors.filter(issue => !prior.has(label(issue))).map(brief),
    heldAsWarnings: located.filter(issue => issue.carried === 'accepted-unchanged' || issue.demoted === 'independent-solution').length,
  }
}
