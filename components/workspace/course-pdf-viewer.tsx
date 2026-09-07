'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
  LoaderCircleIcon,
  PanelLeftIcon,
  SearchIcon,
  MaximizeIcon,
  MinimizeIcon,
  DownloadIcon,
  XIcon,
  TextIcon,
} from 'lucide-react'
import { usePdfDocument } from './use-pdf-document'
import { PdfPage } from './pdf-page'

export default function CoursePdfViewer({
  url,
  file,
  title,
  slides = false,
  initialPage = 1,
  hideFullscreen = false,
}: {
  url?: string
  file?: File
  title: string
  slides?: boolean
  initialPage?: number
  hideFullscreen?: boolean
}) {
  const { pdf, error, retry } = usePdfDocument(url, file)
  const root = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    rail = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 760, height: 600 }),
    [base, setBase] = useState({ width: 612, height: 792 })
  const [page, setPage] = useState(initialPage),
    [draft, setDraft] = useState(String(initialPage)),
    [fit, setFit] = useState(slides ? 'page' : 'width'),
    [zoom, setZoom] = useState(1)
  const [thumbs, setThumbs] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(''),
    [matches, setMatches] = useState<number[]>([]),
    [searching, setSearching] = useState(false),
    [searched, setSearched] = useState(false)
  const [textView, setTextView] = useState(false),
    [text, setText] = useState(''),
    [expanded, setExpanded] = useState(false),
    [actionError, setActionError] = useState(''),
    [download, setDownload] = useState(url)
  const textCache = useRef(new Map<number, string>()),
    searchRun = useRef(0),
    pendingJump = useRef<number | null>(initialPage)
  const unit = slides ? 'Slide' : 'Page'
  const currentPage = useRef(page)
  currentPage.current = page
  useEffect(() => {
    setDraft(String(page))
  }, [page])
  useEffect(() => {
    if (!file) {
      setDownload(url)
      return
    }
    const object = URL.createObjectURL(file)
    setDownload(object)
    return () => URL.revokeObjectURL(object)
  }, [file, url])
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(([e]) => {
      pendingJump.current = currentPage.current
      setSize({
        width: Math.max(180, e.contentRect.width - 32),
        height: Math.max(160, e.contentRect.height - 32),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let live = true
    textCache.current.clear()
    searchRun.current++
    setMatches([])
    setSearched(false)
    setSearching(false)
    setTextView(false)
    setText('')
    setActionError('')
    setFit(slides ? 'page' : 'width')
    setZoom(1)
    if (pdf)
      void pdf
        .getPage(Math.min(pdf.numPages, Math.max(1, initialPage)))
        .then((p) => {
          if (!live) return
          const v = p.getViewport({ scale: 1 })
          setBase({ width: v.width, height: v.height })
          pendingJump.current = Math.min(pdf.numPages, Math.max(1, initialPage))
          setPage(pendingJump.current)
        })
        .catch(() => live && setActionError('The first page could not load.'))
    return () => {
      live = false
      searchRun.current++
    }
  }, [pdf, slides])
  const width =
    fit === 'width'
      ? size.width
      : fit === 'page'
        ? Math.min(size.width, (size.height * base.width) / base.height)
        : base.width * zoom
  const jump = useCallback(
    (number: number) => {
      if (!pdf) return
      const next = Math.min(pdf.numPages, Math.max(1, Math.floor(number) || 1))
      setPage(next)
      setDraft(String(next))
      const box = viewport.current?.querySelector<HTMLElement>(
        `[data-pdf-page="${next}"]`,
      )
      if (box && viewport.current)
        viewport.current.scrollTo({
          top: box.offsetTop - 16,
          behavior: 'instant',
        })
    },
    [pdf],
  )
  useEffect(() => {
    if (pdf) jump(initialPage)
  }, [pdf, initialPage, jump])
  useEffect(() => {
    if (!pdf) return
    const frame = requestAnimationFrame(() => {
      if (pendingJump.current !== null) {
        jump(pendingJump.current)
        pendingJump.current = null
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [pdf, width, base, jump, textView])
  useEffect(() => {
    const view = viewport.current
    if (!view || !pdf || textView) return
    let frame = 0
    const track = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const boxes = [...view.querySelectorAll<HTMLElement>('[data-pdf-page]')]
        const middle = view.scrollTop + Math.min(view.clientHeight / 3, 180)
        const current = boxes.find(
          (box) => box.offsetTop + box.offsetHeight > middle,
        )
        if (current) setPage(Number(current.dataset.pdfPage))
      })
    }
    view.addEventListener('scroll', track, { passive: true })
    return () => {
      view.removeEventListener('scroll', track)
      cancelAnimationFrame(frame)
    }
  }, [pdf, textView])
  const readText = useCallback(
    async (number: number) => {
      if (textCache.current.has(number)) return textCache.current.get(number)!
      if (!pdf) return ''
      const p = await pdf.getPage(number),
        content = await p.getTextContent()
      const result = content.items
        .map((item) =>
          'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '',
        )
        .join('')
      textCache.current.set(number, result)
      return result
    },
    [pdf],
  )
  useEffect(() => {
    let live = true
    if (textView) {
      setText('')
      void readText(page)
        .then((t) => live && setText(t))
        .catch(() => live && setActionError('Page text could not load.'))
    }
    return () => {
      live = false
    }
  }, [page, textView, readText])
  async function search() {
    const run = ++searchRun.current,
      term = query.trim().toLocaleLowerCase()
    setMatches([])
    setSearched(false)
    if (!pdf || !term) {
      setSearching(false)
      return
    }
    setSearching(true)
    setActionError('')
    try {
      const result: number[] = []
      for (let n = 1; n <= pdf.numPages; n++) {
        if (run !== searchRun.current) return
        if (
          (await readText(n))
            .replace(/\s+/g, ' ')
            .toLocaleLowerCase()
            .includes(term.replace(/\s+/g, ' '))
        )
          result.push(n)
      }
      if (run !== searchRun.current) return
      setMatches(result)
      setSearched(true)
      if (result.length) jump(result[0])
    } catch {
      if (run === searchRun.current)
        setActionError('Search could not finish. Try again.')
    } finally {
      if (run === searchRun.current) setSearching(false)
    }
  }
  function changeZoom(value: string) {
    pendingJump.current = page
    if (value === 'width' || value === 'page') setFit(value)
    else {
      setFit('custom')
      setZoom(Math.min(3, Math.max(0.25, Number(value))))
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === root.current)
        await document.exitFullscreen()
      else await root.current?.requestFullscreen()
    } catch {
      setActionError(
        'Fullscreen is unavailable in this browser. Use the panel’s Expand control.',
      )
    }
  }
  useEffect(() => {
    const changed = () =>
      setExpanded(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  return (
    <div
      ref={root}
      className="pdf-reader flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border bg-background"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault()
          setSearchOpen(true)
          return
        }
        if ((e.target as HTMLElement).closest('input,select,textarea,button,a'))
          return
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          jump(page + 1)
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          jump(page - 1)
        }
      }}
    >
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b px-2 py-1.5"
        aria-label="Document controls"
      >
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            title="Page thumbnails"
            aria-label="Page thumbnails"
            aria-pressed={thumbs}
            disabled={!pdf}
            onClick={() => setThumbs((v) => !v)}
          >
            <PanelLeftIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Find in document"
            aria-label="Find in document"
            aria-pressed={searchOpen}
            disabled={!pdf}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <SearchIcon />
          </Button>
          <span className="mx-1 h-4 border-l" />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={slides ? 'Previous slide' : 'Previous page'}
            disabled={!pdf || page <= 1}
            onClick={() => jump(page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <label className="flex items-center gap-1.5 text-xs tabular-nums">
            <span className="sr-only">{unit}</span>
            <input
              aria-label={slides ? 'Slide number' : 'Page number'}
              inputMode="numeric"
              type="number"
              min={1}
              max={pdf?.numPages}
              value={draft}
              disabled={!pdf}
              className="h-8 w-11 rounded border bg-background px-1 text-center text-xs focus-visible:outline-2 focus-visible:outline-primary"
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => jump(Number(draft))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  jump(Number(draft))
                }
                if (e.key === 'Escape') setDraft(String(page))
              }}
            />
            <span className="min-w-6 text-muted-foreground">
              / {pdf?.numPages || '—'}
            </span>
          </label>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={slides ? 'Next slide' : 'Next page'}
            disabled={!pdf || page >= pdf.numPages}
            onClick={() => jump(page + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom out"
            disabled={!pdf || textView || width / base.width <= 0.25}
            onClick={() => changeZoom(String(width / base.width - 0.25))}
          >
            <MinusIcon />
          </Button>
          <select
            aria-label="Zoom"
            value={fit === 'custom' ? String(zoom) : fit}
            disabled={!pdf || textView}
            className="h-8 max-w-28 rounded bg-transparent px-1 text-xs focus-visible:outline-2 focus-visible:outline-primary"
            onChange={(e) => changeZoom(e.target.value)}
          >
            <option value="width">Fit width</option>
            <option value="page">Fit page</option>
            {[...new Set([0.5, 0.75, 1, 1.25, 1.5, 2, 3, zoom])]
              .sort((a, b) => a - b)
              .map((z) => (
                <option key={z} value={z}>
                  {Math.round(z * 100)}%
                </option>
              ))}
          </select>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom in"
            disabled={!pdf || textView || width / base.width >= 3}
            onClick={() => changeZoom(String(width / base.width + 0.25))}
          >
            <PlusIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title={textView ? 'Show page' : 'Page text'}
            aria-label={textView ? 'Show page' : 'Page text'}
            aria-pressed={textView}
            disabled={!pdf}
            onClick={() => {
              pendingJump.current = page
              setTextView((v) => !v)
            }}
          >
            <TextIcon />
          </Button>
          {download && (
            <a
              href={download}
              download={file?.name || title}
              aria-label="Download PDF"
              title="Download PDF"
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
            >
              <DownloadIcon className="size-4" />
            </a>
          )}
          {!hideFullscreen && (
            <Button
              size="icon-sm"
              variant="ghost"
              title={expanded ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label={expanded ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={() => void toggleFullscreen()}
            >
              {expanded ? <MinimizeIcon /> : <MaximizeIcon />}
            </Button>
          )}
        </div>
      </div>
      {searchOpen && (
        <form
          className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault()
            void search()
          }}
        >
          <input
            autoFocus
            aria-label="Search document"
            placeholder="Find in document"
            value={query}
            className="h-8 min-w-24 flex-1 rounded border bg-background px-2 text-sm"
            onChange={(e) => {
              searchRun.current++
              setSearching(false)
              setSearched(false)
              setMatches([])
              setQuery(e.target.value)
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!query.trim() || searching}
            type="submit"
          >
            Find
          </Button>
          {searching ? (
            <span role="status" className="text-xs">
              Searching…
            </span>
          ) : (
            searched && (
              <span role="status" className="text-xs text-muted-foreground">
                {matches.length
                  ? `${matches.length} matching ${matches.length === 1 ? 'page' : 'pages'}`
                  : 'No matching text'}
              </span>
            )
          )}
          {matches.length > 0 && (
            <select
              aria-label="Search results"
              className="h-8 max-w-28 rounded border bg-background px-1 text-xs"
              value={matches.includes(page) ? page : ''}
              onChange={(e) => jump(Number(e.target.value))}
            >
              <option value="" disabled>
                Go to match
              </option>
              {matches.map((n) => (
                <option key={n} value={n}>
                  Page {n}
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Close search"
            onClick={() => {
              searchRun.current++
              setSearching(false)
              setSearchOpen(false)
            }}
          >
            <XIcon />
          </Button>
        </form>
      )}
      {(error || actionError) && (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-3 border-b px-3 py-2 text-sm text-destructive"
        >
          <p>{error || actionError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActionError('')
              retry()
            }}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {thumbs && pdf && (
          <div
            ref={rail}
            aria-label="Document pages"
            className="w-24 shrink-0 space-y-4 overflow-y-auto border-r bg-muted/40 p-2 sm:w-32 sm:p-3"
          >
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to page ${i + 1}`}
                aria-current={page === i + 1 ? 'page' : undefined}
                className="group block w-full rounded p-1 text-xs focus-visible:outline-2 focus-visible:outline-primary aria-[current=page]:bg-primary/10"
                onClick={() => jump(i + 1)}
              >
                <div className="overflow-hidden rounded-sm ring-1 ring-border group-aria-[current=page]:ring-2 group-aria-[current=page]:ring-primary">
                  <PdfPage
                    pdf={pdf}
                    number={i + 1}
                    width={64}
                    ratio={base.height / base.width}
                    root={rail}
                    thumbnail
                  />
                </div>
                <span className="mt-1.5 block tabular-nums">{i + 1}</span>
              </button>
            ))}
          </div>
        )}
        <div
          ref={viewport}
          tabIndex={0}
          aria-label="PDF pages"
          className="relative min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary dark:bg-neutral-900"
        >
          {!pdf && !error && (
            <div
              role="status"
              className="flex h-full min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircleIcon className="size-4 animate-spin" />
              Loading document…
            </div>
          )}
          {pdf &&
            (textView ? (
              <pre className="m-4 whitespace-pre-wrap break-words rounded bg-card p-5 font-sans text-sm leading-7">
                {text ||
                  'No selectable text on this page. Use the rendered page for graphics.'}
              </pre>
            ) : (
              <div className="flex min-w-full w-max flex-col items-center gap-5 p-4">
                {Array.from({ length: pdf.numPages }, (_, i) => (
                  <PdfPage
                    key={i}
                    pdf={pdf}
                    number={i + 1}
                    width={width}
                    ratio={base.height / base.width}
                    root={viewport}
                  />
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
