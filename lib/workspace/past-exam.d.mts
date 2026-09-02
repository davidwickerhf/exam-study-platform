export type Paper = { id: string; label: string; pdf?: string; solutionsPdf?: string }
export declare function coursePapers(course: { mockExams?: Paper[]; mockExamPdf?: string; mockExamSolutionsPdf?: string } | null | undefined): Paper[]
export declare function pastExamGradeRequest(questionId: unknown, attempt: unknown): { questionId: string; attempt: string }
export declare function paperAssetHref(courseId: string, examId: string, path: string): string
export declare function paperPdfHref(courseId: string, examId: string, solutions?: boolean): string
