import Link from 'next/link'
import { ArrowRightIcon, CalendarDaysIcon, CheckCircle2Icon, Clock3Icon, FileCheck2Icon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react'

export const courses = [
  { code: 'BCS1110', name: 'Introduction to Computer Science', year: 1, period: 1, ects: 4, state: 'passed' },
  { code: 'BCS1300', name: 'Project 1-1', year: 1, period: 1, ects: 6, state: 'passed' },
  { code: 'BCS1520', name: 'Statistics', year: 1, period: 5, ects: 4, state: 'passed' },
  { code: 'BCS2120', name: 'Introduction to AI', year: 2, period: 1, ects: 4, state: 'passed' },
  { code: 'BCS2420', name: 'Computer Security', year: 2, period: 4, ects: 4, state: 'passed' },
  { code: 'BCS2510', name: 'IT Management & Privacy', year: 3, period: 4, ects: 4, state: 'planned' },
  { code: 'BCS3120', name: 'Ubiquitous Computing', year: 3, period: 1, ects: 4, state: 'resit' },
  { code: 'BCS3500', name: "Bachelor's thesis", year: 3, period: 0, ects: 18, state: 'planned' },
] as const

export const requirements = [
  { label: 'Bachelor total', value: 92, target: 180, source: 'Programme curriculum' },
  { label: 'Year 1 progression', value: 60, target: 60, source: 'Academic record' },
  { label: 'Year 3 electives', value: 16, target: 24, source: 'Curriculum and choices' },
] as const

export const decisions = [
  { icon: CalendarDaysIcon, label: 'Choose the BCS3120 resit', detail: 'Period 1 resit sits with Period 2 exams', date: '14–18 Dec', href: '/app/planning?tab=planner', tone: 'attention' },
  { icon: Clock3Icon, label: 'Confirm Year 3 electives', detail: '8 ECTS remain unselected', date: 'Before 12 Sep', href: '/app/planning?tab=courses', tone: 'neutral' },
  { icon: FileCheck2Icon, label: 'Review transcript version 4', detail: 'Two new passed results detected', date: 'Ready', href: '/app/documents', tone: 'neutral' },
] as const

export const DATA = 'font-data tabular-nums'
export const LABEL = 'text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase'

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  return <span className={`bg-muted block h-1.5 overflow-hidden rounded-full ${className}`}><span className="bg-primary block h-full" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
}

export function ProtoHeader({ title, description }: { title: string; description: string }) {
  return <header className="flex flex-wrap items-end justify-between gap-5 border-b pb-6"><div className="max-w-[68ch]"><h1 className="font-heading text-[32px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1><p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p></div><Link href="/app/planning?tab=planner" className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold">Open Session Board<ArrowRightIcon className="size-3.5" /></Link></header>
}

export function RequirementRows() {
  return <div>{requirements.map((item) => { const percent = item.value / item.target * 100; return <div key={item.label} className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-5 border-t px-5 py-3 first:border-t-0 sm:px-6"><div><strong className="text-sm">{item.label}</strong><span className="text-muted-foreground mt-1 block text-xs">{item.source}</span></div><Bar value={percent} /><span className={`text-xs font-semibold ${percent >= 100 ? 'text-primary' : 'text-muted-foreground'} ${DATA}`}>{item.value}/{item.target}</span></div> })}</div>
}

export const statusIcons = { safe: ShieldCheckIcon, complete: CheckCircle2Icon, attention: TriangleAlertIcon }
