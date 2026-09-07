'use client'
import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
export function usePdfDocument(url?: string, file?: File) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true,
      task: ReturnType<(typeof import('pdfjs-dist'))['getDocument']> | undefined
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 90000)
    setError('')
    setPdf(null)
    void (async () => {
      try {
        // The app's authenticated fetch wrapper supplies the session. PDF.js
        // receives bytes only, so no cookie, key or token enters its worker.
        const max = 64 * 1024 * 1024
        let bytes: Uint8Array
        if (file) {
          if (file.size > max)
            throw new Error('This file exceeds the 64 MB preview limit.')
          bytes = new Uint8Array(await file.arrayBuffer())
        } else {
          if (!url) throw new Error('Choose a document to preview.')
          const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store',
          })
          if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            throw new Error(
              body.error || `Document unavailable (HTTP ${response.status}).`,
            )
          }
          if (Number(response.headers.get('content-length')) > max)
            throw new Error(
              'This document exceeds the 64 MB preview limit. Download the original to inspect it.',
            )
          const reader = response.body?.getReader()
          if (!reader) throw new Error('The document response was empty.')
          const parts: Uint8Array[] = []
          let total = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            total += value.length
            if (total > max) {
              await reader.cancel()
              throw new Error(
                'This document exceeds the 64 MB preview limit. Download the original to inspect it.',
              )
            }
            parts.push(value)
          }
          bytes = new Uint8Array(total)
          let offset = 0
          for (const part of parts) {
            bytes.set(part, offset)
            offset += part.length
          }
        }
        if (!active) return
        const engine = await import('pdfjs-dist')
        const assets = `/vendor/pdfjs/${engine.version}/`
        engine.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`
        task = engine.getDocument({
          data: bytes,
          cMapUrl: `${assets}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${assets}standard_fonts/`,
          wasmUrl: `${assets}wasm/`,
        })
        const document = await task.promise
        if (active) setPdf(document)
      } catch (e) {
        if (active)
          setError(
            controller.signal.aborted
              ? 'Loading took too long. Try again or download the original.'
              : (e as Error).message,
          )
      } finally {
        clearTimeout(timer)
      }
    })()
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
      void task?.destroy()
    }
  }, [url, file, retry])
  return { pdf, error, retry: () => setRetry((r) => r + 1) }
}
