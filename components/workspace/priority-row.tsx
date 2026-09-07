"use client"
import Link from 'next/link'
import { CalendarDaysIcon, ListChecksIcon, CircleAlertIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysUntil, type HomePriority } from '@/lib/workspace/home.mjs'
const distance = (date: string | null) => { const days=daysUntil(date); return days === null ? 'No date recorded' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `in ${days}d` }
export function PriorityRow({ item }: { item: HomePriority }) {
  return (
    <li className="border-b last:border-b-0">
      <Link href={item.href} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-5 py-3.5">
        <span className={cn('mt-0.5 grid size-8 place-items-center rounded-md', item.rank === 0 ? 'bg-destructive/10 text-destructive' : 'bg-accent text-primary')}>
          {item.kind === 'attendance' || item.kind === 'exam' ? <CalendarDaysIcon className="size-4" /> : item.kind === 'project' ? <ListChecksIcon className="size-4" /> : <CircleAlertIcon className="size-4" />}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="text-sm leading-snug">{item.title}</strong>
            <span className={cn('text-[10px] font-semibold tracking-[0.08em] uppercase', item.rank === 0 ? 'text-destructive' : 'text-primary')}>{item.status}</span>
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">{[item.courseCode, item.source, item.dueText ?? (item.kind === 'attendance' ? `Next session ${distance(item.dueAt)}` : distance(item.dueAt))].filter(Boolean).join(' · ')}</span>
          <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{item.detail}</span>
          {item.occurrences && item.occurrences > 1 ? <span className="text-muted-foreground mt-1 block text-xs">{item.occurrences - 1} later {item.occurrences === 2 ? 'session' : 'sessions'} in your timetable</span> : null}
        </span>
        <ChevronRightIcon className="text-muted-foreground mt-2 size-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}

