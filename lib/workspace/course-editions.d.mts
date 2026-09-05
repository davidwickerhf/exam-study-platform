import type { AcademicCourse } from './courses.mjs'
import type { LedgerCourse, LedgerSources } from './course-ledger.mjs'
import type { CorpusJob } from './account.mjs'
export type CanvasShell = { id: string; origin: string; courseCode?: string | null; name?: string; displayName?: string; academicYear?: string; term?: { name?: string | null; startAt?: string | null } | null; startAt?: string | null }
export type CourseEdition = { year: string; sources: number; attempts: number; shells: CanvasShell[]; missing: CanvasShell[]; jobs: CorpusJob[]; busy: boolean; failed: boolean; collected: boolean }
export declare function editionYear(value?: string | null): string
export declare function canvasShellKey(shell: CanvasShell): string
export declare function courseEditionCodes(entry?: LedgerCourse | null, sources?: LedgerSources): string[]
export declare function canvasEditionYear(course: CanvasShell): string
export declare function courseCanvasShells(courses?: CanvasShell[], codes?: string[]): CanvasShell[]
export declare function courseEditions(options?: { entry?: LedgerCourse | null; codes?: string[]; shells?: CanvasShell[]; jobs?: CorpusJob[]; queued?: string[] }): CourseEdition[]
export declare function academicCourseInEdition(course?: AcademicCourse | null, year?: string): AcademicCourse | null
