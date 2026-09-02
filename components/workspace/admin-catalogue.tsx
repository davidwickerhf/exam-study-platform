'use client'

import { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { programmeCounts, programmeEditPayload } from '@/lib/workspace/admin-catalogue.mjs'
import { AdminCalendar } from '@/components/workspace/admin-calendar'

type Programme = { id: string; name: string; degree?: string; versions: any[]; calendar?: any[]; [key: string]: unknown }
const DATA = 'font-data tabular-nums'

export function AdminCatalogue({ initialProgrammes }: { initialProgrammes: Programme[] }) {
  const [programmes, setProgrammes] = useState(initialProgrammes)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const save = async (programme: Programme) => {
    setBusy(programme.id); setError(null)
    try {
      const payload = programmeEditPayload(programme.id, drafts[programme.id] ?? JSON.stringify(programme, null, 2))
      const response = await fetch(`/api/admin/programmes/${encodeURIComponent(programme.id)}`, { method: 'PUT', headers: { accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || `Programme saving returned ${response.status}`)
      setProgrammes((held) => held.map((item) => item.id === programme.id ? result : item)); setDrafts((held) => ({ ...held, [programme.id]: JSON.stringify(result, null, 2) }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The programme could not be saved.') }
    finally { setBusy(null) }
  }
  return <div className="flex flex-col gap-10"><section className="flex flex-col gap-4"><div className="border-b pb-2"><h2 className="text-sm font-semibold">Programme curriculum</h2><p className="text-muted-foreground max-w-[80ch] text-sm">The complete maintained definition: versions, required courses, choice groups and institution facts. Saving is schema-validated by both this editor and the server.</p></div>
    {error && <Alert><AlertTitle>Catalogue was not changed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <Accordion>{programmes.map((programme) => { const counts = programmeCounts(programme); return <AccordionItem key={programme.id} value={programme.id}><AccordionTrigger><span className="flex flex-1 items-baseline justify-between gap-4 pr-3 text-left"><strong>{[programme.degree, programme.name].filter(Boolean).join(' ')}</strong><small className={`text-muted-foreground ${DATA}`}>{counts.versions} versions · {counts.courses} courses · {counts.dates} dates</small></span></AccordionTrigger><AccordionContent><form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void save(programme) }}><Field><FieldLabel htmlFor={`programme-${programme.id}`}>Programme definition</FieldLabel><Textarea id={`programme-${programme.id}`} rows={22} spellCheck={false} className={DATA} value={drafts[programme.id] ?? JSON.stringify(programme, null, 2)} onChange={(event) => setDrafts((held) => ({ ...held, [programme.id]: event.target.value }))} /><FieldDescription>The route id is locked. Course ids link editions and student plans, so change them only as a deliberate migration.</FieldDescription></Field><Button type="submit" className="w-fit" disabled={Boolean(busy)}>{busy === programme.id && <Spinner data-icon="inline-start" />}{busy === programme.id ? 'Validating and saving…' : 'Save programme'}</Button></form></AccordionContent></AccordionItem> })}</Accordion>
  </section><AdminCalendar programmes={programmes} /></div>
}
