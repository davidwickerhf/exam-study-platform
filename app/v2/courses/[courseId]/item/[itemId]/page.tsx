'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { Item, StudyCourse } from '@/lib/v2/courses.mjs'

export default function ItemPage() {
  const { courseId, itemId } = useParams<{ courseId: string; itemId: string }>()
  const [course, setCourse] = useState<StudyCourse | null>(null); const [item, setItem] = useState<Item | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  useEffect(() => { let live = true; fetch('/api/state', { headers: { accept: 'application/json' } }).then((response) => response.ok ? response.json() : Promise.reject(new Error(`State returned ${response.status}`))).then((data) => { if (!live) return; const found = (data.courses ?? []).find((entry: StudyCourse) => entry.id === courseId) ?? null; setCourse(found); setItem(found?.items?.find((entry: Item) => entry.id === itemId) ?? null) }).catch((cause: Error) => setError(cause.message)); return () => { live = false } }, [courseId, itemId])
  const save = async (patch: Record<string, unknown>) => { if (!item) return; setBusy(true); setError(null); try { const response = await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: 'PATCH', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(patch) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || `Topic returned ${response.status}`); setItem(data.item) } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) } }
  if (!course && !error) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>
  if (!course || !item) return <Empty><EmptyHeader><EmptyTitle>Topic not found</EmptyTitle><EmptyDescription>{error ?? 'This topic may have been renamed or removed.'}</EmptyDescription></EmptyHeader><Link href={`/v2/courses/${courseId}`} className="text-primary text-sm font-semibold">Back to course</Link></Empty>
  return <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 p-6 sm:p-8"><header className="border-b pb-4"><Link href={`/v2/courses/${courseId}`} className="text-primary text-sm font-semibold">Back to {course.code}</Link><h1 className="font-heading mt-2 text-4xl">{item.title}</h1></header><section className="flex flex-col gap-3"><h2 className="text-sm font-semibold">Mastery</h2><div className="flex gap-2">{[0,1,2,3,4].map((level) => <Button key={level} variant={item.mastery === level ? 'default' : 'outline'} disabled={busy} onClick={() => void save({ mastery: level })}>{level}</Button>)}</div><p className="text-muted-foreground text-xs">0 not started · 4 confident</p></section><form className="flex flex-col gap-3 border-t pt-5" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void save({ notes: String(data.get('notes') ?? ''), reviewEvent: { kind: 'review', note: String(data.get('reviewNote') ?? ''), mastery: item.mastery } }) }}><h2 className="text-sm font-semibold">Private topic record</h2><Textarea name="notes" defaultValue={item.notes ?? ''} placeholder="Study notes…" /><Input name="reviewNote" placeholder="What did you review today?" /><Button type="submit" className="self-start" disabled={busy}>Save record</Button></form>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}</div>
}
