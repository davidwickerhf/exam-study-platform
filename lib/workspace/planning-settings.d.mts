import type { Workspace } from './academics.mjs'

export type ProgrammeIndexItem = { id: string; programme: string; academicYear: string }
export type MatchSummary = { total: number; matched: number; unmatched: number }

export declare function programmeLabel(item: Partial<ProgrammeIndexItem> | null | undefined): string
export declare function exportEnvelope(workspace: Workspace): { version: 1; data: Workspace }
export declare function importCandidate(value: unknown): Workspace
export declare function courseMatchSummary(candidate: { courses?: { code?: unknown }[] }, editorialCourses: { code?: unknown }[]): MatchSummary
export declare function exportFilename(date?: Date): string
