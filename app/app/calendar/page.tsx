'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  BookOpenIcon, CalendarDaysIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon,
  CircleAlertIcon, Clock3Icon, ExternalLinkIcon,
  GripVerticalIcon, MoreHorizontalIcon, PanelLeftCloseIcon,
  PanelLeftOpenIcon, PanelRightCloseIcon, PanelRightOpenIcon, PencilIcon,
  PlusIcon, RefreshCwIcon, RotateCcwIcon, Trash2Icon, XIcon
} from 'lucide-react'
import { CanvasMark } from '@/components/brand/canvas-mark'
import { Button, buttonVariants } from '@/components/ui/button'
import { Calendar as DatePicker } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { type CalendarChange, type CalendarEvent, type CalendarPayload, localIsoDate, roomOf } from '@/lib/workspace/home.mjs'
import type { Course } from '@/lib/workspace/academics.mjs'
import type { GridApi } from './calendar-grid'

const VIEWS = [
  { id: 'dayGridMonth', label: 'Month' },
  { id: 'timeGridWeek', label: 'Week' },
  { id: 'timeGridDay', label: 'Today' },
  { id: 'listMonth', label: 'Agenda' }
] as const
const calendarView = (requested: string | null) => VIEWS.some(({ id }) => id === requested) ? requested! : 'timeGridWeek'
const NUMERALS = 'font-data tabular-nums'
const LABEL = 'text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase'
const INSTITUTION = new Set(['exam-week', 'period', 'study-week', 'holiday', 'ceremony', 'registration', 'institution'])
const LEFT_MIN = 224
const LEFT_MAX = 420
const RIGHT_MIN = 270
const RIGHT_MAX = 420

type AttendanceStatus = 'unknown' | 'attended' | 'missed' | 'excused'
type CalendarData = CalendarPayload & { categories: Record<string, string> }
type AcademicsData = { workspace?: { revision: number; courses: Course[] } }
type ComposerSeed = { mode: 'create' | 'edit' | 'copy'; date: string; event?: CalendarEvent }
type SourceTone = 'wicker' | 'plan' | 'institution' | 'feed' | 'canvas'
type SourceRow = { id: string; label: string; group: 'mine' | 'connected'; tone: SourceTone; feedId?: string; problem?: string }

function GridSkeleton() {
  return <div className="grid h-full grid-cols-7 gap-px" aria-hidden="true">{Array.from({ length: 35 }).map((_, index) => <Skeleton key={index} className="min-h-16 rounded-none" />)}</div>
}
const CalendarGrid = dynamic(() => import('./calendar-grid'), { ssr: false, loading: GridSkeleton })

function fullDay(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`)).replace(/^([^ ]+) /, '$1, ')
}
function eventTime(event: CalendarEvent) {
  if (event.allDay) return 'All day'
  const format = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return [format.format(new Date(event.start)), event.end ? format.format(new Date(event.end)) : null].filter(Boolean).join('–')
}
function localTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function previousDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
function attendanceLabel(status?: AttendanceStatus) {
  if (status === 'attended') return 'Attended'
  if (status === 'missed') return 'Missed'
  if (status === 'excused') return 'Excused'
  return 'Not marked'
}
function sourceId(event: CalendarEvent) { return event.source || event.category }

const SOURCE_TONES: Record<SourceTone, string> = {
  wicker: 'border-primary bg-primary text-primary-foreground',
  plan: 'border-foreground bg-foreground text-card',
  institution: 'border-violet-500 bg-violet-500 text-white',
  feed: 'border-emerald-600 bg-emerald-600 text-white',
  canvas: 'border-[#E72429] bg-[#E72429] text-white'
}

const CHANGE_LABEL: Record<CalendarChange['kind'], string> = {
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  'room-changed': 'Room changed',
  updated: 'Updated'
}

function TimetableChanges({ changes, onDismiss }: { changes: CalendarChange[]; onDismiss: (id: string) => void }) {
  if (!changes.length) return null
  return <section className="bg-card shrink-0 border-b px-4 sm:px-6" aria-labelledby="timetable-changes-title">
    <div className="flex items-baseline justify-between gap-4 py-2"><h2 id="timetable-changes-title" className={LABEL}>Timetable changes</h2><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{changes.length} unread</span></div>
    <ul>{changes.slice(0, 3).map((change) => <li key={change.id} className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-start gap-3 border-t py-2.5 max-sm:grid-cols-[80px_minmax(0,1fr)_auto]"><strong className={`text-primary text-[10.5px] leading-5 font-semibold tracking-[0.08em] uppercase ${NUMERALS}`}>{CHANGE_LABEL[change.kind]}</strong><span className="min-w-0 text-sm leading-5"><b className="font-medium">{change.title}</b><small className="text-muted-foreground ml-2">{change.detail} · {change.feedLabel}</small></span><button type="button" onClick={() => onDismiss(change.id)} className="text-muted-foreground hover:text-foreground rounded-sm p-0.5 focus-visible:outline-2" aria-label={`Dismiss change to ${change.title}`}><XIcon className="size-4" /></button></li>)}</ul>
  </section>
}

function SourceVisibilityToggle({ source, visible, onToggle }: { source: SourceRow; visible: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-pressed={visible} aria-label={`${visible ? 'Hide' : 'Show'} ${source.label}`} className={cn('grid size-4 shrink-0 place-items-center rounded-[3px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', visible ? SOURCE_TONES[source.tone] : 'border-input bg-card text-transparent')}><CheckIcon className="size-3 stroke-[2.5]" /></button>
}

function AttendanceButtons({ event, saving, onMark }: { event: CalendarEvent; saving: boolean; onMark: (status: AttendanceStatus) => void }) {
  const future = new Date(event.start).getTime() > Date.now()
  return (
    <section className="border-b px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Attendance</h3>
        <span className={cn('rounded-md px-2 py-1 text-[10px] font-semibold tracking-[0.07em] uppercase', event.attendanceRequired ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{event.attendanceRequired ? 'Required' : 'Personal record'}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-md border">
        {(['attended', 'missed', 'excused'] as const).map((status) => <button key={status} type="button" disabled={saving || future} onClick={() => onMark(status)} className={cn('flex h-9 items-center justify-center gap-1 border-r text-xs font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-45', event.attendanceStatus === status ? 'bg-foreground text-card' : 'bg-card text-muted-foreground hover:bg-muted')}>{status === 'attended' && <CheckIcon className="size-3.5" />}{attendanceLabel(status)}</button>)}
      </div>
      {event.attendanceStatus && event.attendanceStatus !== 'unknown' && <button type="button" disabled={saving} onClick={() => onMark('unknown')} className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-[11px] font-medium hover:text-foreground"><RotateCcwIcon className="size-3" /> Clear attendance mark</button>}
      {future && <p className="text-muted-foreground mt-2 text-xs">Attendance can be marked when this session begins.</p>}
      {event.attendanceRequired && event.attendanceRule && <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-xs font-semibold">Why attendance is required</summary><p className="text-muted-foreground mt-2 text-xs leading-relaxed">{event.attendanceRule}</p><p className={`text-primary mt-2 text-[11px] font-semibold ${NUMERALS}`}>{event.attendancePolicy?.source || 'Verified course rule'}</p></details>}
    </section>
  )
}

function DayDesk({ selected, selectedDate, dayEvents, attendanceSaving, attendanceError, onSelect, onMark, onEdit, onCopy, onClear, onCollapse }: {
  selected: CalendarEvent | null; selectedDate: string; dayEvents: CalendarEvent[]; attendanceSaving: boolean; attendanceError: string | null
  onSelect: (event: CalendarEvent) => void; onMark: (status: AttendanceStatus) => void; onEdit: (event: CalendarEvent) => void
  onCopy: (event: CalendarEvent) => void; onClear: () => void; onCollapse?: () => void
}) {
  const deadlines = dayEvents.filter((event) => ['deadline', 'canvas-deadline', 'exam'].includes(event.category))
  const attendanceDue = dayEvents.filter((event) => event.attendanceEligible && new Date(event.start).getTime() <= Date.now() && (!event.attendanceStatus || event.attendanceStatus === 'unknown'))
  return (
    <aside className="bg-card h-full min-h-0 overflow-y-auto" aria-label="Day desk">
      <header className="flex min-h-[88px] items-start justify-between gap-4 border-b px-5 py-5">
        <div className="min-w-0"><p className={LABEL}>{selected ? 'Selected event' : 'Day desk'}</p><h2 className="font-heading mt-1.5 text-2xl leading-[1.05] font-semibold tracking-[-0.025em]">{selected ? selected.courseName || selected.title : fullDay(selectedDate)}</h2></div>
        <div className="flex shrink-0 gap-1">{selected && <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Back to day summary"><ChevronRightIcon /></Button>}{onCollapse && <Button type="button" variant="ghost" size="icon-sm" onClick={onCollapse} aria-label="Collapse day desk"><PanelRightCloseIcon /></Button>}</div>
      </header>
      {selected ? <>
        <section className="border-b px-5 py-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-2.5"><Clock3Icon className="text-muted-foreground size-4" /><span><strong className={`block text-sm ${NUMERALS}`}>{eventTime(selected)}</strong><small className="text-muted-foreground mt-0.5 block text-xs">{fullDay(selected.start.slice(0, 10))}</small></span></div>
            {selected.courseCode && <div className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-2.5"><BookOpenIcon className="text-muted-foreground size-4" /><span><strong className={`block text-sm ${NUMERALS}`}>{selected.courseCode}</strong><small className="text-muted-foreground mt-0.5 block text-xs">{selected.location || roomOf(selected) || selected.courseName}</small></span></div>}
            <div className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-2.5"><CalendarDaysIcon className="text-muted-foreground size-4" /><span><strong className="block text-sm">{selected.feedLabel || (selected.editable ? 'Wicker calendar' : 'Academic plan')}</strong><small className="text-muted-foreground mt-0.5 block text-xs">{selected.editable ? 'You can edit this event' : 'Read-only source'}</small></span></div>
          </div>
          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">{selected.notes || 'No additional details were supplied by this source.'}</p>
        </section>
        {selected.attendanceEligible && <AttendanceButtons event={selected} saving={attendanceSaving} onMark={onMark} />}
        {attendanceError && <p role="alert" className="text-destructive border-b px-5 py-3 text-xs">{attendanceError}</p>}
        <section className="flex flex-wrap gap-2 border-b px-5 py-5">
          {selected.href && <Link href={selected.href} className={buttonVariants({ size: 'sm' })}>Open in Wicker</Link>}
          {selected.externalHref && <a href={selected.externalHref} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Open in Canvas <ExternalLinkIcon data-icon="inline-end" /></a>}
          {selected.editable && <Button size="sm" variant="outline" onClick={() => onEdit(selected)}><PencilIcon data-icon="inline-start" />Edit event</Button>}
          {!selected.editable && INSTITUTION.has(selected.category) && <Button size="sm" variant="outline" onClick={() => onCopy(selected)}><CalendarDaysIcon data-icon="inline-start" />Copy to Wicker calendar</Button>}
          {selected.attendanceEligible && selected.editorialCourseId && <Link href={`/app/courses/${selected.editorialCourseId}#attendance`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Course attendance</Link>}
        </section>
      </> : <>
        <dl className="grid grid-cols-3 border-b">{[['Items', dayEvents.length], ['Deadlines', deadlines.length], ['Unmarked', attendanceDue.length]].map(([label, value]) => <div key={label} className="border-r px-3 py-4 last:border-r-0"><dd className={`text-xl font-semibold ${NUMERALS}`}>{value}</dd><dt className="text-muted-foreground mt-1 text-[10px]">{label}</dt></div>)}</dl>
        {(deadlines.length > 0 || attendanceDue.length > 0) && <section className="bg-accent/45 border-b px-5 py-4"><div className="flex items-start gap-2.5"><CircleAlertIcon className="text-primary mt-0.5 size-4 shrink-0" /><div><h3 className="text-sm font-semibold">{deadlines.length ? `${deadlines.length} ${deadlines.length === 1 ? 'deadline' : 'deadlines'} on this day` : `${attendanceDue.length} attendance ${attendanceDue.length === 1 ? 'mark' : 'marks'} needed`}</h3><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Open an item to inspect its source and take action.</p></div></div></section>}
        <section><div className="flex items-center justify-between border-b px-5 py-3"><h3 className="text-sm font-semibold">Schedule</h3><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{dayEvents.length}</span></div>{dayEvents.length ? dayEvents.map((event) => <button key={event.id} type="button" onClick={() => onSelect(event)} className="grid w-full grid-cols-[3.25rem_3px_minmax(0,1fr)_auto] items-center gap-3 border-b px-5 py-3 text-left hover:bg-muted/55"><span className={`text-xs font-semibold ${NUMERALS}`}>{eventTime(event).split('–')[0]}</span><i className={cn('h-9 rounded-full bg-muted-foreground', ['deadline', 'canvas-deadline', 'exam'].includes(event.category) ? 'bg-destructive' : event.attendanceRequired ? 'bg-primary' : '')} /><span className="min-w-0"><strong className="block truncate text-xs">{event.courseName || event.title}</strong><small className="text-muted-foreground mt-0.5 block truncate text-[10px]">{[event.courseCode, event.activity, event.attendanceEligible ? attendanceLabel(event.attendanceStatus) : null].filter(Boolean).join(' · ')}</small></span><ChevronRightIcon className="text-muted-foreground size-3.5" /></button>) : <p className="text-muted-foreground px-5 py-6 text-sm">Nothing is scheduled on this day.</p>}</section>
      </>}
    </aside>
  )
}

function RailDivider({ side, open, onOpen, onResize, onNudge }: { side: 'left' | 'right'; open: boolean; onOpen: () => void; onResize: (event: ReactPointerEvent<HTMLDivElement>) => void; onNudge: (delta: number) => void }) {
  const OpenIcon = side === 'left' ? PanelLeftOpenIcon : PanelRightOpenIcon
  const railName = side === 'left' ? 'calendar list' : 'day desk'
  return <div role={open ? 'separator' : undefined} aria-orientation="vertical" aria-label={open ? `Resize ${railName}` : undefined} title={open ? `Drag to resize ${railName}` : undefined} tabIndex={open ? 0 : -1} onPointerDown={open ? onResize : undefined} onKeyDown={open ? (event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); onNudge(event.key === 'ArrowLeft' ? -16 : 16) } } : undefined} className={cn('group relative z-20 hidden h-full touch-none select-none bg-border before:absolute before:inset-y-0 before:-left-3 before:-right-3 focus-visible:outline-2 focus-visible:outline-primary xl:flex', side === 'right' && 'lg:flex', open ? 'cursor-col-resize' : 'cursor-default')}>{open ? <GripVerticalIcon className="text-muted-foreground bg-background pointer-events-none absolute top-1/2 left-1/2 size-4 -translate-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" /> : <button type="button" onClick={onOpen} className="bg-background text-muted-foreground hover:text-foreground absolute top-4 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-md border" aria-label={`Open ${side === 'left' ? 'calendars' : 'day desk'}`}><OpenIcon className="size-4" /></button>}</div>
}

function AddCalendarDialog({ open, saving, error, onOpenChange, onSave }: { open: boolean; saving: boolean; error: string | null; onOpenChange: (open: boolean) => void; onSave: (input: { url: string; label: string }) => void }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  useEffect(() => { if (open) { setUrl(''); setLabel('') } }, [open])
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Connect a calendar</DialogTitle><DialogDescription>Subscribe to a timetable or calendar feed. Wicker refreshes it as a read-only source beside your own calendar.</DialogDescription></DialogHeader><form id="calendar-connection" className="grid gap-4" onSubmit={(event) => { event.preventDefault(); onSave({ url, label }) }}><div className="grid gap-1.5"><Label htmlFor="calendar-url">Calendar URL</Label><Input id="calendar-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://university.example/timetable.ics" inputMode="url" autoFocus required /></div><div className="grid gap-1.5"><Label htmlFor="calendar-label">Name</Label><Input id="calendar-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="University timetable" /></div>{error && <p className="text-destructive text-xs" role="alert">{error}</p>}</form><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button form="calendar-connection" type="submit" disabled={saving}>{saving ? 'Connecting…' : 'Connect calendar'}</Button></DialogFooter></DialogContent></Dialog>
}

function EventComposer({ seed, courses, saving, error, onOpenChange, onSave, onDelete }: { seed: ComposerSeed | null; courses: Course[]; saving: boolean; error: string | null; onOpenChange: (open: boolean) => void; onSave: (input: Record<string, unknown>) => void; onDelete: (event: CalendarEvent) => void }) {
  const [title, setTitle] = useState(''); const [date, setDate] = useState(''); const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(false); const [startTime, setStartTime] = useState('09:00'); const [endTime, setEndTime] = useState('10:00')
  const [type, setType] = useState('study'); const [courseId, setCourseId] = useState(''); const [location, setLocation] = useState(''); const [notes, setNotes] = useState('')
  useEffect(() => { if (!seed) return; const event = seed.event; setTitle(event?.title || ''); setDate(event?.start.slice(0, 10) || seed.date); setEndDate(event?.allDay && event.end ? previousDay(event.end.slice(0, 10)) : event?.end?.slice(0, 10) || ''); setAllDay(event?.allDay ?? false); setStartTime(localTime(event?.start) || '09:00'); setEndTime(localTime(event?.end) || '10:00'); setType(event?.category === 'deadline' ? 'deadline' : event?.category === 'appointment' ? 'appointment' : event?.category === 'study' ? 'study' : 'other'); setCourseId(event?.courseId || event?.editorialCourseId || ''); setLocation(event?.location || roomOf(event || { notes: null }) || ''); setNotes(event?.notes || '') }, [seed])
  const edit = seed?.mode === 'edit'
  return <Dialog open={Boolean(seed)} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{edit ? 'Edit calendar event' : seed?.mode === 'copy' ? 'Copy to Wicker calendar' : 'Create an event'}</DialogTitle><DialogDescription>{seed?.mode === 'copy' ? 'This makes an editable copy. The original institutional date stays unchanged.' : 'Events created here belong to your Wicker calendar and can be changed or removed later.'}</DialogDescription></DialogHeader><form id="event-composer" className="grid gap-4" onSubmit={(event) => { event.preventDefault(); const course = courses.find((item) => item.id === courseId); const start = allDay ? date : new Date(`${date}T${startTime}`).toISOString(); const end = allDay ? endDate || null : endTime ? new Date(`${date}T${endTime}`).toISOString() : null; onSave({ title, start, end, allDay, type, calendarId: 'wicker', courseId: course?.id || null, courseCode: course?.code || seed?.event?.courseCode || null, courseName: course?.name || seed?.event?.courseName || null, location, notes, sourceEventId: seed?.mode === 'copy' ? seed.event?.id : undefined }) }}>
    <div className="grid gap-1.5"><Label htmlFor="event-title">Title</Label><Input id="event-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Study statistics chapter 4" autoFocus required /></div>
    <div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5"><Label htmlFor="event-calendar">Calendar</Label><Input id="event-calendar" value="Wicker calendar" readOnly className="bg-muted/45" /></div><div className="grid gap-1.5"><Label htmlFor="event-type">Type</Label><select id="event-type" value={type} onChange={(event) => setType(event.target.value)} className="border-input bg-background h-10 rounded-sm border px-3 text-sm"><option value="study">Study session</option><option value="deadline">Deadline</option><option value="appointment">Appointment</option><option value="other">Other</option></select></div></div>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div className="grid gap-1.5"><Label htmlFor="event-date">Date</Label><Input id="event-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div><label className="flex h-10 items-center gap-2 rounded-sm border px-3 text-sm font-medium"><Checkbox checked={allDay} onCheckedChange={(checked) => setAllDay(checked === true)} />All day</label></div>
    {allDay ? <div className="grid gap-1.5"><Label htmlFor="event-end-date">End date <span className="text-muted-foreground font-normal">optional</span></Label><Input id="event-end-date" type="date" value={endDate} min={date} onChange={(event) => setEndDate(event.target.value)} /></div> : <div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5"><Label htmlFor="event-start">Starts</Label><Input id="event-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></div><div className="grid gap-1.5"><Label htmlFor="event-end">Ends</Label><Input id="event-end" type="time" value={endTime} min={startTime} onChange={(event) => setEndTime(event.target.value)} /></div></div>}
    <div className="grid gap-1.5"><Label htmlFor="event-course">Course <span className="text-muted-foreground font-normal">optional</span></Label><select id="event-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} className="border-input bg-background h-10 rounded-sm border px-3 text-sm"><option value="">No course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></div>
    <div className="grid gap-1.5"><Label htmlFor="event-location">Location <span className="text-muted-foreground font-normal">optional</span></Label><Input id="event-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Library, room B1.12, or online" /></div>
    <div className="grid gap-1.5"><Label htmlFor="event-notes">Notes <span className="text-muted-foreground font-normal">optional</span></Label><Textarea id="event-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What needs to happen during this block?" /></div>{error && <p className="text-destructive text-xs" role="alert">{error}</p>}
  </form><DialogFooter className="sm:justify-between"><div>{edit && seed?.event && <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(seed.event!)} disabled={saving}><Trash2Icon data-icon="inline-start" />Delete</Button>}</div><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button form="event-composer" type="submit" disabled={saving}>{saving ? 'Saving…' : edit ? 'Save changes' : 'Create event'}</Button></div></DialogFooter></DialogContent></Dialog>
}

export default function CalendarPage() {
  const apiRef = useRef<GridApi | null>(null)
  const today = localIsoDate()
  const [payload, setPayload] = useState<CalendarData | null>(null); const [academicRevision, setAcademicRevision] = useState<number | null>(null); const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState<string | null>(null); const [view, setView] = useState<string>(() => calendarView(typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('view')))
  const [date, setDate] = useState<Date>(new Date()); const [title, setTitle] = useState(''); const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<CalendarEvent | null>(null); const [selectedDate, setSelectedDate] = useState(today); const [ready, setReady] = useState(false)
  const [attendanceSaving, setAttendanceSaving] = useState(false); const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [leftOpen, setLeftOpen] = useState(true); const [rightOpen, setRightOpen] = useState(true); const [leftWidth, setLeftWidth] = useState(216); const [rightWidth, setRightWidth] = useState(310)
  const [connectOpen, setConnectOpen] = useState(false); const [connectSaving, setConnectSaving] = useState(false); const [connectError, setConnectError] = useState<string | null>(null); const [sourceSaving, setSourceSaving] = useState<string | null>(null)
  const [composer, setComposer] = useState<ComposerSeed | null>(null); const [composerSaving, setComposerSaving] = useState(false); const [composerError, setComposerError] = useState<string | null>(null)
  const [pendingFeedRemoval, setPendingFeedRemoval] = useState<SourceRow | null>(null); const [pendingEventDelete, setPendingEventDelete] = useState<CalendarEvent | null>(null)

  const loadCalendar = useCallback(async (preferredEventId?: string | null) => { const response = await fetch('/api/calendar/events', { headers: { accept: 'application/json' } }); if (!response.ok) throw new Error(`Your calendar returned ${response.status}`); const data = await response.json(); setPayload(data); if (preferredEventId) setSelected(data.events.find((event: CalendarEvent) => event.id === preferredEventId) || null); return data }, [])
  const loadAcademics = useCallback(async () => { const response = await fetch('/api/academics', { headers: { accept: 'application/json' } }); if (!response.ok) return null; const data = await response.json() as AcademicsData; setAcademicRevision(data.workspace?.revision ?? null); setCourses(data.workspace?.courses ?? []); return data }, [])
  useEffect(() => { let live = true; Promise.all([loadCalendar(), loadAcademics()]).catch((cause: Error) => { if (live) setError(cause.message) }); return () => { live = false } }, [loadAcademics, loadCalendar])
  useEffect(() => { const number = (key: string, fallback: number) => Math.round(Number(localStorage.getItem(key))) || fallback; setLeftWidth(Math.min(LEFT_MAX, Math.max(LEFT_MIN, number('wicker-calendar-left-width', 248)))); setRightWidth(Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, number('wicker-calendar-right-width', 310)))); setLeftOpen(localStorage.getItem('wicker-calendar-left-open') !== 'false'); setRightOpen(localStorage.getItem('wicker-calendar-right-open') !== 'false') }, [])
  useEffect(() => { localStorage.setItem('wicker-calendar-left-width', String(leftWidth)) }, [leftWidth]); useEffect(() => { localStorage.setItem('wicker-calendar-right-width', String(rightWidth)) }, [rightWidth]); useEffect(() => { localStorage.setItem('wicker-calendar-left-open', String(leftOpen)) }, [leftOpen]); useEffect(() => { localStorage.setItem('wicker-calendar-right-open', String(rightOpen)) }, [rightOpen])

  const events = useMemo(() => (payload?.events ?? []).filter((event) => !hiddenSources.has(sourceId(event))), [payload, hiddenSources])
  const dayEvents = useMemo(() => events.filter((event) => event.start.slice(0, 10) === selectedDate).sort((left, right) => left.start.localeCompare(right.start)), [events, selectedDate])
  const sourceRows = useMemo<SourceRow[]>(() => { if (!payload) return []; const problems = new Map((payload.problems ?? []).map((problem) => [problem.id, problem.error])); const rows: SourceRow[] = [{ id: 'personal:wicker', label: 'Wicker calendar', group: 'mine', tone: 'wicker' }, { id: 'plan', label: 'Academic plan', group: 'mine', tone: 'plan' }, { id: 'institution', label: 'University calendar', group: 'connected', tone: 'institution' }]; for (const feed of payload.feeds ?? []) rows.push({ id: `feed:${feed.id}`, feedId: feed.id, label: feed.label, group: 'connected', tone: 'feed', problem: problems.get(feed.id) }); if (payload.canvas?.connected) rows.push({ id: 'canvas', label: 'Canvas', group: 'connected', tone: 'canvas', problem: [...problems.entries()].find(([id]) => id.startsWith('canvas:'))?.[1] }); return rows }, [payload])
  const toggleSource = (id: string) => setHiddenSources((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const resize = (side: 'left' | 'right') => (event: ReactPointerEvent<HTMLDivElement>) => { event.preventDefault(); const start = event.clientX; const initial = side === 'left' ? leftWidth : rightWidth; const move = (moveEvent: PointerEvent) => { const delta = moveEvent.clientX - start; const value = side === 'left' ? initial + delta : initial - delta; if (side === 'left') setLeftWidth(Math.min(LEFT_MAX, Math.max(LEFT_MIN, value))); else setRightWidth(Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, value))) }; const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); document.body.style.cursor = ''; document.body.style.userSelect = '' }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true }) }
  const moveCalendar = useCallback((action: 'prev' | 'next' | 'today') => { const api = apiRef.current; if (!api) return; api[action](); setDate(api.getDate()); setTitle(api.view.title); if (action === 'today') setSelectedDate(today) }, [today])
  const goTo = (next: Date | undefined) => { if (!next) return; setDate(next); setSelected(null); setSelectedDate(localIsoDate(next)); apiRef.current?.gotoDate(next); if (apiRef.current) setTitle(apiRef.current.view.title) }
  function changeView(next: string) { setView(next); const url = new URL(window.location.href); url.searchParams.set('view', next); window.history.replaceState(null, '', url); const api = apiRef.current; api?.changeView(next); if (next === 'timeGridDay') { api?.today(); setDate(new Date()); setSelectedDate(today); setSelected(null) } if (api) setTitle(api.view.title) }
  async function markAttendance(status: AttendanceStatus) { if (!selected || academicRevision === null || attendanceSaving) return; setAttendanceSaving(true); setAttendanceError(null); try { const response = await fetch('/api/attendance', { method: 'PUT', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ event: selected, status, expectedRevision: academicRevision }) }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || `Attendance returned ${response.status}`); setAcademicRevision(body.workspace.revision); await loadCalendar(selected.id) } catch (cause) { setAttendanceError((cause as Error).message) } finally { setAttendanceSaving(false) } }
  async function connectCalendar(input: { url: string; label: string }) { setConnectSaving(true); setConnectError(null); try { const response = await fetch('/api/academics/calendars', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(input) }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || `Calendar connection returned ${response.status}`); setAcademicRevision(body.workspace.revision); setConnectOpen(false); await loadCalendar() } catch (cause) { setConnectError((cause as Error).message) } finally { setConnectSaving(false) } }
  async function manageFeed(id: string, action: 'sync' | 'remove') { setSourceSaving(id); try { const response = await fetch(`/api/academics/calendars/${encodeURIComponent(id)}${action === 'sync' ? '/sync' : ''}`, { method: action === 'sync' ? 'POST' : 'DELETE', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: action === 'sync' ? JSON.stringify({ date: selectedDate }) : undefined }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || `Calendar ${action} returned ${response.status}`); setAcademicRevision(body.workspace.revision); await loadCalendar() } catch (cause) { setError((cause as Error).message) } finally { setSourceSaving(null) } }
  async function saveEvent(input: Record<string, unknown>) { if (!composer) return; setComposerSaving(true); setComposerError(null); const managedId = composer.mode === 'edit' ? composer.event?.managedEventId : null; try { const response = await fetch(managedId ? `/api/calendar/events/${encodeURIComponent(managedId)}` : '/api/calendar/events', { method: managedId ? 'PUT' : 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ event: input, expectedRevision: academicRevision }) }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || `Calendar event returned ${response.status}`); setAcademicRevision(body.workspace.revision); setComposer(null); await loadCalendar(`personal:${body.event.id}`) } catch (cause) { setComposerError((cause as Error).message) } finally { setComposerSaving(false) } }
  async function deleteEvent(event: CalendarEvent) { if (!event.managedEventId) return; setComposerSaving(true); setComposerError(null); try { const response = await fetch(`/api/calendar/events/${encodeURIComponent(event.managedEventId)}`, { method: 'DELETE', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: academicRevision }) }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || `Calendar event returned ${response.status}`); setAcademicRevision(body.workspace.revision); setComposer(null); setSelected(null); await loadCalendar() } catch (cause) { setComposerError((cause as Error).message) } finally { setComposerSaving(false) } }
  function dismissChange(id: string) { setPayload((held) => held ? { ...held, changes: (held.changes ?? []).filter((change) => change.id !== id) } : held); void fetch(`/api/calendar/changes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { accept: 'application/json' } }) }

  if (error) return <div className="mx-auto w-full max-w-[1400px] p-5 sm:p-8"><Empty><EmptyHeader><EmptyTitle>Your calendar could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty></div>
  const summary = payload?.attendance?.summary
  const splitStyle = { '--left-width': leftOpen ? `${leftWidth}px` : '0px', '--right-width': rightOpen ? `${rightWidth}px` : '0px' } as CSSProperties
  const sourceList = (prefix: string) => payload ? <div className="pb-3">{(['mine', 'connected'] as const).map((group, index) => <section key={group} aria-labelledby={`${prefix}-${group}-heading`} className={cn(index > 0 && 'mt-3')}><div className="flex h-8 items-center justify-between px-4"><h3 id={`${prefix}-${group}-heading`} className={LABEL}>{group === 'mine' ? 'My calendars' : 'Connected calendars'}</h3>{group === 'connected' && <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConnectOpen(true)} aria-label="Connect a calendar"><PlusIcon /></Button>}</div><ul className="px-2">{sourceRows.filter((source) => source.group === group).map((source) => { const visible = !hiddenSources.has(source.id); return <li key={source.id} className="group flex h-9 min-w-0 items-center gap-2.5 rounded-md px-2 hover:bg-muted/55"><SourceVisibilityToggle source={source} visible={visible} onToggle={() => toggleSource(source.id)} /><button type="button" onClick={() => toggleSource(source.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-medium"><span className="truncate">{source.label}</span>{source.id === 'canvas' && <CanvasMark className="size-3.5 shrink-0 text-[#E72429]" />}{source.problem && <CircleAlertIcon className="text-destructive size-3.5 shrink-0" aria-label={`${source.label} could not refresh`} />}</button>{source.feedId && <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100" aria-label={`Manage ${source.label}`} disabled={sourceSaving === source.feedId} />}><MoreHorizontalIcon /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => void manageFeed(source.feedId!, 'sync')}><RefreshCwIcon />Refresh now</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={() => setPendingFeedRemoval(source)}><Trash2Icon />Remove calendar</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</li>})}</ul>{group === 'connected' && <button type="button" onClick={() => setConnectOpen(true)} className="text-muted-foreground hover:text-foreground mx-4 mt-1 inline-flex h-8 items-center gap-2 text-xs font-medium"><PlusIcon className="size-3.5" />Add calendar</button>}</section>)}</div> : <Skeleton className="mx-4 my-4 h-36" />

  return <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col md:h-dvh">
    <header data-tour="calendar-controls" className="bg-background flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"><div className="flex items-center gap-2 sm:gap-3"><Button onClick={() => { setComposerError(null); setComposer({ mode: 'create', date: selectedDate }) }}><PlusIcon data-icon="inline-start" />Create</Button><Button variant="outline" onClick={() => moveCalendar('today')} disabled={!ready}>Today</Button><div className="flex"><Button variant="ghost" size="icon" onClick={() => moveCalendar('prev')} disabled={!ready} aria-label="Previous"><ChevronLeftIcon /></Button><Button variant="ghost" size="icon" onClick={() => moveCalendar('next')} disabled={!ready} aria-label="Next"><ChevronRightIcon /></Button></div><h1 className={`font-heading ml-1 text-xl font-semibold tracking-[-0.025em] ${NUMERALS}`}>{title || 'Calendar'}</h1></div><div className="bg-card flex overflow-x-auto rounded-lg border p-1" role="tablist" aria-label="Calendar view">{VIEWS.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={view === entry.id} disabled={!ready} onClick={() => changeView(entry.id)} className={cn('h-8 min-w-16 rounded-md px-3 text-xs font-semibold disabled:opacity-50', view === entry.id ? 'bg-foreground text-card' : 'text-muted-foreground hover:text-foreground')}>{entry.label}</button>)}</div></header>
    <TimetableChanges changes={payload?.changes ?? []} onDismiss={dismissChange} />
    <details className="bg-card shrink-0 border-b lg:hidden"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Calendars</summary>{sourceList('mobile')}</details>
    {selected && <div className="bg-card fixed inset-x-0 bottom-16 z-30 max-h-[70dvh] overflow-y-auto border-t shadow-[var(--shadow-sheet)] lg:hidden"><DayDesk selected={selected} selectedDate={selectedDate} dayEvents={dayEvents} attendanceSaving={attendanceSaving} attendanceError={attendanceError} onSelect={setSelected} onMark={(status) => void markAttendance(status)} onEdit={(event) => setComposer({ mode: 'edit', date: event.start.slice(0, 10), event })} onCopy={(event) => setComposer({ mode: 'copy', date: event.start.slice(0, 10), event })} onClear={() => { setSelected(null); setAttendanceError(null) }} /></div>}
    <div style={splitStyle} className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_1px_var(--right-width)] xl:grid-cols-[var(--left-width)_1px_minmax(0,1fr)_1px_var(--right-width)]">
      <aside className={cn('bg-card hidden min-h-0 overflow-x-hidden overflow-y-auto xl:block', !leftOpen && 'invisible')} aria-label="Calendars"><header className="flex h-[57px] items-center justify-between border-b px-4"><h2 className="text-sm font-semibold">Calendars</h2><Button type="button" variant="ghost" size="icon-sm" onClick={() => setLeftOpen(false)} aria-label="Collapse calendars"><PanelLeftCloseIcon /></Button></header><div className="border-b"><DatePicker mode="single" selected={date} onSelect={goTo} weekStartsOn={1} className="mx-auto w-full max-w-[320px] bg-card p-4" /></div>{sourceList('desktop')}<section className="border-t px-5 py-5"><p className={LABEL}>Attendance</p><div className="mt-2 flex items-end justify-between gap-3"><div><strong className="block text-sm">{summary?.atRiskCourses ? 'Needs attention' : 'On track'}</strong><span className="text-muted-foreground mt-1 block text-[11px]">{summary ? `${summary.missed} missed · ${summary.unmarked} unmarked` : 'Checking your record'}</span></div><strong className={`text-2xl ${NUMERALS}`}>{summary?.rate == null ? '—' : `${summary.rate}%`}</strong></div><Link href="/app/courses" className="text-primary mt-3 inline-flex text-xs font-semibold">View by course</Link></section></aside>
      <RailDivider side="left" open={leftOpen} onOpen={() => setLeftOpen(true)} onResize={resize('left')} onNudge={(delta) => setLeftWidth((width) => Math.min(LEFT_MAX, Math.max(LEFT_MIN, width + delta)))} />
      <main className="bg-card min-h-0 min-w-0 overflow-hidden" data-fc><CalendarGrid apiRef={apiRef} view={view} events={events} onSelectEvent={(event) => { setAttendanceError(null); setSelected(event); setSelectedDate(event.start.slice(0, 10)) }} onSelectDate={(day) => { setSelected(null); setSelectedDate(day) }} onTitle={setTitle} onReady={() => setReady(true)} /></main>
      <RailDivider side="right" open={rightOpen} onOpen={() => setRightOpen(true)} onResize={resize('right')} onNudge={(delta) => setRightWidth((width) => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, width - delta)))} />
      <div className={cn('hidden min-h-0 overflow-hidden lg:block', !rightOpen && 'invisible')}><DayDesk selected={selected} selectedDate={selectedDate} dayEvents={dayEvents} attendanceSaving={attendanceSaving} attendanceError={attendanceError} onSelect={(event) => { setSelected(event); setAttendanceError(null) }} onMark={(status) => void markAttendance(status)} onEdit={(event) => { setComposerError(null); setComposer({ mode: 'edit', date: event.start.slice(0, 10), event }) }} onCopy={(event) => { setComposerError(null); setComposer({ mode: 'copy', date: event.start.slice(0, 10), event }) }} onClear={() => { setSelected(null); setAttendanceError(null) }} onCollapse={() => setRightOpen(false)} /></div>
    </div>
    <AddCalendarDialog open={connectOpen} saving={connectSaving} error={connectError} onOpenChange={(open) => { setConnectOpen(open); if (!open) setConnectError(null) }} onSave={(input) => void connectCalendar(input)} />
    <EventComposer seed={composer} courses={courses} saving={composerSaving} error={composerError} onOpenChange={(open) => { if (!open) { setComposer(null); setComposerError(null) } }} onSave={(input) => void saveEvent(input)} onDelete={setPendingEventDelete} />
    <ConfirmDialog
      open={pendingFeedRemoval !== null}
      onOpenChange={(open) => { if (!open) setPendingFeedRemoval(null) }}
      title={`Remove ${pendingFeedRemoval?.label || 'this calendar'}?`}
      description="Its events will disappear from Wicker. You can reconnect the calendar later without changing the source itself."
      confirmLabel="Remove calendar"
      destructive
      busy={pendingFeedRemoval?.feedId === sourceSaving}
      onConfirm={async () => {
        const feedId = pendingFeedRemoval?.feedId
        if (!feedId) return
        await manageFeed(feedId, 'remove')
        setPendingFeedRemoval(null)
      }}
    />
    <ConfirmDialog
      open={pendingEventDelete !== null}
      onOpenChange={(open) => { if (!open) setPendingEventDelete(null) }}
      title={`Delete ${pendingEventDelete?.title || 'this event'}?`}
      description="This permanently removes the event from your Wicker calendar. Connected source calendars are not changed."
      confirmLabel="Delete event"
      destructive
      busy={composerSaving}
      onConfirm={async () => {
        const event = pendingEventDelete
        if (!event) return
        await deleteEvent(event)
        setPendingEventDelete(null)
      }}
    />
  </div>
}
