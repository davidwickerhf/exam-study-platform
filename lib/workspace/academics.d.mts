/** Types for lib/app/academics.mjs. */

export type Attempt = { id?: string; grade?: number | null; examDate?: string | null; registered?: boolean; academicYear?: string; type?: string; status?: string }

export type Course = {
  id: string
  code: string
  name: string
  ects: number
  yearLevel: string | null
  period: string | null
  passMark?: number
  programmeRequirement: string
  attempts: Attempt[]
  notes?: string
}
export type Gate = { id: string; label: string; section: string; type: string; courseId: string | null; level: string | null; target: number }
export type AcademicEvent = { id: string; title: string; date: string | null; endDate?: string | null; type: string; notes?: string }

export type Workspace = {
  id: string
  /** Bumped on every save; a write that does not carry the revision it read is rejected. */
  revision: number
  profile: { university: string; programme: string; academicYear: string }
  programmeTemplate: { programmeId: string; versionId: string; currentStudyYear: string } | null
  courses: Course[]
  calendars: {
    id: string
    label: string
    url: string
    lastSyncedAt: string | null
    eventCount: number
    rangeStart: string | null
    rangeEnd: string | null
    matchedCourseCount: number
    unselectedCourseCount: number
  }[]
  gates?: Gate[]
  events?: AcademicEvent[]
}

export type CourseStatus = 'passed' | 'failed' | 'registered' | 'not-recorded'

export declare function bestAttempt(course: Course): Attempt | null
export declare function courseStatus(course: Course): CourseStatus
export declare const STATUS_LABEL: Record<CourseStatus, string>
export declare function earnedEcts(courses: Course[]): number
export declare function plannedEcts(courses: Course[]): number
export declare function weightedGpa(courses: Course[]): number | null
export declare function byYear(courses: Course[]): { level: string; ects: number; courses: Course[] }[]
export declare function courseRecord(input: Record<string, unknown>, id?: string): Course
export declare function attemptRecord(input: Record<string, unknown>, id?: string): Attempt
export declare function gateRecord(input: Record<string, unknown>, id?: string): Gate
export declare function eventRecord(input: Record<string, unknown>, id?: string): AcademicEvent
export declare function planningTab(value: unknown): string
