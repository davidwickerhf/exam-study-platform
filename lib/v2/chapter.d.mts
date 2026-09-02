/** Types for lib/v2/chapter.mjs. */
export type Heading = { depth: number; text: string; id: string }
export type ChapterRef = { id: string; name: string }

export declare function slugOf(text: string): string
export declare function outlineOf(markdown: string, options?: { min?: number; max?: number }): Heading[]
export declare function readingMinutes(markdown: string, wordsPerMinute?: number): number
export declare function neighbours(chapters: ChapterRef[], chapterId: string): { previous: ChapterRef | null; next: ChapterRef | null }
