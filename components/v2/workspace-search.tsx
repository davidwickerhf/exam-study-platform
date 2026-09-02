'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRightIcon, BookOpenIcon, SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type SearchResult, searchable, searchHref, searchLabel } from '@/lib/v2/search.mjs'

type Course = { id: string; code: string; name: string }
type SearchHit = SearchResult & { courseId: string; courseCode: string; score?: number }

export function WorkspaceSearch() {
  const [open, setOpen] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('all')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/state').then(async (response) => {
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || `Courses returned ${response.status}`)
      if (live) setCourses(body.courses ?? [])
    }).catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!searchable(query)) { setResults([]); setLoading(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      const scope = courseId === 'all' ? courses : courses.filter((course) => course.id === courseId)
      try {
        const batches = await Promise.all(scope.map(async (course) => {
          const response = await fetch(`/api/search/${encodeURIComponent(course.id)}?q=${encodeURIComponent(query.trim())}&limit=20`, { signal: controller.signal })
          const body = await response.json().catch(() => null)
          if (!response.ok) throw new Error(body?.error || `Search returned ${response.status}`)
          return (body.results ?? []).map((result: SearchResult & { score?: number }) => ({ ...result, courseId: course.id, courseCode: course.code }))
        }))
        setResults(batches.flat().sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 60))
      } catch (cause) {
        if ((cause as Error).name !== 'AbortError') setError((cause as Error).message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [courseId, courses, query])

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant="outline" size="sm" className="w-full justify-start" />}><SearchIcon data-icon="inline-start" />Search material</DialogTrigger>
    <DialogContent className="flex max-h-[min(760px,calc(100dvh-32px))] w-[min(820px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-none border-t-2 border-t-primary p-0 sm:max-w-[820px]">
      <DialogHeader className="gap-1 px-7 pt-6 pb-5">
        <DialogTitle className="text-xl">Search your study library</DialogTitle>
        <DialogDescription>One search across every maintained chapter, explanation, formula, example, and exam technique.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-7 pb-5">
        <div className="relative">
          <SearchIcon aria-hidden="true" className="text-primary pointer-events-none absolute top-1/2 left-4 -translate-y-1/2" />
          <Input aria-label="Search study material" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What do you need to understand?" className="h-12 rounded-sm border-input bg-background pr-4 pl-11 text-base focus-visible:border-primary" autoFocus />
        </div>
        <div className="flex items-center gap-3 max-sm:items-start max-sm:flex-col">
          <span className="text-muted-foreground shrink-0 text-xs font-semibold uppercase tracking-wider">Scope</span>
          <ToggleGroup aria-label="Course scope" className="min-w-0 max-w-full flex-wrap justify-start" size="sm" variant="outline" spacing={1}>
            <ToggleGroupItem pressed={courseId === 'all'} onPressedChange={() => setCourseId('all')} className="rounded-sm px-3">All courses</ToggleGroupItem>
            {courses.map((course) => <ToggleGroupItem key={course.id} pressed={courseId === course.id} onPressedChange={() => setCourseId(course.id)} className="rounded-sm px-3">{course.code}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>
      <Separator />
      <ScrollArea className="min-h-48 flex-1">
        <div className="flex flex-col">
          {loading && <p className="text-muted-foreground flex items-center gap-2 px-6 py-6 text-sm"><Spinner />Searching headings, explanations, formulas, and examples…</p>}
          {error && <p role="alert" className="px-6 py-6 text-sm">Search unavailable: {error}</p>}
          {!loading && !error && !searchable(query) && <div className="grid grid-cols-[1fr_1.5fr] gap-8 px-7 py-7 max-sm:grid-cols-1">
            <div className="flex flex-col gap-2"><BookOpenIcon className="text-primary" /><strong className="text-base">Start with the thing you remember</strong><p className="text-muted-foreground text-sm leading-relaxed">A theorem name, a formula fragment, an exercise topic, or even wording from a definition.</p></div>
            <div className="flex flex-col gap-2"><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Try searching</span>{['interval scheduling greedy rule', 'Bayes theorem worked example', 'buffer overflow mitigation', 'Euler method error'].map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuery(suggestion)} className="group flex items-center justify-between border-b py-2 text-left text-sm hover:text-primary"><span>{suggestion}</span><ArrowRightIcon className="text-muted-foreground transition-transform group-hover:translate-x-1" /></button>)}</div>
          </div>}
          {!loading && !error && searchable(query) && !results.length && <div className="flex flex-col gap-1 px-6 py-8"><strong className="text-sm">No matches</strong><p className="text-muted-foreground text-sm">Try fewer words, a related term, or a different course scope.</p></div>}
          {!loading && results.map((result) => <Link key={`${result.courseId}:${result.chapterId}:${result.headingSlug ?? ''}`} href={searchHref(result.courseId, result)} onClick={() => setOpen(false)} className="hover:bg-card group grid grid-cols-[88px_1fr_auto] items-start gap-4 border-b px-7 py-4 last:border-b-0 max-sm:grid-cols-[auto_1fr]">
            <Badge variant="outline" className="mt-0.5 shrink-0 rounded-sm">{result.courseCode}</Badge>
            <span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-sm">{searchLabel(result)}</strong>{result.snippet && <span className="text-muted-foreground line-clamp-2 text-sm">{result.snippet}</span>}</span>
            <ArrowRightIcon aria-hidden="true" className="text-muted-foreground mt-1 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>)}
        </div>
      </ScrollArea>
      <Separator />
      <div className="text-muted-foreground flex items-center justify-between px-7 py-3 text-xs"><span>{results.length ? `${results.length} best matches` : `${courses.length} active courses · full-text search`}</span><span>Esc to close</span></div>
    </DialogContent>
  </Dialog>
}
