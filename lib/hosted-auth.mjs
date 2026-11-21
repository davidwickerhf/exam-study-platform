// Whether hosted sign-in (Better Auth) is configured. Shared by the API and
// the Next.js web service, which only needs to know whether to render the
// hosted sign-in UI; it never verifies sessions itself.
export function hostedAuthEnabled(env = process.env) {
  return Boolean(String(env.BETTER_AUTH_SECRET || '').trim())
}
