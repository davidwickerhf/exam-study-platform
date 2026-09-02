export type CalendarFile = { name: string; text: string }
export declare function calendarPayload(input: { source: 'url' | 'file'; url?: string; files?: CalendarFile[]; replace?: boolean }): ({ url: string; replace: boolean } | { ics: string; replace: boolean })[]
export declare function calendarResultLine(result: { count?: number; read?: number; replaced?: boolean; id?: string }, programmeName?: string): string
