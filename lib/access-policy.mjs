// Access is a product invariant, not a deployment toggle. Keeping this policy
// in code means a missing or overly broad environment variable cannot open the
// workspace by accident.
export const ACCESS_EMAIL_DOMAINS = Object.freeze([
  'maastrichtuniversity.nl',
  'student.maastrichtuniversity.nl'
])
export const ACCESS_ADMIN_EMAILS = Object.freeze(['davidwickerhf@gmail.com'])

export function accessPolicy() {
  return { domains: [...ACCESS_EMAIL_DOMAINS], emails: [...ACCESS_ADMIN_EMAILS] }
}

export function emailAllowed(email, policy = accessPolicy()) {
  if (!policy.domains.length && !policy.emails.length) return true
  const address = String(email || '').trim().toLowerCase()
  const at = address.lastIndexOf('@')
  if (at < 1) return false
  if (policy.emails.includes(address)) return true
  const domain = address.slice(at + 1)
  return policy.domains.includes(domain)
}

export function isAccessAdministratorEmail(email) {
  return ACCESS_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase())
}

export function verifiedPrimaryEmail(user) {
  const primary = user?.emailAddresses?.find((entry) => entry.id === user.primaryEmailAddressId)
  return primary?.verification?.status === 'verified' ? primary.emailAddress : null
}
