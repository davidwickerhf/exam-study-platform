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
import { ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, CalendarCheckIcon, CheckIcon, ChevronRightIcon, CircleAlertIcon, ExternalLinkIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { COURSE_RETURN_KEY, type AcademicCourse, type Item, type StudyCourse, canvasCourseQuery, courseProgress, nextExam, readChapters } from '@/lib/workspace/courses.mjs'
import { type CalendarEvent, type CalendarPayload, localIsoDate } from '@/lib/workspace/home.mjs'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CourseAttemptHistory } from '@/components/workspace/course-attempt-history'
import { courseDetail, courseDetailTab, courseAttemptHistory, type CourseTab } from '@/lib/workspace/course-detail.mjs'
import type { Catalogue, ProgrammeTemplate, CorpusCourse, CurrentCourse } from '@/lib/workspace/course-ledger.mjs'
import CourseLoading from './loading'
import { CourseMaterialLibrary } from '@/components/workspace/course-material-library'

const NUMERALS = 'font-data tabular-nums'
const LEVELS = [0, 1, 2, 3, 4]
/** A rating the student has actually given, as opposed to an untouched zero. */
const isRated = (item: Item) => Boolean(item.masteryUpdatedAt)

export default function CoursePage() {
  const params = useParams<{ courseId: string; itemId?: string }>()
  const [courses, setCourses] = useState<StudyCourse[] | null>(null)
  const [academic, setAcademic] = useState<AcademicCourse[]>([])
  const [academicLoading, setAcademicLoading] = useState(true)
  const [catalogueLoading, setCatalogueLoading] = useState(true)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [academicError, setAcademicError] = useState<string | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [programmeTemplate, setProgrammeTemplate] = useState<ProgrammeTemplate>(null)
  const [corpus, setCorpus] = useState<CorpusCourse[]>([])
  const [currentCourses, setCurrentCourses] = useState<CurrentCourse[]>([])
  const [corpusError, setCorpusError] = useState<string | null>(null)
  const [pendingSources, setPendingSources] = useState(5)
  const [reload, setReload] = useState(0)
  const [tab, setTab] = useState<CourseTab>('study')
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null)
  const [read, setRead] = useState<Set<string>>(new Set())
  // A failed save is not a failed page: the two are kept apart so a mastery
  // click that loses the network does not replace the course with an error.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setPendingSources(5); setCorpusError(null); setAcademicLoading(true); setCatalogueLoading(true); setCalendarLoading(true); setAcademicError(null); setLoadError(null); setCalendarError(null)
    setRead(readChapters(window.localStorage))
    const json = (path: string) => fetch(path, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('This source could not be loaded.')))
    const settled = () => { if (live) setPendingSources(value => value - 1) }
    void json('/api/state').then(data => { if (live) setCourses(data.courses ?? []) }).catch(() => { if (live) setLoadError('Study material could not be loaded.') }).finally(settled)
    void json('/api/academics').then(data => { if (live) { setAcademic(data.workspace?.courses ?? []); setProgrammeTemplate(data.workspace?.programmeTemplate ?? null) } })
      .catch(() => { if (live) setAcademicError('Your academic record could not be loaded.') }).finally(() => { if (live) setAcademicLoading(false); settled() })
    void json('/api/onboarding/programmes').then(data => { if (live) setCatalogue(data) }).catch(() => { if (live) setAcademicError('Course identities could not be checked. Try loading your record again.') }).finally(() => { if (live) setCatalogueLoading(false); settled() })
    void json('/api/account/integrations/canvas/corpus').then(data => { if (live) setCorpus(data.status?.courses ?? []) }).catch(() => { if (live) setCorpusError('Canvas course information could not be loaded.') }).finally(settled)
    void json('/api/calendar/events').then(data => { if (live) { setCalendar(data); setCurrentCourses(data.currentCourses ?? []) } }).catch(() => { if (live) setCalendarError('Attendance could not be loaded.') }).finally(() => { if (live) setCalendarLoading(false); settled() })
    return () => { live = false }
  }, [reload])

  useEffect(() => {
    const readTab = () => setTab(courseDetailTab(window.location.search, window.location.hash))
    readTab()
    window.addEventListener('popstate', readTab); window.addEventListener('hashchange', readTab)
    return () => { window.removeEventListener('popstate', readTab); window.removeEventListener('hashchange', readTab) }
  }, [params.courseId])

  const selectTab = (value: CourseTab) => {
    setTab(value)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', value); url.hash = ''
    window.history.replaceState(null, '', url)
  }
  const entry = useMemo(() => courseDetail(params.courseId, { editorial: courses, academic, catalogue, programmeTemplate, corpus, currentCourses }), [params.courseId, courses, academic, catalogue, programmeTemplate, corpus, currentCourses])
  const course: StudyCourse | null = useMemo(() => entry ? { ...(entry.editorial ?? { id: entry.academic?.id || entry.code, chapters: [], items: [] }), code: entry.code, name: entry.name } : null, [entry])
  const today = localIsoDate()

  useEffect(() => {
    const itemId = params.itemId ?? new URLSearchParams(window.location.search).get('item')
    const item = course?.items?.find((entry) => entry.id === itemId)
    if (item) requestAnimationFrame(() => document.querySelector(`[aria-label="Mastery for ${CSS.escape(item.title)}"]`)?.closest('li')?.scrollIntoView({ block: 'center' }))
  }, [course, params.itemId])

  if (!course && pendingSources === 0) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{loadError || academicError || corpusError || calendarError ? 'That course could not be read' : 'No such course'}</EmptyTitle>
            <EmptyDescription>{loadError ?? academicError ?? corpusError ?? calendarError ?? 'It may have been archived or renamed.'}</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => setReload(value => value + 1)}>Try again</Button><Link href="/app/courses" className="text-primary text-sm font-semibold">Back to courses</Link>
        </Empty>
      </div>
    )
  }

  if (!course) return <CourseLoading />

  const progress = courseProgress(course, read)
  const academicCourse = entry?.academic ?? null
  const exam = nextExam(course, academicCourse ? [{ ...academicCourse, code: course.code }] : [], today)
  const attempts = courseAttemptHistory(academicCourse)
  const latest = attempts[0]
  const nextChapter = course.chapters?.find(chapter => !read.has(`${course.id}/${chapter.id}`)) ?? course.chapters?.[0]
  const retry = () => setReload(value => value + 1)
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
        className={`size-7 rounded-[3px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring hover:border-input disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
      />
    )
  }

  return (
    <main className="flex w-full min-w-0 flex-col" data-course-detail>
      <header className="border-b bg-background px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto max-w-[1280px]">
          <Link href="/app/courses" className="text-muted-foreground mb-4 inline-flex min-h-8 items-center gap-2 text-xs hover:text-foreground"><ArrowLeftIcon className="size-3.5" />All courses</Link>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0 flex-1"><p className={`text-primary mb-2 text-xs font-semibold tracking-[0.08em] ${NUMERALS}`}>{course.code}{course.archived ? ' · Archived' : ''}</p><h1 className="font-heading max-w-[28ch] text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{course.name}</h1><p className="text-muted-foreground mt-2 text-sm">{[academicCourse?.yearLevel, academicCourse?.period, academicCourse?.ects == null ? null : `${academicCourse.ects} ECTS`].filter(Boolean).join(' · ') || 'Study material and your personal course record'}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {nextChapter && <Link className={buttonVariants({ size: 'sm' })} href={`/app/courses/${course.id}/${nextChapter.id}`}>{progress.done ? 'Continue reading' : 'Start reading'}<ArrowRightIcon data-icon="inline-end" /></Link>}
              {(course.mockExams?.length || course.mockExamPdf) ? <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/app/courses/${course.id}/mock-exam`}>Past papers</Link> : null}
              {entry?.editorial && <Button variant="ghost" size="sm" onClick={() => void archive()} disabled={saving === 'archive'}>{saving === 'archive' ? 'Saving…' : course.archived ? 'Unarchive' : 'Archive'}</Button>}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1280px] min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {saveError && <p role="alert" className="text-destructive border-y py-2 text-sm">{saveError}</p>}
        <section className="overflow-hidden rounded-xl bg-foreground text-card" aria-label="Course overview">
          <div className="grid divide-y divide-white/15 md:grid-cols-[1.2fr_1fr_1fr] md:divide-x md:divide-y-0">
            <div className="px-5 py-5 sm:px-6"><p className="text-[10px] font-semibold tracking-[0.1em] text-white/65 uppercase">Latest recorded sitting</p><p className={`mt-2 text-2xl font-semibold ${NUMERALS}`}>{academicLoading || catalogueLoading ? 'Reading record…' : academicError ? 'Record unavailable' : latest?.academicYear || 'Not recorded'}</p><p className="mt-1 text-xs text-white/70">{academicError ? 'Retry from Attempt history' : latest ? [({passed:'Passed',failed:'Failed','no-show':'No show',upcoming:'Upcoming'} as Record<string,string>)[latest.status || ''] || 'Result not recorded', latest.grade == null ? null : `Grade ${latest.grade}`].filter(Boolean).join(' · ') : 'Your attempts will appear here'}</p></div>
            <div className="px-5 py-5 sm:px-6"><p className="text-[10px] font-semibold tracking-[0.1em] text-white/65 uppercase">Reading progress</p><p className={`mt-2 text-2xl font-semibold ${NUMERALS}`}>{entry?.editorial ? `${progress.done} / ${progress.total}` : '—'}</p><p className="mt-1 text-xs text-white/70">{progress.total ? 'Published chapters marked read' : 'No published chapters yet'}</p></div>
            <div className="px-5 py-5 sm:px-6"><p className="text-[10px] font-semibold tracking-[0.1em] text-white/65 uppercase">Next recorded exam</p><p className={`mt-2 text-2xl font-semibold ${NUMERALS}`}>{exam ? new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short'}).format(new Date(exam.date)) : '—'}</p><p className="mt-1 text-xs text-white/70">{exam ? exam.days === 0 ? 'Today' : `In ${exam.days} days` : 'No future exam date recorded'}</p></div>
          </div>
        </section>
        <Tabs value={tab} onValueChange={value => selectTab(value as CourseTab)} className="min-w-0 gap-6">
          <TabsList variant="line" className="h-11 w-full max-w-full justify-start gap-5 overflow-x-auto rounded-none border-b p-0">
            {([['study','Study'],['history','Attempt history'],['materials','Materials'],['attendance','Attendance'],['about','Course details']] as const).map(([value,label]) => <TabsTrigger key={value} value={value} className="h-11 flex-none px-0 text-[13px] after:bg-primary group-data-horizontal/tabs:after:-bottom-px">{label}{value === 'history' && !academicLoading && !academicError && attempts.length > 0 && <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{attempts.length}</span>}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="study" className="min-w-0">
            <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex min-w-0 flex-col gap-6">
                {loadError && <p role="alert" className="text-sm">{loadError} <button className="text-primary underline" onClick={retry}>Try again</button></p>}
      {/* The register. The course is its chapters, so they come first. */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-baseline justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold">Chapters</h2>
          <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{progress.done} read of {progress.total}</span>
        </div>
        {!course.chapters?.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No study chapters yet</EmptyTitle>
              <EmptyDescription>Published chapters will appear when study material is added. You can still view your academic record and original course material using the tabs above.</EmptyDescription>
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
                    className="hover:bg-card group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b px-5 py-4 last:border-b-0 sm:px-6"
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
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-2">
            <h2 className="text-base font-semibold">Topic mastery</h2>
            <span className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {rated} of {items.length} rated · {confident} confident · {progress.mastery ?? 0}% overall
            </span>
          </div>
          <p className="text-muted-foreground text-xs">Five cells per topic: 0 not started, 4 confident. Select a cell to record where you are.</p>
          <ul className="mt-1 grid gap-x-8 2xl:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
                <Link
                  href={`/app/courses/${course.id}/item/${item.id}`}
                  className="hover:text-foreground text-muted-foreground min-w-0 flex-1 text-[13.5px]"
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


              </div>
              <aside className="flex min-w-0 flex-col gap-5">
                <CourseAttemptHistory compact course={academicCourse} loading={academicLoading || catalogueLoading} error={academicError} retry={retry} onExpand={() => selectTab('history')} />
                <div className="rounded-xl border bg-card px-5 py-4"><h2 className="text-sm font-semibold">Original course material</h2><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Find documents and recordings by academic year, including earlier sittings.</p><Button variant="ghost" size="sm" className="text-primary -ml-3 mt-2" onClick={() => selectTab('materials')}>Browse material <ArrowRightIcon data-icon="inline-end" /></Button></div>
                {!entry?.editorial && academicCourse?.id && <Link href={`/app/course-request/${encodeURIComponent(academicCourse.id)}`} className="text-primary inline-flex min-h-9 items-center gap-2 text-xs font-semibold"><BookOpenIcon className="size-4" />Request study chapters</Link>}
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="history" className="min-w-0"><CourseAttemptHistory course={academicCourse} loading={academicLoading || catalogueLoading} error={academicError} retry={retry} /></TabsContent>
          <TabsContent value="materials" className="min-w-0"><div id="course-material" className="rounded-xl border bg-card p-5 sm:p-6"><CourseMaterialLibrary courseCode={course.code} /></div></TabsContent>
          <TabsContent value="attendance" className="min-w-0">
      <section id="attendance" className="scroll-mt-8 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b px-5 py-4">
          <div><h2 className="text-base font-semibold">Attendance</h2><p className="text-muted-foreground mt-1 text-xs">Teaching sessions from your timetable, tied to this course.</p></div>
          <Link href="/app/calendar?view=timeGridWeek" className="text-primary text-xs font-semibold">Open calendar</Link>
        </div>
        {calendarLoading ? <p role="status" className="text-muted-foreground px-5 py-6 text-sm">Reading attendance…</p> : calendarError ? <div role="alert" className="px-5 py-6"><p className="text-sm">{calendarError}</p><Button variant="outline" size="sm" className="mt-3" onClick={retry}>Try again</Button></div> : attendance ? <>
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

          </TabsContent>
          <TabsContent value="about" className="flex min-w-0 flex-col gap-6">
      {profile && (profile.description || profile.learningOutcomes?.length || profile.assessment?.components?.length) && <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6"><div className="flex items-baseline justify-between border-b pb-2"><h2 className="text-base font-semibold">Course information</h2>{profile.assessment?.status && <span className="rounded-full border px-2 py-0.5 text-xs font-semibold">{profile.assessment.status === 'confirmed' ? 'Assessment verified' : 'Assessment under review'}</span>}</div>{profile.description && <p className="text-muted-foreground leading-relaxed">{profile.description}</p>}{profile.assessment?.components?.length && <div className="flex flex-col">{profile.assessment.components.map((component, index) => <div key={`${component.name}-${index}`} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 border-b py-3"><strong className={`text-[21px] ${NUMERALS}`}>{component.weightPercent == null ? '—' : `${component.weightPercent}%`}</strong><div><h3 className="font-semibold">{component.name}</h3><p className="text-muted-foreground text-sm">{[component.type, component.minimumPercent != null ? `minimum ${component.minimumPercent}%` : null, component.deadline || component.deadlineText].filter(Boolean).join(' · ')}</p></div></div>)}</div>}{profile.learningOutcomes?.length && <details><summary className="cursor-pointer text-sm font-semibold">Learning outcomes ({profile.learningOutcomes.length})</summary><ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">{profile.learningOutcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul></details>}</section>}

      {/* Everything that leaves this course: one ruled row each, no boxes. */}
      <section className="flex flex-col rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="border-b pb-2 text-base font-semibold">Course tools</h2>
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
                ? 'Review your course choices, recorded results and upcoming exams.'
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
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
