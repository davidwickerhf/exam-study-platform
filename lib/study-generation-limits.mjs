// Capacity ceilings, not length targets. Reasoning tokens share provider output budgets.
export const STUDY_GENERATION_LIMITS = Object.freeze({
  providerTimeoutMs: 600000,
  workerLeaseMs: 750000,
  chapterTokens: 64000,
  planTokens: 24000,
  correctionTokens: 32000,
  reviewTokens: 32000,
  pedagogicalReviewTokens: 64000,
  defaultJobUsd: 10,
  maxJobUsd: 50,
  // Source-mapping batches are independent, so they may run together. This is a
  // latency setting only: every call still reserves and settles on its own and
  // cost is per token, so a wider pool never changes what a run spends.
  mappingConcurrency: 4,
  maxMappingConcurrency: 8,
})
