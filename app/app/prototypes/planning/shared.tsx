'use client'

import { useMemo, useState } from 'react'
import { ArrowRightIcon, CalendarDaysIcon, GripVerticalIcon, TargetIcon } from 'lucide-react'

export type SessionKey = 'oct' | 'dec' | 'feb' | 'mar' | 'may' | 'jun' | 'next'

export type BoardCourse = {
  id: string
  code: string
  name: string
  ects: number
  grade: number
  date: string
  resit: string
  session: SessionKey
  goal: string
  note?: string
}

export const SESSIONS: Array<{ id: SessionKey; eyebrow: string; label: string; range: string }> = [
  { id: 'oct', eyebrow: 'Period 1', label: 'October exams', range: '12–16 Oct' },
  { id: 'dec', eyebrow: 'Period 2', label: 'December exams', range: '16–20 Dec' },
  { id: 'feb', eyebrow: 'Resit', label: 'February resits', range: '2–8 Feb' },
  { id: 'mar', eyebrow: 'Period 4', label: 'March exams', range: '15–19 Mar' },
  { id: 'may', eyebrow: 'Period 5', label: 'May exams', range: '17–21 May' },
  { id: 'jun', eyebrow: 'Resit', label: 'June resits', range: '21–25 Jun' },
  { id: 'next', eyebrow: 'Carry over', label: 'Following year', range: '2027–2028' },
]

export const BOARD_COURSES: BoardCourse[] = [
  { id: 'algorithms', code: 'BCS1540', name: 'Algorithmic Design', ects: 6, grade: 7.5, date: '12 Oct', resit: '2 Feb', session: 'oct', goal: 'Required to complete Year 1' },
  { id: 'statistics', code: 'BCS1520', name: 'Statistics', ects: 6, grade: 6.5, date: '14 Oct', resit: '4 Feb', session: 'oct', goal: 'Closes the methods requirement', note: 'Attendance at allowed absence limit' },
  { id: 'ubiquitous', code: 'BCS3120', name: 'Ubiquitous Computing', ects: 6, grade: 7, date: '18 Dec', resit: '5 Feb', session: 'feb', goal: 'Adds 6 ECTS toward the target' },
  { id: 'game-theory', code: 'BCS3130', name: 'Game Theory', ects: 6, grade: 7, date: '20 Dec', resit: '8 Feb', session: 'dec', goal: 'Keeps the elective path open' },
]

export function plannedDate(course: BoardCourse, session: SessionKey) {
  if (session === 'feb' || session === 'jun') return course.resit
  if (session === 'next') return 'Next year'
  return course.date
}

const INITIAL = Object.fromEntries(BOARD_COURSES.map((course) => [course.id, course.session])) as Record<string, SessionKey>

export type BoardMove = { courseId: string; from: SessionKey; to: SessionKey }

export function useAcademicBoard(demoMove = false) {
  const seeded = demoMove ? { ...INITIAL, statistics: 'feb' as SessionKey } : INITIAL
  const [placements, setPlacements] = useState<Record<string, SessionKey>>(seeded)
  const [grades, setGrades] = useState<Record<string, number>>(Object.fromEntries(BOARD_COURSES.map((course) => [course.id, course.grade])))
  const [selectedId, setSelectedId] = useState<string>('statistics')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<BoardMove | null>(demoMove ? { courseId: 'statistics', from: 'oct', to: 'feb' } : null)

  const move = (courseId: string, to: SessionKey) => {
    const from = placements[courseId]
    if (!from || from === to) return
    setPlacements((current) => ({ ...current, [courseId]: to }))
    setLastMove({ courseId, from, to })
    setSelectedId(courseId)
  }

  const reset = () => {
    setPlacements(INITIAL)
    setGrades(Object.fromEntries(BOARD_COURSES.map((course) => [course.id, course.grade])))
    setLastMove(null)
  }

  const changes = useMemo(() => BOARD_COURSES.filter((course) => placements[course.id] !== INITIAL[course.id]).length, [placements])
  const expectedAverage = useMemo(() => Object.values(grades).reduce((sum, grade) => sum + grade, 0) / BOARD_COURSES.length, [grades])
  const projectedCredits = 48 + BOARD_COURSES.filter((course) => placements[course.id] !== 'next' && grades[course.id] >= 5.5).reduce((sum, course) => sum + course.ects, 0)

  return { placements, grades, setGrades, selectedId, setSelectedId, draggedId, setDraggedId, lastMove, move, reset, changes, expectedAverage, projectedCredits }
}

export type PlanningSection = 'Overview' | 'Courses' | 'Progress' | 'Planner'

export function PlanningHeader({ active = 'Planner', onActiveChange }: { active?: PlanningSection; onActiveChange?: (section: PlanningSection) => void }) {
  return <header className="shrink-0 bg-background">
    <div className="flex min-h-[76px] flex-wrap items-end justify-between gap-4 px-6 py-5 lg:px-8">
      <div><h1 className="font-heading text-[32px] leading-none font-semibold tracking-[-0.035em]">Planning</h1><p className="text-muted-foreground mt-2 text-sm">Shape the academic path, then review every consequence before saving it.</p></div>
      <div className="font-data text-muted-foreground text-xs tabular-nums">2026–2027 · Bachelor of Science</div>
    </div>
    <nav className="flex h-12 items-stretch gap-7 border-y px-6 lg:px-8" aria-label="Planning sections">
      {(['Overview', 'Courses', 'Progress', 'Planner'] as PlanningSection[]).map((item) => <button key={item} type="button" onClick={() => onActiveChange?.(item)} className={`relative text-sm font-semibold ${active === item ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : 'text-muted-foreground'}`}>{item}</button>)}
    </nav>
  </header>
}

export function GoalRibbon() {
  const [date, setDate] = useState('February 2027')
  const [average, setAverage] = useState('7.0')
  return <section className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b bg-card px-6 py-4 lg:px-8">
    <span className="bg-primary/8 text-primary grid size-9 shrink-0 place-items-center rounded-[7px]"><TargetIcon className="size-4.5" /></span>
    <div className="min-w-0 flex-1"><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">Planning goal</span><div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[17px] font-semibold">Finish Year 1 by <select value={date} onChange={(event) => setDate(event.target.value)} className="text-primary border-0 border-b border-primary/30 bg-transparent py-0.5 font-semibold outline-none"><option>February 2027</option><option>June 2027</option><option>February 2028</option></select> with an average of at least <select value={average} onChange={(event) => setAverage(event.target.value)} className="font-data text-primary border-0 border-b border-primary/30 bg-transparent py-0.5 font-semibold outline-none"><option>6.5</option><option>7.0</option><option>7.5</option><option>8.0</option></select>.</div></div>
    <button type="button" className="text-primary text-xs font-semibold">Edit goal</button>
  </section>
}

export function PlanPulse({ credits, average, changes }: { credits: number; average: number; changes: number }) {
  return <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b px-6 py-3 text-xs lg:px-8">
    <span><strong className="font-data text-sm tabular-nums">48 / 180</strong> <span className="text-muted-foreground">ECTS now</span></span>
    <span><strong className="font-data text-sm tabular-nums">{credits}</strong> <span className="text-muted-foreground">if the plan succeeds</span></span>
    <span><strong className="font-data text-sm tabular-nums">{average.toFixed(1)}</strong> <span className="text-muted-foreground">expected average</span></span>
    <span><strong className="font-data text-sm tabular-nums">1</strong> <span className="text-muted-foreground">attendance risk</span></span>
    <span className="ml-auto"><strong className={changes ? 'text-primary' : ''}>{changes || 'No'} draft {changes === 1 ? 'change' : 'changes'}</strong></span>
  </div>
}

export function CourseTile({ course, selected, dragging, onSelect, onDragStart, onDragEnd, compact = false, displayDate }: { course: BoardCourse; selected?: boolean; dragging?: boolean; onSelect?: () => void; onDragStart?: () => void; onDragEnd?: () => void; compact?: boolean; displayDate?: string }) {
  return <button type="button" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onSelect} className={`group w-full cursor-grab border bg-card text-left transition-[border-color,opacity,transform] active:cursor-grabbing ${compact ? 'p-3' : 'p-4'} ${selected ? 'border-primary shadow-[inset_3px_0_0_var(--primary)]' : 'border-border hover:border-foreground/30'} ${dragging ? 'scale-[0.98] opacity-45' : ''}`}>
    <div className="flex items-start gap-2"><GripVerticalIcon className="text-muted-foreground/60 mt-0.5 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="font-data text-primary text-[10px] font-semibold tracking-[0.05em] tabular-nums">{course.code}</span><span className="font-data text-muted-foreground text-[10px] tabular-nums">{course.ects} ECTS</span></div><strong className={`mt-1 block leading-tight ${compact ? 'text-[13px]' : 'text-sm'}`}>{course.name}</strong></div></div>
    {compact ? <p className="text-muted-foreground mt-2 line-clamp-2 text-[10px] leading-relaxed"><span className="text-primary">↳</span> {course.goal}</p> : <><div className="text-muted-foreground mt-3 flex items-center justify-between border-t pt-2 text-[11px]"><span className="inline-flex items-center gap-1.5"><CalendarDaysIcon className="size-3.5" />{displayDate || course.date}</span><span className="font-data tabular-nums">Expected {course.grade.toFixed(1)}</span></div><p className="mt-3 text-[11px] leading-relaxed"><span className="text-primary">↳</span> {course.goal}</p>{course.note && <p className="text-muted-foreground mt-1.5 text-[10.5px] leading-relaxed">{course.note}</p>}</>}
  </button>
}

export function EmptyDrop({ active = false }: { active?: boolean }) {
  return <div className={`grid min-h-20 place-items-center border border-dashed text-center text-[11px] ${active ? 'border-primary bg-primary/[0.035] text-primary' : 'border-border text-muted-foreground/70'}`}>{active ? 'Release to move here' : 'Drop a course here'}</div>
}

export function RegistrationLine() {
  return <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-primary/[0.025] px-6 py-3 lg:px-8"><span className="font-data text-primary text-[10px] font-semibold tracking-[0.1em]">7 DAYS</span><strong className="text-xs">Register for Period 2 by 11 September</strong><span className="text-muted-foreground text-xs">Complete it in the student portal, then confirm it here.</span><button type="button" className="text-primary ml-auto inline-flex items-center gap-1.5 text-xs font-semibold">Review action <ArrowRightIcon className="size-3.5" /></button></div>
}

export function SessionHeading({ eyebrow, label, range, count }: { id: SessionKey; eyebrow: string; label: string; range: string; count?: number }) {
  return <div className="min-h-[76px] border-b px-4 py-3"><div className="flex items-center justify-between gap-2"><span className="text-muted-foreground text-[9.5px] font-semibold tracking-[0.12em] uppercase">{eyebrow}</span>{count !== undefined && <span className="font-data text-muted-foreground text-[10px] tabular-nums">{count}</span>}</div><strong className="mt-1 block text-sm">{label}</strong><span className="font-data text-muted-foreground mt-1 block text-[10.5px] tabular-nums">{range}</span></div>
}

export function ChangeTray({ model, label = 'What this move changes' }: { model: ReturnType<typeof useAcademicBoard>; label?: string }) {
  const selected = BOARD_COURSES.find((item) => item.id === model.selectedId) || BOARD_COURSES[0]
  const moveControl = <label className="flex h-9 items-center border bg-card pl-3 text-[10px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Move {selected.code}<select aria-label={`Move ${selected.name}`} value={model.placements[selected.id]} onChange={(event) => model.move(selected.id, event.target.value as SessionKey)} className="h-full min-w-32 border-0 bg-transparent px-2 text-xs font-semibold normal-case tracking-normal text-foreground outline-none"><option value={selected.session}>Original sitting</option>{selected.session !== 'feb' && <option value="feb">February resit</option>}<option value="next">Following year</option></select></label>
  if (!model.lastMove) return <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-4 border-t bg-card px-6 py-4 lg:px-8"><div><strong className="text-sm">Move a course to test a different path</strong><p className="text-muted-foreground mt-1 text-xs">Drag any course or use the move menu. Nothing changes until you review and save.</p></div><div className="flex items-center gap-3">{moveControl}<span className="text-muted-foreground text-xs">Draft mode</span></div></div>
  const course = BOARD_COURSES.find((item) => item.id === model.lastMove?.courseId)!
  const from = SESSIONS.find((item) => item.id === model.lastMove?.from)?.label
  const to = SESSIONS.find((item) => item.id === model.lastMove?.to)?.label
  return <div className="grid border-t bg-card lg:grid-cols-[minmax(0,1fr)_auto]">
    <div className="px-6 py-4 lg:px-8"><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">{label}</span><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><strong className="text-sm">{course.name}: {from} → {to}</strong><span className="text-muted-foreground text-xs">{model.lastMove.to === 'feb' ? 'Removes the October collision and creates two February exams within 24 hours.' : model.lastMove.to === 'next' ? 'Reduces this year by 6 ECTS and misses the current goal date.' : 'Keeps the course inside the current academic year.'}</span></div></div>
    <div className="flex flex-wrap items-center gap-2 border-t px-6 py-3 lg:border-t-0 lg:border-l">{moveControl}<button type="button" onClick={model.reset} className="h-9 px-3 text-xs font-semibold text-muted-foreground">Reset draft</button><button type="button" className="h-9 bg-primary px-4 text-xs font-semibold text-primary-foreground">Review {Math.max(1, model.changes)} {model.changes === 1 ? 'change' : 'changes'}</button></div>
  </div>
}
