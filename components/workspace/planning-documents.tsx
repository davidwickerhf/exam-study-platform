'use client'

/**
 * Documents — supporting files at any time, read into a change set the student
 * ticks through.
 *
 * The whole feature is the consent step. The reader proposes; the plan only
 * moves when a proposal is ticked and applied, and the review says out loud
 * which proposals disagree with what is already recorded. Every rule about
 * what a tick means lives in lib/app/documents.mjs and is tested there; this
 * file is the surface.
 *
 * A file never leaves the browser. PDFs are extracted to text (and, when a
 * page has no text layer, a rendered image) here, and only that extraction is
 * posted. The originals carry a full grade history and a student number, and
 * the product's position is that uploads are read, not retained.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarIcon,
  CheckIcon,
  FileTextIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon
} from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { Workspace } from '@/lib/workspace/academics.mjs'
import {
  type Change,
  type ChangeSet,
  type SourceFile,
  CHANGE_STATUS_LABEL,
  DOCUMENT_KINDS,
  MAX_DESCRIPTION,
  MAX_SOURCES,
  MAX_SOURCE_BYTES,
  analysisRequests,
  changeDiff,
  changeStatus,
  defaultSelection,
  describeSource,
  groupChanges,
  mergeAnalysisResults,
  needsDecision,
  reconciliationSummary,
  selectAll,
  selectedChanges,
  selectionSummary,
  toggleChange
} from '@/lib/workspace/documents.mjs'
import { localIsoDate } from '@/lib/workspace/home.mjs'

const NUMERALS = 'font-data tabular-nums'

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs'
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs'

type AcademicState = { index: unknown; workspace: Workspace; summary: unknown }

type WorkSnapshot = { id: string; sourceLabel: string | null; printedOn: string | null; createdAt: string; summary: WorkSummary | null }
type WorkSummary = { earnedEcts: number; passedCourses: number; failedAttempts: number; currentCourses: number; weightedAverage: number | null }
type WorkRecord = { snapshots: WorkSnapshot[]; latest: WorkSnapshot | null; since: { ectsDelta: number; passedDelta: number; newlyPassed: { code: string }[] } | null }
type WorkUpload = { unchanged: boolean; summary: WorkSummary; progress: WorkRecord['since'] }

// ── Talking to the server ────────────────────────────────────────────────
// Failures surface with the message the server actually sent; a document
// reader that swallows an error is a document reader that lies about a plan.

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers }
  })
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(data?.error || `That request answered ${response.status}.`)
  return data as T
}

// ── Reading a file in the browser ────────────────────────────────────────

type PdfLibrary = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (options: { data: Uint8Array }) => { promise: Promise<PdfDocument> }
}
type PdfDocument = { numPages: number; getPage: (page: number) => Promise<PdfPage> }
type PdfPage = {
  getTextContent: () => Promise<{ items: { str?: string; transform?: number[]; width?: number }[] }>
  getViewport: (options: { scale: number }) => { width: number; height: number }
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> }
}

let pdfLibrary: Promise<PdfLibrary> | null = null

function loadPdfLibrary() {
  pdfLibrary ??= (import(/* webpackIgnore: true */ PDFJS) as Promise<unknown>)
    .then((module) => {
      const library = module as PdfLibrary
      library.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
      return library
    })
    .catch((cause: Error) => {
      pdfLibrary = null
      throw new Error(`The PDF reader could not be loaded (${cause.message}). Paste the text instead, or export the document as .txt.`)
    })
  return pdfLibrary
}

/**
 * Text out of a PDF, laid out by position rather than by reading order. A
 * transcript is a table, and a wide horizontal gap between two runs is a
 * column boundary — collapsing that to a space glues a grade onto a course
 * code, which the parser then reads as neither.
 */
async function extractPdf(file: File): Promise<Omit<SourceFile, 'name' | 'type' | 'size'>> {
  const library = await loadPdfLibrary()
  const pdf = await library.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  const images: string[] = []
  const limit = Math.min(pdf.numPages, 30)
  for (let number = 1; number <= limit; number += 1) {
    const page = await pdf.getPage(number)
    const content = await page.getTextContent()
    const rows: { y: number; items: { x: number; end: number; text: string }[] }[] = []
    for (const item of content.items) {
      const text = String(item.str ?? '').trim()
      if (!text) continue
      const x = Number(item.transform?.[4]) || 0
      const y = Number(item.transform?.[5]) || 0
      let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2)
      if (!row) { row = { y, items: [] }; rows.push(row) }
      row.items.push({ x, end: x + (Number(item.width) || 0), text })
    }
    const pageText = rows
      .sort((left, right) => right.y - left.y)
      .map((row) => {
        let end = 0
        return row.items
          .sort((left, right) => left.x - right.x)
          .map((item, index) => {
            const separator = index && item.x - end > 10 ? '\t' : index ? ' ' : ''
            end = Math.max(end, item.end)
            return `${separator}${item.text}`
          })
          .join('')
      })
      .join('\n')
      .trim()
    if (pageText) pages.push(`Page ${number}\n${pageText}`)
    // A scan has no text layer, so those pages are sent as images instead.
    const visualLimit = pageText.length < 80 ? 4 : 2
    if (images.length < visualLimit) {
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(1.6, 1500 / Math.max(1, base.width)) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (context) {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: context, viewport }).promise
        images.push(canvas.toDataURL('image/jpeg', 0.72))
      }
    }
  }
  return { text: pages.join('\n\n').slice(0, 120_000), images, pageCount: pdf.numPages }
}

async function shrinkImage(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error(`${file.name} could not be read in this browser.`)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', 0.76)
}

async function readSource(file: File): Promise<SourceFile> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name} is larger than 15 MB.`)
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return { name: file.name, type: 'application/pdf', size: file.size, ...(await extractPdf(file)) }
  }
  if (file.type.startsWith('image/')) {
    return { name: file.name, type: file.type, size: file.size, text: '', images: [await shrinkImage(file)], pageCount: 1 }
  }
  if (file.type.startsWith('text/') || /\.(txt|csv|ics)$/i.test(file.name)) {
    return { name: file.name, type: file.type || 'text/plain', size: file.size, text: (await file.text()).slice(0, 120_000), images: [], pageCount: 0 }
  }
  throw new Error(`${file.name} is not a supported PDF, image, or text file.`)
}

// ── Small pieces ─────────────────────────────────────────────────────────

function SectionHead({ title, note, children }: { title: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="-mx-6 flex flex-wrap items-end justify-between gap-3 border-b px-6 pb-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <p className="text-muted-foreground max-w-prose text-xs">{note}</p>}
      </div>
      {children}
    </div>
  )
}

function Failure({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>That did not work</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function academicDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const at = new Date(iso.length > 10 ? iso : `${iso}T00:00:00`)
  return Number.isNaN(at.getTime()) ? iso : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(at)
}

function FeedSummary({ result, connected }: { result: ChangeSet; connected: boolean }) {
  const summary = result.feedSummary
  if (!summary) return null
  const unselected = result.reconciliation?.unselected ?? []
  const range = summary.rangeStart
    ? `${academicDate(summary.rangeStart)}${summary.rangeEnd && summary.rangeEnd !== summary.rangeStart ? ` – ${academicDate(summary.rangeEnd)}` : ''}`
    : 'No dated appointments'
  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <p className="text-muted-foreground text-xs">
        {connected
          ? `Connected. Appointments stay in the feed and refresh every ${summary.refreshIntervalMinutes ?? 15} minutes while you use Calendar — nothing is copied into your academic record.`
          : 'Nothing has been connected yet. This is what the feed contains.'}
      </p>
      <dl className="flex flex-wrap gap-8">
        {[
          ['Appointments', String(summary.eventCount)],
          ['Date range', range],
          ['Course match', summary.matchedCourseCount ? `${summary.matchedCourseCount} selected course${summary.matchedCourseCount === 1 ? '' : 's'}` : 'No selected courses found']
        ].map(([term, value]) => (
          <div key={term} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">{term}</dt>
            <dd className={`text-sm font-medium ${NUMERALS}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {unselected.length > 0 && (
        <p className="text-muted-foreground text-xs">
          <strong className="text-foreground font-semibold">
            {unselected.length} course code{unselected.length === 1 ? '' : 's'} in this feed {unselected.length === 1 ? 'is' : 'are'} not in your plan
          </strong>{' '}
          — {unselected.slice(0, 8).map((item) => item.code || item.name).join(', ')}
          {unselected.length > 8 ? ` and ${unselected.length - 8} more` : ''}. Their appointments stay visible, but a feed never changes your course choices.
        </p>
      )}
    </div>
  )
}

// ── The review ───────────────────────────────────────────────────────────

function CrossCheck({ result }: { result: ChangeSet }) {
  const summary = reconciliationSummary(result)
  if (!summary) return null
  if (summary.status === 'aligned') {
    return (
      <Alert>
        <CheckIcon />
        <AlertTitle>Course cross-check complete</AlertTitle>
        <AlertDescription>
          All {summary.matched.length} course reference{summary.matched.length === 1 ? '' : 's'} in this source match courses you have selected.
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>{summary.currentEnrollment ? 'Current enrolment found' : 'Course cross-check needs review'}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span className={NUMERALS}>
          {summary.matched.length} matched · {summary.issueCount} to review. Your plan does not change until you tick a proposal below.
        </span>
        {summary.unselected.length > 0 && (
          <span className="flex flex-col gap-0.5">
            <strong className="text-foreground text-xs font-semibold tracking-[0.11em] uppercase">
              {summary.currentEnrollment ? 'Listed as current' : 'Found here, not in your plan'}
            </strong>
            <span className={NUMERALS}>{summary.unselected.map((item) => item.code || item.name).join(' · ')}</span>
          </span>
        )}
        {summary.missing.length > 0 && (
          <span className="flex flex-col gap-0.5">
            <strong className="text-foreground text-xs font-semibold tracking-[0.11em] uppercase">In your plan, not in this source</strong>
            <span className={NUMERALS}>{summary.missing.map((item) => item.code || item.name).join(' · ')}</span>
            <span>Nothing is removed: a transcript or timetable may cover only part of a programme.</span>
          </span>
        )}
        {summary.conflicts.length > 0 && (
          <span className="flex flex-col gap-0.5">
            <strong className="text-foreground text-xs font-semibold tracking-[0.11em] uppercase">Facts that disagree</strong>
            <span>
              {summary.conflicts.length} proposal{summary.conflicts.length === 1 ? '' : 's'} would overwrite something already recorded. They start unticked, so the plan wins unless you say otherwise.
            </span>
          </span>
        )}
      </AlertDescription>
    </Alert>
  )
}

const ROW = 'grid grid-cols-[auto_4.25rem_minmax(0,1fr)] items-start gap-x-3'
const COLUMN_LABEL = 'text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase'

/**
 * One proposal, as a ruled row the student ticks.
 *
 * The status column is the whole point of a review step: NEW adds something,
 * MATCH touches a record already in the plan, CONFLICT would overwrite a
 * recorded fact — and a conflict shows both values rather than describing the
 * disagreement in a sentence.
 */
function ChangeRow({ change, checked, onToggle }: { change: Change; checked: boolean; onToggle: (checked: boolean) => void }) {
  const status = changeStatus(change)
  const diff = status === 'conflict' ? changeDiff(change) : null
  return (
    <li className="border-b last:border-b-0">
      <Label className={`${ROW} hover:bg-card cursor-pointer py-2.5 font-normal transition-colors`}>
        <Checkbox checked={checked} onCheckedChange={(value) => onToggle(value === true)} className="mt-1" />
        <span className={`${COLUMN_LABEL} mt-1.5 ${status === 'conflict' ? 'text-foreground' : ''}`}>
          {CHANGE_STATUS_LABEL[status]}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <strong className="text-[15px] leading-snug font-medium">{change.label}</strong>
          {diff ? (
            <span className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs ${NUMERALS}`}>
              <span className="text-muted-foreground">In your plan</span>
              <span className="line-through">{diff.current}</span>
              <span aria-hidden className="text-muted-foreground">→</span>
              <span className="text-muted-foreground">{diff.source}</span>
              <span className="font-semibold">{diff.proposed}</span>
            </span>
          ) : (
            change.detail && <small className={`text-muted-foreground text-xs ${NUMERALS}`}>{change.detail}</small>
          )}
          {needsDecision(change) && (
            <small className="text-xs font-semibold">Your recorded fact wins unless you tick this.</small>
          )}
        </span>
      </Label>
    </li>
  )
}

function Review({
  result,
  selected,
  applying,
  error,
  onToggle,
  onSelectAll,
  onApply,
  onDiscard
}: {
  result: ChangeSet
  selected: Set<string>
  applying: boolean
  error: string | null
  onToggle: (id: string, checked: boolean) => void
  onSelectAll: () => void
  onApply: () => void
  onDiscard: () => void
}) {
  const groups = groupChanges(result.changes)
  const counts = selectionSummary(result.changes, selected)
  const sources = result.sources?.map((source) => source.name).filter(Boolean).join(', ') || result.link?.label || result.sourceLabel || 'your sources'
  const kindLabel = DOCUMENT_KINDS.find(([id]) => id === result.kind)?.[1]

  return (
    <div className="flex flex-col gap-5">
      <SectionHead
        title="Review proposed changes"
        note={`${result.changes.length} proposed from ${sources}${kindLabel && result.kind !== 'auto' ? ` · read as ${kindLabel.toLowerCase()}` : ''}. ${result.usedAi === false ? 'Extracted with the plain text parser rather than the reader, so check each line.' : 'Nothing is written until you apply.'}`}
      >
        <Button variant="ghost" size="sm" onClick={onDiscard}>Discard</Button>
      </SectionHead>

      <CrossCheck result={result} />

      {result.feedSummary && <FeedSummary result={result} connected={false} />}

      {result.warnings && result.warnings.length > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Notes from the reader</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {!result.changes.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nothing new to apply</EmptyTitle>
            <EmptyDescription>
              Everything in {result.kind === 'calendar-feed' ? 'this calendar' : 'this source'} is already in your plan
              {result.warnings?.length ? ', but see the notes above' : ''}.
            </EmptyDescription>
          </EmptyHeader>
          {result.kind !== 'calendar-feed' && (
            <Button onClick={onApply} disabled={applying}>
              {applying ? 'Saving…' : 'Save as a dated version'}
            </Button>
          )}
          {error && <Failure message={error} />}
        </Empty>
      ) : (
        <>
          <Accordion defaultValue={groups.filter((group) => group.defaultOpen).map((group) => group.kind)}>
            {groups.map((group) => {
              const ticked = group.changes.filter((change) => selected.has(change.id)).length
              return (
                <AccordionItem key={group.kind} value={group.kind}>
                  <AccordionTrigger>
                    <span className="flex flex-1 items-baseline gap-3 pr-3">
                      <span>{group.label}</span>
                      {group.decisions > 0 && <Badge variant="default">{group.decisions} to decide</Badge>}
                      <span className={`text-muted-foreground ml-auto text-xs ${NUMERALS}`}>{ticked} of {group.changes.length} ticked</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className={`${ROW} border-b pb-1.5`}>
                      <span className="size-4" aria-hidden />
                      <span className={COLUMN_LABEL}>Status</span>
                      <span className={COLUMN_LABEL}>Proposal</span>
                    </div>
                    <ul className="flex flex-col">
                      {group.changes.map((change) => (
                        <ChangeRow
                          key={change.id}
                          change={change}
                          checked={selected.has(change.id)}
                          onToggle={(checked) => onToggle(change.id, checked)}
                        />
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>

          {error && <Failure message={error} />}

          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button variant="secondary" size="sm" onClick={onSelectAll}>
              {counts.selected === counts.total ? 'Clear all' : 'Tick all'}
            </Button>
            <p className={`text-muted-foreground flex-1 text-sm ${NUMERALS}`}>
              {counts.applying} of {counts.total} will be applied
              {counts.decisionsSelected > 0 && ` · ${counts.decisionsSelected} overwrite${counts.decisionsSelected === 1 ? 's' : ''} something you already have`}
              {counts.blocked > 0 && ` · ${counts.blocked} waiting on a course you have not ticked`}
            </p>
            <Button onClick={onApply} disabled={!counts.applying || applying}>
              {applying ? 'Applying…' : `Apply ${counts.applying} selected change${counts.applying === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ── The tab ──────────────────────────────────────────────────────────────

export function PlanningDocuments({
  workspace,
  onWorkspace,
  showConnections = true,
  showAcademicRecord = true,
  showAcademicRecordSummary = true,
  focusedKind,
  onRecorded
}: {
  workspace: Workspace
  onWorkspace: (state: AcademicState) => void
  showConnections?: boolean
  showAcademicRecord?: boolean
  showAcademicRecordSummary?: boolean
  focusedKind?: string
  onRecorded?: () => void
}) {
  const [files, setFiles] = useState<SourceFile[]>([])
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState(focusedKind && focusedKind !== 'academic-work' ? focusedKind : 'auto')
  const [reading, setReading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ChangeSet | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<number | null>(null)
  const [recorded, setRecorded] = useState<'saved' | 'unchanged' | null>(null)
  const [dragging, setDragging] = useState(false)

  const [calendarUrl, setCalendarUrl] = useState('')
  const [calendarLabel, setCalendarLabel] = useState('')
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null)
  const [calendarPreview, setCalendarPreview] = useState<{ set: ChangeSet; connected: boolean } | null>(null)

  const [work, setWork] = useState<WorkRecord | null>(null)
  const [workError, setWorkError] = useState<string | null>(null)
  const [workUploading, setWorkUploading] = useState(false)
  const [workResult, setWorkResult] = useState<WorkUpload | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const workInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setKind(focusedKind && focusedKind !== 'academic-work' ? focusedKind : 'auto')
  }, [focusedKind])

  useEffect(() => {
    let live = true
    api<WorkRecord>('/api/academics/work')
      .then((data) => { if (live) setWork(data) })
      .catch((cause: Error) => { if (live) setWorkError(cause.message) })
    return () => { live = false }
  }, [])

  const addFiles = useCallback(async (list: FileList | null) => {
    const chosen = [...(list ?? [])]
    if (!chosen.length) return
    const room = MAX_SOURCES - files.length
    if (room <= 0) { setError(`You can add up to ${MAX_SOURCES} files at once.`); return }
    setReading(true)
    setError(null)
    const added: SourceFile[] = []
    const failures: string[] = []
    for (const file of chosen.slice(0, room)) {
      try { added.push(await readSource(file)) } catch (cause) { failures.push((cause as Error).message) }
    }
    setFiles((current) => [...current, ...added])
    setReading(false)
    setError(failures.length ? failures.join(' ') : chosen.length > room ? `Only the first ${room} file${room === 1 ? '' : 's'} were added; ${MAX_SOURCES} is the limit for one read.` : null)
  }, [files.length])

  const analyse = useCallback(async () => {
    setAnalysing(true)
    setError(null)
    try {
      // Which endpoint reads which file, and in which order the answers fold
      // together, is decided in lib/workspace/documents.mjs and tested there.
      // This function only posts what it is handed.
      const requests = analysisRequests(files, { kind, description, date: localIsoDate(new Date()) })
      if (!requests.length) throw new Error('Add a file, or describe what changed, before reading.')
      const answers: { result: ChangeSet; source: { name?: string } | null }[] = []
      for (const request of requests) {
        answers.push({
          result: await api<ChangeSet>(request.path, { method: 'POST', body: JSON.stringify(request.body) }),
          source: request.source
        })
      }
      const next = mergeAnalysisResults(answers)
      if (!next) throw new Error('Add a file, or describe what changed, before reading.')
      setResult(next)
      setSelected(defaultSelection(next.changes))
      setApplied(null)
      setRecorded(null)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setAnalysing(false)
    }
  }, [files, description, kind])

  const apply = useCallback(async () => {
    if (!result) return
    const changes = selectedChanges(result.changes, selected)
    const hasSource = Boolean(files.length || description.trim())
    if (!changes.length && !hasSource) return
    setApplying(true)
    setError(null)
    try {
      let documentRecord: Record<string, unknown> | undefined
      if (hasSource) {
        const payload = JSON.stringify(files.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          text: file.text,
          images: file.images
        }))) + description
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
        const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
        documentRecord = {
          kind: result.kind || kind,
          label: files.map((file) => file.name).join(', ') || 'Supplied description',
          fingerprint,
          sources: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
          impact: { proposed: result.changes.length, selected: changes.length, warnings: result.warnings?.length ?? 0 }
        }
      }
      const saved = await api<AcademicState & { applied: string[]; documentRecord?: { unchanged?: boolean } | null; documentRecordError?: string | null }>('/api/academics/documents/apply', {
        method: 'POST',
        body: JSON.stringify({ changes, expectedRevision: workspace.revision, documentRecord })
      })
      onWorkspace(saved)
      if (hasSource && !saved.documentRecordError) onRecorded?.()
      setFiles([])
      setDescription('')
      setResult(null)
      setSelected(new Set())
      // Report what the server says it applied, not what was ticked: a
      // proposal can be a no-op by the time it is submitted.
      setApplied(saved.applied?.length ?? 0)
      setRecorded(hasSource && !saved.documentRecordError ? (saved.documentRecord?.unchanged ? 'unchanged' : 'saved') : null)
      setError(saved.documentRecordError ? `The plan was updated, but this reading could not be added to version history. ${saved.documentRecordError}` : null)
    } catch (cause) {
      const message = (cause as Error).message
      setError(/another tab/.test(message) ? 'Your plan changed somewhere else. Reload the page and read the document again.' : message)
    } finally {
      setApplying(false)
    }
  }, [result, selected, workspace.revision, onWorkspace, files, description, kind, onRecorded])

  const calendarRequest = useCallback(async (path: string, body: object | null, action: 'preview' | 'connect' | 'sync' | 'remove') => {
    setCalendarBusy(true)
    setCalendarError(null)
    setCalendarNotice(null)
    try {
      const response = await api<AcademicState & { link?: { label: string }; changeSet?: ChangeSet; feedSummary?: unknown }>(path, {
        method: body === null ? 'DELETE' : 'POST',
        ...(body === null ? {} : { body: JSON.stringify({ ...body, date: localIsoDate(new Date()) }) })
      })
      if (response.workspace) onWorkspace(response)
      if (action === 'preview') {
        setCalendarPreview({ set: response as unknown as ChangeSet, connected: false })
      } else if (action === 'remove') {
        setCalendarPreview(null)
        setCalendarNotice('Calendar connection removed. Its appointments no longer appear in Calendar.')
      } else if (response.changeSet) {
        setCalendarPreview({ set: response.changeSet, connected: true })
        setCalendarNotice(action === 'sync'
          ? `${response.link?.label ?? 'Calendar'} is up to date.`
          : `${response.link?.label ?? 'Calendar'} is connected and will keep updating on its own.`)
        if (action === 'connect') { setCalendarUrl(''); setCalendarLabel('') }
      }
    } catch (cause) {
      setCalendarError((cause as Error).message)
    } finally {
      setCalendarBusy(false)
    }
  }, [onWorkspace])

  const uploadWork = useCallback(async (file: File | null) => {
    if (!file) return
    setWorkUploading(true)
    setWorkError(null)
    setWorkResult(null)
    try {
      const source = await readSource(file)
      if (!source.text.trim()) throw new Error('No text could be read from that file. Print the overview from the student portal rather than photographing it.')
      setWorkResult(await api<WorkUpload>('/api/academics/work', {
        method: 'POST',
        body: JSON.stringify({ documents: [{ name: file.name, text: source.text }] })
      }))
      setWork(await api<WorkRecord>('/api/academics/work'))
      onRecorded?.()
    } catch (cause) {
      setWorkError((cause as Error).message)
    } finally {
      setWorkUploading(false)
    }
  }, [onRecorded])

  const calendars = workspace.calendars ?? []
  const canAnalyse = !reading && !analysing && (files.length > 0 || description.trim().length > 0)

  if (result) {
    return (
      <Review
        result={result}
        selected={selected}
        applying={applying}
        error={error}
        onToggle={(id, checked) => setSelected((current) => toggleChange(result.changes, current, id, checked))}
        onSelectAll={() => setSelected((current) => (current.size === result.changes.length ? new Set<string>() : selectAll(result.changes)))}
        onApply={apply}
        onDiscard={() => { setResult(null); setSelected(new Set()); setError(null) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {applied !== null && (
        <Alert>
          <CheckIcon />
          <AlertTitle>
            {recorded === 'unchanged'
              ? 'This exact document version was already saved.'
              : recorded === 'saved' && applied === 0
                ? 'Document version saved. Your plan was already up to date.'
                : `${applied} change${applied === 1 ? '' : 's'} applied to your plan.`}
          </AlertTitle>
          <AlertDescription>
            {recorded === 'unchanged'
              ? applied === 0
                ? 'No duplicate version was created and your plan was not changed.'
                : `${applied} plan change${applied === 1 ? ' was' : 's were'} applied, but no duplicate history entry was created.`
              : 'Everything you left unticked was discarded and nothing else was touched.'}
          </AlertDescription>
        </Alert>
      )}

      {focusedKind !== 'academic-work' && <section className="flex flex-col gap-4">
        <SectionHead
          title="Read a document"
          note="A transcript, exam schedule, timetable, academic calendar or .ics file. It is read in this browser, proposed as a list of changes, and never stored."
        />

        <label
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={(event) => { event.preventDefault(); setDragging(false) }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); if (!reading && !analysing) void addFiles(event.dataTransfer?.files ?? null) }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-dashed p-8 text-center transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-progress has-[:disabled]:opacity-60 ${dragging ? 'border-primary bg-card' : 'hover:bg-card'}`}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.ics,application/pdf,image/*,text/plain,text/csv,text/calendar"
            disabled={reading || analysing}
            onChange={(event) => { void addFiles(event.target.files); event.target.value = '' }}
            className="sr-only"
          />
          <UploadIcon className="text-muted-foreground size-5" />
          <strong className="text-[15px] font-medium">{reading ? 'Reading your files…' : 'Drop files here, or choose from your device'}</strong>
          <small className={`text-muted-foreground text-xs ${NUMERALS}`}>Up to {MAX_SOURCES} files · PDF, JPG, PNG, TXT, CSV, ICS</small>
        </label>

        {files.length > 0 && (
          <ul className="flex flex-col">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-3 border-b py-2">
                <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-sm font-medium">{file.name}</strong>
                  <small className={`text-muted-foreground text-xs ${NUMERALS}`}>{describeSource(file)}</small>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-[240px] flex-col gap-1.5">
            <Label htmlFor="document-kind">What is it?</Label>
            <Select value={kind} disabled={Boolean(focusedKind)} onValueChange={(value) => setKind((value as string | null) ?? 'auto')}>
              <SelectTrigger id="document-kind" className="w-[280px]">
                <SelectValue>{(value) => DOCUMENT_KINDS.find(([id]) => id === value)?.[1] ?? 'Detect automatically'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DOCUMENT_KINDS.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
            <Label htmlFor="document-description">Anything to add (optional)</Label>
            <Textarea
              id="document-description"
              rows={2}
              maxLength={MAX_DESCRIPTION}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. This is my 2025–2026 transcript; grades are out of 10."
            />
          </div>
        </div>

        {error && <Failure message={error} />}

        <div className="flex justify-end">
          <Button onClick={analyse} disabled={!canAnalyse}>
            <SparklesIcon data-icon="inline-start" />
            {analysing ? 'Reading…' : 'Read and propose updates'}
          </Button>
        </div>
      </section>}

      {showConnections && <section className="flex flex-col gap-4">
        <SectionHead
          title="Calendar connections"
          note="A timetable or exam-schedule feed stays live: its appointments are read from the feed every 15 minutes and are never copied into your academic record."
        />

        {calendarNotice && (
          <Alert>
            <CheckIcon />
            <AlertDescription>{calendarNotice}</AlertDescription>
          </Alert>
        )}

        {calendars.length ? (
          <ul className="flex flex-col">
            {calendars.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center gap-3 border-b py-2">
                <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-[15px] font-medium">{link.label}</strong>
                  <small className={`text-muted-foreground text-xs ${NUMERALS}`}>
                    {link.eventCount} appointment{link.eventCount === 1 ? '' : 's'}
                    {link.unselectedCourseCount ? ` · ${link.unselectedCourseCount} outside your plan` : ''}
                    {link.lastSyncedAt ? ` · checked ${academicDate(link.lastSyncedAt)}` : ' · not checked yet'}
                  </small>
                </span>
                <Button variant="secondary" size="sm" disabled={calendarBusy} onClick={() => calendarRequest(`/api/academics/calendars/${encodeURIComponent(link.id)}/sync`, {}, 'sync')}>
                  <RefreshCwIcon data-icon="inline-start" />
                  Sync
                </Button>
                <Button variant="ghost" size="sm" disabled={calendarBusy} onClick={() => calendarRequest(`/api/academics/calendars/${encodeURIComponent(link.id)}`, null, 'remove')}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No calendar feeds are connected, so no timetable appointments are shown anywhere in Wicker Study.</p>
        )}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => { event.preventDefault(); if (calendarUrl.trim()) calendarRequest('/api/academics/calendars', { url: calendarUrl.trim(), label: calendarLabel.trim() }, 'connect') }}
        >
          <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
            <Label htmlFor="calendar-url">Feed URL</Label>
            <Input id="calendar-url" type="url" required placeholder="https://… or webcal://…" value={calendarUrl} disabled={calendarBusy} onChange={(event) => setCalendarUrl(event.target.value)} />
          </div>
          <div className="flex min-w-[180px] flex-col gap-1.5">
            <Label htmlFor="calendar-label">Name</Label>
            <Input id="calendar-label" maxLength={120} placeholder="University timetable" value={calendarLabel} disabled={calendarBusy} onChange={(event) => setCalendarLabel(event.target.value)} />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={calendarBusy}
            onClick={() => {
              if (!calendarUrl.trim()) { setCalendarError('Enter a feed URL first.'); return }
              calendarRequest('/api/academics/calendars/preview', { url: calendarUrl.trim(), label: calendarLabel.trim() }, 'preview')
            }}
          >
            Check feed
          </Button>
          <Button type="submit" disabled={calendarBusy}>{calendarBusy ? 'Working…' : 'Connect'}</Button>
        </form>

        {calendarError && <Failure message={calendarError} />}
        {calendarPreview && (
          <div className="flex flex-col gap-2">
            <FeedSummary result={calendarPreview.set} connected={calendarPreview.connected} />
            <div>
              <Button variant="ghost" size="sm" onClick={() => setCalendarPreview(null)}>Clear check</Button>
            </div>
          </div>
        )}
      </section>}

      {showAcademicRecord && (!focusedKind || focusedKind === 'academic-work') && <section className="flex flex-col gap-4">
        <SectionHead
          title={showAcademicRecordSummary ? 'Academic record' : 'Academic Work overview'}
          note={showAcademicRecordSummary
            ? 'The Academic Work overview printed from the student portal. It is read by a parser, not a model, so it cannot invent a grade. Each reading is kept as a snapshot of the result, never the document.'
            : 'Upload the overview printed from the student portal. It is parsed deterministically and saved as the next version of your derived academic record.'}
        />

        {showAcademicRecordSummary && (workError ? (
          <Failure message={workError} />
        ) : !work ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-wrap items-baseline gap-10">
            {work.latest?.summary ? (
              <>
                {[
                  ['Credits', String(work.latest.summary.earnedEcts)],
                  ['Courses passed', String(work.latest.summary.passedCourses)],
                  ['Registered now', String(work.latest.summary.currentCourses)],
                  ['Weighted average', work.latest.summary.weightedAverage === null ? '—' : String(work.latest.summary.weightedAverage)]
                ].map(([label, value]) => (
                  <span key={label} className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">{label}</span>
                    <strong className={`text-2xl font-semibold tracking-tight ${NUMERALS}`}>{value}</strong>
                  </span>
                ))}
                <p className={`text-muted-foreground text-sm ${NUMERALS}`}>
                  {work.snapshots.length} reading{work.snapshots.length === 1 ? '' : 's'} recorded · latest {academicDate(work.latest.createdAt)}
                  {work.since && work.since.ectsDelta > 0 ? ` · ${work.since.ectsDelta} credits since the one before` : ''}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                No overview has been read yet, so nothing here is derived from your official record.
              </p>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={workInput}
            type="file"
            accept="application/pdf,.pdf,.txt"
            className="sr-only"
            disabled={workUploading}
            onChange={(event) => { void uploadWork(event.target.files?.[0] ?? null); event.target.value = '' }}
          />
          <Button variant="secondary" disabled={workUploading} onClick={() => workInput.current?.click()}>
            <UploadIcon data-icon="inline-start" />
            {workUploading ? 'Reading…' : 'Upload Academic Work PDF'}
          </Button>
          <a
            href="https://studentportal.maastrichtuniversity.nl/group/guest/my-study"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm font-semibold"
          >
            Where to print it
          </a>
        </div>

        {workResult && (
          <Alert>
            <CheckIcon />
            <AlertTitle>
              {workResult.unchanged
                ? 'Nothing has changed since your last upload'
                : `${workResult.summary.earnedEcts} credits · ${workResult.summary.passedCourses} course${workResult.summary.passedCourses === 1 ? '' : 's'} passed · ${workResult.summary.currentCourses} registered now`}
            </AlertTitle>
            <AlertDescription>
              {workResult.unchanged
                ? 'Your record already matches this overview, so no new snapshot was recorded.'
                : workResult.progress?.newlyPassed?.length
                  ? `Newly passed: ${workResult.progress.newlyPassed.map((course) => course.code).join(', ')}.`
                  : 'Recorded as a new reading of your record.'}
            </AlertDescription>
          </Alert>
        )}
      </section>}
    </div>
  )
}
