'use client'

/**
 * The gate for migrated routes.
 *
 * Every /api/* route is authenticated server-side, so a signed-out visitor
 * would get a shell and a page full of 401s rather than a sign-in. This does
 * the same two things the legacy workspace does, so both halves of the app
 * behave identically while the migration runs:
 *
 *   1. Sends an unauthenticated visitor to /sign-in.
 *   2. Attaches the Clerk bearer token to same-origin /api/* requests, so a
 *      migrated page can call plain `fetch` exactly as the vanilla one does.
 *
 * Without a publishable key there is no sign-in at all — that is local
 * development, where the server resolves every request to one account.
 */

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Skeleton } from '@/components/ui/skeleton'

function Waiting() {
  return (
    <div className="flex flex-col gap-3 p-8" aria-busy="true" aria-label="Checking your session">
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-4 w-48" />
    </div>
  )
}

function Gate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const patched = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      window.location.replace('/sign-in')
      return
    }
    if (patched.current) {
      setReady(true)
      return
    }
    patched.current = true

    const original = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const target = new URL(href, window.location.href)
      // Only this origin's API is ours to sign.
      if (target.origin !== window.location.origin || !target.pathname.startsWith('/api/')) return original(input, init)
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
      const token = await getToken()
      if (token) headers.set('authorization', `Bearer ${token}`)
      return original(input, { ...init, headers })
    }
    setReady(true)
  }, [getToken, isLoaded, isSignedIn])

  if (!isLoaded || !ready) return <Waiting />
  return <>{children}</>
}

export function RequireAuth({ authEnabled, children }: { authEnabled: boolean; children: ReactNode }) {
  if (!authEnabled) return <>{children}</>
  return <Gate>{children}</Gate>
}
