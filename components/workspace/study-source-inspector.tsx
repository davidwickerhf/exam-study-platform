'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { DownloadIcon, EyeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type {
  StudySource,
  Evidence,
  StudyRevision,
} from '@/lib/workspace/study-versions'
const Pdf = dynamic(() => import('./course-pdf-viewer'), { ssr: false })
const Slides = dynamic(() => import('./course-presentation-viewer'), {
  ssr: false,
})
const File = dynamic(() => import('./course-file-viewer'), { ssr: false })
export function StudySourceInspector({
  source,
  chunks,
}: {
  source: StudySource
  chunks: Evidence[]
}) {
  const [open, setOpen] = useState(false)
  const url =
    source.url?.startsWith('/') && !source.url.startsWith('//')
      ? source.url
      : null
  const original = Boolean(url || source.assetId)
  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`View ${source.title}`}
        onClick={() => setOpen(true)}
      >
        <EyeIcon />
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
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle className="pr-8">{source.title}</SheetTitle>
            <SheetDescription>
              {source.academicYear} · {chunks.length} extracted passages
            </SheetDescription>
          </SheetHeader>
          <Tabs
            defaultValue={original ? 'original' : 'text'}
            className="min-h-0 flex-1 px-5 pb-5"
          >
            <TabsList variant="line">
              <TabsTrigger value="original" disabled={!original}>
                Original document
              </TabsTrigger>
              <TabsTrigger value="text">Ingested text</TabsTrigger>
            </TabsList>
            <TabsContent
              value="original"
              className="flex min-h-0 flex-1 flex-col"
            >
              {/\.pdf$/i.test(source.title) && url ? (
                <Pdf url={url} title={source.title} />
              ) : /\.pptx?$/i.test(source.title) && source.assetId ? (
                <Slides assetId={source.assetId} title={source.title} />
              ) : source.assetId ? (
                <File assetId={source.assetId} />
              ) : url ? (
                <a
                  className="text-primary underline"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original source
                </a>
              ) : null}
            </TabsContent>
            <TabsContent
              value="text"
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <p className="mb-5 text-sm text-muted-foreground">
                These are the exact passages available to generation. Graphics
                are only understood when their content is present in the
                extraction; opening a rendered slide does not mean AI inspected
                its diagram.
              </p>
              {chunks.map((c) => (
                <section key={c.id} className="border-t py-5">
                  <h3 className="mb-3 text-xs font-medium text-muted-foreground">
                    {c.page ? `Page / slide ${c.page}` : 'Text passage'} ·{' '}
                    {c.id}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {c.text}
                  </p>
                </section>
              ))}
              {!chunks.length && (
                <p className="text-sm text-muted-foreground">
                  No text from this source was included in this snapshot.
                </p>
              )}
            </TabsContent>
          </Tabs>
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
