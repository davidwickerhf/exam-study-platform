'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DegreeRunway } from './degree-runway'
import { RequirementBoard } from './requirement-board'
import { ScenarioLedger } from './scenario-ledger'

const VARIANTS = [
  { name: 'Bachelor Atlas', component: DegreeRunway },
  { name: 'Session Board', component: RequirementBoard },
  { name: 'Scenario Filmstrip', component: ScenarioLedger },
]

export function PlanningPrototypePicker({ initialActive = 0 }: { initialActive?: number }) {
  const [active, setActive] = useState(initialActive)
  const pickerRef = useRef<HTMLElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const moveHighlight = () => {
    const button = buttonRefs.current[active]
    const highlight = highlightRef.current
    if (!button || !highlight) return
    highlight.style.width = `${button.offsetWidth}px`
    highlight.style.transform = `translateX(${button.offsetLeft}px)`
  }

  useEffect(() => {
    let second = 0
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => pickerRef.current?.setAttribute('data-ready', ''))
    })
    return () => {
      window.cancelAnimationFrame(first)
      window.cancelAnimationFrame(second)
    }
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(active + 1))
    window.history.replaceState(null, '', url)
  }, [active])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const number = Number.parseInt(event.key, 10)
      if (number >= 1 && number <= VARIANTS.length) setActive(number - 1)
      else if (event.key === 'ArrowRight') setActive((current) => (current + 1) % VARIANTS.length)
      else if (event.key === 'ArrowLeft') setActive((current) => (current - 1 + VARIANTS.length) % VARIANTS.length)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', moveHighlight)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', moveHighlight)
    }
  }, [active])

  useLayoutEffect(moveHighlight, [active])
  const Variant = VARIANTS[active].component

  return <>
    <Variant key={active} />
    <nav ref={pickerRef} className="proto-picker" aria-label="Prototype variants">
      <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
      {VARIANTS.map((variant, index) => <button key={variant.name} ref={(node) => { buttonRefs.current[index] = node }} className="proto-picker-item" data-active={index === active ? '' : undefined} aria-current={index === active ? 'true' : undefined} onClick={() => setActive(index)}>{variant.name}</button>)}
    </nav>
    <style>{`
.proto-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08) inset, 0 8px 24px rgba(0, 0, 0, 0.24), 0 2px 6px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}
.proto-picker-highlight { position: absolute; top: 4px; left: 0; height: 28px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); will-change: transform; }
.proto-picker[data-ready] .proto-picker-highlight { transition: transform 250ms cubic-bezier(0.23, 1, 0.32, 1), width 250ms cubic-bezier(0.23, 1, 0.32, 1); }
@media (prefers-reduced-motion: reduce) { .proto-picker[data-ready] .proto-picker-highlight { transition: none; } }
.proto-picker-item { position: relative; display: flex; align-items: center; height: 28px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: rgba(255, 255, 255, 0.55); font: inherit; cursor: pointer; transition: color 150ms ease-out; }
.proto-picker-item:hover { color: rgba(255, 255, 255, 0.85); }
.proto-picker-item:active { transform: scale(0.97); }
.proto-picker-item:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.4); outline-offset: 2px; }
.proto-picker-item[data-active] { color: #fff; }
    `}</style>
  </>
}
