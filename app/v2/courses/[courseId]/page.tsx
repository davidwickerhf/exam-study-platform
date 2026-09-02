'use client'

/**
 * A course: its chapter register, and what is left to read.
 *
 * Read-state is shared with the vanilla workspace through localStorage, so a
 * chapter marked read in either half shows as read in both.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckIcon, ChevronRightIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { type AcademicCourse, type StudyCourse, courseProgress, nextExam, readChapters } from '@/lib/v2/courses.mjs'
import { localIsoDate } from '@/lib/v2/home.mjs'

const NUMERALS = 'font-data tabular-nums'

export default function CoursePage() {
  const params = useParams<{ courseId: string }>()
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

  const course = useMemo(
    () => (courses ?? []).find((entry) => entry.id === params.courseId) ?? null,
    [courses, params.courseId]
  )
  const today = localIsoDate()

  if (error || (courses && !course)) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{error ? 'That course could not be read' : 'No such course'}</EmptyTitle>
            <EmptyDescription>{error ?? 'It may have been archived or renamed.'}</EmptyDescription>
          </EmptyHeader>
          <Link href="/v2/courses" className="text-primary text-sm font-semibold">Back to courses</Link>
        </Empty>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 p-8">
        <Skeleton className="h-12 w-96" /><Skeleton className="h-4 w-64" /><Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const progress = courseProgress(course, read)
  const exam = nextExam(course, academic, today)

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <p className={`text-muted-foreground text-sm font-semibold ${NUMERALS}`}>{course.code}</p>
        <h1 className="font-heading text-5xl leading-none tracking-tighter">{course.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-8">
          <span className="flex items-center gap-3">
            <Progress value={progress.percent} className="h-1 w-40" />
            <span className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {progress.done} of {progress.total} read
            </span>
          </span>
          {progress.mastery !== null && (
            <span className={`text-muted-foreground text-xs ${NUMERALS}`}>
              {progress.mastery}% mastery across {course.items?.length ?? 0} topics
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
        </div>
      </header>

      <section className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between border-b pb-2">
          <h2 className="text-sm font-semibold">Chapters</h2>
          <span className={`text-muted-foreground text-sm ${NUMERALS}`}>{progress.total}</span>
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
                    href={`/v2/courses/${course.id}/${chapter.id}`}
                    className="hover:bg-card grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 border-b py-3"
                  >
                    <span className={`text-muted-foreground text-sm font-semibold ${NUMERALS}`}>{chapter.id}</span>
                    <span className="text-[15px] font-medium">{chapter.name}</span>
                    <span className="text-muted-foreground flex items-center gap-3 text-xs">
                      {done && <span className="text-foreground inline-flex items-center gap-1"><CheckIcon className="size-3.5" /> Read</span>}
                      <ChevronRightIcon className="size-4" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
