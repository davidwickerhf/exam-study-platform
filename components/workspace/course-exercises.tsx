'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { studyRequest } from '@/lib/workspace/study-versions'
import type {
  PracticePayload,
  PracticeQuestion,
  SessionEvent,
} from '@/lib/workspace/practice.mjs'
import { Button } from '@/components/ui/button'
const Questions = dynamic(() => import('@/app/app/practice/questions-tab'), {
  loading: () => <p role="status">Opening exercises…</p>,
})

export function CourseExercises({
  courseId,
  courseCode,
}: {
  courseId: string
  courseCode: string
}) {
  const [payload, setPayload] = useState<PracticePayload | null>(null),
    [error, setError] = useState('')
  const [events, setEvents] = useState<SessionEvent<PracticeQuestion>[]>([]),
    [ended, setEnded] = useState(false)
  const [deck, setDeck] = useState(new Set<string>()),
    [retry, setRetry] = useState(0)
  useEffect(() => {
    let live = true
    setError('')
    studyRequest<PracticePayload>(
      `/api/practice?courseId=${encodeURIComponent(courseId)}&courseCode=${encodeURIComponent(courseCode)}`,
    )
      .then((data) => {
        if (live) setPayload(data)
      })
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [courseId, courseCode, retry])
  return (
    <section className="space-y-6" aria-label="Course exercises">
      <div>
        <h2 className="text-xl font-semibold">Exercise bank</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Practice across every chapter. Your generated questions and published
          exercises are gathered here, across course years.
        </p>
      </div>
      {error && (
        <div role="alert">
          {error}{' '}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      {!error && (
        <Questions
          lockedCourseId={courseId}
          initialChapterId={
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('chapter') ||
                undefined
              : undefined
          }
          payload={payload}
          error={null}
          deck={deck}
          onDeckChange={(id) => setDeck((d) => new Set(d).add(id))}
          onMistake={() => {}}
          events={events}
          onEvent={(event) => setEvents((e) => [...e, event])}
          ended={ended}
          onEndedChange={setEnded}
          onClearSession={() => {
            setEvents([])
            setEnded(false)
          }}
        />
      )}
    </section>
  )
}
