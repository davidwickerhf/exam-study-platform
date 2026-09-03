/**
 * Types for lib/app/home.mjs.
 *
 * The implementation is plain ESM so that node:test can import it directly —
 * this project's TypeScript is the native 7.x build, which has no
 * transpileModule API, and a second hand-maintained copy of the rules is how
 * they drift apart.
 */

export type CalendarEvent = {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  category: string
  courseCode: string | null
  courseName: string | null
  notes: string | null
  activity?: string | null
  courseId?: string | null
  externalHref: string | null
  href: string | null
  canvasStatus?: string | null
  canvasDone?: boolean
}

export type AcademicContext = {
  period: string
  academicYear: string
  phase: string
  start: string
  end: string
  periodNumber: number | null
}

export type ExamWindow = { title: string; start: string; end: string } | null

export type CalendarPayload = {
  events: CalendarEvent[]
  academicContext: AcademicContext | null
  examWindow: ExamWindow
}

export type HomePriority = {
  id: string
  kind: 'attendance' | 'assignment' | 'exam' | 'project'
  title: string
  detail: string
  courseCode: string | null
  dueAt: string | null
  dueText?: string | null
  href: string
  status: string
  source: 'Academic plan' | 'Canvas' | 'Timetable' | 'Verified course rule'
  rank: number
}

export type AcademicSummary = {
  earnedEcts: number
  gpa: number | null
  passedCourses: number
  totalCourses: number
}

export type DayEntry = { event: CalendarEvent; kind: 'teaching' | 'due'; startsAt: number; endsAt: number | null }

export declare function localIsoDate(at?: Date): string
export declare function daysUntil(iso: string | null): number | null
export declare function periodWeek(start?: string | null, end?: string | null, today?: string | null): { week: number | null; weeks: number | null }
export declare function roomOf(event: { notes: string | null }): string | null
export declare function deadlineTitle(event: { title: string; courseCode: string | null }): string
export declare function dayEntries(events: CalendarEvent[], today?: string): DayEntry[]
export declare function leadEntry(entries: DayEntry[], now?: number): DayEntry | null
export declare function upcomingDeadlines(events: CalendarEvent[], limit?: number, today?: string): CalendarEvent[]
export declare function homePriorities(input?: {
  events?: CalendarEvent[]
  assignments?: Array<{ id: string; title: string; courseCode?: string | null; courseName?: string | null; dueAt?: string | null; status: string; url?: string | null }>
  courses?: Array<{ id: string; code?: string; courseProfile?: { assessment?: { status?: string; attendanceRules?: string[]; components?: Array<{ name: string; type?: string; weightPercent?: number | null; deadline?: string | null; deadlineText?: string; notes?: string }> } | null } | null }>
  now?: number
  limit?: number
}): HomePriority[]
export declare function clockOf(value: string): string | null
export declare function awayLabel(minutes: number | null): string
