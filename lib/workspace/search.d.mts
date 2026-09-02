export type SearchResult = { chapterId: string; chapterName: string; headingSlug?: string; headingText?: string; snippet?: string }
export declare function searchable(query: unknown): boolean
export declare function searchHref(courseId: string, result: SearchResult): string
export declare function searchLabel(result: SearchResult): string
