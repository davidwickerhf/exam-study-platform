'use client'
import { useState } from 'react'
import { SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  StudyAiPreferencesForm,
  StudyAiPreferenceSummary,
  useStudyAiPreferences,
} from './study-ai-preferences'
import {
  studyRequest,
  type StudyChapter,
  type StudyRevision,
} from '@/lib/workspace/study-versions'

export function StudyChapterEditor({
  chapter,
  revision,
  onChanged,
}: {
  chapter: StudyChapter
  revision: StudyRevision
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false),
    [settings, setSettings] = useState(false)
  const [feedback, setFeedback] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const { preferences } = useStudyAiPreferences()
  async function submit() {
    setBusy(true)
    setError('')
    try {
      await studyRequest(`/api/study-versions/${revision.versionId}/improve`, {
        baseRevisionId: revision.id,
        topicId: chapter.id,
        feedback,
        ...preferences,
      })
      setOpen(false)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          setOpen(true)
          setSettings(false)
          setError('')
        }}
      >
        <SparklesIcon />
        Improve chapter
      </Button>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value)
        }}
      >
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader className="border-b p-6 pr-12">
            <SheetTitle>Improve chapter</SheetTitle>
            <SheetDescription>{chapter.title}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Describe what would help you understand this chapter. AI revises
              this chapter and checks it against its sources. You review the
              proposal before applying it.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                'Explain more simply',
                'Add a worked example',
                'Make practice more challenging',
              ].map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => setFeedback(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <label
                htmlFor="study-edit-feedback"
                className="text-sm font-medium"
              >
                What should change?
              </label>
              <Textarea
                id="study-edit-feedback"
                placeholder="The independence explanation is confusing. Walk through a concrete example and explain how it differs from disjoint events."
                maxLength={2000}
                className="min-h-32"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StudyAiPreferenceSummary preferences={preferences} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSettings(!settings)}
              >
                Change AI preferences
              </Button>
            </div>
            {settings && (
              <StudyAiPreferencesForm onSaved={() => setSettings(false)} />
            )}
            <p className="text-xs text-muted-foreground">
              Only this chapter is generated again. Other chapters, personal
              notes and past answers are preserved.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <footer className="flex shrink-0 justify-end gap-2 border-t bg-background p-4">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || !preferences || feedback.trim().length < 5}
              onClick={() => void submit()}
            >
              {busy ? 'Saving…' : 'Generate proposal'}
            </Button>
          </footer>
        </SheetContent>
      </Sheet>
    </>
  )
}
