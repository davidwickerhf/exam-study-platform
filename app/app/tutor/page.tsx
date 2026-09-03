'use client'

/**
 * The tutor, migrated.
 *
 * Answers are Markdown and the most useful line in one is usually a Canvas
 * link, so they are parsed by the escape-first lib/app/markdown.mjs parser,
 * tested for stable rendering and injection. That makes it safe to set as
 * HTML.
 *
 * Two states, as before: with no conversation this is an invitation and the
 * field that answers it, together — not a transcript of one message stranded
 * above an empty page with the composer pinned to the floor.
 */

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, ListIcon, PlusIcon, SendIcon, Trash2Icon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { tutorMarkdown } from '@/lib/workspace/markdown.mjs'

const OPENERS = [
  'What are my priorities this week?',
  'What is due in the next few days?',
  'When are my next lectures?',
  'How am I doing on credits?'
]

type Message = { role: 'user' | 'assistant'; content: string; at?: string }
type Conversation = { id: string; title: string | null; updatedAt: string; messageCount: number }
type Fact = { id: string; fact: string }
type PrefSpec = { label: string; options: string[]; fallback: string }
type Hub = {
  available: boolean
  conversations: Conversation[]
  memory: { facts: Fact[]; preferences: Record<string, string> }
  preferenceOptions: Record<string, PrefSpec>
  conversation: { id: string; title: string | null; messages: Message[] } | null
}

function Answer({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group flex flex-col gap-2">
      {/* Safe to set: the parser escapes first and emits only its own rules. */}
      <div
        className="bg-paper text-paper-ink [&_a]:text-paper-link [&_code]:bg-paper-subtle rounded-sm px-5 py-4 text-[14.5px] leading-relaxed shadow-lg [&>*+*]:mt-3 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: tutorMarkdown(content) }}
      />
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={async () => {
          await navigator.clipboard.writeText(content)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        }}
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function TutorPage() {
  const [hub, setHub] = useState<Hub | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  const setConversationLocation = (id?: string | null) => {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('conversation', id)
    else url.searchParams.delete('conversation')
    window.history.replaceState(null, '', url)
  }

  const load = (id?: string) => {
    setConversationLocation(id)
    fetch(`/api/tutor${id ? `?conversation=${encodeURIComponent(id)}` : ''}`, { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`The tutor returned ${response.status}`))))
      .then((data: Hub) => {
        setHub(data)
        setMessages(data.conversation?.messages ?? [])
        setConversationId(data.conversation?.id ?? id ?? null)
      })
      .catch((cause: Error) => setError(cause.message))
  }

  useEffect(() => {
    load(new URLSearchParams(window.location.search).get('conversation') ?? undefined)
  }, [])
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }) }, [messages, sending])

  const ask = async (text: string) => {
    const said = text.trim()
    if (!said || sending) return
    setSending(true)
    setError(null)
    setDraft('')
    setMessages((previous) => [...previous, { role: 'user', content: said }])
    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ message: said, conversation: conversationId })
      })
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? `The tutor returned ${response.status}`)
      const result = await response.json()
      setConversationId(result.conversation.id)
      setConversationLocation(result.conversation.id)
      setMessages(result.conversation.messages)
      setHub((previous) => previous && { ...previous, conversations: result.conversations, memory: result.memory })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be sent.')
    } finally {
      setSending(false)
    }
  }

  if (hub && !hub.available) {
    return (
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8">
        <header className="flex flex-col gap-1 border-b pb-4">
          <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">Tutor</h1>
          <p className="text-muted-foreground text-sm">
            Grounded in your courses — answers cite their sources.
          </p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The tutor needs a language model</EmptyTitle>
            <EmptyDescription>None is configured for this deployment. Your dashboard, calendar and updates all still work.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const drawer = (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm"><ListIcon data-icon="inline-start" />History</Button>} />
      <SheetContent className="flex flex-col gap-6 overflow-y-auto p-5">
        <SheetHeader className="p-0"><SheetTitle>History</SheetTitle></SheetHeader>

        {hub?.conversations.length ? (
          <ul className="flex flex-col gap-0.5">
            {hub.conversations.map((entry) => (
              <li key={entry.id} className="group hover:bg-card flex items-center gap-1 rounded-sm">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-2 text-left"
                  onClick={() => load(entry.id)}
                >
                  <strong className="truncate text-[13.5px] font-medium">{entry.title ?? 'New conversation'}</strong>
                  <small className="text-muted-foreground font-data text-[11px] tabular-nums">
                    {entry.messageCount} message{entry.messageCount === 1 ? '' : 's'}
                  </small>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${entry.title ?? 'conversation'}`}
                  className="text-muted-foreground hover:text-foreground p-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={async () => {
                    await fetch(`/api/tutor/conversations/${entry.id}`, { method: 'DELETE' })
                    load(entry.id === conversationId ? undefined : conversationId ?? undefined)
                  }}
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Nothing yet. Your conversations are listed here once you have asked something.</p>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Remembered</h3>
          {hub?.memory.facts.length ? (
            <ul className="flex flex-col gap-1.5">
              {hub.memory.facts.map((fact) => (
                <li key={fact.id} className="bg-card flex items-start gap-2 rounded-sm p-2">
                  <span className="text-muted-foreground flex-1 text-xs">{fact.fact}</span>
                  <button
                    type="button"
                    aria-label="Forget this"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={async () => { await fetch(`/api/tutor/memory/${fact.id}`, { method: 'DELETE' }); load(conversationId ?? undefined) }}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">Ask the tutor to remember something and it appears here. Nothing is remembered unless you ask.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">How it answers</h3>
          {Object.entries(hub?.preferenceOptions ?? {}).map(([key, spec]) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">{spec.label}</span>
              <Select
                value={hub?.memory.preferences[key] ?? spec.fallback}
                onValueChange={async (value) => {
                  const result = await fetch('/api/tutor/preferences', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [key]: value ?? spec.fallback })
                  }).then((response) => response.json())
                  setHub((previous) => previous && { ...previous, memory: { ...previous.memory, preferences: result.preferences } })
                }}
              >
                <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {spec.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          ))}
        </section>
      </SheetContent>
    </Sheet>
  )

  const composer = (
    <form
      // The whole composer is the control, so the focus ring belongs to it
      // rather than to the borderless field inside it.
      className="focus-within:border-primary focus-within:ring-ring/50 bg-card flex items-end gap-3 rounded-sm border p-3 transition-shadow focus-within:ring-2 aria-busy:opacity-70"
      aria-busy={sending}
      onSubmit={(event) => { event.preventDefault(); void ask(draft) }}
    >
      <label className="sr-only" htmlFor="tutor-input">Your question</label>
      <Textarea
        id="tutor-input"
        rows={1}
        value={draft}
        disabled={sending}
        placeholder={sending ? 'Reading your record…' : 'Ask about your week, a course, or your progress…'}
        className="max-h-40 min-h-6 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 disabled:opacity-100"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(draft) }
        }}
      />
      <Button
        type="submit"
        size="icon"
        disabled={sending || !draft.trim()}
        aria-label={sending ? 'Sending…' : 'Send'}
      >
        {sending ? <Spinner /> : <SendIcon />}
      </Button>
    </form>
  )

  const started = messages.some((message) => message.role === 'user')

  if (!started && !sending) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col p-5 sm:p-8">
        {/* The destination's header, like every other one. */}
        <header className="flex flex-col gap-1 border-b pb-4">
          <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">Tutor</h1>
          <p className="text-muted-foreground text-sm">
            Grounded in your courses — answers cite their sources.
          </p>
        </header>

        {/* The opener keeps the centred invitation it had, beneath the header. */}
        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mx-auto flex w-full max-w-[64ch] flex-col gap-4">
            <h2 className="font-heading text-[32px] leading-tight tracking-tight">Ask about your week.</h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              It reads your timetable, your Canvas deadlines, your courses and your record before it answers — and it tells you
              which of those it could not reach.
            </p>
            <div className="flex flex-wrap gap-2">
              {OPENERS.map((opener) => (
                <Button
                  key={opener}
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  className="hover:border-primary hover:text-primary rounded-full transition-colors"
                  onClick={() => void ask(opener)}
                >
                  {opener}
                </Button>
              ))}
            </div>
            {error && <p role="alert" className="text-sm font-medium">{error}</p>}
            {composer}
            <div className="flex items-center gap-3">{drawer}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[1180px] flex-col gap-4 p-6">
      <div className="mx-auto flex w-full max-w-[72ch] items-center gap-4 border-b pb-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Tutor</span>
          <h1 className="min-w-0 truncate text-base font-semibold">
            {hub?.conversation?.title ?? messages.find((message) => message.role === 'user')?.content ?? 'Grounded answers'}
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setConversationId(null); setConversationLocation(null); setDraft('') }}>
          <PlusIcon data-icon="inline-start" />New
        </Button>
        {drawer}
      </div>

      <div ref={threadRef} className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-y-auto">
        {!hub ? (
          <div className="mx-auto flex w-full max-w-[72ch] flex-col gap-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-32 w-full" /></div>
        ) : messages.map((message, index) => (
          <div key={index} className={`mx-auto w-full max-w-[72ch] ${message.role === 'user' ? 'flex justify-end' : ''}`}>
            {message.role === 'user' ? (
              <div className="max-w-[46ch] rounded-sm border px-4 py-2.5 text-[14.5px] leading-relaxed">{message.content}</div>
            ) : (
              <Answer content={message.content} />
            )}
          </div>
        ))}
        {sending && (
          <div className="text-muted-foreground mx-auto flex w-full max-w-[72ch] items-center gap-2 text-sm">
            <span className="bg-muted-foreground size-1.5 animate-pulse rounded-full" />
            Reading your timetable, Canvas and record…
          </div>
        )}
      </div>

      {error && <p className="mx-auto w-full max-w-[72ch] text-sm">{error}</p>}
      <div className="mx-auto w-full max-w-[72ch]">{composer}</div>
    </div>
  )
}
