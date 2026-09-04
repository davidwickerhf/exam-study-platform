'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => value * value * (3 - 2 * value)

const fragmentAngles: Record<string, number> = {
  priority: 0,
  exam: 0,
  activity: 0,
  queue: 0
}

export function LandingHeroSequence({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const sticky = root.querySelector<HTMLElement>('.landing-hero-sticky')
    const copy = root.querySelector<HTMLElement>('[data-assembly-copy]')
    const frame = root.querySelector<HTMLElement>('[data-assembly-frame]')
    const field = root.querySelector<HTMLElement>('.hero-live-field')
    const cue = root.querySelector<HTMLElement>('.assembly-scroll-cue')
    const fragments = Array.from(root.querySelectorAll<HTMLElement>('[data-assembly-source]'))
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!sticky || !copy || !frame || fragments.length === 0) return

    let animationFrame = 0
    let frameIsActive: boolean | null = null
    let geometry: Array<{ element: HTMLElement; dx: number; dy: number; angle: number }> = []

    const resetMobileState = () => {
      frameIsActive = null
      root.style.removeProperty('--hero-progress')
      copy.style.removeProperty('opacity')
      copy.style.removeProperty('transform')
      copy.style.removeProperty('pointer-events')
      copy.removeAttribute('inert')
      copy.removeAttribute('aria-hidden')
      frame.style.removeProperty('opacity')
      frame.style.removeProperty('transform')
      frame.style.removeProperty('pointer-events')
      frame.removeAttribute('inert')
      frame.removeAttribute('aria-hidden')
      field?.style.removeProperty('opacity')
      cue?.style.removeProperty('opacity')
      fragments.forEach((fragment) => {
        fragment.style.removeProperty('opacity')
        fragment.style.removeProperty('transform')
      })
    }

    const measure = () => {
      if (window.innerWidth <= 820) {
        geometry = []
        return
      }

      const frameTransform = frame.style.transform
      const fragmentTransforms = fragments.map((fragment) => fragment.style.transform)
      frame.style.transform = 'none'
      fragments.forEach((fragment) => { fragment.style.transform = 'none' })

      geometry = fragments.flatMap((element) => {
        const name = element.dataset.assemblySource
        const target = name ? root.querySelector<HTMLElement>(`[data-assembly-target="${name}"]`) : null
        if (!name || !target) return []
        const sourceRect = element.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        return [{
          element,
          dx: Math.round(targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2)),
          dy: Math.round(targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2)),
          angle: fragmentAngles[name] ?? 0
        }]
      })

      frame.style.transform = frameTransform
      fragments.forEach((fragment, index) => { fragment.style.transform = fragmentTransforms[index] })
    }

    const render = () => {
      animationFrame = 0
      if (window.innerWidth <= 820) {
        resetMobileState()
        return
      }

      const rootRect = root.getBoundingClientRect()
      const travel = Math.max(1, root.offsetHeight - sticky.offsetHeight)
      const progress = clamp(-rootRect.top / travel)
      const assemble = smooth(clamp((progress - 0.12) / 0.58))
      const frameIn = smooth(clamp((progress - 0.18) / 0.5))
      const copyOut = smooth(clamp((progress - 0.08) / 0.38))
      const fragmentOut = clamp((progress - 0.64) / 0.12)
      const showFrame = progress >= 0.46
      root.style.setProperty('--hero-progress', String(progress))

      if (showFrame !== frameIsActive) {
        frameIsActive = showFrame
        frame.toggleAttribute('inert', !showFrame)
        frame.setAttribute('aria-hidden', showFrame ? 'false' : 'true')
        copy.toggleAttribute('inert', showFrame)
        copy.setAttribute('aria-hidden', showFrame ? 'true' : 'false')
        frame.style.pointerEvents = showFrame ? 'auto' : 'none'
        copy.style.pointerEvents = showFrame ? 'none' : 'auto'
      }

      if (motionQuery.matches) {
        copy.style.opacity = showFrame ? '0' : '1'
        copy.style.transform = 'translate(-50%, -50%)'
        frame.style.opacity = showFrame ? '1' : '0'
        frame.style.transform = 'none'
        if (field) field.style.opacity = showFrame ? '0' : '1'
        if (cue) cue.style.opacity = showFrame ? '0' : '1'
        geometry.forEach(({ element, angle }) => {
          element.style.opacity = showFrame ? '0' : '1'
          element.style.transform = `rotate(${angle}deg)`
        })
        return
      }

      copy.style.opacity = String(1 - copyOut)
      copy.style.transform = `translate(-50%, -50%) translateY(${Math.round(-48 * copyOut)}px)`
      frame.style.opacity = String(frameIn)
      frame.style.transform = frameIn > 0.995 ? 'none' : `translateY(${Math.round((1 - frameIn) * 160)}px)`
      if (field) field.style.opacity = String(1 - frameIn)
      if (cue) cue.style.opacity = String(1 - smooth(clamp((progress - 0.06) / 0.3)))

      geometry.forEach(({ element, dx, dy, angle }) => {
        element.style.opacity = String(1 - fragmentOut)
        element.style.transform = assemble < 0.002 ? 'none' : `translate(${Math.round(dx * assemble)}px, ${Math.round(dy * assemble)}px) rotate(${angle * (1 - assemble)}deg)`
      })
    }

    const requestRender = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(render)
    }

    const handleReducedMotion = () => {
      root.dataset.reducedMotion = motionQuery.matches ? 'true' : 'false'
      requestRender()
    }

    measure()
    handleReducedMotion()
    render()
    window.addEventListener('scroll', requestRender, { passive: true })
    window.addEventListener('resize', measure)
    window.addEventListener('resize', requestRender)
    motionQuery.addEventListener('change', handleReducedMotion)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', requestRender)
      window.removeEventListener('resize', measure)
      window.removeEventListener('resize', requestRender)
      motionQuery.removeEventListener('change', handleReducedMotion)
      frame.removeAttribute('inert')
      frame.removeAttribute('aria-hidden')
      copy.removeAttribute('inert')
      copy.removeAttribute('aria-hidden')
      frame.style.removeProperty('pointer-events')
      copy.style.removeProperty('pointer-events')
    }
  }, [])

  return (
    <section ref={rootRef} className="landing-hero" aria-label="Wicker Study product overview">
      <div className="landing-hero-sticky">{children}</div>
    </section>
  )
}
