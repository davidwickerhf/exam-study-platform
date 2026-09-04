export type PersonalCalendarEvent = {
  id: string
  calendarId: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  type: 'study' | 'deadline' | 'appointment' | 'other'
  courseId: string | null
  courseCode: string | null
  courseName: string | null
  location: string
  notes: string
  sourceEventId: string | null
  createdAt: string
  updatedAt: string
}

export declare function normalizePersonalCalendarEvent(value: unknown, index?: number): PersonalCalendarEvent | null
export declare function createPersonalCalendarEvent(input: Partial<PersonalCalendarEvent>, now?: Date | string): PersonalCalendarEvent
export declare function savePersonalCalendarEvent(events: unknown[], input: Partial<PersonalCalendarEvent>, now?: Date | string): PersonalCalendarEvent[]
export declare function removePersonalCalendarEvent(events: unknown[], id: string): PersonalCalendarEvent[]

