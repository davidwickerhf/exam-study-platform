'use client'
import { StudyBillingFields } from './study-billing-fields'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldGroup
} from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  studyRequest,
  type StudySource,
  type StudyVersion,
  type StudyCourseIdentity,
  type StudyEstimate
} from '@/lib/workspace/study-versions'

export function StudySourceForm({
  course,
  versionId,
  initialKeys,
  onDone,
  onCancel
}: {
  course: StudyCourseIdentity
  versionId?: string
  initialKeys?: string[]
  onDone: (id: string) => void
  onCancel: () => void
}) {
  const [billingSource, setBillingSource] = useState('platform'),
    [cap, setCap] = useState('1'),
    [estimate, setEstimate] = useState<StudyEstimate | null>(null)
  const [year, setYear] = useState(
    course.academicYear === 'all' ? '' : course.academicYear
  )
  const [sources, setSources] = useState<StudySource[] | null>(null),
    [chosen, setChosen] = useState<string[]>(initialKeys || [])
  const [historical, setHistorical] = useState(false),
    [title, setTitle] = useState('My study version')
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [noteBusy, setNoteBusy] = useState(false),
    [configured, setConfigured] = useState(true)
  const [noteTitle, setNoteTitle] = useState(''),
    [notes, setNotes] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [noteOpen, setNoteOpen] = useState(false)
  const identity = { ...course, academicYear: year }
  async function load(keep = false) {
    if (!year) return
    const result = await studyRequest<{
      sources: StudySource[]
      configured: boolean
    }>(`/api/study-versions/sources?${new URLSearchParams(identity)}`)
    setSources(result.sources)
    setConfigured(result.configured)
    if (!keep) {
      const selected = initialKeys?.length
        ? result.sources.filter((s) => initialKeys.includes(s.key))
        : result.sources.filter((s) => !s.historical && !s.periodMismatch)
      setChosen(selected.map((s) => s.key))
      setHistorical(selected.some((s) => s.historical || s.periodMismatch))
    }
  }
  useEffect(() => {
    let active = true
    setSources(null)
    setError('')
    if (year)
      studyRequest<{ sources: StudySource[]; configured: boolean }>(
        `/api/study-versions/sources?${new URLSearchParams({ ...course, academicYear: year })}`
      )
        .then((result) => {
          if (!active) return
          setSources(result.sources)
          setConfigured(result.configured)
          const selected = initialKeys?.length
            ? result.sources.filter((s) => initialKeys.includes(s.key))
            : result.sources.filter((s) => !s.historical && !s.periodMismatch)
          setChosen(selected.map((s) => s.key))
          setHistorical(selected.some((s) => s.historical || s.periodMismatch))
        })
        .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [course.courseCode, year]) // Source selection resets only when the target edition changes.
  async function addNote() {
    setNoteBusy(true)
    setError('')
    try {
      let attachment
      if (file) {
        if (file.size > 8 * 1024 * 1024)
          throw new Error('Notes uploads are limited to 8 MB.')
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('Could not read the file.'))
          reader.readAsDataURL(file)
        })
        attachment = { name: file.name, base64 }
      }
      const result = await studyRequest<{ id: string }>('/api/study-notes', {
        ...identity,
        title: noteTitle || file?.name,
        text: notes,
        ...(attachment ? { file: attachment } : {})
      })
      await load(true)
      setChosen((old) => [...old, result.id])
      setNotes('')
      setNoteTitle('')
      setFile(null)
      setNoteOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setNoteBusy(false)
    }
  }
  useEffect(() => {
    setEstimate(null)
  }, [chosen.join(','), billingSource, cap, year])
  async function generate() {
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...identity,
        title,
        sourceKeys: chosen,
        includeHistorical: historical,
        billingSource,
        maxJobUsd: Number(cap)
      }
      if (!estimate) {
        setEstimate(
          await studyRequest<StudyEstimate>(
            '/api/study-versions/estimate',
            payload
          )
        )
        return
      }
      const result = await studyRequest<{ version: StudyVersion }>(
        versionId
          ? `/api/study-versions/${versionId}/refresh`
          : '/api/study-versions',
        payload
      )
      onDone(result.version.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const currentYear = new Date().getFullYear(),
    years = [
      ...new Set(
        [
          year,
          ...Array.from(
            { length: 8 },
            (_, i) => `${currentYear + 1 - i}-${currentYear + 2 - i}`
          ),
          'undated'
        ].filter(Boolean)
      )
    ]
  const visible = (sources || []).filter(
    (s) => historical || (!s.historical && !s.periodMismatch)
  )
  return (
    <section
      className="flex flex-col gap-5"
      aria-label={
        versionId ? 'Refresh study version' : 'Generate study version'
      }
    >
      <div>
        <h3 className="text-base font-semibold">
          {versionId
            ? 'Update your source selection'
            : 'Build your study version'}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Chapters, summaries, exercises and flashcards, grounded in the sources
          you choose. Private until you decide to share.
        </p>
      </div>
      <FieldGroup>
        {!versionId && (
          <Field>
            <FieldLabel htmlFor="study-version-title">Version name</FieldLabel>
            <Input
              id="study-version-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={180}
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="study-source-year">Academic edition</FieldLabel>
          <Select
            value={year || null}
            onValueChange={(v) => v && setYear(v)}
            disabled={Boolean(versionId)}
          >
            <SelectTrigger id="study-source-year">
              <SelectValue placeholder="Choose an academic year">
                {year === 'undated' ? 'Undated course' : year || undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y === 'undated' ? 'Undated course' : y}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            Choose the year you are studying or resitting. Assessment rules from
            older editions are not carried forward.
          </FieldDescription>
        </Field>
        {year && (
          <>
            <Field orientation="horizontal">
              <Checkbox
                id="study-source-history"
                checked={historical}
                onCheckedChange={(value) => {
                  setHistorical(Boolean(value))
                  if (!value)
                    setChosen((old) =>
                      old.filter((key) =>
                        sources?.some(
                          (s) =>
                            s.key === key && !s.historical && !s.periodMismatch
                        )
                      )
                    )
                }}
              />
              <div>
                <FieldLabel htmlFor="study-source-history">
                  Include older or undated material
                </FieldLabel>
                <FieldDescription>
                  Optional supplements, including editorial guides whose
                  academic year is not recorded.
                </FieldDescription>
              </div>
            </Field>
            {sources === null && !error ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border">
                <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                  <span className="text-sm font-medium">Sources</span>
                  <span className="text-muted-foreground text-xs">
                    {chosen.length} selected
                  </span>
                </div>
                {!visible.length ? (
                  <p className="text-muted-foreground p-4 text-sm">
                    No sources for this edition yet. Collect course materials or
                    add your notes below.
                  </p>
                ) : (
                  visible.map((source) => (
                    <Field
                      key={source.key}
                      orientation="horizontal"
                      className="border-b p-3 last:border-0"
                    >
                      <Checkbox
                        id={`source-${source.key}`}
                        checked={chosen.includes(source.key)}
                        onCheckedChange={(v) =>
                          setChosen((old) =>
                            v
                              ? [...old, source.key]
                              : old.filter((k) => k !== source.key)
                          )
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <FieldLabel
                          htmlFor={`source-${source.key}`}
                          className="break-words"
                        >
                          {source.title}
                        </FieldLabel>
                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span>
                            {source.kind === 'notes'
                              ? 'Your notes'
                              : source.kind === 'editorial'
                                ? 'Editorial guide'
                                : 'Course material'}
                          </span>
                          <span>{source.academicYear}</span>
                          {source.period && <span>{source.period}</span>}
                          {(source.historical || source.periodMismatch) && (
                            <Badge variant="outline">Supplement</Badge>
                          )}
                        </div>
                      </div>
                    </Field>
                  ))
                )}
              </div>
            )}
            <Button variant="outline" onClick={() => setNoteOpen(!noteOpen)}>
              {noteOpen ? 'Close notes form' : 'Add your notes'}
            </Button>
            {noteOpen && (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="study-note-title">
                    Notes title
                  </FieldLabel>
                  <Input
                    id="study-note-title"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Tutorial 1 — my notes"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="study-note-text">Paste notes</FieldLabel>
                  <Textarea
                    id="study-note-text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    disabled={Boolean(file)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="study-note-file">
                    Or upload a file
                  </FieldLabel>
                  <Input
                    id="study-note-file"
                    type="file"
                    accept=".pdf,.docx,.md,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <FieldDescription>
                    PDF, Word, Markdown or text · up to 8 MB. Scanned PDFs need
                    readable text.
                  </FieldDescription>
                </Field>
                <Button
                  variant="secondary"
                  disabled={noteBusy || (!notes.trim() && !file)}
                  onClick={() => void addNote()}
                >
                  {noteBusy && <Spinner data-icon="inline-start" />}Save private
                  notes
                </Button>
              </FieldGroup>
            )}
          </>
        )}
      </FieldGroup>
      <StudyBillingFields
        source={billingSource}
        setSource={setBillingSource}
        cap={cap}
        setCap={setCap}
      />
      {estimate && (
        <Alert>
          <AlertDescription>
            <span>
              Approximately {estimate.chapterRange[0]}–
              {estimate.chapterRange[1]} chapters · estimated $
              {estimate.estimatedUsd[0].toFixed(2)}–$
              {estimate.estimatedUsd[1].toFixed(2)}. {estimate.unlimited ? 'No usage cap.' : `Spending cap: $${estimate.maxJobUsd.toFixed(2)}.`} Model: {estimate.model}.
            </span>
            <span>{estimate.explanation}</span>
          </AlertDescription>
        </Alert>
      )}
      {!configured && billingSource === 'platform' && (
        <Alert>
          <AlertDescription>
            Platform generation is unavailable in this environment. You can
            prepare sources, read existing versions, or connect your own AI key.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void generate()}
          disabled={busy || noteBusy || !year || !chosen.length}
        >
          {busy && <Spinner data-icon="inline-start" />}
          {!estimate
            ? 'Review generation estimate'
            : versionId
              ? 'Generate updated revision'
              : 'Generate my study version'}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Generation uses your AI allowance. Source reading, chapter writing and
        evidence checks are saved as they finish. The full course may still be
        incomplete.
      </p>
    </section>
  )
}
