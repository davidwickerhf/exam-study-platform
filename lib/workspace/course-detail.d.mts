import type { AcademicAttempt, AcademicCourse } from './courses.mjs'
import type { LedgerCourse, LedgerSources } from './course-ledger.mjs'
export type CourseTab = 'study' | 'history' | 'materials' | 'attendance' | 'about'
export type CourseAttemptRow = AcademicAttempt & { key: string; recordedIndex: number }
export declare function courseDetail(courseId: string, sources?: LedgerSources): LedgerCourse | null
export declare function courseAttemptHistory(course?: AcademicCourse | null): CourseAttemptRow[]
export declare function courseDetailTab(search?: string, hash?: string): CourseTab
