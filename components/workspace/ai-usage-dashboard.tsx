'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useJson } from './use-json'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

type Metrics = { key:string; calls:number; inputTokens:number; outputTokens:number; totalTokens:number; cachedInputTokens:number; cacheWriteInputTokens:number; reasoningTokens:number; estimatedCostUsd:number; unknownUsageCalls:number; unpricedCalls:number; failedCalls:number }
type Call = { id:string; createdAt:string; userId:string; feature:string; model:string; payer:string; phase:string; status:string; inputTokens:number|null; outputTokens:number|null; cachedInputTokens:number|null; reasoningTokens:number|null; estimatedCostUsd:number|null; usageStatus:string; durationMs:number; responseId?:string }
type Report = { totals:Metrics; groups:Record<string,Metrics[]>; recent:Call[]; costNote:string; generatedAt:string }
const count=(n:number|null)=>n===null?'Unavailable':n.toLocaleString()
const money=(n:number|null)=>n===null?'Unpriced':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:4}).format(n)
const date=(days=0)=>new Date(Date.now()-days*86400000).toISOString().slice(0,10)
const control='h-9 rounded-md border bg-background px-3 text-sm w-full'
export function AiUsageDashboard({admin=false}:{admin?:boolean}) {
  const [filters,setFilters]=useState({from:date(29),to:date(),userId:'',feature:'',model:'',payer:''})
  const [query,setQuery]=useState(new URLSearchParams(filters).toString())
  const [group,setGroup]=useState('feature'),[metric,setMetric]=useState<'estimatedCostUsd'|'totalTokens'>('estimatedCostUsd')
  const report=useJson<Report>(`${admin?'/api/admin/ai-usage':'/api/ai/calls'}?${query}`)
  const data=report.data,rows=data?.groups[group] || [],days=data?.groups.day || []
  const maximum=Math.max(0,...days.map(d=>d[metric]))
  return <section className="min-w-0 space-y-6" aria-label={admin?'Platform AI usage':'Your AI calls'}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{admin?'AI usage':'AI call history'}</h2><p className="mt-1 text-sm text-muted-foreground">{admin?'Across users, models and features.':'Your model calls across the platform.'} Token costs in USD.</p></div><Button variant="outline" size="sm" onClick={report.reload}>Refresh usage</Button></header>
    <form className="grid grid-cols-2 gap-3 lg:grid-cols-4" onSubmit={e=>{e.preventDefault();setQuery(new URLSearchParams(filters).toString())}}>
      {(['from','to',...(admin?['userId']:[]),'feature','model'] as ('from'|'to'|'userId'|'feature'|'model')[]).map(key=><label key={key} className="min-w-0 text-xs font-medium">{{from:'From (UTC)',to:'To (UTC)',userId:'User ID',feature:'Feature',model:'Model'}[key]}<input className={`${control} mt-1`} type={key==='from'||key==='to'?'date':'text'} value={filters[key]} placeholder="All" onChange={e=>setFilters({...filters,[key]:e.target.value})}/></label>)}
      <label className="text-xs font-medium">Paid by<select className={`${control} mt-1`} value={filters.payer} onChange={e=>setFilters({...filters,payer:e.target.value})}><option value="">All</option><option value="platform">Platform</option><option value="personal">Personal key</option><option value="subscription">Subscription</option></select></label>
      <div className="flex items-end"><Button type="submit" size="sm">Apply filters</Button></div>
    </form>
    {report.error?<Alert variant="destructive"><AlertDescription>{report.error}</AlertDescription></Alert>:!data?<Skeleton className="h-56"/>:<>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-5 lg:grid-cols-4">{[['Estimated token cost',money(data.totals.estimatedCostUsd)],['Input tokens',count(data.totals.inputTokens)],['Output tokens',count(data.totals.outputTokens)],['Provider calls',count(data.totals.calls)]].map(([label,value])=><div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd></div>)}</dl>
      <p className="text-xs leading-5 text-muted-foreground">{data.costNote} {count(data.totals.unknownUsageCalls)} calls with unavailable usage · {count(data.totals.unpricedCalls)} unpriced calls · {count(data.totals.failedCalls)} failed or interrupted calls. Tracking begins when this version is deployed; earlier calls are not backfilled.</p>
      {!data.totals.calls?<p className="border-y py-10 text-sm text-muted-foreground">No AI calls in this date range. Try a wider range or clear the filters.</p>:<>
        <section aria-label="Daily AI usage" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium">Daily usage</h3><label className="text-sm">Measure <select className="ml-2 rounded-md border bg-background p-2" value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="estimatedCostUsd">Estimated cost</option><option value="totalTokens">Total tokens</option></select></label></div>
          <div className="flex h-40 items-end gap-1 border-b" role="img" aria-label={`Daily ${metric==='totalTokens'?'tokens':'estimated costs'}; exact values available below`}>{days.map(day=><div key={day.key} className="flex h-full min-w-0 flex-1 items-end" title={`${day.key}: ${metric==='totalTokens'?count(day.totalTokens):money(day.estimatedCostUsd)}`}><div className="w-full rounded-t-sm bg-primary" style={{height:maximum?`${Math.max(day[metric]>0?1:0,day[metric]/maximum*100)}%`:'0%'}}/></div>)}</div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>{days[0]?.key}</span><span>{days.at(-1)?.key}</span></div>
        </section>
        <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium">Usage breakdown</h3><label className="text-sm">Group by <select className="ml-2 rounded-md border bg-background p-2" value={group} onChange={e=>setGroup(e.target.value)}>{[['feature','Feature'],['model','Model'],...(admin?[['userId','User']]:[]),['payer','Paid by'],['phase','Generation phase'],['day','Day'],['status','Status']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
          <div className="min-w-0 overflow-x-auto"><Table><TableHeader><TableRow>{['Group','Calls','Input','Output','Cached input','Reasoning','Est. USD','Unpriced'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.key}><TableCell className="max-w-64 break-words whitespace-normal">{row.key}</TableCell>{[row.calls,row.inputTokens,row.outputTokens,row.cachedInputTokens,row.reasoningTokens].map((n,i)=><TableCell key={i} className="tabular-nums">{count(n)}</TableCell>)}<TableCell className="tabular-nums">{money(row.estimatedCostUsd)}</TableCell><TableCell>{row.unpricedCalls}</TableCell></TableRow>)}</TableBody></Table></div><p className="text-xs text-muted-foreground">Top 100 groups by estimated cost. All calls in the range contribute to totals.</p>
        </section>
        <section className="space-y-3"><h3 className="font-medium">Recent calls</h3><div className="min-w-0 overflow-x-auto"><Table><TableHeader><TableRow>{['Time (UTC)','Feature / phase',...(admin?['User']:[]),'Model / payer','Status','Input','Output','Est. USD'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{data.recent.map(call=><TableRow key={call.id}><TableCell className="whitespace-nowrap text-xs">{call.createdAt.replace('T',' ').slice(0,19)}</TableCell><TableCell>{call.feature}<small className="block text-muted-foreground">{call.phase}</small></TableCell>{admin&&<TableCell className="max-w-48 break-all whitespace-normal text-xs">{call.userId}</TableCell>}<TableCell>{call.model}<small className="block text-muted-foreground">{call.payer}</small></TableCell><TableCell>{call.status}<small className="block text-muted-foreground">{call.usageStatus}</small></TableCell><TableCell>{count(call.inputTokens)}</TableCell><TableCell>{count(call.outputTokens)}</TableCell><TableCell>{money(call.estimatedCostUsd)}</TableCell></TableRow>)}</TableBody></Table></div><p className="text-xs text-muted-foreground">Latest 100 calls. Updated {new Date(data.generatedAt).toLocaleTimeString()}.</p></section>
      </>}
    </>}
  </section>
}
