'use client'
import { useState } from 'react'
import { PencilIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { StudyProse } from './study-prose'
import { StudyBillingFields } from './study-billing-fields'
import { chapterEditFields } from '@/lib/study-chapter-edits.mjs'
import { studyRequest, type StudyChapter, type StudyRevision } from '@/lib/workspace/study-versions'

type TextBlock = { key: string; label: string; text: string }
export function StudyChapterEditor({ chapter, revision, onChanged }: { chapter: StudyChapter; revision: StudyRevision; onChanged: () => void }) {
  const fields: TextBlock[] = chapterEditFields(chapter)
  const [open, setOpen] = useState(false), [mode, setMode] = useState<'edit' | 'ai'>('edit')
  const [key, setKey] = useState(fields[0]?.key || ''), [text, setText] = useState(fields[0]?.text || '')
  const [feedback, setFeedback] = useState(''), [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [source, setSource] = useState('platform'), [cap, setCap] = useState('1'), [quality, setQuality] = useState('standard')
  const field = fields.find(f => f.key === key)
  async function submit() {
    setBusy(true); setError('')
    try {
      await studyRequest(`/api/study-versions/${revision.versionId}/${mode === 'edit' ? 'edit' : 'improve'}`, {
        baseRevisionId: revision.id, topicId: chapter.id,
        ...(mode === 'edit' ? { field: key, text } : { feedback, billingSource: source, maxJobUsd: Number(cap), quality })
      })
      setOpen(false); onChanged()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <>
    <Button variant="outline" size="sm" className="self-start" onClick={() => { setOpen(true); setReview(false); setError('') }}><PencilIcon />Edit chapter</Button>
    <Sheet open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b p-6 pr-12">
          <SheetTitle>Edit chapter</SheetTitle>
          <SheetDescription>{chapter.title}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div className="flex gap-2" aria-label="Editing method">
            <Button variant={mode === 'edit' ? 'secondary' : 'ghost'} aria-pressed={mode === 'edit'} onClick={() => { setMode('edit'); setReview(false) }}><PencilIcon />Edit text</Button>
            <Button variant={mode === 'ai' ? 'secondary' : 'ghost'} aria-pressed={mode === 'ai'} onClick={() => { setMode('ai'); setReview(false) }}><SparklesIcon />Improve with AI</Button>
          </div>
          {mode === 'edit' ? <>
            <p className="text-sm leading-relaxed text-muted-foreground">Correct a sentence, clarify a rule or adjust an answer. This saves a personal revision at no AI cost.</p>
            <div className="space-y-2"><label htmlFor="study-edit-block" className="text-sm font-medium">Text to edit</label>
              <select id="study-edit-block" disabled={review} value={key} onChange={e => { setKey(e.target.value); setText(fields.find(f => f.key === e.target.value)?.text || '') }} className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm">{fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
            {review ? <div className="space-y-5"><section><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Before</h3><div className="border-l-2 pl-4"><StudyProse>{field?.text || ''}</StudyProse></div></section><section><h3 className="mb-2 text-xs font-semibold uppercase text-primary">Your change</h3><div className="border-l-2 border-primary pl-4"><StudyProse>{text}</StudyProse></div></section><p className="text-sm text-muted-foreground">This chapter will be labelled “Personally edited”. Its previous AI check will no longer apply. Earlier revisions and practice history stay saved.</p></div>
              : <div className="space-y-2"><label htmlFor="study-edit-text" className="text-sm font-medium">Your wording</label><Textarea id="study-edit-text" className="min-h-56 leading-relaxed" maxLength={6000} value={text} onChange={e => setText(e.target.value)} /><p className="text-xs text-muted-foreground">Markdown and mathematical notation are supported. Sources stay attached.</p></div>}
          </> : <>
            <p className="text-sm leading-relaxed text-muted-foreground">Describe what would help you understand this chapter. AI revises this chapter and checks it against its sources. You review the proposal before applying it.</p>
            <div className="flex flex-wrap gap-2">{['Explain more simply', 'Add a worked example', 'Make practice more challenging'].map(s => <Button key={s} variant="outline" size="sm" onClick={() => setFeedback(s)}>{s}</Button>)}</div>
            <div className="space-y-2"><label htmlFor="study-edit-feedback" className="text-sm font-medium">What should change?</label><Textarea id="study-edit-feedback" placeholder="The independence explanation is confusing. Walk through a concrete example and explain how it differs from disjoint events." maxLength={2000} className="min-h-32" value={feedback} onChange={e => setFeedback(e.target.value)} /></div>
            <StudyBillingFields source={source} setSource={setSource} cap={cap} setCap={setCap} quality={quality} setQuality={setQuality} />
            <p className="text-xs text-muted-foreground">Only this chapter is generated again. Other chapters, personal notes and past answers are preserved.</p>
          </>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t bg-background p-4">
          <Button variant="ghost" disabled={busy} onClick={() => review ? setReview(false) : setOpen(false)}>{review ? 'Back to editing' : 'Cancel'}</Button>
          <Button disabled={busy || (mode === 'edit' ? !text.trim() || text.trim() === field?.text : feedback.trim().length < 5)} onClick={() => mode === 'edit' && !review ? setReview(true) : void submit()}>{busy ? 'Saving…' : mode === 'ai' ? 'Generate proposal' : review ? 'Apply change' : 'Review change'}</Button>
        </footer>
      </SheetContent>
    </Sheet>
  </>
}
