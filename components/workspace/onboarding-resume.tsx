'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRightIcon, ListChecksIcon, XIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useWorkspaceData } from '@/hooks/use-workspace-data'
import { cn } from '@/lib/utils'
import { nextStep, outstandingSteps, setupSteps, type SetupSourceState } from '@/lib/workspace/setup.mjs'

type OnboardingView = { id?: string; finished?: boolean; skipped?: string[]; state?: SetupSourceState }

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
      <Link href="/app/setup" className={buttonVariants({ size: 'sm' })}>
        Resume setup
        <ArrowRightIcon data-icon="inline-end" />
      </Link>
    </div>
  )
}

export function DashboardSetupReminder() {
  const { data: view } = useWorkspaceData<OnboardingView>('/api/onboarding')
  const [dismissed, setDismissed] = useState(false)
  const [dismissalRead, setDismissalRead] = useState(false)
  const steps = setupSteps({ state: view?.state ?? null, skipped: view?.skipped ?? [] })
  const missing = outstandingSteps(steps)
  const next = nextStep(steps) ?? missing[0] ?? null
  const signature = missing.map((step) => step.id).join(',')
  const dismissalKey = `wicker-setup-reminder:${view?.id ?? 'workspace'}`

  useEffect(() => {
    if (!view) return
    try {
      setDismissed(window.localStorage.getItem(dismissalKey) === signature)
    } catch {
      setDismissed(false)
    }
    setDismissalRead(true)
  }, [dismissalKey, signature, view])

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissalKey, signature)
    } catch {}
    setDismissed(true)
  }

  if (!view || !dismissalRead || dismissed || !next || missing.length === 0) return null

  return (
    <section className="border-primary/20 bg-primary/[0.055] rounded-xl border p-5" aria-labelledby="setup-reminder-title">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-md"><ListChecksIcon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="setup-reminder-title" className="text-sm font-semibold">Finish setting up your study desk</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{missing.length} {missing.length === 1 ? 'step is' : 'steps are'} still missing. Add them to improve your schedule and priority coverage.</p>
          <p className="text-foreground mt-2 text-xs font-medium">Next: {next.title}</p>
          <Link href={`/app/setup?step=${next.id}`} className={cn(buttonVariants({ size: 'sm' }), 'mt-3')}>
            Continue setup
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss setup reminder" className="text-muted-foreground hover:bg-primary/10 hover:text-foreground -mr-2 -mt-2 grid size-8 shrink-0 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <XIcon className="size-4" />
        </button>
      </div>
    </section>
  )
}
