'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, RefreshCwIcon } from 'lucide-react'
import { useWorkspaceData } from '@/hooks/use-workspace-data'
import type { CourseProfile } from '@/lib/workspace/courses.mjs'
import { homePriorities, type CalendarPayload } from '@/lib/workspace/home.mjs'
import { supportedCourseAssessment } from '@/lib/course-rule-evidence.mjs'
import { PriorityRow } from '@/components/workspace/priority-row'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

type Inputs = NonNullable<Parameters<typeof homePriorities>[0]>
type RuleCourse = {id:string;code:string;name?:string;archived?:boolean;priorityScan?:{status:string;scannedAt?:string};courseProfile?:(CourseProfile & {priorityExtractionCoverage?:string})|null}
type Shell = {priorityCourses?:RuleCourse[];courses?:RuleCourse[]}
const dateLabel=(date?:string|null)=>date ? new Date(date).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}) : 'Not checked yet'
export default function PrioritiesPage() {
  const calendar=useWorkspaceData<CalendarPayload>('/api/calendar/events')
  const hub=useWorkspaceData<{connected:boolean;assignments:Inputs['assignments']}>('/api/integrations/canvas/hub?scope=current&days=120&parts=assignments')
  const shell=useWorkspaceData<Shell>('/api/workspace-shell')
  const [course,setCourse]=useState('all'),[kind,setKind]=useState('all'),[query,setQuery]=useState('')
  const courses=useMemo(()=>(shell.data?.priorityCourses ?? shell.data?.courses ?? []).filter(c=>!c.archived),[shell.data])
  const priorities=useMemo(()=>homePriorities({events:calendar.data?.events,assignments:hub.data?.assignments,courses,limit:Infinity}),[calendar.data,hub.data,courses])
  const visible=priorities.filter(p=>(course==='all'||p.courseCode===course)&&(kind==='all'||p.kind===kind)&&`${p.title} ${p.detail} ${p.courseCode}`.toLowerCase().includes(query.toLowerCase()))
  const codes=[...new Set([...courses.map(c=>c.code),...priorities.map(p=>p.courseCode)].filter(Boolean))] as string[]
  const covered=courses.filter(c=>supportedCourseAssessment(c)).length
  const loading=[calendar,hub,shell].some(r=>r.loading),errors=[calendar,hub,shell].map(r=>r.error?.message).filter(Boolean)
  const refresh=()=>{calendar.refresh();hub.refresh();shell.refresh()}
  return <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 sm:py-8">
    <Link href="/app" className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeftIcon className="size-3.5"/>Study desk</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Your priorities</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Deadlines, exams and attendance requirements across your courses. Recurring sessions share one entry; urgent submissions come first.</p></div>
      <Button variant="outline" size="sm" onClick={refresh} disabled={loading}><RefreshCwIcon className="size-3.5"/>Refresh list</Button>
    </header>
    {errors.length>0 && <p role="alert" className="my-4 rounded-lg border border-destructive/30 p-4 text-sm">Some sources could not be read. This list is incomplete. {errors.join(' ')}</p>}
    <section aria-label="Priority filters" className="my-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
      <div className="space-y-2"><Label htmlFor="priority-search">Search priorities</Label><Input id="priority-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Course, requirement or deadline"/></div>
      <div className="space-y-2"><Label id="priority-course-label">Course</Label><Select value={course} onValueChange={v=>v&&setCourse(v)}><SelectTrigger aria-labelledby="priority-course-label" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All courses</SelectItem>{codes.map(code=><SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label id="priority-kind-label">Type</Label><Select value={kind} onValueChange={v=>v&&setKind(v)}><SelectTrigger aria-labelledby="priority-kind-label" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[['all','All priorities'],['attendance','Attendance'],['assignment','Assignments'],['exam','Exams'],['project','Milestones']].map(([id,title])=><SelectItem key={id} value={id}>{title}</SelectItem>)}</SelectContent></Select></div>
    </section>
    <div className="mb-3 flex justify-between text-xs text-muted-foreground"><span>{visible.length} of {priorities.length} priorities</span><Link href="/app/calendar" className="text-primary">Open calendar →</Link></div>
    <section aria-label="All priorities" className="overflow-hidden rounded-xl border bg-card">
      {loading&&!priorities.length ? <div className="space-y-4 p-6"><Skeleton className="h-6 w-2/3"/><Skeleton className="h-20 w-full"/></div> : visible.length ? <ul>{visible.map(item=><PriorityRow key={item.id} item={{...item,dueText:item.dueAt ? dateLabel(item.dueAt) : 'Date not recorded'}}/>)}</ul> : <p className="p-6 text-sm text-muted-foreground">{priorities.length ? 'No priorities match these filters.' : 'No actionable priorities were found in the loaded sources. Check the course coverage below before assuming there are no obligations.'}</p>}
    </section>
    <section aria-label="Course evidence coverage" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3"><h2 className="text-base font-semibold">Course rules &amp; coverage</h2><span className="text-xs text-muted-foreground">{covered} of {courses.length} courses with supported rules</span></div>
      <p className="my-4 text-sm leading-6 text-muted-foreground">Automatic scans run after material collection and regularly while Canvas refresh is enabled. Unchanged evidence is reused. The list covers the calendar and Canvas records currently available; undated requirements and conflicts appear below.</p>
      <div className="divide-y rounded-xl border bg-card">{courses.map(c=>{
        const assessment=c.courseProfile?.assessment
        const conflicts=(assessment as {conflicts?:{title:string;detail:string}[]}|undefined)?.conflicts || []
        const rules=assessment?.attendanceRules || []
        return <details key={c.id} className="px-5 py-4"><summary className="cursor-pointer text-sm font-semibold">{c.code} · {c.name || c.code}<span className="ml-3 text-xs font-normal text-muted-foreground">{c.priorityScan?.status==='needs-review' ? 'Needs review' : supportedCourseAssessment(c) ? 'Supported rules available' : 'Rules incomplete or unavailable'}</span></summary>
          <p className="mt-3 text-xs text-muted-foreground">Last source check: {dateLabel(c.priorityScan?.scannedAt)}</p>
          {c.courseProfile?.priorityExtractionCoverage && <p className="mt-1 text-xs text-muted-foreground">Coverage: {c.courseProfile.priorityExtractionCoverage}</p>}
          {rules.length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{rules.map((rule,i)=><li key={i}>{rule}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No attendance rule is established here. This does not mean attendance is optional.</p>}
          {assessment?.components?.filter(component=>!component.deadline).map((component,i)=><p key={i} className="mt-3 text-sm">{component.name}: {component.deadlineText || 'No date established'}{component.notes ? ` · ${component.notes}` : ''}</p>)}
          {conflicts.map((conflict,i)=><p key={`conflict-${i}`} className="mt-3 border-l-2 border-destructive pl-3 text-sm"><strong>{conflict.title}: </strong>{conflict.detail}</p>)}
          <Link href={`/app/courses/${encodeURIComponent(c.id)}?tab=attendance`} className="mt-4 inline-flex text-xs font-semibold text-primary">Inspect course rules and materials →</Link>
        </details>
      })}{!courses.length && !loading && <p className="p-5 text-sm text-muted-foreground">No programme courses are available yet.</p>}</div>
      <div className="mt-5 flex flex-wrap gap-3"><Link href="/app/settings?tab=connections" className={buttonVariants({variant:'outline',size:'sm'})}>Manage automatic updates</Link><Link href="/app/settings?tab=ai-key" className={buttonVariants({variant:'ghost',size:'sm'})}>AI allowance</Link></div>
    </section>
  </main>
}
