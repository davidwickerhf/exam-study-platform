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
  MinusIcon,
  SendIcon,
  ShieldIcon,
  UploadIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { tutorMarkdown } from '@/lib/workspace/markdown.mjs'
import {
  type SetupSourceState,
  type SetupStep,
  connectedCount,
  eventLine,
  isComplete,
  nextStep,
  pdfPageText,
  setupSteps
} from '@/lib/workspace/setup.mjs'

const CANVAS_SETTINGS = 'https://canvas.maastrichtuniversity.nl/profile/settings'
const TIMETABLE_PORTAL = 'https://timetable.maastrichtuniversity.nl/m/#loggedin'
const STUDENT_PORTAL = 'https://studentportal.maastrichtuniversity.nl/group/guest/my-study'
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs'
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

const PROSE =
  '[&>*+*]:mt-3 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5'

type Message = { role: 'user' | 'assistant' | 'event'; content: string; at: string | null }
type Prompt = { kind: 'upload' } | { kind: 'secure'; secure: 'timetable' | 'canvas' }
type Opening = { step: string; heading: string; body: string; placeholder: string }
type ProgrammeOption = { id: string; degree: string; name: string; durationYears: number; versions: { id: string; label: string; status: string }[] }
type ElectiveGroup = { id: string; label: string; chosen: string[]; courses: { id: string; code: string; name: string; ects: number }[] }

type View = {
  available: boolean
  id: string
  name: string | null
  messages: Message[]
  prompt: Prompt | null
  skipped: string[]
  finished: boolean
  summary: string | null
  turns: number
  maxTurns: number
  opening: Opening | null
  state: SetupSourceState
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? `Setup returned ${response.status}`)
  return body as T
}

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
    <div
      className={`bg-paper text-paper-ink [&_a]:text-paper-link [&_code]:bg-paper-subtle rounded-sm px-5 py-4 text-[14.5px] leading-relaxed shadow-lg ${PROSE}`}
      dangerouslySetInnerHTML={{ __html: tutorMarkdown(content) }}
    />
  )
}

function Turn({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[46ch] rounded-sm border px-4 py-2.5 text-[14.5px] leading-relaxed">{message.content}</div>
      </div>
    )
  }
  if (message.role === 'event') {
    // The server's own account of what a credential did. The student did not
    // type it, so it is not drawn as if they had.
    return (
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
        <span>{eventLine(message.content)}</span>
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
        <span className="text-muted-foreground [&_a]:text-primary text-[13px] leading-relaxed [&_a]:underline [&_a]:underline-offset-2">{children}</span>
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

  return (
    <form
      className="flex flex-col gap-4 rounded-sm border p-4"
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
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 size-4"
              checked={collectMaterials}
              onChange={(event) => setCollectMaterials(event.target.checked)}
            />
            <span>
              <strong className="block font-medium">Collect and index my accessible course materials</strong>
              <span className="text-muted-foreground mt-0.5 block">Runs as a background server job after Canvas is connected. You can change or revoke this later.</span>
            </span>
          </label>
          {collectMaterials && (
            <div className="grid gap-2 pl-7 sm:grid-cols-2" role="radiogroup" aria-label="Who may use collected materials">
              {([
                ['private', 'Private', 'Only your Tutor and authorised MCP clients can retrieve them.'],
                ['community', 'Share with the community', 'Other enrolled students may reuse this edition after rights review.']
              ] as const).map(([value, title, detail]) => (
                <label key={value} className={`cursor-pointer rounded-sm border p-3 ${sharingMode === value ? 'border-primary bg-primary/5' : 'hover:bg-card'}`}>
                  <input type="radio" name="canvas-sharing" value={value} checked={sharingMode === value} onChange={() => setSharingMode(value)} className="accent-primary mr-2" />
                  <strong className="text-sm font-medium">{title}</strong>
                  <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{detail}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || !value.trim()}>
          {busy && <Spinner data-icon="inline-start" />}
          {busy ? 'Checking…' : canvas ? 'Connect Canvas' : 'Connect timetable'}
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
    <div className="flex flex-col gap-4 rounded-sm border p-4">
      <RecordGuide />
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="setup-record">Your Academic Work PDF</FieldLabel>
        <Input
          id="setup-record"
          type="file"
          accept="application/pdf,.pdf,.txt"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file || busy) return
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
        <FieldDescription className="flex items-center gap-1.5">
          {busy ? <Spinner className="size-3.5" /> : <UploadIcon className="size-3.5" />}
          {busy ? 'Reading your overview…' : 'Read for its results, then discarded. The file is never stored.'}
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      {onSkip && (
        <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={busy} onClick={onSkip}>
          Skip this
        </Button>
      )}
    </div>
  )
}

// ── The checklist ─────────────────────────────────────────────────────────

function ProgrammeEditor({ current, onSaved }: { current: string | null; onSaved: () => void }) {
  const params = useSearchParams()
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
    event.preventDefault(); if (!customName.trim() || busy) return; setBusy(true); setError(null)
    const now = new Date(); const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
    try { await json('/api/academics/programmes', { method: 'POST', body: JSON.stringify({ profile: { university: institution.trim(), programme: `${degree} ${customName.trim()}`, academicYear: `${start}-${start + 1}`, currentYearKey: `${start}-${start + 1}` } }) }); onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The programme could not be created.') }
    finally { setBusy(false) }
  }}>
    <div className="border-y py-4"><h3 className="font-semibold">Add a personal programme</h3><p className="text-muted-foreground mt-1 text-sm">This creates your private study record immediately. Courses and dates remain empty until you add or import them; it is not presented as a maintained curriculum.</p></div>
    <Field><FieldLabel htmlFor="custom-institution">Institution</FieldLabel><Input id="custom-institution" value={institution} onChange={(event) => setInstitution(event.target.value)} required /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Degree</FieldLabel><Select value={degree} onValueChange={(value) => setDegree(String(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Bachelor of Science">Bachelor of Science</SelectItem><SelectItem value="Bachelor of Arts">Bachelor of Arts</SelectItem><SelectItem value="Master of Science">Master of Science</SelectItem><SelectItem value="Master of Arts">Master of Arts</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></Field><Field><FieldLabel htmlFor="custom-programme">Programme name</FieldLabel><Input id="custom-programme" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Econometrics and Operations Research" required /></Field></div>
    {error && <FieldError>{error}</FieldError>}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || !customName.trim()}>{busy ? 'Creating…' : 'Create personal programme'}</Button><Button type="button" variant="ghost" onClick={() => setCustom(false)}>Back to maintained programmes</Button></div>
  </form>
  return <form className="flex flex-col gap-4" onSubmit={async (event) => {
    event.preventDefault(); if (!programmeId || busy) return; setBusy(true); setError(null)
    try { await json('/api/onboarding/programme', { method: 'PUT', body: JSON.stringify({ programmeId, versionId, studyYear }) }); onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The programme could not be saved.') }
    finally { setBusy(false) }
  }}>
    <Field><FieldLabel>Programme</FieldLabel><Select value={programmeId} onValueChange={(value) => { const id = String(value); setProgrammeId(id); setVersionId(programmes.find((entry) => entry.id === id)?.versions?.[0]?.id ?? '') }}><SelectTrigger className="w-full"><SelectValue placeholder="Choose your programme" /></SelectTrigger><SelectContent><SelectGroup>{programmes.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.degree} {entry.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field><FieldLabel>Curriculum</FieldLabel><Select value={versionId} onValueChange={(value) => setVersionId(String(value))}><SelectTrigger className="w-full"><SelectValue placeholder="Curriculum year" /></SelectTrigger><SelectContent>{(programme?.versions ?? []).map((version) => <SelectItem key={version.id} value={version.id}>{version.label || version.id}{version.status === 'current' ? ' · current' : ''}</SelectItem>)}</SelectContent></Select></Field>
      <Field><FieldLabel>Current study year</FieldLabel><Select value={studyYear} onValueChange={(value) => setStudyYear(String(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: Math.max(1, programme?.durationYears ?? 3) }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>Year {index + 1}</SelectItem>)}</SelectContent></Select></Field>
    </div>
    <FieldDescription>Changing programme preserves attempts already in your personal academic record.</FieldDescription>
    {error && <FieldError>{error}</FieldError>}
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy || !programmeId || !versionId}>{busy && <Spinner data-icon="inline-start" />}{busy ? 'Saving…' : 'Save programme'}</Button><Button type="button" variant="ghost" onClick={() => setCustom(true)}>My programme isn’t listed</Button></div>
  </form>
}

function ElectivesEditor({ onSaved }: { onSaved: () => void }) {
  const [groups, setGroups] = useState<ElectiveGroup[] | null>(null)
  const [chosen, setChosen] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { json<{ groups: ElectiveGroup[] }>('/api/onboarding/electives').then((data) => { setGroups(data.groups); setChosen(Object.fromEntries(data.groups.map((group) => [group.id, group.chosen]))) }).catch((cause: Error) => setError(cause.message)) }, [])
  if (!groups) return error ? <FieldError>{error}</FieldError> : <Skeleton className="h-32 w-full" />
  if (!groups.length) return <p className="text-muted-foreground border-y py-5 text-sm">There are no elective choices for your study year in the active teaching period.</p>
  return <div className="flex flex-col gap-6">{groups.map((group) => <section key={group.id} className="border-y py-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">{group.label}</h3><span className="text-muted-foreground text-xs">{chosen[group.id]?.length ?? 0} selected</span></div><div className="flex flex-col">{group.courses.map((course) => <label key={course.id} className="hover:bg-card flex cursor-pointer items-start gap-3 border-t py-3"><Checkbox checked={chosen[group.id]?.includes(course.id)} onCheckedChange={(checked) => setChosen((held) => ({ ...held, [group.id]: checked ? [...new Set([...(held[group.id] ?? []), course.id])] : (held[group.id] ?? []).filter((id) => id !== course.id) }))} /><span className="flex min-w-0 flex-1 justify-between gap-4 text-sm"><span><strong className="font-data mr-2">{course.code}</strong>{course.name}</span><span className="text-muted-foreground font-data shrink-0">{course.ects} ECTS</span></span></label>)}</div><Button size="sm" className="mt-4" disabled={busy === group.id} onClick={async () => { setBusy(group.id); setError(null); try { await json('/api/onboarding/electives', { method: 'PUT', body: JSON.stringify({ groupId: group.id, courseIds: chosen[group.id] ?? [] }) }); onSaved() } catch (cause) { setError(cause instanceof Error ? cause.message : 'The electives could not be saved.') } finally { setBusy(null) } }}>{busy === group.id ? 'Saving…' : 'Save electives'}</Button></section>)}{error && <FieldError>{error}</FieldError>}</div>
}

const MARKS: Record<SetupStep['status'], React.ReactNode> = {
  done: <CheckIcon className="text-primary size-4" />,
  todo: <span className="border-muted-foreground/60 size-2.5 rounded-xs border" />,
  skipped: <MinusIcon className="text-muted-foreground size-4" />,
  blocked: <span className="text-muted-foreground text-xs">…</span>
}

const STATUS_WORD: Record<SetupStep['status'], string> = {
  done: 'Connected',
  todo: 'Not connected',
  skipped: 'Skipped',
  blocked: 'Waiting'
}

function Checklist({ view, onRefresh, onApplied }: { view: View | null; onRefresh: () => void; onApplied: (view: View) => void }) {
  const params = useSearchParams()
  const requestedStep = params.get('step')
  const [open, setOpen] = useState<string | null>(requestedStep)
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

  return (
    <div className="mx-auto grid min-h-[calc(100svh-3.5rem)] w-full max-w-[1180px] content-center gap-10 p-6 md:p-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
      <aside className="self-stretch border-b pb-6 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <h1 className="text-sm font-semibold">Workspace setup</h1>
          <p className="font-data mt-3 text-4xl leading-none font-semibold tabular-nums">{connected}<span className="text-muted-foreground text-lg">/{steps.length}</span></p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {view ? (
              <>Open any source to review or change it. Only your programme is required.</>
            ) : (
              'Reading your account…'
            )}
          </p>
          {!view ? <div className="mt-7 flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} className="h-16 w-full" />
          ))}
          </div> : <ol className="mt-7 flex flex-col border-t" aria-label="Setup steps">
          {steps.map((step) => {
            const stepIssues = issues.filter((issue) => issue.step === step.id || issue.relatedStep === step.id)
            return (
              <li key={step.id} className="border-b">
                <button type="button" disabled={step.status === 'blocked'} onClick={() => setOpen(step.id)} className="hover:bg-card focus-visible:ring-primary -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 px-2 py-3 text-left outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
                    {stepIssues.length ? <AlertTriangleIcon className="size-4 text-primary" /> : MARKS[step.status]}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="flex items-center gap-2 text-sm font-medium">
                      {step.title}
                      {step.required && <em className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase not-italic">required</em>}
                    </strong>
                    <small className="text-muted-foreground text-[13px]">
                      <span className="sr-only">{STATUS_WORD[step.status]}. </span>
                      {step.detail}
                    </small>
                  </div>
                  <ChevronRightIcon className={`size-4 ${selected?.id === step.id ? 'text-primary' : 'text-muted-foreground'}`} />
                </button>
              </li>
            )
          })}
          </ol>}
      </aside>

      <main className="flex min-w-0 max-w-[68ch] flex-col justify-center gap-5">
        {selected && <>
          <div className="border-primary border-t-2 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-5xl leading-[0.98] font-semibold tracking-[-0.025em] md:text-6xl">{selected.title}</h2>
                <p className="text-muted-foreground mt-4 max-w-[58ch] text-[15px] leading-relaxed">{selected.blurb}</p>
              </div>
              <span className="text-muted-foreground text-xs">{STATUS_WORD[selected.status]}</span>
            </div>
          </div>

          {issues.filter((issue) => issue.step === selected.id || issue.relatedStep === selected.id).map((issue) => (
            <div key={issue.id} role="alert" className="border-primary bg-card flex gap-3 rounded-sm border p-4">
              <AlertTriangleIcon className="text-primary mt-0.5 size-4 shrink-0" />
              <div><strong className="text-sm">{issue.title}</strong><p className="text-muted-foreground mt-1 text-sm">{issue.detail}</p><p className="mt-2 text-sm">{issue.recovery}</p></div>
            </div>
          ))}

          {selected.id === 'record' && <UploadField onRead={() => onRefresh()} />}

          {selected.id === 'timetable' && (
                  <form
                    className="flex flex-col gap-4 rounded-sm border p-4"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      const url = timetable.trim()
                      if (!url || timetableBusy) return
                      setTimetableBusy(true)
                      setTimetableError(null)
                      try {
                        await json('/api/academics/calendars', { method: 'POST', body: JSON.stringify({ url, label: 'University timetable' }) })
                        setTimetable('')
                        onRefresh()
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
                    <Button type="submit" size="sm" className="w-fit" disabled={timetableBusy || !timetable.trim()}>
                      {timetableBusy && <Spinner data-icon="inline-start" />}
                      {timetableBusy ? 'Checking the feed…' : 'Connect timetable'}
                    </Button>
                  </form>
          )}

          {selected.id === 'canvas' && <SecureField kind="canvas" onApplied={onApplied} onSkip={() => {}} />}

          {selected.id === 'programme' && <ProgrammeEditor current={view?.state?.programmeName ?? null} onSaved={onRefresh} />}
          {selected.id === 'electives' && (view?.state?.customProgramme ? <div className="flex flex-col gap-3 border-y py-5"><p className="text-muted-foreground text-sm">This is a personal programme without a maintained curriculum, so there are no predefined elective groups. Add the courses you take directly to your personal plan.</p><Button variant="outline" className="w-fit" nativeButton={false} render={<Link href="/app/planning?tab=courses" />}>Manage my courses</Button></div> : <ElectivesEditor onSaved={onRefresh} />)}
          {selected.id === 'calendar' && <div className="flex flex-col gap-3 border-y py-5"><strong className="font-data text-2xl tabular-nums">{view?.state?.calendarDates ?? 0} maintained dates</strong><p className="text-muted-foreground text-sm">Teaching periods, exam weeks and holidays come from the selected programme’s maintained calendar. Changing the programme updates this source automatically.</p><Button variant="outline" className="w-fit" nativeButton={false} render={<Link href="/app/calendar" />}>Open calendar</Button></div>}
        </>}

      {view && isComplete(steps) && !issues.length && (
        <p className="flex items-start gap-2 text-sm">
          <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
          <span>Everything is connected. Home now draws on your programme, the academic calendar, your timetable, Canvas and your academic record.</span>
        </p>
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

  const load = useCallback(() => {
    json<View>('/api/onboarding')
      .then((data) => {
        setView(data)
        setSaid([])
      })
      .catch((cause: Error) => setError(cause.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
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
      <div className="mx-auto grid min-h-[calc(100svh-3.5rem)] w-full max-w-[1180px] content-center gap-10 p-6 md:p-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
        <aside className="self-stretch border-b pb-6 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">Workspace setup</p>
          <p className="font-data mt-3 text-4xl leading-none font-semibold tabular-nums">
            {connected}<span className="text-muted-foreground text-lg">/{steps.length}</span>
          </p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">Connect the sources that turn the workspace into your own study record.</p>
          <ol className="mt-7 hidden flex-col border-t lg:flex" aria-label="Setup steps">
            {steps.map((step, index) => (
              <li key={step.id} className="border-b">
                <Link
                  href={`/app/setup?checklist=1&step=${step.id}`}
                  aria-current={step.id === opening.step ? 'step' : undefined}
                  className="hover:bg-card focus-visible:ring-primary -mx-2 grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3 px-2 py-3 outline-none focus-visible:ring-2"
                >
                  <span className={`font-data text-xs tabular-nums ${step.status === 'done' ? 'text-primary' : 'text-muted-foreground'}`}>
                    {step.status === 'done' ? '✓' : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-sm ${step.id === opening.step ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{step.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </aside>

        <main className="flex min-w-0 max-w-[68ch] flex-col justify-center gap-5">
          <div className="border-primary border-t-2 pt-6">
            <h1 className="font-heading text-5xl leading-[0.98] font-semibold tracking-[-0.025em] md:text-6xl">{opening.heading}</h1>
            {/* Safe to set: the parser escapes first and emits only its own rules. */}
            <div
              className={`text-muted-foreground mt-5 max-w-[60ch] text-[15px] leading-relaxed ${PROSE}`}
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
          ) : (
            composer(opening.placeholder)
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-muted-foreground text-xs">Only your programme is required. Everything else can be connected later.</p>
            <Link href="/app/setup?checklist=1" className="text-primary text-sm font-semibold hover:underline">
              Use the checklist
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[1180px] flex-col gap-4 p-6">
      <div className="mx-auto flex w-full max-w-[72ch] items-center gap-4 border-b pb-3">
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">Setting up your workspace</h1>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/app/setup?checklist=1" />}>
          Use the checklist
        </Button>
      </div>

      <div ref={threadRef} className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-y-auto">
        {!view ? (
          <div className="mx-auto flex w-full max-w-[72ch] flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className="mx-auto w-full max-w-[72ch]">
              <Turn message={message} />
            </div>
          ))
        )}

        {sending && (
          <div className="text-muted-foreground mx-auto flex w-full max-w-[72ch] items-center gap-2 text-sm">
            <Spinner className="size-3.5" />
            Working on that…
          </div>
        )}

        {!sending && view?.prompt?.kind === 'upload' && (
          <div className="mx-auto w-full max-w-[72ch]">
            <UploadField
              onRead={async (result) => {
                await send(workSummaryLine(result))
              }}
              onSkip={() => void send('Skip the academic record for now.')}
            />
          </div>
        )}

        {!sending && view?.prompt?.kind === 'secure' && (
          <div className="mx-auto w-full max-w-[72ch]">
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
          <div className="mx-auto flex w-full max-w-[72ch] flex-col gap-4 border-t pt-4">
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

      {error && <p className="mx-auto w-full max-w-[72ch] text-sm">{error}</p>}
      {!view?.finished && <div className="mx-auto w-full max-w-[72ch]">{composer('Type your reply…')}</div>}
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
