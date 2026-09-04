'use client'

import { useState } from 'react'
import { ArrowRightIcon, CheckIcon, ChevronRightIcon } from 'lucide-react'
import { COURSES, PageHeader, ProgressLine, RegistrationNotice, StatusStrip, usePlanningPrototype } from './shared'

const GOALS = ['Finish Year 1 by February', 'Keep October lighter', 'Aim for a 7.5 average']

export function ScenarioLedger() {
  const model = usePlanningPrototype()
  const [goal, setGoal] = useState(GOALS[0])
  return <div className="min-h-full bg-background pb-24">
    <PageHeader description="Start with what you want to achieve. Wicker turns it into a course plan and explains the tradeoffs in plain language." />
    <StatusStrip projectedCredits={model.summary.projectedCredits} expectedGrade={model.summary.expectedGrade} />
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[14px] border bg-card">
        <div className="border-b px-5 py-5 sm:px-6"><h2 className="text-lg font-semibold">What do you want this plan to do?</h2><div className="mt-4 flex flex-wrap gap-2">{GOALS.map((item) => <button key={item} type="button" onClick={() => setGoal(item)} className={`h-10 rounded-[6px] border px-4 text-sm font-semibold transition-colors ${goal === item ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50'}`}>{item}</button>)}</div></div>
        <RegistrationNotice compact open={model.registrationOpen} setOpen={model.setRegistrationOpen} registered={model.registered} setRegistered={model.setRegistered} />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0">
            <div className="border-b px-5 py-5 sm:px-6"><span className="text-muted-foreground text-xs font-semibold">YOUR GOAL</span><h2 className="font-heading mt-1 text-[28px] font-semibold tracking-[-0.025em]">{goal}</h2><div className="mt-5 flex items-center gap-4"><div className="min-w-0 flex-1"><ProgressLine value={(model.summary.projectedCredits / 72) * 100} /></div><span className="font-data text-sm font-semibold tabular-nums">{model.summary.projectedCredits} / 72 ECTS</span></div><p className="text-muted-foreground mt-3 text-sm">Choose the courses below. The result updates as you make changes.</p></div>
            <div className="grid grid-cols-[minmax(0,1fr)_110px_190px_90px] border-b bg-muted/20 px-5 py-3 text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted-foreground sm:px-6"><span>Course</span><span>Include</span><span>When</span><span>Expected</span></div>
            <div>{COURSES.map((course) => {
              const choice = model.choices[course.id]
              const included = choice.sitting !== 'skip'
              return <div key={course.id} className="grid min-h-[78px] grid-cols-[minmax(0,1fr)_110px_190px_90px] items-center border-b px-5 py-3 last:border-b-0 sm:px-6"><span><span className="font-data text-primary text-xs font-semibold tabular-nums">{course.code}</span><strong className="mt-0.5 block text-sm">{course.name}</strong></span><label className="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={included} onChange={(event) => model.update(course.id, { sitting: event.target.checked ? 'standard' : 'skip' })} className="size-4 accent-primary" />{included ? 'Yes' : 'No'}</label><div className="flex overflow-hidden rounded-[6px] border bg-card"><button type="button" disabled={!included} onClick={() => model.update(course.id, { sitting: 'standard' })} className={`h-9 flex-1 px-2 text-xs font-semibold disabled:opacity-40 ${choice.sitting === 'standard' ? 'bg-primary text-primary-foreground' : ''}`}>{course.exam}</button><button type="button" disabled={!included} onClick={() => model.update(course.id, { sitting: 'resit' })} className={`h-9 flex-1 border-l px-2 text-xs font-semibold disabled:opacity-40 ${choice.sitting === 'resit' ? 'bg-primary text-primary-foreground' : ''}`}>{course.resit}</button></div><input aria-label={`Expected grade for ${course.name}`} type="number" min="1" max="10" step="0.5" disabled={!included} value={choice.grade} onChange={(event) => model.update(course.id, { grade: Number(event.target.value) })} className="font-data h-9 w-[68px] rounded-[6px] border bg-card px-2 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40" /></div>
            })}</div>
          </main>
          <aside className="border-t lg:border-t-0 lg:border-l">
            <div className="border-b px-5 py-5"><h2 className="text-lg font-semibold">If you follow this plan</h2><p className="text-muted-foreground mt-1 text-sm">Here is the outcome Wicker currently expects.</p></div>
            <dl className="grid grid-cols-2 border-b"><div className="border-r px-5 py-4"><dt className="text-muted-foreground text-xs">Credits after exams</dt><dd className="font-data mt-1 text-2xl font-semibold tabular-nums">{model.summary.projectedCredits}</dd></div><div className="px-5 py-4"><dt className="text-muted-foreground text-xs">Expected average</dt><dd className="font-data mt-1 text-2xl font-semibold tabular-nums">{model.summary.expectedGrade?.toFixed(1) || 'None'}</dd></div></dl>
            <div className="border-b px-5 py-5"><h3 className="text-sm font-semibold">What changes</h3><ul className="mt-4 space-y-4 text-sm"><li className="flex gap-3"><CheckIcon className="text-primary mt-0.5 size-4 shrink-0" /><span>{model.summary.projectedCredits >= 72 ? 'This plan completes the remaining Year 1 credits.' : `${72 - model.summary.projectedCredits} more ECTS are needed to finish Year 1.`}</span></li><li className="flex gap-3"><span className="font-data text-muted-foreground w-4 shrink-0 text-center">↳</span><span>{model.choices.statistics.sitting === 'resit' ? 'Statistics moves out of the October exam cluster.' : 'Algorithmic Design and Statistics stay two days apart in October.'}</span></li><li className="flex gap-3"><span className="font-data text-muted-foreground w-4 shrink-0 text-center">!</span><span>Statistics attendance remains at its allowed absence limit.</span></li></ul></div>
            <button type="button" className="flex w-full items-center justify-between border-b px-5 py-4 text-left hover:bg-muted/25"><span><strong className="block text-sm">See the whole bachelor</strong><span className="text-muted-foreground mt-0.5 block text-xs">Years 1 to 3 and every open requirement</span></span><ChevronRightIcon className="text-muted-foreground size-4" /></button>
            <div className="px-5 py-5"><button type="button" className="flex h-10 w-full items-center justify-center gap-2 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground">Save this plan <ArrowRightIcon className="size-4" /></button><p className="text-muted-foreground mt-3 text-center text-xs">Official grades and registrations are never changed.</p></div>
          </aside>
        </div>
      </section>
    </div>
  </div>
}
