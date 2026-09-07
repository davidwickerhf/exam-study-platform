'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StudyReader } from './study-reader'
import {
  studyRequest,
  type StudyPublication
} from '@/lib/workspace/study-versions'
export function SharedStudyPage({
  id,
  publicView = false
}: {
  id: string
  publicView?: boolean
}) {
  const [publication, setPublication] = useState<StudyPublication | null>(null),
    [error, setError] = useState(''),
    [withdrawn, setWithdrawn] = useState(false)
  useEffect(() => {
    let active = true
    studyRequest<StudyPublication>(
      `${publicView ? '/api/public/study-versions/' : '/api/study-versions/shared/'}${id}`
    )
      .then((r) => active && setPublication(r))
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [id, publicView])
  return (
    <main className="mx-auto flex w-full max-w-[1280px] min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href={publicView ? '/' : '/app/courses'}
        className="text-muted-foreground text-sm"
      >
        Wicker Study
      </Link>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {withdrawn ? (
        <p>This publication has been withdrawn.</p>
      ) : publication ? (
        <>
          <header>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Community version</Badge>
              <Badge variant="secondary">Not editorially reviewed</Badge>
            </div>
            <h1 className="font-heading text-2xl font-semibold">
              {publication.title}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {publication.course.courseName} ·{' '}
              {publication.course.academicYear} · By {publication.attribution}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Published {new Date(publication.createdAt).toLocaleDateString()} ·
              This is a saved selection and may not cover the full course.
            </p>
          </header>
          {publication.owned && !publicView && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await studyRequest(
                    `/api/study-versions/shared/${id}`,
                    undefined,
                    'DELETE'
                  )
                  setWithdrawn(true)
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            >
              Withdraw publication
            </Button>
          )}
          {publication.content && (
            <StudyReader revision={publication.content} />
          )}
        </>
      ) : (
        !error && <Skeleton className="h-80 w-full" />
      )}
    </main>
  )
}
