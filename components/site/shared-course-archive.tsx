'use client'

import { ArrowRightIcon, SearchIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Course = { code: string; name: string; fileCount: number; paperCount: number; years: string[] }

export function SharedCourseArchive() {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    void fetch('/api/public/materials', { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('The course archive could not be loaded.'); return response.json() as Promise<{ courses: Course[] }> })
      .then(result => { if (live) setCourses(result.courses) })
      .catch(cause => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])
  const visible = useMemo(() => (courses || []).filter(course => `${course.code} ${course.name}`.toLowerCase().includes(query.toLowerCase().trim())), [courses, query])

  return <main id="main-content" className="site-reading-page mx-auto w-full max-w-[1060px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
    <header className="border-b border-current/15 pb-8">
      <p className="font-data text-xs font-semibold uppercase tracking-[0.13em] text-primary">Shared study library</p>
      <h1 className="font-heading mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">Course archive</h1>
      <p className="mt-3 max-w-[65ch] text-base text-muted-foreground">Browse released course files and practice questions. A Maastricht University account is needed to open the materials.</p>
    </header>
    <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-primary/25 bg-primary/5 p-5" aria-label="Continue in workspace">
      <div><h2 className="font-semibold">Make these materials part of your study workspace</h2><p className="mt-1 text-sm text-muted-foreground">Open courses alongside your own progress, study tools and connected sources.</p></div>
      <a className="site-button site-button-primary" href="/app/courses">Open workspace <ArrowRightIcon className="size-4" /></a>
    </section>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-heading text-xl font-semibold">Available courses</h2><p className="mt-1 text-sm text-muted-foreground">Only courses with released files appear here.</p></div><label className="flex h-10 w-full max-w-72 items-center gap-2 rounded-sm border bg-background px-3"><SearchIcon className="size-4 text-muted-foreground" /><input className="w-full bg-transparent text-sm outline-none" aria-label="Find a course" placeholder="Code or course name" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}
    {!courses && !error && <p role="status" className="mt-6 text-sm text-muted-foreground">Loading courses…</p>}
    {courses && !visible.length && <p className="mt-6 text-sm text-muted-foreground">{query ? 'No courses match that search.' : 'No course files have been released yet.'}</p>}
    <ul className="mt-6 divide-y border-y">{visible.map(course => <li key={course.code} className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="min-w-0 flex-1"><p className="font-data text-xs font-semibold uppercase tracking-[0.1em] text-primary">{course.code}</p><h3 className="mt-1 font-heading text-lg font-semibold">{course.name}</h3><p className="mt-1 text-sm text-muted-foreground">{course.fileCount} files · {course.paperCount} exam papers{course.years.length ? ` · ${course.years.join(', ')}` : ''}</p></div><a className="inline-flex h-10 items-center gap-2 rounded-sm border px-4 text-sm font-semibold hover:border-primary hover:text-primary" href={`/share/courses/${encodeURIComponent(course.code)}/materials`}>View materials <ArrowRightIcon className="size-4" /></a></li>)}</ul>
  </main>
}
