import type { Metadata } from 'next'
import { AuthPage } from '@/components/auth/auth-page'
import { accessPolicy } from '@/lib/access-policy.mjs'
import { hostedAuthEnabled } from '@/lib/hosted-auth.mjs'

export const metadata: Metadata = { title: 'Create an account' }

export default function SignUpPage() {
  const enabled = hostedAuthEnabled()
  const allowedDomains = enabled ? accessPolicy().domains : []
  return <AuthPage mode="sign-up" enabled={enabled} allowedDomains={allowedDomains} localAccounts={[]} />
}
