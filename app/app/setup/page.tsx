'use client'

/**
 * Setup, migrated.
 *
 * The conversation opens on the first thing that is actually missing rather
 * than on a greeting. The server decides which that is — `GET /api/onboarding`
 * returns an `opening` of `{ step, heading, body, placeholder }` while the
 * student has not replied yet — and this page draws it as its own screen: the
 * question, and the field that answers it, together. Shown as a transcript it
 * was one bubble stranded above a page of nothing with the composer parked on
 * the floor. Once they reply it becomes an ordinary thread.
 *
 * A credential never enters the conversation. The timetable URL and the Canvas
 * token are typed into their own protected field, posted to
 * /api/onboarding/secure, applied by the server and written back into the
 * transcript only as the fact that they were applied — see `applySecureValue`
 * in lib/onboarding-runtime.mjs. Nothing here puts either value in a message,
 * in a URL, or in the console.
 *
 * Assistant turns are Markdown, parsed by lib/app/markdown.mjs — the same
 * escape-first parser the tutor uses, which is what makes it safe to set as
 * HTML.
 *
 * `?checklist=1` is the fallback, and the only surface when no model is
 * configured (`available: false`). It reports each source from the server's own
 * `state`, and never draws a step as done that the server did not say is
 * connected.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  CheckIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  SendIcon,
  ShieldIcon
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { tutorMarkdown } from '@/lib/workspace/markdown.mjs'
import {
  type SetupStep,
  type SetupStepId,
  connectedCount,
  eventLine,
  isComplete,
  nextStep,
  pdfPageText,
  setupSteps
} from '@/lib/workspace/setup.mjs'
import { FilePicker } from './file-picker'
import { FinishSetup } from './finish-setup'
import { json, type ElectiveGroup, type Message, type ProgrammeOption, type View } from './view'

const CANVAS_SETTINGS = 'https://canvas.maastrichtuniversity.nl/profile/settings'
const TIMETABLE_PORTAL = 'https://timetable.maastrichtuniversity.nl/m/#loggedin'
const STUDENT_PORTAL = 'https://studentportal.maastrichtuniversity.nl/group/guest/my-study'
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs'
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

const PROSE =
  '[&>*+*]:mt-3 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5'

// ── The Academic Work overview ────────────────────────────────────────────
// The portal prints a text PDF and the server parses it as a table, so only
// the text is sent: the file itself never leaves the browser. pdf.js is loaded
// from a pinned CDN build and cached on the window for subsequent uploads.

type PdfjsItem = { str?: string; width?: number; transform?: number[] }
type Pdfjs = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (source: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: PdfjsItem[] }> }> }> }
}

async function loadPdfjs(): Promise<Pdfjs> {
  const held = (window as unknown as { __pdfjs?: Pdfjs }).__pdfjs
  if (held) return held
  const library = (await import(/* webpackIgnore: true */ PDFJS)) as unknown as Pdfjs
  library.GlobalWorkerOptions.workerSrc = PDFJS.replace('pdf.min.mjs', 'pdf.worker.min.mjs')
  ;(window as unknown as { __pdfjs?: Pdfjs }).__pdfjs = library
  return library
}

async function academicWorkText(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 15 MB.`)
  if (file.type.startsWith('text/') || /\.(txt|csv)$/i.test(file.name)) return (await file.text()).slice(0, 120_000)
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('The Academic Work overview is a PDF printed from the student portal. Choose that file, or a text export of it.')
  }
  const pdfjs = await loadPdfjs()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  for (let number = 1; number <= Math.min(pdf.numPages, 30); number += 1) {
    const content = await (await pdf.getPage(number)).getTextContent()
    const text = pdfPageText(content.items.map((item) => ({ text: String(item.str ?? ''), x: Number(item.transform?.[4]) || 0, y: Number(item.transform?.[5]) || 0, width: Number(item.width) || 0 })))
    if (text) pages.push(`Page ${number}\n${text}`)
  }
  const all = pages.join('\n\n')
  if (!all.trim()) throw new Error('No text could be read from that file. Print the overview from the student portal rather than photographing it.')
  return all
}

type WorkResult = {
  unchanged?: boolean
  summary: { earnedEcts: number; passedCourses: number; currentCourses: number; weightedAverage: number | null }
  progress?: { ectsDelta: number; newlyPassed: { code: string }[] } | null
}

async function uploadAcademicWork(file: File): Promise<WorkResult> {
  const text = await academicWorkText(file)
  return json<WorkResult>('/api/academics/work', { method: 'POST', body: JSON.stringify({ documents: [{ name: file.name, text }] }) })
}

// What the student then tells the conversation. The document is not sent to
// the model; the numbers the parser derived from it are.
function workSummaryLine(result: WorkResult) {
  if (result.unchanged) return 'I uploaded my Academic Work overview; nothing had changed since the last one.'
  const { earnedEcts, passedCourses, currentCourses } = result.summary
  return `I uploaded my Academic Work overview: ${earnedEcts} credits, ${passedCourses} courses passed, ${currentCourses} registered this period.`
}

// ── Pieces of the conversation ────────────────────────────────────────────

/* Safe to set: the parser escapes first and emits only its own rules. */
function Answer({ content }: { content: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar size="sm" className="mt-0.5 rounded-sm">
        <AvatarFallback className="bg-primary text-primary-foreground rounded-sm font-semibold">W</AvatarFallback>
      </Avatar>
      <div
        className={`bg-card min-w-0 max-w-[62ch] overflow-hidden border-l-2 border-primary px-4 py-3 text-[14.5px] leading-relaxed [overflow-wrap:anywhere] ${PROSE}`}
        dangerouslySetInnerHTML={{ __html: tutorMarkdown(content) }}
      />
    </div>
  )
}

function Turn({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-secondary min-w-0 max-w-[46ch] rounded-sm px-4 py-2.5 text-[14.5px] leading-relaxed [overflow-wrap:anywhere]">{message.content}</div>
      </div>
    )
  }
  if (message.role === 'event') {
    // The server's own account of what a credential did. The student did not
    // type it, so it is not drawn as if they had.
    return (
      <p className="text-muted-foreground flex min-w-0 items-start gap-2 text-sm">
        <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{eventLine(message.content)}</span>
      </p>
    )
  }
  return <Answer content={message.content} />
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="flex flex-col gap-3 text-sm">{children}</ol>
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-data tabular-nums text-muted-foreground border-border flex size-6 shrink-0 items-center justify-center rounded-sm border text-xs">{number}</span>
      <span className="flex flex-col gap-0.5">
        <strong className="font-medium">{title}</strong>
        <span className="text-muted-foreground [&_a]:text-primary text-[13.5px] leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-foreground">{children}</span>
      </span>
    </li>
  )
}

function TimetableGuide() {
  return (
    <Steps>
      <Step number={1} title="Open the timetable app and sign in">
        <a href={TIMETABLE_PORTAL} target="_blank" rel="noopener noreferrer">
          timetable.maastrichtuniversity.nl
        </a>{' '}
        — your normal university account.
      </Step>
      <Step number={2} title="Open the menu">The ≡ button, top left of your week.</Step>
      <Step number={3} title="Choose “Connect to calendar app”">It sits under <em>Connect calendar</em>.</Step>
      <Step number={4} title="Copy the URL and paste it below">
        It starts <code>…/ical?</code> and is a personal key to your timetable: treat it like a password, and do not post or screenshot it.
      </Step>
    </Steps>
  )
}

function CanvasGuide() {
  return (
    <Steps>
      <Step number={1} title="Open Canvas settings">
        <a href={CANVAS_SETTINGS} target="_blank" rel="noopener noreferrer">
          canvas.maastrichtuniversity.nl → Settings
        </a>
        , in a tab where you are already signed in.
      </Step>
      <Step number={2} title="Create an access token">
        Under <em>Approved integrations</em>, choose <em>+ New access token</em> and name it “Wicker Study”. Copy it once — Canvas will not show it again.
      </Step>
      <Step number={3} title="Paste it below">Only a Personal Access Token. Never a password, an MFA code, or a cookie.</Step>
    </Steps>
  )
}

function RecordGuide() {
  return (
    <Steps>
      <Step number={1} title="Open My Study in the student portal">
        <a href={STUDENT_PORTAL} target="_blank" rel="noopener noreferrer">
          studentportal.maastrichtuniversity.nl → My Study
        </a>
      </Step>
      <Step number={2} title="Print the Academic Work overview">
        It lists your current courses, everything you have passed, and every failed attempt.
      </Step>
      <Step number={3} title="Choose the PDF below">
        It is read for its results in this browser and only those results are sent. The file itself is never uploaded or stored.
      </Step>
    </Steps>
  )
}

/**
 * The protected field. Its value goes to /api/onboarding/secure and nowhere
 * else: not into a message, not into the URL, not into the console. It is held
 * only for as long as it takes to submit and cleared the moment it is applied.
 */
function SecureField({ kind, onApplied, onSkip }: { kind: 'timetable' | 'canvas'; onApplied: (view: View) => void; onSkip: () => void }) {
  const canvas = kind === 'canvas'
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collectMaterials, setCollectMaterials] = useState(false)
  const [sharingMode, setSharingMode] = useState<'private' | 'community'>('private')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!busy) { setElapsed(0); return }
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [busy])

  return (
    <form
      className="flex flex-col gap-4 border-y py-6"
      onSubmit={async (event) => {
        event.preventDefault()
        const secret = value.trim()
        if (!secret || busy) return
        setBusy(true)
        setError(null)
        try {
          const view = await json<View>('/api/onboarding/secure', {
            method: 'POST',
            body: JSON.stringify({ kind, value: secret, collectionEnabled: canvas && collectMaterials, sharingMode })
          })
          setValue('')
          onApplied(view)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'That value could not be applied.')
        } finally {
          setBusy(false)
        }
      }}
    >
      {canvas ? <CanvasGuide /> : <TimetableGuide />}
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="setup-secure">{canvas ? 'Canvas access token' : 'Timetable URL'}</FieldLabel>
        <Input
          id="setup-secure"
          type={canvas ? 'password' : 'url'}
          value={value}
          disabled={busy}
          required
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={canvas ? '••••••••••••••••••••' : 'https://timetable.maastrichtuniversity.nl/ical?…'}
          onChange={(event) => setValue(event.target.value)}
        />
        <FieldDescription className="flex items-center gap-1.5">
          <ShieldIcon className="size-3.5" />
          This goes straight to your account, encrypted, and never appears in the conversation.
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      {canvas && (
        <fieldset className="flex flex-col gap-3 border-t pt-4">
          <legend className="text-sm font-semibold">Lesson materials</legend>
          <label className="hover:bg-card has-[input:focus-visible]:ring-ring/50 flex cursor-pointer items-start gap-3 text-sm transition-colors has-[input:focus-visible]:ring-2">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 size-4"
              checked={collectMaterials}
              disabled={busy}
              onChange={(event) => setCollectMaterials(event.target.checked)}
            />
            <span>
              <strong className="block font-medium">Collect and index my accessible course materials</strong>
              <span className="text-muted-foreground mt-0.5 block text-[13.5px] leading-relaxed">Runs as a background server job after Canvas is connected. You can change or revoke this later.</span>
            </span>
          </label>
          {collectMaterials && (
            <div className="flex flex-col border-t pl-7" role="radiogroup" aria-label="Who may use collected materials">
              {([
                ['private', 'Private', 'Only your Tutor and authorised MCP clients can retrieve them.'],
                ['community', 'Share with the community', 'Other enrolled students may reuse this edition after rights review.']
              ] as const).map(([value, title, detail]) => (
                <label
                  key={value}
                  className={`hover:bg-card has-[input:focus-visible]:ring-ring/50 flex cursor-pointer items-start gap-3 border-b py-3 transition-colors has-[input:focus-visible]:ring-2 ${sharingMode === value ? 'text-foreground' : ''}`}
                >
                  <input type="radio" name="canvas-sharing" value={value} checked={sharingMode === value} disabled={busy} onChange={() => setSharingMode(value)} className="accent-primary mt-0.5" />
                  <span className="min-w-0">
                    <strong className={`block text-sm ${sharingMode === value ? 'font-semibold' : 'font-medium'}`}>{title}</strong>
                    <span className="text-muted-foreground mt-0.5 block text-[12.5px] leading-relaxed">{detail}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || !value.trim()}>
          {busy && <Spinner data-icon="inline-start" />}
          {busy
            ? canvas ? 'Checking Canvas…' : elapsed >= 8 ? 'Still importing appointments…' : elapsed >= 3 ? 'Downloading appointments…' : 'Checking timetable…'
            : canvas ? 'Connect Canvas' : 'Connect timetable'}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onSkip}>
          Skip this
        </Button>
      </div>
    </form>
  )
}

/** The upload control. Only the text the parser needs leaves this browser. */
function UploadField({ onRead, onSkip }: { onRead: (result: WorkResult) => Promise<void> | void; onSkip?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6 border-y py-6">
      <RecordGuide />
      <FilePicker
        label="Your Academic Work PDF"
        accept="application/pdf,.pdf,.txt"
        busy={busy}
        invalid={Boolean(error)}
        busyLabel="Reading…"
        hint={
          <>
            {busy ? <Spinner className="size-3.5" /> : <ShieldIcon className="size-3.5 shrink-0" />}
            {busy ? 'Reading your overview…' : 'Read for its results, then discarded. The file is never stored.'}
          </>
        }
        onFile={async (file) => {
          if (busy) return
          setBusy(true)
          setError(null)
          try {
            await onRead(await uploadAcademicWork(file))
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'That file could not be read.')
          } finally {
            setBusy(false)
          }
        }}
      />
      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>We couldn’t read the course table</AlertTitle>
          <AlertDescription>{error} If this is the correct document, download a fresh PDF using Print rather than a screenshot or scan.</AlertDescription>
        </Alert>
      )}
      {onSkip && (
        <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={busy} onClick={onSkip}>
          Skip this
        </Button>
      )}
    </div>
  )
}

type TranscriptChange = { id: string; label: string; detail?: string; selectedByDefault?: boolean; requiresDecision?: boolean }
function TranscriptField({ onApplied, onSkip }: { onApplied: () => void; onSkip?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [review, setReview] = useState<{ changes: TranscriptChange[]; revision: number; warnings?: string[] } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  return <div className="flex flex-col gap-6 border-y py-6">
    <p className="text-muted-foreground max-w-[68ch] text-[13.5px] leading-relaxed">Use the transcript that lists individual results and dates — not the Academic Work overview. It is read in this browser and never stored.</p>
    {!review ? <FilePicker
      label="Transcript PDF"
      accept="application/pdf,.pdf,.txt"
      busy={busy}
      invalid={Boolean(error)}
      busyLabel="Reading…"
      hint={<>{busy ? <Spinner className="size-3.5" /> : <ShieldIcon className="size-3.5 shrink-0" />}{busy ? 'Reading and cross-checking your transcript…' : 'You will review every proposed change before it is saved.'}</>}
      onFile={async (file) => {
        if (busy) return
        setBusy(true); setError(null)
        try {
          const text = await academicWorkText(file)
          const result = await json<{ changes: TranscriptChange[]; revision: number; warnings?: string[] }>('/api/academics/documents/analyze', { method: 'POST', body: JSON.stringify({ kind: 'transcript', documents: [{ name: file.name, type: 'application/pdf', text, images: [], pageCount: 1 }] }) })
          setReview(result)
          setSelected(new Set(result.changes.filter((change) => change.selectedByDefault !== false && !change.requiresDecision).map((change) => change.id)))
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'That transcript could not be read.') } finally { setBusy(false) }
      }}
    /> : <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between border-b pb-2"><strong>Review transcript</strong><span className="text-muted-foreground text-xs">{selected.size} of {review.changes.length} selected</span></div>
      {review.warnings?.map((warning) => <p key={warning} className="text-muted-foreground text-sm">{warning}</p>)}
      <ul className="max-h-72 overflow-y-auto border-y">{review.changes.map((change) => <li key={change.id} className="border-b last:border-0"><label className="hover:bg-card flex cursor-pointer items-start gap-3 px-1 py-3 transition-colors"><Checkbox checked={selected.has(change.id)} onCheckedChange={(checked) => setSelected((held) => { const next = new Set(held); checked ? next.add(change.id) : next.delete(change.id); return next })} /><span><strong className="text-sm font-medium">{change.label}</strong>{change.detail && <small className="text-muted-foreground mt-0.5 block">{change.detail}</small>}</span></label></li>)}</ul>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !selected.size} onClick={async () => { setBusy(true); setError(null); try { await json('/api/academics/documents/apply', { method: 'POST', body: JSON.stringify({ expectedRevision: review.revision, changes: review.changes.filter((change) => selected.has(change.id)) }) }); onApplied() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Those changes could not be saved.') } finally { setBusy(false) } }}>{busy && <Spinner data-icon="inline-start" />}{busy ? 'Applying…' : `Apply ${selected.size} ${selected.size === 1 ? 'change' : 'changes'}`}</Button><Button variant="ghost" disabled={busy} onClick={() => { setReview(null); setSelected(new Set()) }}>Choose another file</Button></div>
    </div>}
    {error && <Alert variant="destructive"><AlertTriangleIcon /><AlertTitle>Transcript needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {onSkip && <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={busy} onClick={onSkip}>Skip this</Button>}
  </div>
}

// ── The checklist ─────────────────────────────────────────────────────────

/**
 * What just happened, said where it happened.
 *
 * Saving used to be silent: the request succeeded, the rail counter stayed on
 * 0/7 until a reload, and nothing on the page said the programme had been
 * recorded. The editor now waits for the refreshed view before drawing this,
 * so the mark and the step it belongs to change together.
 */
function SavedMark({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="text-muted-foreground flex min-w-0 items-start gap-2 text-[13.5px] leading-relaxed">
      <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

function ProgrammeEditor({ current, onSaved }: { current: string | null; onSaved: () => void | Promise<unknown> }) {
  const params = useSearchParams()
  const [saved, setSaved] = useState(false)
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([])
  const [programmeId, setProgrammeId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [studyYear, setStudyYear] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [custom, setCustom] = useState(params.get('new') === '1')
  const [institution, setInstitution] = useState('Maastricht University')
  const [degree, setDegree] = useState('Bachelor of Science')
  const [customName, setCustomName] = useState('')
  useEffect(() => {
    json<{ programmes: ProgrammeOption[] }>('/api/onboarding/programmes').then((data) => {
      setProgrammes(data.programmes ?? [])
      const selected = data.programmes?.find((programme) => `${programme.degree} ${programme.name}` === current) ?? data.programmes?.[0]
      if (selected) { setProgrammeId(selected.id); setVersionId(selected.versions?.[0]?.id ?? '') }
    }).catch((cause: Error) => setError(cause.message))
  }, [current])
  const programme = programmes.find((entry) => entry.id === programmeId)
  if (custom) return <form className="flex flex-col gap-4" onSubmit={async (event) => {
    event.preventDefault(); if (!customName.trim() || busy) return; setBusy(true); setError(null); setSaved(false)
    const now = new Date(); const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
    try { await json('/api/academics/programmes', { method: 'POST', body: JSON.stringify({ profile: { university: institution.trim(), programme: `${degree} ${customName.trim()}`, academicYear: `${start}-${start + 1}`, currentYearKey: `${start}-${start + 1}` } }) }); await onSaved(); setSaved(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The programme could not be created.') }
    finally { setBusy(false) }
  }}>
    <div className="border-y py-4"><h3 className="font-semibold">Add a personal programme</h3><p className="text-muted-foreground mt-1 text-sm">This creates your private study record immediately. Courses and dates remain empty until you add or import them; it is not presented as a maintained curriculum.</p></div>
    <Field><FieldLabel htmlFor="custom-institution">Institution</FieldLabel><Input id="custom-institution" value={institution} onChange={(event) => setInstitution(event.target.value)} required /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Degree</FieldLabel><Select items={['Bachelor of Science', 'Bachelor of Arts', 'Master of Science', 'Master of Arts', 'Other'].map((value) => ({ value, label: value }))} value={degree} onValueChange={(value) => setDegree(String(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Bachelor of Science">Bachelor of Science</SelectItem><SelectItem value="Bachelor of Arts">Bachelor of Arts</SelectItem><SelectItem value="Master of Science">Master of Science</SelectItem><SelectItem value="Master of Arts">Master of Arts</SelectItem><SelectItem value="Other">Other</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="custom-programme">Programme name</FieldLabel><Input id="custom-programme" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Econometrics and Operations Research" required /></Field></div>
    {error && <FieldError>{error}</FieldError>}
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy || !customName.trim()}>{busy && <Spinner data-icon="inline-start" />}{busy ? 'Creating…' : 'Create personal programme'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setCustom(false)}>Back to maintained programmes</Button>{saved && <SavedMark>Personal programme created.</SavedMark>}</div>
  </form>
  return <form className="flex flex-col gap-4" onSubmit={async (event) => {
    event.preventDefault(); if (!programmeId || busy) return; setBusy(true); setError(null); setSaved(false)
    try { await json('/api/onboarding/programme', { method: 'PUT', body: JSON.stringify({ programmeId, versionId, studyYear }) }); await onSaved(); setSaved(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The programme could not be saved.') }
    finally { setBusy(false) }
  }}>
    <Field><FieldLabel>Programme</FieldLabel><Select items={programmes.map((entry) => ({ value: entry.id, label: `${entry.degree} ${entry.name}` }))} value={programmeId} onValueChange={(value) => { const id = String(value); setSaved(false); setProgrammeId(id); setVersionId(programmes.find((entry) => entry.id === id)?.versions?.[0]?.id ?? '') }}><SelectTrigger className="w-full"><SelectValue placeholder="Choose your programme" /></SelectTrigger><SelectContent><SelectGroup>{programmes.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.degree} {entry.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field><FieldLabel>Curriculum</FieldLabel><Select items={(programme?.versions ?? []).map((version) => ({ value: version.id, label: `${version.label || version.id}${version.status === 'current' ? ' · current' : ''}` }))} value={versionId} onValueChange={(value) => { setSaved(false); setVersionId(String(value)) }}><SelectTrigger className="w-full"><SelectValue placeholder="Curriculum year" /></SelectTrigger><SelectContent><SelectGroup>{(programme?.versions ?? []).map((version) => <SelectItem key={version.id} value={version.id}>{version.label || version.id}{version.status === 'current' ? ' · current' : ''}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
      <Field><FieldLabel>Current study year</FieldLabel><Select items={Array.from({ length: Math.max(1, programme?.durationYears ?? 3) }, (_, index) => ({ value: String(index + 1), label: `Year ${index + 1}` }))} value={studyYear} onValueChange={(value) => { setSaved(false); setStudyYear(String(value)) }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{Array.from({ length: Math.max(1, programme?.durationYears ?? 3) }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>Year {index + 1}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
    </div>
    <FieldDescription>Changing programme preserves attempts already in your personal academic record.</FieldDescription>
    {error && <FieldError>{error}</FieldError>}
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy || !programmeId || !versionId}>{busy && <Spinner data-icon="inline-start" />}{busy ? 'Saving…' : saved ? 'Save again' : 'Save programme'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setSaved(false); setCustom(true) }}>My programme isn’t listed</Button>{saved && <SavedMark>Programme saved. Your courses, periods and exam weeks now come from it.</SavedMark>}</div>
  </form>
}

function ElectivesEditor({ onSaved }: { onSaved: () => void | Promise<unknown> }) {
  const [groups, setGroups] = useState<ElectiveGroup[] | null>(null)
  const [chosen, setChosen] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { json<{ groups: ElectiveGroup[] }>('/api/onboarding/electives').then((data) => { setGroups(data.groups); setChosen(Object.fromEntries(data.groups.map((group) => [group.id, group.chosen]))) }).catch((cause: Error) => setError(cause.message)) }, [])
  if (!groups) return error ? <FieldError>{error}</FieldError> : <Skeleton className="h-32 w-full" />
  if (!groups.length) return <p className="text-muted-foreground border-y py-6 text-sm">There are no elective choices for your study year in the active teaching period.</p>
  return <div className="flex flex-col gap-6">{groups.map((group) => <section key={group.id} className="border-y py-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">{group.label}</h3><span className="text-muted-foreground text-xs">{chosen[group.id]?.length ?? 0} selected</span></div><div className="flex flex-col">{group.courses.map((course) => <label key={course.id} className="hover:bg-card flex cursor-pointer items-start gap-3 border-t py-3"><Checkbox checked={chosen[group.id]?.includes(course.id)} onCheckedChange={(checked) => { setSaved(null); setChosen((held) => ({ ...held, [group.id]: checked ? [...new Set([...(held[group.id] ?? []), course.id])] : (held[group.id] ?? []).filter((id) => id !== course.id) })) }} /><span className="flex min-w-0 flex-1 justify-between gap-4 text-sm"><span><strong className="font-data mr-2">{course.code}</strong>{course.name}</span><span className="text-muted-foreground font-data shrink-0">{course.ects} ECTS</span></span></label>)}</div><div className="mt-4 flex flex-wrap items-center gap-3"><Button size="sm" disabled={busy === group.id} onClick={async () => { setBusy(group.id); setError(null); setSaved(null); try { await json('/api/onboarding/electives', { method: 'PUT', body: JSON.stringify({ groupId: group.id, courseIds: chosen[group.id] ?? [] }) }); await onSaved(); setSaved(group.id) } catch (cause) { setError(cause instanceof Error ? cause.message : 'The electives could not be saved.') } finally { setBusy(null) } }}>{busy === group.id && <Spinner data-icon="inline-start" />}{busy === group.id ? 'Saving…' : 'Save electives'}</Button>{saved === group.id && <SavedMark>Recorded for this teaching period.</SavedMark>}</div></section>)}{error && <FieldError>{error}</FieldError>}</div>
}

/**
 * State is a mark, not an input.
 *
 * The rail used to draw a small empty square beside every unfinished step,
 * which is the shape of a checkbox, so the row read as something you tick
 * rather than as a status you open. Done carries the signal; waiting carries a
 * square block; pending carries nothing at all, because nothing has happened.
 */
const MARKS: Record<SetupStep['status'], React.ReactNode> = {
  done: <CheckIcon className="text-primary size-4" aria-hidden="true" />,
  todo: null,
  skipped: <span aria-hidden="true" className="text-muted-foreground font-data text-[14px] leading-none">–</span>,
  blocked: <span aria-hidden="true" className="text-muted-foreground text-[10.5px] leading-none">▪</span>
}

const STATUS_WORD: Record<SetupStep['status'], string> = {
  done: 'Connected',
  todo: 'Not connected',
  skipped: 'Skipped',
  blocked: 'Waiting'
}

/**
 * The status, attached to the heading line rather than floating above the
 * panel on its own. Departure-board grammar: the mark, then the word.
 */
function StatusLabel({ status }: { status: SetupStep['status'] }) {
  return (
    <span className={`flex shrink-0 items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase ${status === 'done' ? 'text-primary' : 'text-muted-foreground'}`}>
      <span className="flex size-4 items-center justify-center">{MARKS[status]}</span>
      {STATUS_WORD[status]}
    </span>
  )
}

/**
 * What the panel opens with. The rail already carries the consequence of a
 * missing source ("Not set, so there are no courses…"); repeating it here left
 * the same sentence twice on one screen, so the panel says what to do instead.
 */
const PANEL_INTRO: Record<SetupStepId, string> = {
  programme: 'Choose the degree you are enrolled on, the curriculum year it follows, and the year you are in. Everything else is built from this one answer.',
  electives: 'Tick the optional courses you are actually sitting this period. Nobody else can fill these in for you.',
  record: 'Print the Academic Work overview from the student portal, then choose that PDF here. It is read in this browser.',
  transcript: 'Import the transcript that lists dated results, then tick the changes you want kept. Nothing is saved before you do.',
  calendar: 'Teaching periods, exam weeks and holidays are maintained for the programme you selected. Review them here.',
  timetable: 'Paste the personal calendar link from the university timetable app to bring lectures, tutorials and labs across.',
  canvas: 'Create a personal access token in Canvas and paste it here to bring announcements and hand-in deadlines across.'
}

function ConversationStepRail({ view }: { view: View | null }) {
  const steps = setupSteps({ state: view?.state ?? null, skipped: view?.skipped ?? [] })
  const active = view?.opening?.step
    ?? (view?.prompt?.kind === 'upload' ? (view.prompt.upload === 'transcript' ? 'transcript' : 'record') : view?.prompt?.kind === 'secure' ? view.prompt.secure : nextStep(steps)?.id)
  return (
    <aside className="min-h-0 border-b pb-4 lg:border-r lg:border-b-0 lg:pr-7 lg:pb-0">
      {/* On a phone the rail is a line, not a list: the count, and what is
          being asked for right now. The full register belongs to the wide
          layout, where it does not push the conversation off the screen. */}
      <div className="flex items-baseline justify-between gap-4 lg:block">
        <h2 className="text-sm font-semibold">Workspace setup</h2>
        <p className="font-data text-[21px] leading-none font-semibold tabular-nums lg:mt-3 lg:text-[32px]">
          {connectedCount(steps)}<span className="text-muted-foreground text-[14px] lg:text-[16px]">/{steps.length}</span>
        </p>
      </div>
      <p className="text-muted-foreground mt-2 text-[13.5px] lg:hidden">
        Now: {steps.find((step) => step.id === active)?.title ?? 'Reviewing what is connected'}
      </p>
      <ol className="mt-6 hidden flex-col border-t lg:flex" aria-label="Setup progress">
        {steps.map((step, index) => (
          <li key={step.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 border-b py-3" aria-current={step.id === active ? 'step' : undefined}>
            <span className={`font-data text-[12px] tabular-nums ${step.status === 'done' ? 'text-primary' : 'text-muted-foreground'}`}>{step.status === 'done' ? '✓' : String(index + 1).padStart(2, '0')}</span>
            <span className={`text-sm ${step.id === active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
              <span className="sr-only">{STATUS_WORD[step.status]}. </span>
              {step.title}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function Checklist({ view, onRefresh, onApplied }: { view: View | null; onRefresh: () => Promise<unknown>; onApplied: (view: View) => void }) {
  const params = useSearchParams()
  const requestedStep = params.get('step')
  const [open, setOpen] = useState<string | null>(requestedStep)
  const [saved, setSaved] = useState<string | null>(null)
  const [timetable, setTimetable] = useState('')
  const [timetableBusy, setTimetableBusy] = useState(false)
  const [timetableError, setTimetableError] = useState<string | null>(null)
  const steps = setupSteps({ state: view?.state ?? null, skipped: view?.skipped ?? [] })
  const connected = connectedCount(steps)
  const next = nextStep(steps)
  const selected = steps.find((step) => step.id === open) ?? next ?? steps[0]
  const issues = view?.state?.issues ?? []

  useEffect(() => {
    if (requestedStep) setOpen(requestedStep)
  }, [requestedStep])

  // Read the account again and remember which step was just answered, so the
  // rail's mark, its line of fact and the counter all change at the same time.
  const refreshFrom = async (step: string) => {
    await onRefresh()
    setSaved(step)
  }

  return (
    <div className="mx-auto grid w-full max-w-[1180px] content-start gap-8 p-6 md:p-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
      <aside className="border-b pb-6 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-sm font-semibold">Workspace setup</h1>
            <Link href="/app/setup" className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm text-[12.5px] outline-none hover:underline focus-visible:ring-2">
              ← Conversation
            </Link>
          </div>
          <p className="font-data mt-3 text-[32px] leading-none font-semibold tabular-nums">{connected}<span className="text-muted-foreground text-[16px]">/{steps.length}</span></p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {view ? (
              <>Open any source to review or change it. Only your programme is required.</>
            ) : (
              'Reading your account…'
            )}
          </p>
          {view && <FinishSetup view={view} className="mt-4" onFinished={onApplied} />}
          {!view ? <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} className="h-16 w-full" />
          ))}
          </div> : <ol className="mt-6 flex flex-col border-t" aria-label="Setup steps">
          {steps.map((step) => {
            const stepIssues = issues.filter((issue) => issue.step === step.id || issue.relatedStep === step.id)
            const current = selected?.id === step.id
            return (
              <li key={step.id} className="border-b">
                <button
                  type="button"
                  disabled={step.status === 'blocked'}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => setOpen(step.id)}
                  className={`focus-visible:ring-ring/50 -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 px-2 py-3 text-left transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${current ? 'bg-card' : 'hover:bg-card'}`}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
                    {stepIssues.length ? <AlertTriangleIcon className="text-primary size-4" /> : MARKS[step.status]}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="flex items-center gap-2 text-sm font-medium">
                      {step.title}
                      {step.required && <em className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase not-italic">required</em>}
                      {saved === step.id && step.status === 'done' && <em className="text-primary text-[10.5px] font-semibold tracking-[0.11em] uppercase not-italic">saved</em>}
                    </strong>
                    <small className="text-muted-foreground text-[13.5px] leading-relaxed">
                      <span className="sr-only">{STATUS_WORD[step.status]}. </span>
                      {step.detail}
                    </small>
                  </div>
                  <ChevronRightIcon className={`size-4 shrink-0 ${current ? 'text-primary' : 'text-muted-foreground'}`} />
                </button>
              </li>
            )
          })}
          </ol>}
      </aside>

      <main className="flex min-w-0 max-w-[68ch] flex-col gap-6">
        {selected && <>
          <div className="border-b pb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{selected.title}</h2>
              <StatusLabel status={selected.status} />
            </div>
            <p className="text-muted-foreground mt-3 max-w-[58ch] text-[15px] leading-relaxed">{PANEL_INTRO[selected.id] ?? selected.blurb}</p>
          </div>

          {issues.filter((issue) => issue.step === selected.id || issue.relatedStep === selected.id).map((issue) => (
            <div key={issue.id} role="alert" className="border-primary bg-card flex min-w-0 gap-3 border-l-2 px-4 py-3">
              <AlertTriangleIcon className="text-primary mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <strong className="text-sm">{issue.title}</strong>
                <p className="text-muted-foreground mt-1 text-sm [overflow-wrap:anywhere]">{issue.detail}</p>
                <p className="mt-2 text-sm">{issue.recovery}</p>
                {(issue.unexpectedCourses?.length || issue.expectedCourses?.length) && (
                  <details className="mt-3 border-t pt-3">
                    <summary className="focus-visible:ring-primary w-fit cursor-pointer text-sm font-semibold outline-none hover:underline focus-visible:ring-2">See the course comparison</summary>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">In your current record</p>
                        <ul className="space-y-1 text-sm">
                          {issue.unexpectedCourses?.map((course) => <li key={`${course.code}-${course.name}`}><span className="font-data text-primary">{course.code}</span>{course.name ? ` — ${course.name}` : ''}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">In the selected plan</p>
                        <ul className="max-h-48 space-y-1 overflow-y-auto pr-2 text-sm">
                          {issue.expectedCourses?.map((course) => <li key={`${course.code}-${course.name}`}><span className="font-data">{course.code}</span>{course.name ? ` — ${course.name}` : ''}</li>)}
                        </ul>
                      </div>
                    </div>
                  </details>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={() => setOpen('programme')}>Change programme or year</Button>
                  <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/app/setup?explain=${encodeURIComponent(issue.id)}`} />}>Explain my situation</Button>
                </div>
              </div>
            </div>
          ))}

          {selected.id === 'record' && <UploadField onRead={() => refreshFrom('record')} />}
          {selected.id === 'transcript' && <TranscriptField onApplied={() => void refreshFrom('transcript')} />}

          {selected.id === 'timetable' && (
                  <form
                    className="flex flex-col gap-4 border-y py-6"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      const url = timetable.trim()
                      if (!url || timetableBusy) return
                      setTimetableBusy(true)
                      setTimetableError(null)
                      try {
                        await json('/api/academics/calendars', { method: 'POST', body: JSON.stringify({ url, label: 'University timetable' }) })
                        setTimetable('')
                        await refreshFrom('timetable')
                      } catch (cause) {
                        setTimetableError(cause instanceof Error ? cause.message : 'That feed could not be read.')
                      } finally {
                        setTimetableBusy(false)
                      }
                    }}
                  >
                    <TimetableGuide />
                    <Field data-invalid={timetableError ? true : undefined}>
                      <FieldLabel htmlFor="checklist-timetable">Timetable URL</FieldLabel>
                      <Input
                        id="checklist-timetable"
                        type="url"
                        required
                        autoComplete="off"
                        spellCheck={false}
                        value={timetable}
                        disabled={timetableBusy}
                        placeholder="https://timetable.maastrichtuniversity.nl/ical?…"
                        onChange={(event) => setTimetable(event.target.value)}
                      />
                      <FieldDescription className="flex items-center gap-1.5">
                        <ShieldIcon className="size-3.5" />
                        Stored on your account only, and read but never written to.
                      </FieldDescription>
                      {timetableError && <FieldError>{timetableError}</FieldError>}
                    </Field>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" size="sm" disabled={timetableBusy || !timetable.trim()}>
                        {timetableBusy && <Spinner data-icon="inline-start" />}
                        {timetableBusy ? 'Checking the feed…' : 'Connect timetable'}
                      </Button>
                      {saved === 'timetable' && <SavedMark>{selected.detail}</SavedMark>}
                    </div>
                  </form>
          )}

          {selected.id === 'canvas' && <SecureField kind="canvas" onApplied={(next) => { onApplied(next); setSaved('canvas') }} onSkip={() => {}} />}

          {selected.id === 'programme' && <ProgrammeEditor current={view?.state?.programmeName ?? null} onSaved={() => refreshFrom('programme')} />}
          {selected.id === 'electives' && (view?.state?.customProgramme ? <div className="flex flex-col gap-3 border-y py-6"><p className="text-muted-foreground text-sm">This is a personal programme without a maintained curriculum, so there are no predefined elective groups. Add the courses you take directly to your personal plan.</p><Button variant="outline" className="w-fit" nativeButton={false} render={<Link href="/app/planning?tab=courses" />}>Manage my courses</Button></div> : <ElectivesEditor onSaved={() => refreshFrom('electives')} />)}
          {selected.id === 'calendar' && <div className="flex flex-col gap-3 border-y py-6"><strong className="font-data text-[24px] tabular-nums">{view?.state?.calendarDates ?? 0} maintained dates</strong><p className="text-muted-foreground text-sm">Teaching periods, exam weeks and holidays come from the selected programme’s maintained calendar. Changing the programme updates this source automatically.</p><Button variant="outline" className="w-fit" nativeButton={false} render={<Link href="/app/calendar" />}>Open calendar</Button></div>}
        </>}

      {view && isComplete(steps) && !issues.length && (
        <div className="flex flex-col gap-4 border-t pt-4">
          <p className="flex items-start gap-2 text-sm">
            <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
            <span>Everything is connected. Home now draws on your programme, the academic calendar, your timetable, Canvas and your academic record.</span>
          </p>
          <FinishSetup view={view} size="sm" reason={false} className="w-fit" onFinished={onApplied} />
        </div>
      )}
      </main>
    </div>
  )
}

// ── The page ──────────────────────────────────────────────────────────────

function SetupSurface() {
  const params = useSearchParams()
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [said, setSaid] = useState<Message[]>([])
  const threadRef = useRef<HTMLDivElement>(null)

  // Returns the read, so whatever asked for it can wait for the new view
  // before it tells the student their answer was recorded.
  const load = useCallback(
    () =>
      json<View>('/api/onboarding')
        .then((data) => {
          setView(data)
          setSaid([])
          return data
        })
        .catch((cause: Error) => {
          setError(cause.message)
          return null
        }),
    []
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (params.get('explain') === 'current-courses-record-mismatch') {
      setDraft('My current courses do not match the selected programme because ')
    } else if (params.get('explain') === 'programme-record-mismatch') {
      setDraft('The programme on my academic record differs from my selected programme because ')
    }
  }, [params])

  useEffect(() => {
    const viewport = threadRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: said.length ? 'smooth' : 'auto' })
  }, [view, said, sending])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || sending) return
    setSending(true)
    setError(null)
    setDraft('')
    // Show what was said straight away: a reply takes a few seconds.
    setSaid((previous) => [...previous, { role: 'user', content: message, at: new Date().toISOString() }])
    try {
      const next = await json<View>('/api/onboarding', { method: 'POST', body: JSON.stringify({ message }) })
      setView(next)
      setSaid([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be sent.')
    } finally {
      setSending(false)
    }
  }

  const wantsChecklist = params.get('checklist') === '1'

  if (error && !view) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Setup could not be read</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  // The conversation needs a model. Without one the checklist does the same
  // work, and is the only thing offered rather than a broken composer.
  if (wantsChecklist || (view && !view.available)) {
    return <Checklist view={view} onRefresh={load} onApplied={setView} />
  }

  const messages = [...(view?.messages ?? []), ...said]
  const started = messages.some((message) => message.role === 'user')
  const opening = view?.opening ?? null

  const composer = (placeholder: string) => (
    <form
      className="focus-within:border-primary bg-card flex items-end gap-3 rounded-sm border p-3"
      onSubmit={(event) => {
        event.preventDefault()
        void send(draft)
      }}
    >
      <label className="sr-only" htmlFor="setup-input">
        Your reply
      </label>
      <Textarea
        id="setup-input"
        rows={1}
        value={draft}
        disabled={sending}
        placeholder={placeholder}
        className="max-h-40 min-h-6 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void send(draft)
          }
        }}
      />
      <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Send">
        <SendIcon />
      </Button>
    </form>
  )

  // Not a transcript yet, an invitation: the heading, the body, and the field
  // that answers it, on one screen. The question is whichever thing is
  // actually missing — the server picked it.
  if (view && opening && !started && !sending) {
    const steps = setupSteps({ state: view.state ?? null, skipped: view.skipped ?? [] })
    const connected = connectedCount(steps)
    const openingBody = opening.step === 'record'
      ? 'Your Academic Work PDF lists every course attempt you have made. Upload it below so the dashboard can calculate your earned credits, passed courses, and current registrations.'
      : opening.body
    return (
      <div className="mx-auto grid w-full max-w-[1180px] content-start gap-8 p-6 md:p-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
        <aside className="border-b pb-6 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold">Workspace setup</h2>
            <Link href="/app/setup?checklist=1" className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm text-[12.5px] outline-none hover:underline focus-visible:ring-2 lg:hidden">
              Checklist →
            </Link>
          </div>
          <p className="font-data mt-3 text-[32px] leading-none font-semibold tabular-nums">
            {connected}<span className="text-muted-foreground text-[16px]">/{steps.length}</span>
          </p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">Connect the sources that turn the workspace into your own study record.</p>
          <ol className="mt-6 hidden flex-col border-t lg:flex" aria-label="Setup steps">
            {steps.map((step, index) => (
              <li key={step.id} className="border-b">
                <Link
                  href={`/app/setup?checklist=1&step=${step.id}`}
                  aria-current={step.id === opening.step ? 'step' : undefined}
                  className="hover:bg-card focus-visible:ring-ring/50 -mx-2 grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3 px-2 py-3 transition-colors outline-none focus-visible:ring-2"
                >
                  <span className={`font-data text-[12px] tabular-nums ${step.status === 'done' ? 'text-primary' : 'text-muted-foreground'}`}>
                    {step.status === 'done' ? '✓' : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-sm ${step.id === opening.step ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    <span className="sr-only">{STATUS_WORD[step.status]}. </span>
                    {step.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </aside>

        <main className="flex min-w-0 max-w-[68ch] flex-col gap-6">
          <div className="border-b pb-4">
            <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{opening.heading}</h1>
            {/* Safe to set: the parser escapes first and emits only its own rules. */}
            <div
              className={`text-muted-foreground mt-3 max-w-[60ch] text-[15px] leading-relaxed ${PROSE}`}
              dangerouslySetInnerHTML={{ __html: tutorMarkdown(openingBody) }}
            />
          </div>
          {error && <p className="text-sm">{error}</p>}
          {opening.step === 'record' ? (
            <UploadField
              onRead={async (result) => {
                await send(workSummaryLine(result))
              }}
              onSkip={() => void send('Skip the academic record for now.')}
            />
          ) : opening.step === 'transcript' ? (
            <TranscriptField onApplied={() => void send('I reviewed and imported my Transcript.')} onSkip={() => void send('Skip the transcript for now.')} />
          ) : (
            composer(opening.placeholder)
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <p className="text-muted-foreground max-w-[52ch] text-[12.5px] leading-relaxed">Only your programme is required. Everything else can be connected later.</p>
            <Link href="/app/setup?checklist=1" className="text-primary focus-visible:ring-ring/50 rounded-sm text-sm font-semibold outline-none hover:underline focus-visible:ring-2">
              Use the checklist
            </Link>
          </div>
          {/* The way out, without waiting for the model to offer it. */}
          {view.state?.programme && <FinishSetup view={view} size="sm" reason={false} className="w-fit" onFinished={setView} />}
        </main>
      </div>
    )
  }

  return (
    <div className="mx-auto grid h-[100svh] max-h-[100svh] w-full max-w-[1180px] grid-rows-[auto_minmax(0,1fr)] gap-6 overflow-hidden p-4 sm:p-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-1 lg:gap-10">
      <ConversationStepRail view={view} />
      <section className="flex min-h-0 min-w-0 flex-col">
      <div className="mx-auto flex w-full max-w-[76ch] items-center gap-4 border-b pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading truncate text-[21px] leading-tight font-semibold tracking-[-0.02em]">Let’s make this yours</h1>
          <p className="text-muted-foreground mt-1 truncate text-[13.5px]">Answer what is asked, or connect the sources yourself.</p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" nativeButton={false} render={<Link href="/app/setup?checklist=1" />}>
          Use the checklist
        </Button>
      </div>

      <ScrollArea ref={threadRef} className="min-h-0 flex-1 py-6">
        <div className="flex min-h-full flex-col justify-end gap-6 px-1 pb-3">
        {!view ? (
            <div className="mx-auto flex w-full max-w-[76ch] flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className="mx-auto w-full max-w-[76ch]">
              <Turn message={message} />
            </div>
          ))
        )}

        {sending && (
          <div className="text-muted-foreground mx-auto flex w-full max-w-[76ch] items-center gap-2 text-sm">
            <Spinner className="size-3.5" />
            Working on that…
          </div>
        )}

        {!sending && view?.prompt?.kind === 'upload' && (
          <div className="mx-auto w-full max-w-[76ch]">
            {view.prompt.upload === 'transcript' ? <TranscriptField onApplied={() => void send('I reviewed and imported my Transcript.')} onSkip={() => void send('Skip the transcript for now.')} /> : <UploadField
              onRead={async (result) => {
                await send(workSummaryLine(result))
              }}
              onSkip={() => void send('Skip the academic record for now.')}
            />}
          </div>
        )}

        {!sending && view?.prompt?.kind === 'secure' && (
          <div className="mx-auto w-full max-w-[76ch]">
            <SecureField
              kind={view.prompt.secure}
              onApplied={(next) => {
                setView(next)
                setSaid([])
              }}
              onSkip={() => void send(view.prompt?.kind === 'secure' && view.prompt.secure === 'canvas' ? 'Skip Canvas for now.' : 'Skip the timetable for now.')}
            />
          </div>
        )}

        {view?.finished && (
          <div className="mx-auto flex w-full max-w-[76ch] flex-col gap-4 border-t pt-4">
            <p className="flex items-start gap-2 text-sm">
              <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
              <span>{view.summary || 'Setup is finished.'}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" nativeButton={false} render={<Link href="/app" />}>
                Open my dashboard
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/app/setup?checklist=1" />}>
                Review what is connected
              </Button>
            </div>
          </div>
        )}
        </div>
      </ScrollArea>

      {error && <p role="alert" className="mx-auto w-full max-w-[76ch] text-sm">{error}</p>}
      {!view?.finished && view?.prompt == null && <div className="mx-auto w-full max-w-[76ch] border-t pt-4">{composer('Type your reply…')}</div>}
      {/* Finishing is the student's to take: it does not wait on the model
          deciding the conversation is over. */}
      {!view?.finished && view?.state?.programme && (
        <div className="mx-auto flex w-full max-w-[76ch] flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-3">
          <p className="text-muted-foreground max-w-[52ch] text-[12.5px] leading-relaxed">Your programme is saved, so the workspace is ready whenever you are.</p>
          <FinishSetup view={view} size="sm" reason={false} className="w-fit" onFinished={setView} />
        </div>
      )}
      </section>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 p-5 sm:p-8">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <SetupSurface />
    </Suspense>
  )
}
