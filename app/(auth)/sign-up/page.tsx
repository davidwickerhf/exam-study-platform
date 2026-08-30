import type { Metadata } from 'next'
import { AuthPage } from '@/components/auth/auth-page'

export const metadata: Metadata = { title: 'Create an account' }

export default function SignUpPage() {
  const enabled = Boolean((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY) && process.env.CLERK_SECRET_KEY)
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((domain) => domain.trim()).filter(Boolean)
  return <AuthPage mode="sign-up" enabled={enabled} allowedDomains={allowedDomains} />
}
