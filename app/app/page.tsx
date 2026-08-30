import type { Metadata } from 'next'
import { LegacyWorkspace } from '@/components/workspace/legacy-workspace'

export const metadata: Metadata = { title: 'Workspace', robots: { index: false, follow: false } }

export default function WorkspacePage() {
  const authEnabled = Boolean((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY) && process.env.CLERK_SECRET_KEY)
  const version = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || 'next').slice(0, 12)
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((domain) => domain.trim()).filter(Boolean)
  return <LegacyWorkspace authEnabled={authEnabled} version={version} allowedDomains={allowedDomains} />
}
