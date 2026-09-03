/** Types for lib/app/courses.mjs. */

export type Chapter = { id: string; name: string; file?: string }
export type Item = { id: string; title: string; mastery: number; chapterIds?: string[]; notes?: string; masteryUpdatedAt?: string | null }
export type CourseProfile = {
  description?: string
  learningOutcomes?: string[]
  assessment?: { status?: string; components?: { name: string; type?: string; weightPercent?: number | null; minimumPercent?: number | null; deadline?: string | null; deadlineText?: string; notes?: string }[]; overallPassRules?: string[]; resitRules?: string[]; attendanceRules?: string[] }
}

export type StudyCourse = {
  id: string
  code: string
  name: string
  shortName?: string
  exam?: string | null
  archived?: boolean
  chapters?: Chapter[]
  items?: Item[]
  role?: string
  courseProfile?: CourseProfile | null
  mockExams?: { id: string; label: string; pdf?: string; solutionsPdf?: string }[]
  mockExamPdf?: string
  mockExamSolutionsPdf?: string
}

export type AcademicAttempt = { id?: string; examDate?: string | null; type?: string | null; status?: string | null; grade?: number | null; registered?: boolean }
export type AcademicCourse = { id?: string; code: string; name?: string; ects?: number; period?: string; yearLevel?: string; passMark?: number; attempts?: AcademicAttempt[] }

export type Progress = { total: number; done: number; percent: number; mastery: number | null }
export type Exam = { date: string; days: number; type: string | null }

export declare const MASTERY_MAX: number
export declare const READ_KEY_PREFIX: string
export declare const COURSE_RETURN_KEY: string
export declare function readKey(courseId: string, chapterId: string): string
export declare function readChapters(storage: Storage | null): Set<string>
export declare function chaptersRead(course: StudyCourse, read: Set<string>): number
export declare function masteryPercent(course: StudyCourse): number | null
export declare function courseProgress(course: StudyCourse, read: Set<string>): Progress
export declare function nextExam(course: StudyCourse, academicCourses: AcademicCourse[], today: string): Exam | null
export declare function compareByNextExam(academicCourses: AcademicCourse[], today: string): (left: StudyCourse, right: StudyCourse) => number
export declare function byNextExam(courses: StudyCourse[], academicCourses: AcademicCourse[], today: string): StudyCourse[]
export declare function academicCourseFor(course: StudyCourse, academicCourses: AcademicCourse[]): AcademicCourse | null
export declare function canvasCourseQuery(course: StudyCourse): string
export declare function isMaterialPath(value: unknown): boolean
export declare function materialName(path: unknown): string
