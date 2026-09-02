/** Types for lib/v2/academics.mjs. */

export type Attempt = { grade?: number | null; examDate?: string | null; registered?: boolean }

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
}

export type Workspace = {
  profile: { university: string; programme: string; academicYear: string }
  programmeTemplate: { programmeId: string; versionId: string; currentStudyYear: string } | null
  courses: Course[]
}

export type CourseStatus = 'passed' | 'failed' | 'registered' | 'not-recorded'

export declare function bestAttempt(course: Course): Attempt | null
export declare function courseStatus(course: Course): CourseStatus
export declare const STATUS_LABEL: Record<CourseStatus, string>
export declare function earnedEcts(courses: Course[]): number
export declare function plannedEcts(courses: Course[]): number
export declare function weightedGpa(courses: Course[]): number | null
export declare function byYear(courses: Course[]): { level: string; ects: number; courses: Course[] }[]
