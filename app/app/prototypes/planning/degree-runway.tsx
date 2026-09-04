'use client'

import { useState } from 'react'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { BOARD_COURSES, ChangeTray, CourseTile, EmptyDrop, GoalRibbon, PlanPulse, PlanningHeader, RegistrationLine, SESSIONS, plannedDate, type SessionKey, useAcademicBoard } from './shared'

const FUTURE = {
  2: { oct: ['Core sequence', '4 courses · 24 ECTS'], dec: ['Elective path', '3 courses · 18 ECTS'], feb: ['Resit reserve', 'No courses'], mar: ['Core sequence', '3 courses · 18 ECTS'], may: ['Elective path', '4 courses · 24 ECTS'], jun: ['Resit reserve', 'No courses'] },
  3: { oct: ['Advanced electives', '3 courses · 18 ECTS'], dec: ['Minor / electives', '3 courses · 18 ECTS'], feb: ['Resit reserve', 'No courses'], mar: ['Bachelor project', '12 ECTS'], may: ['Final electives', '2 courses · 12 ECTS'], jun: ['Completion reserve', 'No courses'] },
} as const

function FutureCell({ title, meta }: { title: string; meta: string }) {
  const empty = meta === 'No courses'
  return <div className={`m-3 min-h-[72px] border p-3 ${empty ? 'border-dashed text-muted-foreground' : 'bg-card'}`}><strong className="block text-xs">{title}</strong><span className="font-data text-muted-foreground mt-2 block text-[10px] tabular-nums">{meta}</span></div>
}

export function DegreeRunway() {
  const model = useAcademicBoard()
  const [view, setView] = useState<'all' | '1' | '2' | '3'>('all')
  const [dragOver, setDragOver] = useState<SessionKey | null>(null)
  const [zoom, setZoom] = useState(0)
  const sessions = SESSIONS.slice(0, 6)
  const years = view === 'all' ? [1, 2, 3] : [Number(view)]

  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
    <PlanningHeader />
    <GoalRibbon />
    <PlanPulse credits={model.projectedCredits} average={model.expectedAverage} changes={model.changes} />
    <RegistrationLine />

    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-14 flex-wrap items-center gap-4 border-b px-6 py-2 lg:px-8">
        <div><strong className="text-sm">Bachelor atlas</strong><span className="text-muted-foreground ml-2 text-xs">Drag a course to another valid exam session</span></div>
        <div className="ml-auto flex items-center gap-1 border p-1">
          {[['all', 'Whole bachelor'], ['1', 'Year 1'], ['2', 'Year 2'], ['3', 'Year 3']].map(([id, label]) => <button key={id} type="button" onClick={() => setView(id as typeof view)} className={`h-7 px-3 text-[11px] font-semibold ${view === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>)}
        </div>
        <div className="flex items-center border"><button type="button" aria-label="Zoom out" onClick={() => setZoom(Math.max(-1, zoom - 1))} className="grid size-8 place-items-center border-r"><MinusIcon className="size-3.5" /></button><span className="font-data w-14 text-center text-[10px] tabular-nums">{zoom === 0 ? 'Fit' : zoom > 0 ? '125%' : '80%'}</span><button type="button" aria-label="Zoom in" onClick={() => setZoom(Math.min(1, zoom + 1))} className="grid size-8 place-items-center border-l"><PlusIcon className="size-3.5" /></button></div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-card">
        <div className={`grid ${zoom > 0 ? 'min-w-[1780px]' : zoom < 0 ? 'min-w-[1080px]' : 'min-w-[1420px]'} grid-cols-[132px_repeat(6,minmax(190px,1fr))]`}>
          <div className="sticky left-0 z-20 border-r border-b bg-card px-4 py-3"><span className="text-muted-foreground text-[9.5px] font-semibold tracking-[0.12em] uppercase">Academic year</span><strong className="mt-1 block text-sm">2026–2029</strong></div>
          {sessions.map((session) => <div key={session.id} className="border-r last:border-r-0"><div className="min-h-[68px] border-b px-4 py-3"><span className="text-muted-foreground text-[9px] font-semibold tracking-[0.12em] uppercase">{session.eyebrow}</span><strong className="mt-1 block text-xs">{session.label}</strong><span className="font-data text-muted-foreground mt-1 block text-[9.5px] tabular-nums">{session.range}</span></div></div>)}

          {years.map((year) => <div key={year} className="contents">
            <div className="sticky left-0 z-10 min-h-[164px] border-r border-b bg-background px-4 py-5"><span className="font-heading text-2xl font-semibold">Year {year}</span><span className="font-data text-muted-foreground mt-1 block text-[10px] tabular-nums">{2025 + year}–{2026 + year}</span><div className="mt-8"><span className="font-data block text-sm font-semibold tabular-nums">{year === 1 ? '48 / 60' : '0 / 60'} ECTS</span><span className="text-muted-foreground mt-1 block text-[10px]">{year === 1 ? '12 still required' : 'Curriculum mapped'}</span></div></div>
            {sessions.map((session) => {
              const courses = year === 1 ? BOARD_COURSES.filter((course) => model.placements[course.id] === session.id) : []
              const future = year > 1 ? FUTURE[year as 2 | 3][session.id as keyof typeof FUTURE[2]] : null
              return <div key={`${year}-${session.id}`} onDragOver={(event) => { if (year === 1) { event.preventDefault(); setDragOver(session.id) } }} onDragLeave={() => setDragOver(null)} onDrop={(event) => { event.preventDefault(); if (year === 1 && model.draggedId) model.move(model.draggedId, session.id); setDragOver(null); model.setDraggedId(null) }} className={`min-h-[164px] border-r border-b p-3 last:border-r-0 ${dragOver === session.id && year === 1 ? 'bg-primary/[0.035]' : session.id === 'feb' || session.id === 'jun' ? 'bg-muted/20' : ''}`}>
                {year === 1 ? <div className="space-y-2">{courses.map((course) => <CourseTile key={course.id} compact course={course} displayDate={plannedDate(course, model.placements[course.id])} selected={model.selectedId === course.id} dragging={model.draggedId === course.id} onSelect={() => model.setSelectedId(course.id)} onDragStart={() => model.setDraggedId(course.id)} onDragEnd={() => { model.setDraggedId(null); setDragOver(null) }} />)}{courses.length === 0 && <EmptyDrop active={dragOver === session.id} />}</div> : future ? <FutureCell title={future[0]} meta={future[1]} /> : null}
              </div>
            })}
          </div>)}
        </div>
      </div>
      <ChangeTray model={model} label="Goal impact" />
    </section>
  </div>
}
