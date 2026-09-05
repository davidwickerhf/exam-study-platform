# Tutor reply recovery

The reported production conversation ended with source lookups and no visible answer. Its persisted messages include two tool-calling rounds followed by no final assistant message. The prior loop could consume its remaining rounds on empty model completions, then return a successful turn. The endpoint ignored `exhausted` and saved it.

Tutor now uses the configured low reasoning effort (the shared conversation path previously omitted it), an 8192-token completion allowance, and one reserved tools-disabled final answer pass. Empty, truncated, or tool-only final results raise an error instead of saving a silent success. Reasoning tokens share the output allowance with visible text; see [OpenAI reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning). The historical response finish reasons were not persisted, so output-budget exhaustion is a plausible contributing cause, not a measured fact about those old calls.

Latency changes:
- Broad briefing is retrieved only when requested by the model, rather than fetched before the model and then again as a tool.
- Independent read tools overlap; proposals retain execution order.
- Repeated reads share a result within the current turn only.
- All obligations, verification statuses and conflicts are retained; repeated citation IDs and excerpts are compacted for the model while full evidence remains available to the UI.
- A 180-second whole-turn deadline includes context, model and tool waits. The client times out at 190 seconds and supports Stop. Disconnected/timed-out turns are checked before saving.

Existing unanswered conversations expose Retry reply, including legacy turns with tool-call narration but no final answer. Tool-call narration is excluded from visible history. The server replaces only the last unanswered question, checks that its content still matches, and preserves the prior conversation if generation fails. Switching threads or starting a new one cancels and fences an in-flight reply.

Validation: `npm run verify` passed typecheck, 612 tests, and production build. Regression tests cover empty/truncated completions, final-answer reservation, cancellation, ordered parallel reads, per-turn caching, citation compaction and safe retry replacement. T3 local browser checks use controlled model responses with the real server/API: an old unanswered question recovers to exactly one question and one answer; persistent empty output shows an error and retry; slow requests show elapsed time and Stop.

Production model credentials are masked in the Vercel export. A live production-source/model replay could not run locally; no live latency or answer-quality claim is made from fixture timings. Production chat history was inspected read-only and was not modified by debugging.
