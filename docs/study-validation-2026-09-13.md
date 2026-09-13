# Study pipeline validation — 13 September 2026

## Release verdict

**Hold production release.** Passing infrastructure tests and model-review verdicts do not yet establish reliable teaching quality. This audit uses actual OpenAI responses, the real generation state machines, and live production MCP reads. Earlier failed attempts are retained; they are not replaced by later passing samples.

## Implemented scope

The feature PR adds objective/evidence planning, visible format-3 teaching, guided/independent/transfer practice, diagnostic follow-ups, separate factual and pedagogical reviews, recurring full Canvas collection, inferred module readiness, current-year scope with optional historical supplements, source-change invalidation, pipeline controls/logs, and right-side settings drawers. Hosted and MCP-led generation share the same contract. See [behavior and limitations](study-teaching-and-recurring-pipelines.md).

Validation-driven fixes include consent/pause enforcement for automatic guides; binding-scoped source invalidation; provider constraints on objective references, diagnostic fields, comparison dimensions and review quotations; enough provider output budget for the requested lesson; source-gap versus exam-exclusion wording; mixed-year scope validation; and a narrow deterministic intersection-range check discovered through manual review.

## Verified evidence

| Area | Result | What this establishes |
| --- | --- | --- |
| `npm run verify` | 982 tests passed; typecheck/build passed | Automated contracts, behavior and buildability |
| Browser suite | 42 passed; reader and side-drawer checks rerun successfully | Local UI behavior with controlled accounts and fixtures |
| Disposable PostgreSQL | Passed | Migrations, private storage, consent withdrawal, concurrent idempotency, spending, generation persistence and pause/resume |
| Canvas queue suite | Passed | Due full collection despite recent metadata checks, source/announcement changes, consent and lease fencing |
| Real-model readiness | 7/7 passed | Weekly units, missing/available textbook content, current scope and historical supplements; an actual OS reading-assignment page cannot substitute for the missing chapters |
| Production MCP authentication | Passed | Existing connection works independently of browser login; read/write scopes are available |
| Production MCP calendar | Passed | 26 events returned for September 14–20 |
| Production MCP Canvas inventory | Passed | Seven course groups; 75 current-year Operating Systems materials |
| Production MCP practice | Passed | Practice queue returns, including the existing 52-question IoT guide |
| Deployed preview | Rendered | Authenticated-project preview renders sign-in; development preview renders pipeline settings. Neither establishes access to the user's authenticated browser account |

Production MCP reports version 2.15 and teaching contract v4. Its successful reads do not validate deployment of the new v5 tools. The local MCP transport/argument tests and real-model next/submit state-machine checks are separate evidence; no new guide was written into the student's production account for testing.

## Real-model findings

The evaluation uses `gpt-5-mini`, existing authorized credentials, isolated local validation accounts, and explicit spending caps. No new API key was required. The quality suite includes source-backed generation, factual and pedagogical reviews, deliberate factual corruptions, and positive/shallow IoT controls. Pipeline runs exercise hosted execution and local next/submit, including duplicate submission checks.

Earlier runs exposed output truncation, missing diagnostic data, broken objective/question links, malformed comparison dimensions, invented review quotations, and false readiness blockers. Fixes were followed by new tests and new model calls. The worked IoT control passed, while all five deliberately shallow cases were rejected.

### A passing reviewer missed a real error

One generated chapter passed both model reviews but claimed that, given `P(A)=0.7` and `P(B)=0.5`, the allowable intersection range was `[0, 0.5]`. The correct complete range is `[0.2, 0.5]`: otherwise the union can exceed one. A second question made the same mistake with marginals 0.65 and 0.55. Manual inspection also found a “transfer” question repeating a worked case with the same inputs and conclusion.

The bad range is now a deterministic regression and an additional live negative control. The reviewer prompt explicitly checks complete feasible ranges and duplicated transfer cases. This addresses the observed case; it is not a general mathematical proof checker or proof that model review catches every error.

### Generation reliability remains a release concern

Full hosted/local runs have exhausted their single automatic correction on structural or review findings. One hosted run repaired its question links, then stopped on a visual-provenance finding. A safe stop preserves prior guides, but repeated stops do not meet the intended automatic-generation experience. Quality checks must not be weakened merely to make these runs finish.

## Limits of this validation

- Browser email verification did not arrive; the student's browser session remains unverified. MCP authentication is working separately.
- Controlled browser/database tests do not prove every production account, Canvas permission or scheduled job configuration.
- Canvas already reports inaccessible resources in some historical courses; collection is not a promise of access to everything.
- A small set of model examples and reviews cannot establish educational effectiveness across courses or student mastery.
- Existing saved guides were not regenerated and production settings were not changed by these checks.

Local evidence files are under `/tmp/wicker-study-*.json` and `/tmp/wicker-validation-*.log`. They include failed and successful attempts. They are not committed because some source fixtures derive from private course material.
