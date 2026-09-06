'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StudyProse } from './study-prose'
import { StudyReader } from './study-reader'
import { chapterTextChanges } from '@/lib/study-chapter-edits.mjs'
import { studyRequest, type StudyRevision } from '@/lib/workspace/study-versions'
export function StudyProposal({ proposal, base, onChanged }: { proposal: StudyRevision; base: StudyRevision; onChanged: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const before = base.chapters.find(c => c.id === proposal.edit?.topicId), after = proposal.chapters.find(c => c.id === proposal.edit?.topicId)
  if (!before || !after) return null
  const changes: { key: string; label: string; before: string; after: string }[] = chapterTextChanges(before, after)
  async function decide(decision: string) {
    setBusy(true); setError('')
    try {
      await studyRequest(`/api/study-versions/${proposal.versionId}/proposal`, { revisionId: proposal.id, decision })
      setOpen(false); onChanged()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-5">
      <div><h2 className="font-semibold">Your chapter update is ready to review</h2><p className="mt-1 text-sm text-muted-foreground">{after.title} · Your current revision is still in use.</p></div>
      <Button onClick={() => setOpen(true)}>Review proposed changes</Button>
    </section>
    <Sheet open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-4xl">
        <SheetHeader className="border-b p-6 pr-12"><SheetTitle>Review proposed changes</SheetTitle><SheetDescription>Compare the update before replacing this chapter. Your current revision stays saved.</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <details className="mb-5 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Your request</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">{proposal.edit?.feedback}</p></details>
          <Tabs defaultValue="changes"><TabsList><TabsTrigger value="changes">Text changes ({changes.length})</TabsTrigger><TabsTrigger value="preview">Full chapter preview</TabsTrigger></TabsList>
            <TabsContent value="changes" className="space-y-5 pt-4"><p className="text-sm text-muted-foreground">Review the full preview for diagrams, learning goals and any structural changes. Applying replaces this chapter only.</p>{changes.map(c => <section key={c.key} className="border-b pb-5"><h3 className="mb-3 font-medium">{c.label}</h3><div className="grid gap-5 md:grid-cols-2"><div><p className="mb-2 text-xs font-medium text-muted-foreground">BEFORE</p><StudyProse>{c.before || 'Not present'}</StudyProse></div><div><p className="mb-2 text-xs font-medium text-primary">PROPOSED</p><StudyProse>{c.after || 'Removed'}</StudyProse></div></div></section>)}</TabsContent>
            <TabsContent value="preview" className="pt-4"><StudyReader revision={{ ...proposal, chapters: [after], topics: proposal.topics.filter(t => t.id === after.id) }} /></TabsContent>
          </Tabs>
          {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t bg-background p-4"><Button variant="ghost" disabled={busy} onClick={() => void decide('discard')}>Discard proposal</Button><Button disabled={busy} onClick={() => void decide('apply')}>{busy ? 'Saving…' : 'Apply chapter update'}</Button></footer>
      </SheetContent>
    </Sheet>
  </>
}
