'use client'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StudySource, Evidence } from '@/lib/workspace/study-versions'
const Pdf = dynamic(() => import('./course-pdf-viewer'), { ssr: false })
const Slides = dynamic(() => import('./course-presentation-viewer'), {
  ssr: false,
})
const File = dynamic(() => import('./course-file-viewer'), { ssr: false })
export function StudyDocument({
  source,
  chunks,
  initialPage = 1,
}: {
  source: StudySource
  chunks: Evidence[]
  initialPage?: number
}) {
  const url =
    source.url?.startsWith('/') && !source.url.startsWith('//')
      ? source.url
      : null
  const original = Boolean(url || source.assetId)
  return (
    <Tabs
      key={source.key}
      defaultValue={original ? 'original' : 'text'}
      className="min-h-0 min-w-0 flex-1 gap-0"
    >
      {!!chunks.length && (
        <TabsList variant="line" className="mx-3 my-1">
          <TabsTrigger value="original" disabled={!original}>
            Document
          </TabsTrigger>
          <TabsTrigger value="text">Extracted text</TabsTrigger>
        </TabsList>
      )}
      <TabsContent
        value="original"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {/\.pdf$/i.test(source.title) && url ? (
          <Pdf
            url={url}
            title={source.title}
            initialPage={initialPage}
            hideFullscreen
          />
        ) : /\.pptx?$/i.test(source.title) && source.assetId ? (
          <Slides
            assetId={source.assetId}
            title={source.title}
            initialPage={initialPage}
          />
        ) : source.assetId ? (
          <File assetId={source.assetId} />
        ) : url ? (
          <a
            className="m-4 text-primary underline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            Open original document
          </a>
        ) : null}
      </TabsContent>
      <TabsContent
        value="text"
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        <p className="mb-4 text-xs leading-5 text-muted-foreground">
          Passages used for this explanation or question. These may omit
          graphics and formatting from the original.
        </p>
        {chunks.map((c) => (
          <section key={c.id} className="border-t py-4">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              {c.page ? `Page / slide ${c.page}` : 'Text passage'}
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-7">{c.text}</p>
          </section>
        ))}
        {!chunks.length && (
          <p className="text-sm text-muted-foreground">
            No passages from this document were included.
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}
