'use client'
import { useState } from 'react'
import { BookOpenIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { type StudyRevision } from '@/lib/workspace/study-versions'
export function StudyEvidence({
  ids,
  revision
}: {
  ids: string[]
  revision: StudyRevision
}) {
  const [open, setOpen] = useState(false)
  const chunks = revision.snapshot.chunks.filter((c) => ids.includes(c.id))
  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="xs"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <BookOpenIcon data-icon="inline-start" />
        {open ? 'Hide evidence' : `Sources · ${chunks.length} passages`}
      </Button>
      {open && (
        <ul className="mt-2 flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/20 p-4">
          {chunks.map((chunk) => {
            const source = revision.snapshot.sources.find(
              (s) => s.key === chunk.sourceKey
            )
            return (
              <li key={chunk.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  {source?.url &&
                  source.url.startsWith('/') &&
                  !source.url.startsWith('//') ? (
                    <a
                      className="text-primary hover:underline"
                      href={`${source.url}${chunk.page ? `#page=${chunk.page}` : ''}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.title}
                    </a>
                  ) : (
                    <span>{source?.title || 'Source'}</span>
                  )}
                  <span>
                    {source?.academicYear}
                    {chunk.page ? ` · page ${chunk.page}` : ''}
                  </span>
                  {source?.kind === 'notes' && (
                    <Badge variant="outline">Student notes</Badge>
                  )}
                  {source?.academicYear !== revision.course.academicYear && (
                    <Badge variant="outline">Supplement</Badge>
                  )}
                </div>
                <blockquote className="text-muted-foreground border-l-2 pl-3 text-xs leading-6 whitespace-pre-wrap">
                  {chunk.text}
                </blockquote>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
