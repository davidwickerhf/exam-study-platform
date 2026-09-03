/** Types for lib/workspace/course-ledger.mjs. */

import type { AcademicCourse, StudyCourse } from './courses.mjs'
import type { CourseStatus } from './academics.mjs'

export type CorpusCourse = {
  id: string
  courseCode: string
  courseName: string
  academicYear?: string
  period?: string
  sources: number
  lastSyncedAt?: string | null
}

export type CatalogueCourse = { id: string; code: string; name: string; ects?: number; yearLevel?: string; period?: string }
export type Catalogue = { programmes?: { id: string; versions?: { id: string; courses?: CatalogueCourse[] }[] }[] }
export type ProgrammeTemplate = { programmeId?: string; versionId?: string; currentStudyYear?: string } | null

export type LedgerCourse = {
  key: string
  code: string
  name: string
  editorial?: StudyCourse
  academic?: AcademicCourse
  corpus?: CorpusCourse
  archived: boolean
}

export type LedgerScope = 'current' | 'future' | 'passed' | 'failed' | 'all' | 'archived'
export type LedgerSort = 'period' | 'year' | 'code' | 'name'

export type LedgerSources = {
  editorial?: StudyCourse[] | null
  academic?: AcademicCourse[]
  corpus?: CorpusCourse[]
  catalogue?: Catalogue | null
  programmeTemplate?: ProgrammeTemplate
  today?: string
}

export type LedgerStatus = {
  status: CourseStatus
  passed: boolean
  failed: boolean
  current: boolean
  future: boolean
}

export type RowDestination = {
  kind: 'study' | 'request' | 'canvas'
  href: string
  action: string
  chapters: number
}

export declare const SCOPES: LedgerScope[]
export declare function cleanCanvasName(name: string, code: string): string
export declare function normalizedPeriod(value: unknown): string
export declare function periodLabel(value: unknown): string | null
export declare function reconcileCourses(sources?: LedgerSources): LedgerCourse[]
export declare function compareLedger(academicCourses: AcademicCourse[], today?: string): (left: LedgerCourse, right: LedgerCourse) => number
export declare function comparePeriod(academicCourses: AcademicCourse[], today?: string): (left: LedgerCourse, right: LedgerCourse) => number
export declare function courseLedger(sources?: LedgerSources): LedgerCourse[]
export declare function ledgerStatus(entry: LedgerCourse, currentCodes: Set<string>): LedgerStatus
export declare function currentCodeSet(currentCourses: ({ code: string } | string)[]): Set<string>
export declare function rowDestination(entry: LedgerCourse): RowDestination
export declare function materialSummary(entry: LedgerCourse): string | null
export declare function filterLedger(ledger: LedgerCourse[], options?: { query?: string; scope?: LedgerScope | string; currentCourses?: ({ code: string } | string)[] }): LedgerCourse[]
export declare function sortLedger(ledger: LedgerCourse[], options?: { sort?: LedgerSort | string; academic?: AcademicCourse[]; today?: string }): LedgerCourse[]
