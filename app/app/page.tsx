'use client'

import { useEffect } from 'react'
import { legacyHashTarget } from '@/lib/v2/migration.mjs'

export default function WorkspacePage() {
  useEffect(() => {
    window.location.replace(legacyHashTarget(window.location.hash) || '/v2')
  }, [])

  return <main className="grid min-h-dvh place-items-center bg-background text-foreground">Opening workspace…</main>
}
