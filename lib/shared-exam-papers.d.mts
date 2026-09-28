export declare function examMaterialKind(input?: { filename?: string; sourcePath?: string }): 'paper' | 'solutions' | null
export declare function sharedExamCourseCode(value: unknown): string | null
export declare function publishedExamPapers(courseCode: string): Promise<{
  courseCode: string | null
  courseName: string | null
  papers: { id: string; title: string; kind: 'paper' | 'solutions'; academicYear: string; period: string; byteSize: number; url: string; downloadUrl: string }[]
}>
export declare function sharedExamAsset(assetId: string): Promise<Record<string, unknown> | null>
export declare function examPaperReviewQueue(input?: { limit?: number }): Promise<Record<string, unknown>[]>
export declare function reviewExamPaper(input: { snapshotId: string; status: 'approved' | 'withheld'; reviewerId: string; note?: string }): Promise<{ snapshotId: string; status: string }>
