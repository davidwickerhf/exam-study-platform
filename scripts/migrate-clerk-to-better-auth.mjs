#!/usr/bin/env node
// Copy Clerk users into the self-hosted Better Auth tables (db/050_better_auth.sql).
//
//   CLERK_SECRET_KEY=sk_live_… node scripts/migrate-clerk-to-better-auth.mjs                 # dry run (default)
//   CLERK_SECRET_KEY=… node scripts/migrate-clerk-to-better-auth.mjs --csv users.csv         # dry run with password digests
//   CLERK_SECRET_KEY=… DATABASE_URL=… node scripts/migrate-clerk-to-better-auth.mjs --apply [--csv users.csv]
//
// - Reads every user from the Clerk Backend API (read-only): email and its
//   verification, name, image, created/updated time, private-metadata role
//   (`wickerStudyRole`) and external accounts (provider + provider user id).
// - Keeps the Clerk user id (`user_…`) as the Better Auth user id, so personal
//   tables, ADMIN_USER_IDS and programme memberships stay attached.
// - The Backend API never returns password hashes. `--csv` reads Clerk's
//   dashboard export (Users → Export), whose `password_digest` /
//   `password_hasher` columns (bcrypt) become credential accounts; Better Auth
//   is configured to verify bcrypt. Without the CSV, password users choose a
//   new password with "Forgot password?" on /sign-in.
// - Sessions are not migrated: everyone signs in once after the switch.
// - Idempotent: re-running updates the same rows and adds nothing twice.
// - Writes only with --apply. The dry run prints the plan and touches nothing.
import '../lib/env.mjs'
import { readFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const csvIndex = args.indexOf('--csv')
const csvPath = csvIndex >= 0 ? args[csvIndex + 1] : null
if (csvIndex >= 0 && !csvPath) fail('--csv needs a path to the Clerk users export.')
if (args.includes('--help')) { console.log(readHelp()); process.exit(0) }

function readHelp() {
  return 'Usage: node scripts/migrate-clerk-to-better-auth.mjs [--csv clerk-users.csv] [--apply]\nDry run unless --apply. Needs CLERK_SECRET_KEY; --apply also needs DATABASE_URL.'
}

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

const secret = process.env.CLERK_SECRET_KEY
if (!secret) fail('CLERK_SECRET_KEY is required (Clerk dashboard → API keys).')
if (apply && !process.env.DATABASE_URL) fail('--apply needs DATABASE_URL.')

// ── Clerk Backend API ───────────────────────────────────────────────────────
async function clerk(path) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, { headers: { Authorization: `Bearer ${secret}` } })
  if (!response.ok) fail(`Clerk API ${path.split('?')[0]} returned ${response.status}.`)
  return response.json()
}

async function clerkUsers() {
  const users = []
  for (let offset = 0; ; offset += 100) {
    const page = await clerk(`/users?limit=100&offset=${offset}&order_by=created_at`)
    users.push(...page)
    if (page.length < 100) return users
  }
}

// ── Clerk CSV export ────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field); field = ''
      if (row.some(value => value !== '')) rows.push(row)
      row = []
    } else field += char
  }
  row.push(field)
  if (row.some(value => value !== '')) rows.push(row)
  const [header = [], ...body] = rows
  const keys = header.map(name => name.trim().toLowerCase())
  return body.map(values => Object.fromEntries(keys.map((key, index) => [key, (values[index] ?? '').trim()])))
}

async function passwordDigests() {
  if (!csvPath) return new Map()
  const records = parseCsv(await readFile(csvPath, 'utf8'))
  if (records.length && !('id' in records[0])) fail('The CSV has no "id" column; use the Clerk dashboard users export.')
  const digests = new Map()
  let skipped = 0
  for (const record of records) {
    const digest = record.password_digest
    if (!record.id || !digest) continue
    const hasher = (record.password_hasher || 'bcrypt').toLowerCase()
    if (hasher !== 'bcrypt' || !/^\$2[abxy]?\$\d{2}\$/.test(digest)) { skipped += 1; continue }
    digests.set(record.id, digest)
  }
  if (skipped) console.warn(`warning: ${skipped} CSV password digest(s) are not bcrypt and were skipped; those users reset their password.`)
  return digests
}

// ── Mapping ─────────────────────────────────────────────────────────────────
const PROVIDERS = { oauth_google: 'google', google: 'google', oauth_microsoft: 'microsoft', microsoft: 'microsoft', oauth_apple: 'apple', oauth_github: 'github' }

function iso(ms) {
  return ms ? new Date(ms).toISOString() : new Date().toISOString()
}

function planUser(user, digest) {
  const primary = user.email_addresses?.find(entry => entry.id === user.primary_email_address_id) || user.email_addresses?.[0]
  if (!primary?.email_address) return { id: user.id, skip: 'no email address' }
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || ''
  const role = user.private_metadata?.wickerStudyRole === 'admin' ? 'admin' : null
  const accounts = []
  for (const external of user.external_accounts || []) {
    const providerId = PROVIDERS[external.provider] || String(external.provider || '').replace(/^oauth_/, '')
    const accountId = external.provider_user_id || external.google_id || external.external_id
    if (!providerId || !accountId) continue
    accounts.push({ id: `clerk_${external.id}`, providerId, accountId: String(accountId), scope: Array.isArray(external.approved_scopes) ? external.approved_scopes.join(' ') : (external.approved_scopes || null), password: null })
  }
  if (digest) accounts.push({ id: `clerk_${user.id}_credential`, providerId: 'credential', accountId: user.id, scope: null, password: digest })
  return {
    id: user.id,
    email: primary.email_address.toLowerCase(),
    emailVerified: primary.verification?.status === 'verified',
    name,
    image: user.has_image ? user.image_url || null : null,
    createdAt: iso(user.created_at),
    updatedAt: iso(user.updated_at || user.created_at),
    role,
    accounts,
    passwordEnabled: Boolean(user.password_enabled),
    passwordImported: Boolean(digest)
  }
}

function mask(email) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
}

// ── Run ─────────────────────────────────────────────────────────────────────
const [users, digests] = await Promise.all([clerkUsers(), passwordDigests()])
const plans = users.map(user => planUser(user, digests.get(user.id)))
const ready = plans.filter(plan => !plan.skip)
const providers = {}
for (const plan of ready) for (const account of plan.accounts) providers[account.providerId] = (providers[account.providerId] || 0) + 1

console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${users.length} Clerk user(s), ${ready.length} to import${csvPath ? `, CSV password digests for ${digests.size}` : ', no CSV (passwords not imported)'}.`)
for (const plan of plans) {
  if (plan.skip) { console.log(`  skip   ${plan.id}: ${plan.skip}`); continue }
  const password = plan.passwordImported ? 'password: imported' : plan.passwordEnabled ? 'password: must reset' : 'password: none'
  console.log(`  ${plan.id}  ${mask(plan.email)}  ${plan.emailVerified ? 'verified' : 'UNVERIFIED'}  ${password}  logins: ${plan.accounts.filter(a => a.providerId !== 'credential').map(a => a.providerId).join(',') || '-'}${plan.role ? '  role: admin' : ''}`)
}
console.log(`Linked sign-in methods: ${JSON.stringify(providers)}`)
const resets = ready.filter(plan => plan.passwordEnabled && !plan.passwordImported).length
if (resets) console.log(`${resets} password user(s) without an imported digest will use "Forgot password?" (needs SMTP_URL) or an email sign-in code.`)
const admins = String(process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
if (admins.length) console.log(`ADMIN_USER_IDS present in Clerk: ${admins.filter(id => ready.some(plan => plan.id === id)).length}/${admins.length}`)

if (!apply) {
  console.log('\nNothing was written. Re-run with --apply (and DATABASE_URL) to import.')
  process.exit(0)
}

const { poolFor } = await import('../lib/pg.mjs')
const pool = poolFor(process.env.DATABASE_URL, { queryTimeoutMs: 0 })
const client = await pool.connect()
try {
  const [{ exists }] = (await client.query(`SELECT to_regclass('public.auth_user') IS NOT NULL AS exists`)).rows
  if (!exists) fail('auth_user does not exist. Run `npm run db:migrate` first (db/050_better_auth.sql).')
  await client.query('BEGIN')
  let accounts = 0
  for (const plan of ready) {
    const clash = (await client.query('SELECT id FROM auth_user WHERE lower(email) = $1 AND id <> $2', [plan.email, plan.id])).rows[0]
    if (clash) throw new Error(`${mask(plan.email)} already belongs to Better Auth user ${clash.id}; resolve it before importing ${plan.id}.`)
    await client.query(
      `INSERT INTO auth_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt", "wickerStudyRole")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, "emailVerified" = EXCLUDED."emailVerified",
         image = EXCLUDED.image, "updatedAt" = EXCLUDED."updatedAt", "wickerStudyRole" = EXCLUDED."wickerStudyRole"`,
      [plan.id, plan.name, plan.email, plan.emailVerified, plan.image, plan.createdAt, plan.updatedAt, plan.role]
    )
    for (const account of plan.accounts) {
      await client.query(
        `INSERT INTO auth_account (id, "accountId", "providerId", "userId", scope, password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT ("providerId", "accountId") DO UPDATE SET scope = COALESCE(EXCLUDED.scope, auth_account.scope),
           password = COALESCE(EXCLUDED.password, auth_account.password), "updatedAt" = now()
         WHERE auth_account."userId" = EXCLUDED."userId"`,
        [account.id, account.accountId, account.providerId, plan.id, account.scope, account.password, plan.createdAt]
      )
      accounts += 1
    }
  }
  await client.query('COMMIT')
  const [{ count }] = (await client.query('SELECT count(*)::int AS count FROM auth_user')).rows
  console.log(`\nImported ${ready.length} user(s) and ${accounts} linked sign-in method(s). auth_user now holds ${count} row(s).`)
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error(`error: ${error.message}\nNothing was written (rolled back).`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
