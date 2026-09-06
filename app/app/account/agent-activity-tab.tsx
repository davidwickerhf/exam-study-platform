'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { readJson } from '@/components/workspace/use-json'

type Entry = { id: string; startedAt: string; tool: string; client: string; keyId: string; method: string; route: string; operation: string; status: string; statusCode: number | null; durationMs: number | null; clientConfirmed: boolean; confirmationId: string | null }
type Activity = { items: Entry[]; nextCursor: string | null }
const labels: Record<string,string> = { read: 'Read', write: 'Write', prepare: 'Prepared change', completed: 'Completed', failed: 'Failed', running: 'No completion recorded', interrupted: 'Interrupted' }

export function AgentActivityTab() {
  const [operation, setOperation] = useState(''), [status, setStatus] = useState('')
  const [cursors, setCursors] = useState<string[]>([]), [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<Activity | null>(null), [error, setError] = useState('')
  const before = cursors.at(-1) || ''
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    readJson<Activity>(`/api/account/agent-activity?${new URLSearchParams({ operation, status, before })}`, { signal: controller.signal }).then(setData).catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Activity could not be loaded.') })
    return () => controller.abort()
  }, [operation, status, before, refresh])
  return <section className="w-full min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6"><div><h2 className="font-heading text-2xl font-semibold tracking-tight">AI activity</h2><p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">See what connected assistants read, prepare and change in your account.</p></div><Button variant="outline" size="sm" onClick={() => setRefresh(value => value + 1)}><RefreshCwIcon className="size-4" />Refresh</Button></div>
    <div className="flex flex-wrap items-center gap-3 py-5"><label className="text-sm">Activity <select aria-label="Filter activity" value={operation} onChange={event => { setOperation(event.target.value); setCursors([]) }} className="ml-2 rounded-md border bg-background px-3 py-2"><option value="">All</option><option value="read">Reads</option><option value="write">Writes</option><option value="prepare">Prepared changes</option></select></label><label className="text-sm">Result <select aria-label="Filter result" value={status} onChange={event => { setStatus(event.target.value); setCursors([]) }} className="ml-2 rounded-md border bg-background px-3 py-2"><option value="">All</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="running">No completion recorded</option><option value="interrupted">Interrupted</option></select></label></div>
    {error ? <p role="alert" className="text-destructive py-6 text-sm">{error}</p> : !data ? <Skeleton className="h-40 w-full" /> : !data.items.length ? <div className="border-y py-10"><h3 className="font-semibold">{operation || status || before ? 'No matching requests' : 'No AI activity yet'}</h3><p className="text-muted-foreground mt-2 text-sm">Requests reaching Wicker through a personal API key appear here from now on.</p></div> : <div className="divide-y border-y">{data.items.map(item => <details key={item.id} className="group"><summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 py-4"><span className="text-muted-foreground w-28 shrink-0 text-xs">{new Date(item.startedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span className="min-w-0 flex-1"><strong className="block break-words text-sm font-semibold">{item.tool ? item.tool.replaceAll('_',' ') : `${item.method} ${item.route}`}</strong><span className="text-muted-foreground mt-1 block text-xs">{labels[item.operation]} · {item.client}</span></span><span className={`text-xs ${item.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{labels[item.status]}{item.durationMs !== null ? ` · ${(item.durationMs / 1000).toFixed(1)}s` : ''}</span><span aria-hidden="true" className="text-muted-foreground text-sm group-open:rotate-90">›</span></summary><dl className="grid gap-3 bg-muted/40 p-4 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">Endpoint</dt><dd className="mt-1 break-all">{item.method} {item.route}</dd></div><div><dt className="text-muted-foreground">Result</dt><dd className="mt-1">{item.statusCode ? `HTTP ${item.statusCode}` : 'No final response recorded; the process may still be running or have been interrupted.'}</dd></div><div><dt className="text-muted-foreground">Confirmation</dt><dd className="mt-1 break-all">{item.confirmationId ? `Confirmed review: ${item.confirmationId}` : item.clientConfirmed ? 'Client reported confirmation for this request.' : item.operation === 'read' ? 'Not required for reads.' : item.operation === 'prepare' ? 'Review prepared; no proposed change applied.' : 'No confirmation reference supplied.'}</dd></div><div><dt className="text-muted-foreground">API key ID</dt><dd className="mt-1 break-all">{item.keyId}</dd></div></dl></details>)}</div>}
    {(before || data?.nextCursor) && <div className="flex justify-between gap-3 py-4"><Button variant="outline" disabled={!before} onClick={() => setCursors(values => values.slice(0,-1))}>Newer</Button><Button variant="outline" disabled={!data?.nextCursor} onClick={() => data?.nextCursor && setCursors(values => [...values,data.nextCursor!])}>Older</Button></div>}
    <p className="text-muted-foreground mt-5 max-w-3xl text-xs leading-relaxed">Tool and client names are supplied by the client. Requests are tied to the authenticated API key. Arguments, response contents, query text and credentials are not stored here. One tool can make several requests; local actions that never reach Wicker are not recorded. Activity is included in your data export and erased with your account data.</p><Link href="/app/settings?tab=api" className="text-primary mt-3 inline-block text-sm font-semibold">Manage API access →</Link>
  </section>
}
