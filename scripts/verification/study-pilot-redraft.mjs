// Rewind one failed pilot chapter to its already-validated teaching plan. This
// is only for controlled model A/B runs: mapping, outline and plan evidence are
// retained, while every artifact produced after authoring began is removed.
export function redraftPilotChapter(draft, chapterId, { maxCorrections } = {}) {
  if (!draft?.topics?.some((topic) => topic.id === chapterId))
    throw new Error(`Cannot redraft an unknown pilot chapter: ${chapterId}`)
  if (!draft.teachingPlans?.[chapterId])
    throw new Error(`Cannot redraft a pilot chapter without a checked teaching plan: ${chapterId}`)
  const existing = draft.chapters?.find((chapter) => chapter.id === chapterId)
  if (existing?.review === 'passed')
    throw new Error(`Cannot redraft a passing pilot chapter: ${chapterId}`)

  const next = structuredClone(draft)
  if (maxCorrections !== undefined) {
    if (!Number.isInteger(maxCorrections) || maxCorrections < 0 || maxCorrections > 5)
      throw new Error('Pilot redraft correction limit must be an integer from 0 to 5.')
    next.correctionPolicy = { ...next.correctionPolicy, maxAttempts: maxCorrections }
  }
  next.chapters = (next.chapters || []).filter((chapter) => chapter.id !== chapterId)
  next.issues = (next.issues || []).filter((issue) => issue.topicId !== chapterId)
  for (const key of ['correctionHistory', 'correctionScopes', 'correctionTrials', 'mergeValidations', 'reviewRounds', 'precheckLog'])
    if (next[key]) next[key] = next[key].filter((row) => row.chapterId !== chapterId)
  for (const key of ['automaticRepairs', 'manualRepairs', 'pendingTrialBases', 'pedagogicalPrechecks'])
    if (next[key]) delete next[key][chapterId]
  if (next.repair?.topicId === chapterId) delete next.repair
  delete next.reviewOnly
  delete next.localRequest
  delete next.error
  next.stage = 'chapters'
  next.runAfter = 0
  next.lease = null
  return next
}
