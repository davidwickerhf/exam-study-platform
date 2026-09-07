'use client'
import { useEffect, useRef, useState } from 'react'
import { useStudyDesk } from './study-desk'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  useStudyAiPreferences,
  StudyAiPreferencesForm,
  StudyAiPreferenceSummary,
} from './study-ai-preferences'
import { StudyBillingFields } from './study-billing-fields'
import { StudySourceInspector } from './study-source-inspector'
import { StudyProse } from './study-prose'
import { StudyEvidence } from './study-evidence'
import {
  studyRequest,
  type StudyRevision,
  type StudyQuestion,
  type StudyProgress,
  type StudySource,
  type Evidence,
} from '@/lib/workspace/study-versions'
type Question = StudyQuestion & {
  label?: string
  type?: string
  sharedContext?: string
  options?: string[]
  marks?: number | null
  page?: number | null
  answerBasis?: string
  needsOriginal?: boolean
}
type Grade = {
  assessable: boolean
  earned: number | null
  possible: number | null
  feedback: string
  nextStep: string
  criteria: {
    criterion: string
    earned: number
    possible: number
    feedback: string
  }[]
}
export type PracticeRecord = {
  id: string
  kind: 'set' | 'assessment'
  topicId: string
  revisionId: string
  createdAt: string
  status: string
  stage: string
  error?: string
  issues?: string[]
  mode?: string
  questionSourceKey?: string
  model?: string
  question?: Question
  answer?: string
  setId?: string
  examId?: string
  result?: { title: string; questions: Question[]; warnings: string[] } & Grade
  sources: StudySource[]
  evidence?: Evidence[]
}
export function StudyPracticeWorkspace({
  revision,
  topicId,
  fixedSetId,
  onTutor,
  legacyAttempts = [],
}: {
  revision: StudyRevision
  topicId?: string
  fixedSetId?: string
  legacyAttempts?: StudyProgress['attempts']
  onTutor?: (questionId?: string) => void
}) {
  const desk = useStudyDesk()
  const {
    preferences,
    error: preferenceError,
    save: savePreferences,
  } = useStudyAiPreferences()
  useEffect(() => {
    if (preferences) {
      setBillingSource(preferences.billingSource)
      setQuality(preferences.quality)
      setCap(String(preferences.maxJobUsd))
    }
  }, [preferences])
  const [records, setRecords] = useState<PracticeRecord[]>([]),
    [selected, setSelected] = useState(fixedSetId || 'chapter'),
    [index, setIndex] = useState(0),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [revealed, setRevealed] = useState(false)
  const [form, setForm] = useState(false),
    [billingOpen, setBillingOpen] = useState(false),
    [mode, setMode] = useState('extract'),
    [chapterId, setChapterId] = useState(
      topicId || revision.chapters[0]?.id || '',
    )
  const [sources, setSources] = useState<StudySource[]>([]),
    [questionSource, setQuestionSource] = useState(''),
    [solutionSource, setSolutionSource] = useState(''),
    [rubricSource, setRubricSource] = useState(''),
    [historical, setHistorical] = useState(false)
  const [fromPage, setFromPage] = useState(''),
    [toPage, setToPage] = useState(''),
    [count, setCount] = useState('10'),
    [difficulty, setDifficulty] = useState('standard'),
    [focus, setFocus] = useState('')
  const [billingSource, setBillingSource] = useState('platform'),
    [cap, setCap] = useState('1'),
    [quality, setQuality] = useState('standard'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('practice')
    if (id && !fixedSetId) setSelected(id)
  }, [fixedSetId])
  const alive = useRef(true)
  const base = `/api/study-versions/${revision.versionId}`
  useEffect(() => {
    alive.current = true
    void studyRequest<{ records: PracticeRecord[] }>(
      `${base}/practice${fixedSetId ? `?setId=${encodeURIComponent(fixedSetId)}` : ''}`,
    )
      .then((r) => {
        if (alive.current) {
          setRecords(r.records)
          if (fixedSetId) {
            const set = r.records.find((s) => s.id === fixedSetId)
            if (set) setChapterId(set.topicId)
          }
          setLoaded(true)
        }
      })
      .catch((e) => alive.current && setError(e.message))
    return () => {
      alive.current = false
    }
  }, [base, fixedSetId])
  useEffect(() => {
    if (!form) return
    const query = new URLSearchParams(revision.course)
    void studyRequest<{ sources: StudySource[] }>(
      `/api/study-versions/sources?${query}`,
    )
      .then((r) => setSources(r.sources))
      .catch((e) => setError(e.message))
  }, [form, revision.course])
  useEffect(() => {
    setAnswers((old) => {
      const next = { ...old }
      for (const r of records
        .filter(
          (r) =>
            r.kind === 'assessment' &&
            !r.examId &&
            r.topicId === chapterId &&
            r.revisionId ===
              (records.find((s) => s.id === selected)?.revisionId ||
                revision.id),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        const key = `${r.topicId}:${r.setId || 'chapter'}:${r.question?.id}`
        if (!(key in next)) next[key] = r.answer || ''
      }
      return next
    })
  }, [records, chapterId, selected, revision.id])
  const upsert = (r: PracticeRecord) =>
    setRecords((old) => [r, ...old.filter((v) => v.id !== r.id)])
  const chapter =
    revision.chapters.find((c) => c.id === chapterId) || revision.chapters[0]
  const set = records.find((r) => r.id === selected)
  const questions: Question[] =
    set?.result?.questions || chapter?.questions || []
  const question = questions[index]
  const questionEvidence = (set?.evidence || revision.snapshot.chunks).filter(
    (c) => question?.sourceIds.includes(c.id),
  )
  const originalSource = (set?.sources || revision.snapshot.sources).find(
    (s) =>
      (s.url || s.assetId) &&
      (set?.mode === 'extract'
        ? s.key === set.questionSourceKey
        : questionEvidence.some((c) => c.sourceKey === s.key)),
  )
  useEffect(() => {
    if (desk?.companion?.kind === 'document' && originalSource && desk.companion.source.key === originalSource.key) {
      desk.openDocument(originalSource, questionEvidence, question?.page || questionEvidence[0]?.page || 1)
    }
  }, [question?.id, originalSource?.key])
  const answerKey = `${chapterId}:${selected}:${question?.id}`
  const answer = answers[answerKey] || ''
  const attempts = records.filter(
    (r) =>
      r.kind === 'assessment' &&
      !r.examId &&
      r.topicId === chapterId &&
      r.question?.id === question?.id &&
      (r.setId || 'chapter') === selected,
  )
  const latest = attempts
    .filter(
      (r) =>
        r.revisionId === (set?.revisionId || revision.id) &&
        r.answer === answer.trim(),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const freeAssessment = Boolean(
    question?.needsOriginal ||
    question?.answerBasis === 'unavailable' ||
    ['mc', 'multi', 'tf'].includes(question?.type || ''),
  )
  const billing = { billingSource, quality, maxJobUsd: Number(cap) }
  async function work(action: string, body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      if (action === 'practice') await savePreferences(billing)
      let r = await studyRequest<PracticeRecord>(`${base}/${action}`, body)
      upsert(r)
      if (r.kind === 'set') {
        setSelected(r.id)
        setIndex(0)
        setForm(false)
      } else setBillingOpen(false)
      // Each response is a persisted checkpoint. Navigation can interrupt the UI;
      // pending records are offered for resumption instead of creating new jobs.
      for (
        let step = 0;
        r.status === 'pending' && step < 5 && alive.current;
        step++
      ) {
        r = await studyRequest<PracticeRecord>(`${base}/practice-step`, {
          id: r.id,
        })
        if (alive.current) upsert(r)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  function choose(id: string) {
    setSelected(id)
    setIndex(0)
    setRevealed(false)
    const r = records.find((r) => r.id === id)
    if (r) setChapterId(r.topicId)
  }
  const readySets = records.filter(
    (r) => r.kind === 'set' && (!topicId || r.topicId === topicId),
  )
  return (
    <section className="space-y-5" aria-label="Chapter practice workspace">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">
            {fixedSetId
              ? set?.result?.title || 'Paper questions'
              : 'Chapter exercises'}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {fixedSetId
              ? 'Original questions and marks. Your answers stay saved with this paper.'
              : 'Targeted practice generated from this chapter. These are not past-exam questions.'}
          </p>
        </div>
        {!fixedSetId && (
          <Button variant="outline" onClick={() => setForm(true)}>
            Add practice set
          </Button>
        )}
      </div>
      {!topicId && !fixedSetId && (
        <label className="block text-sm">
          Chapter context
          <select
            aria-label="Practice chapter"
            className="ml-3 rounded-md border bg-background px-3 py-2"
            value={chapterId}
            onChange={(e) => {
              setChapterId(e.target.value)
              choose('chapter')
            }}
          >
            {revision.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {!fixedSetId && (
        <label className="block text-sm font-medium">
          Exercise set
          <select
            aria-label="Exercise set"
            className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal"
            value={selected}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="chapter">
              Generated chapter questions · {chapter?.questions.length}
            </option>
            {readySets.map((r) => (
              <option key={r.id} value={r.id}>
                {r.mode === 'extract' ? 'Course paper' : 'Generated set'} ·{' '}
                {r.result?.title || 'Preparing practice'} · {r.status}
                {r.revisionId !== revision.id ? ' · Earlier revision' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected !== 'chapter' && set?.status !== 'complete' ? (
        <div className="space-y-3 rounded-lg border p-5" role="status">
          <p className="font-medium">
            {set?.status === 'failed'
              ? 'Practice needs attention'
              : set?.stage === 'review'
                ? 'Checking extracted questions and answers'
                : 'Preparing your practice set'}
          </p>
          <p className="text-sm text-muted-foreground">
            {set?.error ||
              'Finished steps are saved. Keep this panel open while a step runs, or resume here later.'}
          </p>
          {set?.issues?.map((issue, i) => (
            <p key={i} className="text-sm">
              {issue}
            </p>
          ))}
          <Button
            disabled={busy}
            onClick={() =>
              void work('practice-step', { id: selected, retry: true })
            }
          >
            {busy
              ? 'Working…'
              : set?.status === 'failed'
                ? 'Retry this set'
                : 'Resume preparation'}
          </Button>
        </div>
      ) : (
        question && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {set?.mode === 'extract'
                  ? 'Extracted course paper'
                  : 'AI-generated practice'}
              </Badge>
              {set?.revisionId && set.revisionId !== revision.id && (
                <Badge variant="secondary">Earlier revision</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {questions.length} questions
                {set?.model ? ` · ${set.model}` : ''}
              </span>
            </div>
            {set?.result?.warnings?.map((w, i) => (
              <p className="text-sm text-muted-foreground" key={i}>
                {w}
              </p>
            ))}
            {!!set?.sources.length && !fixedSetId && (
              <div className="flex flex-wrap gap-3">
                {set.sources.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 text-xs">
                    <span className="max-w-60 truncate">{s.title}</span>
                    <StudySourceInspector
                      source={s}
                      chunks={(set.evidence || []).filter(
                        (c) => c.sourceKey === s.key,
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
            <nav
              aria-label="Practice questions"
              className="flex flex-wrap gap-2"
            >
              {questions.length > 10 ? (
                <label className="flex items-center gap-3 text-sm">
                  Question
                  <select
                    aria-label="Jump to question"
                    className="h-10 max-w-full rounded-md border bg-background px-3"
                    value={index}
                    onChange={(e) => {
                      setIndex(Number(e.target.value))
                      setRevealed(false)
                    }}
                  >
                    {questions.map((q, i) => (
                      <option key={q.id} value={i}>
                        {q.label || i + 1} of {questions.length}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                questions.map((q, i) => (
                  <Button
                    key={q.id}
                    size="sm"
                    variant={index === i ? 'secondary' : 'outline'}
                    aria-current={index === i ? 'step' : undefined}
                    onClick={() => {
                      setIndex(i)
                      setRevealed(false)
                    }}
                  >
                    {q.label || i + 1}
                    {records.some(
                      (r) =>
                        r.kind === 'assessment' &&
                        r.topicId === chapterId &&
                        r.revisionId === (set?.revisionId || revision.id) &&
                        r.question?.id === q.id &&
                        (r.setId || 'chapter') === selected,
                    )
                      ? ' ✓'
                      : ''}
                  </Button>
                ))
              )}
            </nav>
            <div data-study-task={question.id} className="scroll-mt-16 space-y-5 border-y py-6">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Question {question.label || index + 1}
                  {question.difficulty && (
                    <Badge variant="secondary" className="ml-2">
                      {question.difficulty}
                    </Badge>
                  )}
                </span>
                <span>
                  {question.marks != null
                    ? `${question.marks} marks`
                    : 'Practice scale: 10 points'}
                  {question.page ? ` · Page ${question.page}` : ''}
                </span>
              </div>
              {question.sharedContext && (
                <div className="border-l-2 pl-4 text-muted-foreground">
                  <StudyProse>{question.sharedContext}</StudyProse>
                </div>
              )}
              {originalSource && (
                <div className="flex items-center gap-1">
                  <StudySourceInspector
                    source={originalSource}
                    chunks={questionEvidence}
                    label={
                      set?.mode === 'extract'
                        ? 'View question paper'
                        : 'View teaching source'
                    }
                    initialPage={
                      question.page || questionEvidence[0]?.page || 1
                    }
                  />
                </div>
              )}
              <StudyProse>{question.question}</StudyProse>
              {question.needsOriginal && (
                <p className="rounded-lg border p-3 text-sm">
                  This question needs the original diagram or notation. Open the
                  source above; automatic scoring is unavailable.
                </p>
              )}
              {!!question.options?.length ? (
                <fieldset className="space-y-2">
                  <legend className="mb-3 text-sm font-medium">
                    Your answer
                    {question.type === 'multi'
                      ? ' · Select all that apply'
                      : ''}
                  </legend>
                  {question.options.map((option, i) => {
                    const chosen = answer.split(',').filter(Boolean).map(Number)
                    return (
                      <label
                        key={i}
                        className="flex items-start gap-3 rounded-md border p-3 text-sm"
                      >
                        <input
                          className="mt-1"
                          type={
                            question.type === 'multi' ? 'checkbox' : 'radio'
                          }
                          name={`practice-${question.id}`}
                          checked={chosen.includes(i)}
                          onChange={() =>
                            setAnswers((old) => ({
                              ...old,
                              [answerKey]:
                                question.type === 'multi'
                                  ? (chosen.includes(i)
                                      ? chosen.filter((n) => n !== i)
                                      : [...chosen, i]
                                    )
                                      .sort((a, b) => a - b)
                                      .join(',')
                                  : String(i),
                            }))
                          }
                        />
                        <StudyProse>{option}</StudyProse>
                      </label>
                    )
                  })}
                </fieldset>
              ) : (
                <label className="block text-sm font-medium">
                  Your answer
                  <Textarea
                    aria-label="Your practice answer"
                    className="mt-2"
                    rows={6}
                    maxLength={12000}
                    value={answer}
                    onChange={(e) =>
                      setAnswers((old) => ({
                        ...old,
                        [answerKey]: e.target.value,
                      }))
                    }
                  />
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={busy || !answer.trim()}
                  onClick={() =>
                    void work('assess', {
                      revisionId: set?.revisionId || revision.id,
                      topicId: chapterId,
                      setId: selected === 'chapter' ? undefined : selected,
                      questionId: question.id,
                      answer,
                      saveOnly: true,
                    })
                  }
                >
                  Save answer
                </Button>
                <Button
                  disabled={
                    busy || !answer.trim() || (!freeAssessment && !preferences)
                  }
                  onClick={() =>
                    void work('assess', {
                      revisionId: set?.revisionId || revision.id,
                      topicId: chapterId,
                      setId: selected === 'chapter' ? undefined : selected,
                      questionId: question.id,
                      answer,
                      ...preferences,
                    })
                  }
                >
                  Check answer & save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRevealed(!revealed)}
                >
                  {revealed ? 'Hide solution' : 'Show worked solution'}
                </Button>
                {onTutor && selected === 'chapter' && (
                  <Button variant="ghost" onClick={() => onTutor(question.id)}>
                    Ask tutor about this
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {freeAssessment ? (
                  <span className="text-xs text-muted-foreground">
                    Saved answer key · No AI charge
                  </span>
                ) : (
                  <StudyAiPreferenceSummary preferences={preferences} />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBillingOpen(true)}
                >
                  Change AI preferences
                </Button>
              </div>
              {preferenceError && <p role="alert">{preferenceError}</p>}
              {question.hint && (
                <details key={answerKey}>
                  <summary className="cursor-pointer text-sm font-medium">
                    Need a hint?
                  </summary>
                  <div className="mt-3">
                    <StudyProse>{question.hint}</StudyProse>
                  </div>
                </details>
              )}
              {revealed && (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {question.answerBasis === 'source'
                      ? 'Supplied solution'
                      : question.answerBasis === 'unavailable'
                        ? 'No solution key supplied'
                        : 'Generated worked solution'}
                  </p>
                  <StudyProse>
                    {question.answer ||
                      'Compare with an instructor’s solution when one becomes available. No answer key has been invented.'}
                  </StudyProse>
                  {!set && (
                    <StudyEvidence
                      ids={question.sourceIds}
                      revision={revision}
                    />
                  )}
                </div>
              )}
              {latest && (
                <div className="space-y-3 rounded-lg border p-5" role="status">
                  <h4 className="font-semibold">
                    {latest.status === 'draft'
                      ? 'Answer saved'
                      : latest.status === 'complete'
                        ? latest.result?.assessable
                          ? `${latest.result.earned} / ${latest.result.possible} · Practice assessment`
                          : 'Answer saved · Not scored'
                        : latest.status === 'failed'
                          ? 'Assessment could not finish'
                          : 'Assessment pending'}
                  </h4>
                  {latest.status === 'draft' ? (
                    <p className="text-sm text-muted-foreground">
                      Saved without AI assessment. Check your answer when you’re
                      ready.
                    </p>
                  ) : latest.status !== 'complete' ? (
                    <>
                      <p className="text-sm">
                        {latest.error ||
                          'Your answer is saved. Resume to finish the assessment.'}
                      </p>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void work('practice-step', {
                            id: latest.id,
                            retry: true,
                          })
                        }
                      >
                        Resume assessment
                      </Button>
                    </>
                  ) : (
                    <>
                      <StudyProse>{latest.result?.feedback || ''}</StudyProse>
                      {latest.result?.criteria?.map((c, i) => (
                        <div key={i} className="border-t pt-3 text-sm">
                          <p className="font-medium">
                            {c.criterion} · {c.earned}/{c.possible}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {c.feedback}
                          </p>
                        </div>
                      ))}
                      <p className="text-sm">
                        <strong>Next step: </strong>
                        {latest.result?.nextStep}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {latest.question?.answerBasis === 'source'
                          ? 'Against the supplied solution'
                          : 'Against a generated reference answer'}{' '}
                        · Formative feedback, not an official course grade.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-between gap-3">
              <Button
                variant="ghost"
                disabled={!index}
                onClick={() => {
                  setIndex((i) => i - 1)
                  setRevealed(false)
                }}
              >
                Previous question
              </Button>
              <Button
                variant="ghost"
                disabled={index === questions.length - 1}
                onClick={() => {
                  setIndex((i) => i + 1)
                  setRevealed(false)
                }}
              >
                Next question
              </Button>
            </div>
            {!!attempts.length && (
              <details>
                <summary className="cursor-pointer text-sm font-medium">
                  Attempt history ({attempts.length})
                </summary>
                <ul className="mt-3 divide-y">
                  {attempts.map((a) => (
                    <li key={a.id} className="space-y-2 py-4">
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()}
                        {a.revisionId !== revision.id
                          ? ' · Earlier revision'
                          : ''}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{a.answer}</p>
                      <StudyProse>
                        {a.result?.feedback || a.error || 'Pending assessment'}
                      </StudyProse>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )
      )}
      {!!legacyAttempts.length && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Earlier saved chapter attempts ({legacyAttempts.length})
          </summary>
          <ul className="mt-3 divide-y">
            {legacyAttempts
              .slice()
              .reverse()
              .map((a) => (
                <li key={a.id} className="space-y-3 py-4">
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString()} · Saved without
                    grading
                  </p>
                  <StudyProse>{a.question.question}</StudyProse>
                  <p className="whitespace-pre-wrap text-sm">{a.answer}</p>
                </li>
              ))}
          </ul>
        </details>
      )}
      {!loaded && !error && (
        <p className="text-sm text-muted-foreground">Loading saved practice…</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Sheet
        open={form || billingOpen}
        onOpenChange={(open) => {
          if (!open) {
            setForm(false)
            setBillingOpen(false)
          }
        }}
      >
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {form ? 'Add a practice set' : 'AI preferences'}
            </SheetTitle>
            <SheetDescription>
              {form
                ? 'Use your course’s existing questions or generate focused extra practice.'
                : 'Choose your defaults once. You can change them here or in Settings.'}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-6">
            {form && (
              <>
                <fieldset className="space-y-3">
                  <legend className="mb-3 text-sm font-medium">
                    Question source
                  </legend>
                  {[
                    ['extract', 'Course paper or exercise sheet'],
                    ['generate', 'Generate additional exercises'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex gap-3 rounded-lg border p-3 text-sm"
                    >
                      <input
                        type="radio"
                        name="practice-mode"
                        value={value}
                        checked={mode === value}
                        onChange={() => setMode(value)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {mode === 'extract' ? (
                  <>
                    {[
                      [questionSource, setQuestionSource, 'Question paper'],
                      [
                        solutionSource,
                        setSolutionSource,
                        'Solution sheet (optional)',
                      ],
                      [
                        rubricSource,
                        setRubricSource,
                        'Grading rubric (optional)',
                      ],
                    ].map(([value, setValue, label]) => (
                      <label
                        className="block text-sm font-medium"
                        key={label as string}
                      >
                        {label as string}
                        <select
                          className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal"
                          value={value as string}
                          onChange={(e) =>
                            (setValue as (v: string) => void)(e.target.value)
                          }
                        >
                          <option value="">Choose a source</option>
                          {sources.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.title} · {s.academicYear}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm">
                        First question page
                        <input
                          aria-label="First question page"
                          type="number"
                          min="1"
                          placeholder="All pages"
                          className="mt-2 w-full rounded-md border px-3 py-2"
                          value={fromPage}
                          onChange={(e) => setFromPage(e.target.value)}
                        />
                      </label>
                      <label className="text-sm">
                        Last question page
                        <input
                          aria-label="Last question page"
                          type="number"
                          min="1"
                          placeholder="All pages"
                          className="mt-2 w-full rounded-md border px-3 py-2"
                          value={toPage}
                          onChange={(e) => setToPage(e.target.value)}
                        />
                      </label>
                    </div>
                    <label className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={historical}
                        onChange={(e) => setHistorical(e.target.checked)}
                      />
                      Include papers from earlier or unspecified editions
                    </label>
                    <p className="text-xs leading-6 text-muted-foreground">
                      Labels, subquestions, marks and options come from the
                      paper. Missing solutions and unreadable diagrams remain
                      flagged. Review the extraction against the original.
                    </p>
                  </>
                ) : (
                  <>
                    <label className="block text-sm">
                      Number of exercises
                      <input
                        type="number"
                        min="4"
                        max="20"
                        className="ml-3 rounded-md border px-3 py-2"
                        value={count}
                        onChange={(e) => setCount(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm">
                      Difficulty
                      <select
                        className="ml-3 rounded-md border bg-background px-3 py-2"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                      >
                        {['foundation', 'standard', 'challenge'].map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Topics or skills to practise
                      <Textarea
                        className="mt-2"
                        value={focus}
                        maxLength={600}
                        onChange={(e) => setFocus(e.target.value)}
                        placeholder="For example: classify unfamiliar environments and justify each choice"
                      />
                    </label>
                  </>
                )}
              </>
            )}
            {!form && (
              <StudyAiPreferencesForm onSaved={() => setBillingOpen(false)} />
            )}
            {form && (
              <StudyBillingFields
                source={billingSource}
                setSource={setBillingSource}
                cap={cap}
                setCap={setCap}
                quality={quality}
                setQuality={setQuality}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {form
                ? 'Extraction/generation and an independent check use AI. Identical completed sets are reused at no extra cost.'
                : freeAssessment
                  ? 'This uses the saved answer key without an AI call. Questions without a usable key are saved without a score.'
                  : 'Written-answer assessment uses AI. Identical saved answers reuse their previous result.'}
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          {form && (
            <div className="border-t p-5">
              <Button
                className="w-full"
                disabled={
                  busy ||
                  !preferences ||
                  (mode === 'extract' && !questionSource)
                }
                onClick={() =>
                  void work('practice', {
                    revisionId: revision.id,
                    topicId: chapterId,
                    mode,
                    questionSourceKey: questionSource,
                    solutionSourceKey: solutionSource,
                    rubricSourceKey: rubricSource,
                    includeHistorical: historical,
                    fromPage,
                    toPage,
                    count: Number(count),
                    difficulty,
                    focus,
                    ...billing,
                  })
                }
              >
                {busy
                  ? 'Working…'
                  : mode === 'extract'
                    ? 'Extract and check questions'
                    : 'Generate and check exercises'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
