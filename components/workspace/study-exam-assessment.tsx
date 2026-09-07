'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  useStudyAiPreferences,
  StudyAiPreferencesForm,
  StudyAiPreferenceSummary,
} from './study-ai-preferences'
import { StudyProse } from './study-prose'
import { studyRequest } from '@/lib/workspace/study-versions'
import type { PracticeRecord } from './study-practice-workspace'
export function StudyExamAssessment({
  versionId,
  examId,
  questionId,
  answer,
}: {
  versionId: string
  examId: string
  questionId: string
  answer: string
}) {
  const [record, setRecord] = useState<PracticeRecord | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const { preferences } = useStudyAiPreferences()
  const base = `/api/study-versions/${versionId}`
  useEffect(() => {
    let live = true
    void studyRequest<{ records: (PracticeRecord & { examId?: string })[] }>(
      `${base}/practice`,
    )
      .then((r) => {
        if (live)
          setRecord(
            r.records.find(
              (r) =>
                r.examId === examId &&
                r.question?.id === questionId &&
                r.answer === answer,
            ) || null,
          )
      })
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [base, examId, questionId, answer])
  async function assess() {
    setBusy(true)
    setError('')
    try {
      let r = await studyRequest<PracticeRecord>(`${base}/assess`, {
        examId,
        questionId,
        answer,
        ...preferences,
      })
      setRecord(r)
      setOpen(false)
      if (r.status !== 'complete') {
        r = await studyRequest<PracticeRecord>(`${base}/practice-step`, {
          id: r.id,
          retry: true,
        })
        setRecord(r)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      {record?.status === 'complete' ? (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">
            {record.result?.assessable
              ? `${record.result.earned} / ${record.result.possible} · Practice assessment`
              : 'Answer not scored'}
          </h3>
          <StudyProse>{record.result?.feedback || ''}</StudyProse>
          {record.result?.criteria?.map((c, i) => (
            <p key={i} className="text-sm">
              {c.criterion}: {c.earned}/{c.possible} · {c.feedback}
            </p>
          ))}
          <p className="text-sm">
            <strong>Next step: </strong>
            {record.result?.nextStep}
          </p>
        </div>
      ) : (
        <Button
          disabled={busy || !answer.trim() || !preferences}
          onClick={() => void assess()}
        >
          {busy
            ? 'Assessing…'
            : record
              ? 'Resume assessment'
              : 'Assess this exam answer'}
        </Button>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <StudyAiPreferenceSummary preferences={preferences} />
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Change AI preferences
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>AI preferences</SheetTitle>
            <SheetDescription>
              AI feedback uses the question and reference from the revision this
              exam was built with. This is a practice score, not an official
              grade.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 overflow-y-auto px-5">
            <StudyAiPreferencesForm onSaved={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
