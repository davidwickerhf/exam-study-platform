'use client'

import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

// Same-origin Better Auth client. The web service proxies /api/auth/* to the
// API service, so the session cookie is first-party on the study origin.
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [emailOTPClient()],
})

/** Ends the session and leaves for sign-in, even if the request fails. */
export async function signOutTo(destination = '/sign-in') {
  try { await authClient.signOut() } finally { window.location.assign(destination) }
}
