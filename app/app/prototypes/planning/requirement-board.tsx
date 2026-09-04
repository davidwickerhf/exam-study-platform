'use client'

import { useState } from 'react'
import { ArrowRightIcon, CheckIcon, ChevronDownIcon } from 'lucide-react'
import { BOARD_COURSES, ChangeTray, CourseTile, EmptyDrop, GoalRibbon, PlanPulse, PlanningHeader, RegistrationLine, SESSIONS, plannedDate, type SessionKey, useAcademicBoard } from './shared'

export function RequirementBoard() {
  const model = useAcademicBoard(true)
  const [dragOver, setDragOver] = useState<SessionKey | null>(null)
  const [year, setYear] = useState(1)

  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
    <PlanningHeader />
    <GoalRibbon />
    <PlanPulse credits={model.projectedCredits} average={model.expectedAverage} changes={model.changes} />
    <RegistrationLine />

    <section className="flex min-h-0 flex-1 flex-col">
      <div className="grid border-b bg-card sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-center gap-4 px-6 py-3 lg:px-8"><div><strong className="text-sm">Exam sessions</strong><p className="text-muted-foreground mt-0.5 text-xs">The active year stays large. The whole degree remains one level away.</p></div><button type="button" className="text-primary ml-auto text-xs font-semibold sm:hidden">Change year</button></div>
        <div className="hidden items-stretch border-l sm:flex">
          {[1, 2, 3].map((item) => <button key={item} type="button" onClick={() => setYear(item)} className={`relative min-w-32 px-5 py-3 text-left ${year === item ? 'bg-primary/[0.045]' : ''}`}><span className="text-muted-foreground text-[9px] font-semibold tracking-[0.1em] uppercase">Year {item}</span><strong className="font-data mt-1 block text-xs tabular-nums">{item === 1 ? '48 / 60' : '0 / 60'} ECTS</strong>{year === item && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}</button>)}
          <button type="button" className="grid w-10 place-items-center border-l" aria-label="Open whole bachelor"><ChevronDownIcon className="size-4" /></button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-card">
        {year === 1 ? <div className="grid h-full min-h-0 min-w-[1660px] grid-cols-7">
          {SESSIONS.map((session) => {
            const courses = BOARD_COURSES.filter((course) => model.placements[course.id] === session.id)
            const draggingCourse = BOARD_COURSES.find((course) => course.id === model.draggedId)
            const valid = !draggingCourse || session.id === draggingCourse.session || session.id === 'feb' || session.id === 'next'
            return <div key={session.id} onDragOver={(event) => { if (valid) { event.preventDefault(); setDragOver(session.id) } }} onDragLeave={() => setDragOver(null)} onDrop={(event) => { event.preventDefault(); if (valid && model.draggedId) model.move(model.draggedId, session.id); setDragOver(null); model.setDraggedId(null) }} className={`flex min-w-0 flex-col border-r last:border-r-0 ${session.id === 'feb' || session.id === 'jun' ? 'bg-muted/20' : ''} ${model.draggedId && !valid ? 'opacity-45' : ''}`}>
              <div className="min-h-[82px] border-b px-4 py-3"><div className="flex items-center justify-between"><span className="text-muted-foreground text-[9px] font-semibold tracking-[0.12em] uppercase">{session.eyebrow}</span><span className="font-data text-muted-foreground text-[10px] tabular-nums">{courses.length}</span></div><strong className="mt-1 block text-sm">{session.label}</strong><span className="font-data text-muted-foreground mt-1 block text-[10px] tabular-nums">{session.range}</span></div>
              <div className={`flex-1 space-y-3 p-3 ${dragOver === session.id ? 'bg-primary/[0.035]' : ''}`}>
                {courses.map((course) => <CourseTile key={course.id} course={course} displayDate={plannedDate(course, model.placements[course.id])} selected={model.selectedId === course.id} dragging={model.draggedId === course.id} onSelect={() => model.setSelectedId(course.id)} onDragStart={() => model.setDraggedId(course.id)} onDragEnd={() => { model.setDraggedId(null); setDragOver(null) }} />)}
                {courses.length === 0 && valid && <EmptyDrop active={dragOver === session.id} />}
                {courses.length === 0 && !valid && <div className="grid min-h-20 place-items-center px-5 text-center text-[10px] text-muted-foreground">No valid sitting for this course</div>}
              </div>
              <div className="border-t px-4 py-3"><span className="text-muted-foreground text-[10px]">{session.id === 'next' ? 'Delays the goal date' : session.id === 'feb' ? '3 days between current exams' : courses.length > 1 ? `${courses.length} exams clustered` : 'Capacity available'}</span></div>
            </div>
          })}
        </div> : <div className="grid h-full min-h-0 place-items-center px-8 text-center"><div className="max-w-md"><span className="font-heading text-5xl font-semibold text-muted-foreground/25">0{year}</span><h2 className="font-heading mt-4 text-2xl font-semibold">Year {year} stays mapped, not crowded</h2><p className="text-muted-foreground mt-2 text-sm leading-relaxed">Open this year when you want to move a carry-over forward or see how today’s decisions affect later prerequisites.</p><button type="button" onClick={() => setYear(1)} className="text-primary mt-5 inline-flex items-center gap-2 text-sm font-semibold">Return to active year <ArrowRightIcon className="size-4" /></button></div></div>}
      </div>

      <ChangeTray model={model} label="Draft impact" />
      {model.changes > 0 && <div className="fixed right-8 bottom-24 z-20 hidden items-center gap-2 border bg-card px-3 py-2 text-[11px] shadow-lg xl:flex"><CheckIcon className="text-primary size-3.5" />Statistics moved in this draft</div>}
    </section>
  </div>
}
