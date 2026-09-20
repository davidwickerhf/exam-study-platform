// Capacity ceilings, not length targets. Reasoning tokens share provider output budgets.
// A healthy checkpoint on the measured course pilots takes 20-150s, with the
// slowest whole-chapter draft near 300s. STUDY_CALL_DEADLINE_MS overrides the
// per-call deadline; it is deliberately well under providerTimeoutMs so one
// stalled call cannot hold a reservation for a quarter of an hour.
const configuredCallDeadline = Number(process.env.STUDY_CALL_DEADLINE_MS)
export const STUDY_GENERATION_LIMITS = Object.freeze({
  providerTimeoutMs: 600000,
  callDeadlineMs: Number.isFinite(configuredCallDeadline) && configuredCallDeadline > 0 ? configuredCallDeadline : 420000,
  workerLeaseMs: 750000,
  chapterTokens: 64000,
  planTokens: 24000,
  correctionTokens: 32000,
  reviewTokens: 32000,
  pedagogicalReviewTokens: 64000,
  defaultJobUsd: 10,
  maxJobUsd: 50,
})
