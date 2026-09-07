'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist'
import './pdf-reader.css'

// Keep only nearby pages rasterized. Page boxes remain in the document flow.
export function PdfPage({
  pdf,
  number,
  width,
  ratio,
  root,
  thumbnail = false,
}: {
  pdf: PDFDocumentProxy
  number: number
  width: number
  ratio: number
  root: RefObject<HTMLDivElement | null>
  thumbnail?: boolean
}) {
  const box = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false),
    [aspect, setAspect] = useState(ratio),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root: root.current, rootMargin: thumbnail ? '160px' : '600px' },
    )
    if (box.current) observer.observe(box.current)
    return () => observer.disconnect()
  }, [root, thumbnail])
  useEffect(() => {
    if (!near) {
      host.current?.replaceChildren()
      setLoading(false)
      return
    }
    let active = true,
      render: RenderTask | undefined,
      layer: TextLayer | undefined
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const source = await pdf.getPage(number),
          base = source.getViewport({ scale: 1 })
        if (!active) return
        setAspect(base.height / base.width)
        const viewport = source.getViewport({ scale: width / base.width })
        // Cap backing pixels, including on high-DPI screens and at large zoom.
        const density = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(8000000 / (viewport.width * viewport.height)),
        )
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width * density)
        canvas.height = Math.ceil(viewport.height * density)
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.setAttribute('aria-hidden', 'true')
        render = source.render({
          canvas,
          viewport,
          transform: [density, 0, 0, density, 0, 0],
        })
        await render.promise
        if (!active) return
        host.current?.replaceChildren(canvas)
        if (!thumbnail) {
          const content = await source.getTextContent(),
            engine = await import('pdfjs-dist')
          if (!active || !host.current) return
          const text = document.createElement('div')
          text.className = 'pdf-reader-text'
          text.style.setProperty(
            '--total-scale-factor',
            String(viewport.scale * source.userUnit),
          )
          host.current.append(text)
          layer = new engine.TextLayer({
            container: text,
            viewport,
            textContentSource: content,
          })
          await layer.render()
        }
      } catch (e) {
        if (active && (e as Error).name !== 'RenderingCancelledException')
          setError('Page could not render.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
      render?.cancel()
      layer?.cancel()
    }
  }, [pdf, number, width, near, thumbnail])
  return (
    <div
      ref={box}
      data-pdf-page={thumbnail ? undefined : number}
      className="relative shrink-0 bg-white text-black shadow-sm"
      style={{ width, height: width * aspect }}
      role={thumbnail ? undefined : 'region'}
      aria-label={thumbnail ? undefined : `Page ${number}`}
      aria-busy={loading}
    >
      <div ref={host} className="absolute inset-0" />
      {error && (
        <p
          role="alert"
          className="absolute inset-x-3 top-8 text-center text-xs text-red-700"
        >
          {error}
        </p>
      )}
      {loading && (
        <span
          className="pointer-events-none absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs text-neutral-500"
          role="status"
        >
          {thumbnail ? '…' : 'Loading page…'}
        </span>
      )}
    </div>
  )
}
