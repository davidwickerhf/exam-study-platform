'use client'

/**
 * The chapter reader — the punched paper window.
 *
 * The board is ink. A chapter is the one thing on it that is read at length,
 * so it is laid on the board as paper: true paper, dark ink, hairline rules,
 * and the only element on the surface that carries a shadow. Everything that
 * is not the chapter — the way back, the read mark, the outline, the practice
 * that follows — stays on the ink outside the window, so nothing competes with
 * the text for the reader's attention.
 *
 * The tutor's Markdown parser deliberately handles steps, links and emphasis
 * and nothing else. Course material is a different problem — every chapter is
 * dense with LaTeX (`$f : \{1,\ldots,n\} \to \{1,\ldots,k\}$`), tables and
 * fenced code — so this uses a real pipeline: remark for GFM and maths, rehype
 * for KaTeX and heading ids.
 *
 * The outline is derived from the same headings, through the same slug
 * function the renderer's ids come from, so an outline link can never point at
 * a heading that does not exist. It is a contextual affordance: a quiet rail
 * on very wide screens, a sheet everywhere else, never a reserved column.
 *
 * Read-state is written to the vanilla app's own localStorage key, so marking
 * a chapter read here shows up there and on the course page.
 */

import 'katex/dist/katex.min.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Markdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, FileTextIcon, ListIcon, MessageCircleIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { neighbours, outlineOf, readingMinutes } from '@/lib/workspace/chapter.mjs'
import { COURSE_RETURN_KEY, type StudyCourse, isMaterialPath, materialName, readKey } from '@/lib/workspace/courses.mjs'
import { type PracticeQuestion, gradeRequest, usableOptions } from '@/lib/workspace/practice.mjs'
import { cachedWorkspaceJson } from '@/hooks/use-workspace-data'
import dynamic from 'next/dynamic'
const TutorWorkspace = dynamic(() => import('@/app/app/tutor/tutor-workspace').then(module => module.TutorWorkspace), { loading: () => <p className="p-5 text-sm text-muted-foreground">Opening Tutor…</p> })

type Payload = { title: string; content: string; examples?: string | null }

const NUMERALS = 'font-data tabular-nums'

/** The window: 12px major radius, full-bleed on a phone, the one shadow. */
const PAPER = [
  'bg-paper text-paper-ink shadow-lg',
  'rounded-none sm:rounded-[12px]',
  'px-5 py-8 sm:px-10 sm:py-12'
].join(' ')

/** Prose rules for course material on paper, kept in one place. */
const PAPER_PROSE = [
  'text-paper-ink text-base leading-[1.63]',
  '[&>*+*]:mt-4',
  // A chapter usually opens with its own H1, which the page header already
  // states; it is set as a lead line rather than a second title.
  '[&_h1]:text-paper-ink-secondary [&_h1]:text-xs [&_h1]:font-semibold [&_h1]:tracking-[0.11em] [&_h1]:uppercase',
  '[&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:tracking-tight',
  '[&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_h4]:mt-6 [&_h4]:text-sm [&_h4]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5',
  '[&_strong]:font-semibold',
  '[&_a]:text-paper-link [&_a]:underline [&_a]:underline-offset-2',
  '[&_code]:bg-paper-subtle [&_code]:rounded-[2px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13.5px]',
  '[&_pre]:bg-paper-subtle [&_pre]:text-paper-ink [&_pre]:overflow-x-auto [&_pre]:rounded-[4px] [&_pre]:p-4 [&_pre]:text-[13.5px] [&_pre]:leading-[1.5]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13.5px]',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-paper-rule [&_blockquote]:pl-4 [&_blockquote]:text-paper-ink-secondary',
  '[&_hr]:my-8 [&_hr]:border-t [&_hr]:border-paper-rule',
  // A wide table scrolls inside the window rather than pushing a phone sideways.
  '[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-sm sm:[&_table]:table',
  '[&_th]:border-b [&_th]:border-paper-rule [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border-b [&_td]:border-paper-rule [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top',
  '[&_.katex]:text-[1.02em]',
  '[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1'
].join(' ')

/** The same rules for the short passages that stay on the ink surface. */
const INK_PROSE = [
  'text-base leading-[1.63]',
  '[&>*+*]:mt-4',
  '[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5',
  '[&_strong]:font-semibold',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_code]:bg-card [&_code]:rounded-[2px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13.5px]',
  '[&_pre]:bg-card [&_pre]:overflow-x-auto [&_pre]:rounded-[4px] [&_pre]:p-4 [&_pre]:text-[13.5px]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1'
].join(' ')

/** The short passages on the ink surface need maths, but no heading ids. */
const inkPlugins = () => ({
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }] as [typeof rehypeKatex, Record<string, boolean>]]
})

export default function ChapterPage() {
  const params = useParams<{ courseId: string; chapterId: string; relPath?: string[] }>()
  const router = useRouter()
  const [payload, setPayload] = useState<Payload | null>(null)
  const [course, setCourse] = useState<StudyCourse | null>(null)
  const [read, setRead] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [attempt, setAttempt] = useState('')
  const [grade, setGrade] = useState<{ correction: string; score: number | null } | null>(null)
  const [showReference, setShowReference] = useState(false)
  const [practiceBusy, setPracticeBusy] = useState(false)
  const [practiceError, setPracticeError] = useState<string | null>(null)
  const [deck, setDeck] = useState<Set<string>>(new Set())
  // True only for the first chapter opened from a course register: after that
  // the previous history entry is another chapter, not the register.
  const fromRegister = useRef(false)
  const visits = useRef(0)

  useEffect(() => {
    let live = true
    setPayload(null)
    setError(null)
    const json = (path: string) => cachedWorkspaceJson<any>(path)

    const suffix = params.relPath?.length ? `/${params.relPath.map(encodeURIComponent).join('/')}` : ''
    json(`/api/chapter/${encodeURIComponent(params.courseId)}/${encodeURIComponent(params.chapterId)}${suffix}`)
      .then((data: Payload) => { if (live) setPayload(data) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    json('/api/state')
      .then((data) => { if (live) setCourse((data.courses ?? []).find((entry: StudyCourse) => entry.id === params.courseId) ?? null) })
      .catch(() => {})
    json(`/api/practice?courseId=${encodeURIComponent(params.courseId)}&chapterId=${encodeURIComponent(params.chapterId)}`).then((data: { questions?: PracticeQuestion[] }) => { if (live) setQuestions((data.questions ?? []).filter((question) => question.courseId === params.courseId && question.chapterId === params.chapterId)) }).catch((cause: Error) => { if (live) setPracticeError(cause.message) })
    json('/api/sr/due').then((data: { allIds?: string[] }) => { if (live) setDeck(new Set(data.allIds ?? [])) }).catch(() => {})

    visits.current += 1
    try {
      fromRegister.current = visits.current === 1
        && window.sessionStorage.getItem(COURSE_RETURN_KEY) === `/app/courses/${params.courseId}`
    } catch { fromRegister.current = false }

    try { setRead(Boolean(window.localStorage.getItem(readKey(params.courseId, params.chapterId)))) } catch { /* private mode */ }
    setOutlineOpen(false)
    window.scrollTo({ top: 0 })
    return () => { live = false }
  }, [params.courseId, params.chapterId, params.relPath])

  const outline = useMemo(() => outlineOf(payload?.content ?? ''), [payload])
  const { previous, next } = useMemo(
    () => neighbours(course?.chapters ?? [], params.chapterId),
    [course, params.chapterId]
  )

  /**
   * A cited source is named, never pathed: the chapters carry
   * `Materials/02 Lecture Slides/cs1540-week1-…pdf` and the reader shows
   * "Lecture slides, week 1", linked to the course's own material shelf.
   */
  const paperComponents = useMemo<Components>(() => ({
    code({ className, children, node, ...rest }) {
      const text = Array.isArray(children) ? children.join('') : String(children ?? '')
      if (!className && isMaterialPath(text)) {
        return (
          <Link
            href={`/app/courses/${params.courseId}#course-material`}
            className="border-paper-rule bg-paper-subtle text-paper-link inline-flex max-w-full items-baseline gap-1 rounded-[4px] border px-1.5 py-0.5 align-baseline text-[13.5px] font-medium no-underline hover:border-paper-ink-secondary"
          >
            <FileTextIcon className="size-3 shrink-0 self-center" aria-hidden />
            <span className="truncate">{materialName(text)}</span>
          </Link>
        )
      }
      return <code className={className} {...rest}>{children}</code>
    }
  }), [params.courseId])

  const toggleRead = () => {
    const key = readKey(params.courseId, params.chapterId)
    try {
      if (read) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, new Date().toISOString())
    } catch { /* private mode */ }
    setRead(!read)
  }

  const goBack = (event: React.MouseEvent) => {
    if (!fromRegister.current) return
    event.preventDefault()
    router.back()
  }

  const currentQuestion = questions?.[questionIndex] ?? null
  const checkAnswer = async () => {
    if (!currentQuestion || !attempt.trim() || practiceBusy) return
    setPracticeBusy(true); setPracticeError(null)
    try {
      const response = await fetch('/api/grade', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(gradeRequest(currentQuestion, attempt, course?.code ?? params.courseId, payload?.title ?? 'Practice')) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `Grading returned ${response.status}`)
      setGrade(data); setDeck((current) => new Set(current).add(currentQuestion.id))
    } catch (cause) { setPracticeError((cause as Error).message) } finally { setPracticeBusy(false) }
  }

  const addCard = async () => {
    if (!currentQuestion || practiceBusy) return
    setPracticeBusy(true); setPracticeError(null)
    try {
      const response = await fetch('/api/sr/add', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ questionId: currentQuestion.id }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `Flashcards returned ${response.status}`)
      setDeck((current) => new Set(current).add(currentQuestion.id))
    } catch (cause) { setPracticeError((cause as Error).message) } finally { setPracticeBusy(false) }
  }

  const moveQuestion = (nextIndex: number) => { setQuestionIndex(nextIndex); setAttempt(''); setGrade(null); setShowReference(false); setPracticeError(null) }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>That chapter could not be read</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <Link href={`/app/courses/${params.courseId}`} className="text-primary text-sm font-semibold">Back to the course</Link>
        </Empty>
      </div>
    )
  }

  const outlineLinks = (onNavigate?: () => void) =>
    outline.map((heading) => (
      <a
        key={heading.id}
        href={`#${heading.id}`}
        onClick={onNavigate}
        className={`text-muted-foreground hover:text-foreground rounded-[2px] py-0.5 text-[13.5px] leading-snug ${heading.depth > 2 ? 'pl-3' : ''}`}
      >
        {heading.text}
      </a>
    ))

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-8 py-6 sm:px-6 sm:py-8 xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-10">
      <div className="mx-auto flex w-full min-w-0 max-w-[calc(74ch+7rem)] flex-col gap-6">
        {/* Chrome stays on the ink, outside the window. */}
        <header className="flex flex-col gap-2 border-b px-5 pb-5 sm:px-0">
          <Link
            href={`/app/courses/${params.courseId}`}
            onClick={goBack}
            className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeftIcon className="size-3.5" />
            {course?.code ?? 'Course'}
          </Link>
          {payload ? (
            <>
              <h1 className="font-heading text-[32px] leading-tight tracking-tight">{payload.title}</h1>
              <p className={`text-muted-foreground text-xs ${NUMERALS}`}>
                Chapter {params.chapterId} · about {readingMinutes(payload.content)} min
              </p>
            </>
          ) : (
            <><Skeleton className="h-8 w-80 max-w-full" /><Skeleton className="h-3 w-40" /></>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant={read ? 'secondary' : 'outline'} size="sm" onClick={toggleRead} aria-pressed={read}>
              {read && <CheckIcon data-icon="inline-start" />}
              {read ? 'Read' : 'Mark as read'}
            </Button>
            {outline.length > 0 && (
              <Button variant="ghost" size="sm" className="xl:hidden" onClick={() => setOutlineOpen(true)} aria-haspopup="dialog">
                <ListIcon data-icon="inline-start" />Outline
              </Button>
            )}
          </div>
        </header>

        {/* The window. */}
        <article className={PAPER}>
          <div className="mx-auto w-full max-w-[74ch] min-w-0">
            {!payload ? (
              <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading chapter">
                <div className="bg-paper-subtle h-3 w-24 animate-pulse rounded-[2px]" />
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className={`bg-paper-subtle h-4 animate-pulse rounded-[2px] ${index % 4 === 3 ? 'w-2/3' : 'w-full'}`} />
                ))}
              </div>
            ) : (
              <>
                <div className={PAPER_PROSE}>
                  <Markdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeSlug, [rehypeKatex, { throwOnError: false, strict: false }]]}
                    components={paperComponents}
                  >
                    {payload.content}
                  </Markdown>
                </div>

                {payload.examples && (
                  <section className="mt-12 border-t border-paper-rule pt-8">
                    <h2 className="text-paper-ink-secondary mb-4 text-xs font-semibold tracking-[0.11em] uppercase">Worked examples</h2>
                    <div className={PAPER_PROSE}>
                      <Markdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeSlug, [rehypeKatex, { throwOnError: false, strict: false }]]}
                        components={paperComponents}
                      >
                        {payload.examples}
                      </Markdown>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </article>

        {payload && (
          <section className="flex flex-col gap-4 px-5 sm:px-0" aria-labelledby="chapter-practice-title">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3"><div><h2 id="chapter-practice-title" className="text-base font-semibold">Practice questions</h2><p className="text-muted-foreground mt-1 text-sm">Published questions for this chapter. Checking an answer records study activity and adds it to your flashcard deck.</p></div>{questions && <span className={`text-muted-foreground text-sm ${NUMERALS}`}>{questions.length}</span>}</div>
            {questions === null ? <Skeleton className="h-48 w-full" /> : !questions.length ? <Empty><EmptyHeader><EmptyTitle>No published questions</EmptyTitle><EmptyDescription>This chapter does not have a published question bank yet.</EmptyDescription></EmptyHeader></Empty> : currentQuestion && <div className="flex flex-col gap-4"><div className="flex items-center justify-between"><strong className={NUMERALS}>Question {questionIndex + 1} / {questions.length}</strong><span className="text-muted-foreground text-xs">{currentQuestion.type}</span></div><div className={INK_PROSE}><Markdown {...inkPlugins()}>{currentQuestion.question}</Markdown></div>{usableOptions(currentQuestion).length > 0 && <ol className="list-[lower-alpha] pl-5 text-sm">{usableOptions(currentQuestion).map((option) => <li key={option}>{option}</li>)}</ol>}<Textarea value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="Write your answer…" disabled={practiceBusy} /><div className="flex flex-wrap gap-2"><Button onClick={() => void checkAnswer()} disabled={!attempt.trim() || practiceBusy}>{practiceBusy ? 'Checking…' : 'Check answer'}</Button><Button variant="outline" onClick={() => void addCard()} disabled={practiceBusy || deck.has(currentQuestion.id)}>{deck.has(currentQuestion.id) ? <CheckIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}{deck.has(currentQuestion.id) ? 'In flashcards' : 'Add to flashcards'}</Button>{currentQuestion.expected && <Button variant="ghost" onClick={() => setShowReference((shown) => !shown)}>{showReference ? 'Hide reference' : 'Reference answer'}</Button>}<Button variant="outline" onClick={() => setTutorOpen(true)}><MessageCircleIcon data-icon="inline-start" />Ask the tutor</Button></div>{showReference && currentQuestion.expected && <div className="bg-paper text-paper-ink rounded-[4px] p-5 text-sm leading-relaxed shadow-lg"><Markdown {...inkPlugins()}>{currentQuestion.expected}</Markdown></div>}{grade && <div className="bg-paper text-paper-ink rounded-[4px] p-5 shadow-lg"><strong className={NUMERALS}>{grade.score ?? '—'}/10</strong><div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{grade.correction}</div></div>}{practiceError && <p role="alert" className="text-destructive text-sm">{practiceError}</p>}<div className="flex justify-between border-t pt-3"><Button variant="ghost" disabled={questionIndex === 0} onClick={() => moveQuestion(questionIndex - 1)}>Previous</Button><Button variant="ghost" disabled={questionIndex === questions.length - 1} onClick={() => moveQuestion(questionIndex + 1)}>Next</Button></div></div>}
          </section>
        )}

        <nav className="mt-4 flex items-center justify-between gap-4 border-t px-5 pt-5 sm:px-0" aria-label="Chapters">
          {previous ? (
            <Link href={`/app/courses/${params.courseId}/${previous.id}`} className="hover:text-foreground text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
              <ArrowLeftIcon className="size-4 shrink-0" />
              <span className="truncate">{previous.name}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/app/courses/${params.courseId}/${next.id}`} className="hover:text-foreground text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
              <span className="truncate">{next.name}</span>
              <ArrowRightIcon className="size-4 shrink-0" />
            </Link>
          ) : <span />}
        </nav>
      </div>

      {/* A quiet rail where there is room to spare for one, and nowhere else. */}
      <aside className="hidden xl:block">
        {outline.length > 0 && (
          <nav className="sticky top-8 flex max-h-[80dvh] flex-col gap-1.5 overflow-y-auto" aria-label="On this page">
            <h2 className="text-muted-foreground mb-1 text-xs font-semibold tracking-[0.11em] uppercase">On this page</h2>
            {outlineLinks()}
          </nav>
        )}
      </aside>

      <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
        <SheetContent side="right" className="flex flex-col gap-4 overflow-y-auto p-5">
          <SheetHeader className="p-0"><SheetTitle>Outline</SheetTitle></SheetHeader>
          <nav className="flex flex-col gap-1.5" aria-label="On this page">
            {outlineLinks(() => setOutlineOpen(false))}
          </nav>
        </SheetContent>
      </Sheet>
      <Sheet open={tutorOpen} onOpenChange={setTutorOpen}>
        <SheetContent side="right" className="w-[min(1120px,96vw)] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none">
          <SheetTitle className="sr-only">Tutor for {course?.code || params.courseId}</SheetTitle>
          <TutorWorkspace embedded initialContext={{ courseId: course?.id || params.courseId, courseCode: course?.code, courseName: course?.name, chapterId: params.chapterId, chapterName: payload?.title, sourcePath: course?.chapters?.find((chapter) => chapter.id === params.chapterId)?.file }} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
