'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { studyRequest } from '@/lib/workspace/study-versions'
type Attempt = {
  id: string
  title: string
  courseCode: string
  question: string
  createdAt: string
  status: string
  earned: number | null
  possible: number | null
  needsReview: boolean
  url: string
}
export function PersonalPracticeHistory({
  mistakesOnly = false,
}: {
  mistakesOnly?: boolean
}) {
  const [attempts, setAttempts] = useState<Attempt[]>([]),
    [error, setError] = useState('')
  useEffect(() => {
    let live = true
    void studyRequest<{ attempts: Attempt[] }>(
      '/api/study-versions/practice-attempts',
    )
      .then((r) => live && setAttempts(r.attempts))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [])
  const shown = attempts.filter((a) => !mistakesOnly || a.needsReview)
  if (!shown.length && !error) return null
  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">
        {mistakesOnly
          ? 'Personal course questions to revisit'
          : 'Your personal course practice'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Saved answers from generated chapters and course papers. Open an attempt
        in its original course version.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {shown.slice(0, 20).map((a) => (
            <li key={a.id}>
              <Link
                href={a.url}
                className="flex items-start justify-between gap-4 py-4 hover:text-primary"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {a.courseCode} · {a.question}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.title} · {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 text-sm">
                  {a.possible
                    ? `${a.earned}/${a.possible}`
                    : a.status === 'draft'
                      ? 'Saved'
                      : 'Not scored'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
