'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRightIcon, PlusIcon, RefreshCwIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StudySourceForm } from './study-source-form'
import {
  studyRequest,
  generationLabel,
  type StudyVersion,
  type StudyPublication
} from '@/lib/workspace/study-versions'

export function CourseStudyVersions({
  courseCode,
  courseName,
  academicYear,
  period
}: {
  courseCode: string
  courseName: string
  academicYear: string
  period: string
}) {
  const router = useRouter(),
    [versions, setVersions] = useState<(StudyVersion & {chapterPreviews?: {id:string;title:string}[]})[] | null>(null),
    [shared, setShared] = useState<StudyPublication[]>([]),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false)
  useEffect(() => {
    let active = true
    setVersions(null)
    setError('')
    setShared([])
    setCreating(false)
    studyRequest<{ versions: (StudyVersion & {chapterPreviews?: {id:string;title:string}[]})[] }>(
      `/api/study-versions?courseCode=${encodeURIComponent(courseCode)}`
    )
      .then((r) => active && setVersions(r.versions))
      .catch((e) => active && setError(e.message))
    studyRequest<{ publications: StudyPublication[] }>(
      `/api/study-versions/shared?courseCode=${encodeURIComponent(courseCode)}`
    )
      .then((r) => active && setShared(r.publications))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [courseCode])
  const selected =
    versions?.filter(
      (v) => academicYear === 'all' || v.course.academicYear === academicYear
    ) || []
  return (
    <section
      className="overflow-hidden rounded-xl border bg-card"
      aria-label="Your study guides"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Study guides</h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Your course, explained chapter by chapter. Build a guide from slides, readings and your notes.
          </p>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon data-icon="inline-start" />
            Create study guide
          </Button>
        )}
      </div>
      {creating ? (
        <div className="border-t p-5 sm:p-6">
          <StudySourceForm
            course={{ courseCode, courseName, academicYear, period }}
            onDone={(id) => router.push(`/app/study/${id}`)}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <>
          {error ? (
            <div className="px-5 pb-5">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : versions === null ? (
            <div className="px-5 pb-5">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !selected.length ? (
            <p className="text-muted-foreground border-t px-5 py-4 text-sm sm:px-6">
              {versions.length
                ? 'No personal guide for this edition yet.'
                : 'Start with collected materials, an editorial guide, or your own notes.'}
            </p>
          ) : (
            <ul className="divide-y border-t">
              {selected.map((v) => (
                <li key={v.id} className="px-5 py-5 sm:px-6">
                  <Link
                    href={`/app/study/${v.id}`}
                    className="group flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-semibold group-hover:text-primary">{v.title}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {v.course.academicYear} ·{' '}
                        {v.activeRevisionId
                          ? `${v.history[0]?.chapters || 0} ${v.history[0]?.chapters === 1 ? "chapter" : "chapters"}`
                          : generationLabel(v.draft)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant="outline">Private</Badge>
                      <ArrowRightIcon className="size-4" />
                    </div>
                  </Link>
                  {!!v.chapterPreviews?.length && <ol className="mt-5 grid gap-x-6 border-t pt-2 sm:grid-cols-2">
                    {v.chapterPreviews.slice(0,6).map((chapter,index)=><li key={chapter.id}><Link href={`/app/study/${v.id}?chapter=${encodeURIComponent(chapter.id)}`} className="group flex items-start gap-3 rounded-md py-3 text-sm hover:text-primary"><span className="mt-0.5 font-heading text-xs tabular-nums text-muted-foreground">{String(index+1).padStart(2,'0')}</span><span className="leading-5">{chapter.title}</span><ArrowRightIcon className="ml-auto mt-0.5 size-3.5 shrink-0 opacity-0 group-hover:opacity-100"/></Link></li>)}
                  </ol>}
                  {v.chapterPreviews && v.chapterPreviews.length>6 && <Link className="mt-2 inline-block text-sm font-medium text-primary" href={`/app/study/${v.id}`}>View all {v.chapterPreviews.length} chapters →</Link>}
                </li>
              ))}
            </ul>
          )}
          {!!shared.length && (
            <div className="border-t px-5 py-4 sm:px-6">
              <h3 className="mb-3 text-sm font-medium">
                Community versions{' '}
                <span className="text-muted-foreground font-normal">
                  · Not editorially reviewed
                </span>
              </h3>
              <ul className="flex flex-col gap-3">
                {shared.map((p) => (
                  <li key={p.id}>
                    <Link
                      className="text-primary text-sm hover:underline"
                      href={`/app/study/shared/${p.id}`}
                    >
                      {p.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {p.attribution} · {p.course.academicYear} · {p.chapters}{' '}
                      chapters
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
