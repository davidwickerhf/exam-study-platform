import type { Metadata } from 'next'
import { BellIcon, BookOpenIcon, CalendarIcon, ChartNoAxesColumnIcon, FileTextIcon, HouseIcon, SettingsIcon, SparklesIcon, TargetIcon } from 'lucide-react'
import { BrandMark } from '@/components/brand/brand-mark'
import PlanningPrototypePage from '@/app/app/prototypes/planning/page'

export const metadata: Metadata = { title: 'Planning concepts' }

const sections = [
  { label: 'Study', items: [[HouseIcon, 'Home'], [BookOpenIcon, 'Courses'], [TargetIcon, 'Practice'], [BellIcon, 'Updates'], [SparklesIcon, 'Tutor']] },
  { label: 'Plan', items: [[ChartNoAxesColumnIcon, 'Planning'], [CalendarIcon, 'Calendar']] },
  { label: 'Manage', items: [[FileTextIcon, 'Documents'], [SettingsIcon, 'Settings']] },
] as const

export default function PublicPlanningPrototype() {
  return <div data-workspace className="min-h-dvh bg-background text-foreground">
    <div className="grid min-h-dvh md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-sidebar md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b px-4"><BrandMark className="size-9" /><div><strong className="block text-sm">Wicker Study</strong><span className="text-muted-foreground block text-[10px] font-semibold tracking-[0.12em] uppercase">Study desk preview</span></div></div>
        <div className="border-b p-3"><div className="text-muted-foreground flex h-9 items-center justify-between rounded-[6px] border bg-card px-3 text-xs"><span>Search material</span><kbd className="rounded border px-1.5 py-0.5 text-[10px]">⌘K</kbd></div></div>
        <nav className="flex-1 px-3 py-4" aria-label="Preview navigation">{sections.map((section) => <div key={section.label} className="mb-5"><div className="text-muted-foreground px-2 pb-2 text-[10px] font-semibold tracking-[0.11em] uppercase">{section.label}</div>{section.items.map(([Icon, label]) => <div key={label} className={`mb-0.5 flex h-9 items-center gap-3 rounded-[6px] px-2 text-sm ${label === 'Planning' ? 'bg-muted font-semibold text-foreground shadow-[inset_2px_0_0_var(--primary)]' : 'text-muted-foreground'}`}><Icon className="size-4" /><span>{label}</span></div>)}</div>)}</nav>
        <div className="flex h-16 items-center gap-3 border-t px-4"><span className="grid size-9 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">S</span><div className="min-w-0"><strong className="block truncate text-sm">Student</strong><span className="text-muted-foreground block truncate text-xs">Bachelor of Science</span></div></div>
      </aside>
      <main className="min-w-0 overflow-hidden"><PlanningPrototypePage /></main>
    </div>
  </div>
}
