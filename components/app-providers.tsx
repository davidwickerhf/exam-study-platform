'use client'

import { ClerkProvider } from '@clerk/nextjs'
import type { ReactNode } from 'react'

export function AppProviders({ publishableKey, children }: { publishableKey: string | null; children: ReactNode }) {
  if (!publishableKey) return children

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/v2"
      signUpFallbackRedirectUrl="/v2"
    >
      {children}
    </ClerkProvider>
  )
}
