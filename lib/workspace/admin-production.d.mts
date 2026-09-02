export type EditorialEdition = { id: string; status: string; courseCode?: string; canonicalCourseId?: string }
export type EditorialWorkspace = { sources?: any[]; topics?: any[]; artifacts?: any[]; releases?: any[]; jobs?: any[] }
export declare function editionRecords(edition: EditorialEdition, workspace: EditorialWorkspace): { sources: any[]; topics: any[]; artifacts: any[]; releases: any[]; jobs: any[] }
export declare function productionFacts(edition: EditorialEdition, workspace: EditorialWorkspace): any
export declare function productionStage(edition: EditorialEdition, workspace: EditorialWorkspace): 'sources' | 'rights' | 'extract' | 'map' | 'drafts' | 'review' | 'publish' | 'live'
export declare function pipelineSteps(edition: EditorialEdition, workspace: EditorialWorkspace): { id: string; label: string; value: string; done: boolean }[]
export declare function contributionReviewPayload(status: string): { status: string; reviewNote: string }
export declare function artifactReviewPayload(status: string): { status: string; reviewNote: string }
export declare function artifactEditPayload(input: { title: string; definition: string | object }): { title: string; definition: object; status: string; reviewNote: string }
export declare function canPublish(edition: EditorialEdition, workspace: EditorialWorkspace, confirmation: string): boolean
