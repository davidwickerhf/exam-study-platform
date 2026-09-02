'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { type SearchResult, searchable, searchHref, searchLabel } from '@/lib/v2/search.mjs'

type Course = { id: string; code: string; name: string }

export function WorkspaceSearch() {
  const [open, setOpen] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/state').then(async (response) => {
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || `Courses returned ${response.status}`)
      if (live) { setCourses(body.courses ?? []); setCourseId((current) => current || body.courses?.[0]?.id || '') }
    }).catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!courseId || !searchable(query)) { setResults([]); setLoading(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true); setError(null)
      fetch(`/api/search/${encodeURIComponent(courseId)}?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then(async (response) => { const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || `Search returned ${response.status}`); setResults(body.results ?? []) })
        .catch((cause: Error) => { if (cause.name !== 'AbortError') setError(cause.message) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [courseId, query])

  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={<Button variant="outline" size="sm" className="w-full justify-start" />}><SearchIcon data-icon="inline-start" />Search material</SheetTrigger>
    <SheetContent side="right" className="w-full gap-5 p-5 sm:max-w-xl">
      <SheetHeader><SheetTitle>Search course material</SheetTitle><SheetDescription>Find a chapter, topic, definition, or worked example.</SheetDescription></SheetHeader>
      <div className="flex flex-col gap-3">
        <Select value={courseId} onValueChange={(value) => setCourseId(String(value))}><SelectTrigger aria-label="Course to search"><SelectValue placeholder="Choose a course" /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.code} · {course.name}</SelectItem>)}</SelectContent></Select>
        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chapters and topics" autoFocus />
      </div>
      <div className="flex flex-col overflow-y-auto border-t">
        {loading && <p className="text-muted-foreground py-5 text-sm">Searching course material…</p>}
        {error && <p role="alert" className="py-5 text-sm">Search unavailable: {error}</p>}
        {!loading && !error && !searchable(query) && <p className="text-muted-foreground py-5 text-sm">Enter at least two characters.</p>}
        {!loading && searchable(query) && !results.length && <p className="text-muted-foreground py-5 text-sm">No matches. Try a broader term.</p>}
        {results.map((result) => <Link key={`${result.chapterId}:${result.headingSlug ?? ''}`} href={searchHref(courseId, result)} onClick={() => setOpen(false)} className="hover:bg-card flex flex-col gap-1 border-b py-4"><strong className="text-sm">{searchLabel(result)}</strong>{result.snippet && <span className="text-muted-foreground text-sm">{result.snippet}</span>}</Link>)}
      </div>
    </SheetContent>
  </Sheet>
}
