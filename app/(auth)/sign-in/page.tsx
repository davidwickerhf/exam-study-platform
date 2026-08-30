import type { Metadata } from 'next'
import { AuthPage } from '@/components/auth/auth-page'

export const metadata: Metadata = { title: 'Sign in' }

export default function SignInPage() {
  const enabled = Boolean((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY) && process.env.CLERK_SECRET_KEY)
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((domain) => domain.trim()).filter(Boolean)
  return <AuthPage mode="sign-in" enabled={enabled} allowedDomains={allowedDomains} />
}
