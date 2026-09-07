'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ExternalLinkIcon, RefreshCwIcon, UsersIcon } from 'lucide-react'
import { useTutorSelection } from './course-tutor-entry'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cachedWorkspaceJson, workspaceCache } from '@/hooks/use-workspace-data'
import type { CanvasGroup, CanvasGroupsPayload } from '@/lib/canvas-groups.mjs'

const key = (group:CanvasGroup) => `${group.origin}|${group.id}`
const context = (group:CanvasGroup) => group.scope === 'global' ? group.contextName || 'Global Canvas group' : [group.courseName || group.courseCode,group.academicYear || 'Year not listed'].filter(Boolean).join(' · ')

export function CanvasGroups({courseCode,academicYear}: {courseCode?:string;academicYear?:string}) {
  const [data,setData] = useState<CanvasGroupsPayload|null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState<string|null>(null)
  const [selected,setSelected] = useState('')
  const [team,setTeam] = useState<CanvasGroup|null>(null)
  const [teamLoading,setTeamLoading] = useState(false)
  const [teamError,setTeamError] = useState<string|null>(null)
  const [scope,setScope] = useState('all')
  const [revision,setRevision] = useState(0)
  const forceNext = useRef(false)
  const groups = (data?.groups || []).filter(group=>scope === 'all' || group.scope === scope)
  const chosen = groups.find(group=>key(group) === selected) || groups[0]
  useTutorSelection('groups',chosen ? {kind:'group',title:chosen.name,groupId:chosen.id,canvasUrl:chosen.origin} : undefined)
  const query = new URLSearchParams(courseCode ? {courseCode,academicYear:academicYear || 'all'} : {})
  const path = `/api/integrations/canvas/groups?${query}`
  useEffect(()=>{
    let live=true
    const force=forceNext.current;forceNext.current=false
    setLoading(true);setError(null);setData(null);setTeam(null);setSelected('')
    cachedWorkspaceJson<CanvasGroupsPayload>(`${path}${force?'&refresh=1':''}`,force).then(result=>{if(live)setData(result)}).catch(()=>{if(live)setError('Your Canvas groups could not be loaded. Try again, or check your connection in Settings.')}).finally(()=>{if(live)setLoading(false)})
    return ()=>{live=false}
  },[path,revision])
  const selectedKey=chosen ? key(chosen) : ''
  useEffect(()=>{
    let live=true
    setTeam(null);setTeamError(null)
    if(!chosen){setTeamLoading(false);return}
    setTeamLoading(true)
    const params=new URLSearchParams(query);params.set('groupId',chosen.id);params.set('canvasUrl',chosen.origin)
    cachedWorkspaceJson<CanvasGroupsPayload>(`/api/integrations/canvas/groups?${params}`).then(result=>{
      if(!live)return
      const updated=result.groups.find(group=>key(group)===selectedKey)
      setTeam(updated || null)
      if(!updated || updated.membersStatus !== 'loaded')setTeamError(result.problems.find(problem=>problem.part === 'members')?.message || 'The member list could not be loaded. Open this group in Canvas or refresh to try again.')
    }).catch(()=>{if(live)setTeamError('The member list could not be loaded. Open this group in Canvas or refresh to try again.')}).finally(()=>{if(live)setTeamLoading(false)})
    return ()=>{live=false}
  },[selectedKey,path,data])
  const refresh=()=>{workspaceCache.invalidate(key=>key.startsWith('/api/integrations/canvas/groups'));forceNext.current=true;setRevision(value=>value+1)}
  const active=team && chosen && key(team)===key(chosen) ? team : chosen
  return <section aria-label={courseCode?'Your course groups':'Your Canvas groups'} className="min-w-0">
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-2xl font-semibold tracking-tight">{courseCode?'Groups':'Your groups'}</h2><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{courseCode?'Your team for this course, with membership kept separate by academic year.':'Your course teams and global communities from connected Canvas accounts.'}</p></div>
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" disabled={loading||teamLoading} onClick={refresh}><RefreshCwIcon className="size-4"/>Refresh groups</Button>{courseCode&&<Link className="text-sm font-semibold text-primary hover:underline" href="/app/groups">All Canvas groups</Link>}</div>
    </header>
    {loading ? <div role="status" aria-label="Loading Canvas groups" className="space-y-4"><Skeleton className="h-12 w-64"/><Skeleton className="h-48 w-full"/></div> : error ? <div role="alert" className="rounded-lg border p-5 text-sm">{error}<Button variant="outline" className="ml-3" onClick={refresh}>Try again</Button></div> : !data?.connected ? <div className="rounded-lg border p-6"><UsersIcon className="mb-3 size-6 text-muted-foreground"/><h3 className="font-semibold">Connect Canvas to see your teammates</h3><p className="mt-2 text-sm text-muted-foreground">Your groups will appear here once Canvas is connected.</p><Link href="/app/settings?tab=connections" className="mt-4 inline-block text-sm font-semibold text-primary">Connect Canvas</Link></div> : <>
      {!!data.problems.length&&<div role="alert" className="mb-5 rounded-lg border p-4 text-sm leading-6"><strong>Some groups could not be checked.</strong><p className="text-muted-foreground">{data.problems[0].message}</p></div>}
      {!courseCode&&<div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Group type">{[['all','All groups'],['course','Course teams'],['global','Global groups']].map(([value,label])=><Button key={value} variant={scope===value?'secondary':'ghost'} size="sm" aria-pressed={scope===value} onClick={()=>{setScope(value);setSelected('')}}>{label}</Button>)}</div>}
      {groups.length>1&&<label className="mb-6 block max-w-xl text-sm font-medium">Your group<select aria-label="Your group" className="mt-2 block h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={selectedKey} onChange={event=>setSelected(event.target.value)}>{groups.map(group=><option key={key(group)} value={key(group)}>{group.name} · {context(group)}</option>)}</select></label>}
      {!active ? <div className="border-y py-9"><h3 className="font-semibold">{data.problems.length?'Group membership is not confirmed':courseCode&&!data.matchedCourses.length?'No connected Canvas course for this year':'No memberships found'}</h3><p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{data.problems.length?'We could not read every membership. Refresh or check Canvas before assuming you have no group.':courseCode?'Canvas has not returned a group for you in this course edition. Check the selected academic year or your membership in Canvas.':'Canvas has not returned any memberships in this category.'}</p></div> : <article className="overflow-hidden rounded-xl border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6"><div className="min-w-0"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{active.scope==='course'?'Course team':'Global group'}</p><h3 className="break-words text-xl font-semibold">{active.name}</h3><p className="mt-1 text-sm text-muted-foreground">{context(active)}</p></div><a href={active.url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-primary hover:underline">Open in Canvas<ExternalLinkIcon className="size-4"/></a></header>
        <div className="p-5 sm:p-6"><div className="mb-2 flex items-center justify-between gap-4"><h4 className="font-semibold">Members</h4><span className="text-xs text-muted-foreground">{teamLoading?'Loading…':active.membersStatus==='loaded'?`${active.members?.length || 0} members`:active.memberCount===null?'':`${active.memberCount} listed by Canvas`}</span></div>
          {teamLoading?<div role="status" aria-label="Loading teammates" className="space-y-3 py-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-full"/></div>:teamError?<div role="alert" className="py-3 text-sm leading-6 text-muted-foreground">{teamError}</div>:active.membersStatus==='loaded'&&active.members?.length?<ul aria-label="Group members" className="divide-y">{active.members.map(member=><li key={member.id} className="flex min-h-16 items-center gap-3 py-3"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{member.name.split(' ').map(word=>word[0]).slice(0,2).join('')}</span><span className="min-w-0 break-words text-sm font-medium">{member.name}</span>{member.isYou&&<span className="ml-auto rounded bg-muted px-2 py-1 text-xs text-muted-foreground">You</span>}</li>)}</ul>:<p className="py-4 text-sm text-muted-foreground">Canvas returned no visible members for this group.</p>}
        </div>
      </article>}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Read from Canvas · updates cached for up to 10 minutes. Manage membership in Canvas.</p>
    </>}
  </section>
}
