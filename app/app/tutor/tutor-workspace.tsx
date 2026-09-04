'use client'

import 'katex/dist/katex.min.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import {
  BookOpenIcon, CalendarDaysIcon, CheckIcon, ChevronDownIcon, Clock3Icon, CopyIcon,
  ExternalLinkIcon, FileImageIcon, FileTextIcon, Globe2Icon, HistoryIcon, InfoIcon,
  ListChecksIcon, PaperclipIcon, PlusIcon, SendIcon, SparklesIcon, Trash2Icon, XIcon
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { readTutorFile } from '@/lib/workspace/tutor-files'

export type TutorContext = {
  courseId?: string | null; courseCode?: string | null; courseName?: string | null
  chapterId?: string | null; chapterName?: string | null; sourcePath?: string | null
}
type Evidence = { id: string; sourceType: string; title: string; course?: string | null; location?: string; excerpt?: string; url?: string | null; status?: string }
type Proposal = { id: string; type: 'practice-set' | 'calendar-event' | 'remember-plan'; title: string; summary: string; detail: string; reversible: boolean }
type Message = { role: 'user' | 'assistant'; content: string; at?: string; evidence?: Evidence[]; proposals?: Proposal[]; context?: TutorContext | null }
type Conversation = { id: string; title: string | null; updatedAt: string; messageCount: number }
type Fact = { id: string; fact: string }
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
  return data as T
}
function when(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}
function size(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB` }
function ActionIcon({ type }: { type: Proposal['type'] }) {
  const Icon = type === 'practice-set' ? BookOpenIcon : type === 'calendar-event' ? CalendarDaysIcon : Clock3Icon
  return <Icon className="size-4.5" />
}

function EvidencePanel({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null
  return <details className="group mt-6 rounded-[8px] border">
    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold marker:hidden">
      <FileTextIcon className="size-4" />Evidence <span className="text-muted-foreground font-data font-normal">{evidence.length} source{evidence.length === 1 ? '' : 's'}</span>
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

function Answer({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false)
  return <article className="group border-b px-5 py-7 sm:px-8">
    <div className="mb-5 flex items-center gap-3"><span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-full text-xs font-semibold">W</span><strong className="text-sm">Wicker Study Tutor</strong><span className="text-muted-foreground text-xs">{when(message.at) || 'Just now'}</span></div>
    <div className="sm:pl-10">
      <div className="max-w-[76ch] text-[15px] leading-[1.68] [&>*+*]:mt-4 [&_a]:text-primary [&_a]:underline [&_blockquote]:rounded-[6px] [&_blockquote]:bg-muted [&_blockquote]:p-4 [&_code]:bg-muted [&_code]:rounded-[3px] [&_code]:px-1.5 [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[6px] [&_pre]:bg-muted [&_pre]:p-4 [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2.5 [&_th]:border [&_th]:p-2.5 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5"><Markdown {...markdownPlugins}>{message.content}</Markdown></div>
      <EvidencePanel evidence={message.evidence || []} />
      <button type="button" className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" onClick={async () => { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}{copied ? 'Copied' : 'Copy answer'}</button>
    </div>
  </article>
}
function UserMessage({ message }: { message: Message }) {
  return <div className="border-b px-5 py-5 sm:px-8"><div className="flex items-start gap-3"><span className="bg-foreground text-background grid size-7 shrink-0 place-items-center rounded-full text-xs">N</span><div className="min-w-0"><div className="flex items-center gap-3"><strong className="text-sm">You</strong><span className="text-muted-foreground text-xs">{when(message.at) || 'Just now'}</span></div><p className="mt-1.5 max-w-[78ch] text-[14.5px] leading-relaxed whitespace-pre-wrap">{message.content}</p></div></div></div>
}

function ActionDocket({ proposals, receipts, conversationId, onComplete }: { proposals: Proposal[]; receipts: Receipt[]; conversationId: string | null; onComplete: (result: { receipts: Receipt[]; memory: Hub['memory'] }) => void }) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const pending = proposals.filter((proposal) => !dismissed.includes(proposal.id) && !receipts.some((receipt) => receipt.proposalId === proposal.id))
  const [selected, setSelected] = useState<string[]>([])
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setSelected(pending.map((item) => item.id)); setReviewed(false) }, [proposals.length, receipts.length])
  const approve = async () => {
    if (!conversationId || !selected.length) return
    setBusy(true); setError(null)
    try {
      let latest: { receipts: Receipt[]; memory: Hub['memory'] } | null = null
      for (const proposalId of selected) latest = await api('/api/tutor/actions', { method: 'POST', body: JSON.stringify({ conversation: conversationId, proposalId }) })
      if (latest) onComplete(latest)
      setReviewed(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The selected actions could not be completed.') }
    finally { setBusy(false) }
  }
  return <aside className={`flex min-h-0 flex-col border-l max-lg:border-t max-lg:border-l-0 lg:w-[350px] lg:shrink-0 ${pending.length ? 'max-lg:max-h-[42%]' : 'max-lg:h-14'}`}>
    {!pending.length && <div className="flex h-14 items-center gap-3 px-5 lg:hidden"><ListChecksIcon className="text-muted-foreground size-4" /><strong className="text-sm">No actions waiting</strong><span className="text-muted-foreground ml-auto text-xs">Tutor asks before acting</span></div>}
    <div className={`border-b px-6 py-6 ${pending.length ? '' : 'max-lg:hidden'}`}><h2 className="font-heading text-xl font-semibold">Proposed actions</h2><p className="text-muted-foreground mt-1 text-sm leading-relaxed">Review and approve only the changes you want Tutor to make.</p></div>
    <div className={`min-h-0 flex-1 overflow-y-auto ${pending.length ? '' : 'max-lg:hidden'}`}>{pending.length ? pending.map((proposal) => {
      const checked = selected.includes(proposal.id)
      return <label key={proposal.id} className="flex cursor-pointer items-start gap-3 border-b px-5 py-5"><Checkbox checked={checked} onCheckedChange={(value) => { setSelected((items) => value ? [...items, proposal.id] : items.filter((id) => id !== proposal.id)); setReviewed(false) }} className="mt-1" /><span className="bg-primary/8 text-primary grid size-11 shrink-0 place-items-center rounded-[8px]"><ActionIcon type={proposal.type} /></span><span className="min-w-0"><strong className="block text-sm leading-snug">{proposal.title}</strong><span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{proposal.summary}</span><span className="text-muted-foreground mt-1.5 block text-xs leading-relaxed">{proposal.detail}</span></span></label>
    }) : <div className="px-6 py-8"><span className="bg-muted text-muted-foreground grid size-10 place-items-center rounded-[8px]"><ListChecksIcon className="size-4.5" /></span><h3 className="mt-4 text-sm font-semibold">Nothing waiting for approval</h3><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Plans, calendar entries and practice sets appear here before anything changes.</p>{receipts.slice(0, 3).map((receipt) => <div key={receipt.proposalId} className="mt-3 flex items-center gap-2 text-xs"><CheckIcon className="text-primary size-3.5" /><span>{receipt.result?.label || 'Action completed'}</span></div>)}</div>}</div>
    <div className={`border-t p-5 ${pending.length ? '' : 'max-lg:hidden'}`}><div className="text-muted-foreground mb-4 flex items-start gap-2 text-xs leading-relaxed"><InfoIcon className="mt-0.5 size-3.5 shrink-0" />Nothing changes until you approve it.</div>{error && <p role="alert" className="mb-3 text-xs text-destructive">{error}</p>}{pending.length > 0 && <div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy} onClick={() => setDismissed((items) => [...new Set([...items, ...selected])])}>Dismiss</Button>{!reviewed ? <Button disabled={!selected.length} onClick={() => setReviewed(true)}>Review {selected.length} action{selected.length === 1 ? '' : 's'}</Button> : <Button disabled={busy || !selected.length} onClick={() => void approve()}>{busy ? <Spinner /> : <CheckIcon data-icon="inline-start" />}Approve selected</Button>}</div>}</div>
  </aside>
}

export function TutorWorkspace({ initialContext = {}, embedded = false }: { initialContext?: TutorContext; embedded?: boolean }) {
  const [hub, setHub] = useState<Hub | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeAttachments, setActiveAttachments] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const context = useMemo(() => ({ ...initialContext, attachmentIds: activeAttachments }), [initialContext, activeAttachments])
  const proposals = useMemo(() => messages.flatMap((message) => message.proposals || []), [messages])
  const started = messages.some((message) => message.role === 'user')
  const setConversationLocation = (id?: string | null) => {
    if (embedded) return
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('conversation', id); else url.searchParams.delete('conversation')
    window.history.replaceState(null, '', url)
  }
  const load = async (id?: string) => {
    setConversationLocation(id)
    try {
      const data = await api<Hub>(`/api/tutor${id ? `?conversation=${encodeURIComponent(id)}` : ''}`)
      setHub(data); setMessages(data.conversation?.messages || []); setConversationId(data.conversation?.id || id || null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Tutor could not be opened.') }
  }
  useEffect(() => { void load(embedded ? undefined : new URLSearchParams(window.location.search).get('conversation') || undefined) }, [])
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending])
  const ask = async (value: string) => {
    const message = value.trim()
    if (!message || sending || hub?.available === false) return
    setDraft(''); setSending(true); setError(null)
    setMessages((items) => [...items, { role: 'user', content: message, at: new Date().toISOString() }])
    try {
      const result = await api<{ conversation: Hub['conversation']; conversations: Conversation[]; memory: Hub['memory']; receipts: Receipt[]; attachments: Attachment[] }>('/api/tutor', { method: 'POST', body: JSON.stringify({ message, conversation: conversationId, context }) })
      setConversationId(result.conversation?.id || null); setConversationLocation(result.conversation?.id); setMessages(result.conversation?.messages || [])
      setHub((previous) => previous && { ...previous, conversation: result.conversation, conversations: result.conversations, memory: result.memory, receipts: result.receipts, attachments: result.attachments })
      setActiveAttachments([])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'That could not be sent.') }
    finally { setSending(false) }
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

  const history = <Sheet><SheetTrigger render={<Button variant="outline" size="sm"><HistoryIcon data-icon="inline-start" /><span className="max-sm:hidden">History & sources</span><span className="sm:hidden">History</span></Button>} /><SheetContent className="flex w-[min(430px,92vw)] flex-col gap-0 overflow-y-auto p-0 sm:max-w-[430px]"><SheetHeader className="border-b px-5 py-5"><SheetTitle>History & sources</SheetTitle></SheetHeader>
    <section className="border-b p-5"><h3 className="text-muted-foreground mb-3 text-[10.5px] font-semibold tracking-[0.11em] uppercase">Conversations</h3>{hub?.conversations.length ? hub.conversations.map((entry) => <div key={entry.id} className="group flex items-center border-b last:border-b-0"><button className="min-w-0 flex-1 py-3 text-left" onClick={() => void load(entry.id)}><strong className="block truncate text-sm">{entry.title || 'New conversation'}</strong><span className="text-muted-foreground text-xs">{entry.messageCount} messages · {when(entry.updatedAt)}</span></button><button className="text-muted-foreground hover:text-foreground p-2 opacity-0 group-hover:opacity-100" aria-label={`Delete ${entry.title || 'conversation'}`} onClick={async () => { await api(`/api/tutor/conversations/${entry.id}`, { method: 'DELETE' }); await load(entry.id === conversationId ? undefined : conversationId || undefined) }}><Trash2Icon className="size-4" /></button></div>) : <p className="text-muted-foreground text-sm">No saved conversations yet.</p>}</section>
    <section className="border-b p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Private Tutor sources</h3><Button variant="ghost" size="xs" onClick={() => fileRef.current?.click()}><PlusIcon data-icon="inline-start" />Add</Button></div>{hub?.attachments.length ? hub.attachments.map((source) => <div key={source.id} className="group flex items-center gap-3 border-b py-3 last:border-b-0"><span className="bg-muted grid size-9 place-items-center rounded-[6px]">{source.type.startsWith('image/') ? <FileImageIcon className="size-4" /> : <FileTextIcon className="size-4" />}</span><a className="min-w-0 flex-1" href={`/api/tutor/attachments/${source.id}/file`} target="_blank"><strong className="block truncate text-sm">{source.name}</strong><span className="text-muted-foreground text-xs">{size(source.size)} · {source.status}</span></a><button aria-label={`Delete ${source.name}`} className="text-muted-foreground hover:text-foreground p-2 opacity-0 group-hover:opacity-100" onClick={async () => { const result = await api<{ attachments: Attachment[] }>(`/api/tutor/attachments/${source.id}`, { method: 'DELETE' }); setHub((previous) => previous && { ...previous, attachments: result.attachments }) }}><Trash2Icon className="size-4" /></button></div>) : <p className="text-muted-foreground text-sm leading-relaxed">Files and pictures you add here stay private, searchable and tied to your account.</p>}</section>
    <section className="border-b p-5"><h3 className="text-muted-foreground mb-3 text-[10.5px] font-semibold tracking-[0.11em] uppercase">Approved plans</h3>{hub?.memory.plans.length ? hub.memory.plans.map((plan) => <div key={plan.id} className="group flex items-start border-b py-3 last:border-b-0"><div className="min-w-0 flex-1"><strong className="block text-sm">{plan.title}</strong><span className="text-muted-foreground text-xs">{plan.startDate || 'Ongoing'}{plan.recurrence === 'weekly' ? ' · weekly' : ''}</span></div><button aria-label={`Forget ${plan.title}`} className="text-muted-foreground hover:text-foreground p-2 opacity-0 group-hover:opacity-100" onClick={async () => { const result = await api<{ memory: Hub['memory'] }>(`/api/tutor/plans/${plan.id}`, { method: 'DELETE' }); setHub((previous) => previous && { ...previous, memory: result.memory }) }}><XIcon className="size-4" /></button></div>) : <p className="text-muted-foreground text-sm">No approved plans yet.</p>}</section>
  </SheetContent></Sheet>

  const composer = <div className="border-t bg-background px-4 py-4 sm:px-6"><div className="mx-auto max-w-[1240px] rounded-[10px] border bg-card"><div className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 text-xs"><Globe2Icon className="size-3.5" /><strong className="text-foreground">{initialContext.courseCode ? `${initialContext.courseCode} lens` : 'Workspace-wide'}</strong><span>·</span><span>{initialContext.chapterName ? `starting from ${initialContext.chapterName}, with access to the full workspace` : 'checking every connected course and source'}</span></div>
    {activeAttachments.length > 0 && <div className="flex flex-wrap gap-2 border-b px-4 py-2.5">{activeAttachments.map((id) => { const source = hub?.attachments.find((item) => item.id === id); return <button key={id} type="button" onClick={() => setActiveAttachments((items) => items.filter((item) => item !== id))} className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"><PaperclipIcon className="size-3" />{source?.name || 'Source'}<XIcon className="size-3" /></button> })}</div>}
    <form className="flex items-end gap-3 p-3" onSubmit={(event) => { event.preventDefault(); void ask(draft) }}><input ref={fileRef} type="file" multiple className="sr-only" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.gif,.heic,.txt,.md,.csv,.ics,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,text/*" onChange={(event) => void upload(event.target.files)} /><Button type="button" variant="ghost" size="icon" disabled={uploading} aria-label="Add a private file or picture" onClick={() => fileRef.current?.click()}>{uploading ? <Spinner /> : <PaperclipIcon />}</Button><Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(draft) } }} rows={1} disabled={sending || hub?.available === false} placeholder={hub?.available === false ? 'Tutor needs a configured language model' : sending ? 'Checking your workspace…' : 'Ask anything about your studies…'} className="max-h-36 min-h-9 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0" /><Button type="submit" size="icon" disabled={!draft.trim() || sending || hub?.available === false}>{sending ? <Spinner /> : <SendIcon />}</Button></form></div><p className="text-muted-foreground mx-auto mt-2 max-w-[1240px] text-center text-[11px]">Files are stored privately and indexed for future retrieval. Tutor proposes changes before it acts.</p></div>

  return <div className={`flex min-h-0 w-full flex-col overflow-hidden ${embedded ? 'h-full bg-background' : 'h-[calc(100dvh-7.5rem)] md:h-dvh'}`}>
    <header className="flex shrink-0 items-center gap-2 border-b px-5 py-4 sm:gap-3 sm:px-8"><div className="min-w-0 flex-1"><h1 className="font-heading text-[32px] leading-none font-semibold tracking-[-0.03em]">Tutor</h1><p className="text-muted-foreground mt-1.5 text-sm max-sm:hidden">Course explanations, study decisions and approved actions, grounded in your private workspace.</p></div>{history}<Button variant="ghost" size="sm" onClick={() => { setMessages([]); setConversationId(null); setConversationLocation(null); setDraft('') }}><PlusIcon data-icon="inline-start" />New</Button></header>
    <div className="flex min-h-0 flex-1 max-lg:flex-col"><main ref={threadRef} className="min-h-[360px] min-w-0 flex-1 overflow-y-auto">{!hub ? <div className="space-y-4 p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div> : !started && !sending ? <div className="flex min-h-full items-center justify-center px-5 py-10"><div className="w-full max-w-[760px]"><span className="bg-primary/8 text-primary grid size-11 place-items-center rounded-[10px]"><SparklesIcon className="size-5" /></span><h2 className="font-heading mt-6 text-4xl font-semibold tracking-[-0.035em]">Bring me the whole situation.</h2><p className="text-muted-foreground mt-3 max-w-[64ch] text-[15px] leading-relaxed">Tutor can connect course material, requirements, Canvas, announcements, progress, timetable and academic dates. It can explain the result, then stage practice or planning changes for your approval.</p><div className="mt-8 grid gap-2 sm:grid-cols-2">{OPENERS.map(([label, prompt]) => <button key={label} type="button" onClick={() => void ask(prompt)} className="hover:border-primary group rounded-[8px] border p-4 text-left transition-colors"><span className="text-primary text-xs font-semibold">{label}</span><span className="mt-1.5 block text-sm leading-relaxed">{prompt}</span></button>)}</div><button type="button" onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-foreground mt-5 inline-flex items-center gap-2 text-sm"><PaperclipIcon className="size-4" />Or add a syllabus, slide, exercise, screenshot or photo</button></div></div> : <>{messages.map((message, index) => message.role === 'user' ? <UserMessage key={`${message.at || index}-user`} message={message} /> : <Answer key={`${message.at || index}-assistant`} message={message} />)}{sending && <div className="text-muted-foreground flex items-center gap-3 px-8 py-7 text-sm"><span className="bg-primary size-2 animate-pulse rounded-full" />Checking course sources, obligations, schedule and progress…</div>}</>}</main><ActionDocket proposals={proposals} receipts={hub?.receipts || []} conversationId={conversationId} onComplete={(result) => setHub((previous) => previous && { ...previous, receipts: result.receipts, memory: result.memory })} /></div>
    {error && <div role="alert" className="border-t bg-destructive/5 px-6 py-2 text-center text-xs text-destructive">{error}</div>}{composer}
  </div>
}
