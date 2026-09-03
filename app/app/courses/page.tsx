'use client'

/**
 * The course ledger.
 *
 * Ordered by the exam that comes first, because that is the order a student
 * works in. The vanilla ledger showed a single "mastery %" blended from reads,
 * practice scores and flashcard state across several client caches; this
 * reports the two things it can actually source and names each — chapters
 * read, and the mastery the student has set on the course's items.
 *
 * The reconciliation of the four sources behind a row lives in
 * lib/workspace/course-ledger.mjs, so it can be read and tested on its own.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRightIcon, ChevronRightIcon, SearchIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { OnboardingResume } from '@/components/workspace/onboarding-resume'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { type AcademicCourse, type StudyCourse, courseProgress, nextExam, readChapters } from '@/lib/workspace/courses.mjs'
import {
  type Catalogue,
  type CorpusCourse,
  type LedgerCourse,
  type ProgrammeTemplate,
  courseLedger,
  filterLedger,
  materialSummary,
  periodLabel,
  rowDestination,
  sortLedger
} from '@/lib/workspace/course-ledger.mjs'
import { localIsoDate } from '@/lib/workspace/home.mjs'

const NUMERALS = 'font-data tabular-nums'
const COLUMNS = 'sm:grid-cols-[6.5rem_minmax(0,1fr)_8.5rem_7rem_10.5rem]'
type CurrentCourse = { code: string; reasons?: string[] }

const SORTS: [string, string][] = [
  ['period', 'Period / next exam'],
  ['year', 'Study year'],
  ['code', 'Course code'],
  ['name', 'Course name']
]

export default function CoursesPage() {
  const [courses, setCourses] = useState<StudyCourse[] | null>(null)
  const [academic, setAcademic] = useState<AcademicCourse[]>([])
  const [read, setRead] = useState<Set<string>>(new Set())
  const [corpus, setCorpus] = useState<CorpusCourse[]>([])
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [programmeTemplate, setProgrammeTemplate] = useState<ProgrammeTemplate>(null)
  const [currentPeriod, setCurrentPeriod] = useState<string | null>(null)
  const [currentCourses, setCurrentCourses] = useState<CurrentCourse[]>([])
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('current')
  const [sort, setSort] = useState('period')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setRead(readChapters(typeof window === 'undefined' ? null : window.localStorage))
    const json = (path: string) =>
      fetch(path, { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${path} returned ${response.status}`))))
    json('/api/state').then((data) => { if (live) setCourses(data.courses ?? []) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    json('/api/academics').then((data) => { if (live) { setAcademic(data.workspace?.courses ?? []); setProgrammeTemplate(data.workspace?.programmeTemplate ?? null) } }).catch(() => {})
    json('/api/account/integrations/canvas/corpus').then((data) => { if (live) setCorpus(data.status?.courses ?? []) }).catch(() => {})
    json('/api/onboarding/programmes').then((data) => { if (live) setCatalogue(data) }).catch(() => {})
    json('/api/calendar/events').then((data) => { if (live) { setCurrentPeriod(data.academicContext?.period ?? null); setCurrentCourses(data.currentCourses ?? []) } }).catch(() => {})
    return () => { live = false }
  }, [])

  const today = localIsoDate()
  const currentLabel = currentPeriod ? `Current · ${currentPeriod}` : 'Current period'
  const scopes: [string, string][] = [
    ['current', currentLabel],
    ['future', 'Future / outstanding'],
    ['passed', 'Passed'],
    ['failed', 'Failed / retake'],
    ['all', 'All courses'],
    ['archived', 'Archived']
  ]

  const ledger = useMemo(
    () => courseLedger({ editorial: courses, academic, corpus, catalogue, programmeTemplate, today }),
    [courses, academic, corpus, catalogue, programmeTemplate, today]
  )

  const visible = useMemo(
    () => sortLedger(filterLedger(ledger, { query, scope, currentCourses }), { sort, academic, today }),
    [ledger, query, scope, sort, academic, today, currentCourses]
  )

  const narrowed = scope !== 'all' || Boolean(query.trim())
  const scopeName = scopes.find(([value]) => value === scope)?.[1] ?? 'All courses'

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8">
        <Empty><EmptyHeader><EmptyTitle>Courses could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty>
      </div>
    )
  }

  const row = (entry: LedgerCourse) => {
    const course = entry.editorial
    const progress = course ? courseProgress(course, read) : null
    const exam = course ? nextExam(course, academic, today) : null
    const target = rowDestination(entry)
    const summary = materialSummary(entry)
    return (
      <li key={entry.key}>
        <Link
          href={target.href}
          aria-label={`${entry.code} ${entry.name} — ${target.action}`}
          className={`group hover:bg-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b px-2 py-4 ${COLUMNS}`}
        >
          <span className="order-1 flex flex-col gap-0.5 sm:order-none">
            <strong className={`text-sm font-semibold ${NUMERALS}`}>{entry.code}</strong>
            {(entry.corpus?.academicYear || course?.shortName) && <small className="text-muted-foreground text-xs">{entry.corpus?.academicYear || course?.shortName}</small>}
          </span>

          <span className="order-0 col-span-2 flex min-w-0 flex-col gap-0.5 sm:order-none sm:col-span-1">
            <strong className="text-[15px] font-medium">{entry.name}</strong>
            <small className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {progress?.total ? `${progress.done} of ${progress.total} chapters read` : summary}
            </small>
          </span>

          <span className="flex flex-col gap-0.5">
            {exam ? (
              <>
                <strong className={`text-primary text-sm font-semibold ${NUMERALS}`}>
                  {exam.days === 0 ? 'today' : `in ${exam.days} days`}
                </strong>
                <small className={`text-muted-foreground text-xs ${NUMERALS}`}>
                  {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(exam.date))}
                  {exam.type ? ` · ${exam.type}` : ''}
                </small>
              </>
            ) : (
              <small className="text-muted-foreground truncate text-xs">
                {course?.exam ? 'Catalogue date only' : periodLabel(entry.academic?.period || entry.corpus?.period) || 'No exam date'}
              </small>
            )}
          </span>

          <span className="flex items-center gap-2">
            {progress?.total ? (
              <>
                <Progress value={progress.percent} className="h-1 flex-1" />
                <span className={`text-muted-foreground w-8 text-right text-xs ${NUMERALS}`}>{progress.percent}%</span>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </span>

          {/* A row's destination is named on the row, because three different
              destinations used to wear the same clothes. */}
          <span className="order-2 col-span-2 flex items-center justify-end gap-1.5 text-xs sm:order-none sm:col-span-1">
            {target.kind === 'study' ? (
              <>
                <span className={`text-muted-foreground group-hover:text-foreground ${NUMERALS}`}>{target.action}</span>
                <ChevronRightIcon className="text-muted-foreground group-hover:text-foreground size-4 shrink-0" />
              </>
            ) : (
              <>
                <span className="text-muted-foreground group-hover:text-foreground font-medium">{target.action}</span>
                <ArrowRightIcon className="text-muted-foreground group-hover:text-foreground size-3.5 shrink-0" />
              </>
            )}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">Courses</h1>
        <p className="text-muted-foreground text-sm">
          {courses
            ? `${ledger.length} courses joined from your study record, Canvas and the maintained library.`
            : 'Loading your courses…'}
        </p>
      </header>

      {!courses ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
      ) : !ledger.length ? (
        <Empty><EmptyHeader><EmptyTitle>No courses yet</EmptyTitle><EmptyDescription>Finish setup to connect your programme and choose the courses you are taking.</EmptyDescription></EmptyHeader><OnboardingResume /></Empty>
      ) : (
        <>
          <div className="grid gap-3 border-y py-4 sm:grid-cols-[minmax(15rem,1fr)_13rem_12rem]">
            <label className="relative">
              <span className="sr-only">Search courses</span>
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code or course name" className="pl-9" />
            </label>
            <Select items={scopes.map(([value, label]) => ({ value, label }))} value={scope} onValueChange={(value) => setScope(String(value))}>
              <SelectTrigger className="w-full" aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>{scopes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <Select items={SORTS.map(([value, label]) => ({ value, label }))} value={sort} onValueChange={(value) => setSort(String(value))}>
              <SelectTrigger className="w-full" aria-label="Sort courses"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>{SORTS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>

          {/* The list is filtered by default, so it says so rather than
              letting the header's total contradict what is on screen. */}
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-live="polite">
            <span>
              Showing <span className={`text-foreground font-semibold ${NUMERALS}`}>{visible.length}</span>
              {' of '}<span className={NUMERALS}>{ledger.length}</span>
              {' · '}{scopeName}
              {query.trim() ? ` · matching “${query.trim()}”` : ''}
            </span>
            {narrowed && (
              <button
                type="button"
                onClick={() => { setScope('all'); setQuery('') }}
                className="hover:text-foreground text-muted-foreground underline underline-offset-2"
              >
                Show all {ledger.length}
              </button>
            )}
          </p>

          <div className={`text-muted-foreground grid border-y px-2 py-2 text-xs font-semibold tracking-[0.11em] uppercase max-sm:hidden ${COLUMNS}`}>
            <span>Course</span><span>Material status</span><span>Schedule</span><span>Read</span><span className="text-right">Opens</span>
          </div>

          {visible.length ? (
            <ul className="flex flex-col">{visible.map(row)}</ul>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No courses in {scopeName.toLowerCase()}</EmptyTitle>
                <EmptyDescription>
                  {query.trim()
                    ? `Nothing matches “${query.trim()}” in this status. Clear the search or choose another status.`
                    : 'Choose another status to see the rest of your ledger.'}
                </EmptyDescription>
              </EmptyHeader>
              <button
                type="button"
                onClick={() => { setScope('all'); setQuery('') }}
                className="text-primary text-sm font-semibold underline underline-offset-2"
              >
                Show all {ledger.length} courses
              </button>
            </Empty>
          )}
        </>
      )}
    </div>
  )
}
