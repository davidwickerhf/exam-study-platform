import type { ContentRequest, IngestionStage } from './admin.mjs'
export type IntakeDraft = { status: string; pipelineStage: string; adminNote: string }
export declare const REQUEST_STATUSES: readonly (readonly [string, string])[]
export declare function intakeDraft(request: ContentRequest): IntakeDraft
export declare function intakePayload(draft: IntakeDraft, stages: IngestionStage[]): { status: string; pipelineStage: string; adminNote: string }
export declare function canPrepareRequest(request: ContentRequest): boolean
export declare function replaceRequest(requests: ContentRequest[], updated: ContentRequest): ContentRequest[]
export declare function intakeCounts(requests: ContentRequest[]): { total: number; open: number }
