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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { OnboardingResume } from '@/components/v2/onboarding-resume'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { type AcademicCourse, type StudyCourse, byNextExam, courseProgress, nextExam, readChapters } from '@/lib/v2/courses.mjs'
import { localIsoDate } from '@/lib/v2/home.mjs'

const NUMERALS = 'font-data tabular-nums'

export default function CoursesPage() {
  const [courses, setCourses] = useState<StudyCourse[] | null>(null)
  const [academic, setAcademic] = useState<AcademicCourse[]>([])
  const [read, setRead] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setRead(readChapters(typeof window === 'undefined' ? null : window.localStorage))
    const json = (path: string) =>
      fetch(path, { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${path} returned ${response.status}`))))
    json('/api/state').then((data) => { if (live) setCourses(data.courses ?? []) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    json('/api/academics').then((data) => { if (live) setAcademic(data.workspace?.courses ?? []) }).catch(() => {})
    return () => { live = false }
  }, [])

  const today = localIsoDate()
  const active = useMemo(
    () => byNextExam((courses ?? []).filter((course) => !course.archived), academic, today),
    [courses, academic, today]
  )
  const archived = (courses ?? []).filter((course) => course.archived)

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-8">
        <Empty><EmptyHeader><EmptyTitle>Courses could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty>
      </div>
    )
  }

  const row = (course: StudyCourse) => {
    const progress = courseProgress(course, read)
    const exam = nextExam(course, academic, today)
    return (
      <li key={course.id}>
        <Link
          href={`/v2/courses/${course.id}`}
          className="hover:bg-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b py-4 sm:grid-cols-[7rem_minmax(0,1fr)_9rem_11rem]"
        >
          <span className="order-1 flex flex-col gap-0.5 sm:order-none">
            <strong className={`text-sm font-semibold ${NUMERALS}`}>{course.code}</strong>
            {course.shortName && <small className="text-muted-foreground text-xs">{course.shortName}</small>}
          </span>
          <span className="order-0 col-span-2 flex min-w-0 flex-col gap-0.5 sm:order-none sm:col-span-1">
            <strong className="text-[15px] font-medium">{course.name}</strong>
            <small className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {progress.done} of {progress.total} chapters read
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
              <small className="text-muted-foreground truncate text-xs" title={course.exam ?? undefined}>
                {course.exam ? 'Catalogue date only' : 'No exam date'}
              </small>
            )}
          </span>
          <span className="order-2 col-span-2 flex items-center gap-3 sm:order-none sm:col-span-1">
            <Progress value={progress.percent} className="h-1 flex-1" />
            <span className={`text-muted-foreground w-9 text-right text-xs ${NUMERALS}`}>{progress.percent}%</span>
          </span>
        </Link>
      </li>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-5xl leading-none tracking-tighter">Courses</h1>
        <p className="text-muted-foreground text-sm">
          {courses ? `${active.length} active · ordered by the exam that comes first.` : 'Loading your courses…'}
        </p>
      </header>

      {!courses ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
      ) : !active.length && !archived.length ? (
        <Empty><EmptyHeader><EmptyTitle>No courses yet</EmptyTitle><EmptyDescription>Finish setup to connect your programme and choose the courses you are taking.</EmptyDescription></EmptyHeader><OnboardingResume /></Empty>
      ) : (
        <>
          <ul className="flex flex-col border-t">{active.map(row)}</ul>
          {archived.length > 0 && (
            <section className="flex flex-col gap-1">
              <h2 className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Archived</h2>
              <ul className="flex flex-col border-t opacity-60">{archived.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
