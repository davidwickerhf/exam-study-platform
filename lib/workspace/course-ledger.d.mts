/** Types for lib/workspace/course-ledger.mjs. */

import type { AcademicCourse, StudyCourse } from './courses.mjs'
import type { CourseStatus } from './academics.mjs'

export type CorpusCourse = {
  origin?: string
  canvasCourseId?: string
  id: string
  canonicalCourseId?: string
  courseCode: string
  courseName: string
  academicYear?: string
  academicYears?: string[]
  period?: string
  sources: number
  editionCount?: number
  editions?: Array<{ id?: string; origin?: string; canvasCourseId?: string; editionId?: string | null; academicYear?: string; period?: string; courseCode?: string; courseName?: string; sources?: number; lastSyncedAt?: string | null }>
  lastSyncedAt?: string | null
}

export type CatalogueCourse = { id: string; code: string; name: string; ects?: number; yearLevel?: string; period?: string; requirement?: string }
export type CatalogueVersion = { id: string; label?: string; courses?: CatalogueCourse[]; choiceGroups?: Array<{ id: string; label?: string; courseIds?: string[]; minSelections?: number; maxSelections?: number; yearLevel?: string; period?: string; derived?: boolean }> }
export type CatalogueProgramme = { id: string; name?: string; degree?: string; durationYears?: number; totalEcts?: number; versions?: CatalogueVersion[] }
export type Catalogue = { programmes?: CatalogueProgramme[] }
export type ProgrammeTemplate = { programmeId?: string; versionId?: string; currentStudyYear?: string; selectedChoices?: Record<string, string[]> } | null
export type CurrentCourse = { code: string; name?: string; courseId?: string | null; reasons?: string[]; outsidePlan?: boolean }

export type LedgerCourse = {
  key: string
  code: string
  name: string
  editorial?: StudyCourse
  academic?: AcademicCourse
  corpus?: CorpusCourse
  calendar?: CurrentCourse
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
  currentCourses?: (CurrentCourse | string)[]
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
  kind: 'study' | 'request' | 'canvas' | 'calendar'
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
export declare function degreeRunwayYears(options?: { programme?: CatalogueProgramme | null; version?: CatalogueVersion | null; programmeTemplate?: ProgrammeTemplate; academic?: AcademicCourse[]; currentCodes?: Set<string> }): Array<{ label: string; targetEcts: number; mappedEcts: number; earnedEcts: number; openChoiceEcts: number; overplannedEcts: number; choiceOptions: number; selectedChoices: number; historicalOptions: Array<{ code: string; name: string; ects: number }>; running: number; current: boolean }>
export declare function rowDestination(entry: LedgerCourse): RowDestination
export declare function materialSummary(entry: LedgerCourse): string | null
export declare function courseMaterialCoverage(entry: LedgerCourse): { percent: number; available: number; total: 2; detail: string; library: boolean; canvas: boolean }
export declare function currentSourceCoverage(options?: { ledger?: LedgerCourse[]; currentCourses?: ({ code: string } | string)[]; academic?: AcademicCourse[] }): Array<{ id: 'record' | 'canvas' | 'library'; covered: number; total: number; percent: number | null }>
export declare function filterLedger(ledger: LedgerCourse[], options?: { query?: string; scope?: LedgerScope | string; currentCourses?: ({ code: string } | string)[] }): LedgerCourse[]
export declare function sortLedger(ledger: LedgerCourse[], options?: { sort?: LedgerSort | string; academic?: AcademicCourse[]; today?: string }): LedgerCourse[]
