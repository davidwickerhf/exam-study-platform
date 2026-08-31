# Security model

## Boundaries

- Every `/api/*` route except `/api/health`, `/api/auth/config`, and editorial
  PDFs requires either a Clerk session or a personal API key. Personal data is
  scoped by the authenticated user id in every query.
- API keys (`wsk_…`, 192 bits of entropy) are stored as SHA-256 hashes, carry
  explicit scopes (`read` / `write` / `admin`), expire (30 days, 90 days, or 1
  year), can be revoked, and cannot manage other keys, reset data, or delete
  the account. `admin` keys can only be minted by users listed in
  `ADMIN_USER_IDS` or assigned the Clerk private-metadata admin role;
  `/api/admin/*` requires that flag.
- Account deletion and data resets require a typed confirmation and a session.

- Production runs on a Clerk *production* instance on the app's own domain
  (Frontend API `clerk.study.wicker.life`); preview deployments keep the development
  instance. Social sign-in in production requires custom OAuth credentials
  configured in the Clerk dashboard.

- Eligibility: with `ALLOWED_EMAIL_DOMAINS` set, a session or API key whose
  owner's primary email is not on an allowed domain (or in `ALLOWED_EMAILS`)
  gets 403 `email_not_allowed` on every protected route and an explanatory
  sign-out screen in the app. Primary emails are cached for 10 minutes.

- Programme scoping: every editorial programme is an organisation
  (`programme_memberships`). At first sign-in the server matches the email
  domain against `institution.domains` of the catalogue and joins the student
  automatically (one match) or asks once (several); only programmes matching
  the email can be joined. Members see only their programmes' catalogue and
  institution calendar; programme admins may maintain their own programme
  (`PUT /api/admin/programmes/{id}`, `/calendar`, `/members`) and nothing
  else. Programme admin is granted by global administrators only.

## Abuse controls

- Edge rate limit (Vercel Firewall, in front of the container): requests to
  paths starting with `/api` are limited to 400 per 60 s per IP (fixed
  window) and denied with 403 beyond that. Blocked requests never reach the
  app and are not billed. Managed in the Vercel dashboard → Firewall → Rules;
  changes apply without a redeploy. Bot Protection is deliberately off because
  it would challenge legitimate agent/MCP traffic that authenticates with
  bearer keys.
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
- Editorial URL sources use the same SSRF-safe fetcher and are capped at 12 MB.
  Folder sources are restricted to an allowlist, capped at 100 MB each and 250
  sources per sync, uploaded in integrity-checked 512 KiB chunks, and never
  executed. Office/PDF extraction runs in bounded subprocesses with output and
  time limits; legacy binary Office formats require conversion.

## Editorial source isolation

- Student course-request files remain private by default. Moving them into a
  shared candidate edition requires separate contribution permission and an
  explicit rights basis, followed by administrator acceptance.
- Raw sources and private retrieval chunks are never included in a published
  course release. Generated artifacts retain source citations for editorial
  review; publication rejects withdrawn, rejected, missing, or uncited evidence.
- Content generation creates a draft change set. It does not mutate the active
  course until an administrator approves the required artifacts and types the
  course code to publish a versioned release.
- Contribution permission can be withdrawn without deleting an already
  published transformation. Withdrawal prevents future publication from that
  source; account deletion also removes unshared source bytes when no other
  contribution record references them.

## Operational

- Report suspected vulnerabilities privately to `security@study.wicker.life`.
- Editorial writes are logged with the acting user/key.
- 500 responses carry a generic message in production; details go to logs.
- Secrets live only in environment variables. Rotate `DATABASE_URL` and API
  keys if they are ever pasted into a shared channel.
