import type { ReactNode } from 'react'
import { AppProviders } from '@/components/app-providers'

export default function AuthLayout({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || null
  return <AppProviders publishableKey={publishableKey}>{children}</AppProviders>
}
