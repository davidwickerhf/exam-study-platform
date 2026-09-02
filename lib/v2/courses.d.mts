/** Types for lib/v2/courses.mjs. */

export type Chapter = { id: string; name: string; file?: string }
export type Item = { id: string; title: string; mastery: number; chapterIds?: string[] }

export type StudyCourse = {
  id: string
  code: string
  name: string
  shortName?: string
  exam?: string | null
  archived?: boolean
  chapters?: Chapter[]
  items?: Item[]
}

export type AcademicCourse = { code: string; attempts?: { examDate?: string | null; type?: string | null }[] }

export type Progress = { total: number; done: number; percent: number; mastery: number | null }
export type Exam = { date: string; days: number; type: string | null }

export declare const MASTERY_MAX: number
export declare const READ_KEY_PREFIX: string
export declare function readKey(courseId: string, chapterId: string): string
export declare function readChapters(storage: Storage | null): Set<string>
export declare function chaptersRead(course: StudyCourse, read: Set<string>): number
export declare function masteryPercent(course: StudyCourse): number | null
export declare function courseProgress(course: StudyCourse, read: Set<string>): Progress
export declare function nextExam(course: StudyCourse, academicCourses: AcademicCourse[], today: string): Exam | null
export declare function byNextExam(courses: StudyCourse[], academicCourses: AcademicCourse[], today: string): StudyCourse[]
