'use client'

/**
 * The way out of setup.
 *
 * Until this existed the only thing that could unlock the workspace was the
 * model calling its `finish` tool, so a student who used the checklist — or who
 * had no model at all — filled every step in and stayed on this page, with
 * every other route redirecting them back to it. The action is the same one the
 * conversation takes: `POST /api/onboarding/finish`, which returns the updated
 * view with `finished: true`, or 409 with the reason it cannot yet.
 *
 * It is offered the moment the one required step — the programme — is saved,
 * and before that it is shown disabled with the reason, rather than hidden, so
 * the end of setup is visible from the start.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { json, type View } from './view'

export function FinishSetup({
  view,
  onFinished,
  size = 'default',
  reason = true,
  className = ''
}: {
  view: View | null
  onFinished?: (view: View) => void
  size?: 'default' | 'sm'
  /** The line under the button. Off where the surrounding copy already says it. */
  reason?: boolean
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = Boolean(view?.state?.programme)
  const finished = Boolean(view?.finished)

  const finish = async () => {
    if (busy || !ready) return
    setBusy(true)
    setError(null)
    try {
      // Already finished once: nothing to record, just go.
      if (!finished) {
        const next = await json<View>('/api/onboarding/finish', { method: 'POST' })
        onFinished?.(next)
      }
      router.replace('/app')
      // The redirect that guards /app is decided on the server, so the cached
      // segment has to be dropped or it sends us straight back here.
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Setup could not be finished.')
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Button type="button" size={size} className="w-full" disabled={!ready || busy} onClick={() => void finish()}>
        {busy && <Spinner data-icon="inline-start" />}
        {busy ? 'Opening your workspace…' : finished ? 'Enter your workspace' : 'Finish setup'}
        {!busy && <ChevronRightIcon data-icon="inline-end" />}
      </Button>
      {error ? (
        <p role="alert" className="text-[12.5px] leading-relaxed">
          {error}
        </p>
      ) : !ready ? (
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">Save your programme first.</p>
      ) : reason ? (
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">Anything still unconnected can be added later from Account.</p>
      ) : null}
    </div>
  )
}
