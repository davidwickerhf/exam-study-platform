import Link from 'next/link'
import { ArrowRightIcon, CircleDotIcon } from 'lucide-react'
import { Bar, courses, DATA, LABEL, ProtoHeader, requirements } from './shared'

const years = [
  { year: 1, earned: 60, total: 60, note: 'Progression cleared' },
  { year: 2, earned: 32, total: 60, note: '28 ECTS remain' },
  { year: 3, earned: 0, total: 60, note: '32 ECTS planned' },
]

export function DegreeAtlas() {
  return <main className="mx-auto flex min-h-dvh w-full max-w-[1240px] flex-col gap-8 p-5 pb-24 sm:p-8 sm:pb-24">
    <ProtoHeader title="Your route through the degree" description="A spatial overview of completed years, active modules, future choices, and the gates between them." />
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="grid border-b md:grid-cols-[230px_repeat(3,minmax(0,1fr))]"><div className="flex flex-col justify-center px-5 py-4 sm:px-6"><span className={LABEL}>Bachelor route</span><strong className="font-heading mt-1 text-xl">92 / 180 ECTS</strong></div>{years.map((item, index) => <div key={item.year} className={`px-5 py-4 ${index ? 'border-t md:border-t-0 md:border-l' : 'border-t md:border-t-0 md:border-l'}`}><div className="flex justify-between"><strong className="text-sm">Year {item.year}</strong><span className={`text-muted-foreground text-xs ${DATA}`}>{item.earned}/{item.total}</span></div><Bar value={item.earned / item.total * 100} className="mt-3" /><p className="text-muted-foreground mt-2 text-xs">{item.note}</p></div>)}</header>
      <div className="grid min-w-[800px] grid-cols-[230px_repeat(3,minmax(0,1fr))]">
        <div className="border-r px-5 py-5 sm:px-6"><span className={LABEL}>Course map</span><p className="text-muted-foreground mt-2 text-xs leading-relaxed">Courses sit in their curriculum year. The Session Board decides when each exam is taken.</p></div>
        {years.map((year) => <div key={year.year} className="border-r last:border-r-0"><div className="grid min-h-[360px] content-start gap-0">{courses.filter((course) => course.year === year.year).map((course) => <Link key={course.code} href="/app/planning?tab=courses" className="group flex min-h-[72px] items-center gap-3 border-b px-4 py-3 hover:bg-muted/25"><span className={`size-2 shrink-0 rounded-full ${course.state === 'passed' ? 'bg-primary' : course.state === 'resit' ? 'border-2 border-primary bg-background' : 'border border-muted-foreground bg-background'}`} /><span className="min-w-0 flex-1"><strong className={`text-primary block text-[10px] ${DATA}`}>{course.code} · {course.ects} ECTS</strong><span className="mt-1 block truncate text-xs font-semibold">{course.name}</span><span className="text-muted-foreground mt-1 block text-[10px]">{course.period ? `Period ${course.period}` : 'Full-year work'} · {course.state}</span></span><ArrowRightIcon className="text-muted-foreground size-3.5 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" /></Link>)}</div></div>)}
      </div>
      <footer className="grid border-t md:grid-cols-[230px_repeat(3,minmax(0,1fr))]"><div className="px-5 py-4 sm:px-6"><span className={LABEL}>Progression gates</span></div>{years.map((year) => { const gate = requirements[Math.min(year.year - 1, requirements.length - 1)]; return <div key={year.year} className="flex items-start gap-2 border-t px-4 py-4 md:border-t-0 md:border-l"><CircleDotIcon className={`mt-0.5 size-3.5 shrink-0 ${gate.value >= gate.target ? 'text-primary' : 'text-muted-foreground'}`} /><span><strong className="block text-xs">{gate.label}</strong><span className={`text-muted-foreground mt-1 block text-[10px] ${DATA}`}>{gate.value}/{gate.target} · {gate.source}</span></span></div>})}</footer>
    </section>
    <div className="grid gap-6 md:grid-cols-3"><div className="rounded-xl border bg-card px-5 py-4"><span className={LABEL}>Attendance</span><strong className={`mt-2 block text-2xl ${DATA}`}>94%</strong><p className="text-muted-foreground mt-1 text-xs">One allowed absence remains in BCS3120.</p></div><div className="rounded-xl border bg-card px-5 py-4"><span className={LABEL}>Next exam window</span><strong className="mt-2 block text-sm">Period 2 exams + Period 1 resits</strong><p className={`text-muted-foreground mt-1 text-xs ${DATA}`}>14–18 December</p></div><div className="rounded-xl border bg-card px-5 py-4"><span className={LABEL}>Open choice</span><strong className={`mt-2 block text-2xl ${DATA}`}>8 ECTS</strong><p className="text-muted-foreground mt-1 text-xs">Year 3 elective space is not assigned.</p></div></div>
  </main>
}
