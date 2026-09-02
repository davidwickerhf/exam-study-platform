'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type OnboardingView = { finished?: boolean; state?: { programme?: boolean } }

export function OnboardingResume({ className }: { className?: string }) {
  const [incomplete, setIncomplete] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/onboarding', { headers: { accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : null)
      .then((view: OnboardingView | null) => {
        if (live) setIncomplete(Boolean(view && (!view.finished || !view.state?.programme)))
      })
      .catch(() => {})
    return () => { live = false }
  }, [])

  if (!incomplete) return null

  return (
    <div className={cn('mt-4 flex flex-wrap items-center gap-3 border-t pt-4', className)}>
      <span className="text-muted-foreground text-sm">Your workspace setup is not finished.</span>
      <Link href="/v2/setup" className={buttonVariants({ size: 'sm' })}>
        Resume setup
        <ArrowRightIcon data-icon="inline-end" />
      </Link>
    </div>
  )
}
