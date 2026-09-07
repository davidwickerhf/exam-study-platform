'use client'
import './course-tutor.css'
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { ArrowLeftIcon, Columns2Icon, MaximizeIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StudySource, Evidence } from '@/lib/workspace/study-versions'
import dynamic from 'next/dynamic'
import type { TutorContext } from '@/app/app/tutor/tutor-workspace'
const CourseTutor = dynamic(() => import('@/app/app/tutor/tutor-workspace').then(m=>m.TutorWorkspace), {loading:()=> <p role="status" className="p-5 text-sm">Opening tutor…</p>})
import { StudyDocument } from './study-document'

type Companion =
  | { kind: 'course-tutor' }
  | { kind: 'document'; source: StudySource; chunks: Evidence[]; page: number }
  | { kind: 'tutor'; title: string; description: string; content: ReactNode }
type Desk = {
  companion: Companion | null
  openDocument: (source: StudySource, chunks: Evidence[], page?: number, focusDocument?: boolean) => void
  openTutor: (title: string, description: string, content: ReactNode) => void
  courseContext: TutorContext | null
  setCourseContext: (context: TutorContext | null) => void
  setTutorSelection: (selection: {tab: string; value: NonNullable<TutorContext['selection']>} | null) => void
  openCourseTutor: () => void
  close: () => void
}
const Context = createContext<Desk | null>(null)
export const useStudyDesk = () => useContext(Context)
export function StudyDesk({ children }: { children: ReactNode }) {
  const [courseContext,setCourseContext] = useState<TutorContext | null>(null)
  const [tutorSelection,setTutorSelection] = useState<{tab:string;value:NonNullable<TutorContext['selection']>} | null>(null)
  const [tutorStarted,setTutorStarted] = useState(false)
  const liveTutorContext = {...courseContext,selection:tutorSelection?.tab===courseContext?.courseTab ? tutorSelection?.value : undefined}
  const [companion, setCompanion] = useState<Companion | null>(null),
    [focus, setFocus] = useState(false),
    [mobileSource, setMobileSource] = useState(true)
  const returnFocus = useRef<HTMLElement | null>(null)
  const workAnchor = useRef<HTMLElement | null>(null),
    workScroll = useRef(0)
  function rememberWork() {
    const active=document.activeElement
    if(active instanceof HTMLElement && !active.closest('aside')) returnFocus.current=active
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
    if(returnFocus.current?.isConnected) returnFocus.current.focus({preventScroll:true})
    restoreWork()
  }
  const value: Desk = {
    companion,
    courseContext, setCourseContext, setTutorSelection,
    openCourseTutor: () => { rememberWork(); setTutorStarted(true); setCompanion({kind:'course-tutor'}); setFocus(false); setMobileSource(true); if(window.innerWidth<1024) requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'})) },
    close,
    openDocument: (source, chunks, page = 1, focusDocument) => {
      rememberWork()
      if(courseContext) setTutorSelection({tab:courseContext.courseTab || 'study',value:{kind:'document',title:source.title,sourceAssetId:source.assetId,page}})
      setCompanion({ kind: 'document', source, chunks, page })
      if (focusDocument !== undefined) setFocus(focusDocument)
      if (focusDocument) requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      if (window.innerWidth >= 1024 && !focusDocument) restoreWork()
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
  useEffect(()=>{
    if(!companion) return
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape' && !event.defaultPrevented && !document.querySelector('[role=dialog]')) close()}
    window.addEventListener('keydown',escape)
    return()=>window.removeEventListener('keydown',escape)
  },[companion])
  const documentSource = companion?.kind==='document' ? companion.source : null
  const onDocumentPage = useCallback((page:number)=>{
    if(documentSource && courseContext) setTutorSelection({tab:courseContext.courseTab || 'study',value:{kind:'document',title:documentSource.title,sourceAssetId:documentSource.assetId,page}})
  },[documentSource,courseContext?.courseTab])
  const name =
    companion?.kind === 'document'
      ? companion.source.title
          .replace(/^\d+\s*/, '')
          .replace(/--file-\d+/, '')
          .replace(/_/g, ' ')
      : companion?.kind==='course-tutor' ? 'Course tutor' : companion?.title
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
              setFocus(false)
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
            ? companion.kind==='course-tutor' ? 'grid min-w-0 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]' : 'grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(420px,46%)]'
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
        {(companion || tutorStarted) && (
          <aside
            aria-label={
              companion?.kind === 'document'
                ? 'Reference document'
                : companion?.kind === 'course-tutor' ? 'Course tutor' : 'Chapter tutor'
            }
            className={`${!companion ? 'hidden' : mobileSource ? 'flex' : 'hidden lg:flex'} sticky top-12 lg:top-0 min-h-0 min-w-0 flex-col border-l bg-background ${companion?.kind==='course-tutor' ? 'h-[calc(100dvh-10.5rem)]' : 'h-[calc(100dvh-7rem)]'} lg:h-screen`}
          >
            <header className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
              {companion?.kind==='document' && courseContext && <Button size="sm" variant="outline" onClick={value.openCourseTutor}>Ask tutor</Button>}
              {focus && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="hidden lg:inline-flex"
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
                  {companion?.kind === 'document'
                    ? `${companion.source.academicYear} · Original document`
                    : companion?.kind==='course-tutor' ? `${courseContext?.courseCode || ''} · ${courseContext?.courseTabLabel || 'Course'}` : companion?.kind==='tutor' ? companion.description : ''}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                className="hidden lg:inline-flex"
                aria-label={focus ? 'Split view' : companion?.kind==='document' ? 'Focus document' : 'Focus tutor'}
                title={focus ? 'Split view' : companion?.kind==='document' ? 'Focus document' : 'Focus tutor'}
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
              {companion?.kind === 'document' ? (
                <StudyDocument
                  source={companion.source}
                  chunks={companion.chunks}
                  initialPage={companion.page}
                  onPageChange={onDocumentPage}
                />
              ) : (
                companion?.kind==='tutor' ? companion.content : null
              )}
              {tutorStarted && <div className={companion?.kind==='course-tutor' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}><CourseTutor embedded initialContext={liveTutorContext}/></div>}
            </div>
          </aside>
        )}
      </div>
    </Context.Provider>
  )
}
