'use client'

/**
 * The chapter reader.
 *
 * The tutor's Markdown parser deliberately handles steps, links and emphasis
 * and nothing else. Course material is a different problem — every chapter is
 * dense with LaTeX (`$f : \{1,\ldots,n\} \to \{1,\ldots,k\}$`), tables and
 * fenced code — so this uses a real pipeline: remark for GFM and maths, rehype
 * for KaTeX and heading ids.
 *
 * The outline is derived from the same headings, through the same slug
 * function the renderer's ids come from, so an outline link can never point at
 * a heading that does not exist.
 *
 * Read-state is written to the vanilla app's own localStorage key, so marking
 * a chapter read here shows up there and on the course page.
 */

import 'katex/dist/katex.min.css'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Markdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ListIcon, MessageCircleIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { neighbours, outlineOf, readingMinutes } from '@/lib/v2/chapter.mjs'
import { type StudyCourse, readKey } from '@/lib/v2/courses.mjs'
import { type PracticeQuestion, gradeRequest, usableOptions } from '@/lib/v2/practice.mjs'

type Payload = { title: string; content: string; examples?: string | null }

const NUMERALS = 'font-data tabular-nums'

/** Prose rules for course material, kept in one place rather than per element. */
const PROSE = [
  'text-[15.5px] leading-[1.75]',
  '[&>*+*]:mt-4',
  // A chapter usually opens with its own H1, which the page header already
  // states; it is set as a lead line rather than a second title.
  '[&_h1]:text-muted-foreground [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:tracking-[0.06em] [&_h1]:uppercase',
  '[&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight',
  '[&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_h4]:mt-6 [&_h4]:text-sm [&_h4]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5',
  '[&_strong]:font-semibold',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_code]:bg-card [&_code]:rounded-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px]',
  '[&_pre]:bg-card [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:p-4 [&_pre]:text-[13px]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  '[&_hr]:my-8 [&_hr]:border-t',
  '[&_table]:w-full [&_table]:text-sm',
  '[&_th]:border-b [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border-b [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top',
  '[&_.katex]:text-[1.02em]',
  '[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1'
].join(' ')

export default function ChapterPage() {
  const params = useParams<{ courseId: string; chapterId: string; relPath?: string[] }>()
  const [payload, setPayload] = useState<Payload | null>(null)
  const [course, setCourse] = useState<StudyCourse | null>(null)
  const [read, setRead] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [attempt, setAttempt] = useState('')
  const [grade, setGrade] = useState<{ correction: string; score: number | null } | null>(null)
  const [showReference, setShowReference] = useState(false)
  const [practiceBusy, setPracticeBusy] = useState(false)
  const [practiceError, setPracticeError] = useState<string | null>(null)
  const [deck, setDeck] = useState<Set<string>>(new Set())

  useEffect(() => {
    let live = true
    setPayload(null)
    setError(null)
    const json = (path: string) =>
      fetch(path, { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${path} returned ${response.status}`))))

    const suffix = params.relPath?.length ? `/${params.relPath.map(encodeURIComponent).join('/')}` : ''
    json(`/api/chapter/${encodeURIComponent(params.courseId)}/${encodeURIComponent(params.chapterId)}${suffix}`)
      .then((data: Payload) => { if (live) setPayload(data) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    json('/api/state')
      .then((data) => { if (live) setCourse((data.courses ?? []).find((entry: StudyCourse) => entry.id === params.courseId) ?? null) })
      .catch(() => {})
    json('/api/practice').then((data: { questions?: PracticeQuestion[] }) => { if (live) setQuestions((data.questions ?? []).filter((question) => question.courseId === params.courseId && question.chapterId === params.chapterId)) }).catch((cause: Error) => { if (live) setPracticeError(cause.message) })
    json('/api/sr/due').then((data: { allIds?: string[] }) => { if (live) setDeck(new Set(data.allIds ?? [])) }).catch(() => {})

    try { setRead(Boolean(window.localStorage.getItem(readKey(params.courseId, params.chapterId)))) } catch { /* private mode */ }
    window.scrollTo({ top: 0 })
    return () => { live = false }
  }, [params.courseId, params.chapterId, params.relPath])

  const outline = useMemo(() => outlineOf(payload?.content ?? ''), [payload])
  const { previous, next } = useMemo(
    () => neighbours(course?.chapters ?? [], params.chapterId),
    [course, params.chapterId]
  )

  const toggleRead = () => {
    const key = readKey(params.courseId, params.chapterId)
    try {
      if (read) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, new Date().toISOString())
    } catch { /* private mode */ }
    setRead(!read)
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
      <div className="mx-auto w-full max-w-[1180px] p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>That chapter could not be read</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <Link href={`/v2/courses/${params.courseId}`} className="text-primary text-sm font-semibold">Back to the course</Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-10 p-8 lg:grid-cols-[minmax(0,1fr)_220px]">
      <article className="mx-auto w-full max-w-[74ch] min-w-0">
        <header className="flex flex-col gap-2 border-b pb-5">
          <Link href={`/v2/courses/${params.courseId}`} className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs font-semibold">
            <ArrowLeftIcon className="size-3.5" />
            {course?.code ?? 'Course'}
          </Link>
          {payload ? (
            <>
              <h1 className="font-heading text-4xl leading-tight tracking-tight">{payload.title}</h1>
              <p className={`text-muted-foreground text-xs ${NUMERALS}`}>
                Chapter {params.chapterId} · about {readingMinutes(payload.content)} min
              </p>
            </>
          ) : (
            <><Skeleton className="h-10 w-96" /><Skeleton className="h-3 w-40" /></>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Button variant={read ? 'secondary' : 'outline'} size="sm" onClick={toggleRead}>
              {read && <CheckIcon data-icon="inline-start" />}
              {read ? 'Read' : 'Mark as read'}
            </Button>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOutlineOpen((open) => !open)}>
              <ListIcon data-icon="inline-start" />Outline
            </Button>
          </div>
        </header>

        {outlineOpen && (
          <nav className="mt-4 flex flex-col gap-1 border-b pb-4 lg:hidden" aria-label="On this page">
            {outline.map((heading) => (
              <a key={heading.id} href={`#${heading.id}`} onClick={() => setOutlineOpen(false)}
                 className={`text-muted-foreground hover:text-foreground text-sm ${heading.depth > 2 ? 'pl-4' : ''}`}>
                {heading.text}
              </a>
            ))}
          </nav>
        )}

        {!payload ? (
          <div className="mt-8 flex flex-col gap-4">
            {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-4 w-full" />)}
          </div>
        ) : (
          <>
            <div className={`mt-8 ${PROSE}`}>
              <Markdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeSlug, [rehypeKatex, { throwOnError: false, strict: false }]]}
              >
                {payload.content}
              </Markdown>
            </div>

            {payload.examples && (
              <section className="mt-12 border-t pt-8">
                <h2 className="mb-4 text-sm font-semibold">Worked examples</h2>
                <div className={PROSE}>
                  <Markdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeSlug, [rehypeKatex, { throwOnError: false, strict: false }]]}
                  >
                    {payload.examples}
                  </Markdown>
                </div>
              </section>
            )}

            <section className="mt-12 flex flex-col gap-4 border-t pt-8" aria-labelledby="chapter-practice-title">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3"><div><h2 id="chapter-practice-title" className="text-lg font-semibold">Practice questions</h2><p className="text-muted-foreground mt-1 text-sm">Published questions for this chapter. Checking an answer records study activity and adds it to your flashcard deck.</p></div>{questions && <span className={`text-muted-foreground text-sm ${NUMERALS}`}>{questions.length}</span>}</div>
              {questions === null ? <Skeleton className="h-48 w-full" /> : !questions.length ? <Empty><EmptyHeader><EmptyTitle>No published questions</EmptyTitle><EmptyDescription>This chapter does not have a published question bank yet.</EmptyDescription></EmptyHeader></Empty> : currentQuestion && <div className="flex flex-col gap-4"><div className="flex items-center justify-between"><strong className={NUMERALS}>Question {questionIndex + 1} / {questions.length}</strong><span className="text-muted-foreground text-xs">{currentQuestion.type}</span></div><div className={PROSE}><Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}>{currentQuestion.question}</Markdown></div>{usableOptions(currentQuestion).length > 0 && <ol className="list-[lower-alpha] pl-5 text-sm">{usableOptions(currentQuestion).map((option) => <li key={option}>{option}</li>)}</ol>}<Textarea value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="Write your answer…" disabled={practiceBusy} /><div className="flex flex-wrap gap-2"><Button onClick={() => void checkAnswer()} disabled={!attempt.trim() || practiceBusy}>{practiceBusy ? 'Checking…' : 'Check answer'}</Button><Button variant="outline" onClick={() => void addCard()} disabled={practiceBusy || deck.has(currentQuestion.id)}>{deck.has(currentQuestion.id) ? <CheckIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}{deck.has(currentQuestion.id) ? 'In flashcards' : 'Add to flashcards'}</Button>{currentQuestion.expected && <Button variant="ghost" onClick={() => setShowReference((shown) => !shown)}>{showReference ? 'Hide reference' : 'Reference answer'}</Button>}<Link href="/v2/tutor" className="inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-sm font-medium"><MessageCircleIcon className="size-4" />Ask the tutor</Link></div>{showReference && currentQuestion.expected && <div className="bg-paper text-paper-ink rounded-sm p-5 text-sm leading-relaxed shadow-lg"><Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}>{currentQuestion.expected}</Markdown></div>}{grade && <div className="bg-paper text-paper-ink rounded-sm p-5 shadow-lg"><strong className={NUMERALS}>{grade.score ?? '—'}/10</strong><div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{grade.correction}</div></div>}{practiceError && <p role="alert" className="text-destructive text-sm">{practiceError}</p>}<div className="flex justify-between border-t pt-3"><Button variant="ghost" disabled={questionIndex === 0} onClick={() => moveQuestion(questionIndex - 1)}>Previous</Button><Button variant="ghost" disabled={questionIndex === questions.length - 1} onClick={() => moveQuestion(questionIndex + 1)}>Next</Button></div></div>}
            </section>
          </>
        )}

        <nav className="mt-12 flex items-center justify-between gap-4 border-t pt-5" aria-label="Chapters">
          {previous ? (
            <Link href={`/v2/courses/${params.courseId}/${previous.id}`} className="hover:text-foreground text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
              <ArrowLeftIcon className="size-4 shrink-0" />
              <span className="truncate">{previous.name}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/v2/courses/${params.courseId}/${next.id}`} className="hover:text-foreground text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
              <span className="truncate">{next.name}</span>
              <ArrowRightIcon className="size-4 shrink-0" />
            </Link>
          ) : <span />}
        </nav>
      </article>

      <aside className="hidden lg:block">
        <nav className="sticky top-8 flex max-h-[80dvh] flex-col gap-1.5 overflow-y-auto" aria-label="On this page">
          <h2 className="text-muted-foreground mb-1 text-[10.5px] font-semibold tracking-[0.11em] uppercase">On this page</h2>
          {outline.map((heading) => (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              className={`text-muted-foreground hover:text-foreground text-[13px] leading-snug ${heading.depth > 2 ? 'pl-3' : ''}`}
            >
              {heading.text}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  )
}
