# Security model

## Boundaries

- Every `/api/*` route except `/api/health`, `/api/auth/config`, and editorial
  PDFs requires either a Clerk session or a personal API key. Personal data is
  scoped by the authenticated user id in every query.
- API keys (`wsk_…`, 192 bits of entropy) are stored as SHA-256 hashes, carry
  explicit scopes (`read` / `write` / `admin`), expire (30 days, 90 days, or 1
  year), can be revoked, and cannot manage other keys, reset data, or delete
  the account. `admin` keys can only be minted by users listed in
  `ADMIN_USER_IDS`; `/api/admin/*` requires that flag.
- Account deletion and data resets require a typed confirmation and a session.

## Abuse controls

- Sliding-window rate limits (in-process): 600 requests/min per IP overall,
  60/min per IP for anonymous API routes, 300/min per identity, 120/min for
  mutations, 20/min for AI-backed routes, 60/min for admin writes, 30/hour for
  uploads and document reads, 10/hour for key minting, 5/hour for account
  resets/deletion. 401/403 responses count towards a 20-per-10-minutes
  per-IP failure budget; exceeding it returns 429 with `Retry-After`.
- AI allowances (requests and tokens per day/month) are enforced per user on
  top of the rate limits and reserved before each call.
- Request bodies are capped per route (5 MB default, 60 MB for admin material
  uploads), headers and slow connections time out, and uploads are read in
  bounded chunks.

## Browser protections

- Strict CSP on HTML: no inline or eval scripts; scripts only from the app,
  jsdelivr (reader libraries, Clerk), and Clerk; `frame-ancestors 'none'`;
  `object-src 'none'`.
- HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and a
  restrictive `Permissions-Policy` on every response.
- Cookie-authenticated mutations are refused unless `Sec-Fetch-Site` /
  `Origin` show they originated from this site (CSRF). Bearer calls carry no
  ambient credentials and are exempt.

## Server-side fetches

- Calendar feed URLs are validated before fetching: http(s) only, ports
  80/443, no credentials, hostnames resolved and rejected if they map to
  loopback, link-local, private, CGNAT, or metadata ranges; redirects are
  re-validated hop by hop; bodies capped at 4 MB with a 15 s timeout.
- Material paths are normalised and confined to the course knowledge base.

## Operational

- Editorial writes are logged with the acting user/key.
- 500 responses carry a generic message in production; details go to logs.
- Secrets live only in environment variables. Rotate `DATABASE_URL` and API
  keys if they are ever pasted into a shared channel.
