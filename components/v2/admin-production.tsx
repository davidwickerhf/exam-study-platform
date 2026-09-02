'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckIcon, RefreshCwIcon } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { artifactEditPayload, artifactReviewPayload, canPublish, contributionReviewPayload, editionRecords, pipelineSteps, productionFacts, productionStage } from '@/lib/v2/admin-production.mjs'

type Edition = { id: string; courseCode: string; courseName: string; academicYear: string; period: string; status: string; canonicalCourseId?: string }
type Workspace = { editions: Edition[]; sources?: any[]; topics?: any[]; artifacts?: any[]; releases?: any[]; jobs?: any[] }
const DATA = 'font-data tabular-nums'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } })
  const body = await response.json().catch(() => null) as T & { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `Editorial production returned ${response.status}`)
  return body as T
}

export function AdminProduction() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<any>(null)
  const [confirmation, setConfirmation] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [sourceFiles, setSourceFiles] = useState<File[]>([])
  const [sourceUrls, setSourceUrls] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (editionId?: string) => {
    setError(null)
    try {
      const summary = await json<Workspace>('/api/admin/editorial-workspace')
      const requested = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('edition') || ''
      const id = editionId || selectedId || (summary.editions?.some((item) => item.id === requested) ? requested : '') || summary.editions?.[0]?.id || ''
      const detail = id ? await json<Workspace>(`/api/admin/editorial-workspace?editionId=${encodeURIComponent(id)}`) : summary
      setWorkspace({ ...detail, editions: summary.editions || [] }); setSelectedId(id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The production workspace could not be read.') }
  }, [selectedId])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const edition = workspace?.editions?.find((item) => item.id === selectedId) || null
  const records = useMemo(() => edition && workspace ? editionRecords(edition, workspace) : null, [edition, workspace])
  const facts = useMemo(() => edition && workspace ? productionFacts(edition, workspace) : null, [edition, workspace])
  const stage = edition && workspace ? productionStage(edition, workspace) : null

  const mutate = async (key: string, action: () => Promise<unknown>, message?: string) => {
    if (busy) return
    setBusy(key); setError(null); setNotice(null)
    try { await action(); if (message) setNotice(message); await load(selectedId) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The production action failed.') }
    finally { setBusy(null) }
  }

  const process = (mode: 'extract' | 'map' | 'drafts') => mutate(`process:${mode}`, async () => {
    const types = mode === 'extract' ? ['extract'] : mode === 'map' ? ['map'] : ['study-pages', 'exercises', 'flashcards', 'quality']
    let remaining = 0
    do {
      const result = await json<any>(`/api/admin/editorial-editions/${encodeURIComponent(selectedId)}/process`, { method: 'POST', body: JSON.stringify({ types, useAi: mode !== 'extract', limit: mode === 'extract' ? 10 : mode === 'map' ? 1 : 4 }) })
      remaining = Number(result.remaining) || 0
      if (!result.processed || result.jobs?.some((job: any) => job.status === 'failed')) break
    } while (remaining)
  }, `${mode === 'extract' ? 'Extraction' : mode === 'map' ? 'Course mapping' : 'Draft processing'} finished.`)

  const createEdition = async (form: HTMLFormElement) => {
    setBusy('create'); setError(null)
    try {
      const data = new FormData(form)
      const created = await json<Edition>('/api/admin/editorial-editions', { method: 'POST', body: JSON.stringify({ courseCode: data.get('courseCode'), courseName: data.get('courseName'), academicYear: data.get('academicYear'), period: data.get('period'), institution: data.get('institution'), canonicalCourseId: data.get('canonicalCourseId') }) })
      setSelectedId(created.id); setCreating(false); setNotice('Private edition created. Add sources when ready.'); await load(created.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The edition could not be created.') }
    finally { setBusy(null) }
  }

  const syncSources = () => mutate('sources', async () => {
    const files = await Promise.all(sourceFiles.map(async (file) => {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/').slice(1).join('/') || file.name
      return { file, name: file.name, relativePath, type: file.type, size: file.size, sha256 }
    }))
    const urls = sourceUrls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).map((url, index) => ({ url: new URL(url).toString(), name: `linked-source-${index + 1}.html`, relativePath: url }))
    const registered = await json<any>(`/api/admin/editorial-editions/${encodeURIComponent(selectedId)}/sources`, { method: 'POST', body: JSON.stringify({ rightsBasis: 'admin-supplied', replaceManifest: false, sources: [...files.map(({ file: _file, ...entry }) => entry), ...urls] }) })
    for (const source of registered.sources || []) {
      if (!source.uploadRequired) continue
      const held = files.find((entry) => entry.sha256 === source.sha256)
      if (!held) continue
      const chunkBytes = 512 * 1024
      for (let chunkIndex = 0; chunkIndex < Math.ceil(held.file.size / chunkBytes); chunkIndex += 1) {
        const bytes = new Uint8Array(await held.file.slice(chunkIndex * chunkBytes, Math.min((chunkIndex + 1) * chunkBytes, held.file.size)).arrayBuffer())
        let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        await json(`/api/admin/editorial-editions/${encodeURIComponent(selectedId)}/sources/${encodeURIComponent(source.id)}/chunks`, { method: 'POST', body: JSON.stringify({ chunkIndex, base64: btoa(binary) }) })
      }
    }
    setSourceFiles([]); setSourceUrls('')
  }, 'Sources synchronised. Nothing was generated or published; review rights and extract them next.')

  if (!workspace && !error) return <div className="flex flex-col gap-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-80 w-full" /></div>

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-baseline justify-between gap-4 border-b pb-2"><div><h2 className="text-sm font-semibold">Course production</h2><p className="text-muted-foreground text-sm">Private sources move through rights, extraction, mapping, generation, review and an explicit release.</p></div><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void load(selectedId)}><RefreshCwIcon data-icon="inline-start" />Refresh</Button></div>
      {error && <Alert><AlertTitle>Production did not change</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <p className="flex items-center gap-2 text-sm"><CheckIcon className="text-primary size-4" />{notice}</p>}
      {workspace?.editions?.length ? <Select value={selectedId} onValueChange={(value) => { const id = String(value); setSelectedId(id); setEstimate(null); setConfirmation(''); void load(id) }}><SelectTrigger className="w-full max-w-xl rounded-sm"><SelectValue /></SelectTrigger><SelectContent>{workspace.editions.map((item) => <SelectItem key={item.id} value={item.id}>{item.courseCode} · {[item.academicYear, item.period].filter(Boolean).join(' · ') || item.courseName}</SelectItem>)}</SelectContent></Select> : <p className="text-muted-foreground text-sm">No editorial editions exist yet. Prepare one from a consenting intake request.</p>}
      <div><Button variant="outline" size="sm" onClick={() => setCreating((value) => !value)}>{creating ? 'Close edition form' : 'Create edition'}</Button></div>
      {creating && <form className="grid gap-4 border p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void createEdition(event.currentTarget) }}><Field><FieldLabel>Course code</FieldLabel><Input name="courseCode" required maxLength={40} /></Field><Field><FieldLabel>Course name</FieldLabel><Input name="courseName" required maxLength={200} /></Field><Field><FieldLabel>Academic year</FieldLabel><Input name="academicYear" maxLength={30} placeholder="2026–2027" /></Field><Field><FieldLabel>Period</FieldLabel><Input name="period" maxLength={40} placeholder="Period 1" /></Field><Field><FieldLabel>Institution</FieldLabel><Input name="institution" maxLength={200} /></Field><Field><FieldLabel>Canonical course id</FieldLabel><Input name="canonicalCourseId" maxLength={100} /></Field><Button type="submit" className="w-fit sm:col-span-2" disabled={Boolean(busy)}>{busy === 'create' && <Spinner data-icon="inline-start" />}Create private edition</Button></form>}

      {edition && records && facts && <>
        <ol className="grid gap-px border sm:grid-cols-3 xl:grid-cols-6">{pipelineSteps(edition, workspace!).map((step, index) => <li key={step.id} className="bg-background flex min-h-20 flex-col gap-1 p-3"><span className={`text-muted-foreground text-xs ${DATA}`}>{index + 1}</span><strong className="text-sm">{step.label}</strong><small className={step.done ? 'text-foreground' : 'text-muted-foreground'}>{step.value}</small></li>)}</ol>

        <section className="flex flex-col gap-4 border-t pt-5">
          <div><h3 className="text-lg font-semibold">{({ sources: 'Add course sources', rights: 'Review source rights', extract: 'Extract accepted sources', map: 'Map course evidence', drafts: 'Generate grounded drafts', review: 'Review every draft', publish: 'Publish the edition', live: 'Edition is live' } as Record<string,string>)[stage!]}</h3><p className="text-muted-foreground text-sm">Current stage for <span className={DATA}>{edition.courseCode}</span>. Later actions remain unavailable until this gate is complete.</p></div>
          {stage === 'sources' && <div className="flex max-w-3xl flex-col gap-4"><Field><FieldLabel htmlFor="production-sources">Course source folder or files</FieldLabel><Input id="production-sources" type="file" multiple disabled={Boolean(busy)} onChange={(event) => setSourceFiles([...event.target.files || []].filter((file) => file.size > 0 && file.size <= 100 * 1024 * 1024).slice(0, 250))} /><FieldDescription>{sourceFiles.length ? `${sourceFiles.length} source file${sourceFiles.length === 1 ? '' : 's'} ready. SHA-256 integrity is checked before extraction.` : 'PDF, office, text, code and image sources · up to 100 MB each.'}</FieldDescription></Field><Field><FieldLabel htmlFor="production-urls">Public source URLs</FieldLabel><Textarea id="production-urls" rows={3} value={sourceUrls} onChange={(event) => setSourceUrls(event.target.value)} placeholder={'https://…\nOne URL per line'} /></Field><Button className="w-fit" disabled={Boolean(busy) || (!sourceFiles.length && !sourceUrls.trim())} onClick={() => void syncSources()}>{busy === 'sources' && <Spinner data-icon="inline-start" />}{busy === 'sources' ? 'Hashing and uploading…' : 'Synchronise sources'}</Button></div>}
          {stage === 'rights' && <div className="flex flex-col">{facts.sources.map((source: any) => <div key={source.id} className="flex flex-wrap items-center gap-3 border-b py-3"><span className="min-w-0 flex-1 truncate text-sm font-medium">{source.contribution?.sourcePath || source.name}</span><span className="text-muted-foreground text-xs">{source.contribution?.consentStatus}</span>{source.contribution?.consentStatus === 'candidate' && <><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void mutate(`rights:${source.id}`, () => json(`/api/admin/editorial-contributions/${encodeURIComponent(source.contribution.id)}`, { method: 'PUT', body: JSON.stringify(contributionReviewPayload('accepted')) }))}>Accept</Button><Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void mutate(`rights:${source.id}`, () => json(`/api/admin/editorial-contributions/${encodeURIComponent(source.contribution.id)}`, { method: 'PUT', body: JSON.stringify(contributionReviewPayload('rejected')) }))}>Reject</Button></>}</div>)}</div>}
          {stage === 'extract' && <Button className="w-fit" disabled={Boolean(busy)} onClick={() => void process('extract')}>{busy === 'process:extract' && <Spinner data-icon="inline-start" />}Extract accepted sources</Button>}
          {stage === 'map' && <Button className="w-fit" disabled={Boolean(busy)} onClick={() => void process('map')}>{busy === 'process:map' && <Spinner data-icon="inline-start" />}Run evidence map</Button>}
          {stage === 'drafts' && <div className="flex flex-wrap gap-2">{facts.pending(['study-pages','exercises','flashcards','quality']) ? <Button disabled={Boolean(busy)} onClick={() => void process('drafts')}>Process queued drafts</Button> : estimate ? <Button disabled={Boolean(busy)} onClick={() => void mutate('queue', () => json(`/api/admin/editorial-editions/${encodeURIComponent(edition.id)}/generate`, { method: 'POST', body: JSON.stringify({ types: ['study-pages','exercises','flashcards','quality'] }) }), 'Draft generation queued.')}>Queue complete draft · <span className={DATA}>{estimate.estimatedTokens?.total ?? '—'} tokens</span></Button> : <Button disabled={Boolean(busy) || !facts.topics.length} onClick={() => void mutate('estimate', async () => { const value = await json(`/api/admin/editorial-editions/${encodeURIComponent(edition.id)}/estimate`); setEstimate(value) })}>Estimate generation</Button>}</div>}
          {(stage === 'review' || records.artifacts.length > 0) && <Accordion multiple>{records.artifacts.map((artifact: any) => <AccordionItem key={artifact.id} value={artifact.id}><AccordionTrigger><span className="flex flex-1 justify-between pr-3"><span>{artifact.title}</span><small className="text-muted-foreground">{artifact.type?.replace('-', ' ')} · {artifact.status}</small></span></AccordionTrigger><AccordionContent><div className="flex flex-col gap-3"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void mutate(`artifact:${artifact.id}`, () => json(`/api/admin/editorial-artifacts/${encodeURIComponent(artifact.id)}`, { method: 'PUT', body: JSON.stringify(artifactReviewPayload('approved')) }))}>Approve</Button><Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void mutate(`artifact:${artifact.id}`, () => json(`/api/admin/editorial-artifacts/${encodeURIComponent(artifact.id)}`, { method: 'PUT', body: JSON.stringify(artifactReviewPayload('review')) }))}>Return to review</Button><Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void mutate(`artifact:${artifact.id}`, () => json(`/api/admin/editorial-artifacts/${encodeURIComponent(artifact.id)}`, { method: 'PUT', body: JSON.stringify(artifactReviewPayload('rejected')) }))}>Reject</Button><Button variant="ghost" size="sm" onClick={() => setEditing(editing === artifact.id ? null : artifact.id)}>Edit JSON</Button></div>{editing === artifact.id && <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void mutate(`edit:${artifact.id}`, () => json(`/api/admin/editorial-artifacts/${encodeURIComponent(artifact.id)}`, { method: 'PUT', body: JSON.stringify(artifactEditPayload({ title: String(data.get('title')), definition: String(data.get('definition')) })) })).then(() => setEditing(null)) }}><Field><FieldLabel>Title</FieldLabel><Input name="title" maxLength={240} defaultValue={artifact.title} /></Field><Field><FieldLabel>Artifact JSON</FieldLabel><Textarea name="definition" rows={14} spellCheck={false} defaultValue={JSON.stringify(artifact.definition, null, 2)} /><FieldDescription>Keep sourceChunkIds intact so publication can verify evidence.</FieldDescription></Field><Button type="submit" className="w-fit">Save draft</Button></form>}</div></AccordionContent></AccordionItem>)}</Accordion>}
          {stage === 'publish' && <div className="flex max-w-xl flex-col gap-3"><Field><FieldLabel htmlFor="publish-confirmation">Type {edition.courseCode || edition.canonicalCourseId} to publish</FieldLabel><Input id="publish-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field><Button className="w-fit" disabled={Boolean(busy) || !canPublish(edition, workspace!, confirmation)} onClick={() => void mutate('publish', () => json(`/api/admin/editorial-editions/${encodeURIComponent(edition.id)}/publish`, { method: 'POST', body: JSON.stringify({ confirmation }) }), `${edition.courseCode} is live.`)}>Publish edition</Button></div>}
          {stage !== 'sources' && <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-semibold">Add more sources</summary><div className="mt-4 flex max-w-3xl flex-col gap-4"><Field><FieldLabel htmlFor="production-more-sources">Files</FieldLabel><Input id="production-more-sources" type="file" multiple disabled={Boolean(busy)} onChange={(event) => setSourceFiles([...event.target.files || []].filter((file) => file.size > 0 && file.size <= 100 * 1024 * 1024).slice(0, 250))} /><FieldDescription>{sourceFiles.length ? `${sourceFiles.length} files ready` : 'A changed source path supersedes its previous accepted version.'}</FieldDescription></Field><Field><FieldLabel htmlFor="production-more-urls">Public URLs</FieldLabel><Textarea id="production-more-urls" rows={2} value={sourceUrls} onChange={(event) => setSourceUrls(event.target.value)} /></Field><Button className="w-fit" disabled={Boolean(busy) || (!sourceFiles.length && !sourceUrls.trim())} onClick={() => void syncSources()}>Synchronise additional sources</Button></div></details>}
        </section>
      </>}
    </div>
  )
}
