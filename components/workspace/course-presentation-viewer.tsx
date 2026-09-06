'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
const Pdf = dynamic(() => import('./course-pdf-viewer'), { ssr: false })
const Text = dynamic(() => import('./course-file-viewer'), { ssr: false })
export default function CoursePresentationViewer({ assetId, title }: { assetId: string; title: string }) {
  const [text, setText] = useState(false)
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1" aria-label="Presentation view">
        <Button size="sm" variant={text ? 'ghost' : 'secondary'} aria-pressed={!text} onClick={() => setText(false)}>Slides</Button>
        <Button size="sm" variant={text ? 'secondary' : 'ghost'} aria-pressed={text} onClick={() => setText(true)}>Text and notes</Button>
      </div>
      <p className="text-xs text-muted-foreground">Static slide pages preserve graphics. Animations remain in the original.</p>
    </div>
    {text ? <Text assetId={assetId} /> : <Pdf url={`/api/corpus/assets/${encodeURIComponent(assetId)}/slides.pdf`} title={title} slides />}
  </div>
}
