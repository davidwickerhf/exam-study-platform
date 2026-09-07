import type { StudyCourse, CourseProfile } from './workspace/courses.mjs'
export declare function supportedCourseAssessment(course?: Pick<StudyCourse, 'courseProfile'> | null): CourseProfile['assessment'] | null
