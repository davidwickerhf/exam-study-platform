import type { Metadata } from 'next'
import { AuthPage } from '@/components/auth/auth-page'
import { accessPolicy } from '@/lib/access-policy.mjs'
import { hostedAuthEnabled } from '@/lib/hosted-auth.mjs'

export const metadata: Metadata = { title: 'Sign in' }

export default function SignInPage() {
  const enabled = hostedAuthEnabled()
  const allowedDomains = enabled ? accessPolicy().domains : []
  const localAccounts = process.env.NODE_ENV !== 'production' ? (process.env.WICKER_LOCAL_ACCOUNTS || '').split(',').map((entry) => entry.split('=')[0]?.trim()).filter(Boolean) : []
  return <AuthPage mode="sign-in" enabled={enabled} allowedDomains={allowedDomains} localAccounts={localAccounts} />
}
