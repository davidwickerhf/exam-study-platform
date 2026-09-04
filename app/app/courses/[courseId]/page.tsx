'use client'

/**
 * A course: its chapter register first, then how well it is known.
 *
 * The chapters are the course; everything else on this page is about them, so
 * the register leads and mastery, material and plan links follow it. Mastery
 * is a heatmap — one ruled row per topic, five cells — rather than sixty
 * segmented buttons, because a student reads this to find the weak topic, not
 * to admire the control.
 *
 * Read-state is shared with the vanilla workspace through localStorage, so a
 * chapter marked read in either half shows as read in both.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CalendarCheckIcon, CheckIcon, ChevronRightIcon, CircleAlertIcon, ExternalLinkIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { COURSE_RETURN_KEY, academicCourseFor, type AcademicCourse, type Item, type StudyCourse, canvasCourseQuery, courseProgress, nextExam, readChapters } from '@/lib/workspace/courses.mjs'
import { type CalendarEvent, type CalendarPayload, localIsoDate } from '@/lib/workspace/home.mjs'
import { CourseMaterialLibrary } from '@/components/workspace/course-material-library'

const NUMERALS = 'font-data tabular-nums'
const LEVELS = [0, 1, 2, 3, 4]
/** A rating the student has actually given, as opposed to an untouched zero. */
const isRated = (item: Item) => Boolean(item.masteryUpdatedAt)

export default function CoursePage() {
  const params = useParams<{ courseId: string; itemId?: string }>()
  const [courses, setCourses] = useState<StudyCourse[] | null>(null)
  const [academic, setAcademic] = useState<AcademicCourse[]>([])
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null)
  const [read, setRead] = useState<Set<string>>(new Set())
  // A failed save is not a failed page: the two are kept apart so a mastery
  // click that loses the network does not replace the course with an error.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setRead(readChapters(typeof window === 'undefined' ? null : window.localStorage))
    const json = (path: string) =>
      fetch(path, { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${path} returned ${response.status}`))))
    json('/api/state').then((data) => { if (live) setCourses(data.courses ?? []) })
      .catch((cause: Error) => { if (live) setLoadError(cause.message) })
    json('/api/academics').then((data) => { if (live) setAcademic(data.workspace?.courses ?? []) }).catch(() => {})
    json('/api/calendar/events').then((data) => { if (live) setCalendar(data) }).catch(() => {})
    return () => { live = false }
  }, [])

  const course = useMemo(
    () => (courses ?? []).find((entry) => entry.id === params.courseId) ?? null,
    [courses, params.courseId]
  )
  const today = localIsoDate()

  useEffect(() => {
    const itemId = params.itemId ?? new URLSearchParams(window.location.search).get('item')
    const item = course?.items?.find((entry) => entry.id === itemId)
    if (item) requestAnimationFrame(() => document.querySelector(`[aria-label="Mastery for ${CSS.escape(item.title)}"]`)?.closest('li')?.scrollIntoView({ block: 'center' }))
  }, [course, params.itemId])

  if (loadError || (courses && !course)) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{loadError ? 'That course could not be read' : 'No such course'}</EmptyTitle>
            <EmptyDescription>{loadError ?? 'It may have been archived or renamed.'}</EmptyDescription>
          </EmptyHeader>
          <Link href="/app/courses" className="text-primary text-sm font-semibold">Back to courses</Link>
        </Empty>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 p-5 sm:p-8">
        <Skeleton className="h-10 w-96" /><Skeleton className="h-4 w-64" /><Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const progress = courseProgress(course, read)
  const exam = nextExam(course, academic, today)
  const academicCourse = academicCourseFor(course, academic)
  const profile = course.courseProfile
  const items = course.items ?? []
  const rated = items.filter(isRated).length
  const confident = items.filter((item) => isRated(item) && (item.mastery ?? 0) >= 4).length
  const attendance = calendar?.attendance?.courses.find((entry) => String(entry.courseCode || '').toUpperCase() === String(course.code || '').toUpperCase()) ?? null
  const attendanceEvents = (calendar?.events ?? []).filter((event) => event.attendanceEligible && String(event.courseCode || '').toUpperCase() === String(course.code || '').toUpperCase()).sort((left, right) => right.start.localeCompare(left.start))

  const setMastery = async (itemId: string, mastery: number) => {
    setSaving(itemId); setSaveError(null)
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ mastery }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `Mastery returned ${response.status}`)
      setCourses((current) => current?.map((entry) => entry.id === course.id ? { ...entry, items: entry.items?.map((item) => item.id === itemId ? { ...item, ...data.item } : item) } : entry) ?? null)
    } catch (cause) { setSaveError((cause as Error).message) } finally { setSaving(null) }
  }

  const archive = async () => {
    setSaving('archive'); setSaveError(null)
    try {
      const response = await fetch(`/api/courses/${encodeURIComponent(course.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ archived: !course.archived }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `Course update returned ${response.status}`)
      setCourses((current) => current?.map((entry) => entry.id === course.id ? { ...entry, archived: data.course.archived } : entry) ?? null)
    } catch (cause) { setSaveError((cause as Error).message) } finally { setSaving(null) }
  }

  /** One 0–4 cell. The level a student has chosen carries the signal; an
   *  untouched topic and an explicit zero are both neutral marks. */
  const cell = (item: Item, level: number) => {
    const set = isRated(item)
    const value = item.mastery ?? 0
    const state = !set ? 'unset' : level < value ? 'below' : level === value ? 'current' : 'above'
    const tone =
      state === 'current' && value > 0 ? 'bg-primary border-primary'
        : state === 'current' ? 'bg-muted-foreground border-muted-foreground'
          : state === 'below' ? 'bg-border border-border'
            : 'border-border bg-transparent'
    return (
      <button
        key={level}
        type="button"
        onClick={() => void setMastery(item.id, level)}
        disabled={saving === item.id}
        aria-pressed={set && level === value}
        aria-label={`${item.title}: mastery ${level}${level === 0 ? ' (not started)' : level === 4 ? ' (confident)' : ''}`}
        className={`size-4 rounded-[2px] border transition-colors hover:border-input disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 p-5 sm:p-8">
      {/* Identity: what this is, how far in, when it is examined. */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className={`text-muted-foreground text-sm font-semibold ${NUMERALS}`}>{course.code}</p>
          <button
            type="button"
            onClick={() => void archive()}
            disabled={saving === 'archive'}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2 disabled:opacity-50"
          >
            {saving === 'archive' ? 'Saving…' : course.archived ? 'Unarchive course' : 'Archive course'}
          </button>
        </div>
        <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{course.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="flex items-center gap-3">
            <Progress value={progress.percent} className="h-1 w-40" />
            <span className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {progress.done} of {progress.total} read
            </span>
          </span>
          {progress.mastery !== null && (
            <span className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {progress.mastery}% mastery · {rated} of {items.length} topics rated
            </span>
          )}
          {exam && (
            <span className={`text-xs ${NUMERALS}`}>
              <span className="text-primary font-semibold">
                {exam.days === 0 ? 'Exam today' : `Exam in ${exam.days} days`}
              </span>
              <span className="text-muted-foreground">
                {' · '}{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(exam.date))}
              </span>
            </span>
          )}
          {course.archived && <span className="text-muted-foreground text-xs">Archived</span>}
        </div>
      </header>

      {saveError && <p role="alert" className="text-destructive border-y py-2 text-sm">{saveError}</p>}

      <section id="attendance" className="scroll-mt-8 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b px-5 py-4">
          <div><h2 className="text-base font-semibold">Attendance</h2><p className="text-muted-foreground mt-1 text-xs">Teaching sessions from your timetable, tied to this course.</p></div>
          <Link href="/app/calendar?view=timeGridWeek" className="text-primary text-xs font-semibold">Open calendar</Link>
        </div>
        {attendance ? <>
          <dl className="grid grid-cols-2 border-b sm:grid-cols-4">
            {[
              ['Attendance', attendance.rate == null ? '—' : `${attendance.rate}%`],
              ['Attended', attendance.attended],
              ['Missed', attendance.missed],
              ['Unmarked', attendance.unmarked]
            ].map(([label, value], index) => <div key={label} className={`border-r px-5 py-4 last:border-r-0 ${index < 2 ? 'max-sm:border-b' : ''} ${index === 1 ? 'max-sm:border-r-0' : ''}`}><dt className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">{label}</dt><dd className={`mt-1 text-2xl font-semibold ${NUMERALS}`}>{value}</dd></div>)}
          </dl>
          {(attendance.requiredScheduled > 0 || attendance.rule) && <div className="bg-accent/35 border-b px-5 py-4">
            <div className="flex items-start gap-3"><span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md"><CalendarCheckIcon className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-sm">Required attendance</strong><span className={`text-sm font-semibold ${NUMERALS}`}>{attendance.requiredRate == null ? 'No marked sessions' : `${attendance.requiredRate}%`}</span></div><p className="text-muted-foreground mt-1 text-xs">{attendance.allowedMisses == null ? `${attendance.requiredMissed} required ${attendance.requiredMissed === 1 ? 'session' : 'sessions'} missed` : `${attendance.requiredMissed} of ${attendance.allowedMisses} allowed misses used · ${attendance.allowedMissesRemaining} remaining`}</p>{attendance.rule && <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-xs font-semibold">View verified rule</summary><p className="text-muted-foreground mt-2 text-xs leading-relaxed">{attendance.rule}</p><p className="text-primary mt-1 text-[11px] font-semibold">{attendance.ruleSource}</p></details>}</div></div>
          </div>}
          <div>
            <div className="flex items-center justify-between border-b px-5 py-3"><h3 className="text-sm font-semibold">Session history</h3><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{attendanceEvents.length} scheduled</span></div>
            {attendanceEvents.slice(0, 8).map((event: CalendarEvent) => <div key={event.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b px-5 py-3 last:border-b-0"><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(event.start))}</span><span className="min-w-0"><strong className="block truncate text-sm">{event.activity || event.title}</strong><small className="text-muted-foreground mt-0.5 block truncate text-xs">{event.attendanceRequired ? 'Required' : 'Not required'}{event.attendancePolicy?.allowedMisses != null ? ` · ${event.attendancePolicy.allowedMisses} allowed misses` : ''}</small></span><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${event.attendanceStatus === 'missed' ? 'bg-destructive/10 text-destructive' : event.attendanceStatus === 'attended' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{event.attendanceStatus === 'attended' ? 'Attended' : event.attendanceStatus === 'missed' ? 'Missed' : event.attendanceStatus === 'excused' ? 'Excused' : 'Unmarked'}</span></div>)}
          </div>
        </> : <div className="flex items-start gap-3 px-5 py-6"><CircleAlertIcon className="text-muted-foreground mt-0.5 size-4" /><div><p className="text-sm font-semibold">No teaching sessions are connected yet</p><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Connect a timetable in Settings to track attendance for this course.</p></div></div>}
      </section>

      {/* The register. The course is its chapters, so they come first. */}
      <section className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between border-b pb-2">
          <h2 className="text-base font-semibold">Chapters</h2>
          <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{progress.done} read of {progress.total}</span>
        </div>
        {!course.chapters?.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No chapters published yet</EmptyTitle>
              <EmptyDescription>This course is recognised, but its material has not been produced.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {course.chapters.map((chapter) => {
              const done = read.has(`${course.id}/${chapter.id}`)
              return (
                <li key={chapter.id}>
                  <Link
                    href={`/app/courses/${course.id}/${chapter.id}`}
                    // So the reader's back link can be a real history step and
                    // return the register to where it was left.
                    onClick={() => { try { window.sessionStorage.setItem(COURSE_RETURN_KEY, `/app/courses/${course.id}`) } catch { /* private mode */ } }}
                    className="hover:bg-card group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b px-2 py-3"
                  >
                    <span className={`text-muted-foreground text-sm font-semibold ${NUMERALS}`}>{chapter.id}</span>
                    <span className="text-[15px] font-medium">{chapter.name}</span>
                    <span className="text-muted-foreground flex items-center gap-3 text-xs">
                      {done && <span className="text-foreground inline-flex items-center gap-1"><CheckIcon className="size-3.5" /> Read</span>}
                      <ChevronRightIcon className="group-hover:text-foreground size-4" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Mastery at a glance: a register of topics, not a wall of controls. */}
      {!!items.length && (
        <section className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-2">
            <h2 className="text-base font-semibold">Topic mastery</h2>
            <span className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {rated} of {items.length} rated · {confident} confident · {progress.mastery ?? 0}% overall
            </span>
          </div>
          <p className="text-muted-foreground text-xs">Five cells per topic: 0 not started, 4 confident. Select a cell to record where you are.</p>
          <ul className="mt-1 grid md:grid-cols-2 md:gap-x-10">
            {items.map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-2">
                <Link
                  href={`/app/courses/${course.id}/item/${item.id}`}
                  className="hover:text-foreground text-muted-foreground truncate text-[13.5px]"
                  title={item.title}
                >
                  {item.title}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-1" role="group" aria-label={`Mastery for ${item.title}`} aria-busy={saving === item.id}>
                    {LEVELS.map((level) => cell(item, level))}
                  </span>
                  <span className={`text-muted-foreground w-3 text-right text-xs ${NUMERALS}`}>
                    {isRated(item) ? item.mastery ?? 0 : '–'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div id="course-material" className="scroll-mt-8">
        <CourseMaterialLibrary courseCode={course.code} />
      </div>

      {profile && (profile.description || profile.learningOutcomes?.length || profile.assessment?.components?.length) && <section className="flex max-w-[74ch] flex-col gap-4"><div className="flex items-baseline justify-between border-b pb-2"><h2 className="text-base font-semibold">Course information</h2>{profile.assessment?.status && <span className="rounded-full border px-2 py-0.5 text-xs font-semibold">{profile.assessment.status === 'confirmed' ? 'Assessment verified' : 'Assessment under review'}</span>}</div>{profile.description && <p className="text-muted-foreground leading-relaxed">{profile.description}</p>}{profile.assessment?.components?.length && <div className="flex flex-col">{profile.assessment.components.map((component, index) => <div key={`${component.name}-${index}`} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 border-b py-3"><strong className={`text-[21px] ${NUMERALS}`}>{component.weightPercent == null ? '—' : `${component.weightPercent}%`}</strong><div><h3 className="font-semibold">{component.name}</h3><p className="text-muted-foreground text-sm">{[component.type, component.minimumPercent != null ? `minimum ${component.minimumPercent}%` : null, component.deadline || component.deadlineText].filter(Boolean).join(' · ')}</p></div></div>)}</div>}{profile.learningOutcomes?.length && <details><summary className="cursor-pointer text-sm font-semibold">Learning outcomes ({profile.learningOutcomes.length})</summary><ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">{profile.learningOutcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul></details>}</section>}

      {/* Everything that leaves this course: one ruled row each, no boxes. */}
      <section className="flex flex-col">
        <h2 className="border-b pb-2 text-base font-semibold">Elsewhere</h2>
        {(course.mockExams?.length || course.mockExamPdf) ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-3">
            <div>
              <h3 className="text-sm font-medium">Past-paper practice</h3>
              <p className="text-muted-foreground text-xs">Stored exam papers with question guidance and answer grading.</p>
            </div>
            <Link href={`/app/courses/${course.id}/mock-exam`} className="text-primary shrink-0 text-sm font-semibold">Open papers</Link>
          </div>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-3">
          <div>
            <h3 className="text-sm font-medium">Personal plan</h3>
            <p className="text-muted-foreground text-xs">
              {academicCourse
                ? 'Connected by course code. Exam dates and attempts stay in your private programme record.'
                : 'Not in your active programme. Add this course code to connect dates, credits and attempts.'}
            </p>
          </div>
          <Link href="/app/planning" className="text-primary shrink-0 text-sm font-semibold">Open Planning</Link>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-3">
          <div>
            <h3 className="text-sm font-medium">Private Canvas archive</h3>
            <p className="text-muted-foreground text-xs">Choose modules and download a private source archive for this class.</p>
          </div>
          <Link href={`/canvas?course=${encodeURIComponent(canvasCourseQuery(course))}`} className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
            Open archive <ExternalLinkIcon className="size-3.5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
