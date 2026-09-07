'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeftIcon, ChevronRightIcon, ExternalLinkIcon, RefreshCwIcon, SearchIcon, UsersIcon } from 'lucide-react'
import { useTutorSelection } from './course-tutor-entry'
import { Button } from '@/components/ui/button'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cachedWorkspaceJson, workspaceCache } from '@/hooks/use-workspace-data'
import type { CanvasGroup, CanvasGroupsPayload } from '@/lib/canvas-groups.mjs'

const key = (group:CanvasGroup) => `${group.origin}|${group.id}`
const context = (group:CanvasGroup) => group.scope === 'global' ? group.contextName || 'Global Canvas group' : [group.courseName || group.courseCode,group.academicYear || 'Year not listed'].filter(Boolean).join(' · ')

function initials(name:string) {
  const words = name.replace(/^[^()]*\(([^)]+)\)/, '$1').match(/\p{L}[\p{L}\p{M}]*/gu) || []
  return [words[0]?.[0], words.length > 1 ? words.at(-1)?.[0] : ''].filter(Boolean).join('').toLocaleUpperCase() || '?'
}

export function CanvasGroups({courseCode,academicYear}: {courseCode?:string;academicYear?:string}) {
  const [data,setData] = useState<CanvasGroupsPayload|null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState<string|null>(null)
  const [selected,setSelected] = useState('')
  const [team,setTeam] = useState<CanvasGroup|null>(null)
  const [teamLoading,setTeamLoading] = useState(false)
  const [teamError,setTeamError] = useState<string|null>(null)
  const [scope,setScope] = useState('course')
  const [search,setSearch] = useState('')
  const searchParams = useSearchParams()
  const [open,setOpen] = useState(false)
  const [revision,setRevision] = useState(0)
  const forceNext = useRef(false)
  const allGroups = data?.groups || []
  const years = [...new Set(allGroups.filter(group=>group.scope === 'course' && group.academicYear).map(group=>group.academicYear!))].sort().reverse()
  if(allGroups.some(group=>group.scope === 'course' && !group.academicYear)) years.push('undated')
  const requestedYear = searchParams.get('year')
  const year = requestedYear && years.includes(requestedYear) ? requestedYear : years[0] || 'undated'
  const yearGroups = allGroups.filter(group=>courseCode || group.scope === 'global' || (group.academicYear || 'undated') === year)
  const selectYear = (value:string) => {
    const params = new URLSearchParams(searchParams); params.set('year',value)
    history.replaceState(null,'',`/app/groups?${params}`)
    setSelected('');setOpen(false)
  }
  const groups = yearGroups.filter(group=>(courseCode || group.scope === scope) && `${group.name} ${group.courseName || ''} ${group.courseCode || ''} ${group.contextName || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const inline = Boolean(courseCode && allGroups.length === 1)
  const chosen = allGroups.find(group=>key(group) === selected) || (inline ? allGroups[0] : undefined)
  const sections = new Map<string,{title:string;year:string|null;groups:CanvasGroup[]}>()
  for(const group of groups) {
    const id = group.scope === 'global' ? `global:${group.origin}` : `${group.origin}:${group.courseId}:${group.academicYear}`
    if(!sections.has(id)) sections.set(id,{title:group.scope === 'global' ? 'Global groups' : group.courseName || group.courseCode || 'Course team',year:group.scope === 'course' ? group.academicYear || 'Year not listed' : null,groups:[]})
    sections.get(id)!.groups.push(group)
  }
  useTutorSelection('groups',chosen ? {kind:'group',title:chosen.name,groupId:chosen.id,canvasUrl:chosen.origin} : undefined)
  const query = new URLSearchParams(courseCode ? {courseCode,academicYear:academicYear || 'all'} : {})
  const path = `/api/integrations/canvas/groups?${query}`
  useEffect(()=>{
    let live=true
    const force=forceNext.current;forceNext.current=false
    setLoading(true);setError(null);setTeam(null)
    cachedWorkspaceJson<CanvasGroupsPayload>(`${path}${force?'&refresh=1':''}`,force).then(result=>{if(live)setData(result)}).catch(()=>{if(live)setError('Your Canvas groups could not be loaded. Try again, or check your connection in Settings.')}).finally(()=>{if(live)setLoading(false)})
    return ()=>{live=false}
  },[path,revision])
  const selectedKey=chosen ? key(chosen) : ''
  useEffect(()=>{
    let live=true
    setTeam(null);setTeamError(null)
    if(!chosen || !inline && !open){setTeamLoading(false);return}
    setTeamLoading(true)
    const params=new URLSearchParams(query);params.set('groupId',chosen.id);params.set('canvasUrl',chosen.origin)
    cachedWorkspaceJson<CanvasGroupsPayload>(`/api/integrations/canvas/groups?${params}`).then(result=>{
      if(!live)return
      const updated=result.groups.find(group=>key(group)===selectedKey)
      setTeam(updated || null)
      if(!updated || updated.membersStatus !== 'loaded')setTeamError(result.problems.find(problem=>problem.part === 'members')?.message || 'The member list could not be loaded. Open this group in Canvas or refresh to try again.')
    }).catch(()=>{if(live)setTeamError('The member list could not be loaded. Open this group in Canvas or refresh to try again.')}).finally(()=>{if(live)setTeamLoading(false)})
    return ()=>{live=false}
  },[selectedKey,path,data,open,inline])
  useEffect(()=>{setSelected('');setOpen(false);setData(null)},[path])
  const refresh=()=>{workspaceCache.invalidate(key=>key.startsWith('/api/integrations/canvas/groups'));forceNext.current=true;setRevision(value=>value+1)}
  const active=team && chosen && key(team)===key(chosen) ? team : chosen
  const members = <div className="px-5 py-4 sm:px-6">
    <div className="mb-2 flex items-center justify-between gap-4"><h4 className="font-semibold">Members</h4><span className="text-xs text-muted-foreground">{teamLoading?'Loading…':active?.membersStatus==='loaded'?`${active.members?.length || 0} members`:active?.memberCount != null?`${active.memberCount} listed by Canvas`:''}</span></div>
    {teamLoading || !teamError && active?.membersStatus==='not-loaded' ? <div role="status" aria-label="Loading teammates" className="space-y-3 py-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-full"/></div> : teamError ? <div role="alert" className="py-3 text-sm leading-6 text-muted-foreground">{teamError}</div> : active?.membersStatus==='loaded' && active.members?.length ? <ul aria-label="Group members" className="divide-y">{active.members.map(member=><li key={member.id} className="flex min-h-14 items-center gap-3 py-3"><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials(member.name)}</span><span className="min-w-0 break-words text-sm font-medium">{member.name}</span>{member.isYou&&<span className="ml-auto shrink-0 text-xs text-muted-foreground">You</span>}</li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">Canvas returned no visible members for this group.</p>}
  </div>
  const canvasLink = active && <a href={active.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline">Open in Canvas<ExternalLinkIcon className="size-4"/></a>
  return <section aria-label={courseCode?'Your course groups':'Your Canvas groups'} className="min-w-0">
    {!courseCode&&<Link href="/app/courses" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4"/>All courses</Link>}
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>{courseCode?<h2 className="text-2xl font-semibold tracking-tight">Groups</h2>:<h1 className="text-3xl font-semibold tracking-tight">Your groups</h1>}<p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{courseCode?'Your team and teammates for this course.':'Find your course team or community, then see who’s in it.'}</p></div>
      <div className="flex flex-wrap items-end gap-3">{!courseCode && scope==='course' && <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Academic year<select aria-label="Academic year" value={year} onChange={event=>selectYear(event.target.value)} disabled={!years.length} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground">{years.length?years.map(value=><option key={value} value={value}>{value==='undated'?'Year not listed':value}</option>):<option value="undated">No course years</option>}</select></label>}<Button variant="outline" size="sm" disabled={loading||teamLoading} onClick={refresh}><RefreshCwIcon className="size-4"/>Refresh groups</Button>{courseCode&&<Link className="text-sm font-semibold text-primary hover:underline" href="/app/groups">All Canvas groups</Link>}</div>
    </header>
    {loading && !data ? <div role="status" aria-label="Loading Canvas groups" className="space-y-4"><Skeleton className="h-11 w-full"/><Skeleton className="h-40 w-full"/></div> : error ? <div role="alert" className="border-y py-5 text-sm">{error}<Button variant="outline" className="ml-3" onClick={refresh}>Try again</Button></div> : !data?.connected ? <div className="border-y py-8"><h3 className="font-semibold">Connect Canvas to see your teammates</h3><p className="mt-2 text-sm text-muted-foreground">Your groups will appear here once Canvas is connected.</p><Link href="/app/settings?tab=connections" className="mt-4 inline-block text-sm font-semibold text-primary">Connect Canvas</Link></div> : <>
      {!!data.problems.length&&<div role="alert" className="mb-5 rounded-md border p-4 text-sm leading-6"><strong>Some groups could not be checked.</strong><p className="text-muted-foreground">{data.problems[0].message}</p></div>}
      {inline && active ? <article className="rounded-lg border bg-card"><header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6"><div><h3 className="break-words text-lg font-semibold">{active.name}</h3><p className="mt-1 text-sm text-muted-foreground">{context(active)}</p></div>{canvasLink}</header>{members}</article> : <>
        <div className="mb-5 space-y-4">
          {!courseCode&&<div className="flex flex-wrap gap-1 border-b" role="group" aria-label="Group type">{[['course','Course teams'],['global','Global groups']].map(([value,label])=><button key={value} className={`min-h-11 border-b-2 px-2 text-[13px] font-medium transition-colors sm:px-3 sm:text-sm ${scope===value?'border-primary text-primary':'border-transparent text-muted-foreground hover:text-foreground'}`} aria-pressed={scope===value} onClick={()=>setScope(value)}>{label}<span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{yearGroups.filter(group=>group.scope===value).length}</span></button>)}</div>}
          <div className="flex flex-wrap items-center gap-3"><label className="relative min-w-0 flex-1 basis-60"><SearchIcon className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"/><input aria-label="Find a group or course" placeholder="Find a group or course" value={search} onChange={event=>setSearch(event.target.value)} className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm"/></label></div>
        </div>
        {!groups.length ? <div className="border-y py-9"><h3 className="font-semibold">{search?'No matching groups':data.problems.length?'Group membership is not confirmed':courseCode&&!data.matchedCourses.length?'No connected Canvas course for this year':'No memberships found'}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{search?'Try another group name, course or academic year.':data.problems.length?'We could not read every membership. Refresh or check Canvas.':'Canvas has not returned any memberships for this selection.'}</p>{(search)&&<Button variant="outline" className="mt-4" onClick={()=>setSearch('')}>Clear filters</Button>}</div> : <Sheet open={open} onOpenChange={setOpen}>
          <div className="space-y-6">{[...sections].map(([id,section])=><section key={id} aria-label={`${section.title}${section.year?` · ${section.year}`:''}`}><header className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"><h3 className="text-sm font-semibold">{section.title}</h3>{section.year&&<span className="text-xs text-muted-foreground">{section.year}</span>}</header><ul className="divide-y border-y">{section.groups.map(group=><li key={key(group)}><SheetTrigger render={<button/>} onClick={()=>setSelected(key(group))} aria-label={`View members of ${group.name}`} className="group flex min-h-16 w-full items-center gap-4 px-2 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"><UsersIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 break-words text-sm font-medium">{group.name}</span><span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span>{group.memberCount==null?'View members':`${group.memberCount} members`}</span><ChevronRightIcon className="size-4"/></span></SheetTrigger></li>)}</ul></section>)}</div>
          <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"><SheetHeader className="border-b p-5 pr-12 sm:p-6 sm:pr-12"><SheetTitle className="break-words text-xl font-semibold">{active?.name || 'Group members'}</SheetTitle><SheetDescription className="mt-2">{active?context(active):''}</SheetDescription></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto">{members}</div><footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">{canvasLink}<Button variant="ghost" size="sm" disabled={loading||teamLoading} onClick={refresh}><RefreshCwIcon className="size-4"/>Refresh members</Button></footer></SheetContent>
        </Sheet>}
      </>}
      <p className="mt-5 text-xs leading-5 text-muted-foreground">From Canvas · Refresh to check for membership changes.</p>
    </>}
  </section>
}
