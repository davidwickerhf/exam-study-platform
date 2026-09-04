import type { Metadata } from 'next'
import { AuthPage } from '@/components/auth/auth-page'
import { accessPolicy } from '@/lib/access-policy.mjs'

export const metadata: Metadata = { title: 'Create an account' }

export default function SignUpPage() {
  const enabled = Boolean((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY) && process.env.CLERK_SECRET_KEY)
  const allowedDomains = enabled ? accessPolicy().domains : []
  return <AuthPage mode="sign-up" enabled={enabled} allowedDomains={allowedDomains} localAccounts={[]} />
}
