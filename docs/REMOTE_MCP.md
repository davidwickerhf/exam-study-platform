# Hosted MCP

Endpoint: `https://study.wicker.life/api/mcp`. Transport: Streamable HTTP, stateless JSON responses. A new transport is created per request; every request authenticates. No sticky sessions, SSE subscription, or legacy HTTP+SSE endpoint is required. GET and DELETE return 405 because there is no persistent stream/session. The SDK negotiates its supported protocol versions during initialization.

## Connect

For standard OAuth clients, enter the endpoint and choose OAuth. The server advertises protected-resource metadata at `/.well-known/oauth-protected-resource/api/mcp` and authorization-server metadata at `/.well-known/oauth-authorization-server`. It supports dynamic registration, public clients (`none`), `client_secret_post` and `client_secret_basic`. OAuth-only services must support authorization code + S256 PKCE and RFC 8707 resource indicators. Client ID metadata documents and client-credentials grants are not implemented; clients use dynamic registration instead.

The resource parameter is the exact MCP endpoint, including `/api/mcp`. Authorization codes are bound to the client, exact registered callback, resource and PKCE challenge, expire after five minutes, and can be consumed once. The user must approve the service and requested read/write scopes in their signed-in browser. Admin scope is not available through OAuth. Access tokens expire after one hour; refresh tokens rotate on every exchange and the connection expires after 30 days. Reusing an old refresh token revokes its token family. Refresh can reduce scopes but cannot increase them. Client secrets, codes and tokens are stored as hashes.

For services that accept API keys, supply `Authorization: Bearer wsk_…` with an existing scoped Wicker Study key. Never place a key in a URL. Browser cookies do not authorize the MCP endpoint. OAuth access tokens are accepted only at the MCP endpoint, not forwarded to Canvas or exposed as general REST credentials. API keys retain their existing expiry and revocation semantics.

Manage/revoke OAuth connections at `/connect/remote`; API keys are managed separately in Settings → API access. Account erasure also removes OAuth access records. Revocation stops future calls; it cannot undo a mutation that already started.

## Shared tools and guide

Core, study and feedback tool registrations are shared with local stdio MCP. Hosted MCP omits machine-local filesystem, clipboard and editorial administrator operations. Consumers discover capabilities with `tools/list`; they must not assume every local tool exists remotely. `read_original_chunk` returns unchanged original bytes in ranges of at most 48 KiB. Assemble chunks using `Content-Range` and verify the inventory's full SHA-256 and byte size. Never place binary chunks in model conversation text.

`wicker_guidance` and the `wicker://guidance/current` resource serve `mcp/guidance.md`, bundled with the release. Initialize instructions request the guide once per connection/version. The optional installed skill is a small stable discovery hint. Updating stdio MCP updates its guide; hosted clients reconnect to refresh discovery and guidance. No separate skill-update procedure is necessary.

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

Each hosted Tutor model round also reserves a conservative input/output token budget before the provider call, shared across the account and connection (120,000/day and 1,000,000/month by default, configured through AI_TOKENS_PER_DAY and AI_TOKENS_PER_MONTH). Provider-reported usage refunds unused capacity; interrupted calls retain the reservation because they may be billable. Other hosted AI requests retain feature-specific maximum output tokens, reservations, spending controls and daily/monthly account allowances. The remote request path does not receive developer/account quota exemptions. Background generation retains its existing job-level spending controls. Models run by an external consumer are billed and limited by that consumer, not by MCP. Transport limits do not measure that external model's usage.

## Operations

Migration `035_remote_mcp.sql` is required. Hosted MCP fails closed without PostgreSQL. Development/tests can use an isolated in-memory store. OAuth grants, registrations and budgets survive container restarts; expiry cleanup runs every ten minutes. No private keys or new encryption secret are required for opaque OAuth tokens.

Set `WICKER_MCP_ORIGIN` to the public HTTPS origin if it differs from `https://study.wicker.life`. Preview deployments default to their immutable `VERCEL_URL`; local development defaults to `http://localhost:$PORT`. The value never comes from caller-controlled Host headers. OAuth resource/issuer values must match the public origin clients use. Vercel must route the two `/.well-known/` metadata paths and `/api/mcp` to the API service.

Browser Origin checks allow the Wicker origin, registered callback origins, and explicit comma-separated `WICKER_MCP_ALLOWED_ORIGINS`. Machine-to-machine callers normally omit Origin. CORS does not enable cookie authentication. Unknown browser origins receive 403. Use HTTPS in deployment; do not configure wildcard origins.

Validation includes standard SDK transport and OAuth discovery, account isolation, read-only/write confirmation checks, PKCE/client/callback/resource binding, replay, rotation, revocation, original-byte ranges and concurrent quota reservations. Compatibility claims are limited to these standard protocol capabilities; proprietary client extensions require separate testing.
