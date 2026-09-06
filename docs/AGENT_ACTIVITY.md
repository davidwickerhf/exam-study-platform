# AI activity

Open **Settings → AI activity** at `/app/settings?tab=activity`, also linked from
API access. This is an account-wide request log for external assistants, distinct
from **AI usage** (model allowance) and **Canvas sync logs** (background processing).

## What is recorded

For authenticated personal API-key requests, the server records:

- Start time, unique request ID and authenticated key ID.
- Client/tool labels sent by MCP 2.9. These labels are client-supplied, not identity proof.
- HTTP method and a route template; path parameters and query contents are excluded.
- Read, write or prepared change; prepared reviews have not applied their proposed effect.
- Started, completed, failed or interrupted result, HTTP status and elapsed time.
- Client-reported confirmation and, for a successful direct Tutor confirmation,
  the separate server-recorded prepared-review ID.

No request arguments, response bodies, private passages, passwords, API keys or
Canvas tokens are copied into this log. Authenticated requests rejected by scope
checks are recorded as failures. Invalid credentials cannot be assigned reliably
to an account and are not shown in its log. Browser requests are not logged here.
One MCP tool can make multiple HTTP requests; operations that remain entirely on
the local computer are outside this portal. Earlier requests are not backfilled.

## Durability and access

Events are separate documents in the account's `agentActivity` namespace, with a
timestamp/UUID key. The initial write completes before the handler proceeds; if
it fails, the request does not execute. Completion is persisted before the HTTP
response ends. An unsuccessful completion write leaves the started event visible,
with a generic server-log error, rather than claiming success. A killed process
can leave a started record even if the operation applied: inspect the target
record or receipt before retrying a write.

`GET /api/account/agent-activity?operation=&status=&before=&limit=` uses the current
account, route-independent filters and a stable descending cursor. It returns 40
rows by default, at most 100. No request payload is needed. Browser viewing uses
fresh reads and explicit Refresh; this does not add logging work to ordinary
page navigation. Audit reads made with an API key are themselves logged.

Activity is included in account export and deleted with all account data. It is
not a tamper-proof compliance ledger and has no per-event edit/delete UI. The
confirmed review's contents belong to Tutor's prepared update, not the audit log.

## Confirmation and shared context

See [Agent access](AGENT_ACCESS.md#two-way-context-and-attendance) and the
[companion skill](../.claude/skills/wicker-study/SKILL.md). Reads do not need
confirmation. Every individual external MCP write requires explicit approval;
a saved connection or earlier approval is insufficient. For direct attendance
or memory, prepare → show exact effect → confirm. These tools do not call the
hosted model. Availability is advice context, never inferred attendance.

## Validation

- `test/agent-activity.test.mjs`: metadata redaction, started/final persistence,
  successful/denied requests, filtering, cursor isolation, export and erasure.
- `test/tutor-external-updates.test.mjs`: expiry, exact confirmations, duplicate
  requests, uncertain outcomes, account/programme isolation and attendance bounds.
- `scripts/verification/tutor-memory.mjs`: disposable PostgreSQL verification of
  legacy memory migration, concurrent saves and idempotent confirmed updates.
- Actual local MCP stdio → HTTP prepare/confirm/read verified the tool labels and
  server-confirmed review in T3. Hosted account pages require sign-in.
