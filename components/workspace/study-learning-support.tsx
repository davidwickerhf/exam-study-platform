'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StudyProse } from './study-prose'
import type { StudyQuestion } from '@/lib/workspace/study-versions'

export function StudyHints({ question }: { question: StudyQuestion }) {
  const [shown, setShown] = useState(0)
  const hints = question.hints?.length ? question.hints : question.hint ? [question.hint] : []
  if (!hints.length) return null
  return <div className="space-y-3">
    {hints.slice(0, shown).map((hint, i) => <div key={i} className="border-l-2 pl-4"><p className="mb-2 text-xs text-muted-foreground">Hint {i + 1}</p><StudyProse>{hint}</StudyProse></div>)}
    {shown < hints.length && <Button variant="outline" size="sm" onClick={() => setShown(shown + 1)}>{shown ? 'Show next hint' : 'Need a hint?'}</Button>}
  </div>
}

export function StudyGuidedAttempt({ question }: { question: StudyQuestion }) {
  const [answer, setAnswer] = useState(''), [revealed, setRevealed] = useState(false)
  return <div className="mt-6 space-y-4 border-y py-5">
    <h4 className="font-semibold">Try it with support</h4>
    <StudyProse>{question.question}</StudyProse>
    <Textarea aria-label={`Supported attempt: ${question.question}`} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Explain your reasoning before comparing the solution." />
    <StudyHints question={question} />
    <Button variant="ghost" size="sm" onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide worked solution' : 'Compare with worked solution'}</Button>
    {revealed && <StudyProse>{question.answer}</StudyProse>}
    <p className="text-xs text-muted-foreground">Untimed learning practice. This draft stays on this page; use Practice to save an assessed attempt. Reading or completing this example does not establish mastery.</p>
  </div>
}

export function StudyRemediation({ question, questions, diagnosed = [], onSelect }: { question: StudyQuestion; questions: StudyQuestion[]; diagnosed?: number[]; onSelect: (index: number) => void }) {
  const mistakes = question.misconceptions || []
  const transfer = questions.findIndex(q => q.key !== question.key && q.practiceStage === 'transfer' && q.objectiveIds?.some(id => question.objectiveIds?.includes(id)))
  if (!mistakes.length) return null
  return <div className="space-y-4 border-t pt-4">
    <h4 className="font-semibold">Check your reasoning</h4>
    {mistakes.map((mistake, i) => {
      const next = questions.findIndex(q => q.key === mistake.followUpKey)
      return <details key={i} open={diagnosed.includes(i) || undefined}>
        <summary className="cursor-pointer text-sm font-medium">{diagnosed.includes(i) ? 'Feedback identified: ' : 'If your answer involved: '}{mistake.mistake}</summary>
        <div className="mt-3 space-y-3"><StudyProse>{mistake.explanation}</StudyProse>{next >= 0 && <Button variant="outline" size="sm" onClick={() => onSelect(next)}>Try a related variation</Button>}</div>
      </details>
    })}
    {transfer >= 0 && <div className="space-y-2"><p className="text-sm text-muted-foreground">After correcting the mistake, come back later and test the idea in a new context without hints.</p><Button variant="ghost" size="sm" onClick={() => onSelect(transfer)}>Try transfer practice</Button></div>}
  </div>
}
