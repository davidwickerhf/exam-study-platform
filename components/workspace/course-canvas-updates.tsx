'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Change = { kind: string; id: string; title: string; change: 'new' | 'changed' | 'unavailable' }
type CourseUpdate = { bindingId: string; academicYear: string; canvasUrl: string; canvasCourseId: string; active: boolean; paused: boolean; automatic: boolean; status: string; checkedAt: string | null; busy: 'checking' | 'syncing' | null; changes: Change[]; unchecked: string[] }

export function CourseCanvasUpdates({ courseCode, academicYear }: { courseCode: string; academicYear: string }) {
  const [courses, setCourses] = useState<CourseUpdate[]>([])
  const [action, setAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const alive = useRef(true)
  const url = `/api/integrations/canvas/freshness?courseCode=${encodeURIComponent(courseCode)}&academicYear=${encodeURIComponent(academicYear)}`
  const load = useCallback(async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error('Course update status could not be loaded.')
    const result = await response.json()
    if (alive.current) setCourses(result.courses || [])
  }, [url])
  useEffect(() => {
    alive.current = true
    setCourses([]); setError(null); setNotice(null)
    void load().catch(() => {})
    return () => { alive.current = false }
  }, [load])
  const pending = courses.some(course => course.busy)
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) void load().catch(() => {}) }, pending ? 10_000 : 60_000)
    return () => clearInterval(timer)
  }, [load, pending])
  async function act(course: CourseUpdate, scrape: boolean) {
    if (action) return
    setAction(course.bindingId); setError(null); setNotice(null)
    try {
      const response = await fetch(scrape ? '/api/integrations/canvas/corpus/course' : '/api/integrations/canvas/freshness', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(45_000),
        body: JSON.stringify(scrape ? { canvasUrl: course.canvasUrl, canvasCourseId: course.canvasCourseId, force: false } : { bindingId: course.bindingId })
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'This request could not be queued. Try again.')
      if (alive.current) setNotice(body.queued ? scrape ? 'Material refresh queued. You can keep studying.' : 'Checking Canvas for changes…' : 'A request is already active or was made recently. Check again in a few minutes.')
      await load()
    } catch (cause) { if (alive.current) setError((cause as Error).message) }
    finally { if (alive.current) setAction(null) }
  }
  const visible = courses.filter(course => !course.paused && (course.active || course.changes.length))
  if (!visible.length) return null
  return <section aria-label="Canvas course updates" className="mb-6 border-b pb-5 text-sm">
    {visible.map(course => <div key={course.bindingId} className="mb-3 last:mb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{course.busy === 'syncing' ? 'Updating course materials' : course.busy === 'checking' ? 'Checking Canvas' : course.changes.length ? `${course.changes.length} Canvas ${course.changes.length === 1 ? 'update' : 'updates'} available` : course.status === 'current' ? 'Materials up to date' : course.status === 'partial' ? 'Some Canvas sources could not be checked' : 'Check for new course materials'} <span className="text-muted-foreground font-normal">· {course.academicYear}</span></p>
          <p className="text-muted-foreground mt-1 text-xs">{course.changes.length ? 'Refresh to include these changes in your saved materials.' : course.status === 'partial' ? 'This is not a confirmation that all materials are current.' : course.checkedAt ? `Last checked ${new Date(course.checkedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : 'Checks look for changes without downloading documents.'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" disabled={Boolean(action || course.busy)} onClick={() => void act(course, false)}><RefreshCwIcon className={course.busy === 'checking' ? 'animate-spin motion-reduce:animate-none' : ''}/>Check for updates</Button>
          {(course.changes.length > 0 || course.status === 'partial') && <Button size="sm" disabled={Boolean(action || course.busy)} onClick={() => void act(course, true)}>Update materials</Button>}
        </div>
      </div>
      {course.changes.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-primary font-medium">What changed</summary><ul className="mt-2 space-y-1 text-muted-foreground">{course.changes.slice(0, 8).map(change => <li key={`${change.kind}:${change.id}`} className="break-words"><span className="text-foreground">{change.title}</span> · {change.kind} · {change.change === 'unavailable' ? 'no longer listed in Canvas' : change.change}</li>)}</ul>{course.changes.length > 8 && <p className="mt-2 text-muted-foreground">And {course.changes.length - 8} more changes.</p>}{course.unchecked.length > 0 && <p className="mt-2 text-muted-foreground">Some sources could not be compared; more changes may be available.</p>}</details>}
    </div>)}
    {notice && <p role="status" className="mt-2 text-muted-foreground">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
  </section>
}
