'use client'
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon, LoaderCircleIcon } from 'lucide-react'

export default function CoursePdfViewer({ url, file, title, slides = false }: { url?: string; file?: File; title: string; slides?: boolean }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null), [error, setError] = useState(''), [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1), [width, setWidth] = useState(800), [text, setText] = useState(''), [textView, setTextView] = useState(false), [rendering, setRendering] = useState(false), [retry, setRetry] = useState(0)
  const viewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width - 32)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let active = true, task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90000)
    setError(''); setPdf(null); setPage(1); setZoom(1); setText('')
    void (async () => {
      try {
        // The app's authenticated fetch wrapper supplies the session. PDF.js
        // receives bytes only, so no cookie, key or token enters its worker.
        const max = 64 * 1024 * 1024
        let bytes: Uint8Array
        if (file) {
          if (file.size > max) throw new Error('This file exceeds the 64 MB preview limit.')
          bytes = new Uint8Array(await file.arrayBuffer())
        } else {
          if (!url) throw new Error('Choose a document to preview.')
          const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
          if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            throw new Error(body.error || `Document unavailable (HTTP ${response.status}).`)
          }
          if (Number(response.headers.get('content-length')) > max) throw new Error('This document exceeds the 64 MB preview limit. Download the original to inspect it.')
          const reader = response.body?.getReader()
          if (!reader) throw new Error('The document response was empty.')
          const parts: Uint8Array[] = []; let total = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            total += value.length
            if (total > max) { await reader.cancel(); throw new Error('This document exceeds the 64 MB preview limit. Download the original to inspect it.') }
            parts.push(value)
          }
          bytes = new Uint8Array(total); let offset = 0
          for (const part of parts) { bytes.set(part, offset); offset += part.length }
        }
        if (!active) return
        const engine = await import('pdfjs-dist')
        const assets = `/vendor/pdfjs/${engine.version}/`
        engine.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`
        task = engine.getDocument({ data: bytes, cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/` })
        const document = await task.promise
        if (active) setPdf(document)
      } catch (e) { if (active) setError(controller.signal.aborted ? 'Loading took too long. Try again or download the original.' : (e as Error).message) }
      finally { clearTimeout(timer) }
    })()
    return () => { active = false; clearTimeout(timer); controller.abort(); void task?.destroy() }
  }, [url, file, retry])
  useEffect(() => {
    if (!pdf) return
    let active = true, render: RenderTask | undefined
    setRendering(true); setError('')
    void (async () => {
      try {
        const source = await pdf.getPage(page)
        const content = await source.getTextContent()
        if (active) setText(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join(''))
        if (!active || textView || !canvas.current) return
        const base = source.getViewport({ scale: 1 }), scale = Math.min(width / base.width, 2) * zoom
        const view = source.getViewport({ scale }), ratio = Math.min(window.devicePixelRatio || 1, 2)
        const node = canvas.current
        node.width = Math.ceil(view.width * ratio); node.height = Math.ceil(view.height * ratio)
        node.style.width = `${view.width}px`; node.style.height = `${view.height}px`
        render = source.render({ canvas: node, viewport: view, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] })
        await render.promise
      } catch (e) { if (active && (e as Error).name !== 'RenderingCancelledException') setError('This page could not render. Try its text view or download the original.') }
      finally { if (active) setRendering(false) }
    })()
    return () => { active = false; render?.cancel() }
  }, [pdf, page, width, zoom, textView])
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
    {pdf && <div className="flex flex-wrap items-center justify-between gap-2" aria-label="Document controls">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label={slides ? 'Previous slide' : 'Previous page'} disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeftIcon /></Button>
        <label className="flex items-center gap-2 text-xs">{slides ? 'Slide' : 'Page'}<input aria-label={slides ? 'Slide number' : 'Page number'} type="number" min={1} max={pdf.numPages} value={page} className="w-14 rounded border bg-background px-2 py-1" onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= pdf.numPages) setPage(n) }} /> of {pdf.numPages}</label>
        <Button size="icon-sm" variant="outline" aria-label={slides ? 'Next slide' : 'Next page'} disabled={page >= pdf.numPages} onClick={() => setPage(p => p + 1)}><ChevronRightIcon /></Button>
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" aria-label="Zoom out" disabled={zoom <= 0.5 || textView} onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><MinusIcon /></Button>
        <Button size="sm" variant="ghost" disabled={textView} onClick={() => setZoom(1)}>Fit</Button>
        <Button size="icon-sm" variant="ghost" aria-label="Zoom in" disabled={zoom >= 2 || textView} onClick={() => setZoom(z => Math.min(2, z + 0.25))}><PlusIcon /></Button>
        <Button size="sm" variant="outline" aria-pressed={textView} onClick={() => setTextView(v => !v)}>{textView ? 'Show page' : 'Page text'}</Button>
      </div>
    </div>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" onClick={() => setRetry(r => r + 1)}>Try again</Button></div>}
    <div ref={viewport} className="relative min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border bg-muted p-4">
      {!pdf && !error && <p role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><LoaderCircleIcon className="size-4 animate-spin" />{slides ? 'Rendering slides…' : 'Loading document…'}</p>}
      {pdf && (textView ? <pre className="whitespace-pre-wrap break-words rounded bg-card p-5 font-sans text-sm leading-7">{text || 'No text on this page. Use the rendered page to inspect its graphics.'}</pre> : <canvas ref={canvas} role="img" aria-label={`${title}, ${slides ? 'slide' : 'page'} ${page}`} className="mx-auto bg-white shadow-sm" />)}
      {rendering && <span role="status" className="sr-only">Rendering page {page}</span>}
    </div>
  </div>
}
