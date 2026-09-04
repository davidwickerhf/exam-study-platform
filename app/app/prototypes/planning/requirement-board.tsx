'use client'

import { useMemo, useState } from 'react'
import { ArrowRightIcon, CalendarDaysIcon, CheckIcon, ChevronRightIcon, CirclePlusIcon, GripVerticalIcon, TargetIcon } from 'lucide-react'
import { BOARD_COURSES, SESSIONS, type BoardCourse, type PlanningSection, type SessionKey, PlanningHeader } from './shared'

type PlannerCourse = BoardCourse & {
  year: number
  kind: 'core' | 'elective'
  requirement: string
}

const CORE_COURSES: PlannerCourse[] = [
  ...BOARD_COURSES.map((course) => ({ ...course, year: 1, kind: 'core' as const, requirement: 'Year 1 core' })),
  { id: 'databases', code: 'BCS2410', name: 'Database Systems', ects: 6, grade: 7, date: '15 Oct', resit: '3 Feb', session: 'oct', year: 2, kind: 'core', requirement: 'Systems core', goal: 'Unlocks the Year 3 data pathway' },
  { id: 'networks', code: 'BCS2420', name: 'Computer Networks', ects: 6, grade: 7.5, date: '17 Dec', resit: '5 Feb', session: 'dec', year: 2, kind: 'core', requirement: 'Systems core', goal: 'Completes the systems requirement' },
  { id: 'software', code: 'BCS2540', name: 'Software Engineering', ects: 6, grade: 7, date: '18 Mar', resit: '23 Jun', session: 'mar', year: 2, kind: 'core', requirement: 'Professional skills', goal: 'Keeps the bachelor project available' },
  { id: 'security', code: 'BCS3410', name: 'Information Security', ects: 6, grade: 7, date: '14 Oct', resit: '4 Feb', session: 'oct', year: 3, kind: 'core', requirement: 'Advanced core', goal: 'Completes the advanced systems track' },
  { id: 'capstone', code: 'BCS3990', name: 'Bachelor Project', ects: 18, grade: 7.5, date: '21 May', resit: '25 Jun', session: 'may', year: 3, kind: 'core', requirement: 'Graduation requirement', goal: 'Completes the degree' },
]

const ELECTIVE_OPTIONS: PlannerCourse[] = [
  { id: 'writing', code: 'BCS1810', name: 'Academic Writing', ects: 6, grade: 7, date: '19 May', resit: '22 Jun', session: 'may', year: 1, kind: 'elective', requirement: 'Free elective', goal: 'Fills the remaining Year 1 elective space' },
  { id: 'hci', code: 'BCS2710', name: 'Human-Computer Interaction', ects: 6, grade: 7.5, date: '19 May', resit: '22 Jun', session: 'may', year: 2, kind: 'elective', requirement: 'Technical elective', goal: 'Adds 6 ECTS without a prerequisite conflict' },
  { id: 'applied-ai', code: 'BCS2730', name: 'Applied Artificial Intelligence', ects: 6, grade: 7, date: '20 Mar', resit: '24 Jun', session: 'mar', year: 2, kind: 'elective', requirement: 'Technical elective', goal: 'Starts the intelligent systems pathway' },
  { id: 'info-sec', code: 'BCS2740', name: 'Privacy and Security', ects: 6, grade: 7, date: '18 Dec', resit: '7 Feb', session: 'dec', year: 2, kind: 'elective', requirement: 'Technical elective', goal: 'Supports the advanced systems track' },
  { id: 'distributed', code: 'BCS3510', name: 'Distributed Systems', ects: 6, grade: 7.5, date: '18 Mar', resit: '23 Jun', session: 'mar', year: 3, kind: 'elective', requirement: 'Advanced elective', goal: 'Strengthens the systems specialisation' },
  { id: 'visualisation', code: 'BCS3520', name: 'Data Visualisation', ects: 6, grade: 7.5, date: '20 May', resit: '24 Jun', session: 'may', year: 3, kind: 'elective', requirement: 'Advanced elective', goal: 'Balances the final-year workload' },
  { id: 'responsible-ai', code: 'BCS3530', name: 'Responsible AI', ects: 6, grade: 7, date: '16 Dec', resit: '6 Feb', session: 'dec', year: 3, kind: 'elective', requirement: 'Advanced elective', goal: 'Completes the intelligent systems pathway' },
]

const ALL_COURSES = [...CORE_COURSES, ...ELECTIVE_OPTIONS]
const INITIAL_PLACEMENTS = Object.fromEntries(ALL_COURSES.map((course) => [course.id, course.session])) as Record<string, SessionKey>
const INITIAL_ELECTIVES = ['hci', 'distributed']
const YEAR_SUMMARY = {
  1: { label: '2026–2027', baseCredits: 54 },
  2: { label: '2027–2028', baseCredits: 48 },
  3: { label: '2028–2029', baseCredits: 48 },
} as const

function CourseCard({ course, session, selected, dragging, onSelect, onDragStart, onDragEnd }: { course: PlannerCourse; session: SessionKey; selected: boolean; dragging: boolean; onSelect: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const shownDate = session === 'feb' || session === 'jun' ? course.resit : session === 'next' ? 'Next academic year' : course.date
  return <button type="button" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onSelect} className={`group w-full cursor-grab rounded-[10px] border bg-card p-4 text-left transition-[border-color,box-shadow,opacity,transform] active:cursor-grabbing ${selected ? 'border-primary shadow-[0_0_0_1px_var(--primary)]' : 'hover:border-foreground/25'} ${dragging ? 'scale-[0.985] opacity-45' : ''}`}>
    <div className="flex items-start gap-3">
      <GripVerticalIcon className="text-muted-foreground/55 mt-0.5 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3"><span className="font-data text-primary text-[10px] font-semibold tracking-[0.06em]">{course.code}</span><span className="font-data text-muted-foreground text-[10px] tabular-nums">{course.ects} ECTS</span></div>
        <strong className="mt-1.5 block text-[14px] leading-snug">{course.name}</strong>
        <div className="text-muted-foreground mt-3 flex items-center justify-between gap-2 text-[10.5px]"><span className="inline-flex items-center gap-1.5"><CalendarDaysIcon className="size-3.5" />{shownDate}</span><span className="font-data tabular-nums">Expected {course.grade.toFixed(1)}</span></div>
      </div>
    </div>
    <p className="mt-4 border-t pt-3 text-[11px] leading-relaxed"><span className="text-primary font-semibold">Goal</span><span className="text-muted-foreground"> · {course.goal}</span></p>
    {course.note && <p className="mt-2 text-[10.5px] leading-relaxed text-amber-700">{course.note}</p>}
  </button>
}

function ElectiveLibrary({ year, selected, onToggle }: { year: number; selected: string[]; onToggle: (id: string) => void }) {
  const options = ELECTIVE_OPTIONS.filter((course) => course.year === year)
  const chosen = options.filter((course) => selected.includes(course.id)).reduce((sum, course) => sum + course.ects, 0)
  return <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto max-w-6xl px-8 py-7">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b pb-6">
        <div><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">Year {year} course choices</span><h2 className="font-heading mt-2 text-[25px] font-semibold tracking-[-0.025em]">Choose electives without losing the plan</h2><p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">Courses you choose are placed into their standard exam session. You can move them after returning to the exam plan.</p></div>
        <div className="min-w-44 text-right"><strong className="font-data text-xl tabular-nums">{chosen} / {year === 1 ? 6 : 12} ECTS</strong><p className="text-muted-foreground mt-1 text-xs">elective space selected</p></div>
      </div>
      <div className="grid gap-5 py-7 md:grid-cols-2 xl:grid-cols-3">
        {options.map((course) => {
          const isSelected = selected.includes(course.id)
          return <article key={course.id} className={`flex min-h-56 flex-col rounded-[12px] border bg-card p-5 ${isSelected ? 'border-primary shadow-[0_0_0_1px_var(--primary)]' : ''}`}>
            <div className="flex items-start justify-between gap-4"><span className="font-data text-primary text-[11px] font-semibold tracking-[0.06em]">{course.code}</span><span className="font-data text-muted-foreground text-xs">{course.ects} ECTS</span></div>
            <h3 className="mt-3 text-[17px] font-semibold">{course.name}</h3><p className="text-muted-foreground mt-1 text-xs">{course.requirement}</p>
            <p className="text-muted-foreground mt-5 text-sm leading-relaxed">{course.goal}</p>
            <div className="mt-auto flex items-center justify-between border-t pt-4"><span className="text-muted-foreground text-xs">Usually examined {SESSIONS.find((session) => session.id === course.session)?.label.toLowerCase()}</span><button type="button" onClick={() => onToggle(course.id)} className={`inline-flex h-9 items-center gap-2 rounded-[7px] px-3 text-xs font-semibold ${isSelected ? 'border bg-background' : 'bg-primary text-primary-foreground'}`}>{isSelected ? <><CheckIcon className="size-3.5" /> Selected</> : <><CirclePlusIcon className="size-3.5" /> Add to year</>}</button></div>
          </article>
        })}
      </div>
    </div>
  </div>
}

function YearTabs({ year, onChange, plannedCredits, includeAtlas = false }: { year: number; onChange: (year: number) => void; plannedCredits: (year: number) => number; includeAtlas?: boolean }) {
  return <nav className="flex min-w-0 items-stretch overflow-x-auto" aria-label="Academic years">
    {[1, 2, 3].map((item) => {
      const itemSummary = YEAR_SUMMARY[item as keyof typeof YEAR_SUMMARY]
      return <button key={item} type="button" onClick={() => onChange(item)} className={`relative min-w-40 px-5 text-left ${year === item ? 'bg-primary/[0.035]' : ''}`}><span className={`text-[10px] font-semibold tracking-[0.1em] uppercase ${year === item ? 'text-primary' : 'text-muted-foreground'}`}>Year {item}</span><span className="font-data mt-1 block text-xs tabular-nums">{itemSummary.label} · {plannedCredits(item)}/60</span>{year === item && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}</button>
    })}
    {includeAtlas && <a href="?v=1" className="text-muted-foreground inline-flex min-w-36 items-center justify-center gap-2 px-4 text-xs font-semibold">Whole bachelor <ChevronRightIcon className="size-3.5" /></a>}
  </nav>
}

function OverviewView({ plannedCredits, onOpen }: { plannedCredits: (year: number) => number; onOpen: (section: PlanningSection) => void }) {
  return <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b pb-7"><div><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">Academic overview</span><h2 className="font-heading mt-2 text-[28px] font-semibold tracking-[-0.03em]">The degree at a glance</h2><p className="text-muted-foreground mt-2 text-sm">Status, open decisions, and the path your current plan produces.</p></div><button type="button" onClick={() => onOpen('Planner')} className="bg-primary h-10 px-4 text-xs font-semibold text-primary-foreground">Open exam planner</button></div>

      <section className="mt-7 grid rounded-[12px] border bg-card lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <div className="p-6 lg:p-7"><div className="flex items-center gap-3"><span className="bg-primary/8 text-primary grid size-9 place-items-center rounded-[7px]"><TargetIcon className="size-4.5" /></span><div><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">What if</span><h3 className="mt-1 text-[17px] font-semibold">Finish Year 1 by February 2027 with an average of at least 7.0.</h3></div></div><p className="text-muted-foreground mt-5 max-w-2xl text-sm leading-relaxed">The current draft reaches the credit target, but Statistics and Ubiquitous Computing would sit within 24 hours in the February resit week.</p><button type="button" onClick={() => onOpen('Planner')} className="text-primary mt-5 inline-flex items-center gap-2 text-xs font-semibold">Test another route <ArrowRightIcon className="size-3.5" /></button></div>
        <div className="border-t p-6 lg:border-t-0 lg:border-l lg:p-7"><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">Next decision</span><div className="mt-4 flex items-start justify-between gap-4"><div><strong className="text-sm">Register for Period 2</strong><p className="text-muted-foreground mt-1 text-xs">Required in the student portal</p></div><span className="font-data text-primary text-xs font-semibold">11 SEP</span></div><button type="button" className="mt-6 w-full border-t pt-4 text-left text-xs font-semibold">Review registration <ArrowRightIcon className="ml-1 inline size-3.5" /></button></div>
      </section>

      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <section><div className="flex items-baseline justify-between border-b pb-4"><h3 className="text-base font-semibold">Degree trajectory</h3><span className="font-data text-muted-foreground text-xs">48 / 180 ECTS earned</span></div>{[1, 2, 3].map((item) => <button key={item} type="button" onClick={() => onOpen('Planner')} className="grid w-full grid-cols-[90px_minmax(0,1fr)_80px] items-center gap-5 border-b py-5 text-left"><div><strong className="text-sm">Year {item}</strong><span className="text-muted-foreground mt-1 block text-[11px]">{YEAR_SUMMARY[item as keyof typeof YEAR_SUMMARY].label}</span></div><div><div className="bg-muted h-1.5 overflow-hidden rounded-full"><div className="bg-primary h-full rounded-full" style={{ width: `${plannedCredits(item) / 0.6}%` }} /></div><span className="text-muted-foreground mt-2 block text-[11px]">{plannedCredits(item) === 60 ? 'Fully mapped' : `${60 - plannedCredits(item)} ECTS still to choose`}</span></div><span className="font-data text-right text-sm font-semibold tabular-nums">{plannedCredits(item)}/60</span></button>)}</section>
        <section><div className="flex items-baseline justify-between border-b pb-4"><h3 className="text-base font-semibold">Open choices</h3><button type="button" onClick={() => onOpen('Courses')} className="text-primary text-xs font-semibold">Manage</button></div><button type="button" onClick={() => onOpen('Courses')} className="flex w-full items-center justify-between gap-5 border-b py-5 text-left"><span><strong className="text-sm">Year 1 elective</strong><span className="text-muted-foreground mt-1 block text-xs">6 ECTS remain unselected</span></span><ChevronRightIcon className="text-muted-foreground size-4" /></button><button type="button" onClick={() => onOpen('Courses')} className="flex w-full items-center justify-between gap-5 border-b py-5 text-left"><span><strong className="text-sm">Year 2 elective</strong><span className="text-muted-foreground mt-1 block text-xs">6 ECTS remain unselected</span></span><ChevronRightIcon className="text-muted-foreground size-4" /></button></section>
      </div>
    </div>
  </div>
}

function ProgressView({ plannedCredits }: { plannedCredits: (year: number) => number }) {
  const requirements = [
    ['Foundation courses', '42 of 48 ECTS', 'On track'],
    ['Methods requirement', 'Statistics planned', 'At risk'],
    ['Technical electives', '12 of 24 ECTS chosen', 'Open'],
    ['Bachelor project', 'Prerequisites expected', 'On track'],
  ]
  return <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
    <div className="border-b pb-7"><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">Progress</span><h2 className="font-heading mt-2 text-[28px] font-semibold tracking-[-0.03em]">What is complete, safe, and still exposed</h2><p className="text-muted-foreground mt-2 text-sm">Recorded results stay separate from projections made by the current plan.</p></div>
    <section className="mt-7 grid rounded-[12px] border bg-card sm:grid-cols-2 xl:grid-cols-4">{[['48 / 180','ECTS earned'],['7.1','recorded average'],['0 / 2','allowed absences used'],['132','ECTS remaining']].map(([value,label], index) => <div key={label} className={`p-6 ${index ? 'border-t sm:border-t-0 sm:border-l' : ''}`}><strong className="font-data text-2xl tabular-nums">{value}</strong><p className="text-muted-foreground mt-2 text-xs">{label}</p></div>)}</section>
    <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]"><section><div className="flex items-baseline justify-between border-b pb-4"><h3 className="text-base font-semibold">Requirements</h3><span className="text-muted-foreground text-xs">Based on verified programme rules</span></div>{requirements.map(([name, detail, status]) => <div key={name} className="grid grid-cols-[minmax(0,1fr)_minmax(150px,0.55fr)_80px] items-center gap-5 border-b py-5"><strong className="text-sm">{name}</strong><span className="text-muted-foreground text-xs">{detail}</span><span className={`text-right text-xs font-semibold ${status === 'At risk' ? 'text-amber-700' : status === 'Open' ? 'text-primary' : ''}`}>{status}</span></div>)}</section><section><div className="border-b pb-4"><h3 className="text-base font-semibold">Plan projection</h3></div><div className="py-5"><div className="flex items-baseline justify-between"><strong className="font-data text-2xl tabular-nums">{plannedCredits(1) + plannedCredits(2) + plannedCredits(3)} / 180</strong><span className="text-muted-foreground text-xs">ECTS mapped</span></div><div className="bg-muted mt-4 h-2 overflow-hidden rounded-full"><div className="bg-primary h-full rounded-full" style={{ width: `${(plannedCredits(1) + plannedCredits(2) + plannedCredits(3)) / 1.8}%` }} /></div><p className="text-muted-foreground mt-5 text-sm leading-relaxed">Your current selections leave 18 ECTS of elective space open across the degree. The February plan preserves the Year 1 target but creates one exam-density risk.</p></div></section></div>
  </div></div>
}

export function RequirementBoard() {
  const [activeSection, setActiveSection] = useState<PlanningSection>('Planner')
  const [year, setYear] = useState(1)
  const [selectedElectives, setSelectedElectives] = useState(INITIAL_ELECTIVES)
  const [placements, setPlacements] = useState<Record<string, SessionKey>>({ ...INITIAL_PLACEMENTS, statistics: 'feb' })
  const [selectedId, setSelectedId] = useState('statistics')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<SessionKey | null>(null)
  const [lastMove, setLastMove] = useState<{ courseId: string; from: SessionKey; to: SessionKey } | null>({ courseId: 'statistics', from: 'oct', to: 'feb' })

  const courses = useMemo(() => ALL_COURSES.filter((course) => course.year === year && (course.kind === 'core' || selectedElectives.includes(course.id))), [selectedElectives, year])
  const placementChanges = Object.entries(placements).filter(([id, session]) => INITIAL_PLACEMENTS[id] !== session).length
  const electiveChanges = selectedElectives.filter((id) => !INITIAL_ELECTIVES.includes(id)).length + INITIAL_ELECTIVES.filter((id) => !selectedElectives.includes(id)).length
  const changes = placementChanges + electiveChanges
  const selectedCourse = ALL_COURSES.find((course) => course.id === selectedId)
  const summary = YEAR_SUMMARY[year as keyof typeof YEAR_SUMMARY]
  const plannedCredits = (forYear: number) => {
    const yearSummary = YEAR_SUMMARY[forYear as keyof typeof YEAR_SUMMARY]
    const electiveCredits = ELECTIVE_OPTIONS.filter((course) => course.year === forYear && selectedElectives.includes(course.id)).reduce((sum, course) => sum + course.ects, 0)
    return yearSummary.baseCredits + electiveCredits
  }

  const move = (courseId: string, to: SessionKey) => {
    const from = placements[courseId]
    if (!from || from === to) return
    setPlacements((current) => ({ ...current, [courseId]: to }))
    setSelectedId(courseId)
    setLastMove({ courseId, from, to })
  }

  const changeYear = (nextYear: number) => {
    setYear(nextYear)
    const first = ALL_COURSES.find((course) => course.year === nextYear && (course.kind === 'core' || selectedElectives.includes(course.id)))
    if (first) setSelectedId(first.id)
  }

  const toggleElective = (id: string) => setSelectedElectives((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
    <PlanningHeader active={activeSection} onActiveChange={setActiveSection} />

    {activeSection === 'Overview' && <OverviewView plannedCredits={plannedCredits} onOpen={setActiveSection} />}

    {activeSection === 'Courses' && <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[76px] shrink-0 flex-wrap items-center gap-6 border-b bg-card px-6 py-3 lg:px-8"><div className="mr-auto"><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">Curriculum</span><h2 className="font-heading mt-1 text-xl font-semibold tracking-[-0.02em]">Courses and electives</h2></div><YearTabs year={year} onChange={changeYear} plannedCredits={plannedCredits} /></div>
      <ElectiveLibrary year={year} selected={selectedElectives} onToggle={toggleElective} />
    </section>}

    {activeSection === 'Progress' && <ProgressView plannedCredits={plannedCredits} />}

    {activeSection === 'Planner' && <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[76px] shrink-0 flex-wrap items-center gap-5 border-b bg-card px-6 py-3 lg:px-8">
        <div className="mr-auto min-w-44"><span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">{year === 1 ? 'Current year' : plannedCredits(year) === 60 ? 'Year mapped' : `${60 - plannedCredits(year)} ECTS still open`}</span><h2 className="font-heading mt-1 text-xl font-semibold tracking-[-0.02em]">Year {year} · {summary.label}</h2></div>
        <YearTabs year={year} onChange={changeYear} plannedCredits={plannedCredits} includeAtlas />
      </div>
      <div className="flex min-h-[58px] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-2.5 lg:px-8"><span className="bg-primary/8 text-primary grid size-8 shrink-0 place-items-center rounded-[7px]"><TargetIcon className="size-4" /></span><div className="min-w-0 flex-1"><span className="text-muted-foreground mr-2 text-[10px] font-semibold tracking-[0.12em] uppercase">What if</span><strong className="text-xs">Finish Year 1 by February 2027 with an average of at least 7.0.</strong></div><button type="button" className="text-primary text-xs font-semibold">Change goal</button></div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="grid h-full min-w-max auto-cols-[276px] grid-flow-col gap-5 px-6 py-6 lg:px-8">
          {SESSIONS.map((session) => {
            const sessionCourses = courses.filter((course) => placements[course.id] === session.id)
            return <section key={session.id} onDragOver={(event) => { event.preventDefault(); setDragOver(session.id) }} onDragLeave={() => setDragOver(null)} onDrop={(event) => { event.preventDefault(); if (draggedId) move(draggedId, session.id); setDraggedId(null); setDragOver(null) }} className={`flex h-full min-h-0 flex-col rounded-[12px] border bg-card transition-[border-color,background-color] ${dragOver === session.id ? 'border-primary bg-primary/[0.018]' : ''}`}>
              <header className="flex min-h-[86px] shrink-0 items-start justify-between gap-3 border-b px-4 py-4"><div><span className="text-muted-foreground text-[9.5px] font-semibold tracking-[0.12em] uppercase">{session.eyebrow}</span><h3 className="mt-1 text-sm font-semibold">{session.label}</h3><span className="font-data text-muted-foreground mt-1 block text-[10.5px] tabular-nums">{session.range}</span></div><span className="font-data text-muted-foreground mt-0.5 text-xs tabular-nums">{sessionCourses.length}</span></header>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {sessionCourses.map((course) => <CourseCard key={course.id} course={course} session={placements[course.id]} selected={selectedId === course.id} dragging={draggedId === course.id} onSelect={() => setSelectedId(course.id)} onDragStart={() => setDraggedId(course.id)} onDragEnd={() => { setDraggedId(null); setDragOver(null) }} />)}
                {sessionCourses.length === 0 && <div className={`grid min-h-28 place-items-center rounded-[9px] border border-dashed px-5 text-center text-[11px] ${dragOver === session.id ? 'border-primary text-primary' : 'text-muted-foreground/65'}`}>{dragOver === session.id ? 'Release to move here' : session.id === 'next' ? 'Drag here to defer a course' : 'No exam planned'}</div>}
              </div>
            </section>
          })}
        </div>
      </div>

      <footer className="grid min-h-[72px] shrink-0 border-t bg-card lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-center gap-4 px-6 py-3 lg:px-8"><span className="bg-primary/8 text-primary grid size-8 shrink-0 place-items-center rounded-full"><CheckIcon className="size-4" /></span><div>{lastMove ? <><strong className="text-xs">{ALL_COURSES.find((course) => course.id === lastMove.courseId)?.name} moved to {SESSIONS.find((session) => session.id === lastMove.to)?.label.toLowerCase()}</strong><p className="text-muted-foreground mt-1 text-[11px]">The change stays in this draft until you review and save it.</p></> : <><strong className="text-xs">Move a course to test another path</strong><p className="text-muted-foreground mt-1 text-[11px]">Drag between sessions. Nothing is saved immediately.</p></>}</div></div>
        <div className="flex items-center gap-2 border-t px-6 py-3 lg:border-t-0 lg:border-l"><label className="text-muted-foreground hidden text-[10px] font-semibold tracking-[0.08em] uppercase xl:block">Move selected</label><select aria-label="Move selected course" disabled={!selectedCourse} value={selectedCourse ? placements[selectedCourse.id] : 'oct'} onChange={(event) => selectedCourse && move(selectedCourse.id, event.target.value as SessionKey)} className="h-9 min-w-40 rounded-[7px] border bg-background px-3 text-xs font-semibold outline-none"><option value="oct">October exams</option><option value="dec">December exams</option><option value="feb">February resits</option><option value="mar">March exams</option><option value="may">May exams</option><option value="jun">June resits</option><option value="next">Following year</option></select><button type="button" className="h-9 bg-primary px-4 text-xs font-semibold text-primary-foreground">Review {Math.max(1, changes)} {changes === 1 ? 'change' : 'changes'}</button></div>
      </footer>
    </section>}
  </div>
}
