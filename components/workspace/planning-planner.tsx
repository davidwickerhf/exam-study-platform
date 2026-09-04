'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, ArrowRightIcon, CalendarDaysIcon, CheckIcon, GripVerticalIcon, LockIcon, RotateCcwIcon, TargetIcon } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { courseStatus } from '@/lib/workspace/academics.mjs'
import {
  type Objective, type PlannerAcademicPeriod, type PlannerCourse, type PlannerWorkspace,
  objectiveFor, plannerSummary, planningDestinations, withObjective
} from '@/lib/workspace/planner.mjs'

const DATA = 'font-data tabular-nums'
const LABEL = 'text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase'
const CARRY_ID = 'following-year'
const CONTINUOUS_ID = 'continuous-work'

type AcademicState = { workspace: PlannerWorkspace }
type BoardSession = {
  id: string
  label: string
  eyebrow: string
  range: string
  period: number | null
  semester?: number | null
  resit: boolean
  carry?: boolean
  startsAt?: string | null
  endsAt?: string | null
}
type BoardMove = { courseId: string; from: string; to: string }

async function readResponse(response: Response): Promise<AcademicState> {
  const body = await response.json().catch(() => null) as AcademicState & { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `Your record returned ${response.status}`)
  if (!body?.workspace) throw new Error('Your record returned no active programme.')
  return body
}

function yearNumber(label: string | null | undefined) {
  const match = String(label ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}

function periodNumber(label: string | null | undefined) {
  const match = String(label ?? '').match(/period\s*(\d+)/i)
  return match ? Number(match[1]) : null
}

function shiftAcademicYear(value: string | undefined, amount: number) {
  const match = String(value ?? '').match(/(\d{4})\D+(\d{4})/)
  if (!match) return value || ''
  return `${Number(match[1]) + amount}–${Number(match[2]) + amount}`
}

function dateLabel(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parsed)
}

function dateRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return 'Date not recorded'
  if (!end || end === start) return dateLabel(start)
  return `${dateLabel(start)} – ${dateLabel(end)}`
}

function currentStudyYear(workspace: PlannerWorkspace) {
  return workspace.programmeTemplate?.currentStudyYear
    || workspace.courses.find((course) => courseStatus(course) !== 'passed')?.yearLevel
    || workspace.courses[0]?.yearLevel
    || 'Unassigned'
}

function yearAcademicLabel(workspace: PlannerWorkspace, selectedYear: string, years: string[]) {
  const selected = yearNumber(selectedYear)
  const current = yearNumber(currentStudyYear(workspace))
  if (selected !== null && current !== null) return shiftAcademicYear(workspace.profile?.academicYear, selected - current)
  const currentIndex = Math.max(0, years.indexOf(currentStudyYear(workspace)))
  return shiftAcademicYear(workspace.profile?.academicYear, Math.max(0, years.indexOf(selectedYear) - currentIndex))
}

function sessionsFor(workspace: PlannerWorkspace, selectedYear: string, courses: PlannerCourse[], years: string[]): BoardSession[] {
  const targetAcademicYear = yearAcademicLabel(workspace, selectedYear, years)
  const examPeriods = ((workspace.planning?.academicPeriods ?? []) as PlannerAcademicPeriod[])
    .filter((item) => item.kind === 'exam-week' || item.kind === 'resit-week')
    .filter((item) => !targetAcademicYear || !item.academicYear || item.academicYear.replace('-', '–') === targetAcademicYear.replace('-', '–'))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))

  const seen = new Set<string>()
  const sessions: BoardSession[] = []
  for (const item of examPeriods) {
    const id = `calendar:${item.id}`
    if (seen.has(id)) continue
    seen.add(id)
    sessions.push({
      id,
      label: item.title,
      eyebrow: item.resit || item.kind === 'resit-week' ? 'Resit' : item.period ? `Period ${item.period}` : 'Exam session',
      range: dateRange(item.date, item.endDate),
      period: item.period ?? null,
      semester: item.semester ?? null,
      resit: Boolean(item.resit || item.kind === 'resit-week'),
      startsAt: item.date,
      endsAt: item.endDate || item.date
    })
  }

  const periods = [...new Set(courses.map((course) => periodNumber(course.period || course.attempts?.find((attempt) => attempt.status === 'upcoming')?.period)).filter((value): value is number => value !== null))].sort((a, b) => a - b)
  for (const period of periods) {
    if (!sessions.some((session) => !session.resit && session.period === period)) sessions.push({ id: `period:${period}`, label: `Period ${period} exams`, eyebrow: `Period ${period}`, range: 'Exam dates not connected', period, semester: null, resit: false })
  }
  if (!sessions.some((session) => !session.resit) && !periods.length) sessions.push({ id: 'current-sit', label: 'Current sitting', eyebrow: 'Planned', range: 'Exam date not recorded', period: null, semester: null, resit: false })
  if (!sessions.some((session) => session.resit)) sessions.push({ id: 'resit', label: 'Resit session', eyebrow: 'Alternative sitting', range: 'Resit calendar not connected', period: null, semester: null, resit: true })

  if (courses.some((course) => /semester|year/i.test(String(course.period || '')))) {
    sessions.unshift({ id: CONTINUOUS_ID, label: 'Coursework', eyebrow: 'Continuous work', range: 'No exam sitting recorded', period: null, semester: null, resit: false })
  }
  sessions.push({ id: CARRY_ID, label: 'Following year', eyebrow: 'Carry over', range: shiftAcademicYear(targetAcademicYear, 1) || 'Later', period: null, resit: false, carry: true })
  return sessions
}

function sessionForCourse(workspace: PlannerWorkspace, course: PlannerCourse, sessions: BoardSession[]) {
  const objective = objectiveFor(workspace, course.id)
  if (objective.targetSession && sessions.some((session) => session.id === objective.targetSession)) return objective.targetSession
  if (objective.mode === 'none') return CARRY_ID
  if (/semester|year/i.test(String(course.period || ''))) return sessions.some((session) => session.id === CONTINUOUS_ID) ? CONTINUOUS_ID : CARRY_ID
  const coursePeriod = periodNumber(course.period)
  const candidates = sessions.filter((session) => !session.carry)
  if (objective.mode === 'resit') {
    return candidates.find((session) => session.resit && (coursePeriod === null || session.period === coursePeriod))?.id
      || candidates.find((session) => session.resit)?.id
      || CARRY_ID
  }
  const upcoming = course.attempts?.find((attempt) => attempt.status === 'upcoming' && attempt.examDate)?.examDate
  if (upcoming) {
    const dated = candidates.find((session) => session.startsAt && session.endsAt && upcoming >= session.startsAt && upcoming <= session.endsAt)
    if (dated) return dated.id
  }
  return candidates.find((session) => !session.resit && coursePeriod !== null && session.period === coursePeriod)?.id
    || candidates.find((session) => !session.resit)?.id
    || candidates[0]?.id
    || CARRY_ID
}

function objectiveEqual(left: Objective, right: Objective) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function nextObjective(workspace: PlannerWorkspace, course: PlannerCourse, session: BoardSession, expectedGrade?: number | null) {
  const prior = objectiveFor(workspace, course.id)
  const grade = expectedGrade === undefined ? prior.expectedGrade : expectedGrade
  const passMark = Number((course as PlannerCourse & { passMark?: number }).passMark) || 5.5
  const maximum = passMark > 10 ? 100 : 10
  const bounded = typeof grade === 'number' && Number.isFinite(grade) ? Math.max(0, Math.min(maximum, grade)) : undefined
  return withObjective(workspace, course.id, {
    mode: session.carry ? 'none' : session.resit ? 'resit' : 'current',
    targetSession: session.id,
    expectedGrade: bounded,
    outcome: bounded === undefined ? 'actual' : bounded >= passMark ? 'pass' : 'fail'
  })
}

function requirementFor(workspace: PlannerWorkspace, course: PlannerCourse) {
  const named = workspace.gates.find((gate) => gate.courseId === course.id)
  if (named) return named.label
  const level = workspace.gates.find((gate) => gate.level && gate.level === course.yearLevel)
  if (level) return level.label
  const requirement = (course as PlannerCourse & { programmeRequirement?: string }).programmeRequirement
  if (requirement === 'elective' || requirement === 'choice') return 'Supports your elective requirement'
  if (requirement === 'required') return `Required in ${course.yearLevel || 'this programme'}`
  return `${course.ects} ECTS toward the degree`
}

function CreditRail({ workspace, summary }: { workspace: PlannerWorkspace; summary: ReturnType<typeof plannerSummary> }) {
  const total = Math.max(summary.totalCredits, 1)
  const earned = Math.min(100, summary.earnedCredits / total * 100)
  const projected = Math.min(100, summary.projectedCredits / total * 100)
  const markers = workspace.gates
    .filter((gate) => ['total-credits', 'credit-level'].includes(gate.type) && Number(gate.target) > 0)
    .map((gate) => ({ ...gate, position: Math.min(100, Number(gate.target) / total * 100) }))
    .sort((left, right) => left.position - right.position)

  return (
    <div className="min-w-[260px] flex-1" aria-label={`${summary.earnedCredits} credits earned and ${summary.projectedCredits} projected out of ${summary.totalCredits}`}>
      <div className="flex items-center justify-between gap-4 text-[10px]">
        <span className="text-muted-foreground"><strong className={`text-foreground ${DATA}`}>{summary.earnedCredits}</strong> earned</span>
        <span className="text-muted-foreground"><strong className={`text-primary ${DATA}`}>{summary.projectedCredits}</strong> projected</span>
        <span className={`text-muted-foreground ${DATA}`}>{summary.totalCredits} degree</span>
      </div>
      <div className="relative mt-2 h-4">
        <div className="bg-muted absolute inset-x-0 top-1.5 h-1 overflow-hidden rounded-full">
          <span className="bg-primary/25 absolute inset-y-0 left-0" style={{ width: `${projected}%` }} />
          <span className="bg-primary absolute inset-y-0 left-0" style={{ width: `${earned}%` }} />
        </div>
        {markers.map((gate) => <span key={gate.id} title={`${gate.label}: ${gate.target} ECTS`} className="border-background bg-foreground absolute top-0 size-3 -translate-x-1/2 rounded-full border-2" style={{ left: `${gate.position}%` }} />)}
      </div>
    </div>
  )
}

export function PlanningPlanner() {
  const [workspace, setWorkspace] = useState<PlannerWorkspace | null>(null)
  const [draft, setDraft] = useState<PlannerWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<BoardMove | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/academics', { headers: { accept: 'application/json' } })
      .then(readResponse)
      .then((state) => {
        if (!live) return
        setWorkspace(state.workspace)
        setDraft(state.workspace)
        setSelectedYear(currentStudyYear(state.workspace))
      })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  const years = useMemo(() => {
    if (!draft) return []
    const recorded = [...new Set(draft.courses.map((course) => course.yearLevel || 'Unassigned'))]
    const numbered = recorded.map(yearNumber).filter((value): value is number => value !== null)
    const programmeYears = /bachelor/i.test(draft.profile?.programme || '') ? 3 : /master/i.test(draft.profile?.programme || '') ? 2 : Math.max(0, ...numbered)
    const complete = programmeYears > 0 ? Array.from({ length: programmeYears }, (_, index) => `Year ${index + 1}`) : []
    return [...new Set([...complete, ...recorded])].sort((left, right) => (yearNumber(left) ?? 99) - (yearNumber(right) ?? 99) || left.localeCompare(right))
  }, [draft])

  useEffect(() => {
    if (!selectedYear && years.length) setSelectedYear(years[0])
    else if (selectedYear && years.length && !years.includes(selectedYear)) setSelectedYear(years[0])
  }, [selectedYear, years])

  const yearCourses = useMemo(() => draft ? draft.courses.filter((course) => (course.yearLevel || 'Unassigned') === selectedYear && courseStatus(course) !== 'passed') : [], [draft, selectedYear])
  const sessions = useMemo(() => draft ? sessionsFor(draft, selectedYear, yearCourses, years) : [], [draft, selectedYear, yearCourses, years])
  const summary = useMemo(() => draft ? plannerSummary(draft) : null, [draft])
  const changes = useMemo(() => {
    if (!workspace || !draft) return []
    return draft.courses.flatMap((course) => {
      const before = objectiveFor(workspace, course.id)
      const after = objectiveFor(draft, course.id)
      return objectiveEqual(before, after) ? [] : [{ course, before, after }]
    })
  }, [workspace, draft])

  const placement = (course: PlannerCourse) => draft ? sessionForCourse(draft, course, sessions) : CARRY_ID
  const selectedCourse = yearCourses.find((course) => course.id === selectedId) || yearCourses[0] || null
  const selectedSession = selectedCourse ? sessions.find((session) => session.id === placement(selectedCourse)) : null
  const savedSession = selectedCourse && workspace ? sessions.find((session) => session.id === sessionForCourse(workspace, selectedCourse, sessions)) : null
  const selectedObjective = selectedCourse && draft ? objectiveFor(draft, selectedCourse.id) : null
  const selectedMaximum = selectedCourse && Number(selectedCourse.passMark) > 10 ? 100 : 10
  const selectedRules = selectedCourse && draft ? planningDestinations(draft, selectedCourse.id) : null
  const selectedChanged = selectedCourse ? changes.some((change) => change.course.id === selectedCourse.id) : false
  const selectedAllowedSessions = selectedRules ? sessions.filter((session) => selectedRules.allowedSessionIds.includes(session.id)) : sessions
  const yearEcts = yearCourses.reduce((total, course) => total + course.ects, 0)
  const expected = yearCourses.flatMap((course) => {
    const grade = draft ? objectiveFor(draft, course.id).expectedGrade : undefined
    return typeof grade === 'number' ? [{ grade, ects: course.ects }] : []
  })
  const expectedAverage = expected.length ? expected.reduce((sum, item) => sum + item.grade * item.ects, 0) / expected.reduce((sum, item) => sum + item.ects, 0) : null
  const nextRegistration = draft ? [...((draft as PlannerWorkspace & { events?: { title: string; date?: string | null; type?: string }[] }).events ?? [])]
    .filter((item) => item.type === 'registration' && item.date && item.date >= new Date().toISOString().slice(0, 10))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))[0] : null

  const move = (course: PlannerCourse, session: BoardSession) => {
    if (!draft) return
    if (!planningDestinations(draft, course.id).allowedSessionIds.includes(session.id)) return
    const from = placement(course)
    if (from === session.id) return
    setDraft(nextObjective(draft, course, session))
    setSelectedId(course.id)
    setLastMove({ courseId: course.id, from, to: session.id })
  }

  const changeGrade = (course: PlannerCourse, grade: number | null) => {
    if (!draft) return
    const session = sessions.find((item) => item.id === placement(course)) || sessions[0]
    if (!session) return
    setDraft(nextObjective(draft, course, session, grade))
    setSelectedId(course.id)
  }

  const save = async () => {
    if (!workspace || !draft || saving || !changes.length) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/academics', { method: 'PUT', headers: { accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: draft, expectedRevision: workspace.revision }) })
      const state = await readResponse(response)
      setWorkspace(state.workspace)
      setDraft(state.workspace)
      setLastMove(null)
      setReviewOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The plan could not be saved.')
      setReviewOpen(false)
    } finally { setSaving(false) }
  }

  if (!workspace && error) return <Empty><EmptyHeader><EmptyTitle>The plan could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty>
  if (!workspace || !draft || !summary) return <div className="flex h-full min-h-[520px] flex-col gap-3"><Skeleton className="h-20 w-full" /><Skeleton className="min-h-0 flex-1" /></div>
  if (!draft.courses.length) return <Empty className="min-h-[520px]"><EmptyHeader><EmptyTitle>No courses to plan yet</EmptyTitle><EmptyDescription>Add courses in the Courses tab or finish programme setup. The session board will use your own academic calendar and exam records.</EmptyDescription></EmptyHeader></Empty>

  const goal = draft.gates[0]
  return (
    <section className="flex h-full min-h-[660px] flex-col overflow-hidden border bg-background" aria-busy={saving}>
      <div className="flex min-h-[78px] shrink-0 flex-wrap items-stretch border-b bg-card">
        <div className="flex min-w-56 flex-1 flex-col justify-center px-5 py-3 lg:px-6"><span className={LABEL}>{selectedYear === currentStudyYear(draft) ? 'Current study year' : 'Degree plan'}</span><h2 className="font-heading mt-1 text-xl font-semibold tracking-[-0.025em]">{selectedYear}</h2></div>
        <nav className="flex min-w-0 overflow-x-auto" aria-label="Study years">
          {years.map((year) => {
            const courses = draft.courses.filter((course) => (course.yearLevel || 'Unassigned') === year)
            const earned = courses.filter((course) => courseStatus(course) === 'passed').reduce((total, course) => total + course.ects, 0)
            const total = courses.reduce((sum, course) => sum + course.ects, 0)
            return <button key={year} type="button" onClick={() => { setSelectedYear(year); setSelectedId(null); setLastMove(null) }} className={`relative min-w-40 border-l px-5 text-left ${selectedYear === year ? 'bg-primary/[0.035]' : 'hover:bg-muted/40'}`}><span className={`text-[10px] font-semibold tracking-[0.1em] uppercase ${selectedYear === year ? 'text-primary' : 'text-muted-foreground'}`}>{year}</span><span className={`mt-1 block text-xs ${DATA}`}>{earned}/{total || 0} ECTS earned</span>{selectedYear === year && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}</button>
          })}
        </nav>
      </div>

      <div className="grid shrink-0 border-b bg-card lg:grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.4fr)]">
        <div className="flex items-center gap-3 px-5 py-4 lg:border-r lg:px-6">
          <span className="bg-primary/8 text-primary grid size-8 shrink-0 place-items-center rounded-[7px]"><TargetIcon className="size-4" /></span>
          <div className="min-w-0"><span className={LABEL}>Planning question</span><strong className="mt-1 block text-xs leading-relaxed">{yearCourses.length ? `Can I complete ${yearEcts} open ECTS in ${selectedYear}${goal ? ` and still meet ${goal.label}?` : '?'} ` : `Which courses belong in ${selectedYear}?`}</strong></div>
        </div>
        <div className="flex items-center gap-5 border-t px-5 py-4 lg:border-t-0 lg:px-6">
          <CreditRail workspace={draft} summary={summary} />
          <div className="shrink-0 text-right"><span className={LABEL}>Expected result</span><strong className={`mt-1 block text-xs ${DATA}`}>{expectedAverage === null ? 'Grades not set' : `${expectedAverage.toFixed(1)} average`}</strong></div>
        </div>
      </div>

      {nextRegistration && <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b px-5 py-2.5 text-xs lg:px-6"><span className={`${LABEL} text-primary`}>Registration action</span><strong>{nextRegistration.title}</strong><span className={`text-muted-foreground ${DATA}`}>{dateLabel(nextRegistration.date)}</span><Button nativeButton={false} render={<Link href="/app/calendar?view=agenda" />} variant="ghost" size="sm" className="ml-auto">Review in Calendar</Button></div>}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-w-max" style={{ gridTemplateColumns: `280px repeat(${sessions.length}, minmax(190px, 1fr))` }}>
          <div className="bg-background sticky left-0 z-20 flex min-h-[92px] items-end border-r border-b px-5 py-4 lg:px-6">
            <div><span className={LABEL}>Course route</span><p className="text-muted-foreground mt-1 text-[11px]">Move a course across its possible sittings.</p></div>
          </div>
          {sessions.map((session, index) => {
            const held = yearCourses.filter((course) => placement(course) === session.id)
            return <header key={session.id} className={`relative min-h-[92px] border-b px-4 py-4 ${index ? 'border-l' : ''} ${session.carry ? 'bg-muted/25' : ''}`}>
              <div className="mb-3 flex items-center"><span className={`size-2 rounded-full ${session.resit || session.carry ? 'border border-muted-foreground bg-background' : 'bg-primary'}`} /><span className="bg-border h-px flex-1" /></div>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={LABEL}>{session.eyebrow}</span><h3 className="mt-1 truncate text-xs font-semibold" title={session.label}>{session.label}</h3><span className={`text-muted-foreground mt-1 block text-[10px] ${DATA}`}>{session.range}</span></div><span className={`text-muted-foreground text-[10px] ${DATA}`}>{held.length}</span></div>
            </header>
          })}

          {yearCourses.map((course) => {
            const courseSession = placement(course)
            const isSelected = selectedCourse?.id === course.id
            const rules = planningDestinations(draft, course.id)
            return <div key={course.id} className="contents">
              <button type="button" onClick={() => setSelectedId(course.id)} className={`bg-background sticky left-0 z-10 min-h-[78px] border-r border-b px-5 py-3 text-left lg:px-6 ${isSelected ? 'before:bg-primary relative before:absolute before:inset-y-0 before:left-0 before:w-0.5' : 'hover:bg-muted/30'}`}>
                <span className={`text-[10px] font-semibold tracking-[0.06em] ${isSelected ? 'text-primary' : 'text-muted-foreground'} ${DATA}`}>{course.code || 'COURSE'} · {course.ects} ECTS</span>
                <strong className="mt-1 block max-w-56 truncate text-xs" title={course.name}>{course.name}</strong>
                <span className="text-muted-foreground mt-1 block text-[10px]">{rules.teachingPeriod ? `Taught ${rules.teachingPeriod} · ${rules.allowedSessionIds.length} valid routes` : 'Period not recorded · routes unrestricted'}</span>
              </button>
              {sessions.map((session, index) => {
                const placed = courseSession === session.id
                const destination = rules.destinations.find((item) => item.id === session.id)
                const allowed = Boolean(destination?.allowed)
                const over = dragOver === `${course.id}:${session.id}`
                return <div key={session.id} title={!allowed ? destination?.reason || 'This sitting is not available for the course.' : undefined} onDragOver={allowed ? (event) => { event.preventDefault(); setDragOver(`${course.id}:${session.id}`) } : undefined} onDragLeave={() => setDragOver(null)} onDrop={allowed ? (event) => { event.preventDefault(); move(course, session); setDraggedId(null); setDragOver(null) } : undefined} className={`grid min-h-[78px] place-items-center border-b px-3 py-2 ${index ? 'border-l' : ''} ${session.carry ? 'bg-muted/20' : ''} ${!allowed ? 'bg-muted/15' : ''} ${over ? 'bg-primary/[0.04]' : ''}`}>
                  {placed ? <button type="button" draggable onDragStart={() => setDraggedId(course.id)} onDragEnd={() => { setDraggedId(null); setDragOver(null) }} onClick={() => setSelectedId(course.id)} className={`group flex w-full cursor-grab items-center gap-2 rounded-[7px] border px-3 py-2 text-left transition-[border-color,background-color,opacity] active:cursor-grabbing ${isSelected ? 'border-primary bg-primary/[0.055]' : 'bg-card hover:border-foreground/25'} ${draggedId === course.id ? 'opacity-40' : ''}`}>
                    <GripVerticalIcon className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1"><strong className={`block truncate text-[11px] ${DATA}`}>{course.code}</strong><span className="text-muted-foreground mt-0.5 block truncate text-[10px]">{session.carry ? 'Deferred' : session.id === CONTINUOUS_ID ? 'Continuous assessment' : session.resit ? 'Resit planned' : 'Primary sitting'}</span></span>
                  </button> : allowed ? <span className={`h-px w-5 transition-colors ${over ? 'bg-primary' : 'bg-border/70'}`} /> : isSelected ? <span className="text-muted-foreground/65 inline-flex items-center gap-1 text-[10px]"><LockIcon className="size-3" />Not offered</span> : <LockIcon className="text-muted-foreground/30 size-3" />}
                </div>
              })}
            </div>
          })}
          {!yearCourses.length && <div className="col-span-full grid min-h-56 place-items-center border-b text-center"><div><strong className="text-sm">No courses placed in {selectedYear}</strong><p className="text-muted-foreground mt-1 text-xs">Choose electives or add courses from the Courses tab.</p></div></div>}
        </div>
      </div>

      <footer className="shrink-0 border-t bg-card">
        {selectedCourse && selectedSession ? <div className="grid lg:grid-cols-[minmax(260px,0.85fr)_minmax(420px,1.15fr)_auto]">
          <div className="flex min-w-0 items-center gap-3 px-5 py-3 lg:border-r lg:px-6"><span className={`grid size-8 shrink-0 place-items-center rounded-full ${selectedChanged ? 'bg-primary/8 text-primary' : 'bg-muted text-muted-foreground'}`}>{selectedChanged ? <CheckIcon className="size-4" /> : <CalendarDaysIcon className="size-4" />}</span><div className="min-w-0"><strong className="block truncate text-xs">{selectedCourse.name}</strong><p className="text-muted-foreground mt-1 truncate text-[10.5px]">{selectedRules?.teachingPeriod ? `${selectedRules.teachingPeriod} rule · ${selectedRules.evidenceSource === 'transcript-attempt' ? 'transcript evidence' : 'course record'}` : requirementFor(draft, selectedCourse)}</p></div></div>
          <div className="flex min-w-0 flex-wrap items-center gap-3 border-t px-5 py-3 lg:border-t-0 lg:px-6">
            <span className={LABEL}>{selectedChanged ? 'What if' : 'Planned sitting'}</span>
            {selectedChanged && savedSession && <><span className="text-muted-foreground max-w-32 truncate text-[11px]">{savedSession.label}</span><ArrowRightIcon className="text-muted-foreground size-3.5" /></>}
            <select aria-label={`Planned session for ${selectedCourse.name}`} value={selectedSession.id} onChange={(event) => { const session = sessions.find((item) => item.id === event.target.value); if (session) move(selectedCourse, session) }} className="h-9 min-w-44 rounded-[7px] border bg-background px-3 text-xs font-semibold outline-none">{selectedAllowedSessions.map((session) => <option key={session.id} value={session.id}>{session.label}</option>)}</select>
            <label className="flex items-center gap-2 text-[11px] font-semibold"><span className="text-muted-foreground">Expected grade</span><input aria-label={`Expected grade for ${selectedCourse.name}`} type="number" min="0" max={selectedMaximum} step="0.1" value={selectedObjective?.expectedGrade ?? ''} placeholder="Set" onChange={(event) => changeGrade(selectedCourse, event.target.value === '' ? null : Number(event.target.value))} className={`h-9 w-16 rounded-[7px] border bg-background px-2 text-right text-xs font-semibold outline-none focus:border-primary ${DATA}`} /></label>
          </div>
          <div className="flex items-center gap-2 border-t px-5 py-3 lg:border-t-0 lg:border-l lg:px-6">
            {changes.length > 0 && <Button variant="ghost" size="sm" onClick={() => { setDraft(workspace); setLastMove(null) }} disabled={saving}><RotateCcwIcon data-icon="inline-start" />Reset</Button>}
            <Button size="sm" disabled={!changes.length || saving} onClick={() => setReviewOpen(true)}>Review {changes.length || ''} {changes.length === 1 ? 'change' : 'changes'}</Button>
          </div>
        </div> : <div className="px-5 py-4 text-xs lg:px-6">Choose a course to inspect its route.</div>}
        <div className="flex items-center justify-between gap-4 border-t px-5 py-2.5 text-[10.5px] lg:px-6"><span className="text-muted-foreground">{lastMove ? `${draft.courses.find((course) => course.id === lastMove.courseId)?.name} moved to ${sessions.find((session) => session.id === lastMove.to)?.label.toLowerCase()}.` : 'This is a private scenario. Recorded results and registrations stay unchanged.'}</span><span className={`shrink-0 font-semibold ${changes.length ? 'text-primary' : 'text-muted-foreground'} ${DATA}`}>{changes.length ? `${changes.length} unsaved` : 'Saved plan'}</span></div>
      </footer>

      {error && <div role="alert" className="flex shrink-0 items-start gap-2 border-t px-5 py-3 text-sm text-destructive lg:px-6"><AlertTriangleIcon className="mt-0.5 size-4 shrink-0" /><span>The plan could not be saved: {error}</span></div>}

      <AlertDialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <AlertDialogContent className="max-w-lg sm:max-w-lg">
          <AlertDialogHeader><AlertDialogTitle>Save {changes.length} planning {changes.length === 1 ? 'change' : 'changes'}?</AlertDialogTitle><AlertDialogDescription>This updates only your private plan. Recorded grades, registrations, and the maintained curriculum do not change.</AlertDialogDescription></AlertDialogHeader>
          <ul className="max-h-64 overflow-y-auto border-y">
            {changes.map(({ course, before, after }) => <li key={course.id} className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0"><span><strong className="block text-sm">{course.code || course.name}</strong><span className="text-muted-foreground mt-0.5 block text-xs">{course.name}</span></span><span className="text-right text-xs"><strong>{after.mode === 'none' ? 'Following year' : after.mode === 'resit' ? 'Resit' : 'Current sitting'}</strong>{after.expectedGrade !== undefined && <span className={`text-muted-foreground mt-1 block ${DATA}`}>Expected {after.expectedGrade}</span>}{before.targetSession !== after.targetSession && <span className="text-muted-foreground mt-1 block">Session changed</span>}</span></li>)}
          </ul>
          <AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save plan'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
