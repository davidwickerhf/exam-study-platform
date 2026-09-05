'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowRightIcon, CompassIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspaceSession } from '@/components/workspace/require-auth'
import { TOUR_STEPS, tourPosition, type TourRect } from '@/lib/workspace/tour.mjs'

type TourStatus = 'pending' | 'dismissed' | 'completed' | 'unoffered'
type TourState = { status: TourStatus }

async function tourRequest(status?: TourStatus): Promise<TourState> {
  const response = await fetch('/api/onboarding/tour', {
    method: status ? 'PUT' : 'GET',
    headers: { accept: 'application/json', ...(status ? { 'Content-Type': 'application/json' } : {}) },
    ...(status ? { body: JSON.stringify({ status }) } : {}),
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) throw new Error('Your tour preference could not be saved.')
  return response.json()
}

function visibleTarget(name: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
  }) ?? null
}

export function DashboardTour() {
  return <Button data-tour-replay size="sm" variant="ghost" className="text-muted-foreground -ml-2 mt-2 h-8 text-xs" onClick={() => window.dispatchEvent(new Event('wicker:start-tour'))}>
    <CompassIcon data-icon="inline-start" className="size-3.5" />Take a tour
  </Button>
}

export function WorkspaceTour() {
  const router = useRouter()
  const pathname = usePathname()
  const { session } = useWorkspaceSession()
  const storageKey = `wicker-dashboard-tour:v1:${session?.userId ?? 'local'}`
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [anchor, setAnchor] = useState<TourRect | null>(null)
  const [fallback, setFallback] = useState(false)
  const [position, setPosition] = useState({ left: 16, top: 96, width: 352 })
  const [saveError, setSaveError] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<TourStatus | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const interacted = useRef(false)
  const maskId = useId().replace(/:/g, '')
  const step = TOUR_STEPS[index]
  const routeReady = pathname === step.route

  useEffect(() => {
    let live = true
    let local: TourStatus | null = null
    try { local = window.localStorage.getItem(storageKey) as TourStatus | null } catch {}
    // A local dismissal also survives an offline save; reconcile it with the
    // account before deciding whether an automatic tour should open.
    const held = local === 'dismissed' || local === 'completed' ? local : null
    void tourRequest().then(async (state) => {
      if (held && state.status === 'pending') {
        await tourRequest(held)
        return
      }
      if (live && pathname === '/app' && !interacted.current && !held && state.status === 'pending') setOpen(true)
    }).catch(() => { /* A tour must never block use of the dashboard. */ })
    return () => { live = false }
  }, [storageKey, pathname])

  const save = (status: TourStatus) => {
    setPendingStatus(status)
    setSaveError(false)
    void tourRequest(status).then(() => setPendingStatus(null)).catch(() => setSaveError(true))
  }

  const finish = (status: 'dismissed' | 'completed') => {
    interacted.current = true
    setOpen(false)
    try { window.localStorage.setItem(storageKey, status) } catch {}
    save(status)
  }

  const goToStep = (next: number) => {
    setAnchor(null)
    setIndex(next)
    const route = TOUR_STEPS[next].route
    if (pathname !== route) router.push(route)
  }

  useEffect(() => {
    const replay = () => {
      interacted.current = true
      setIndex(0)
      setAnchor(null)
      setOpen(true)
      if (pathname !== '/app') router.push('/app')
    }
    window.addEventListener('wicker:start-tour', replay)
    return () => window.removeEventListener('wicker:start-tour', replay)
  }, [pathname, router])

  useEffect(() => {
    if (!open || !routeReady) return
    // Next.js focuses the new page after navigation; keep keyboard users in
    // the active coachmark instead of leaving focus behind the modal.
    const frame = requestAnimationFrame(() => nextRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [open, routeReady, step])

  useEffect(() => {
    if (!open) return
    if (!routeReady) { setAnchor(null); return }
    let target = visibleTarget(step.target) ?? (step.fallback ? visibleTarget(step.fallback) : null)
    setFallback(Boolean(target && target.dataset.tour !== step.target))
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    let frame = 0
    const measure = () => {
      const found = visibleTarget(step.target) ?? (step.fallback ? visibleTarget(step.fallback) : null)
      if (found !== target) {
        target = found
        target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
        if (target) observer.observe(target)
      }
      setFallback(Boolean(target && target.dataset.tour !== step.target))
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const rect = target?.getBoundingClientRect()
      const nextAnchor = rect && rect.bottom > 0 && rect.top < viewport.height ? {
        left: Math.max(8, rect.left - 12), top: Math.max(8, rect.top - 12),
        right: Math.min(viewport.width - 8, rect.right + 12), bottom: Math.min(viewport.height - 8, rect.bottom + 12),
        width: Math.min(viewport.width - 8, rect.right + 12) - Math.max(8, rect.left - 12),
        height: Math.min(viewport.height - 8, rect.bottom + 12) - Math.max(8, rect.top - 12)
      } : null
      setAnchor(nextAnchor)
      setPosition(tourPosition(nextAnchor, { width: 352, height: panelRef.current?.offsetHeight || 290 }, viewport))
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    if (target) observer.observe(target)
    if (panelRef.current) observer.observe(panelRef.current)
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, { childList: true, subtree: true })
    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      observer.disconnect(); mutations.disconnect(); cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [open, step, routeReady])

  return <>
    {saveError && <p role="status" className="fixed bottom-20 right-4 z-40 max-w-80 rounded-lg border bg-background p-3 text-xs text-muted-foreground">Tour closed on this browser. <button type="button" className="text-primary underline underline-offset-2" onClick={() => pendingStatus && save(pendingStatus)}>Retry saving to your account</button></p>}
    <Dialog.Root open={open} onOpenChange={(value) => { if (!value) finish('dismissed') }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
            <defs><filter id={`${maskId}-feather`} x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="6" /></filter><mask id={maskId}><rect width="100%" height="100%" fill="white" />{anchor && <rect x={anchor.left} y={anchor.top} width={anchor.width} height={anchor.height} rx="16" fill="black" filter={`url(#${maskId}-feather)`} />}</mask></defs>
            <rect width="100%" height="100%" fill="rgb(15 23 42 / 0.40)" mask={`url(#${maskId})`} />
          </svg>
        </Dialog.Backdrop>
        <Dialog.Popup ref={panelRef} initialFocus={nextRef} finalFocus={() => document.querySelector<HTMLElement>('[data-tour-replay]') ?? visibleTarget(step.target)} style={position} className="fixed z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none" data-dashboard-tour>
          <div className="px-5 pt-5 pb-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-primary text-[11px] font-semibold tracking-[0.1em] uppercase">Your study desk</span>
              <Dialog.Close render={<Button variant="ghost" size="icon-sm" className="-mr-2 -mt-2 size-9" aria-label="Dismiss tour" />}><XIcon className="size-4" /></Dialog.Close>
            </div>
            <div aria-live="polite" aria-atomic="true">
              <p className="font-data text-muted-foreground mb-2 text-xs">{index + 1} of {TOUR_STEPS.length}</p>
              <Dialog.Title className="font-heading text-xl font-semibold leading-tight tracking-tight">{step.title}</Dialog.Title>
              <Dialog.Description className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.body}</Dialog.Description>
              {(fallback ? step.mobileHint : step.hint) && <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{fallback ? step.mobileHint : step.hint}</p>}
            </div>
            {!routeReady && <p role="status" className="text-muted-foreground mt-3 text-xs">Opening the next page…</p>}
            {routeReady && index > 0 && index < TOUR_STEPS.length - 1 && <button type="button" className="text-primary mt-3 min-h-9 text-xs font-semibold underline-offset-4 hover:underline" onClick={() => finish('dismissed')}>Explore this page</button>}
            <div aria-hidden="true" className="mt-5 flex gap-1">{TOUR_STEPS.map((item, n) => <span key={item.id} className={`h-1 flex-1 rounded-full ${n <= index ? 'bg-primary' : 'bg-muted'}`} />)}</div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-3">
            <Button size="sm" variant="ghost" onClick={() => finish('dismissed')}>Skip tour</Button>
            <div className="flex gap-1">
              {index > 0 && <Button size="sm" variant="ghost" onClick={() => goToStep(index - 1)}>Back</Button>}
              <Button ref={nextRef} size="sm" disabled={!routeReady} onClick={() => index === TOUR_STEPS.length - 1 ? finish('completed') : goToStep(index + 1)}>{index === TOUR_STEPS.length - 1 ? 'Start studying' : 'Next'}<ArrowRightIcon data-icon="inline-end" /></Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
