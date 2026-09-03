'use client'

/**
 * The course ledger.
 *
 * Ordered by the exam that comes first, because that is the order a student
 * works in. The vanilla ledger showed a single "mastery %" blended from reads,
 * practice scores and flashcard state across several client caches; this
 * reports the two things it can actually source and names each — chapters
 * read, and the mastery the student has set on the course's items.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SearchIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { OnboardingResume } from '@/components/workspace/onboarding-resume'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { type AcademicCourse, type StudyCourse, byNextExam, courseProgress, nextExam, readChapters } from '@/lib/workspace/courses.mjs'
import { localIsoDate } from '@/lib/workspace/home.mjs'

const NUMERALS = 'font-data tabular-nums'
type CorpusCourse = { id: string; courseCode: string; courseName: string; academicYear?: string; period?: string; sources: number; lastSyncedAt?: string | null }
type LedgerCourse = { key: string; code: string; name: string; editorial?: StudyCourse; academic?: AcademicCourse; corpus?: CorpusCourse; archived: boolean }
type Catalogue = { programmes?: { id: string; versions?: { id: string; courses?: { id: string; code: string; name: string; ects?: number; yearLevel?: string; period?: string }[] }[] }[] }

export default function CoursesPage() {
  const [courses, setCourses] = useState<StudyCourse[] | null>(null)
  const [academic, setAcademic] = useState<AcademicCourse[]>([])
  const [read, setRead] = useState<Set<string>>(new Set())
  const [corpus, setCorpus] = useState<CorpusCourse[]>([])
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [programmeTemplate, setProgrammeTemplate] = useState<{ programmeId?: string; versionId?: string } | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState<string | null>(null)
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
    json('/api/calendar/events').then((data) => { if (live) setCurrentPeriod(data.academicContext?.period ?? null) }).catch(() => {})
    return () => { live = false }
  }, [])

  const today = localIsoDate()
  const ledger = useMemo(() => {
    const rows = new Map<string, LedgerCourse>()
    for (const course of courses ?? []) rows.set(course.code.toUpperCase(), { key: course.code.toUpperCase(), code: course.code, name: course.name, editorial: course, archived: Boolean(course.archived) })
    for (const course of academic) {
      const key = String(course.code || course.id || '').toUpperCase()
      if (!key) continue
      const held = rows.get(key)
      rows.set(key, { key, code: course.code || held?.code || key, name: course.name || held?.name || course.code, editorial: held?.editorial, academic: course, archived: held?.archived ?? false })
    }
    for (const course of corpus) {
      const key = String(course.courseCode || course.id).toUpperCase()
      const held = rows.get(key)
      rows.set(key, { key, code: course.courseCode || held?.code || key, name: course.courseName || held?.name || course.courseCode, editorial: held?.editorial, academic: held?.academic, corpus: course, archived: held?.archived ?? false })
    }
    const programme = catalogue?.programmes?.find((entry) => entry.id === programmeTemplate?.programmeId)
    const version = programme?.versions?.find((entry) => entry.id === programmeTemplate?.versionId) ?? programme?.versions?.[0]
    for (const course of version?.courses ?? []) {
      const key = course.code.toUpperCase()
      const held = rows.get(key)
      if (!held) rows.set(key, { key, code: course.code, name: course.name, academic: { id: course.id, code: course.code, name: course.name, ects: course.ects, yearLevel: course.yearLevel, period: course.period, attempts: [] } as AcademicCourse, archived: false })
    }
    return [...rows.values()].sort((left, right) => {
      if (left.editorial && right.editorial) return byNextExam([left.editorial, right.editorial], academic, today)[0].id === left.editorial.id ? -1 : 1
      if (left.academic && !right.academic) return -1
      if (!left.academic && right.academic) return 1
      return left.code.localeCompare(right.code)
    })
  }, [courses, academic, corpus, catalogue, programmeTemplate, today])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const status = (entry: LedgerCourse) => {
      const attempts = entry.academic?.attempts ?? []
      const passed = attempts.some((attempt) => /pass|completed/i.test(String(attempt.status)))
      const failed = !passed && attempts.some((attempt) => /fail|no.?show|insufficient/i.test(String(attempt.status)))
      const registered = attempts.some((attempt) => /current|registered|enrolled|planned/i.test(String(attempt.status)))
      const period = String(entry.academic?.period || entry.corpus?.period || '')
      const normalizedCurrent = String(currentPeriod || '').replace(/^Period\s*/i, '')
      const current = !passed && !entry.archived && (registered || (Boolean(normalizedCurrent) && (period === normalizedCurrent || period === `Period ${normalizedCurrent}`)))
      return { passed, failed, current, future: !passed && !failed && !current && !entry.archived }
    }
    const filtered = ledger.filter((entry) => {
      if (needle && !`${entry.code} ${entry.name}`.toLowerCase().includes(needle)) return false
      const value = status(entry)
      if (scope === 'all') return true
      if (scope === 'archived') return entry.archived
      return value[scope as keyof typeof value]
    })
    return [...filtered].sort((left, right) => {
      if (sort === 'code') return left.code.localeCompare(right.code)
      if (sort === 'name') return left.name.localeCompare(right.name)
      if (sort === 'year') return String(left.academic?.yearLevel || '').localeCompare(String(right.academic?.yearLevel || '')) || String(left.academic?.period || '').localeCompare(String(right.academic?.period || ''))
      const leftExam = left.editorial ? nextExam(left.editorial, academic, today)?.date : null
      const rightExam = right.editorial ? nextExam(right.editorial, academic, today)?.date : null
      if (leftExam || rightExam) return String(leftExam || '9999').localeCompare(String(rightExam || '9999'))
      return String(left.academic?.period || '99').localeCompare(String(right.academic?.period || '99')) || left.code.localeCompare(right.code)
    })
  }, [ledger, query, scope, sort, academic, today, currentPeriod])

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
    const href = course ? `/app/courses/${course.id}` : entry.academic?.id ? `/app/course-request/${entry.academic.id}` : `/app/updates?tab=materials&courseCode=${encodeURIComponent(entry.code)}`
    const capability = course?.chapters?.length ? 'Study ready' : entry.corpus?.sources ? `${entry.corpus.sources} sources indexed` : entry.corpus ? 'Material import queued' : 'Course record only'
    return (
      <li key={entry.key}>
        <Link
          href={href}
          className="hover:bg-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b py-4 sm:grid-cols-[7rem_minmax(0,1fr)_9rem_11rem]"
        >
          <span className="order-1 flex flex-col gap-0.5 sm:order-none">
            <strong className={`text-sm font-semibold ${NUMERALS}`}>{entry.code}</strong>
            {(entry.corpus?.academicYear || course?.shortName) && <small className="text-muted-foreground text-xs">{entry.corpus?.academicYear || course?.shortName}</small>}
          </span>
          <span className="order-0 col-span-2 flex min-w-0 flex-col gap-0.5 sm:order-none sm:col-span-1">
            <strong className="text-[15px] font-medium">{entry.name}</strong>
            <small className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {progress?.total ? `${progress.done} of ${progress.total} chapters read` : capability}
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
              <small className="text-muted-foreground truncate text-xs" title={course?.exam ?? undefined}>
                {course?.exam ? 'Catalogue date only' : entry.academic?.period || entry.corpus?.period || 'No exam date'}
              </small>
            )}
          </span>
          <span className="order-2 col-span-2 flex items-center gap-3 sm:order-none sm:col-span-1">
            {progress?.total ? <><Progress value={progress.percent} className="h-1 flex-1" /><span className={`text-muted-foreground w-9 text-right text-xs ${NUMERALS}`}>{progress.percent}%</span></> : <span className="text-muted-foreground ml-auto text-xs">{entry.corpus?.sources ? 'Available' : 'Not prepared'}</span>}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-5xl leading-none tracking-tighter">Courses</h1>
        <p className="text-muted-foreground text-sm">
          {courses ? `${ledger.length} available from your study record, Canvas and the maintained library.` : 'Loading your courses…'}
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
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code or course name" className="pl-9" />
            </label>
            <Select items={[{value:'current',label:'Current period'},{value:'future',label:'Future / outstanding'},{value:'passed',label:'Passed'},{value:'failed',label:'Failed / retake'},{value:'all',label:'All courses'},{value:'archived',label:'Archived'}]} value={scope} onValueChange={(value) => setScope(String(value))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{[['current','Current period'],['future','Future / outstanding'],['passed','Passed'],['failed','Failed / retake'],['all','All courses'],['archived','Archived']].map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <Select items={[{value:'period',label:'Period / next exam'},{value:'year',label:'Study year'},{value:'code',label:'Course code'},{value:'name',label:'Course name'}]} value={sort} onValueChange={(value) => setSort(String(value))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{[['period','Period / next exam'],['year','Study year'],['code','Course code'],['name','Course name']].map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_9rem_11rem] border-y py-2 text-[10.5px] font-semibold tracking-[0.11em] text-muted-foreground uppercase max-sm:hidden"><span>Course</span><span>Material status</span><span>Schedule</span><span className="text-right">Readiness</span></div>
          {visible.length ? <ul className="flex flex-col">{visible.map(row)}</ul> : <Empty><EmptyHeader><EmptyTitle>No matching courses</EmptyTitle><EmptyDescription>Try another status or clear the search.</EmptyDescription></EmptyHeader></Empty>}
        </>
      )}
    </div>
  )
}
