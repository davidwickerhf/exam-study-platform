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
import { ArchiveIcon, CheckIcon, ChevronRightIcon, ExternalLinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { academicCourseFor, type AcademicCourse, type StudyCourse, canvasCourseQuery, courseProgress, nextExam, readChapters } from '@/lib/v2/courses.mjs'
import { localIsoDate } from '@/lib/v2/home.mjs'

const NUMERALS = 'font-data tabular-nums'

export default function CoursePage() {
  const params = useParams<{ courseId: string; itemId?: string }>()
  const [courses, setCourses] = useState<StudyCourse[] | null>(null)
  const [academic, setAcademic] = useState<AcademicCourse[]>([])
  const [read, setRead] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

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

  useEffect(() => {
    const itemId = params.itemId ?? new URLSearchParams(window.location.search).get('item')
    const item = course?.items?.find((entry) => entry.id === itemId)
    if (item) requestAnimationFrame(() => document.querySelector(`[aria-label="Mastery for ${CSS.escape(item.title)}"]`)?.closest('li')?.scrollIntoView({ block: 'center' }))
  }, [course, params.itemId])

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
  const academicCourse = academicCourseFor(course, academic)
  const profile = course.courseProfile

  const setMastery = async (itemId: string, mastery: number) => {
    setSaving(itemId); setError(null)
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ mastery }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `Mastery returned ${response.status}`)
      setCourses((current) => current?.map((entry) => entry.id === course.id ? { ...entry, items: entry.items?.map((item) => item.id === itemId ? { ...item, ...data.item } : item) } : entry) ?? null)
    } catch (cause) { setError((cause as Error).message) } finally { setSaving(null) }
  }

  const archive = async () => {
    setSaving('archive'); setError(null)
    try {
      const response = await fetch(`/api/courses/${encodeURIComponent(course.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ archived: !course.archived }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `Course update returned ${response.status}`)
      setCourses((current) => current?.map((entry) => entry.id === course.id ? { ...entry, archived: data.course.archived } : entry) ?? null)
    } catch (cause) { setError((cause as Error).message) } finally { setSaving(null) }
  }

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

      <section className="grid gap-4 border-y py-4 md:grid-cols-2">
        <div className="flex flex-col gap-1"><h2 className="text-sm font-semibold">Personal plan</h2>{academicCourse ? <p className="text-muted-foreground text-sm">Connected by course code. Exam dates and attempts are kept in your private programme record.</p> : <p className="text-muted-foreground text-sm">This course is not in your active programme. Add its course code to connect dates, credits, and attempts.</p>}<Link href="/v2/planning" className="text-primary mt-1 text-sm font-semibold">Open Planning</Link></div>
        <div className="flex flex-col gap-1"><h2 className="text-sm font-semibold">Private Canvas material</h2><p className="text-muted-foreground text-sm">Choose modules and download a private source archive for this class.</p><Link href={`/canvas?course=${encodeURIComponent(canvasCourseQuery(course))}`} className="text-primary mt-1 inline-flex items-center gap-1 text-sm font-semibold">Open Canvas archive <ExternalLinkIcon className="size-3.5" /></Link></div>
      </section>

      {(course.mockExams?.length || course.mockExamPdf) && <section className="flex items-center justify-between gap-4 border-b pb-4"><div><h2 className="text-sm font-semibold">Past-paper practice</h2><p className="text-muted-foreground mt-1 text-sm">Work through stored exam papers with question guidance and answer grading.</p></div><Link href={`/v2/courses/${course.id}/mock-exam`} className="text-primary shrink-0 text-sm font-semibold">Open papers</Link></section>}

      {profile && (profile.description || profile.learningOutcomes?.length || profile.assessment?.components?.length) && <section className="flex max-w-[80ch] flex-col gap-4"><div className="flex items-baseline justify-between border-b pb-2"><h2 className="text-lg font-semibold">Course information</h2>{profile.assessment?.status && <span className="rounded-full border px-2 py-0.5 text-xs font-semibold">{profile.assessment.status === 'confirmed' ? 'Assessment verified' : 'Assessment under review'}</span>}</div>{profile.description && <p className="text-muted-foreground leading-relaxed">{profile.description}</p>}{profile.assessment?.components?.length && <div className="flex flex-col">{profile.assessment.components.map((component, index) => <div key={`${component.name}-${index}`} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 border-b py-3"><strong className={`text-xl ${NUMERALS}`}>{component.weightPercent == null ? '—' : `${component.weightPercent}%`}</strong><div><h3 className="font-semibold">{component.name}</h3><p className="text-muted-foreground text-sm">{[component.type, component.minimumPercent != null ? `minimum ${component.minimumPercent}%` : null, component.deadline || component.deadlineText].filter(Boolean).join(' · ')}</p></div></div>)}</div>}{profile.learningOutcomes?.length && <details><summary className="cursor-pointer text-sm font-semibold">Learning outcomes ({profile.learningOutcomes.length})</summary><ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">{profile.learningOutcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul></details>}</section>}

      {!!course.items?.length && <section className="flex flex-col gap-1"><div className="flex items-baseline justify-between border-b pb-2"><h2 className="text-sm font-semibold">Topic mastery</h2><span className="text-muted-foreground text-xs">0 not started · 4 confident</span></div><ul className="flex flex-col">{course.items.map((item) => <li key={item.id} className="grid gap-3 border-b py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><span className="text-sm font-medium">{item.title}</span><div className="flex gap-1" role="group" aria-label={`Mastery for ${item.title}`}>{[0,1,2,3,4].map((level) => <Button key={level} size="sm" variant={item.mastery === level ? 'default' : 'outline'} disabled={saving === item.id} onClick={() => void setMastery(item.id, level)} className={NUMERALS}>{level}</Button>)}</div></li>)}</ul></section>}

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

      <div className="flex justify-end border-t pt-4"><Button variant="outline" onClick={() => void archive()} disabled={saving === 'archive'}><ArchiveIcon data-icon="inline-start" />{course.archived ? 'Unarchive course' : 'Archive course'}</Button></div>
    </div>
  )
}
