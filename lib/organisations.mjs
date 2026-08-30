import { sql } from './db.mjs'
import { loadEditorialProgrammeCatalogue } from './editorial-programmes.mjs'

// Programme organisations. Every editorial programme is an organisation;
// membership is the scope: a student sees the catalogue, institution calendar,
// and programme-admin surface of the programmes they belong to. People are
// placed automatically at first sign-in from their email domain
// (`institution.domains` on the programme); when the domain matches several
// programmes they choose once.
//
// Memberships live in `programme_memberships` (Postgres). Clerk stays the
// identity provider only: its Organizations feature caps free-plan
// organisations at five members, which cannot hold a cohort.

export const ROLES = Object.freeze(['member', 'admin'])

function emailDomain(email) {
  const address = String(email || '').trim().toLowerCase()
  const at = address.lastIndexOf('@')
  return at > 0 ? address.slice(at + 1) : ''
}

function domainMatches(domain, allowed) {
  return Boolean(domain) && (domain === allowed || domain.endsWith(`.${allowed}`))
}

export function programmeDomains(programme) {
  return (programme?.institution?.domains || []).map((value) => String(value).toLowerCase())
}

// Programmes a person may join from their email alone. `trusted` callers
// (administrators, explicit ALLOWED_EMAILS exceptions) may join any programme.
export function programmesForEmail(programmes, email, { trusted = false } = {}) {
  if (trusted) return programmes
  const domain = emailDomain(email)
  return programmes.filter((programme) => programmeDomains(programme).some((allowed) => domainMatches(domain, allowed)))
}

export function organisationName(programme) {
  return `${programme.institution?.name || 'Institution'} · ${[programme.degree, programme.name].filter(Boolean).join(' ')}`.slice(0, 120)
}

export function publicProgramme(programme) {
  return { id: programme.id, name: programme.name, degree: programme.degree, institution: { name: programme.institution?.name || '', city: programme.institution?.city || '' } }
}

// ------------------------------------------------------------ memberships

function row(record) {
  return { programmeId: record.programme_id, role: record.role === 'admin' ? 'admin' : 'member', since: record.created_at instanceof Date ? record.created_at.toISOString() : record.created_at }
}

// [{ programmeId, role, since }] for one user. Runs outside the request
// context (authentication), so it takes the user id explicitly.
export async function membershipsFor(userId) {
  if (!sql) return []
  const rows = await sql`SELECT programme_id, role, created_at FROM programme_memberships WHERE user_id = ${userId} ORDER BY created_at`
  return rows.map(row)
}

export async function joinProgramme({ userId, email, programmeId, trusted = false, role = 'member' }) {
  if (!sql) throw new Error('Programme membership needs the hosted database.')
  const programme = loadEditorialProgrammeCatalogue().programmes.find((item) => item.id === programmeId)
  if (!programme) throw new Error('Unknown programme.')
  if (!programmesForEmail([programme], email, { trusted }).length) throw new Error(`Your email address is not associated with ${organisationName(programme)}.`)
  const granted = ROLES.includes(role) ? role : 'member'
  const [saved] = await sql`INSERT INTO programme_memberships (user_id, programme_id, role) VALUES (${userId}, ${programmeId}, ${granted})
    ON CONFLICT (user_id, programme_id) DO UPDATE SET role = CASE WHEN programme_memberships.role = 'admin' THEN programme_memberships.role ELSE excluded.role END
    RETURNING programme_id, role, created_at`
  return row(saved)
}

// Administrators manage memberships directly (grant programme admin, move a
// student, remove someone). Domain rules do not apply here.
export async function setMembership({ userId, programmeId, role }) {
  if (!sql) throw new Error('Programme membership needs the hosted database.')
  if (!loadEditorialProgrammeCatalogue().programmes.some((item) => item.id === programmeId)) throw new Error('Unknown programme.')
  if (!ROLES.includes(role)) throw new Error(`Role must be one of ${ROLES.join(', ')}.`)
  const [saved] = await sql`INSERT INTO programme_memberships (user_id, programme_id, role) VALUES (${userId}, ${programmeId}, ${role})
    ON CONFLICT (user_id, programme_id) DO UPDATE SET role = excluded.role RETURNING programme_id, role, created_at`
  return row(saved)
}

export async function removeMembership({ userId, programmeId }) {
  if (!sql) throw new Error('Programme membership needs the hosted database.')
  const rows = await sql`DELETE FROM programme_memberships WHERE user_id = ${userId} AND programme_id = ${programmeId} RETURNING programme_id`
  return rows.length > 0
}

export async function listMembers(programmeId) {
  if (!sql) return []
  const rows = await sql`SELECT user_id, role, created_at FROM programme_memberships WHERE programme_id = ${programmeId} ORDER BY role DESC, created_at`
  return rows.map((record) => ({ userId: record.user_id, ...row({ ...record, programme_id: programmeId }) }))
}

export async function membershipCounts() {
  if (!sql) return {}
  const rows = await sql`SELECT programme_id, count(*)::int AS members, count(*) FILTER (WHERE role = 'admin')::int AS admins FROM programme_memberships GROUP BY programme_id`
  return Object.fromEntries(rows.map((record) => [record.programme_id, { members: record.members, admins: record.admins }]))
}

// Decides what happens at sign-in: nothing (already a member), auto-join (one
// eligible programme), or ask (several).
export function scopeDecision({ memberships, eligible }) {
  if (memberships.length) return { action: 'none' }
  if (eligible.length === 1) return { action: 'join', programmeId: eligible[0].id }
  if (eligible.length > 1) return { action: 'choose' }
  return { action: 'unavailable' }
}

// The catalogue a member may see: their programmes, or — before they belong
// anywhere — the ones they could join.
export function scopeCatalogue(catalogue, { memberships, email, trusted }) {
  if (memberships === null) return catalogue
  const ids = new Set(memberships.map((membership) => membership.programmeId))
  const visible = ids.size ? catalogue.programmes.filter((programme) => ids.has(programme.id)) : programmesForEmail(catalogue.programmes, email, { trusted })
  return { ...catalogue, programmes: visible }
}
