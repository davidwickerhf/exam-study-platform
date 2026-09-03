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

/** One record's worth of change, named rather than rebuilt at the call site. */
export type WorkspaceEdit =
  | { type: 'profile'; values: Partial<Workspace['profile']> & Record<string, unknown> }
  | { type: 'course:add'; input: Record<string, unknown>; id?: string }
  | { type: 'course:update'; id: string; input: Record<string, unknown> }
  | { type: 'course:remove'; id: string }
  | { type: 'attempt:add'; courseId: string; input: Record<string, unknown>; id?: string }
  | { type: 'attempt:update'; courseId: string; attemptId: string; input: Record<string, unknown> }
  | { type: 'attempt:remove'; courseId: string; attemptId?: string; index?: number }
  | { type: 'gate:add'; input: Record<string, unknown>; id?: string }
  | { type: 'gate:update'; id: string; input: Record<string, unknown> }
  | { type: 'gate:remove'; id: string }
  | { type: 'event:add'; input: Record<string, unknown>; id?: string }
  | { type: 'event:update'; id: string; input: Record<string, unknown> }
  | { type: 'event:remove'; id: string }

/**
 * The least a record must carry to be classified. Declared structurally so
 * every surface reading a status — the register, the planner, the scenario —
 * calls this one implementation instead of re-deriving it from attempt strings.
 */
export type StatusCandidate = { passMark?: number | null; attempts?: Attempt[] }

export declare function bestAttempt(course: StatusCandidate): Attempt | null
export declare function courseStatus(course: StatusCandidate): CourseStatus
export declare const STATUS_LABEL: Record<CourseStatus, string>
export declare const STATUS_MARK: Record<CourseStatus, string>
export declare const ATTEMPT_STATUS: [string, string][]
export declare const PROGRAMME_REQUIREMENTS: [string, string][]
export declare const EVENT_TYPES: [string, string][]
export declare function applyWorkspaceEdit(workspace: Workspace, patch: WorkspaceEdit): Workspace | null
export declare function earnedEcts(courses: Course[]): number
export declare function plannedEcts(courses: Course[]): number
export declare function weightedGpa(courses: Course[]): number | null
export declare function byYear(courses: Course[]): { level: string; ects: number; courses: Course[] }[]
export declare function courseRecord(input: Record<string, unknown>, id?: string): Course
export declare function attemptRecord(input: Record<string, unknown>, id?: string): Attempt
export declare function gateRecord(input: Record<string, unknown>, id?: string): Gate
export declare function eventRecord(input: Record<string, unknown>, id?: string): AcademicEvent
export declare function planningTab(value: unknown): string
