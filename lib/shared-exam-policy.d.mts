export declare function examMaterialKind(input?: { filename?: string; sourcePath?: string }): 'paper' | 'solutions' | null
export declare function sharedExamCourseCode(value: unknown): string | null
export declare function canOpenSharedExam(auth: { authenticated?: boolean; mode?: string; email?: string | null; admin?: boolean } | null): boolean
