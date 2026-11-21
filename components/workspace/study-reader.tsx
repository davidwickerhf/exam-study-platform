'use client'
import dynamic from 'next/dynamic'
import './study-reader.css'
import { useStudyDesk } from './study-desk'
import {useCourseTutorContext} from './course-tutor-entry'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { StudyPracticeWorkspace } from './study-practice-workspace'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, SearchIcon, BookOpenIcon, MessageCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StudyChapterEditor } from './study-chapter-editor'
import { StudyHints, StudyRemediation } from './study-learning-support'
import { StudyLessonStory } from './study-lesson-story'
import { StudyProse, StudyInline } from './study-prose'
import { StudyEvidence } from './study-evidence'
import {
  studyRequest,
  type StudyRevision,
  type StudyProgress
} from '@/lib/workspace/study-versions'

const Tutor = dynamic(() => import('@/app/app/tutor/tutor-workspace').then(m => m.TutorWorkspace), { ssr:false, loading:() => <p className="p-6 text-sm text-muted-foreground">Opening tutor…</p> })
export function StudyReader({
  revision,
  progress = [],
  personal = false,
  onSaved = () => {},
  onEdited,
  editable = false
}: {
  revision: StudyRevision
  progress?: StudyProgress[]
  personal?: boolean
  onSaved?: (progress: StudyProgress) => void
  onEdited?: () => void
  editable?: boolean
}) {
  const desk = useStudyDesk()
  const navigationId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const [chapterSearch, setChapterSearch] = useState('')
  const [tutorOpen, setTutorOpen] = useState(false), [tutorQuestion, setTutorQuestion] = useState<string | undefined>()
  const [topicId, setTopicId] = useState(revision.chapters[0]?.id || ''),
    [tab, setTab] = useState('lesson')
  const [questionIndex, setQuestionIndex] = useState(0),
    [showAnswer, setShowAnswer] = useState(false),
    [answer, setAnswer] = useState(''),
    [step, setStep] = useState(0),
    [cardIndex, setCardIndex] = useState(0),
    [cardRevealed, setCardRevealed] = useState(false)
  const [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  useEffect(() => { if (!personal) return; const params = new URLSearchParams(window.location.search); if (params.get('chapter')) setTopicId(params.get('chapter')!); if (params.has('practice')) setTab('questions') }, [personal])
  const chapter =
      revision.chapters.find((c) => c.id === topicId) || revision.chapters[0],
    record = progress.find((p) => p.topicId === chapter?.id)
  useEffect(() => {
    setTutorOpen(false)
    setTutorQuestion(undefined)
    setQuestionIndex(0)
    setShowAnswer(false)
    setAnswer('')
    setStep(0)
    setCardIndex(0)
    setCardRevealed(false)
    setNote(record?.note || '')
    setError('')
    setNotice('')
  }, [chapter?.id, revision.id])
  useCourseTutorContext({courseCode:revision.course.courseCode,courseName:revision.course.courseName,academicYear:revision.course.academicYear,courseTab:'chapter',chapterView:tab,courseTabLabel:chapter ? `${chapter.title} · ${tab}` : 'Study guide',chapterId:chapter?.id,chapterName:chapter?.title,studyVersionId:personal ? revision.versionId : undefined,studyRevisionId:personal ? revision.id : undefined,studyQuestionId:tutorQuestion})
  if (!chapter)
    return (
      <p className="text-muted-foreground py-6 text-sm">
        Chapters appear here as soon as they pass their evidence check.
      </p>
    )
  function openTutor(questionId?: string) {
    setTutorQuestion(questionId)
    if (desk) desk.openCourseTutor()
    else {setTutorQuestion(questionId);setTutorOpen(true)}
  }
  const question = chapter.questions[questionIndex],
    walkthrough = chapter.walkthrough
  async function save(body: Record<string, unknown>, success: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await studyRequest<StudyProgress>(
        `/api/study-versions/${revision.versionId}/progress`,
        { revisionId: revision.id, topicId: chapter.id, ...body }
      )
      onSaved(result)
      setNotice(success)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const historical = revision.snapshot.sources.some(
    (s) =>
      s.academicYear !== revision.course.academicYear &&
      revision.topics
        .find((t) => t.id === chapter.id)
        ?.sourceIds.some(
          (id) =>
            revision.snapshot.chunks.find((c) => c.id === id)?.sourceKey ===
            s.key
        )
  )
  const chapterIndex = revision.chapters.findIndex(c => c.id === chapter.id)
  const readCount = revision.chapters.filter(c => progress.some(p => p.topicId === c.id && p.read)).length
  const filteredTopics = revision.topics.filter(t => t.title.toLowerCase().includes(chapterSearch.trim().toLowerCase()))
  function selectChapter(id: string) {
    setTopicId(id)
    setTab('lesson')
    setChaptersOpen(false)
    if (personal) {
      const url = new URL(window.location.href)
      url.searchParams.set('chapter', id)
      url.searchParams.delete('practice')
      window.history.replaceState(null, '', url)
    }
    requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true })
      titleRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
  }
  return (
    <div className="study-reader">
    <div className="study-reader-layout">
      <aside className="study-reader-contents" aria-label="Guide contents">
        <button type="button" className="study-reader-picker" aria-expanded={chaptersOpen} aria-controls={navigationId} onClick={() => setChaptersOpen(!chaptersOpen)}>
          <BookOpenIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">Chapter {chapterIndex + 1} · {chapter.title}</span>
          <ChevronDownIcon className={`size-4 shrink-0 ${chaptersOpen ? 'rotate-180' : ''}`} />
        </button>
        <div id={navigationId} className="study-reader-navigation" data-open={chaptersOpen}>
          <div className="study-reader-contents-heading">
            <h2 className="text-sm font-semibold">Contents</h2>
            <span className="text-xs text-muted-foreground">{revision.chapters.length} ready</span>
          </div>
          {personal && <div className="mb-5">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Reading progress</span><span>{readCount} / {revision.chapters.length}</span></div>
            <progress className="study-reader-progress" value={readCount} max={revision.chapters.length} aria-label="Chapters marked read" />
          </div>}
          <label className="study-reader-search">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input aria-label="Find a chapter" placeholder="Find a chapter…" value={chapterSearch} onChange={e => setChapterSearch(e.target.value)} />
          </label>
          <nav aria-label="Study chapters" className="study-reader-chapters">
            {filteredTopics.map(topic => {
              const index = revision.topics.findIndex(t => t.id === topic.id)
              const ready = revision.chapters.some(c => c.id === topic.id)
              const read = progress.some(p => p.topicId === topic.id && p.read)
              return <button type="button" key={topic.id} disabled={!ready} onClick={() => selectChapter(topic.id)} aria-current={chapter.id === topic.id ? 'page' : undefined}>
                <span className="study-reader-chapter-number">{read ? <CheckIcon className="size-3.5" aria-label="Read" /> : String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0"><span className="block">{topic.title}</span>{!ready && <span className="mt-1 block text-xs text-muted-foreground">Preparing</span>}</span>
              </button>
            })}
            {!filteredTopics.length && <p role="status" className="px-3 py-4 text-sm text-muted-foreground">No chapters match “{chapterSearch}”.</p>}
          </nav>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">{revision.topics.length} topics mapped{personal ? ' · Checkmarks mean marked read.' : ''}</p>
        </div>
      </aside>
      <article className="study-reader-article">
        <header className="study-reader-header">
          <h2 ref={titleRef} tabIndex={-1} className="study-reader-title">{chapter.title}</h2>
          <div className="study-reader-actions flex flex-wrap items-center justify-between gap-2">
            {personal && <Button size="sm" variant="ghost" onClick={() => openTutor()}><MessageCircleIcon className="size-4" />Ask AI tutor</Button>}
            {record?.read && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><CheckIcon className="size-3" />Marked read</span>}
          <details className="study-reader-review relative">
            <summary>Chapter options</summary><div className="absolute right-0 z-20 mt-2 w-64 rounded-md border bg-card p-3 shadow-lg">
          <details className="study-reader-review">
            <summary>{chapter.review === 'student-edited' ? 'Personally edited · Review details' : chapter.review === 'passed' ? 'Evidence checked by AI · Not editorially reviewed.' : 'AI-generated · Evidence review pending'}</summary>
            <p className="mt-2 leading-5">Not editorially reviewed. Source passages are available below each explanation.{chapter.review === 'student-edited' ? ' Your changes have not been AI checked.' : ''}{historical ? ' Includes supplements from another academic year.' : ''}</p>
          </details>
          {tab === 'lesson' && editable && onEdited && <StudyChapterEditor key={`${revision.id}-${chapter.id}`} chapter={chapter} revision={revision} onChanged={onEdited} />}
            </div></details>
          </div>
        </header>
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-5">
          <TabsList
            variant="line"
            className="study-reader-tabs max-w-full justify-start overflow-x-auto"
          >
            <TabsTrigger value="lesson">Learn</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="questions">Practice ({chapter.questions.length})</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards ({chapter.flashcards.length})</TabsTrigger>
            {personal && <TabsTrigger value="notes">My notes</TabsTrigger>}
          </TabsList>
          <TabsContent value="lesson" className="flex flex-col gap-7">
            {!!chapter.learningGoals?.length && <details className="study-reader-goals"><summary>What you’ll learn</summary><ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">{chapter.learningGoals.map(goal => <li key={goal} className="flex gap-2"><span aria-hidden="true">→</span><StudyInline>{goal}</StudyInline></li>)}</ul></details>}
            {(chapter.formatVersion === 2 || chapter.formatVersion === 3) ? <StudyLessonStory key={chapter.id} chapter={chapter} revision={revision} /> : chapter.sections.map((section, index) => (
              <section key={index}>
                <h3 className="mb-3 text-base font-semibold">
                  {section.title}
                </h3>
                <StudyProse>{section.text}</StudyProse>
                <StudyEvidence ids={section.sourceIds} revision={revision} />
              </section>
            ))}
            {walkthrough && chapter.formatVersion !== 2 && chapter.formatVersion !== 3 && (
              <section className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-5">
                <div>
                  <p className="text-muted-foreground text-xs">
                    Step through the explanation
                  </p>
                  <h3 className="mt-1 font-semibold">{walkthrough.title}</h3>
                </div>
                <div aria-live="polite">
                  <p className="text-muted-foreground mb-2 text-xs">
                    Step {step + 1} of {walkthrough.steps.length}
                  </p>
                  <StudyProse>{walkthrough.steps[step].text}</StudyProse>
                  <StudyEvidence
                    ids={walkthrough.steps[step].sourceIds}
                    revision={revision}
                  />
                </div>
                <div className="flex justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!step}
                    onClick={() => setStep((s) => s - 1)}
                  >
                    <ArrowLeftIcon data-icon="inline-start" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={step === walkthrough.steps.length - 1}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Next
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
                <details>
                  <summary className="text-muted-foreground cursor-pointer text-xs">
                    Read all steps
                  </summary>
                  <ol className="mt-3 flex list-decimal flex-col gap-3 pl-5">
                    {walkthrough.steps.map((s, i) => (
                      <li key={i}>
                        <StudyProse>{s.text}</StudyProse>
                      </li>
                    ))}
                  </ol>
                </details>
              </section>
            )}
            {!!chapter.caveats.length && (
              <Alert>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {chapter.caveats.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {personal && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void save(
                    { read: !record?.read },
                    record?.read ? 'Marked unread.' : 'Reading progress saved.'
                  )
                }
              >
                {record?.read ? <CheckIcon data-icon="inline-start" /> : null}
                {record?.read ? 'Read · mark unread' : 'Mark chapter read'}
              </Button>
            )}
          </TabsContent>
          <TabsContent value="summary">
            <p className="mb-6 text-sm text-muted-foreground">Concise revision view. The ideas to take into your next problem. Try explaining each one without opening the lesson.</p>
            <ul className="grid gap-6 md:grid-cols-2">
              {chapter.summary.map((s, i) => (
                <li key={i} className="border-t pt-4">
                  <p className="mb-2 text-xs tabular-nums text-muted-foreground">{String(i+1).padStart(2, '0')}</p>
                  <StudyProse>{s.text}</StudyProse>
                  <StudyEvidence ids={s.sourceIds} revision={revision} />
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="questions" className="flex flex-col gap-4">
            {personal ? <StudyPracticeWorkspace key={`${revision.id}-${chapter.id}`} revision={revision} topicId={chapter.id} legacyAttempts={record?.attempts} onTutor={id => openTutor(id)} /> : question && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-muted-foreground text-xs">
                    Question {questionIndex + 1} of {chapter.questions.length}
                  </p>
                  <div className="flex flex-wrap gap-2"><Badge variant="outline">{question.skill || question.kind}</Badge>{question.difficulty && <Badge variant="secondary">{question.difficulty}</Badge>}</div>
                </div>
                {question.objective && <p className="text-xs text-muted-foreground">Practising: <StudyInline>{question.objective}</StudyInline></p>}
                <StudyProse>{question.question}</StudyProse>
                <StudyHints key={`hints-${question.id}`} question={question} />
                <Field>
                  <FieldLabel htmlFor="study-answer">Your answer</FieldLabel>
                  <Textarea
                    id="study-answer"
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value)
                      setNotice('')
                    }}
                    rows={5}
                  />
                  <FieldDescription>
                    Compare your reasoning with the worked solution. These are
                    generated practice questions.
                  </FieldDescription>
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAnswer(!showAnswer)}
                  >
                    {showAnswer ? 'Hide solution' : 'Show worked solution'}
                  </Button>
                  {personal && (
                    <Button
                      disabled={busy || !answer.trim()}
                      onClick={() =>
                        void save(
                          {
                            attempt: {
                              id: crypto.randomUUID(),
                              questionId: question.id,
                              answer
                            }
                          },
                          'Attempt saved with this question and revision.'
                        )
                      }
                    >
                      Save attempt
                    </Button>
                  )}
                </div>
                {showAnswer && <StudyRemediation key={`remediation-${question.id}`} question={question} questions={chapter.questions} onSelect={i=>{setQuestionIndex(i);setShowAnswer(false);setAnswer('')}}/>}
                {showAnswer && (
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <StudyProse>{question.answer}</StudyProse>
                    <StudyEvidence
                      ids={question.sourceIds}
                      revision={revision}
                    />
                  </div>
                )}
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    disabled={!questionIndex}
                    onClick={() => {
                      setQuestionIndex((i) => i - 1)
                      setShowAnswer(false)
                      setAnswer('')
                      setNotice('')
                    }}
                  >
                    Previous question
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={questionIndex === chapter.questions.length - 1}
                    onClick={() => {
                      setQuestionIndex((i) => i + 1)
                      setShowAnswer(false)
                      setAnswer('')
                      setNotice('')
                    }}
                  >
                    Next question
                  </Button>
                </div>
                {personal && Boolean(record?.attempts?.length) && (
                  <details>
                    <summary className="text-muted-foreground cursor-pointer text-sm">
                      Saved attempts ({record?.attempts?.length})
                    </summary>
                    <ul className="mt-3 flex flex-col gap-3">
                      {record?.attempts
                        ?.slice()
                        .reverse()
                        .map((a) => (
                          <li key={a.id} className="rounded-lg border p-3">
                            <p className="text-muted-foreground mb-2 text-xs">
                              {new Date(a.createdAt).toLocaleString()} · saved
                              revision
                            </p>
                            <StudyProse>{a.question.question}</StudyProse>
                            <p className="mt-3 text-sm whitespace-pre-wrap">
                              {a.answer}
                            </p>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="flashcards">
            <p className="mb-5 text-sm text-muted-foreground">Recall the answer before revealing it. Explain the reasoning aloud.</p>
            {chapter.flashcards[cardIndex] && <div className="rounded-xl border p-6 sm:p-8">
              <div className="mb-6 flex justify-between gap-3 text-xs text-muted-foreground"><span>Card {cardIndex+1} of {chapter.flashcards.length}</span><span>{chapter.flashcards[cardIndex].kind}</span></div>
              <p className="max-w-prose text-lg font-medium leading-relaxed"><StudyInline>{chapter.flashcards[cardIndex].front}</StudyInline></p>
              {cardRevealed ? <div className="mt-6 border-t pt-6"><StudyProse>{chapter.flashcards[cardIndex].back}</StudyProse><StudyEvidence ids={chapter.flashcards[cardIndex].sourceIds} revision={revision} /></div> : <Button className="mt-6" variant="outline" onClick={() => setCardRevealed(true)}>Reveal answer</Button>}
              <div className="mt-8 flex justify-between gap-3"><Button variant="ghost" disabled={!cardIndex} onClick={() => { setCardIndex(i => i-1); setCardRevealed(false) }}>Previous card</Button><Button variant="ghost" disabled={cardIndex === chapter.flashcards.length-1} onClick={() => { setCardIndex(i => i+1); setCardRevealed(false) }}>Next card</Button></div>
            </div>}
          </TabsContent>
          {personal && (
            <TabsContent value="notes" className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="study-chapter-note">
                  Your chapter notes
                </FieldLabel>
                <Textarea
                  id="study-chapter-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={12}
                  maxLength={20000}
                />
                <FieldDescription>
                  Private annotations, preserved across refreshes. To use notes
                  as generation sources, add them in the source selection.
                </FieldDescription>
              </Field>
              <Button
                disabled={busy}
                onClick={() => void save({ note }, 'Your notes are saved.')}
              >
                Save notes
              </Button>
            </TabsContent>
          )}
        </Tabs>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <p role="status" className="text-muted-foreground mt-4 text-sm">
            {notice}
          </p>
        )}
        <nav aria-label="Chapter navigation" className="study-reader-pagination">
          <Button variant="ghost" disabled={chapterIndex === 0} onClick={() => selectChapter(revision.chapters[chapterIndex - 1].id)}><ArrowLeftIcon />Previous chapter</Button>
          <Button variant="outline" disabled={chapterIndex === revision.chapters.length - 1} onClick={() => selectChapter(revision.chapters[chapterIndex + 1].id)}>Next chapter<ArrowRightIcon /></Button>
        </nav>
      </article>
    </div>
      {personal && <Sheet open={tutorOpen} onOpenChange={setTutorOpen}><SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-6xl"><SheetHeader><SheetTitle>Chapter tutor</SheetTitle><SheetDescription>{chapter.title} · Using this saved revision and its source evidence</SheetDescription></SheetHeader><div className="min-h-0 flex-1">{tutorOpen && <Tutor key={`${revision.id}-${chapter.id}-${tutorQuestion || ''}`} embedded initialContext={{ courseCode:revision.course.courseCode, courseName:revision.course.courseName, chapterId:chapter.id, chapterName:chapter.title, studyVersionId:revision.versionId, studyRevisionId:revision.id, studyQuestionId:tutorQuestion }} />}</div></SheetContent></Sheet>}
    </div>
  )
}
