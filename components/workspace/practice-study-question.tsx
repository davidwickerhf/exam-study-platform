'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  studyRequest,
  type StudyRevision,
} from '@/lib/workspace/study-versions'
import type { PracticeQuestion } from '@/lib/workspace/practice.mjs'
import type { PracticeRecord } from './study-practice-workspace'
import type { StudyAiPreferences } from './study-ai-preferences'
import { useStudyDesk } from './study-desk'
import { StudyEvidence } from './study-evidence'
import { StudySourceInspector } from './study-source-inspector'
import type { StudySource, Evidence } from '@/lib/workspace/study-versions'

export async function gradeStudyQuestion(
  question: PracticeQuestion,
  attempt: string,
) {
  const context = question.study!
  const preferences = await studyRequest<StudyAiPreferences>(
    '/api/account/ai/preferences',
  )
  const options =
    question.type === 'tf' ? ['True', 'False'] : question.options || []
  const answer = ['mc', 'multi', 'tf'].includes(question.type || '')
    ? attempt
        .split('\n')
        .map((s) =>
          options.findIndex((o) => o.toLowerCase() === s.toLowerCase()),
        )
        .join(',')
    : attempt
  const base = `/api/study-versions/${context.versionId}`
  let r = await studyRequest<PracticeRecord>(`${base}/assess`, {
    ...context,
    answer,
    ...preferences,
  })
  for (
    let i = 0;
    i < 5 && (r.status === 'pending' || (i === 0 && r.status === 'failed'));
    i++
  )
    r = await studyRequest<PracticeRecord>(`${base}/practice-step`, {
      id: r.id,
      retry: r.status === 'failed',
    })
  if (r.status !== 'complete' || !r.result)
    throw new Error(
      r.error || 'Your answer is saved. Check it again to finish assessment.',
    )
  return {
    correction: [
      r.result.feedback,
      ...r.result.criteria.map(
        (c) =>
          `- **${c.criterion} (${c.earned}/${c.possible}):** ${c.feedback}`,
      ),
      r.result.nextStep,
    ].join('\n\n'),
    score:
      r.result.assessable && r.result.possible
        ? ((r.result.earned || 0) / r.result.possible) * 10
        : null,
    savedAsMistake: null,
  }
}

export function StudyQuestionSource({
  question,
}: {
  question: PracticeQuestion
}) {
  const desk = useStudyDesk()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [revision, setRevision] = useState<StudyRevision | null>(null)
  const [reference, setReference] = useState<{
    source: StudySource
    chunks: Evidence[]
    page: number
  } | null>(null)
  async function open() {
    setBusy(true)
    setError('')
    try {
      const s = question.study!
      if (s.setId) {
        const records = await studyRequest<{ records: PracticeRecord[] }>(
          `/api/study-versions/${s.versionId}/practice?setId=${s.setId}`,
        )
        const set = records.records.find((r) => r.id === s.setId)
        const q = set?.result?.questions.find((q) => q.id === s.questionId)
        const chunks = (set?.evidence || []).filter((c) =>
          q?.sourceIds.includes(c.id),
        )
        const source = set?.sources.find((s) => s.key === chunks[0]?.sourceKey)
        if (!source)
          throw new Error('The source for this question is unavailable.')
        if (desk)
          desk.openDocument(source, chunks, q?.page || chunks[0]?.page || 1)
        else
          setReference({
            source,
            chunks,
            page: q?.page || chunks[0]?.page || 1,
          })
        return
      }
      const r = await studyRequest<{ revision: StudyRevision }>(
        `/api/study-versions/${s.versionId}?revision=${s.revisionId}`,
      )
      const q = r.revision.chapters
        .find((c) => c.id === s.topicId)
        ?.questions.find((q) => q.id === s.questionId)
      const chunks = r.revision.snapshot.chunks.filter((c) =>
        q?.sourceIds.includes(c.id),
      )
      const source = r.revision.snapshot.sources.find(
        (s) => s.key === chunks[0]?.sourceKey,
      )
      if (desk && source)
        desk.openDocument(source, chunks, chunks[0]?.page || 1)
      else setRevision(r.revision)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="text-sm">
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? 'Opening source…' : 'View teaching source'}
      </Button>
      {error && <p role="alert">{error}</p>}
      {reference && (
        <StudySourceInspector
          source={reference.source}
          chunks={reference.chunks}
          initialPage={reference.page}
          label="Open source"
        />
      )}
      {revision && (
        <StudyEvidence
          ids={
            revision.chapters
              .find((c) => c.id === question.study?.topicId)
              ?.questions.find((q) => q.id === question.study?.questionId)
              ?.sourceIds || []
          }
          revision={revision}
        />
      )}
    </div>
  )
}
