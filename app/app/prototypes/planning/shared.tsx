'use client'

import { useMemo, useState } from 'react'
import { CheckIcon, ExternalLinkIcon } from 'lucide-react'

export type Sitting = 'standard' | 'resit' | 'skip'
export type PlanChoice = { sitting: Sitting; grade: number }
export type PlanCourse = {
  id: string
  code: string
  name: string
  ects: number
  year: number
  period: number
  exam: string
  resit: string
  attendance: string
  attendanceNote: string
  requirement: string
}

export const COURSES: PlanCourse[] = [
  { id: 'algorithms', code: 'BCS1540', name: 'Algorithmic Design', ects: 6, year: 1, period: 1, exam: '12 Oct', resit: '2 Feb', attendance: '7 / 8', attendanceNote: '1 required lab may still be missed', requirement: 'Year 1 core' },
  { id: 'statistics', code: 'BCS1520', name: 'Statistics', ects: 6, year: 1, period: 1, exam: '14 Oct', resit: '4 Feb', attendance: '6 / 8', attendanceNote: 'At the verified absence limit', requirement: 'Methods requirement' },
  { id: 'ubiquitous', code: 'BCS3120', name: 'Ubiquitous Computing', ects: 6, year: 1, period: 2, exam: '18 Dec', resit: '5 Feb', attendance: '5 / 6', attendanceNote: '1 tutorial unmarked', requirement: 'Year 1 core' },
  { id: 'game-theory', code: 'BCS3130', name: 'Game Theory', ects: 6, year: 1, period: 2, exam: '20 Dec', resit: '8 Feb', attendance: '4 / 6', attendanceNote: 'Attendance is optional', requirement: 'Elective credit' },
]

const INITIAL: Record<string, PlanChoice> = {
  algorithms: { sitting: 'standard', grade: 7.5 },
  statistics: { sitting: 'standard', grade: 6.5 },
  ubiquitous: { sitting: 'resit', grade: 7 },
  'game-theory': { sitting: 'standard', grade: 7 },
}

export function usePlanningPrototype() {
  const [choices, setChoices] = useState<Record<string, PlanChoice>>(INITIAL)
  const [registered, setRegistered] = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState(false)

  const update = (id: string, patch: Partial<PlanChoice>) => {
    setChoices((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }
  const setPreset = (preset: 'target' | 'conservative' | 'clear') => {
    if (preset === 'clear') {
      setChoices(Object.fromEntries(COURSES.map((course) => [course.id, { sitting: 'skip', grade: 5.5 }])))
      return
    }
    setChoices(Object.fromEntries(COURSES.map((course, index) => [course.id, {
      sitting: preset === 'conservative' && index > 1 ? 'resit' : 'standard',
      grade: preset === 'target' ? [8, 7.5, 7.5, 7][index] : 6,
    }])))
  }

  const summary = useMemo(() => {
    const active = COURSES.filter((course) => choices[course.id]?.sitting !== 'skip')
    const passed = active.filter((course) => choices[course.id]?.grade >= 5.5)
    const projectedCredits = 48 + passed.reduce((total, course) => total + course.ects, 0)
    const expectedGrade = active.length ? active.reduce((total, course) => total + choices[course.id].grade, 0) / active.length : null
    return { active: active.length, projectedCredits, expectedGrade }
  }, [choices])

  return { choices, update, setPreset, summary, registered, setRegistered, registrationOpen, setRegistrationOpen }
}

export function PageHeader({ description }: { description: string }) {
  return <header className="bg-background">
    <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-8">
      <div><h1 className="font-heading text-[32px] leading-none font-semibold tracking-[-0.03em]">Planning</h1><p className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-relaxed">{description}</p></div>
      <span className="font-data text-muted-foreground text-sm tabular-nums">2026–2027 · Bachelor of Science</span>
    </div>
    <nav className="flex gap-7 overflow-x-auto border-t border-b px-5 sm:px-8" aria-label="Planning sections">
      {['Overview', 'Courses', 'Progress', 'Planner'].map((tab, index) => <button key={tab} type="button" className={`relative h-12 shrink-0 text-sm font-semibold ${index === 0 ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : 'text-muted-foreground hover:text-foreground'}`}>{tab}</button>)}
    </nav>
  </header>
}

export function StatusStrip({ projectedCredits, expectedGrade }: { projectedCredits: number; expectedGrade: number | null }) {
  return <div className="flex flex-wrap items-center gap-x-7 gap-y-3 border-b bg-card px-5 py-4 sm:px-8">
    <div className="min-w-[220px] flex-1"><div className="flex items-baseline justify-between gap-3"><strong className="text-sm">Degree progress</strong><span className="font-data text-sm tabular-nums">48 of 180 ECTS</span></div><div className="mt-2"><ProgressLine value={(48 / 180) * 100} /></div></div>
    <p className="text-muted-foreground text-sm"><strong className="text-foreground">{projectedCredits} ECTS</strong> if this plan succeeds</p>
    <p className="text-muted-foreground text-sm"><strong className="text-foreground">{expectedGrade === null ? 'No grade' : expectedGrade.toFixed(1)}</strong> expected average</p>
    <p className="text-muted-foreground text-sm"><strong className="text-foreground">1</strong> attendance issue</p>
  </div>
}

export function RegistrationNotice({ open, setOpen, registered, setRegistered, compact = false }: { open: boolean; setOpen: (value: boolean) => void; registered: boolean; setRegistered: (value: boolean) => void; compact?: boolean }) {
  if (registered) return <div className="flex items-center gap-3 border-b px-5 py-3 text-sm sm:px-6"><span className="grid size-7 place-items-center rounded-full bg-primary/[0.08]"><CheckIcon className="text-primary size-4" /></span><strong>Period 2 registration recorded</strong><span className="text-muted-foreground">4 September</span><button type="button" className="text-primary ml-auto text-xs font-semibold" onClick={() => setRegistered(false)}>Undo</button></div>
  return <div className="border-b">
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 px-5 ${compact ? 'py-3' : 'py-4'} sm:px-6`}><span className="font-data text-primary text-xs font-semibold tabular-nums">7 DAYS</span><div className="min-w-0 flex-1"><strong className="text-sm">Register for Period 2 by 11 September</strong><p className="text-muted-foreground mt-0.5 text-xs">Do this in the student portal. Wicker can keep reminding you until you confirm.</p></div><button type="button" className="text-primary text-sm font-semibold" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Review'}</button></div>
    {open && <div className="flex flex-wrap items-center gap-3 border-t px-5 py-4 sm:px-6"><a href="https://www.maastrichtuniversity.nl/support/education/student-portal" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-primary px-3.5 text-sm font-semibold text-primary-foreground">Open student portal <ExternalLinkIcon className="size-3.5" /></a><button type="button" className="h-9 rounded-[6px] border px-3.5 text-sm font-semibold" onClick={() => setRegistered(true)}>I registered</button><p className="text-muted-foreground basis-full text-xs">Wicker cannot see the portal result. Confirm only after registration succeeds.</p></div>}
  </div>
}

export function SittingControl({ course, choice, onChange }: { course: PlanCourse; choice: PlanChoice; onChange: (patch: Partial<PlanChoice>) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-semibold">Exam sitting<select value={choice.sitting} onChange={(event) => onChange({ sitting: event.target.value as Sitting })} className="h-10 rounded-[6px] border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"><option value="standard">Standard · {course.exam}</option><option value="resit">Resit · {course.resit}</option><option value="skip">Do not sit</option></select></label><label className="grid gap-1.5 text-xs font-semibold">Expected grade<input type="number" min="1" max="10" step="0.5" value={choice.grade} disabled={choice.sitting === 'skip'} onChange={(event) => onChange({ grade: Number(event.target.value) })} className="h-10 rounded-[6px] border bg-card px-3 font-data text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-45" /></label></div>
}

export function ProgressLine({ value }: { value: number }) {
  return <span className="bg-muted block h-1.5 overflow-hidden rounded-full"><span className="bg-primary block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
}
