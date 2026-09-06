'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import {
  studyRequest,
  type StudyRevision,
  type StudyPublication
} from '@/lib/workspace/study-versions'
export function StudySharingForm({
  revision,
  title,
  onClose
}: {
  revision: StudyRevision
  title: string
  onClose: () => void
}) {
  const [mode, setMode] = useState('course'),
    [selected, setSelected] = useState(revision.chapters.map((c) => c.id)),
    [consent, setConsent] = useState(false),
    [notesConsent, setNotesConsent] = useState(false),
    [attribution, setAttribution] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<{ id?: string; submitted?: boolean } | null>(
      null
    )
  async function submit() {
    setBusy(true)
    setError('')
    try {
      const response = await studyRequest<StudyPublication>(
        `/api/study-versions/${revision.versionId}/${mode === 'editorial' ? 'submit' : 'publish'}`,
        {
          revisionId: revision.id,
          topicIds: selected,
          audience: mode,
          title,
          attribution,
          confirmSharing: consent,
          notesConsent
        }
      )
      setResult(
        mode === 'editorial' ? { submitted: true } : { id: response.id }
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section
      className="flex flex-col gap-5 rounded-xl border bg-card p-5"
      aria-label="Share study version"
    >
      <div>
        <h2 className="font-semibold">Share selected chapters</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Publish this saved revision, or offer it for editorial review. Your
          private annotations and attempts stay private.
        </p>
      </div>
      {result ? (
        <>
          <Alert>
            <AlertDescription>
              {result.submitted
                ? 'Submitted to the editorial review inbox. Your personal version remains available.'
                : 'Your selected chapters have been published with their cited evidence.'}
            </AlertDescription>
          </Alert>
          {result.id && (
            <Link
              className="text-primary text-sm underline"
              href={
                mode === 'public'
                  ? `/study/${result.id}`
                  : `/app/study/shared/${result.id}`
              }
            >
              Open shared version
            </Link>
          )}
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </>
      ) : (
        <>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="study-audience">Share with</FieldLabel>
              <Select
                value={mode}
                onValueChange={(v) => {
                  if (v) {
                    setMode(v)
                    setConsent(false)
                  }
                }}
              >
                <SelectTrigger id="study-audience">
                  <SelectValue>
                    {mode === 'editorial'
                      ? 'Editorial reviewers'
                      : mode === 'public'
                        ? 'Anyone with the link'
                        : 'Course members'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="course">Course members</SelectItem>
                    <SelectItem value="public">Anyone with the link</SelectItem>
                    <SelectItem value="editorial">
                      Editorial reviewers
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {mode === 'editorial'
                  ? 'Selected chapters and their cited evidence go to the review inbox. This does not make the version editorial.'
                  : mode === 'public'
                    ? 'Public links require shareable notes or published editorial inputs. Collected Canvas materials cannot be made public here.'
                    : 'Canvas-based chapters require accepted community sources. Other course members see the selected chapters and cited excerpts.'}
              </FieldDescription>
            </Field>
            {mode !== 'editorial' && (
              <Field>
                <FieldLabel htmlFor="study-attribution">
                  Contributor name
                </FieldLabel>
                <Input
                  id="study-attribution"
                  value={attribution}
                  onChange={(e) => setAttribution(e.target.value)}
                  placeholder="Student contributor"
                  maxLength={100}
                />
              </Field>
            )}
            <div className="max-h-60 overflow-y-auto rounded-lg border">
              {revision.chapters.map((c) => (
                <Field key={c.id} orientation="horizontal" className="p-3">
                  <Checkbox
                    id={`share-${c.id}`}
                    checked={selected.includes(c.id)}
                    onCheckedChange={(v) =>
                      setSelected((old) =>
                        v ? [...old, c.id] : old.filter((id) => id !== c.id)
                      )
                    }
                  />
                  <FieldLabel htmlFor={`share-${c.id}`}>{c.title}</FieldLabel>
                </Field>
              ))}
            </div>
            {revision.snapshot.sources.some((s) => s.kind === 'notes') &&
              mode !== 'editorial' && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="study-notes-consent"
                    checked={notesConsent}
                    onCheckedChange={(v) => setNotesConsent(Boolean(v))}
                  />
                  <FieldLabel htmlFor="study-notes-consent">
                    The included notes are mine to share, including the cited
                    excerpts.
                  </FieldLabel>
                </Field>
              )}
            <Field orientation="horizontal">
              <Checkbox
                id="study-sharing-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(Boolean(v))}
              />
              <FieldLabel htmlFor="study-sharing-consent">
                I have permission to share the selected chapters and cited
                source excerpts with this audience.
              </FieldLabel>
            </Field>
          </FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">
                {error}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void submit()}
              disabled={busy || !consent || !selected.length}
            >
              {busy && <Spinner data-icon="inline-start" />}
              {mode === 'editorial'
                ? 'Submit for editorial review'
                : 'Publish selected chapters'}
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
