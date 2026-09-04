'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DegreeAtlas } from './degree-atlas'
import { EvidenceBrief } from './evidence-brief'
import { StatusDecisions } from './status-decisions'

const variants = [
  { name: 'Status & Decisions', component: StatusDecisions },
  { name: 'Degree Atlas', component: DegreeAtlas },
  { name: 'Evidence Brief', component: EvidenceBrief },
]

export function PlanningOverviewPicker() {
  const [current, setCurrent] = useState(0)
  const picker = useRef<HTMLElement>(null)
  const highlight = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])

  const select = (index: number) => {
    if (index < 0 || index >= variants.length) return
    setCurrent(index)
    const url = new URL(location.href)
    url.searchParams.set('v', String(index + 1))
    history.replaceState(null, '', url)
  }
  const moveHighlight = () => {
    const element = items.current[current]
    if (!element || !highlight.current) return
    highlight.current.style.width = `${element.offsetWidth}px`
    highlight.current.style.transform = `translateX(${element.offsetLeft}px)`
  }
  useEffect(() => {
    const value = Number(new URLSearchParams(location.search).get('v')) || 1
    setCurrent(Math.max(0, Math.min(variants.length - 1, value - 1)))
  }, [])
  useLayoutEffect(() => {
    moveHighlight()
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => picker.current?.setAttribute('data-ready', '')))
    return () => cancelAnimationFrame(frame)
  }, [current])
  useEffect(() => {
    const resize = () => moveHighlight()
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable || event.metaKey || event.ctrlKey || event.altKey) return
      const number = Number.parseInt(event.key, 10)
      if (number >= 1 && number <= variants.length) select(number - 1)
      else if (event.key === 'ArrowRight') select((current + 1) % variants.length)
      else if (event.key === 'ArrowLeft') select((current - 1 + variants.length) % variants.length)
    }
    addEventListener('resize', resize); addEventListener('keydown', key)
    return () => { removeEventListener('resize', resize); removeEventListener('keydown', key) }
  }, [current])
  const Variant = variants[current].component
  return <><div key={current}><Variant /></div><nav ref={picker} className="proto-picker" aria-label="Prototype variants"><span ref={highlight} className="proto-picker-highlight" aria-hidden="true" />{variants.map((variant, index) => <button key={variant.name} ref={(node) => { items.current[index] = node }} className="proto-picker-item" data-active={current === index ? '' : undefined} aria-current={current === index ? 'true' : undefined} onClick={() => select(index)}>{variant.name}</button>)}</nav><style jsx global>{`
.proto-picker { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 2147483647; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; background: rgba(10, 10, 10, 0.82); -webkit-backdrop-filter: blur(12px) saturate(1.4); backdrop-filter: blur(12px) saturate(1.4); box-shadow: 0 0 0 1px rgba(255,255,255,.08) inset, 0 8px 24px rgba(0,0,0,.24), 0 2px 6px rgba(0,0,0,.12); font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size: 13px; line-height: 1; -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none; }
.proto-picker-highlight { position: absolute; top: 4px; left: 0; height: 28px; border-radius: 999px; background: rgba(255,255,255,.12); will-change: transform; }
.proto-picker[data-ready] .proto-picker-highlight { transition: transform 250ms cubic-bezier(.23,1,.32,1), width 250ms cubic-bezier(.23,1,.32,1); }
@media (prefers-reduced-motion: reduce) { .proto-picker[data-ready] .proto-picker-highlight { transition: none; } }
.proto-picker-item { position: relative; display: flex; align-items: center; height: 28px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: rgba(255,255,255,.55); font: inherit; cursor: pointer; transition: color 150ms ease-out; }
.proto-picker-item:hover { color: rgba(255,255,255,.85); }
.proto-picker-item:active { transform: scale(.97); }
.proto-picker-item:focus-visible { outline: 2px solid rgba(255,255,255,.4); outline-offset: 2px; }
.proto-picker-item[data-active] { color: #fff; }
.proto-picker-divider { width: 1px; height: 16px; margin: 0 4px; background: rgba(255,255,255,.12); }
.proto-picker-replay { padding: 0 10px; font-size: 14px; }
.proto-picker[data-position="top"] { bottom: auto; top: 24px; }
`}</style></>
}
