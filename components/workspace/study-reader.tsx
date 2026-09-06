'use client'
import { useEffect, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StudyChapterEditor } from './study-chapter-editor'
import { StudyLessonStory } from './study-lesson-story'
import { StudyProse, StudyInline } from './study-prose'
import { StudyEvidence } from './study-evidence'
import {
  studyRequest,
  type StudyRevision,
  type StudyProgress
} from '@/lib/workspace/study-versions'

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
  const chapter =
      revision.chapters.find((c) => c.id === topicId) || revision.chapters[0],
    record = progress.find((p) => p.topicId === chapter?.id)
  useEffect(() => {
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
  if (!chapter)
    return (
      <p className="text-muted-foreground py-6 text-sm">
        Chapters appear here as soon as they pass their evidence check.
      </p>
    )
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
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <details className="rounded-xl border bg-card">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium">Chapters · {chapter.title} <span className="ml-2 text-muted-foreground">{revision.chapters.length} ready</span></summary>
      <nav
        aria-label="Study chapters"
        className="grid border-t sm:grid-cols-2"
      >
        <p className="text-muted-foreground border-b px-4 py-3 text-xs font-medium">
          {revision.chapters.length} chapters ready · {revision.topics.length}{' '}
          mapped
        </p>
        {revision.topics.map((topic, index) => {
          const ready = revision.chapters.some((c) => c.id === topic.id)
          return (
            <button
              key={topic.id}
              disabled={!ready}
              onClick={() => setTopicId(topic.id)}
              aria-current={chapter.id === topic.id ? 'page' : undefined}
              className="hover:bg-muted/50 aria-[current=page]:bg-muted flex items-start gap-3 border-b px-4 py-3 text-left text-sm last:border-0 disabled:opacity-50"
            >
              <span className="text-muted-foreground font-data text-xs tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                {topic.title}
                {!ready && (
                  <span className="text-muted-foreground block text-xs">
                    Preparing
                  </span>
                )}
              </span>
              {progress.find((p) => p.topicId === topic.id)?.read && (
                <CheckIcon className="size-3.5 shrink-0" />
              )}
            </button>
          )
        })}
      </nav>
      </details>
      <article className="min-w-0 rounded-xl border bg-card p-5 sm:p-7">
        <header className="mb-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{chapter.review === 'student-edited' ? 'Personally edited' : 'AI-generated'}</Badge>
            <Badge variant="secondary">{chapter.review === 'passed' ? 'Evidence checked by AI' : chapter.review === 'student-edited' ? 'Changes not AI checked' : 'Evidence review pending'}</Badge>
            {historical && (
              <Badge variant="outline">Includes supplements</Badge>
            )}
          </div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {chapter.title}
          </h2>
          <p className="text-muted-foreground text-xs">
            Not editorially reviewed. Source passages are available below each
            explanation.
          </p>
          {editable && onEdited && <StudyChapterEditor key={`${revision.id}-${chapter.id}`} chapter={chapter} revision={revision} onChanged={onEdited} />}
          {!!chapter.learningGoals?.length && <div className="mt-2 border-t pt-5"><p className="mb-3 text-sm font-medium">By the end, you can</p><ul className="grid gap-x-8 gap-y-2 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">{chapter.learningGoals.map(goal => <li key={goal} className="flex gap-2"><span aria-hidden="true">→</span><StudyInline>{goal}</StudyInline></li>)}</ul></div>}
        </header>
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-5">
          <TabsList
            variant="line"
            className="max-w-full justify-start overflow-x-auto"
          >
            <TabsTrigger value="lesson">Learn</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="questions">Practice ({chapter.questions.length})</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards ({chapter.flashcards.length})</TabsTrigger>
            {personal && <TabsTrigger value="notes">My notes</TabsTrigger>}
          </TabsList>
          <TabsContent value="lesson" className="flex flex-col gap-7">
            {chapter.formatVersion === 2 ? <StudyLessonStory key={chapter.id} chapter={chapter} revision={revision} /> : chapter.sections.map((section, index) => (
              <section key={index}>
                <h3 className="mb-3 text-base font-semibold">
                  {section.title}
                </h3>
                <StudyProse>{section.text}</StudyProse>
                <StudyEvidence ids={section.sourceIds} revision={revision} />
              </section>
            ))}
            {walkthrough && chapter.formatVersion !== 2 && (
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
            <p className="mb-6 text-sm text-muted-foreground">The ideas to take into your next problem. Try explaining each one without opening the lesson.</p>
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
            {question && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-muted-foreground text-xs">
                    Question {questionIndex + 1} of {chapter.questions.length}
                  </p>
                  <div className="flex flex-wrap gap-2"><Badge variant="outline">{question.skill || question.kind}</Badge>{question.difficulty && <Badge variant="secondary">{question.difficulty}</Badge>}</div>
                </div>
                {question.objective && <p className="text-xs text-muted-foreground">Practising: <StudyInline>{question.objective}</StudyInline></p>}
                <StudyProse>{question.question}</StudyProse>
                {question.hint && <details key={question.id} className="rounded-lg border px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Need a hint?</summary><div className="mt-3"><StudyProse>{question.hint}</StudyProse></div></details>}
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
      </article>
    </div>
  )
}
