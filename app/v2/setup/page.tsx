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
 * Assistant turns are Markdown, parsed by lib/v2/markdown.mjs — the same
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
  ExternalLinkIcon,
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
import { tutorMarkdown } from '@/lib/v2/markdown.mjs'
import {
  type SetupSourceState,
  type SetupStep,
  connectedCount,
  eventLine,
  isComplete,
  nextStep,
  pdfPageText,
  setupSteps
} from '@/lib/v2/setup.mjs'

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
          const view = await json<View>('/api/onboarding/secure', { method: 'POST', body: JSON.stringify({ kind, value: secret }) })
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

function Checklist({ view, onRefresh, conversational }: { view: View | null; onRefresh: () => void; conversational: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const [timetable, setTimetable] = useState('')
  const [timetableBusy, setTimetableBusy] = useState(false)
  const [timetableError, setTimetableError] = useState<string | null>(null)
  const steps = setupSteps({ state: view?.state ?? null, skipped: view?.skipped ?? [] })
  const connected = connectedCount(steps)
  const next = nextStep(steps)

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[62ch] flex-col gap-1">
          <h1 className="font-heading text-5xl leading-none tracking-tight">What Wicker Study knows about you</h1>
          <p className="text-muted-foreground text-sm">
            {view ? (
              <>
                <span className="font-data tabular-nums">{connected}</span> of <span className="font-data tabular-nums">{steps.length}</span> sources connected. Only your programme is
                required — the rest can be added whenever you like, in any order.
              </>
            ) : (
              'Reading your account…'
            )}
          </p>
        </div>
        {conversational && (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/v2/setup" />}>
            Set up by conversation
          </Button>
        )}
      </header>

      {!view ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <ol className="flex flex-col">
          {steps.map((step) => {
            const expandable = step.status !== 'done' && step.status !== 'blocked' && (step.id === 'record' || step.id === 'timetable')
            return (
              <li key={step.id} className="flex flex-col gap-4 border-b py-4 first:border-t">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
                    {MARKS[step.status]}
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
                  {step.status === 'done' ? (
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={step.href} />}>
                      Review
                    </Button>
                  ) : step.status === 'blocked' ? null : expandable ? (
                    <Button
                      variant={open === step.id ? 'outline' : step.id === next?.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOpen(open === step.id ? null : step.id)}
                    >
                      {open === step.id ? 'Close' : step.action}
                    </Button>
                  ) : (
                    <Button variant={step.id === next?.id ? 'default' : 'outline'} size="sm" nativeButton={false} render={<Link href={step.href} />}>
                      {step.action}
                      <ExternalLinkIcon data-icon="inline-end" />
                    </Button>
                  )}
                </div>

                {open === step.id && step.id === 'record' && <UploadField onRead={() => onRefresh()} />}

                {open === step.id && step.id === 'timetable' && (
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
                        setOpen(null)
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
              </li>
            )
          })}
        </ol>
      )}

      {view && isComplete(steps) && (
        <p className="flex items-start gap-2 text-sm">
          <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
          <span>Everything is connected. Home now draws on your programme, the academic calendar, your timetable, Canvas and your academic record.</span>
        </p>
      )}
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
      <div className="mx-auto w-full max-w-[1180px] p-8">
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
    return <Checklist view={view} onRefresh={load} conversational={Boolean(view?.available)} />
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
    return (
      <div className="mx-auto grid min-h-[calc(100svh-3.5rem)] w-full max-w-[1180px] content-center gap-10 p-6 md:p-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
        <aside className="self-stretch border-b pb-6 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">Workspace setup</p>
          <p className="font-data mt-3 text-4xl leading-none font-semibold tabular-nums">
            {connected}<span className="text-muted-foreground text-lg">/{steps.length}</span>
          </p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">Connect the sources that turn the workspace into your own study record.</p>
          <ol className="mt-7 hidden flex-col border-t lg:flex">
            {steps.map((step, index) => (
              <li key={step.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3 border-b py-3">
                <span className={`font-data text-xs tabular-nums ${step.status === 'done' ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.status === 'done' ? '✓' : String(index + 1).padStart(2, '0')}
                </span>
                <span className={`text-sm ${step.id === opening.step ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{step.title}</span>
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
              dangerouslySetInnerHTML={{ __html: tutorMarkdown(opening.body) }}
            />
          </div>
          {error && <p className="text-sm">{error}</p>}
          {composer(opening.placeholder)}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-muted-foreground text-xs">Only your programme is required. Everything else can be connected later.</p>
            <Link href="/v2/setup?checklist=1" className="text-primary text-sm font-semibold hover:underline">
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
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/v2/setup?checklist=1" />}>
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
              <Button size="sm" nativeButton={false} render={<Link href="/v2" />}>
                Open my dashboard
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/v2/setup?checklist=1" />}>
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
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 p-8">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <SetupSurface />
    </Suspense>
  )
}
