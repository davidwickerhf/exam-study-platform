'use client'
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { ArrowLeftIcon, Columns2Icon, MaximizeIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StudySource, Evidence } from '@/lib/workspace/study-versions'
import { StudyDocument } from './study-document'

type Companion =
  | { kind: 'document'; source: StudySource; chunks: Evidence[]; page: number }
  | { kind: 'tutor'; title: string; description: string; content: ReactNode }
type Desk = {
  companion: Companion | null
  openDocument: (source: StudySource, chunks: Evidence[], page?: number) => void
  openTutor: (title: string, description: string, content: ReactNode) => void
  close: () => void
}
const Context = createContext<Desk | null>(null)
export const useStudyDesk = () => useContext(Context)
export function StudyDesk({ children }: { children: ReactNode }) {
  const [companion, setCompanion] = useState<Companion | null>(null),
    [focus, setFocus] = useState(false),
    [mobileSource, setMobileSource] = useState(true)
  const workAnchor = useRef<HTMLElement | null>(null),
    workScroll = useRef(0)
  function rememberWork() {
    if (!focus && (mobileSource === false || window.innerWidth >= 1024))
      workScroll.current = window.scrollY
    const target =
      document.activeElement?.closest<HTMLElement>('[data-study-task]')
    if (target) workAnchor.current = target
  }
  function restoreWork() {
    requestAnimationFrame(() => {
      if (workAnchor.current?.isConnected)
        workAnchor.current.scrollIntoView({
          block: 'start',
          behavior: 'instant',
        })
      else window.scrollTo({ top: workScroll.current, behavior: 'instant' })
    })
  }
  function toggleFocus() {
    if (!focus) rememberWork()
    setFocus(!focus)
    if (focus) restoreWork()
    else
      requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: 'instant' }),
      )
  }
  const close = () => {
    setCompanion(null)
    setFocus(false)
    restoreWork()
  }
  const value: Desk = {
    companion,
    close,
    openDocument: (source, chunks, page = 1) => {
      rememberWork()
      setCompanion({ kind: 'document', source, chunks, page })
      if (window.innerWidth >= 1024) restoreWork()
      else
        requestAnimationFrame(() =>
          window.scrollTo({ top: 0, behavior: 'instant' }),
        )
      setMobileSource(true)
    },
    openTutor: (title, description, content) => {
      rememberWork()
      setCompanion({ kind: 'tutor', title, description, content })
      setMobileSource(true)
    },
  }
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const change = () => {
      if (query.matches && companion && mobileSource)
        requestAnimationFrame(() =>
          window.scrollTo({ top: 0, behavior: 'instant' }),
        )
    }
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [companion, mobileSource])
  const name =
    companion?.kind === 'document'
      ? companion.source.title
          .replace(/^\d+\s*/, '')
          .replace(/--file-\d+/, '')
          .replace(/_/g, ' ')
      : companion?.title
  return (
    <Context.Provider value={value}>
      {companion && (
        <div
          className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background px-3 py-2 lg:hidden"
          aria-label="Study view"
        >
          <Button
            size="sm"
            variant={!mobileSource ? 'secondary' : 'ghost'}
            onClick={() => {
              setMobileSource(false)
              restoreWork()
            }}
          >
            Your work
          </Button>
          <Button
            size="sm"
            variant={mobileSource ? 'secondary' : 'ghost'}
            onClick={() => {
              rememberWork()
              setMobileSource(true)
              requestAnimationFrame(() =>
                window.scrollTo({ top: 0, behavior: 'instant' }),
              )
            }}
          >
            {companion.kind === 'document' ? 'Document' : 'Tutor'}
          </Button>
          <Button
            className="ml-auto"
            size="icon-sm"
            variant="ghost"
            aria-label="Close reference"
            onClick={close}
          >
            <XIcon />
          </Button>
        </div>
      )}
      <div
        className={
          companion && !focus
            ? 'grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(420px,46%)]'
            : 'min-w-0'
        }
      >
        <div
          className={
            companion
              ? focus
                ? 'hidden'
                : mobileSource
                  ? 'hidden min-w-0 lg:block'
                  : 'min-w-0'
              : 'min-w-0'
          }
        >
          {children}
        </div>
        {companion && (
          <aside
            aria-label={
              companion.kind === 'document'
                ? 'Reference document'
                : 'Chapter tutor'
            }
            className={`${mobileSource ? 'flex' : 'hidden lg:flex'} sticky top-12 lg:top-0 min-h-0 min-w-0 flex-col border-l bg-background ${focus ? 'h-[calc(100dvh-7rem)]' : 'h-[calc(100dvh-7rem)] lg:h-screen'}`}
          >
            <header className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
              {focus && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Back to split view"
                  onClick={toggleFocus}
                >
                  <ArrowLeftIcon />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium" title={name}>
                  {name}
                </h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {companion.kind === 'document'
                    ? `${companion.source.academicYear} · Original document`
                    : companion.description}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                className="hidden lg:inline-flex"
                aria-label={focus ? 'Split view' : 'Focus document'}
                title={focus ? 'Split view' : 'Focus document'}
                onClick={toggleFocus}
              >
                {focus ? <Columns2Icon /> : <MaximizeIcon />}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close reference"
                title="Close reference"
                className="hidden lg:inline-flex"
                onClick={close}
              >
                <XIcon />
              </Button>
            </header>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col [&_.pdf-reader]:rounded-none [&_.pdf-reader]:border-0">
              {companion.kind === 'document' ? (
                <StudyDocument
                  source={companion.source}
                  chunks={companion.chunks}
                  initialPage={companion.page}
                />
              ) : (
                companion.content
              )}
            </div>
          </aside>
        )}
      </div>
    </Context.Provider>
  )
}
