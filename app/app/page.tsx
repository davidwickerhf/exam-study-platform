'use client'

/**
 * THESIS: Home is a study itinerary, not a collage of dashboard cards.
 * OWN-WORLD: Warm canvas, white registers, navy ink, one indigo route, compact Archivo typography.
 * STORY: Read what needs attention, act on the current leg, then understand the next academic milestones.
 * FIRST VIEWPORT: Date and period measure above a two-column board; the route owns the left, evidenced priorities lead the right, and the primary action sits inside the dark NOW plane.
 * FORM: Study Itinerary, fifth-ranked grounded structure, seed 29b43344.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ListChecksIcon,
  PlayIcon
} from 'lucide-react'
import { CanvasMark } from '@/components/brand/canvas-mark'
import { buttonVariants } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardTour } from '@/components/workspace/dashboard-tour'
import { DashboardSetupReminder } from '@/components/workspace/onboarding-resume'
import { useWorkspaceData } from '@/hooks/use-workspace-data'
import { supportedCourseAssessment } from '@/lib/course-rule-evidence.mjs'
import { cn } from '@/lib/utils'
import { type CanvasSyncProgress, type CorpusStatus, canvasSyncProgress } from '@/lib/workspace/account.mjs'
import type { Assignment } from '@/lib/workspace/canvas'
import {
  type AcademicSummary,
  type CalendarEvent,
  type CalendarPayload,
  type HomePriority,
  awayLabel,
  clockOf,
  dayEntries,
  daysUntil,
  deadlineTitle,
  homePriorities,
  leadEntry,
  localIsoDate,
  periodWeek,
  roomOf,
  upcomingDeadlines
} from '@/lib/workspace/home.mjs'
import type { Mistake, SrPayload } from '@/lib/workspace/practice.mjs'
import { type StudyCourse, courseProgress, readChapters } from '@/lib/workspace/courses.mjs'

type Activity = {
  days: number
  streak: number
  activeDays: number
  averageScore: number | null
  week: { total: number }
  previousWeek: number
  series: { date: string; total: number }[]
}
type AcademicsPayload = { summary: AcademicSummary; workspace?: { courses?: { ects?: number }[]; calendars?: unknown[] } }
type WorkspaceShell = { courses?: StudyCourse[]; priorityCourses?: StudyCourse[] }
type HubPayload = { connected?: boolean; assignments?: Assignment[] }
type CorpusPayload = { status?: CorpusStatus }
type ActivityCell = (Activity['series'][number] & { future?: boolean; today?: boolean }) | null

const DESIGN_CONTRACT = 'study-itinerary-29b43344'
const NUMERALS = 'font-data tabular-nums'
const LABEL = 'text-muted-foreground text-[11px] font-semibold tracking-[0.09em] uppercase'
const QUIET_LINK = 'text-primary font-medium underline decoration-border underline-offset-4 hover:decoration-current'
const HEAT_LEVEL = [
  'bg-muted ring-1 ring-inset ring-foreground/5',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/65',
  'bg-primary'
] as const

function heatLevel(total: number, peak: number) {
  if (!total) return 0
  return Math.max(1, Math.min(4, Math.ceil((total / peak) * 4)))
}

function activityWeeks(series: Activity['series']): ActivityCell[][] {
  if (!series.length) return []
  const first = new Date(`${series[0].date}T00:00:00Z`)
  const mondayOffset = (first.getUTCDay() + 6) % 7
  const cells: ActivityCell[] = [...Array.from({ length: mondayOffset }, () => null), ...series]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

function periodActivityWeeks(start: string, end: string, weeks: number, series: Activity['series'], today: string): ActivityCell[][] {
  const byDate = new Map(series.map((day) => [day.date, day]))
  const first = new Date(`${start}T00:00:00Z`)
  return Array.from({ length: weeks }, (_, weekIndex) => Array.from({ length: 7 }, (_, dayIndex) => {
    const date = new Date(first)
    date.setUTCDate(first.getUTCDate() + weekIndex * 7 + dayIndex)
    const key = date.toISOString().slice(0, 10)
    if (key > end) return null
    return { date: key, total: byDate.get(key)?.total ?? 0, future: key > today, today: key === today }
  }))
}

function activityLabel(day: NonNullable<ActivityCell>) {
  const date = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  if (day.future) return `${date}: upcoming`
  return `${date}: ${day.total} ${day.total === 1 ? 'study activity' : 'study activities'}`
}

function shortDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`)).replace(/^([^ ]+) /, '$1, ')
}

function distance(value: string | null) {
  const days = daysUntil(value)
  if (days === null) return 'Date not recorded'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  return `${days}d`
}

function SectionHead({ title, meta, href }: { title: string; meta?: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b px-5 py-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {href && meta ? <Link href={href} className="text-primary text-xs font-semibold">{meta}</Link> : meta ? <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{meta}</span> : null}
    </div>
  )
}

function ExternalOrInternalLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return href.startsWith('http')
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link href={href} className={className}>{children}</Link>
}

function PriorityRow({ item }: { item: HomePriority }) {
  return (
    <li className="border-b last:border-b-0">
      <ExternalOrInternalLink href={item.href} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-5 py-3.5">
        <span className={cn('mt-0.5 grid size-8 place-items-center rounded-md', item.rank === 0 ? 'bg-destructive/10 text-destructive' : 'bg-accent text-primary')}>
          {item.kind === 'attendance' || item.kind === 'exam' ? <CalendarDaysIcon className="size-4" /> : item.kind === 'project' ? <ListChecksIcon className="size-4" /> : <CircleAlertIcon className="size-4" />}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="text-sm leading-snug">{item.title}</strong>
            <span className={cn('text-[10px] font-semibold tracking-[0.08em] uppercase', item.rank === 0 ? 'text-destructive' : 'text-primary')}>{item.status}</span>
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">{[item.courseCode, item.source, item.dueText ?? distance(item.dueAt)].filter(Boolean).join(' · ')}</span>
          <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{item.detail}</span>
        </span>
        <ChevronRightIcon className="text-muted-foreground mt-2 size-3.5 transition-transform group-hover:translate-x-0.5" />
      </ExternalOrInternalLink>
    </li>
  )
}

function CanvasSyncWidget({ progress, className }: { progress: CanvasSyncProgress; className?: string }) {
  return (
    <section className={cn("bg-card overflow-hidden rounded-xl border shadow-[var(--shadow-sheet)]", className)} aria-label="Canvas sync status">
      <div className="flex items-start gap-3 px-5 py-4">
        <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg"><CanvasMark className="size-5 text-[#E72429]" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Canvas is syncing</h2>
            {progress.percent != null && <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{progress.percent}%</span>}
          </div>
          <p className="text-muted-foreground mt-1 truncate text-xs">{progress.stage}</p>
          {progress.percent != null
            ? <Progress value={progress.percent} className="mt-3 h-1" />
            : <div className="bg-muted mt-3 h-1 overflow-hidden"><span className="bg-primary block h-full w-1/3 motion-safe:animate-[sync-travel_1.4s_ease-in-out_infinite]" /></div>}
          <p className="text-muted-foreground mt-2 text-xs">
            {progress.totalCourses
              ? `${progress.settledCourses} of ${progress.totalCourses} course editions settled · ${progress.indexedFiles} materials stored`
              : 'Discovering current, upcoming, and related historical course shells.'}
          </p>
        </div>
      </div>
      <Link href="/app/settings/canvas-sync" className="text-primary flex items-center justify-between border-t px-5 py-3 text-xs font-semibold">
        View progress and logs <ChevronRightIcon className="size-3.5" />
      </Link>
    </section>
  )
}

export default function HomePage() {
  const { data: calendar, error: calendarError } = useWorkspaceData<CalendarPayload>('/api/calendar/events')
  const { data: academics, error: academicsError, loading: academicsLoading } = useWorkspaceData<AcademicsPayload>('/api/academics')
  const { data: hub, error: hubError, loading: hubLoading } = useWorkspaceData<HubPayload>('/api/integrations/canvas/hub?scope=current&days=30')
  const { data: activity, error: activityError } = useWorkspaceData<Activity>('/api/activity?days=120')
  const { data: shell, error: shellError, loading: shellLoading } = useWorkspaceData<WorkspaceShell>('/api/workspace-shell')
  const { data: sr, error: srError } = useWorkspaceData<SrPayload>('/api/sr/due')
  const { data: mistakes, error: mistakesError } = useWorkspaceData<Mistake[]>('/api/mistakes?open=true')
  const { data: corpusPayload, refresh: refreshCorpus } = useWorkspaceData<CorpusPayload>('/api/account/integrations/canvas/corpus')
  const [read, setRead] = useState<Set<string>>(() => new Set())

  useEffect(() => { setRead(readChapters(window.localStorage)) }, [])

  const syncProgress = useMemo(() => canvasSyncProgress(corpusPayload?.status), [corpusPayload])
  useEffect(() => {
    if (!syncProgress.active) return
    const poll = () => { if (document.visibilityState === 'visible') refreshCorpus() }
    const timer = window.setInterval(poll, 6_000)
    document.addEventListener('visibilitychange', poll)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', poll) }
  }, [refreshCorpus, syncProgress.active])

  const summary = academics?.summary ?? null
  const hasTimetable = (academics?.workspace?.calendars ?? []).length > 0
  const courses = useMemo(() => (shell?.courses ?? []).filter((course) => !course.archived), [shell])
  const events = calendar?.events ?? []
  const context = calendar?.academicContext ?? null
  const today = localIsoDate()
  const { week, weeks } = periodWeek(context?.start, context?.end, today)
  const entries = useMemo(() => dayEntries(events, today), [events, today])
  const lead = useMemo(() => leadEntry(entries), [entries])
  const due = useMemo(() => upcomingDeadlines(events), [events])
  const institution = useMemo(() => events.filter((event) => ['exam-week', 'study-week'].includes(event.category) && event.start.slice(0, 10) >= today).sort((left, right) => left.start.localeCompare(right.start)), [events, today])
  const periodExam = useMemo(() => events.find((event) => event.category === 'exam-week' && (!context?.start || event.start.slice(0, 10) >= context.start) && (!context?.end || event.start.slice(0, 10) <= context.end)) ?? null, [events, context])
  const nextCourseExam = useMemo(() => events.filter((event) => event.category === 'exam' && event.start.slice(0, 10) >= today && (!context?.start || event.start.slice(0, 10) >= context.start) && (!context?.end || event.start.slice(0, 10) <= context.end)).sort((left, right) => left.start.localeCompare(right.start))[0] ?? null, [context, events, today])
  const examMarker = nextCourseExam ?? periodExam
  const examWeek = useMemo(() => {
    if (!examMarker || !context?.start || !weeks) return null
    const offset = Math.floor((new Date(`${examMarker.start.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${context.start}T00:00:00Z`).getTime()) / 86_400_000 / 7) + 1
    return offset >= 1 && offset <= weeks ? offset : null
  }, [examMarker, context, weeks])
  const routeStops = useMemo(() => {
    const seen = new Set<string>()
    return [...due, ...events.filter((event) => event.category === 'exam' && event.start.slice(0, 10) >= today), ...institution].sort((left, right) => left.start.localeCompare(right.start)).filter((event) => !seen.has(event.id) && Boolean(seen.add(event.id))).slice(0, 2)
  }, [due, events, institution, today])
  const ruleCourses = useMemo(() => (shell?.priorityCourses ?? courses).filter(course => !course.archived), [shell, courses])
  const priorities = useMemo(() => homePriorities({ events, assignments: hub?.assignments ?? [], courses: ruleCourses, limit: 4 }), [events, hub, ruleCourses])
  const verifiedRules = useMemo(() => ruleCourses.filter(course => supportedCourseAssessment(course)).length, [ruleCourses])
  const prioritySources = [
    { label: 'Timetable', ready: hasTimetable, detail: academicsError ? 'Unavailable' : academicsLoading ? 'Checking…' : hasTimetable ? 'Teaching events available' : 'Not connected', href: '/app/setup?checklist=1&step=timetable' },
    { label: 'Canvas', ready: Boolean(hub?.connected), detail: hubError ? 'Unavailable' : hubLoading ? 'Checking…' : hub?.connected ? 'Submission states available' : 'Not connected', href: '/app/settings?tab=connections' },
    { label: 'Course rules', ready: verifiedRules > 0, detail: shellError ? 'Unavailable' : shellLoading ? 'Checking…' : verifiedRules ? `${verifiedRules} verified ${verifiedRules === 1 ? 'course' : 'courses'}` : syncProgress.active ? 'Reading course documents' : 'No supported rules yet', href: '/app/courses' }
  ]
  const priorityLoading = academicsLoading || hubLoading || shellLoading
  const priorityError = academicsError ?? hubError ?? shellError
  const missingPrioritySources = prioritySources.filter((source) => source.detail !== 'Checking…' && !source.ready).length
  const readyPrioritySources = prioritySources.filter((source) => source.ready).map((source) => source.label)
  const unavailablePrioritySources = prioritySources.filter((source) => source.detail === 'Unavailable').map((source) => source.label)
  const disconnectedPrioritySources = prioritySources.filter((source) => !source.ready && source.detail !== 'Unavailable' && source.detail !== 'Checking…').map((source) => source.label)
  const activityByWeek = useMemo(() => context?.start && context?.end && weeks
    ? periodActivityWeeks(context.start, context.end, weeks, activity?.series ?? [], today)
    : activityWeeks((activity?.series ?? []).slice(-28)), [activity, context, today, weeks])
  const activityDays = useMemo(() => activityByWeek.flat().filter((day): day is NonNullable<ActivityCell> => Boolean(day)), [activityByWeek])
  const activityPeak = useMemo(() => Math.max(1, ...activityDays.map((day) => day.total)), [activityDays])
  const periodActiveDays = useMemo(() => activityDays.filter((day) => !day.future && day.total > 0).length, [activityDays])

  if (calendarError) {
    return <div className="mx-auto w-full max-w-[1280px] p-5 sm:p-8"><Empty><EmptyHeader><EmptyTitle>Your week could not be read</EmptyTitle><EmptyDescription>{calendarError.message}</EmptyDescription></EmptyHeader></Empty></div>
  }

  const primaryHref = lead?.kind === 'due' ? (lead.event.externalHref ?? '/app/updates?tab=assignments') : lead ? '/app/calendar' : '/app/practice?tab=questions'
  const primaryLabel = lead?.kind === 'due' ? 'Open assignment' : lead ? 'Open today' : 'Start a practice set'

  return (
    <div data-impeccable-contract={DESIGN_CONTRACT} className="flex min-h-0 w-full flex-col xl:h-dvh xl:overflow-hidden">
      <header className="bg-background sticky top-14 z-10 shrink-0 border-b md:top-0">
        <div className="mx-auto grid w-full max-w-[1280px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)] lg:items-end lg:px-8 lg:py-7">
        <div className="min-w-0">
          {calendar ? (
            <>
              <h1 className="font-heading text-[2rem] leading-none font-semibold tracking-[-0.035em]">{fullDate(today)}</h1>
              <p className={`text-muted-foreground mt-2 text-sm ${NUMERALS}`}>{[context?.period ?? 'No period set', context?.academicYear, week && weeks ? `week ${week} of ${weeks}` : null].filter(Boolean).join(' · ')}</p>
            </>
          ) : <div className="flex flex-col gap-2"><Skeleton className="h-10 w-72 max-w-full" /><Skeleton className="h-4 w-52" /></div>}
          <DashboardTour />
        </div>
        {weeks && week && (
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-4 text-[11px] font-semibold tracking-[0.08em] uppercase">
              <span className="text-muted-foreground">{context?.period ?? 'Teaching period'} · {weeks} weeks</span>
              {examMarker && <span className="text-foreground">{nextCourseExam ? `Next exam${nextCourseExam.courseCode ? ` · ${nextCourseExam.courseCode}` : ''}` : 'Exam week'} · {shortDate(examMarker.start)} · <span className={NUMERALS}>{distance(examMarker.start)}</span></span>}
            </div>
            <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} aria-label={`${context?.period ?? 'Teaching period'}, week ${week} of ${weeks}${examWeek ? `, exam week begins in week ${examWeek}` : ''}`}>
              {Array.from({ length: weeks }, (_, index) => index + 1).map((number) => (
              <li key={number} className="flex min-w-0 flex-col gap-2">
                <span className={cn('h-1', number === week ? 'bg-primary' : number < week ? 'bg-primary/35' : number === examWeek ? 'bg-foreground' : 'bg-border')} />
                <span className={cn('flex items-center justify-between gap-1 text-[11px] font-semibold', NUMERALS, number === week ? 'text-primary' : number === examWeek ? 'text-foreground' : 'text-muted-foreground')}><span>W{number}</span>{number === examWeek && <span className="font-sans text-[10.5px] tracking-[0.08em] uppercase max-sm:sr-only">Exam</span>}</span>
              </li>
              ))}
            </ol>
          </div>
        )}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1280px] min-w-0 gap-7 px-4 py-6 sm:px-6 lg:px-8 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1.58fr)_minmax(19rem,0.72fr)] xl:overflow-hidden xl:py-0">
        <section className="min-w-0 xl:overflow-y-auto xl:overscroll-contain xl:py-6 xl:pr-3 xl:[scrollbar-gutter:stable]" aria-labelledby="route-heading" data-route-scroll-region>
          <div data-tour="today" className="flex items-baseline justify-between gap-4 border-b pb-3">
            <h2 id="route-heading" className="text-lg font-semibold tracking-tight">Your study route</h2>
            <Link href="/app/calendar" className="text-primary text-xs font-semibold">Full calendar</Link>
          </div>

          {summary && (
            <dl className="grid grid-cols-2 border-b sm:grid-cols-4" data-study-summary>
              {[
                ['Credits earned', `${summary.earnedEcts} ECTS`, 'From your academic record'],
                ['Courses passed', `${summary.passedCourses}`, 'From your academic record'],
                ['Study streak', activity ? `${activity.streak} ${activity.streak === 1 ? 'day' : 'days'}` : activityError ? 'Unavailable' : '—', 'Consecutive days in Wicker'],
                ['Study actions', activity ? `${activity.week.total}` : activityError ? 'Unavailable' : '—', 'Last 7 days in Wicker']
              ].map(([label, value, detail], index) => <div key={label} className={cn('border-r px-3 py-4 first:pl-0 last:border-r-0 sm:px-5', index < 2 && 'max-sm:border-b', index % 2 === 1 && 'max-sm:border-r-0')}><dt className={LABEL}>{label}</dt><dd className={`mt-1 text-xl font-semibold tracking-tight ${NUMERALS}`}>{value}</dd><dd className="text-muted-foreground mt-1 text-[11px] leading-relaxed">{detail}</dd></div>)}
            </dl>
          )}

          {syncProgress.active && <CanvasSyncWidget progress={syncProgress} className="mt-4 xl:hidden" />}

          <div className="relative mt-6 pl-9 sm:pl-12" data-study-route>
            {routeStops.length > 0 && <>
              <span aria-hidden="true" className="bg-border absolute top-4 bottom-8 left-[11px] w-px sm:left-[15px]" />
              <span aria-hidden="true" className="bg-primary absolute top-4 bottom-8 left-[11px] w-px origin-top motion-safe:animate-[route-reveal_650ms_cubic-bezier(0.16,1,0.3,1)_both] sm:left-[15px]" />
            </>}

            <div className="relative">
              <span aria-hidden="true" className="border-background bg-primary ring-primary absolute top-5 -left-[34px] size-[18px] rounded-full border-4 ring-1 sm:-left-[43px] sm:size-5" />
              <p className="text-primary mb-2 text-xs font-semibold tracking-[0.08em] uppercase">Now</p>
              <div className="bg-foreground text-card overflow-hidden rounded-xl shadow-[var(--shadow-sheet)]">
                <div className="p-5 sm:p-7 lg:p-8">
                  {calendar ? (
                  <div className="grid gap-5 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
                    <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-white/8 text-white/80"><CalendarDaysIcon className="size-5" /></span>
                    <div className="min-w-0">
                      {lead?.event.start && <p className={`text-primary-foreground/65 mb-2 text-sm ${NUMERALS}`}>{[clockOf(lead.event.start), roomOf(lead.event)].filter(Boolean).join(' · ')}</p>}
                      <h3 className="font-heading text-[clamp(1.65rem,3vw,2.3rem)] leading-[1.05] font-semibold tracking-[-0.03em]">
                        {lead ? (lead.kind === 'due' ? deadlineTitle(lead.event) : lead.event.courseName ?? lead.event.title) : entries.length ? 'Nothing left today' : 'Nothing scheduled today'}
                      </h3>
                      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-white/70">
                        {lead ? [lead.event.courseCode, lead.kind === 'due' ? 'Hand-in deadline' : lead.startsAt <= Date.now() ? 'In progress' : awayLabel(Math.round((lead.startsAt - Date.now()) / 60_000))].filter(Boolean).join(' · ') : hasTimetable ? 'Your timetable has no more appointments today. Use the open space for the next useful study action.' : 'Connect your timetable to place lectures, tutorials, labs and rooms directly on this route.'}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-5">
                        <ExternalOrInternalLink href={primaryHref} className={cn(buttonVariants({ size: 'lg' }), 'min-w-fit bg-primary text-primary-foreground hover:bg-primary/90')}>
                          <PlayIcon data-icon="inline-start" />{primaryLabel}
                        </ExternalOrInternalLink>
                        {!lead && <Link href="/app/practice" className="text-sm font-semibold text-white/70 underline decoration-white/25 underline-offset-4 hover:text-white">Choose another activity</Link>}
                      </div>
                    </div>
                  </div>
                  ) : <div className="flex flex-col gap-3"><Skeleton className="h-8 w-64 bg-white/15" /><Skeleton className="h-4 w-80 max-w-full bg-white/10" /></div>}
                </div>
                {!hasTimetable && calendar && <p className="border-t border-white/15 px-5 py-4 text-sm text-white/70 sm:px-7 lg:px-8">Want classes on the route? <Link href="/app/setup?checklist=1&step=timetable" className="font-semibold text-white underline decoration-white/30 underline-offset-4">Connect your timetable</Link>.</p>}
              </div>
            </div>

            <ol className="mt-2 flex flex-col">
              {routeStops.map((event, index) => (
                <li key={event.id} className="relative border-b py-5 last:border-b-0">
                  <span aria-hidden="true" className="border-background bg-card ring-primary absolute top-7 -left-[31px] size-3 rounded-full border-[3px] ring-1 sm:-left-[41px] sm:size-4" />
                  <Link href="/app/calendar" className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 sm:gap-5">
                    <span aria-hidden="true" className="bg-muted text-foreground grid size-10 place-items-center rounded-lg"><CalendarDaysIcon className="size-5" /></span>
                    <span className="min-w-0">
                      <span className="text-primary text-[11px] font-semibold tracking-[0.08em] uppercase">{index === 0 ? 'Next' : 'Later'}</span>
                      <strong className="mt-1 block text-lg leading-snug tracking-tight">{['canvas-deadline', 'exam'].includes(event.category) ? deadlineTitle(event) : event.title}</strong>
                      <span className="text-muted-foreground mt-1 block text-sm">{[event.courseCode, shortDate(event.start), event.category === 'canvas-deadline' ? 'Assignment' : event.category === 'exam' ? 'Exam plan' : 'Academic calendar'].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`flex items-center gap-3 ${NUMERALS}`}>
                      <strong className="font-heading text-2xl tracking-tight">{Math.max(0, daysUntil(event.start) ?? 0)}<small className="ml-0.5 text-sm font-medium">d</small></strong>
                      <ArrowRightIcon className="text-muted-foreground size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
              {calendar && routeStops.length === 0 && <li className="text-muted-foreground py-6 text-sm">No upcoming deadlines or academic milestones are recorded.</li>}
            </ol>
          </div>

        </section>

        <aside className="flex h-fit min-w-0 flex-col gap-4 xl:h-auto xl:overflow-y-auto xl:overscroll-contain xl:py-6 xl:pr-2 xl:[scrollbar-gutter:stable] [&>section]:shrink-0" aria-label="Study status" data-status-scroll-region>
          <DashboardSetupReminder />
          {syncProgress.active && <CanvasSyncWidget progress={syncProgress} className="hidden xl:block" />}
          <section className="bg-accent/35 overflow-hidden rounded-xl border shadow-[var(--shadow-sheet)]">
            <SectionHead title="Priorities" meta={priorities.length ? `${priorities.length} active${missingPrioritySources || priorityError ? ' · partial' : ''}` : missingPrioritySources ? 'Partial view' : 'Clear'} href="/app/updates?tab=assignments" />
            {priorities.length ? <><ul>{priorities.map((item) => <PriorityRow key={item.id} item={item} />)}</ul><p className="text-muted-foreground border-t px-5 py-3 text-xs leading-relaxed">Available evidence: {readyPrioritySources.join(', ') || 'none yet'}.{unavailablePrioritySources.length ? ` Could not read: ${unavailablePrioritySources.join(', ')}.` : ''}{disconnectedPrioritySources.length ? ` Still checking: ${disconnectedPrioritySources.join(', ')}.` : ''}</p></> : priorityLoading ? (
              <div className="space-y-3 px-5 py-5"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>
            ) : priorityError ? (
              <div>
                <div className="px-5 py-5"><p className="text-sm font-semibold">Some priority sources could not be read.</p><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Unavailable sources are not treated as disconnected or clear.</p></div>
                <ul className="border-t">
                  {prioritySources.map((source) => <li key={source.label} className="flex items-center gap-3 border-b px-5 py-3 text-xs last:border-b-0"><span className={cn('grid size-5 place-items-center rounded-full', source.ready ? 'bg-primary text-primary-foreground' : 'border bg-card text-muted-foreground')}>{source.ready ? <CheckIcon className="size-3" /> : <span aria-hidden="true">·</span>}</span><span className="font-semibold">{source.label}</span><Link href={source.href} className="text-muted-foreground ml-auto hover:text-foreground">{source.detail}</Link></li>)}
                </ul>
              </div>
            ) : (
              <div>
                <div className="px-5 py-5">
                <p className="text-sm font-semibold">Nothing flagged in the sources currently connected.</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">This view only makes claims it can trace to a timetable, Canvas, or a verified course rule.</p>
                </div>
                <ul className="border-t">
                  {prioritySources.map((source) => <li key={source.label} className="flex items-center gap-3 border-b px-5 py-3 text-xs last:border-b-0"><span className={cn('grid size-5 place-items-center rounded-full', source.ready ? 'bg-primary text-primary-foreground' : 'border bg-card text-muted-foreground')}>{source.ready ? <CheckIcon className="size-3" /> : <span aria-hidden="true">·</span>}</span><span className="font-semibold">{source.label}</span><Link href={source.href} className="text-muted-foreground ml-auto hover:text-foreground">{source.detail}</Link></li>)}
                </ul>
              </div>
            )}
          </section>

          <section className="bg-card overflow-hidden rounded-xl border">
            <SectionHead title="Attendance" meta="By course" href="/app/courses" />
            {calendar?.attendance?.summary?.scheduled ? <>
              <dl className="grid grid-cols-3 border-b">
                {[
                  ['Rate', calendar.attendance.summary.rate == null ? '—' : `${calendar.attendance.summary.rate}%`],
                  ['Missed', calendar.attendance.summary.missed],
                  ['Unmarked', calendar.attendance.summary.unmarked]
                ].map(([label, value]) => <div key={label} className="border-r px-4 py-3 last:border-r-0"><dt className={LABEL}>{label}</dt><dd className={`mt-1 text-xl font-semibold ${NUMERALS}`}>{value}</dd></div>)}
              </dl>
              <ol>
                {calendar.attendance.courses.slice(0, 3).map((course) => <li key={course.courseCode || course.courseName} className="border-b last:border-b-0"><Link href={course.editorialCourseId ? `/app/courses/${course.editorialCourseId}#attendance` : '/app/courses'} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5"><span className={cn('grid size-8 place-items-center rounded-md', course.atRisk ? 'bg-destructive/10 text-destructive' : 'bg-accent text-primary')}><CalendarCheckIcon className="size-4" /></span><span className="min-w-0"><strong className="block truncate text-sm">{course.courseCode || course.courseName}</strong><small className="text-muted-foreground mt-0.5 block truncate text-xs">{course.allowedMisses == null ? `${course.missed} missed · ${course.unmarked} unmarked` : `${course.requiredMissed} of ${course.allowedMisses} allowed misses used`}</small></span><span className={`flex items-center gap-2 text-sm font-semibold ${NUMERALS}`}>{course.rate == null ? '—' : `${course.rate}%`}<ChevronRightIcon className="text-muted-foreground size-3.5 transition-transform group-hover:translate-x-0.5" /></span></Link></li>)}
              </ol>
            </> : <div className="px-5 py-5"><p className="text-sm font-semibold">No attendance record yet</p><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Connect a timetable, then mark lectures, tutorials, and labs from Calendar.</p><Link href={hasTimetable ? '/app/calendar?view=timeGridWeek' : '/app/settings?tab=connections'} className="text-primary mt-3 inline-flex text-xs font-semibold">{hasTimetable ? 'Open calendar' : 'Connect timetable'}</Link></div>}
          </section>

          <section className="bg-card overflow-hidden rounded-xl border">
            <SectionHead title="Study queue" meta="Open practice" href="/app/practice" />
            <ul>
              {[
                { label: 'Questions', detail: courses.length ? `${courses.length} active courses` : 'No active courses', value: courses.length ? 'Ready' : '—', href: '/app/practice?tab=questions', icon: BookOpenIcon },
                { label: 'Flashcards', detail: srError ? 'temporarily unavailable' : 'due for review', value: sr ? String(sr.dueCount) : '—', href: '/app/practice?tab=flashcards', icon: ListChecksIcon },
                { label: 'Mistakes', detail: mistakesError ? 'temporarily unavailable' : 'open to correct', value: mistakes ? String(mistakes.length) : '—', href: '/app/practice?tab=mistakes', icon: CircleAlertIcon }
              ].map((item) => (
                <li key={item.label} className="border-b last:border-b-0">
                  <Link href={item.href} className="group grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-3.5">
                    <span className="bg-accent text-primary grid size-8 place-items-center rounded-md"><item.icon className="size-4" /></span>
                    <span className="min-w-0"><strong className="block text-sm">{item.label}</strong><small className="text-muted-foreground block text-xs">{item.detail}</small></span>
                    <strong className={`text-sm ${NUMERALS}`}>{item.value}</strong>
                    <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-card overflow-hidden rounded-xl border">
            <SectionHead title="Course readiness" meta="All courses" href="/app/courses" />
            {courses.length ? <ol>{courses.slice(0, 4).map((course) => {
              const progress = courseProgress(course, read)
              return (
                <li key={course.id} className="border-b last:border-b-0">
                  <Link href={`/app/courses/${course.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4">
                    <span className="min-w-0"><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{course.code}</span><strong className="mt-0.5 block truncate text-sm">{course.name}</strong><Progress value={progress.percent} className="mt-2 h-1" /></span>
                    <span className={`flex items-center gap-2 self-center text-lg font-semibold ${NUMERALS}`}>{progress.percent}%<ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" /></span>
                  </Link>
                </li>
              )
            })}</ol> : <p className="text-muted-foreground px-5 py-5 text-sm">Set your programme to build the course route. <Link href="/app/setup" className={QUIET_LINK}>Open setup</Link></p>}
          </section>

          <section className="bg-card relative overflow-hidden rounded-xl border" data-activity-heatmap>
            <SectionHead title={context?.period ? `${context.period} activity` : 'Recent activity'} meta={activity ? `${periodActiveDays} active days` : activityError ? 'Unavailable' : 'Loading'} />
            {activity ? <>
              <div className="px-5 py-4">
              <div className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2.5" aria-hidden="true">
                <span />
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${activityByWeek.length}, minmax(0, 1fr))` }}>
                  {activityByWeek.map((_, index) => <span key={index} className={cn(`text-muted-foreground text-center text-xs font-medium leading-none ${NUMERALS}`, index + 1 === week && 'text-primary', index + 1 === examWeek && 'text-foreground')}>W{index + 1}</span>)}
                </div>
                <div className={`text-muted-foreground grid grid-rows-7 gap-1 text-xs leading-none ${NUMERALS}`}>
                  {['M', '', 'W', '', 'F', '', ''].map((label, index) => <span key={index} className="flex h-2.5 items-center">{label}</span>)}
                </div>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${activityByWeek.length}, minmax(0, 1fr))` }}>
                  {activityByWeek.map((days, weekIndex) => <div key={weekIndex} className={cn('grid grid-rows-7 justify-items-center gap-1', weekIndex + 1 === examWeek && 'relative before:absolute before:-inset-x-1 before:-inset-y-1 before:-z-10 before:rounded-md before:bg-muted/60')}>
                    {days.map((day, dayIndex) => day
                      ? <span key={day.date} title={activityLabel(day)} className={cn('size-2.5 rounded-[2px]', day.future ? 'bg-background ring-1 ring-inset ring-border' : HEAT_LEVEL[heatLevel(day.total, activityPeak)], day.today && 'outline-primary outline outline-1 outline-offset-1')} />
                      : <span key={`empty-${dayIndex}`} aria-hidden="true" className="size-2.5" />)}
                  </div>)}
                </div>
              </div>
              <ol className="sr-only" aria-label={`${periodActiveDays} active days in ${context?.period ?? `the last ${activity.days} days`}${examWeek ? `; exam week begins in week ${examWeek}` : ''}`}>
                {activityDays.map((day) => <li key={day.date}>{activityLabel(day)}</li>)}
              </ol>
              </div>
              <div className={`text-muted-foreground flex min-h-10 items-center justify-between gap-3 border-t px-5 py-2.5 text-xs ${NUMERALS}`} aria-hidden="true">
                <span>{examWeek ? `Exam week · W${examWeek}` : 'Today is outlined'}</span>
                <span className="flex items-center gap-1"><span className="mr-0.5">Less</span>{HEAT_LEVEL.map((tone, index) => <span key={index} className={`size-2.5 rounded-[2px] ${tone}`} />)}<span className="ml-0.5">More</span></span>
              </div>
            </> : activityError ? <p className="text-muted-foreground px-5 py-5 text-xs">Activity is temporarily unavailable.</p> : <div className="px-5 py-5"><Skeleton className="h-20 w-full" /></div>}
          </section>
        </aside>
      </div>
    </div>
  )
}
