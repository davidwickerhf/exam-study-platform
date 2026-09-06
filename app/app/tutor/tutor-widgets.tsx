'use client'

import Link from 'next/link'

import { useState } from 'react'
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, CopyIcon, MailIcon } from 'lucide-react'
import { StudyArtifacts, type StudyArtifactsData } from './study-artifacts'
import { Button } from '@/components/ui/button'

export type TutorPresentation = StudyArtifactsData & {
  summary: string
  priorities: { urgency: 'now' | 'soon' | 'later'; title: string; course: string; timing: string; action: string; consequence: string; uncertainty: string; proposalIds: string[] }[]
  courses: { course: string; missed: string; recovery: string }[]
  drafts: { title: string; recipient: string; subject: string; body: string }[]
  attendance?: { id: string; course: string; activity: string; from: string; to: string; attended: number; missed: number; excused: number; unmarked: number; rate: number | null; minimumPercent: number | null; allowedMisses: number | null; requirement: string; source: string; note: string; coverageNote?: string; updates?: { id: string; title: string; postedAt: string; excerpt: string; url?: string }[]; updateCoverage?: string }[]
  agenda?: { title: string; course: string; when: string; location: string; kind: 'class' | 'deadline' | 'exam' | 'study'; note: string }[]
  metrics?: { label: string; value: string; source: string; status: 'recorded' | 'scenario' | 'needs-checking'; note: string }[]
  options?: { title: string; outcome: string; tradeoff: string; uncertainty: string; proposalIds: string[] }[]
  detail: string
}

export function TutorWidgets({ presentation, onReview }: { presentation: TutorPresentation; onReview: (ids: string[]) => void }) {
  return <div className="mt-5 max-w-[76ch] space-y-6">
    {(['now', 'soon', 'later'] as const).map(urgency => {
      const items = presentation.priorities.filter(item => item.urgency === urgency)
      if (!items.length) return null
      return <section key={urgency} aria-label={urgency === 'now' ? 'Act now' : urgency === 'soon' ? 'Coming up' : 'Catch up'} className={`overflow-hidden rounded-[10px] ${urgency === 'now' ? 'bg-foreground text-background' : 'border bg-card'}`}>
        <h3 className={`px-4 pt-4 text-xs font-semibold tracking-[0.08em] uppercase ${urgency === 'now' ? 'text-background/70' : 'text-muted-foreground'}`}>{urgency === 'now' ? 'Act now' : urgency === 'soon' ? 'Coming up' : 'Catch up'}</h3>
        {items.map((item, index) => <div key={index} className={`px-4 py-4 ${index ? urgency === 'now' ? 'border-t border-background/15' : 'border-t' : ''}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h4 className="text-base font-semibold leading-snug">{item.title}</h4><span className={`font-data text-sm ${urgency === 'now' ? 'text-background/75' : 'text-muted-foreground'}`}>{[item.course, item.timing].filter(Boolean).join(' · ')}</span></div>
          <p className="mt-2 text-sm leading-relaxed">{item.action}</p>
          {item.consequence && <p className={`mt-1 text-xs leading-relaxed ${urgency === 'now' ? 'text-background/75' : 'text-muted-foreground'}`}>{item.consequence}</p>}
          {item.uncertainty && <p className={`mt-2 text-xs leading-relaxed ${urgency === 'now' ? 'text-background/90' : ''}`}><strong>Needs checking: </strong>{item.uncertainty}</p>}
          {item.proposalIds.length > 0 && <button type="button" onClick={() => onReview(item.proposalIds)} className={`mt-3 inline-flex items-center gap-2 rounded text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 ${urgency === 'now' ? 'text-background' : 'text-primary'}`}>Review prepared action<ArrowRightIcon className="size-3.5" /></button>}
        </div>)}
      </section>
    })}
    {presentation.attendance?.map(report => <section key={report.id} aria-label={`${report.course} ${report.activity} attendance`} className="overflow-hidden rounded-[10px] border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4"><div><h3 className="text-base font-semibold">{report.course} · {report.activity}</h3><p className="text-muted-foreground font-data mt-1 text-xs">{report.from} to {report.to} · snapshot at reply time</p></div><div className="text-right"><strong className="font-data text-2xl">{report.rate === null ? '—' : `${report.rate}%`}</strong><p className="text-muted-foreground text-xs">of marked sessions</p></div></div>
      <dl className="grid grid-cols-4 divide-x border-b">{([['Attended', report.attended], ['Missed', report.missed], ['Excused', report.excused], ['Unmarked', report.unmarked]] as const).map(([label, count]) => <div key={label} className="px-3 py-4"><dd className="font-data text-2xl font-semibold">{count}</dd><dt className="text-muted-foreground mt-1 text-[11px]">{label}</dt></div>)}</dl>
      <div className="space-y-2 p-4 text-sm leading-relaxed"><h4 className="font-semibold">{report.updates?.length ? "Indexed rule · check recent amendments below" : "Course requirement"}</h4><p>{report.requirement}</p>{report.minimumPercent !== null && <p className="font-data">Minimum attendance: {report.minimumPercent}%</p>}{report.allowedMisses !== null && <p className="font-data">Allowance in this rule: {report.allowedMisses} missed sessions</p>}
        <p className="text-muted-foreground text-xs">{report.source}</p>{report.unmarked > 0 && <p className="text-xs font-semibold">{report.unmarked} sessions are unmarked. Attendance against the requirement is not yet confirmed.</p>}
        {!!report.updates?.length && <div className="space-y-3 border-t pt-3"><h4 className="text-xs font-semibold">Recent course announcements</h4><p className="text-muted-foreground text-xs">These may amend the indexed rule. A compliance verdict needs their wording and effective date checked.</p>{report.updates.map(update => <div key={update.id}><a href={update.url} target="_blank" rel="noreferrer" className="text-primary text-xs font-semibold">{update.title}</a><p className="text-muted-foreground font-data text-xs">{update.postedAt?.slice(0, 10)}</p><p className="mt-1 text-xs">{update.excerpt}</p></div>)}</div>}
        <details className="border-t pt-2"><summary className="cursor-pointer text-xs font-semibold">How this is counted</summary><p className="text-muted-foreground mt-2 text-xs">{report.note} {report.coverageNote}</p></details><Link href="/app/calendar" className="text-primary inline-flex text-xs font-semibold">Review attendance in Calendar</Link>
      </div>
    </section>)}
    <StudyArtifacts data={presentation} />
    {!!presentation.metrics?.length && <section aria-label="Progress at a glance" className="grid divide-y rounded-[10px] border bg-card sm:grid-cols-2 sm:divide-y-0">{presentation.metrics.map((metric, index) => <div key={index} className="min-w-0 p-4">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase">{metric.label}</h3><p className="font-data mt-2 break-words text-3xl font-semibold leading-tight">{metric.value}</p>
      <p className="mt-2 text-xs font-semibold">{metric.status === 'recorded' ? 'Recorded' : metric.status === 'scenario' ? 'What-if scenario' : 'Needs checking'}</p><p className="text-muted-foreground mt-1 text-xs leading-relaxed">{metric.source}</p>{metric.note && <p className="mt-3 text-xs leading-relaxed">{metric.note}</p>}
    </div>)}</section>}
    {!!presentation.agenda?.length && <section aria-label="Agenda" className="overflow-hidden rounded-[10px] border bg-card"><div className="flex items-center justify-between border-b px-4 py-3"><h3 className="text-base font-semibold">Your agenda</h3><Link href="/app/calendar" className="text-primary text-xs font-semibold">Full calendar</Link></div><ol className="divide-y">{presentation.agenda.map((event, index) => <li key={index} className="flex gap-4 px-4 py-4 max-sm:flex-col max-sm:gap-1">
      <p className="font-data w-28 shrink-0 text-sm max-sm:w-auto">{event.when || 'Time not confirmed'}</p><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-semibold">{event.title}</h4><span className="text-muted-foreground text-xs">{{ class: 'Class', deadline: 'Due', exam: 'Exam', study: 'Study' }[event.kind]}</span></div><p className="text-muted-foreground font-data mt-1 text-sm">{[event.course, event.location].filter(Boolean).join(' · ')}</p>{event.note && <p className="mt-2 text-xs leading-relaxed">{event.note}</p>}</div>
    </li>)}</ol></section>}
    {!!presentation.options?.length && <section aria-label="Compare your options"><h3 className="mb-3 text-base font-semibold">Your options</h3><div className="grid gap-3 sm:grid-cols-2">{presentation.options.map((option, index) => <div key={index} className="flex flex-col rounded-[10px] border bg-card p-4"><h4 className="text-base font-semibold">{option.title}</h4><p className="mt-3 text-sm leading-relaxed">{option.outcome}</p><p className="text-muted-foreground mt-3 text-xs leading-relaxed"><strong className="text-foreground">Trade-off </strong>{option.tradeoff}</p>{option.uncertainty && <p className="mt-3 text-xs leading-relaxed"><strong>Needs checking </strong>{option.uncertainty}</p>}{option.proposalIds.length > 0 && <Button variant="outline" size="sm" className="mt-4 self-start" onClick={() => onReview(option.proposalIds)}>Review plan change<ArrowRightIcon /></Button>}</div>)}</div></section>}
    {presentation.courses.length > 0 && <section aria-label="Course catch-up"><h3 className="mb-2 text-base font-semibold">Course catch-up</h3><div className="divide-y border-y">{presentation.courses.map((item, index) => <details key={index} className="group">
      <summary className="flex cursor-pointer list-none items-start gap-3 py-3 [&::-webkit-details-marker]:hidden"><div className="min-w-0 flex-1"><strong className="font-data block text-sm">{item.course}</strong><span className="text-muted-foreground mt-1 block text-sm leading-relaxed">{item.missed}</span></div><span className="text-muted-foreground mt-0.5 flex shrink-0 items-center gap-1 text-xs">Catch up<ChevronDownIcon className="size-3.5 group-open:rotate-180" /></span></summary>
      <p className="pb-4 text-sm leading-relaxed">{item.recovery}</p>
    </details>)}</div></section>}
  </div>
}

export function PreparedDraft({ draft }: { draft: TutorPresentation['drafts'][number] }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  return <details className="group border-b px-5 py-4">
    <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden"><MailIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" /><span className="min-w-0 flex-1"><strong className="block text-sm leading-snug">{draft.title}</strong><span className="text-muted-foreground mt-1 block text-xs">Email draft · ready to copy</span></span><ChevronDownIcon className="text-muted-foreground size-4 shrink-0 group-open:rotate-180" /></summary>
    <div className="mt-4 space-y-3 text-xs leading-relaxed"><p><span className="text-muted-foreground">To </span>{draft.recipient || 'Course team'}</p><p><span className="text-muted-foreground">Subject </span><strong>{draft.subject}</strong></p><p className="select-text whitespace-pre-wrap">{draft.body}</p><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`); setCopied(true); setError(false) } catch { setError(true) } }}>{copied ? <CheckIcon /> : <CopyIcon />}{copied ? 'Copied' : 'Copy draft'}</Button><p className="text-muted-foreground">{error ? 'Copy was unavailable. Select the draft text above to copy it.' : 'Nothing has been sent. Review and send this from your email account.'}</p></div>
  </details>
}
