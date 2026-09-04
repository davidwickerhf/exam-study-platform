'use client'

import { useState } from 'react'
import { ArrowDownIcon, ArrowRightIcon, CheckIcon, XIcon } from 'lucide-react'
import { BOARD_COURSES, ChangeTray, CourseTile, GoalRibbon, PlanPulse, PlanningHeader, RegistrationLine, SESSIONS, plannedDate, type SessionKey, useAcademicBoard } from './shared'

const FILMSTRIP_SESSIONS: SessionKey[] = ['oct', 'dec', 'feb', 'next']

export function ScenarioLedger() {
  const model = useAcademicBoard(true)
  const [dragOver, setDragOver] = useState<SessionKey | null>(null)
  const [showCurrent, setShowCurrent] = useState(true)

  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
    <PlanningHeader />
    <GoalRibbon />
    <PlanPulse credits={model.projectedCredits} average={model.expectedAverage} changes={model.changes} />
    <RegistrationLine />

    <section className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="flex min-h-14 items-center gap-4 border-b px-6 lg:px-8"><div><strong className="text-sm">Scenario filmstrip</strong><span className="text-muted-foreground ml-2 text-xs">See the current path and proposed path together</span></div><label className="ml-auto flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={showCurrent} onChange={(event) => setShowCurrent(event.target.checked)} className="size-4 accent-primary" />Show current plan</label></div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[1120px]">
          <div className="grid grid-cols-[128px_repeat(4,minmax(220px,1fr))] border-b bg-muted/15">
            <div className="border-r px-4 py-3"><span className="text-muted-foreground text-[9px] font-semibold tracking-[0.12em] uppercase">Academic path</span></div>
            {FILMSTRIP_SESSIONS.map((id) => { const session = SESSIONS.find((item) => item.id === id)!; return <div key={id} className="border-r px-4 py-3 last:border-r-0"><span className="text-muted-foreground text-[9px] font-semibold tracking-[0.12em] uppercase">{session.eyebrow}</span><strong className="mt-1 block text-xs">{session.label}</strong><span className="font-data text-muted-foreground mt-1 block text-[9.5px]">{session.range}</span></div> })}
          </div>

          {showCurrent && <div className="grid grid-cols-[128px_repeat(4,minmax(220px,1fr))] border-b">
            <div className="border-r bg-background px-4 py-5"><span className="text-muted-foreground text-[9px] font-semibold tracking-[0.12em] uppercase">Committed</span><strong className="mt-2 block text-sm">Current plan</strong><span className="text-muted-foreground mt-1 block text-[10px]">Before changes</span></div>
            {FILMSTRIP_SESSIONS.map((session) => <div key={session} className={`min-h-[122px] border-r p-3 last:border-r-0 ${session === 'feb' ? 'bg-muted/15' : ''}`}><div className="space-y-2">{BOARD_COURSES.filter((course) => course.session === session).map((course) => <CourseTile key={course.id} course={course} compact />)}</div></div>)}
          </div>}

          <div className="grid grid-cols-[128px_minmax(0,1fr)] border-b bg-primary/[0.025]">
            <div className="grid min-h-12 place-items-center border-r"><ArrowDownIcon className="text-primary size-4" /></div>
            <div className="flex min-h-12 items-center gap-3 px-5"><span className="font-data text-primary text-[10px] font-semibold tracking-[0.1em] uppercase">One proposed move</span><strong className="text-xs">Statistics shifts from 14 October to 4 February</strong><span className="text-muted-foreground text-xs">October opens up; the February resit week becomes tighter.</span><button type="button" onClick={model.reset} className="text-muted-foreground ml-auto grid size-7 place-items-center" aria-label="Remove proposed move"><XIcon className="size-3.5" /></button></div>
          </div>

          <div className="grid grid-cols-[128px_repeat(4,minmax(220px,1fr))]">
            <div className="border-r bg-background px-4 py-5"><span className="text-primary text-[9px] font-semibold tracking-[0.12em] uppercase">Editable</span><strong className="mt-2 block text-sm">Proposed plan</strong><span className="text-muted-foreground mt-1 block text-[10px]">Drag to revise</span></div>
            {FILMSTRIP_SESSIONS.map((session) => {
              const courses = BOARD_COURSES.filter((course) => model.placements[course.id] === session)
              return <div key={session} onDragOver={(event) => { event.preventDefault(); setDragOver(session) }} onDragLeave={() => setDragOver(null)} onDrop={(event) => { event.preventDefault(); if (model.draggedId) model.move(model.draggedId, session); model.setDraggedId(null); setDragOver(null) }} className={`min-h-[252px] border-r p-3 last:border-r-0 ${session === 'feb' ? 'bg-muted/15' : ''} ${dragOver === session ? 'bg-primary/[0.045]' : ''}`}>
                <div className="space-y-3">{courses.map((course) => <CourseTile key={course.id} course={course} displayDate={plannedDate(course, model.placements[course.id])} selected={model.selectedId === course.id} dragging={model.draggedId === course.id} onSelect={() => model.setSelectedId(course.id)} onDragStart={() => model.setDraggedId(course.id)} onDragEnd={() => { model.setDraggedId(null); setDragOver(null) }} />)}</div>
                {courses.length === 0 && <div className="grid min-h-24 place-items-center border border-dashed text-[10px] text-muted-foreground">Drop a course here</div>}
              </div>
            })}
          </div>
        </div>
      </div>

      <div className="grid border-t sm:grid-cols-3">
        <div className="flex gap-3 border-b px-5 py-3 sm:border-r sm:border-b-0"><CheckIcon className="text-primary mt-0.5 size-3.5 shrink-0" /><p className="text-[11px] leading-relaxed"><strong className="block">Goal date remains possible</strong><span className="text-muted-foreground">All 24 planned ECTS still land before February ends.</span></p></div>
        <div className="flex gap-3 border-b px-5 py-3 sm:border-r sm:border-b-0"><ArrowRightIcon className="text-primary mt-0.5 size-3.5 shrink-0" /><p className="text-[11px] leading-relaxed"><strong className="block">October becomes more realistic</strong><span className="text-muted-foreground">The two-day exam collision is removed.</span></p></div>
        <div className="flex gap-3 px-5 py-3"><span className="text-muted-foreground mt-0.5 text-xs">!</span><p className="text-[11px] leading-relaxed"><strong className="block">Attendance risk remains</strong><span className="text-muted-foreground">Moving the exam does not change the tutorial requirement.</span></p></div>
      </div>
      <ChangeTray model={model} label="Scenario summary" />
    </section>
  </div>
}
