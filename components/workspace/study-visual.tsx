'use client'
import { useId, useState } from 'react'
import { StudyInline } from './study-prose'
import { Button } from '@/components/ui/button'
import type { StudyVisualSpec } from '@/lib/workspace/study-versions'

const palette = ['var(--primary)', '#0f766e', '#b45309', '#64748b']
export function StudyVisual({ visual }: { visual: StudyVisualSpec }) {
  const [selected, setSelected] = useState(0), marker = useId().replaceAll(':', '')
  const d = visual.diagram
  const heading = <div className="mb-5"><p className="mb-2 text-xs font-medium text-muted-foreground">{visual.basis === 'illustrative' ? 'Illustrative example' : 'Based on selected sources'}</p><h4 className="text-lg font-semibold leading-snug">{visual.title}</h4></div>
  let graphic, controls, description, fallback
  if (d.kind === 'process') {
    const pos = (i: number) => ({ x: i % 2 ? 340 : 120, y: 58 + Math.floor(i / 2) * 125 })
    const height = Math.ceil(d.nodes.length / 2) * 125
    const index = Math.min(selected, d.nodes.length - 1)
    graphic = <svg viewBox={`0 0 460 ${height}`} role="img" aria-label={visual.title} className="w-full overflow-visible">
      <defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="currentColor" /></marker></defs>
      {d.edges.map((e, i) => {
        const from = d.nodes.findIndex(n => n.id === e.from), to = d.nodes.findIndex(n => n.id === e.to)
        if (from < 0 || to < 0) return null
        const a = pos(from), b = pos(to), horizontal = a.y === b.y
        const x1 = horizontal ? a.x + (b.x > a.x ? 78 : -78) : a.x
        const x2 = horizontal ? b.x + (b.x > a.x ? -84 : 84) : b.x
        const y1 = horizontal ? a.y : a.y + (b.y > a.y ? 29 : -29)
        const y2 = horizontal ? b.y : b.y + (b.y > a.y ? -35 : 35)
        return <g key={i} className={from === index || to === index ? 'text-primary' : 'text-muted-foreground/50'}>
          <path d={`M ${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth="1.8" markerEnd={`url(#${marker})`} />
        </g>
      })}
      {d.nodes.map((node, i) => { const p = pos(i); return <g key={node.id}>
        <rect x={p.x-78} y={p.y-28} width="156" height="56" rx="10" fill={i === index ? 'var(--primary)' : 'var(--background)'} stroke={i === index ? 'var(--primary)' : 'var(--border)'} />
        <foreignObject x={p.x-73} y={p.y-26} width="146" height="52"><div className="flex h-full items-center justify-center text-center text-[13px] font-medium" style={{color: i === index ? 'var(--primary-foreground)' : 'var(--foreground)'}}><StudyInline>{node.label}</StudyInline></div></foreignObject>
      </g> })}
    </svg>
    controls = <div className="mt-3 flex flex-wrap gap-2" aria-label="Explore diagram nodes">{d.nodes.map((node, i) => <Button key={node.id} size="sm" variant={i === index ? 'secondary' : 'ghost'} aria-pressed={i === index} onClick={() => setSelected(i)} className="h-auto max-w-full whitespace-normal text-left">{i+1}. <StudyInline>{node.label}</StudyInline></Button>)}</div>
    description = <div className="mt-4 border-l-2 border-primary pl-4" aria-live="polite"><p className="text-sm font-medium"><StudyInline>{d.nodes[index].label}</StudyInline></p><p className="mt-1 text-sm leading-relaxed text-muted-foreground"><StudyInline>{d.nodes[index].description}</StudyInline></p><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{d.edges.filter(e => e.from === d.nodes[index].id).map((e,i) => <li key={i}>{e.label || 'Leads to'} → {d.nodes.find(n => n.id === e.to)?.label}</li>)}</ul></div>
    fallback = <ol className="space-y-2">{d.nodes.map(n => <li key={n.id}><strong><StudyInline>{n.label}</StudyInline>:</strong> <StudyInline>{n.description}</StudyInline></li>)}{d.edges.map((e,i) => <li key={`edge-${i}`}>{d.nodes.find(n => n.id === e.from)?.label} → {d.nodes.find(n => n.id === e.to)?.label}: {e.label}</li>)}</ol>
  } else if (d.kind === 'comparison') {
    graphic = <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr><th scope="col" className="p-3 pl-0 text-muted-foreground">Compare</th>{d.columns.map(c => <th scope="col" className="border-b p-3 font-semibold" key={c}><StudyInline>{c}</StudyInline></th>)}</tr></thead><tbody>{d.rows.map((r,i) => <tr key={i} className="border-b last:border-0"><th scope="row" className="py-4 pr-3 align-top font-medium"><StudyInline>{r.label}</StudyInline></th>{r.cells.map((cell,j) => <td key={j} className="px-3 py-4 align-top leading-relaxed text-muted-foreground"><StudyInline>{cell}</StudyInline></td>)}</tr>)}</tbody></table></div>
  } else if (d.kind === 'plot') {
    const points = [...d.points].sort((a,b) => d.style === 'line' ? a.x-b.x : 0)
    const minX = Math.min(...points.map(p=>p.x)), maxX = Math.max(...points.map(p=>p.x))
    const minY = Math.min(0,...points.map(p=>p.y)), maxY = Math.max(0,...points.map(p=>p.y))
    const x = (n:number,i:number) => d.style === 'bar' ? 60+(i+.5)*330/points.length : 60+(n-minX)/(maxX-minX||1)*330
    const y = (n:number) => 220-(n-minY)/(maxY-minY||1)*180
    graphic = <svg viewBox="0 0 460 290" role="img" aria-label={visual.title} className="w-full">
      {[minY,(minY+maxY)/2,maxY].map((v,i)=><g key={i}><line x1="60" x2="400" y1={y(v)} y2={y(v)} stroke="var(--border)" /><text x="52" y={y(v)+4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{Number(v.toPrecision(3))}</text></g>)}
      {d.style === 'line' && <polyline points={points.map((p,i)=>`${x(p.x,i)},${y(p.y)}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="2.5" />}
      {points.map((p,i)=>d.style==='bar'? <rect key={i} x={x(p.x,i)-Math.min(18,120/points.length)} width={Math.min(36,240/points.length)} y={Math.min(y(0),y(p.y))} height={Math.max(1,Math.abs(y(p.y)-y(0)))} fill={palette[i===selected?0:3]} rx="3" /> : <circle key={i} cx={x(p.x,i)} cy={y(p.y)} r={i===selected?6:4} fill="var(--primary)" />)}
      <text x="230" y="278" textAnchor="middle" fontSize="12" fill="var(--foreground)">{d.xLabel}</text><text transform="translate(16,135) rotate(-90)" textAnchor="middle" fontSize="12" fill="var(--foreground)">{d.yLabel}</text>
      {points.filter((_,i)=>points.length<=6 || i===0 || i===points.length-1).map(p=><text key={`${p.x}-${p.label}`} x={x(p.x,points.indexOf(p))} y="246" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{d.style==='line'?p.x:p.label.slice(0,14)}</text>)}
    </svg>
    controls = <label className="mt-4 flex flex-col gap-2 text-sm">Inspect a value<select value={Math.min(selected,points.length-1)} onChange={e=>setSelected(Number(e.target.value))} className="rounded-md border bg-background p-2">{points.map((p,i)=><option key={i} value={i}>{p.label}: {p.y}</option>)}</select></label>
    fallback = <table className="w-full text-left"><thead><tr><th>Label</th><th>{d.xLabel}</th><th>{d.yLabel}</th></tr></thead><tbody>{points.map((p,i)=><tr key={i}><td>{p.label}</td><td>{p.x}</td><td>{p.y}</td></tr>)}</tbody></table>
  } else {
    const mode = ['union','intersection','a','b'][Math.min(selected,3)]
    const a = new Set(d.a), b = new Set(d.b)
    const chosen = d.universe.filter(v=>mode==='union'?a.has(v)||b.has(v):mode==='intersection'?a.has(v)&&b.has(v):mode==='a'?a.has(v):b.has(v))
    graphic = <svg viewBox="0 0 460 280" role="img" aria-label={`${visual.title}. Selected: ${chosen.join(', ') || 'empty set'}`} className="w-full">
      <rect x="14" y="14" width="432" height="250" rx="12" fill="var(--background)" stroke="var(--border)" />
      <defs><clipPath id={marker}><circle cx="178" cy="133" r="87" /></clipPath></defs>
      <circle cx="178" cy="133" r="87" fill={mode==='union'||mode==='a'?'var(--primary)':'transparent'} fillOpacity="0.13" stroke="var(--primary)" strokeWidth="2" />
      <circle cx="282" cy="133" r="87" fill={mode==='union'||mode==='b'?'#0f766e':'transparent'} fillOpacity="0.13" stroke="#0f766e" strokeWidth="2" />
      {mode==='intersection' && <circle cx="282" cy="133" r="87" clipPath={`url(#${marker})`} fill="var(--primary)" fillOpacity="0.22" />}
      <text x="152" y="40" textAnchor="middle" fontSize="13" fill="var(--primary)">{d.aLabel}</text><text x="305" y="40" textAnchor="middle" fontSize="13" fill="#0f766e">{d.bLabel}</text>
      {[d.universe.filter(v=>a.has(v)&&!b.has(v)),d.universe.filter(v=>a.has(v)&&b.has(v)),d.universe.filter(v=>!a.has(v)&&b.has(v)),d.universe.filter(v=>!a.has(v)&&!b.has(v))].map((items,region)=><text key={region} x={[144,230,316,230][region]} y={region===3?246:126} textAnchor="middle" fontSize="13" fill="var(--foreground)">{items.length<=4?items.join(', '):`${items.length} items`}</text>)}
    </svg>
    controls = <div className="mt-3 flex flex-wrap gap-2" aria-label="Set operation">{['Union ∪','Intersection ∩',d.aLabel,d.bLabel].map((label,i)=><Button size="sm" variant={selected===i?'secondary':'outline'} aria-pressed={selected===i} key={i} onClick={()=>setSelected(i)}>{label}</Button>)}</div>
    description = <p className="mt-4 text-sm leading-relaxed" aria-live="polite">Selected {chosen.length} of {d.universe.length} items: <strong>{chosen.join(', ') || '∅ (empty set)'}</strong></p>
    fallback = <div className="space-y-2"><p>Universe: {d.universe.join(', ')}</p><p>{d.aLabel}: {d.a.join(', ') || '∅'}</p><p>{d.bLabel}: {d.b.join(', ') || '∅'}</p><p>The circles show membership, not areas proportional to probability.</p></div>
  }
  return <figure className="rounded-xl border bg-muted/20 p-5 sm:p-6" data-study-visual={d.kind}>{heading}{graphic}{controls}{description}<figcaption className="mt-5 text-sm leading-relaxed text-muted-foreground"><StudyInline>{visual.caption}</StudyInline></figcaption>{fallback && <details className="mt-4 border-t pt-3 text-xs leading-relaxed"><summary className="cursor-pointer font-medium">Read diagram as text</summary><div className="mt-3">{fallback}</div></details>}</figure>
}
