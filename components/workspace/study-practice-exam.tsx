'use client'
import { StudyExamAssessment } from './study-exam-assessment'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StudyProse } from './study-prose'
import {
  studyRequest,
  type StudyRevision,
  type StudyQuestion
} from '@/lib/workspace/study-versions'
type Exam = {
  id: string
  revisionId: string
  revision: string
  status: string
  createdAt: string
  questions: StudyQuestion[]
  answers: Record<string, string>
}
export function StudyPracticeExam({ revision }: { revision: StudyRevision }) {
  const [exams, setExams] = useState<Exam[]>([]),
    [exam, setExam] = useState<Exam | null>(null),
    [answer, setAnswer] = useState(''),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    studyRequest<{ exams: Exam[] }>(
      `/api/study-versions/${revision.versionId}/exams`
    )
      .then((r) => active && setExams(r.exams))
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [revision.versionId])
  useEffect(() => {
    setAnswer(exam?.answers[exam.questions[index]?.id] || '')
  }, [exam?.id, index])
  async function request(body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const result = await studyRequest<Exam>(
        `/api/study-versions/${revision.versionId}/exams`,
        body
      )
      setExam(result)
      setExams((old) => [result, ...old.filter((e) => e.id !== result.id)])
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  const question = exam?.questions[index]
  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-7">
      <div>
        <h2 className="text-lg font-semibold">Practice exam</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A balanced selection of generated questions from these chapters.
          Coverage is limited to this version; the format and weighting are not
          an official exam blueprint.
        </p>
      </div>
      {!exam ? (
        <>
          <Button
            disabled={busy}
            onClick={() => {
              setIndex(0)
              void request({ revisionId: revision.id, count: 10 })
            }}
          >
            Build a 10-question practice exam
          </Button>
          {!!exams.length && (
            <ul className="divide-y rounded-lg border">
              {exams.map((e) => (
                <li key={e.id}>
                  <Button
                    className="w-full justify-between"
                    variant="ghost"
                    onClick={() => {
                      setIndex(0)
                      setExam(e)
                    }}
                  >
                    <span>{new Date(e.createdAt).toLocaleString()}</span>
                    <span>
                      {e.status === 'complete' ? 'Review attempt' : 'Resume'} ·{' '}
                      {e.questions.length} questions
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              Question {index + 1} of {exam.questions.length} ·{' '}
              {exam.status === 'complete' ? 'Completed attempt' : 'In progress'}
              {exam.revisionId !== revision.id ? ' · Earlier revision' : ''}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setExam(null)}>
              All attempts
            </Button>
          </div>
          {question && (
            <>
              <StudyProse>{question.question}</StudyProse>
              <Field>
                <FieldLabel htmlFor="exam-answer">Your answer</FieldLabel>
                <Textarea
                  id="exam-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={7}
                  disabled={exam.status === 'complete'}
                />
              </Field>
              {exam.status === 'complete' ? (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <StudyExamAssessment key={`${exam.id}-${question.id}`} versionId={revision.versionId} examId={exam.id} questionId={question.id} answer={exam.answers[question.id] || ''} /><p className="my-3 text-sm font-medium">Worked solution</p>
                  <StudyProse>{question.answer}</StudyProse>
                </div>
              ) : (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void request({
                      id: exam.id,
                      expectedRevision: exam.revision,
                      questionId: question.id,
                      answer
                    })
                  }
                >
                  Save answer
                </Button>
              )}
              <div className="flex flex-wrap justify-between gap-3">
                <Button
                  variant="ghost"
                  disabled={busy || !index}
                  onClick={async () => {
                    if (
                      exam.status === 'complete' ||
                      (await request({
                        id: exam.id,
                        expectedRevision: exam.revision,
                        questionId: question.id,
                        answer
                      }))
                    )
                      setIndex((i) => i - 1)
                  }}
                >
                  Previous
                </Button>
                {index < exam.questions.length - 1 ? (
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        exam.status === 'complete' ||
                        (await request({
                          id: exam.id,
                          expectedRevision: exam.revision,
                          questionId: question.id,
                          answer
                        }))
                      )
                        setIndex((i) => i + 1)
                    }}
                  >
                    Next question
                  </Button>
                ) : (
                  exam.status !== 'complete' && (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void request({
                          id: exam.id,
                          expectedRevision: exam.revision,
                          questionId: question.id,
                          answer,
                          complete: true
                        })
                      }
                    >
                      Finish and review solutions
                    </Button>
                  )
                )}
              </div>
            </>
          )}
        </>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}
