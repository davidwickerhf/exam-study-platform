'use client'

import { CalendarCheckIcon, CheckIcon, ChevronRightIcon } from 'lucide-react'
import { COURSES, PageHeader, RegistrationNotice, StatusStrip, usePlanningPrototype } from './shared'

const months = ['September', 'October', 'November', 'December', 'January', 'February']

export function RequirementBoard() {
  const model = usePlanningPrototype()
  return <div className="min-h-full bg-background pb-24">
    <PageHeader description="Put every exam on one clear timeline. Choose a date directly and see when your workload becomes crowded." />
    <StatusStrip projectedCredits={model.summary.projectedCredits} expectedGrade={model.summary.expectedGrade} />
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[14px] border bg-card">
        <RegistrationNotice compact open={model.registrationOpen} setOpen={model.setRegistrationOpen} registered={model.registered} setRegistered={model.setRegistered} />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_310px]">
          <main className="min-w-0 overflow-x-auto">
            <div className="flex min-w-[760px] items-end justify-between gap-5 border-b px-6 py-5"><div><h2 className="text-lg font-semibold">Your exam timeline</h2><p className="text-muted-foreground mt-1 text-sm">Click a date to choose that sitting. Your plan can always be changed later.</p></div><span className="font-data shrink-0 text-sm tabular-nums">4 courses · 24 ECTS possible</span></div>
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[200px_minmax(0,1fr)] border-b bg-muted/20"><span className="px-5 py-3 text-[10.5px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">Course</span><div className="grid grid-cols-6">{months.map((month) => <span key={month} className="border-l px-3 py-3 text-center text-[10.5px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">{month.slice(0, 3)}</span>)}</div></div>
              {COURSES.map((course) => {
                const choice = model.choices[course.id]
                const standardLeft = course.period === 1 ? '24%' : '57%'
                return <div key={course.id} className="grid min-h-24 grid-cols-[200px_minmax(0,1fr)] border-b last:border-b-0">
                  <div className="flex flex-col justify-center px-5 py-4"><span className="font-data text-primary text-xs font-semibold tabular-nums">{course.code}</span><strong className="mt-0.5 text-sm">{course.name}</strong><span className="text-muted-foreground mt-1 text-xs">{course.ects} ECTS</span></div>
                  <div className="relative border-l">
                    <div className="absolute inset-0 grid grid-cols-6">{months.map((month) => <span key={month} className="border-r last:border-r-0" />)}</div>
                    <span className="bg-border absolute inset-x-0 top-1/2 h-px" />
                    {([['standard', standardLeft, course.exam, 'Standard'], ['resit', '91%', course.resit, 'Resit']] as const).map(([sitting, left, date, label]) => {
                      const selected = choice.sitting === sitting
                      return <button key={sitting} type="button" aria-label={`${date} ${label}`} onClick={() => model.update(course.id, { sitting })} style={{ left }} className="group absolute top-1/2 z-10 h-14 w-16 -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"><span className={`absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform group-hover:scale-125 ${selected ? 'border-primary bg-primary ring-4 ring-primary/10' : 'border-border-strong bg-card'}`} /><span className={`font-data absolute inset-x-0 top-0 text-center text-[10px] font-semibold tabular-nums ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span><span className={`font-data absolute inset-x-0 bottom-0 text-center text-[11px] font-semibold tabular-nums ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>{date}</span></button>
                    })}
                  </div>
                </div>
              })}
            </div>
          </main>
          <aside className="border-t lg:border-t-0 lg:border-l">
            <div className="border-b px-5 py-5"><h2 className="text-lg font-semibold">This plan at a glance</h2><p className="text-muted-foreground mt-1 text-sm">A readable forecast, not an official record.</p></div>
            <div className="border-b px-5 py-5"><div className="flex items-start gap-3"><CalendarCheckIcon className="text-primary mt-0.5 size-4 shrink-0" /><div><strong className="block text-sm">October is your busiest point</strong><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Two exams fall within three days. Moving Statistics to its resit would separate them.</p></div></div><button type="button" onClick={() => model.update('statistics', { sitting: model.choices.statistics.sitting === 'resit' ? 'standard' : 'resit' })} className="mt-4 h-9 rounded-[6px] border px-3 text-xs font-semibold hover:bg-muted/30">{model.choices.statistics.sitting === 'resit' ? 'Move Statistics back to October' : 'Try Statistics in February'}</button></div>
            <div className="border-b px-5 py-5"><h3 className="text-sm font-semibold">Expected results</h3><div className="mt-4 space-y-3">{COURSES.map((course) => <label key={course.id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate">{course.name}</span><input aria-label={`Expected grade for ${course.name}`} type="number" min="1" max="10" step="0.5" value={model.choices[course.id].grade} onChange={(event) => model.update(course.id, { grade: Number(event.target.value) })} className="font-data h-9 w-16 rounded-[6px] border bg-card px-2 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" /></label>)}</div></div>
            <div className="border-b px-5 py-5"><h3 className="text-sm font-semibold">If every planned exam is passed</h3><dl className="mt-4 grid grid-cols-2 gap-y-4 text-xs"><div><dt className="text-muted-foreground">Credits</dt><dd className="font-data mt-1 text-lg font-semibold tabular-nums">{model.summary.projectedCredits}</dd></div><div><dt className="text-muted-foreground">Expected average</dt><dd className="font-data mt-1 text-lg font-semibold tabular-nums">{model.summary.expectedGrade?.toFixed(1)}</dd></div><div className="col-span-2 flex items-center gap-2"><CheckIcon className="text-primary size-4" /><span>Year 1 core stays on schedule</span></div></dl></div>
            <button type="button" className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-primary hover:bg-muted/25">Review all degree requirements <ChevronRightIcon className="size-4" /></button>
          </aside>
        </div>
      </section>
    </div>
  </div>
}
