'use client'

import { useState } from 'react'
import { ArrowRightIcon, CalendarDaysIcon, CheckIcon, ChevronRightIcon } from 'lucide-react'
import { COURSES, PageHeader, ProgressLine, RegistrationNotice, SittingControl, StatusStrip, usePlanningPrototype } from './shared'

export function DegreeRunway() {
  const model = usePlanningPrototype()
  const [selectedId, setSelectedId] = useState(COURSES[0].id)
  const [saved, setSaved] = useState(false)
  const selected = COURSES.find((course) => course.id === selectedId) || COURSES[0]
  const choice = model.choices[selected.id]

  return <div className="min-h-full bg-background pb-24">
    <PageHeader description="Make the few decisions that matter now. Wicker shows what each choice changes before it enters your plan." />
    <StatusStrip projectedCredits={model.summary.projectedCredits} expectedGrade={model.summary.expectedGrade} />
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[14px] border bg-card">
        <RegistrationNotice open={model.registrationOpen} setOpen={model.setRegistrationOpen} registered={model.registered} setRegistered={model.setRegistered} />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_370px]">
          <main className="min-w-0">
            <div className="border-b px-5 py-5 sm:px-6"><div className="flex items-end justify-between gap-5"><div><h2 className="text-lg font-semibold">What needs your attention</h2><p className="text-muted-foreground mt-1 text-sm">Three choices. Start with the one due soonest.</p></div><span className="font-data text-muted-foreground text-sm tabular-nums">3 open</span></div></div>
            <div>
              <button type="button" onClick={() => model.setRegistrationOpen(true)} className="grid w-full grid-cols-[50px_minmax(0,1fr)_auto] items-center gap-4 border-b px-5 py-4 text-left hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"><span className="font-data text-primary text-sm font-semibold tabular-nums">01</span><span><strong className="block text-sm">Register for Period 2</strong><span className="text-muted-foreground mt-1 block text-xs">Due 11 September. Confirm after you finish in the student portal.</span></span><span className="text-primary flex items-center gap-1 text-xs font-semibold">Review <ChevronRightIcon className="size-4" /></span></button>
              <button type="button" onClick={() => setSelectedId('statistics')} className="grid w-full grid-cols-[50px_minmax(0,1fr)_auto] items-center gap-4 border-b px-5 py-4 text-left hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"><span className="font-data text-primary text-sm font-semibold tabular-nums">02</span><span><strong className="block text-sm">Protect your Statistics attendance</strong><span className="text-muted-foreground mt-1 block text-xs">You have used every allowed absence for required tutorials.</span></span><span className="text-primary flex items-center gap-1 text-xs font-semibold">Open <ChevronRightIcon className="size-4" /></span></button>
              <button type="button" onClick={() => setSelectedId('ubiquitous')} className="grid w-full grid-cols-[50px_minmax(0,1fr)_auto] items-center gap-4 border-b px-5 py-4 text-left hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"><span className="font-data text-primary text-sm font-semibold tabular-nums">03</span><span><strong className="block text-sm">Check the Ubiquitous Computing resit</strong><span className="text-muted-foreground mt-1 block text-xs">Moving it to February creates a longer study window and a busier resit week.</span></span><span className="text-primary flex items-center gap-1 text-xs font-semibold">Review <ChevronRightIcon className="size-4" /></span></button>
            </div>

            <div className="flex items-end justify-between gap-5 border-b px-5 py-5 sm:px-6"><div><h2 className="text-lg font-semibold">Your next exams</h2><p className="text-muted-foreground mt-1 text-sm">Select a course to change its sitting or expected result.</p></div><button type="button" className="text-primary text-xs font-semibold">See full degree plan</button></div>
            <ul>{COURSES.map((course) => {
              const courseChoice = model.choices[course.id]
              const active = selected.id === course.id
              const date = courseChoice.sitting === 'resit' ? course.resit : courseChoice.sitting === 'skip' ? 'Not planned' : course.exam
              return <li key={course.id} className="border-b last:border-b-0"><button type="button" onClick={() => { setSelectedId(course.id); setSaved(false) }} className={`grid w-full grid-cols-[minmax(0,1fr)_110px_90px_20px] items-center gap-4 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6 ${active ? 'bg-primary/[0.045]' : 'hover:bg-muted/25'}`}><span><span className="font-data text-primary text-xs font-semibold tabular-nums">{course.code}</span><strong className="mt-0.5 block text-sm">{course.name}</strong></span><span><span className="text-muted-foreground block text-[10.5px] font-semibold tracking-[0.08em] uppercase">Planned</span><span className="font-data mt-1 block text-sm tabular-nums">{date}</span></span><span><span className="text-muted-foreground block text-[10.5px] font-semibold tracking-[0.08em] uppercase">Expected</span><span className="font-data mt-1 block text-sm tabular-nums">{courseChoice.sitting === 'skip' ? 'None' : courseChoice.grade.toFixed(1)}</span></span><ChevronRightIcon className="text-muted-foreground size-4" /></button></li>
            })}</ul>
          </main>

          <aside className="border-t lg:border-t-0 lg:border-l">
            <div className="border-b px-5 py-5"><span className="font-data text-primary text-xs font-semibold tabular-nums">{selected.code}</span><h2 className="mt-1 text-lg font-semibold">Plan {selected.name}</h2><p className="text-muted-foreground mt-1 text-xs">{selected.ects} ECTS · {selected.requirement}</p></div>
            <div className="border-b px-5 py-5"><SittingControl course={selected} choice={choice} onChange={(patch) => { model.update(selected.id, patch); setSaved(false) }} /></div>
            <div className="border-b px-5 py-5"><h3 className="text-sm font-semibold">What this choice means</h3><ul className="mt-4 space-y-4 text-sm"><li className="flex gap-3"><CalendarDaysIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" /><span>{choice.sitting === 'resit' ? `Your exam moves to ${selected.resit}. The standard sitting on ${selected.exam} leaves your plan.` : choice.sitting === 'skip' ? 'This course leaves the current exam plan.' : `Your exam stays on ${selected.exam}.`}</span></li><li className="flex gap-3"><CheckIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" /><span>{choice.sitting !== 'skip' && choice.grade >= 5.5 ? `A pass adds ${selected.ects} ECTS to your projection.` : 'This choice adds no projected credits.'}</span></li></ul><div className="mt-5"><div className="flex items-baseline justify-between"><span className="text-xs font-semibold">Attendance</span><span className="font-data text-sm tabular-nums">{selected.attendance}</span></div><div className="mt-2"><ProgressLine value={selected.id === 'statistics' ? 75 : 88} /></div><p className="text-muted-foreground mt-2 text-xs">{selected.attendanceNote}</p></div></div>
            <div className="px-5 py-5"><button type="button" onClick={() => setSaved(true)} className="flex h-10 w-full items-center justify-center gap-2 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground">{saved ? <><CheckIcon className="size-4" />Saved to your plan</> : <>Save this decision <ArrowRightIcon className="size-4" /></>}</button><p className="text-muted-foreground mt-3 text-center text-xs">This never registers you for the exam.</p></div>
          </aside>
        </div>
      </section>
    </div>
  </div>
}
