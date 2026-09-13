// Capacity ceilings, not length targets. Reasoning tokens share provider output budgets.
export const STUDY_GENERATION_LIMITS = Object.freeze({
  chapterTokens: 64000,
  planTokens: 24000,
  correctionTokens: 32000,
  reviewTokens: 16000,
  defaultJobUsd: 5,
})
