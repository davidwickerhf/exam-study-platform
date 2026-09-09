# Hosted MCP

Endpoint: `https://study.wicker.life/api/mcp`. Transport: Streamable HTTP, stateless JSON responses. A new transport is created per request; every request authenticates. No sticky sessions, SSE subscription, or legacy HTTP+SSE endpoint is required. GET and DELETE return 405 because there is no persistent stream/session. The SDK negotiates its supported protocol versions during initialization.

## Connect over HTTPS (recommended)

For local agents and other compatible services, use **https://study.wicker.life/api/mcp**
with Streamable HTTP and OAuth. No Wicker package, Node.js or separately downloaded skill
is needed. The client manages credentials after the user signs in and approves access.

### Codex

```sh
codex mcp add wicker-study --url https://study.wicker.life/api/mcp
codex mcp login wicker-study --scopes read,write
```

Complete browser approval, then restart the agent session (or reopen the app/reload the IDE window).

### Claude Code

```sh
claude mcp add --scope user --transport http wicker-study https://study.wicker.life/api/mcp
```

Open Claude Code, run `/mcp`, select `wicker-study` and authenticate in the browser.

### Replace an existing package registration

Before running the hosted commands above, remove the existing entry:

```sh
# Codex
codex mcp remove wicker-study

# Claude Code: use the scope where the old entry was installed
claude mcp remove --scope user wicker-study
```

For Claude project/local installations, use that same scope when removing and adding the
connection. Preserve any custom settings still needed and check project overrides.
This changes client configuration, not account data. Old package keys are not used by OAuth
and are not automatically revoked; revoke unused keys in Settings → API access.

Verify with `wicker_status`, `wicker_guidance` and `list_courses`. Hosted updates require a
reconnection to refresh tools and guidance, not an npm or separate skill update. An optional
installed skill is only a discovery hint. Revoke OAuth access at
[Connected services](https://study.wicker.life/connect/remote).

Other clients need Streamable HTTP and OAuth dynamic registration with PKCE, or support for
an existing scoped key in `Authorization: Bearer wsk_…`. Keep credentials out of URLs and chat.
See [authentication details below](#authentication-details) for protocol details and limits, and the official
[Codex](https://developers.openai.com/codex/mcp) and
[Claude Code](https://code.claude.com/docs/en/mcp) client instructions.

### Does local work require the package?

No. An agent with shell/file access can inspect folders, extract PDFs, render slides, verify
hashes and generate content using its own tools. Hosted `study_generation_*` tools provide
current prompts, evidence and schemas, and accept locally computed results. The transport
does not decide where model computation runs.

Keep the package as the optional **admin toolkit**: it retains editorial operations,
course-folder inventory/sync and bulk Canvas imports. Existing helper users remain supported.
Students and ordinary agents should use hosted MCP and their native file/processing tools.

For complete originals, call `prepare_original_download` with an asset ID from
`canvas_course_materials`. It returns the direct HTTPS URL, a short-lived file-scoped header,
size, SHA-256 and expiry. Stream the response with native HTTP/file tools into a new temporary
file, verify its complete size/hash, then rename it to a safe chosen path. Resume with Range
and the supplied If-Match; request a new descriptor for the same asset/hash after expiry.
This works without the npm helper and keeps binary bytes outside MCP text-token budgets.

The temporary header authorizes only that original, not other files or account actions.
Keep it out of chat, logs and shell history; do not follow redirects or forward it elsewhere.
Do not extract the client’s OAuth token or request Canvas credentials. A native file tool
alone does not supply authenticated access; the server supplies the narrowly scoped transfer.
`read_original_chunk` remains a fallback for clients unable to perform direct downloads.
Direct transfers have their own request, concurrency and byte limits.

## Authentication details

For standard OAuth clients, enter the endpoint and choose OAuth. The server advertises protected-resource metadata at `/.well-known/oauth-protected-resource/api/mcp` and authorization-server metadata at `/.well-known/oauth-authorization-server`. It supports dynamic registration, public clients (`none`), `client_secret_post` and `client_secret_basic`. OAuth-only services must support authorization code + S256 PKCE and RFC 8707 resource indicators. Client ID metadata documents and client-credentials grants are not implemented; clients use dynamic registration instead.

The resource parameter is the exact MCP endpoint, including `/api/mcp`. Authorization codes are bound to the client, exact registered callback, resource and PKCE challenge, expire after five minutes, and can be consumed once. The user must approve the service and requested read/write scopes in their signed-in browser. Admin scope is not available through OAuth. Access tokens expire after one hour; refresh tokens rotate on every exchange and the connection expires after 30 days. Reusing an old refresh token revokes its token family. Refresh can reduce scopes but cannot increase them. Client secrets, codes and tokens are stored as hashes.

For services that accept API keys, supply `Authorization: Bearer wsk_…` with an existing scoped Wicker Study key. Never place a key in a URL. Browser cookies do not authorize the MCP endpoint. OAuth access tokens are accepted only at the MCP endpoint, not forwarded to Canvas or exposed as general REST credentials. API keys retain their existing expiry and revocation semantics.

Manage/revoke OAuth connections at `/connect/remote`; API keys are managed separately in Settings → API access. Account erasure also removes OAuth access records. Revocation stops future calls; it cannot undo a mutation that already started.

## Shared tools and guide

Core, study and feedback tool registrations are shared with local stdio MCP. Hosted MCP omits machine-local filesystem, clipboard and editorial administrator operations. Consumers discover capabilities with `tools/list`; they must not assume every local tool exists remotely. `read_original_chunk` returns unchanged original bytes in ranges of at most 48 KiB. Assemble chunks using `Content-Range` and verify the inventory's full SHA-256 and byte size. Never place binary chunks in model conversation text.

`wicker_guidance` and the `wicker://guidance/current` resource serve `mcp/guidance.md`, bundled with the release. Initialize instructions request the guide once per connection/version. The optional installed skill is a small stable discovery hint. Updating stdio MCP updates its guide; hosted clients reconnect to refresh discovery and guidance. No separate skill-update procedure is necessary.

## Direct original downloads

`prepare_original_download` calls `GET /api/corpus/assets/:assetId/download-ticket`
through the authenticated read-scoped API. Both hosted MCP and package 2.14.0 expose it.
The descriptor contains `url`, `method`, `headers`, `assetId`, `filename`, `mediaType`,
`byteSize`, `sha256`, `expiresAt` and `supportsRanges`.

The URL is `/api/mcp/original`; the file capability is sent in the supplied Authorization
header, never in a query string. It cannot authenticate other API/MCP routes. Only its hash
is stored, bound to the issuing user/key or OAuth grant, exact asset, size and hash. Each GET
or HEAD rechecks the issuer’s active read access and current asset access. Key/grant revocation,
account deletion, expiry or loss of material access prevents subsequent transfers. Revocation
does not retract bytes already sent by an in-progress request.

Original bytes stream unchanged with Content-Length, ETag, attachment Content-Disposition,
no-store and no-referrer. GET supports a single Range and If-Match; HEAD returns metadata.
A changed original returns 412, an unsatisfiable range 416, and an expired capability 401.
Resume in a separate request. If a server timeout interrupts a large transfer, retain verified
partial bytes and resume; verify the complete SHA-256 before declaring success. The original
filename is a display name, not a safe output path. No local file is written by hosted MCP.

| Direct transfer limit | Default |
| --- | --- |
| Capability lifetime | 10 minutes |
| Maximum original | 1 GiB |
| Preparations per account | 20/minute |
| Download requests per account and connection | 60/minute |
| Simultaneous transfers per account | 2 |
| Transferred bytes per account and connection | 4 GiB/day |

PostgreSQL reserves requested bytes before streaming and returns unused capacity on partial
failure. Bytes already handed to the HTTP writer remain conservatively charged, even if
the client disconnects before acknowledging them. Finished transfers count again if downloaded again. HEAD consumes request quota but
no byte quota. Account limits cannot be bypassed with another key. File bytes use this budget,
not MCP text-token accounting; the small descriptor still counts as an MCP response. These
limits live in `ORIGINAL_DOWNLOAD_LIMITS` in `lib/original-downloads.mjs`.

## Limits

Budgets and concurrency leases are stored in PostgreSQL and apply across replicas. Accounts and individual connections are both metered; additional keys or OAuth clients do not bypass the account budget.

| Limit | Default |
| --- | --- |
| MCP requests per account and connection | 60/minute |
| Concurrent requests per account | 4 |
| Request body | 256 KiB |
| Tool result | 128 KiB |
| Transport token units | 1,000,000/minute; 4,000,000/day |
| Public connection requests per IP | 120/minute |
| Client registrations per IP | 10/10 minutes |
| Token exchanges/revocations per IP | 30/10 minutes per endpoint |
| Browser connection approvals per account | 10/hour |

Transport token units use UTF-8 bytes as a conservative upper bound, not a model-specific tokenizer. The server reserves the maximum response capacity before executing a request, then refunds unused capacity; concurrent calls cannot overspend that reservation. Even an unsuccessful call consumes its actual request/response budget. Large queries return an actionable tool error instead of silently truncating JSON. Discovery and guidance also count. Limits return HTTP 429 and `Retry-After`. Leases expire after ten minutes if a process is lost; clients should inspect saved state before retrying interrupted writes. These defaults live in `MCP_LIMITS` in `lib/mcp-http.mjs`.

Each hosted Tutor model round also reserves a conservative input/output token budget before the provider call, shared across the account and connection (120,000/day and 1,000,000/month by default, configured through AI_TOKENS_PER_DAY and AI_TOKENS_PER_MONTH). Provider-reported usage refunds unused capacity; interrupted calls retain the reservation because they may be billable. Other hosted AI requests retain feature-specific maximum output tokens, reservations, spending controls and daily/monthly account allowances. Verified account quota exemptions apply to every personal API key and OAuth connection owned by that account, including existing connections with exhausted counters. Development/preview exemptions never exempt ordinary remote users. Exempt accounts have no transport token, hosted AI usage or daily download-byte allowance; usage remains recorded. Request-rate, concurrency, per-request size and per-file safety limits still apply. `wicker_status` reports `unlimited: true`, `exemptionReason: "account"` and `null` for exempt transport/download allowances; download descriptors likewise report their effective daily allowance. Identity is resolved server-side on each request; caller-supplied email, admin flags and exemption claims never grant this exemption. Background generation retains its existing job-level spending controls. Models run by an external consumer are billed and limited by that consumer, not by MCP. Transport limits do not measure that external model's usage.

## Operations

Migration `035_remote_mcp.sql` is required. Hosted MCP fails closed without PostgreSQL. Development/tests can use an isolated in-memory store. OAuth grants, registrations and budgets survive container restarts; expiry cleanup runs every ten minutes. No private keys or new encryption secret are required for opaque OAuth tokens.

Set `WICKER_MCP_ORIGIN` to the public HTTPS origin if it differs from `https://study.wicker.life`. Preview deployments default to their immutable `VERCEL_URL`; local development defaults to `http://localhost:$PORT`. The value never comes from caller-controlled Host headers. OAuth resource/issuer values must match the public origin clients use. Vercel must route the two `/.well-known/` metadata paths and `/api/mcp` to the API service.

Browser Origin checks allow the Wicker origin, registered callback origins, and explicit comma-separated `WICKER_MCP_ALLOWED_ORIGINS`. Machine-to-machine callers normally omit Origin. CORS does not enable cookie authentication. Unknown browser origins receive 403. Use HTTPS in deployment; do not configure wildcard origins.

Validation includes standard SDK transport and OAuth discovery, account isolation, read-only/write confirmation checks, PKCE/client/callback/resource binding, replay, rotation, revocation, original-byte ranges and concurrent quota reservations. Compatibility claims are limited to these standard protocol capabilities; proprietary client extensions require separate testing.
