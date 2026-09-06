'use client'

import { AnswerFeedback } from '@/components/feedback/feedback'
import 'katex/dist/katex.min.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Markdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import {
  BookOpenIcon, CalendarDaysIcon, CheckIcon, ChevronDownIcon, Clock3Icon, CopyIcon,
  ExternalLinkIcon, FileImageIcon, FileTextIcon, Globe2Icon, HistoryIcon, InfoIcon, SearchIcon, MessageSquareIcon,
  ListChecksIcon, PaperclipIcon, PlusIcon, SendIcon, SparklesIcon, TargetIcon, Trash2Icon, XIcon
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cachedWorkspaceJson, workspaceCache } from '@/hooks/use-workspace-data'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { readTutorFile } from '@/lib/workspace/tutor-files'
import { tutorStream } from '@/lib/workspace/tutor-stream'
import { tutorDocket } from '@/lib/tutor-docket.mjs'
import { TutorWidgets, PreparedDraft, type TutorPresentation } from './tutor-widgets'

export type TutorContext = {
  courseId?: string | null; courseCode?: string | null; courseName?: string | null
  chapterId?: string | null; chapterName?: string | null; sourcePath?: string | null
}
type Evidence = { id: string; sourceType: string; title: string; course?: string | null; location?: string; excerpt?: string; url?: string | null; status?: string }
type Proposal = { id: string; type: 'attendance-update' | 'study-work' | 'study-project' | 'practice-set' | 'calendar-event' | 'remember-plan' | 'planning-objective'; title: string; summary: string; detail: string; reversible: boolean }
type Message = { id?: string; turnId?: string; answerRevision?: string; presentation?: TutorPresentation; role: 'user' | 'assistant'; content: string; at?: string; evidence?: Evidence[]; proposals?: Proposal[]; context?: TutorContext | null }
type Conversation = { id: string; title: string | null; updatedAt: string; messageCount: number }
type Fact = { id: string; fact: string; kind?: string; weekdays?: string[]; startDate?: string; endDate?: string }
type Plan = { id: string; title: string; startDate?: string | null; endDate?: string | null; recurrence: string; behaviour?: string }
type Receipt = { proposalId: string; status: string; result?: { label?: string; href?: string }; at: string }
type Attachment = { id: string; name: string; type: string; size: number; status: string; courseCode?: string | null; courseName?: string | null; createdAt: string }
type PrefSpec = { label: string; options: string[]; fallback: string }
type Hub = {
  available: boolean; conversations: Conversation[]
  memory: { facts: Fact[]; plans: Plan[]; preferences: Record<string, string> }
  receipts: Receipt[]; attachments: Attachment[]; preferenceOptions: Record<string, PrefSpec>
  conversation: { id: string; title: string | null; messages: Message[] } | null
}

const OPENERS = [
  ['Absence check', 'I plan to miss Tuesday because of work. Check every course and tell me what I need to take care of.'],
  ['Explain a concept', 'Explain the hardest concept in my current material, then test my understanding.'],
  ['Build practice', 'Create a focused practice set for the topic I am weakest on.'],
  ['Study situation', 'What changed across my schedule, announcements, assignments and course requirements this week?']
]
const markdownPlugins = { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [rehypeKatex, rehypeSlug] }

async function api<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } })
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(data?.error || `That request answered ${response.status}.`)
  if (!data) throw new Error('Tutor returned an incomplete response. Please try again.')
  return data as T
}
function when(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}
function size(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB` }
function ActionIcon({ type }: { type: Proposal['type'] }) {
  const Icon = type === 'practice-set' ? BookOpenIcon : (type === 'calendar-event' || type === 'attendance-update') ? CalendarDaysIcon : type === 'planning-objective' ? TargetIcon : Clock3Icon
  return <Icon className="size-4.5" />
}

function EvidencePanel({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null
  return <details className="group mt-6 rounded-[8px] border">
    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold marker:hidden">
      <FileTextIcon className="size-4" />Evidence <span className="text-muted-foreground font-data font-normal">{evidence.length} reference{evidence.length === 1 ? '' : 's'}</span>
      <ChevronDownIcon className="text-muted-foreground ml-auto size-4 transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t">{evidence.map((source) => <div key={source.id} className="border-b px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{source.title}</strong>{source.course && <Badge variant="outline">{source.course}</Badge>}{source.status && source.status !== 'current' && <Badge variant="secondary">{source.status}</Badge>}</div>
        <p className="text-muted-foreground mt-0.5 text-xs">{source.sourceType}{source.location ? ` · ${source.location}` : ''}</p>
      </div>{source.url && <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.title}`} className="text-muted-foreground hover:text-foreground p-1"><ExternalLinkIcon className="size-4" /></a>}</div>
      {source.excerpt && <p className="text-muted-foreground mt-2 line-clamp-3 text-xs leading-relaxed">{source.excerpt}</p>}
    </div>)}</div>
  </details>
}

function Answer({ message, onReview, conversationId }: { conversationId?: string | null; message: Message; onReview: (ids: string[]) => void }) {
  const [copied, setCopied] = useState(false)
  return <article className="group border-b px-5 py-7 sm:px-8">
    <div className="mb-5 flex items-center gap-3"><span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-full text-xs font-semibold">W</span><strong className="text-sm">Wicker Study Tutor</strong><span className="text-muted-foreground text-xs">{when(message.at) || 'Just now'}</span></div>
    <div className="sm:pl-10">
      <div className="max-w-[76ch] text-[15px] leading-[1.68] [&>*+*]:mt-4 [&_a]:text-primary [&_a]:underline [&_blockquote]:rounded-[6px] [&_blockquote]:bg-muted [&_blockquote]:p-4 [&_code]:bg-muted [&_code]:rounded-[3px] [&_code]:px-1.5 [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[6px] [&_pre]:bg-muted [&_pre]:p-4 [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2.5 [&_th]:border [&_th]:p-2.5 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5"><Markdown {...markdownPlugins}>{message.presentation?.summary || message.content}</Markdown></div>
      {message.presentation && <TutorWidgets presentation={message.presentation} onReview={onReview} />}
      {message.presentation?.detail && <details className="mt-5 max-w-[76ch] rounded-lg border px-4 py-3"><summary className="cursor-pointer text-sm font-semibold">Supporting details</summary><div className="mt-3 text-sm leading-relaxed [&>*+*]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline"><Markdown {...markdownPlugins}>{message.presentation.detail}</Markdown></div></details>}
      <EvidencePanel evidence={message.evidence || []} />
      {conversationId && <AnswerFeedback conversationId={conversationId} message={message}/>}
      <button type="button" className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" onClick={async () => { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}{copied ? 'Copied' : 'Copy answer'}</button>
    </div>
  </article>
}
function UserMessage({ message }: { message: Message }) {
  return <div className="border-b px-5 py-5 sm:px-8"><div className="flex items-start gap-3"><span className="bg-foreground text-background grid size-7 shrink-0 place-items-center rounded-full text-xs">N</span><div className="min-w-0"><div className="flex items-center gap-3"><strong className="text-sm">You</strong><span className="text-muted-foreground text-xs">{when(message.at) || 'Just now'}</span></div><p className="mt-1.5 max-w-[78ch] text-[14.5px] leading-relaxed whitespace-pre-wrap">{message.content}</p></div></div></div>
}

function ActionDocket({ proposals, drafts, receipts, conversationId, reviewIds, onComplete }: { proposals: Proposal[]; drafts: TutorPresentation['drafts']; reviewIds: string[]; receipts: Receipt[]; conversationId: string | null; onComplete: (result: { receipts: Receipt[]; memory: Hub['memory'] }) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])
  const pending = proposals.filter((proposal) => !dismissed.includes(proposal.id) && !receipts.some((receipt) => receipt.proposalId === proposal.id))
  const [selected, setSelected] = useState<string[]>([])
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const completed = receipts.filter(receipt => proposals.some(proposal => proposal.id === receipt.proposalId))
  const pendingKey = pending.map(item => item.id).join(',')
  useEffect(() => { setSelected(pendingKey ? pendingKey.split(',') : []); setReviewed(false) }, [pendingKey])
  useEffect(() => { if (reviewIds.length) { setExpanded(true); setSelected(reviewIds.filter(id => pending.some(item => item.id === id))); setReviewed(true) } }, [reviewIds])
  const approve = async () => {
    if (!conversationId || !selected.length) return
    setBusy(true); setError(null)
    try {
      for (const proposalId of selected.filter(id => pending.some(item => item.id === id))) {
        const latest = await api<{ receipts: Receipt[]; memory: Hub['memory'] }>('/api/tutor/actions', { method: 'POST', body: JSON.stringify({ conversation: conversationId, proposalId }) })
        onComplete(latest)
      }
      setReviewed(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The selected actions could not be completed.') }
    finally { setBusy(false) }
  }
  return <aside id="tutor-actions" tabIndex={-1} aria-label="Proposed actions" className={`flex min-h-0 flex-col outline-none border-l max-lg:border-t max-lg:border-l-0 lg:w-[350px] lg:shrink-0 ${expanded && (pending.length || drafts.length || completed.length) ? 'max-lg:max-h-[65%] max-lg:shrink-0' : 'max-lg:h-14 max-lg:shrink-0'}`}>
    <button type="button" aria-expanded={expanded} className="flex h-14 shrink-0 items-center gap-3 px-5 text-left lg:hidden" onClick={() => setExpanded(value => !value)}><ListChecksIcon className="text-muted-foreground size-4" /><strong className="text-sm">Proposed actions</strong><span className="text-muted-foreground ml-auto text-xs">{pending.length ? `${pending.length} waiting` : completed.length ? `${completed.length} completed` : 'No changes'}{drafts.length ? ` · ${drafts.length} draft${drafts.length === 1 ? '' : 's'}` : ''}</span><ChevronDownIcon className={`size-4 ${expanded ? 'rotate-180' : ''}`} /></button>
    <div className={`border-b px-5 py-4 max-lg:hidden ${expanded && (pending.length || drafts.length || completed.length) ? '' : 'max-lg:hidden'}`}><h2 className="font-heading text-xl font-semibold">Proposed actions</h2><p className="text-muted-foreground mt-1 text-sm leading-relaxed">Prepared for you. Choose what to apply.</p></div>
    <div className={`min-h-0 flex-1 overflow-y-auto ${expanded && (pending.length || drafts.length || completed.length) ? '' : 'max-lg:hidden'}`}>{pending.length > 0 && <p className="text-muted-foreground px-5 pt-4 text-xs font-semibold">{reviewed ? 'Review these changes before approving' : 'Changes awaiting approval'}</p>}{pending.length ? pending.map((proposal) => {
      const checked = selected.includes(proposal.id)
      return <label key={proposal.id} id={`tutor-action-${proposal.id}`} tabIndex={-1} className="flex cursor-pointer items-start gap-3 border-b px-5 py-4 focus:bg-muted"><Checkbox aria-label={proposal.title} checked={checked} disabled={busy} onCheckedChange={(value) => { setSelected((items) => value ? [...items, proposal.id] : items.filter((id) => id !== proposal.id)); setReviewed(false) }} className="mt-1" /><span className="text-muted-foreground mt-1 shrink-0"><ActionIcon type={proposal.type} /></span><span className="min-w-0"><strong className="block text-sm leading-snug">{proposal.title}</strong><span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{proposal.summary}</span><span className="text-muted-foreground mt-1.5 block text-xs leading-relaxed whitespace-pre-line">{proposal.detail}</span></span></label>
    }) : !drafts.length ? <div className="px-6 py-8"><span className="bg-muted text-muted-foreground grid size-10 place-items-center rounded-[8px]"><ListChecksIcon className="size-4.5" /></span><h3 className="mt-4 text-sm font-semibold">Nothing waiting for approval</h3><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Plans, calendar entries and practice sets appear here before anything changes.</p></div> : null}{drafts.length > 0 && <section aria-label="Prepared email drafts">{drafts.map((draft, index) => <PreparedDraft key={`${conversationId}-${index}-${draft.subject}`} draft={draft} />)}</section>}{completed.length > 0 && <section className="space-y-3 border-t px-5 py-4" aria-label="Completed actions"><h3 className="text-muted-foreground text-xs font-semibold">Completed</h3>{completed.map(receipt => <div key={receipt.proposalId} className="flex items-start gap-2 text-xs"><CheckIcon className="text-primary size-3.5 shrink-0" />{receipt.result?.href ? <a className="text-primary underline underline-offset-4" href={receipt.result.href}>{receipt.result.label || 'View result'}</a> : <span>{receipt.result?.label || 'Action completed'}</span>}</div>)}</section>}</div>
    <div className={`border-t p-5 ${expanded && (pending.length || drafts.length || completed.length) ? '' : 'max-lg:hidden'}`}><div className="text-muted-foreground mb-4 flex items-start gap-2 text-xs leading-relaxed"><InfoIcon className="mt-0.5 size-3.5 shrink-0" />Nothing changes until you approve it.</div>{error && <p role="alert" className="mb-3 text-xs text-destructive">{error}</p>}{pending.length > 0 && <div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy} onClick={() => { setDismissed((items) => [...new Set([...items, ...selected])]); setSelected([]); setReviewed(false) }}>Dismiss</Button>{!reviewed ? <Button disabled={!selected.length} onClick={() => setReviewed(true)}>Review {selected.length} action{selected.length === 1 ? '' : 's'}</Button> : <Button disabled={busy || !selected.length} onClick={() => void approve()}>{busy ? <Spinner /> : <CheckIcon data-icon="inline-start" />}Approve selected</Button>}</div>}</div>
  </aside>
}

export function TutorWorkspace({ initialContext = {}, embedded = false }: { initialContext?: TutorContext; embedded?: boolean }) {
  const [view, setView] = useState<'chat' | 'history' | 'sources'>('chat')
  const [libraryQuery, setLibraryQuery] = useState('')
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryRevision, setLibraryRevision] = useState(0)
  const [hub, setHub] = useState<Hub | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [reviewIds, setReviewIds] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConversation, setLoadingConversation] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [progress, setProgress] = useState('Checking your question…')
  const [partialAnswer, setPartialAnswer] = useState('')
  const requestRef = useRef<AbortController | null>(null)
  const creatingRef = useRef<string | null>(null)
  const viewVersion = useRef(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeAttachments, setActiveAttachments] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const context = useMemo(() => ({ ...initialContext, attachmentIds: activeAttachments }), [initialContext, activeAttachments])
  const { proposals, drafts } = useMemo(() => tutorDocket(messages), [messages])
  const started = messages.some((message) => message.role === 'user')
  const tutorUnavailable = hub?.available === false
  const setConversationLocation = (id?: string | null) => {
    if (embedded) return
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('conversation', id); else url.searchParams.delete('conversation')
    window.history.replaceState(null, '', url)
  }
  const load = async (id?: string) => {
    const version = ++viewVersion.current
    requestRef.current?.abort(); requestRef.current = null; setSending(false); setError(null)
    setConversationLocation(id)
    setConversationId(id || null); setReviewIds([]); setMessages([]); setLoadingConversation(true)
    creatingRef.current = null
    try {
      const data = await cachedWorkspaceJson<Hub>(`/api/tutor?view=chat${id ? `&conversation=${encodeURIComponent(id)}` : ''}`)
      if (viewVersion.current !== version) return
      setHub(previous => ({ ...data, conversations: previous?.conversations || [], attachments: previous?.attachments || [] })); setMessages(data.conversation?.messages || []); setConversationId(data.conversation?.id || id || null)
    } catch (cause) { if (viewVersion.current === version) setError(cause instanceof Error ? cause.message : 'Tutor could not be opened.') }
    finally { if (viewVersion.current === version) setLoadingConversation(false) }
  }
  useEffect(() => { if (!embedded) { const requested = new URLSearchParams(window.location.search).get('view'); if (requested === 'sources' || requested === 'history') setView(requested) } void load(embedded ? undefined : new URLSearchParams(window.location.search).get('conversation') || undefined); return () => { viewVersion.current++; requestRef.current?.abort() } }, [])
  useEffect(() => {
    if (view === 'chat') return
    let live = true
    setLibraryLoading(true); setError(null)
    cachedWorkspaceJson<Partial<Hub>>(`/api/tutor?view=${view}`).then(data => {
      if (live) setHub(previous => previous && { ...previous, ...data })
    }).catch(cause => { if (live) setError(cause.message || 'This view could not be loaded.') })
      .finally(() => { if (live) setLibraryLoading(false) })
    return () => { live = false }
  }, [view, libraryRevision])
  useEffect(() => { if (!sending) return; const started = Date.now(); setElapsed(0); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000); return () => clearInterval(timer) }, [sending])
  useEffect(() => {
    const thread = threadRef.current
    if (!thread) return
    if (!sending && messages.at(-1)?.role === 'assistant') {
      const answer = thread.querySelector('article:last-of-type') as HTMLElement | null
      if (answer) thread.scrollTo({ top: answer.getBoundingClientRect().top - thread.getBoundingClientRect().top + thread.scrollTop, behavior: 'instant' })
    } else thread.scrollTo({ top: thread.scrollHeight, behavior: 'instant' })
  }, [messages, sending])
  const ask = async (value: string, retrying = false) => {
    const message = value.trim()
    if (!message || loadingConversation || requestRef.current || hub?.available === false) return
    const controller = new AbortController()
    requestRef.current = controller
    const version = viewVersion.current
    const isCurrent = () => viewVersion.current === version && requestRef.current === controller
    setDraft(''); setSending(true); setProgress('Checking your question…'); setPartialAnswer(''); setError(null)
    if (!retrying) setMessages((items) => [...items, { role: 'user', content: message, at: new Date().toISOString(), context }])
    const previousQuestion = retrying ? [...messages].reverse().find(item => item.role === 'user') : null
    const targetId = conversationId || crypto.randomUUID()
    if (!conversationId) creatingRef.current = targetId
    setConversationId(targetId); setConversationLocation(targetId)
    try {
      const result = await tutorStream<{ conversation: Hub['conversation']; conversations: Conversation[]; memory: Hub['memory']; receipts: Receipt[]; attachments: Attachment[] }>('/api/tutor', { method: 'POST', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(190_000)]), body: JSON.stringify({ message, conversation: targetId, create: creatingRef.current === targetId, context: previousQuestion?.context || context, retry: retrying }) }, message => { if (isCurrent()) { setProgress(message); setPartialAnswer('') } }, text => { if (isCurrent()) setPartialAnswer(text) })
      if (!isCurrent()) return
      if (!(result.conversation?.messages.at(-1)?.role === 'assistant' && result.conversation.messages.at(-1)?.content.trim())) throw new Error('Tutor did not return an answer. Please retry your question.')
      setConversationId(result.conversation.id); setConversationLocation(result.conversation.id); setMessages(result.conversation.messages)
      setHub((previous) => previous && { ...previous, conversation: result.conversation, conversations: result.conversations, memory: result.memory, receipts: result.receipts, attachments: result.attachments })
      creatingRef.current = null
      workspaceCache.invalidate(key => key.startsWith('/api/tutor'))
      setActiveAttachments([])
    } catch (cause) {
      if (isCurrent()) setError(controller.signal.aborted ? 'Reply stopped. You can retry this question.' : cause instanceof Error && cause.name === 'TimeoutError' ? 'Tutor took too long to respond. Please retry your question.' : cause instanceof Error ? cause.message : 'That could not be sent.')
    } finally { if (isCurrent()) { requestRef.current = null; setSending(false) } }
  }
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true); setError(null)
    try {
      const ids: string[] = []; let attachments = hub?.attachments || []
      for (const file of Array.from(files).slice(0, 4)) {
        const source = await readTutorFile(file)
        const result = await api<{ attachment: Attachment; attachments: Attachment[] }>('/api/tutor/attachments', { method: 'POST', body: JSON.stringify({ ...source, ...initialContext, conversationId }) })
        ids.push(result.attachment.id); attachments = result.attachments
      }
      setActiveAttachments((current) => [...new Set([...current, ...ids])]); setHub((previous) => previous && { ...previous, attachments })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'That source could not be indexed.') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const removeConversation = async (entry: Conversation) => {
    setError(null)
    try {
      const result = await api<{ conversations: Conversation[] }>(`/api/tutor/conversations/${entry.id}`, { method: 'DELETE' })
      setHub(previous => previous && { ...previous, conversations: result.conversations })
      if (entry.id === conversationId) await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Conversation could not be deleted.') }
  }
  const removeSource = async (source: Attachment) => {
    setError(null)
    try {
      const result = await api<{ attachments: Attachment[] }>(`/api/tutor/attachments/${source.id}`, { method: 'DELETE' })
      setHub(previous => previous && { ...previous, attachments: result.attachments })
      setActiveAttachments(previous => previous.filter(id => id !== source.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Source could not be deleted.') }
  }
  const filteredConversations = (hub?.conversations || []).filter(entry => (entry.title || 'New conversation').toLowerCase().includes(libraryQuery.toLowerCase()))
  const filteredSources = (hub?.attachments || []).filter(source => `${source.name} ${source.courseCode || ''}`.toLowerCase().includes(libraryQuery.toLowerCase()))
  const library = <main className="min-h-0 flex-1 overflow-y-auto" aria-label={view === 'history' ? 'Conversation history' : 'Tutor sources'}>
    <div className="mx-auto w-full max-w-[1120px] px-5 py-7 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="font-heading text-2xl font-semibold tracking-tight">{view === 'history' ? 'Your conversations' : 'Your sources'}</h2>
          <p className="text-muted-foreground mt-2 max-w-[65ch] text-sm leading-relaxed">{view === 'history' ? 'Pick up where you left off. Saved conversations help Tutor remember what matters to you.' : 'Private files Tutor can reference across your conversations. Course material and Canvas updates are included automatically.'}</p></div>
        {view === 'sources' && <Button size="sm" disabled={uploading || tutorUnavailable} onClick={() => fileRef.current?.click()}>{uploading ? <Spinner /> : <PlusIcon />}Add source</Button>}
      </div>
      <label className="mt-6 flex max-w-md items-center gap-2 rounded-lg border bg-card px-3 py-2.5"><SearchIcon className="text-muted-foreground size-4" /><input type="search" aria-label={view === 'history' ? 'Search conversations' : 'Search sources'} value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} placeholder={view === 'history' ? 'Search conversations…' : 'Search files or courses…'} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      {libraryLoading && <p role="status" className="text-muted-foreground mt-4 text-xs">Loading {view === 'history' ? 'conversations' : 'sources'}…</p>}
      {error && <Button variant="ghost" size="sm" className="mt-3" onClick={() => setLibraryRevision(value => value + 1)}>Retry loading</Button>}
      <div className="mt-5 border-y">
        {view === 'history' ? filteredConversations.map(entry => <div key={entry.id} className="flex items-center gap-3 border-b last:border-b-0 hover:bg-muted/40">
          <button className="flex min-w-0 flex-1 items-center gap-4 py-4 text-left" onClick={() => { setView('chat'); void load(entry.id) }}><MessageSquareIcon className="text-muted-foreground ml-2 size-4 shrink-0" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{entry.title || 'New conversation'}</strong><span className="text-muted-foreground mt-1 block text-xs">{entry.messageCount} messages{entry.id === conversationId ? ' · Current conversation' : ''}</span></span><span className="text-muted-foreground shrink-0 text-xs max-sm:hidden">{when(entry.updatedAt)}</span></button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${entry.title || 'conversation'}`} onClick={() => void removeConversation(entry)}><Trash2Icon className="size-4" /></Button>
        </div>) : filteredSources.map(source => <div key={source.id} className="flex items-center gap-4 border-b py-4 last:border-b-0">
          <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-lg">{source.type.startsWith('image/') ? <FileImageIcon className="size-4" /> : <FileTextIcon className="size-4" />}</span>
          <a className="min-w-0 flex-1" href={`/api/tutor/attachments/${source.id}/file`} target="_blank" rel="noreferrer"><strong className="block truncate text-sm hover:underline">{source.name}</strong><span className="text-muted-foreground mt-1 block text-xs">{size(source.size)} · {source.status}{source.courseCode ? ` · ${source.courseCode}` : ''}</span></a>
          <span className="text-muted-foreground text-xs max-sm:hidden">{when(source.createdAt)}</span><Button variant="ghost" size="icon" aria-label={`Delete ${source.name}`} onClick={() => void removeSource(source)}><Trash2Icon className="size-4" /></Button>
        </div>)}
        {!libraryLoading && !(view === 'history' ? filteredConversations.length : filteredSources.length) && <div className="py-10"><h3 className="text-sm font-semibold">{libraryQuery ? 'No matches' : view === 'history' ? 'Your next conversation starts here' : 'No private sources yet'}</h3><p className="text-muted-foreground mt-2 text-sm">{libraryQuery ? 'Try a different search.' : view === 'history' ? 'Ask Tutor a question. Your conversation saves automatically.' : 'Add a document, slide deck or image for Tutor to refer to.'}</p></div>}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">{view === 'history' ? 'Deleted conversations are no longer used as context.' : 'Removing a source also removes it from future retrieval.'}</p>
      {view === 'sources' && !!hub?.memory.facts.length && <section className="mt-8"><h3 className="text-sm font-semibold">Remembered context</h3><p className="text-muted-foreground mt-1 text-xs">Preferences and availability shared across your Tutor conversations and connected assistants.</p>{hub.memory.facts.map(fact => <div key={fact.id} className="mt-3 flex items-center justify-between gap-3 border-b pb-3"><div><p className="text-sm">{fact.fact}</p><p className="text-muted-foreground mt-1 text-xs">{[fact.kind || 'Context', fact.weekdays?.join(', '), fact.startDate && `From ${fact.startDate}`, fact.endDate && `Until ${fact.endDate}`].filter(Boolean).join(' · ')}</p></div><Button variant="ghost" size="icon" aria-label={`Forget ${fact.fact}`} onClick={async () => { try { const result = await api<{memory: Hub['memory']}>(`/api/tutor/memory/${fact.id}`, {method: 'DELETE'}); setHub(previous => previous && {...previous, memory: result.memory}) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Context could not be removed.') } }}><XIcon className="size-4" /></Button></div>)}</section>}
      {view === 'sources' && !!hub?.memory.plans.length && <section className="mt-8"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Remembered plans</h3><Link href="/app/tutor/work" className="text-primary text-xs font-semibold">Open study work</Link></div>{hub.memory.plans.map(plan => <div key={plan.id} className="mt-3 flex items-center justify-between gap-3 border-b pb-3"><div><strong className="text-sm font-medium">{plan.title}</strong><p className="text-muted-foreground mt-1 text-xs">{plan.startDate || 'Ongoing'}{plan.recurrence === 'weekly' ? ' · weekly' : ''}</p></div><Button variant="ghost" size="icon" aria-label={`Forget ${plan.title}`} onClick={async () => { try { const result = await api<{memory: Hub['memory']}>(`/api/tutor/plans/${plan.id}`, {method: 'DELETE'}); setHub(previous => previous && {...previous, memory: result.memory}) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Plan could not be removed.') } }}><XIcon className="size-4" /></Button></div>)}</section>}
    </div>
  </main>

  const composer = <div className="border-t bg-card px-4 py-4 sm:px-6"><div className="mx-auto max-w-[1240px] rounded-[10px] border bg-card"><div className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 text-xs"><Globe2Icon className="size-3.5" /><strong className="text-foreground">{initialContext.courseCode ? `${initialContext.courseCode} lens` : 'Workspace-wide'}</strong><span>·</span><span className="max-sm:hidden">{initialContext.chapterName ? `starting from ${initialContext.chapterName}, with access to the full workspace` : 'checking every connected course and source'}</span></div>
    {tutorUnavailable ? <div role="status" className="flex items-start gap-3 px-4 py-4"><InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" /><div><strong className="block text-sm">Tutor is not available yet</strong><p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">A language model has not been configured for this workspace.</p></div></div> : <>{activeAttachments.length > 0 && <div className="flex flex-wrap gap-2 border-b px-4 py-2.5">{activeAttachments.map((id) => { const source = hub?.attachments.find((item) => item.id === id); return <button key={id} type="button" onClick={() => setActiveAttachments((items) => items.filter((item) => item !== id))} className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"><PaperclipIcon className="size-3" />{source?.name || 'Source'}<XIcon className="size-3" /></button> })}</div>}
    <form data-tour="tutor-composer" className="flex items-end gap-3 p-3" onSubmit={(event) => { event.preventDefault(); void ask(draft) }}><Button type="button" variant="ghost" size="icon" disabled={uploading} aria-label="Add a private file or picture" onClick={() => fileRef.current?.click()}>{uploading ? <Spinner /> : <PaperclipIcon />}</Button><Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(draft) } }} rows={1} disabled={sending || loadingConversation} placeholder={sending ? 'Checking your workspace…' : 'Ask anything about your studies…'} className="max-h-36 min-h-9 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0" /><Button type="submit" size="icon" aria-label="Send question" disabled={!draft.trim() || sending || loadingConversation}>{sending ? <Spinner /> : <SendIcon />}</Button></form></>}</div>{!tutorUnavailable && <p className="text-muted-foreground mx-auto mt-2 max-w-[1240px] text-center text-[11px] max-sm:hidden">Files are stored privately and indexed for future retrieval. Tutor proposes changes before it acts.</p>}</div>

  return <div className={`flex min-h-0 w-full flex-col overflow-hidden ${embedded ? 'h-full bg-background' : 'h-[calc(100dvh-7.5rem)] md:h-dvh'}`}>
    <header data-tour="tutor" className="flex shrink-0 items-center gap-2 border-b px-5 py-4 sm:gap-3 sm:px-8"><div className="min-w-0 flex-1"><h1 className="font-heading text-[32px] leading-none font-semibold tracking-[-0.03em]">Tutor</h1><p className="text-muted-foreground mt-1.5 text-sm max-sm:hidden">Course explanations, study decisions and approved actions, grounded in your private workspace.</p></div><Link href="/app/tutor/work" className="text-primary shrink-0 text-xs font-semibold sm:text-sm">Study work</Link><Button variant="ghost" size="sm" onClick={() => { setView('chat'); void load(); setDraft(''); setActiveAttachments([]) }}><PlusIcon data-icon="inline-start" />New</Button></header>
    <nav aria-label="Tutor views" className="flex shrink-0 gap-6 border-b px-5 sm:px-8">{([['chat', 'Conversation'], ['history', 'History'], ['sources', 'Sources']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => { setView(id); setLibraryQuery(''); if (!embedded) { const url = new URL(window.location.href); url.searchParams.set('view', id); window.history.replaceState(null, '', url) } }} className={`relative min-h-11 border-b-2 px-0.5 text-sm ${view === id ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}{id === 'chat' && sending && <span className="ml-2 inline-block size-1.5 rounded-full bg-primary" />}</button>)}</nav>
    <input ref={fileRef} type="file" aria-label="Add a private source" tabIndex={-1} multiple className="sr-only" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.gif,.heic,.txt,.md,.csv,.ics,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,text/*" onChange={(event) => void upload(event.target.files)} />
    {view !== 'chat' && library}
    <div className={view === 'chat' ? "flex min-h-0 flex-1 max-lg:flex-col" : "hidden"}><main ref={threadRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto">{!hub ? <div className="space-y-4 p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div> : !started && !sending ? <div className="flex min-h-full items-center justify-center px-5 py-10"><div className="w-full max-w-[760px]"><span className="bg-primary/8 text-primary grid size-11 place-items-center rounded-[10px]"><SparklesIcon className="size-5" /></span><h2 className="font-heading mt-6 text-4xl font-semibold tracking-[-0.035em]">Bring me the whole situation.</h2><p className="text-muted-foreground mt-3 max-w-[64ch] text-[15px] leading-relaxed">Tutor can connect course material, requirements, Canvas, announcements, progress, timetable and academic dates. It can explain the result, then stage practice or planning changes for your approval.</p>{!tutorUnavailable && <><div className="mt-8 grid gap-2 sm:grid-cols-2">{OPENERS.map(([label, prompt]) => <button key={label} type="button" onClick={() => void ask(prompt)} className="hover:border-primary group rounded-[8px] border p-4 text-left transition-colors"><span className="text-primary text-xs font-semibold">{label}</span><span className="mt-1.5 block text-sm leading-relaxed">{prompt}</span></button>)}</div><button type="button" onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-foreground mt-5 inline-flex items-center gap-2 text-sm"><PaperclipIcon className="size-4" />Or add a syllabus, slide, exercise, screenshot or photo</button></>}</div></div> : <>{messages.map((message, index) => message.role === 'user' ? <UserMessage key={`${message.at || index}-user`} message={message} /> : <Answer conversationId={conversationId} key={message.id || `${message.at || index}-assistant`} message={message} onReview={(ids) => { setReviewIds([...ids]); requestAnimationFrame(() => { const target = document.getElementById(`tutor-action-${ids[0]}`) || document.getElementById('tutor-actions'); target?.scrollIntoView({ block: 'nearest' }); target?.focus({ preventScroll: true }) }) }} />)}{sending && partialAnswer && <Answer message={{ role: 'assistant', content: partialAnswer }} onReview={() => {}} />}{sending && <div role="status" className="text-muted-foreground flex flex-wrap items-center gap-3 px-8 py-7 text-sm"><Spinner /><span>{progress} <span className="font-data">{elapsed}s</span></span><Button variant="ghost" size="sm" onClick={() => requestRef.current?.abort()}>Stop</Button></div>}{!sending && messages.at(-1)?.role === 'user' && <div className="mx-5 my-6 rounded-lg border bg-card p-5 sm:mx-8"><p className="text-sm font-semibold">This question has no reply yet</p><p className="text-muted-foreground mt-1 text-sm">Retry it to have Tutor check your sources and finish an answer.</p><Button className="mt-3" variant="outline" size="sm" disabled={tutorUnavailable} onClick={() => void ask(messages.at(-1)!.content, true)}>Retry reply</Button></div>}</>}</main><ActionDocket key={conversationId || 'new'} proposals={proposals} drafts={drafts} reviewIds={reviewIds} receipts={hub?.receipts || []} conversationId={conversationId} onComplete={(result) => setHub((previous) => previous && { ...previous, receipts: result.receipts, memory: result.memory })} /></div>
    {error && <div role="alert" className="border-t bg-card px-6 py-2 text-center text-xs text-destructive">{error}</div>}{view === 'chat' && composer}
  </div>
}
