'use client'

/** Home answers what is happening now, what is due, and where the degree stands. */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLinkIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { OnboardingResume } from '@/components/workspace/onboarding-resume'
import {
  type AcademicSummary,
  type CalendarEvent,
  type CalendarPayload,
  awayLabel,
  clockOf,
  dayEntries,
  daysUntil,
  deadlineTitle,
  leadEntry,
  localIsoDate,
  periodWeek,
  roomOf,
  upcomingDeadlines
} from '@/lib/workspace/home.mjs'
import { type StudyCourse, courseProgress, readChapters } from '@/lib/workspace/courses.mjs'

type Announcement = { id: string; title: string; courseCode: string | null; postedAt: string | null; url: string | null }
type Activity = {
  days: number
  streak: number
  activeDays: number
  averageScore: number | null
  week: { total: number }
  previousWeek: number
  series: { date: string; total: number }[]
  recent: { type: string; at: string; courseId: string | null; chapterId: string | null; score: number | null; label: string | null }[]
}

const NUMERALS = 'font-data tabular-nums'

function SectionHead({ title, meta, href }: { title: string; meta?: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {href ? (
        <a href={href} className="text-primary text-xs font-semibold">{meta}</a>
      ) : meta ? (
        <span className={`text-muted-foreground text-sm ${NUMERALS}`}>{meta}</span>
      ) : null}
    </div>
  )
}

export default function HomePage() {
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null)
  const [summary, setSummary] = useState<AcademicSummary | null>(null)
  const [requiredEcts, setRequiredEcts] = useState(0)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [activity, setActivity] = useState<Activity | null>(null)
  const [courses, setCourses] = useState<StudyCourse[]>([])
  const [read, setRead] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setRead(readChapters(window.localStorage))
    const json = (path: string) =>
      fetch(path, { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${path} returned ${response.status}`))))

    json('/api/calendar/events').then((data) => { if (live) setCalendar(data) }).catch((cause: Error) => { if (live) setError(cause.message) })
    json('/api/academics').then((data) => {
      if (!live) return
      setSummary(data.summary)
      setRequiredEcts((data.workspace?.courses ?? []).reduce((total: number, course: { ects?: number }) => total + (course.ects ?? 0), 0))
    }).catch(() => {})
    json('/api/integrations/canvas/hub?scope=current&days=30')
      .then((data) => { if (live) setAnnouncements((data.announcements ?? []).slice(0, 3)) })
      .catch(() => {})
    json('/api/activity?days=28').then((data) => { if (live) setActivity(data) }).catch(() => {})
    json('/api/state').then((data) => { if (live) setCourses((data.courses ?? []).filter((course: StudyCourse) => !course.archived)) }).catch(() => {})
    return () => { live = false }
  }, [])

  const events = calendar?.events ?? []
  const context = calendar?.academicContext ?? null
  const today = localIsoDate()
  const { week, weeks } = periodWeek(context?.start, context?.end, today)

  const entries = useMemo(() => dayEntries(events, today), [events, today])
  const lead = useMemo(() => leadEntry(entries), [entries])
  const rest = useMemo(
    () => entries.filter((entry) => entry.kind === 'teaching' && entry.startsAt > Date.now() && entry.event !== lead?.event),
    [entries, lead]
  )
  const due = useMemo(() => upcomingDeadlines(events), [events])
  const periods = useMemo(
    () => events.filter((event) => event.category === 'period').sort((left, right) => left.start.localeCompare(right.start)),
    [events]
  )
  const institution = useMemo(
    () => events
      .filter((event) => ['exam-week', 'study-week', 'holiday'].includes(event.category) && event.start.slice(0, 10) >= today)
      .sort((left, right) => left.start.localeCompare(right.start))
      .slice(0, 3),
    [events, today]
  )

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8">
        <Empty><EmptyHeader><EmptyTitle>Your week could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8">
      {/* The ruling axis: where the student is in the year. */}
      <header className="flex flex-col gap-2">
        {calendar ? (
          <>
            <h1 className="font-heading text-6xl leading-none tracking-tighter">{context?.period ?? 'No period set'}</h1>
            <p className={`text-muted-foreground text-sm ${NUMERALS}`}>
              {[context?.academicYear, week && weeks ? `week ${week} of ${weeks}` : null].filter(Boolean).join(' · ')}
            </p>
            {periods.length > 0 && (
              <ol className="mt-2 flex gap-[3px]" aria-label="Teaching periods this year">
                {periods.map((period) => {
                  const past = today > (period.end ?? period.start).slice(0, 10)
                  const now = !past && today >= period.start.slice(0, 10)
                  return (
                    <li key={period.id} className="flex flex-1 flex-col gap-1.5">
                      <span className={`h-[3px] ${now ? 'bg-primary' : past ? 'bg-input' : 'bg-border'}`} />
                      <b className={`text-[10px] font-medium ${NUMERALS} ${now ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {period.title.replace(/\D+/g, '')}
                      </b>
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        ) : (
          <><Skeleton className="h-14 w-72" /><Skeleton className="h-4 w-48" /></>
        )}
      </header>

      <div className="grid gap-8 border-t pt-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Lead: what is running, or next. */}
        <div className="flex min-w-0 flex-col">
          {!calendar ? (
            <div className="flex flex-col gap-3"><Skeleton className="h-16 w-56" /><Skeleton className="h-6 w-72" /></div>
          ) : lead ? (
            <>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">
                {lead.startsAt <= Date.now() ? 'On now' : lead.kind === 'due' ? 'Due today' : 'Next up'}
              </p>
              <p className="mt-2 flex items-baseline gap-3">
                <time dateTime={lead.event.start} className={`text-primary text-6xl font-semibold ${NUMERALS} leading-none tracking-tighter`}>
                  {clockOf(lead.event.start)}
                </time>
                <span className="text-muted-foreground text-base font-medium">
                  {lead.startsAt <= Date.now() ? 'in progress' : awayLabel(Math.round((lead.startsAt - Date.now()) / 60_000))}
                </span>
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                {lead.kind === 'due' ? deadlineTitle(lead.event) : lead.event.courseName ?? lead.event.title}
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                {[lead.event.courseCode, lead.kind === 'due' ? 'hand-in' : null, roomOf(lead.event)].filter(Boolean).join(' · ')}
              </p>
              {lead.event.externalHref && (
                <a href={lead.event.externalHref} target="_blank" rel="noopener noreferrer" className="text-primary mt-4 inline-block text-sm font-semibold">
                  Open in Canvas
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">Right now</p>
              <p className="mt-5 max-w-md text-2xl leading-snug font-medium tracking-tight">
                {entries.length ? 'Nothing left today.' : 'Nothing scheduled today.'}
              </p>
              {!entries.length && <OnboardingResume />}
            </>
          )}

          {rest.length > 0 && (
            <ol className="mt-4 flex flex-col border-t pt-4">
              {rest.map((entry) => (
                <li key={entry.event.id} className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-4 py-2">
                  <time dateTime={entry.event.start} className={`text-base font-semibold ${NUMERALS}`}>{clockOf(entry.event.start)}</time>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <strong className="text-[15px] leading-snug font-medium">{entry.event.courseName ?? entry.event.title}</strong>
                    <small className="text-muted-foreground text-xs">
                      {[entry.event.courseCode, roomOf(entry.event)].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:border-l lg:pl-6">
          <section className="flex flex-col gap-1">
            <SectionHead title="Due" meta="All" href="/app/updates" />
            {!calendar ? <Skeleton className="mt-2 h-24 w-full" /> : due.length ? (
              <ul className="flex flex-col">
                {due.map((event, index) => {
                  const away = daysUntil(event.start)
                  return (
                    <li key={event.id} className="grid grid-cols-[3.2rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b py-2 last:border-b-0">
                      <span className={`${NUMERALS} ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        <strong className="text-2xl font-semibold tracking-tight">{Math.max(0, away ?? 0)}</strong>
                        <small className="text-sm">d</small>
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <strong className="text-[15px] leading-snug font-medium break-words">{deadlineTitle(event)}</strong>
                        <small className="text-muted-foreground text-xs">{event.courseCode}</small>
                      </span>
                      {event.externalHref && (
                        <a href={event.externalHref} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label={`Open ${event.title} in Canvas`}>
                          <ExternalLinkIcon className="size-4" />
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="text-muted-foreground py-2 text-sm">Nothing due in the next two weeks.</p>}
          </section>

          {announcements.length > 0 && (
            <section className="flex flex-col gap-1">
              <SectionHead title="From Canvas" meta="Open" href="/app/updates" />
              <ul className="flex flex-col">
                {announcements.map((item) => (
                  <li key={item.id} className="flex flex-col gap-0.5 border-b py-2 last:border-b-0">
                    <strong className="text-[15px] leading-snug font-medium">{item.title}</strong>
                    <small className="text-muted-foreground text-xs">{item.courseCode}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {institution.length > 0 && (
            <section className="flex flex-col gap-1">
              <SectionHead title="At your institution" meta="Calendar" href="/app/calendar" />
              <ul className="flex flex-col">
                {institution.map((event) => (
                  <li key={event.id} className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-baseline gap-3 border-b py-2 last:border-b-0">
                    <span className={`text-muted-foreground ${NUMERALS}`}>
                      <strong className="text-2xl font-semibold tracking-tight">{Math.max(0, daysUntil(event.start) ?? 0)}</strong>
                      <small className="text-sm">d</small>
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="text-[15px] leading-snug font-medium">{event.title}</strong>
                      <small className="text-muted-foreground text-xs">
                        {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(event.start))}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {summary && (
        <section className="flex flex-col gap-4 border-t pt-6">
          <SectionHead title="Progress" meta="Plan" href="/app/planning" />
          <div className="flex max-w-[640px] items-center gap-5">
            <Progress value={requiredEcts ? Math.min(100, (summary.earnedEcts / requiredEcts) * 100) : 0} className="h-1.5" />
            <p className="whitespace-nowrap">
              <strong className={`text-3xl font-semibold tracking-tight ${NUMERALS}`}>{summary.earnedEcts}</strong>
              <small className="text-muted-foreground ml-1.5 text-sm font-medium">of {requiredEcts} ECTS</small>
            </p>
          </div>
          <div className="flex flex-wrap gap-10">
            <span className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">Courses passed</span>
              <strong className={`text-2xl font-semibold tracking-tight ${NUMERALS}`}>
                {summary.passedCourses}<small className="text-muted-foreground ml-1 text-sm font-medium">/ {summary.totalCourses}</small>
              </strong>
            </span>
            {summary.gpa !== null && (
              <span className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">Weighted GPA</span>
                <strong className={`text-2xl font-semibold tracking-tight ${NUMERALS}`}>{summary.gpa}</strong>
              </span>
            )}
            {calendar?.examWindow && (
              <span className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">Exam week in</span>
                <strong className={`text-2xl font-semibold tracking-tight ${NUMERALS}`}>
                  {Math.max(0, daysUntil(calendar.examWindow.start) ?? 0)}<small className="text-muted-foreground ml-1 text-sm font-medium">d</small>
                </strong>
              </span>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-8 border-t pt-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section className="flex min-w-0 flex-col gap-4">
          <SectionHead title="Active courses" meta="All courses" href="/app/courses" />
          {courses.length ? (
            <ol className="flex flex-col">
              {courses.slice(0, 6).map((course) => {
                const progress = courseProgress(course, read)
                return (
                  <li key={course.id}>
                    <Link href={`/app/courses/${course.id}`} className="hover:bg-card grid grid-cols-[5.5rem_minmax(0,1fr)_8rem] items-center gap-4 border-b py-3">
                      <strong className={`text-sm font-semibold ${NUMERALS}`}>{course.code}</strong>
                      <span className="min-w-0 truncate text-[15px] font-medium">{course.name}</span>
                      <span className="flex items-center gap-3">
                        <Progress value={progress.percent} className="h-1 flex-1" />
                        <small className={`text-muted-foreground w-8 text-right ${NUMERALS}`}>{progress.percent}%</small>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-muted-foreground py-3 text-sm">Your active courses will appear here after setup.</p>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          <SectionHead title="Study activity" meta={activity ? `${activity.week.total} this week` : 'Loading'} />
          {activity ? (
            <>
              <div className="flex h-20 items-end gap-1" role="img" aria-label={`${activity.activeDays} active days in the last ${activity.days} days`}>
                {activity.series.map((day) => {
                  const peak = Math.max(1, ...activity.series.map((item) => item.total))
                  return <span key={day.date} title={`${day.date}: ${day.total}`} className={`min-h-px flex-1 ${day.total ? 'bg-primary' : 'bg-border'}`} style={{ height: `${day.total ? Math.max(10, (day.total / peak) * 100) : 2}%` }} />
                })}
              </div>
              <div className="grid grid-cols-3 gap-4 border-t pt-3">
                <span><strong className={`block text-xl ${NUMERALS}`}>{activity.streak}d</strong><small className="text-muted-foreground">streak</small></span>
                <span><strong className={`block text-xl ${NUMERALS}`}>{activity.activeDays}</strong><small className="text-muted-foreground">active days</small></span>
                <span><strong className={`block text-xl ${NUMERALS}`}>{activity.averageScore ?? '—'}</strong><small className="text-muted-foreground">average score</small></span>
              </div>
            </>
          ) : <Skeleton className="h-28 w-full" />}
        </section>
      </div>

    </div>
  )
}
