'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRightIcon, FileIcon } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { formatBytes } from '@/lib/workspace/account.mjs'
import type { ContentRequest, IngestionStage } from '@/lib/workspace/admin.mjs'
import { REQUEST_STATUSES, canPrepareRequest, intakeCounts, intakeDraft, intakePayload, replaceRequest } from '@/lib/workspace/admin-intake.mjs'

const DATA = 'font-data tabular-nums'
type Draft = ReturnType<typeof intakeDraft>

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { accept: 'application/json', 'Content-Type': 'application/json', ...init.headers } })
  const body = await response.json().catch(() => null) as T & { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `The intake returned ${response.status}`)
  return body as T
}

function RequestEditor({ request, stages, onSaved, onPrepared }: { request: ContentRequest; stages: IngestionStage[]; onSaved: (request: ContentRequest) => void; onPrepared: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => intakeDraft(request))
  const [busy, setBusy] = useState<'save' | 'prepare' | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy('save'); setSaved(false); setError(null)
    try {
      const payload = intakePayload(draft, stages)
      const updated = await requestJson<ContentRequest>(`/api/admin/content-requests/${encodeURIComponent(request.id)}`, { method: 'PUT', body: JSON.stringify(payload) })
      setDraft(intakeDraft(updated)); setSaved(true); onSaved(updated)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The workflow could not be saved.') }
    finally { setBusy(null) }
  }

  const prepare = async () => {
    setBusy('prepare'); setError(null)
    try {
      const result = await requestJson<{ editions?: { id: string }[] }>(`/api/admin/content-requests/${encodeURIComponent(request.id)}/prepare`, { method: 'POST', body: '{}' })
      onPrepared()
      const editionId = result.editions?.[0]?.id
      if (editionId) onSaved({ ...request, editionId, status: 'in-progress' })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The shared draft could not be prepared.') }
    finally { setBusy(null) }
  }

  return (
    <div className="grid gap-6 border-t pt-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground text-xs">Requested by</dt><dd className="break-all">{request.requesterEmail || request.userId || 'Unknown account'}</dd></div>
          <div><dt className="text-muted-foreground text-xs">Editorial rights</dt><dd>{request.contributionConsent ? `Candidate · ${request.contributionLicense || 'basis not recorded'}` : 'Private intake only'}</dd></div>
          <div><dt className="text-muted-foreground text-xs">Academic context</dt><dd className={DATA}>{[request.period, request.academicYear].filter(Boolean).join(' · ') || 'Not supplied'}</dd></div>
        </dl>
        {request.notes && <div className="border-l pl-3"><strong className="text-xs font-semibold">Student context</strong><p className="text-muted-foreground mt-1 max-w-[74ch] text-sm whitespace-pre-line">{request.notes}</p></div>}
        {request.urls.length > 0 && <ul className="flex flex-col gap-1">{request.urls.map((url) => <li key={url}><a className="text-primary text-sm font-semibold break-all" href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul>}
        {request.files.length > 0 && <ul className="flex flex-col">{request.files.map((file) => <li key={file.id} className="flex items-center gap-3 border-b py-2"><FileIcon className="text-muted-foreground size-4" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span><span className={`text-muted-foreground text-xs ${DATA}`}>{formatBytes(file.size)}</span><Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/admin/content-requests/${encodeURIComponent(request.id)}/files/${encodeURIComponent(file.id)}`} />}>Download</Button></li>)}</ul>}
      </div>

      <form className="flex flex-col gap-4 border-l pl-5" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <Field><FieldLabel>Workflow stage</FieldLabel><Select value={draft.pipelineStage} disabled={Boolean(busy)} onValueChange={(value) => setDraft((held) => ({ ...held, pipelineStage: String(value) }))}><SelectTrigger className="w-full rounded-sm"><SelectValue /></SelectTrigger><SelectContent>{stages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>)}</SelectContent></Select></Field>
        <Field><FieldLabel>Status</FieldLabel><Select value={draft.status} disabled={Boolean(busy)} onValueChange={(value) => setDraft((held) => ({ ...held, status: String(value) }))}><SelectTrigger className="w-full rounded-sm"><SelectValue /></SelectTrigger><SelectContent>{REQUEST_STATUSES.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></Field>
        <Field><FieldLabel htmlFor={`note-${request.id}`}>Internal production note</FieldLabel><Textarea id={`note-${request.id}`} rows={4} maxLength={4000} value={draft.adminNote} disabled={Boolean(busy)} placeholder="Rights, missing sources, QA findings, publication release…" onChange={(event) => setDraft((held) => ({ ...held, adminNote: event.target.value }))} /></Field>
        {request.editionId ? <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/app/admin?tab=production&edition=${encodeURIComponent(request.editionId)}`} />}>Open shared draft <ArrowUpRightIcon data-icon="inline-end" /></Button> : canPrepareRequest(request) ? <Button type="button" variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void prepare()}>{busy === 'prepare' && <Spinner data-icon="inline-start" />}{busy === 'prepare' ? 'Preparing…' : 'Prepare shared draft'}</Button> : !request.contributionConsent ? <p className="text-muted-foreground text-xs">Private sources can support this request, but cannot enter the shared generation or publication pipeline.</p> : null}
        {error && <Alert><AlertTitle>The request was not changed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex items-center justify-between gap-3"><a className="text-primary text-xs font-semibold" href="/docs#course-ingestion" target="_blank" rel="noopener noreferrer">Ingestion playbook</a><Button type="submit" size="sm" disabled={Boolean(busy)}>{busy === 'save' && <Spinner data-icon="inline-start" />}{busy === 'save' ? 'Saving…' : saved ? 'Saved' : 'Save workflow'}</Button></div>
      </form>
    </div>
  )
}

export function AdminIntake({ initialRequests, stages, onPrepared }: { initialRequests: ContentRequest[]; stages: IngestionStage[]; onPrepared?: () => void }) {
  const [requests, setRequests] = useState(initialRequests)
  useEffect(() => setRequests(initialRequests), [initialRequests])
  const counts = useMemo(() => intakeCounts(requests), [requests])
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-6 border-b pb-2"><div><h2 className="text-sm font-semibold">Course intake inbox</h2><p className="text-muted-foreground max-w-[80ch] text-sm">Student evidence enters the source-grounded pipeline. Nothing becomes public until rights, coverage, citations, exercises and quality have been reviewed.</p></div><span className={`text-muted-foreground whitespace-nowrap text-sm ${DATA}`}>{counts.open} open of {counts.total}</span></div>
      <Accordion multiple defaultValue={requests.filter((request) => request.status === 'submitted').map((request) => request.id)}>
        {requests.map((request) => <AccordionItem key={request.id} value={request.id}><AccordionTrigger><span className="flex min-w-0 flex-1 items-baseline justify-between gap-5 pr-3 text-left"><span className="truncate text-[15px] font-medium"><span className={DATA}>{request.courseCode || 'Course'}</span> · {request.courseName}</span><small className="text-muted-foreground whitespace-nowrap">{REQUEST_STATUSES.find(([id]) => id === request.status)?.[1] || request.status}</small></span></AccordionTrigger><AccordionContent><RequestEditor request={request} stages={stages} onSaved={(updated) => setRequests((held) => replaceRequest(held, updated))} onPrepared={() => onPrepared?.()} /></AccordionContent></AccordionItem>)}
      </Accordion>
    </section>
  )
}
