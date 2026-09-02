'use client'

import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { calendarPayload, calendarResultLine, type CalendarFile } from '@/lib/v2/admin-calendar.mjs'

type Programme = { id: string; name: string; degree?: string }

export function AdminCalendar({ programmes, onPublished }: { programmes: Programme[]; onPublished?: () => void }) {
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id || '')
  const [source, setSource] = useState<'url' | 'file'>('file')
  const [url, setUrl] = useState('')
  const [files, setFiles] = useState<CalendarFile[]>([])
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const programme = programmes.find((item) => item.id === programmeId)

  const publish = async () => {
    setBusy(true); setError(null); setResult(null)
    try {
      const payloads = calendarPayload({ source, url, files, replace })
      let latest: any = null
      for (const payload of payloads) {
        const response = await fetch(`/api/admin/programmes/${encodeURIComponent(programmeId)}/calendar`, { method: 'PUT', headers: { accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || `Calendar publishing returned ${response.status}`)
        latest = body
      }
      setResult(calendarResultLine(latest, programme ? `${programme.degree || ''} ${programme.name}`.trim() : undefined)); setFiles([]); setUrl(''); onPublished?.()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The calendar could not be published.') }
    finally { setBusy(false) }
  }

  return <section className="flex max-w-3xl flex-col gap-5"><div className="border-b pb-2"><h2 className="text-sm font-semibold">Institution calendar</h2><p className="text-muted-foreground text-sm">Publish programme-wide teaching periods, exam weeks and holidays. Students see them read-only until they add dates to their own plan.</p></div>
    <Field><FieldLabel>Programme</FieldLabel><Select value={programmeId} onValueChange={(value) => setProgrammeId(String(value))}><SelectTrigger className="w-full rounded-sm"><SelectValue /></SelectTrigger><SelectContent>{programmes.map((item) => <SelectItem key={item.id} value={item.id}>{[item.degree, item.name].filter(Boolean).join(' ')}</SelectItem>)}</SelectContent></Select></Field>
    <Field><FieldLabel>Source</FieldLabel><Select value={source} onValueChange={(value) => setSource(value as 'url' | 'file')}><SelectTrigger className="w-full rounded-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="file">Upload .ics files</SelectItem><SelectItem value="url">Calendar feed URL</SelectItem></SelectContent></Select></Field>
    {source === 'url' ? <Field><FieldLabel htmlFor="admin-calendar-url">Feed URL</FieldLabel><Input id="admin-calendar-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/calendar.ics" /></Field> : <Field><FieldLabel htmlFor="admin-calendar-files">Calendar files</FieldLabel><Input id="admin-calendar-files" type="file" accept=".ics,text/calendar" multiple onChange={async (event) => { const next = await Promise.all([...event.target.files || []].slice(0, 20).map(async (file) => ({ name: file.name, text: await file.text() }))); setFiles(next); event.target.value = '' }} /><FieldDescription>{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} ready` : 'ICS exports only. Dates are parsed deterministically.'}</FieldDescription></Field>}
    <Field><FieldLabel>Publish mode</FieldLabel><Select value={replace ? 'replace' : 'merge'} onValueChange={(value) => setReplace(value === 'replace')}><SelectTrigger className="w-full rounded-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="merge">Merge with maintained dates</SelectItem><SelectItem value="replace">Replace maintained dates</SelectItem></SelectContent></Select><FieldDescription>Replace removes dates absent from this source. Merge preserves them.</FieldDescription></Field>
    {error && <Alert><AlertTitle>Calendar was not changed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{result && <p className="text-sm">{result}</p>}
    <Button className="w-fit" disabled={busy || !programmeId || (source === 'url' ? !url.trim() : !files.length)} onClick={() => void publish()}>{busy && <Spinner data-icon="inline-start" />}{busy ? 'Publishing…' : 'Publish calendar'}</Button>
  </section>
}
