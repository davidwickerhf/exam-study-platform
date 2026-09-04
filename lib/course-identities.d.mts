export type CurriculumCourse = { id?: string; code?: string; name?: string; ects?: number; yearLevel?: string; period?: string; requirement?: string }
export type CurriculumVersion = { courses?: CurriculumCourse[] }
export type CourseIdentity = { canonicalCourse(course: CurriculumCourse): CurriculumCourse | null; codeKey(value: unknown): string; titleKey(value: unknown): string }
export declare function curriculumCourseIdentity(options?: { selectedVersion?: CurriculumVersion | null; programmeVersions?: CurriculumVersion[] }): CourseIdentity
export declare function reconcileAcademicCourseIdentities<T extends CurriculumCourse & { attempts?: Record<string, unknown>[] }>(courses: T[], identity: CourseIdentity): T[]
