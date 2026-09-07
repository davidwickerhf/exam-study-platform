'use client'
import { useState } from 'react'
import { useStudyDesk } from './study-desk'
import { StudyDocument } from './study-document'
import { DownloadIcon, EyeIcon, MaximizeIcon, MinimizeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type {
  StudySource,
  Evidence,
  StudyRevision,
} from '@/lib/workspace/study-versions'
export function StudySourceInspector({
  source,
  chunks,
  label,
  initialPage = 1,
  focusDocument,
}: {
  source: StudySource
  chunks: Evidence[]
  label?: string
  focusDocument?: boolean
  initialPage?: number
}) {
  const [open, setOpen] = useState(false)
  const desk = useStudyDesk()
  const [expanded, setExpanded] = useState(false)
  const url =
    source.url?.startsWith('/') && !source.url.startsWith('//')
      ? source.url
      : null
  return (
    <>
      <Button
        size={label ? 'sm' : 'icon-sm'}
        variant="ghost"
        aria-label={label || `View ${source.title}`}
        onClick={() =>
          desk ? desk.openDocument(source, chunks, initialPage, focusDocument) : setOpen(true)
        }
      >
        <EyeIcon />
        {label}
      </Button>
      {url && (
        <a
          href={url}
          download
          aria-label={`Download ${source.title}`}
          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <DownloadIcon className="size-4" />
        </a>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={`gap-0 data-[side=right]:w-full ${expanded ? 'data-[side=right]:sm:max-w-none' : 'data-[side=right]:sm:max-w-[min(48rem,65vw)]'}`}
        >
          <SheetHeader className="relative shrink-0 border-b px-4 py-3 pr-24">
            <SheetTitle className="truncate text-sm" title={source.title}>
              {source.title
                .replace(/^\d+\s*/, '')
                .replace(/--file-\d+/, '')
                .replace(/_/g, ' ')}
            </SheetTitle>
            <SheetDescription>
              {source.academicYear} · Original source
            </SheetDescription>
            <Button
              size="icon-sm"
              variant="ghost"
              className="absolute right-12 top-3"
              aria-label={expanded ? 'Collapse viewer' : 'Expand viewer'}
              title={expanded ? 'Collapse viewer' : 'Expand viewer'}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <MinimizeIcon /> : <MaximizeIcon />}
            </Button>
          </SheetHeader>
          <StudyDocument
            source={source}
            chunks={chunks}
            initialPage={initialPage}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
export function StudySourceMap({ revision }: { revision: StudyRevision }) {
  const [query, setQuery] = useState('')
  const mapped = new Set(revision.topics.flatMap((t) => t.sourceIds))
  return (
    <div className="space-y-5">
      <div className="grid gap-4 border-y py-4 sm:grid-cols-3">
        {[
          [revision.snapshot.sources.length, 'Selected sources'],
          [mapped.size, 'Mapped passages'],
          [
            revision.snapshot.chunks.filter((c) => !mapped.has(c.id)).length,
            'Unmapped passages',
          ],
        ].map(([n, label]) => (
          <div key={String(label)}>
            <p className="text-xl font-semibold">{n}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <label className="block text-sm">
        Find a source or topic
        <input
          className="mt-2 w-full rounded-md border bg-background px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ul className="divide-y rounded-lg border">
        {revision.snapshot.sources
          .filter((s) =>
            (
              s.title +
              ' ' +
              revision.topics
                .filter((t) =>
                  t.sourceIds.some((id) =>
                    revision.snapshot.chunks.some(
                      (c) => c.id === id && c.sourceKey === s.key,
                    ),
                  ),
                )
                .map((t) => t.title)
                .join(' ')
            )
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((s) => {
            const chunks = revision.snapshot.chunks.filter(
              (c) => c.sourceKey === s.key,
            )
            const topics = revision.topics.filter((t) =>
              t.sourceIds.some((id) => chunks.some((c) => c.id === id)),
            )
            return (
              <li key={s.key} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-medium">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.kind === 'notes' ? 'Student notes' : 'Course source'} ·{' '}
                      {s.academicYear} · {chunks.length} passages
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <StudySourceInspector source={s} chunks={chunks} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Used in:{' '}
                  {topics.map((t) => t.title).join(' · ') ||
                    'No mapped chapters'}
                </p>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
