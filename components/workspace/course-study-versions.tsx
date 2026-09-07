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
    [versions, setVersions] = useState<StudyVersion[] | null>(null),
    [shared, setShared] = useState<StudyPublication[]>([]),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false)
  useEffect(() => {
    let active = true
    setVersions(null)
    setError('')
    setShared([])
    setCreating(false)
    studyRequest<{ versions: StudyVersion[] }>(
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
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold">Your study guides</h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Read a guide, or create one from your course materials. Exercises and mock papers live in their own course tabs.
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
                <li key={v.id}>
                  <Link
                    href={`/app/study/${v.id}`}
                    className="hover:bg-muted/40 flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{v.title}</p>
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
