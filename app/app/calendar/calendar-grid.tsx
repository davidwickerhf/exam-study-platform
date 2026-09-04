'use client'

/**
 * The scheduling grid, on its own.
 *
 * FullCalendar and its four plugins are the heaviest thing the signed-in
 * bundle imports, and the page used to pull all five in eagerly — before the
 * feed had answered, and on every route that shared the chunk. They live here
 * so `next/dynamic` can fetch them when the calendar is actually opened, and
 * the page keeps its header, its rail and its toolbar without them.
 *
 * The page drives the grid rather than the other way round: it hands down a
 * ref it owns, the grid fills it with FullCalendar's imperative API once
 * mounted, and empties it on unmount so a toolbar button can never call into
 * a calendar that has gone away.
 */

import { useEffect, useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core'
import type { CalendarEvent } from '@/lib/workspace/home.mjs'

/** The slice of FullCalendar's API the page's toolbar needs. */
export type GridApi = {
  prev(): void
  next(): void
  today(): void
  changeView(view: string): void
  gotoDate(date: Date | string): void
  getDate(): Date
  view: { title: string }
}

export type GridProps = {
  apiRef: { current: GridApi | null }
  view: string
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  onSelectDate: (date: string) => void
  onTitle: (title: string) => void
  onReady: () => void
}

export default function CalendarGrid({
  apiRef,
  view,
  events,
  onSelectEvent,
  onSelectDate,
  onTitle,
  onReady
}: GridProps) {
  const calendarRef = useRef<FullCalendar | null>(null)

  // FullCalendar wants its own event shape; the product's shape rides along in
  // extendedProps so a click hands the page back exactly what it gave.
  const sources = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title:
          event.courseCode && event.category === 'timetable'
            ? `${event.courseCode} · ${event.courseName ?? event.title}`
            : event.title,
        start: event.start,
        end: event.end ?? undefined,
        allDay: event.allDay,
        extendedProps: event
      })),
    [events]
  )

  useEffect(() => () => { apiRef.current = null }, [apiRef])

  return (
    <FullCalendar
      ref={(instance: FullCalendar | null) => {
        calendarRef.current = instance
        apiRef.current = (instance?.getApi() as GridApi | undefined) ?? null
        if (instance) onReady()
      }}
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      initialView={view}
      headerToolbar={false}
      events={sources}
      height="100%"
      firstDay={1}
      nowIndicator
      expandRows
      stickyHeaderDates
      allDaySlot
      selectable
      slotDuration="01:00:00"
      slotMinTime="07:00:00"
      slotMaxTime="22:00:00"
      scrollTime="08:00:00"
      slotLabelFormat={{ hour: 'numeric', minute: '2-digit', hour12: false }}
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
      dayMaxEvents
      slotEventOverlap={false}
      eventClassNames={(info) => {
        const event = info.event.extendedProps as CalendarEvent
        return [
          event.attendanceEligible ? 'fc-attendance-eligible' : '',
          event.attendanceRequired ? 'fc-attendance-required' : '',
          event.attendanceStatus && event.attendanceStatus !== 'unknown' ? `fc-attendance-${event.attendanceStatus}` : ''
        ].filter(Boolean)
      }}
      eventClick={(info: EventClickArg) => {
        info.jsEvent.preventDefault()
        onSelectEvent(info.event.extendedProps as CalendarEvent)
      }}
      // Choosing a day opens the same detail panel an event does, so a date
      // with nothing on it still answers rather than doing nothing at all.
      select={(info: DateSelectArg) => onSelectDate(info.startStr.slice(0, 10))}
      datesSet={(info) => onTitle(info.view.title)}
    />
  )
}
