'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, MinusIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  type Objective,
  type PlannerCourse,
  type PlannerWorkspace,
  groupOpenCourses,
  isPassed,
  objectiveFor,
  plannerSummary,
  planningInsights,
  resetObjectives,
  withObjective
} from '@/lib/workspace/planner.mjs'

const DATA = 'font-data tabular-nums'
const LABEL = 'text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase'

type AcademicState = { workspace: PlannerWorkspace }

async function readResponse(response: Response): Promise<AcademicState> {
  const body = await response.json().catch(() => null) as AcademicState & { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `Your record returned ${response.status}`)
  if (!body?.workspace) throw new Error('Your record returned no active programme.')
  return body
}

function Measure({ label, value, unit, detail }: { label: string; value: string | number; unit?: string; detail: string }) {
  return (
    <div className="flex min-w-36 flex-col gap-1 border-l pl-4 first:border-l-0 first:pl-0">
      <span className={LABEL}>{label}</span>
      <strong className={`text-2xl font-semibold tracking-tight ${DATA}`}>
        {value}{unit && <small className="text-muted-foreground ml-1 text-sm font-medium">{unit}</small>}
      </strong>
      <span className="text-muted-foreground text-xs">{detail}</span>
    </div>
  )
}

function RecordedStatus({ course }: { course: PlannerCourse }) {
  if (isPassed(course)) return <span className="inline-flex items-center gap-1.5 text-sm font-medium"><CheckIcon className="text-primary size-3.5" />Passed</span>
  const upcoming = course.attempts.some((attempt) => attempt.status === 'upcoming')
  if (upcoming) return <span className="text-sm">Registered</span>
  if (course.attempts.some((attempt) => attempt.status === 'failed')) return <span className="inline-flex items-center gap-1.5 text-sm font-medium"><MinusIcon className="size-3.5" />Failed</span>
  return <span className="text-muted-foreground text-sm">Not recorded</span>
}

function Choice({ value, disabled, label, options, onChange }: { value: string; disabled?: boolean; label: string; options: [string, string][]; onChange: (value: string) => void }) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => { if (next) onChange(String(next)) }}>
      <SelectTrigger size="sm" aria-label={label} className="min-w-30 rounded-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([id, copy]) => <SelectItem key={id} value={id}>{copy}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function daysLabel(days: number | null) {
  if (days === null) return 'No exam date'
  if (days < 0) return `${Math.abs(days)} days ago`
  if (days === 0) return 'Today'
  return `In ${days} day${days === 1 ? '' : 's'}`
}

export function PlanningPlanner() {
  const [workspace, setWorkspace] = useState<PlannerWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/academics', { headers: { accept: 'application/json' } })
      .then(readResponse)
      .then((state) => { if (live) setWorkspace(state.workspace) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  const summary = useMemo(() => workspace ? plannerSummary(workspace) : null, [workspace])
  const insights = useMemo(() => workspace ? planningInsights(workspace) : null, [workspace])
  const groups = useMemo(() => groupOpenCourses(summary?.openCourses ?? []), [summary])

  const save = async (next: PlannerWorkspace) => {
    if (!workspace || saving) return
    const previous = workspace
    setWorkspace(next)
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/academics', {
        method: 'PUT',
        headers: { accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: next, expectedRevision: previous.revision })
      })
      const state = await readResponse(response)
      setWorkspace(state.workspace)
    } catch (cause) {
      setWorkspace(previous)
      setError(cause instanceof Error ? cause.message : 'The scenario could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const change = (courseId: string, patch: Partial<Objective>) => {
    if (workspace) void save(withObjective(workspace, courseId, patch))
  }

  if (!workspace && error) {
    return <Empty><EmptyHeader><EmptyTitle>The scenario could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty>
  }
  if (!workspace || !summary || !insights) return <div className="flex flex-col gap-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>

  const highest = insights.priority[0]
  return (
    <div className="flex flex-col gap-8" aria-busy={saving}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="flex max-w-[68ch] flex-col gap-1">
          <h2 className="font-heading text-3xl leading-none tracking-tight">Scenario planner</h2>
          <p className="text-muted-foreground text-sm">Plan which courses you will sit and assume outcomes to see projected credits and requirements. Recorded grades are never changed.</p>
        </div>
        {summary.plannedCount > 0 && <Button variant="outline" size="sm" disabled={saving} onClick={() => void save(resetObjectives(workspace))}>Reset scenario</Button>}
      </header>

      <div className="grid gap-5 border-b pb-6 sm:grid-cols-2 xl:grid-cols-4">
        <Measure label="Projected credits" value={summary.projectedCredits} unit={`/ ${summary.totalCredits}`} detail={`${summary.earnedCredits} earned today`} />
        <Measure label="Requirements" value={workspace.gates.length ? summary.projectedGates : '—'} unit={workspace.gates.length ? `/ ${workspace.gates.length}` : undefined} detail={workspace.gates.length ? 'Met in this scenario' : 'None configured'} />
        <Measure label="Open courses" value={summary.openCourses.length} detail={`${summary.plannedCount} with planned outcomes`} />
        <Measure label="Highest risk" value={highest?.course.code || highest?.course.name || '—'} detail={highest ? (highest.days === null ? 'No exam date' : `${highest.days} days to exam`) : 'No open courses'} />
      </div>

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <main className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Assumptions</h3>
            <p className="text-muted-foreground text-sm">Passed courses are fixed. Set how you plan to sit each open course and the outcome to assume.</p>
          </div>
          {groups.length ? groups.map((group) => (
            <section key={group.level} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between border-b pb-2">
                <h4 className="text-sm font-semibold">{group.level}</h4>
                <span className={`text-muted-foreground text-sm ${DATA}`}>{group.courses.length} open · {group.ects} ECTS</span>
              </div>
              <Table>
                <TableHeader><TableRow className={LABEL}><TableHead>Code</TableHead><TableHead>Course</TableHead><TableHead className="text-right">ECTS</TableHead><TableHead>Recorded</TableHead><TableHead>Plan</TableHead><TableHead>Assume</TableHead></TableRow></TableHeader>
                <TableBody>{group.courses.map((course) => {
                  const objective = objectiveFor(workspace, course.id)
                  return (
                    <TableRow key={course.id} className={objective.mode === 'none' ? 'opacity-55' : undefined}>
                      <TableCell className={`font-semibold ${DATA}`}>{course.code || '—'}</TableCell>
                      <TableCell className="min-w-52 whitespace-normal font-medium">{course.name}</TableCell>
                      <TableCell className={`text-right ${DATA}`}>{course.ects}</TableCell>
                      <TableCell><RecordedStatus course={course} /></TableCell>
                      <TableCell><Choice value={objective.mode} disabled={saving} label={`Plan for ${course.name}`} options={[["current", "Current sit"], ["resit", "Planned resit"], ["none", "Do not sit"]]} onChange={(mode) => change(course.id, { mode: mode as Objective['mode'] })} /></TableCell>
                      <TableCell><Choice value={objective.outcome} disabled={saving || objective.mode === 'none'} label={`Assumed outcome for ${course.name}`} options={[["actual", "As recorded"], ["pass", "Pass"], ["fail", "Fail"]]} onChange={(outcome) => change(course.id, { outcome: outcome as Objective['outcome'] })} /></TableCell>
                    </TableRow>
                  )
                })}</TableBody>
              </Table>
            </section>
          )) : <Empty><EmptyHeader><EmptyTitle>Nothing left to simulate</EmptyTitle><EmptyDescription>Every course in this record has a passed attempt.</EmptyDescription></EmptyHeader></Empty>}
        </main>

        <aside className="flex flex-col gap-7 border-t pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Focus order</h3>
            {insights.priority.length ? <ol className="flex flex-col gap-3">{insights.priority.slice(0, 8).map((item, index) => <li key={item.course.id} className="grid grid-cols-[1.5rem_1fr] gap-2"><span className={`text-muted-foreground text-sm ${DATA}`}>{index + 1}</span><span className="flex flex-col"><strong className={`text-sm ${DATA}`}>{item.course.code || item.course.name}</strong><small className="text-muted-foreground">{daysLabel(item.days)} · {item.course.ects} ECTS</small></span></li>)}</ol> : <p className="text-muted-foreground text-sm">No open courses in this scenario.</p>}
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Load per period</h3>
            {insights.periods.length ? <ul className="flex flex-col gap-2">{insights.periods.map((item) => <li key={item.period} className="flex justify-between gap-3 border-b pb-2 text-sm"><strong>{item.period}</strong><span className={`text-muted-foreground ${DATA}`}>{item.count} course{item.count === 1 ? '' : 's'} · {item.ects} ECTS</span></li>)}</ul> : <p className="text-muted-foreground text-sm">No open periods.</p>}
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Shortest route to credit targets</h3>
            {insights.minimumPaths.length ? <ul className="flex flex-col gap-3">{insights.minimumPaths.map((item) => <li key={item.gate.id} className="flex flex-col gap-0.5"><strong className="text-sm">{item.gate.label}</strong><span className="text-muted-foreground text-xs">{item.gap} ECTS short · {item.courses.map((course) => course.code || course.name).join(', ') || 'no eligible courses'}</span></li>)}</ul> : <p className="text-muted-foreground text-sm">{workspace.gates.length ? 'Every credit target is already met.' : 'Add credit requirements in Progress to see the shortest path.'}</p>}
          </section>
        </aside>
      </div>

      {error && <Alert><AlertTitle>Changes could not be saved</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  )
}
