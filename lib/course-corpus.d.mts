export type CanvasCorpusCourse = {
  id: string
  name?: string | null
  displayName?: string | null
  courseCode?: string | null
  current?: boolean
  upcoming?: boolean
  term?: { name?: string | null; startAt?: string | null; endAt?: string | null } | null
  startAt?: string | null
}

export declare function academicYearFromCanvasCourse(course?: CanvasCorpusCourse): string
export declare function periodFromCanvasCourse(course?: CanvasCorpusCourse): string
export declare function canonicalCanvasCourse(input: { origin: string; course: CanvasCorpusCourse }): {
  canonicalCourseId: string; editionId: string; editionKey: string; courseCode: string; courseName: string; academicYear: string; period: string; institution: string; termName: string
}
export declare function selectCanvasCorpusCourses(courses?: CanvasCorpusCourse[]): CanvasCorpusCourse[]
export declare function supportedCanvasCourseCode(course?: CanvasCorpusCourse): string
export declare function isSupportedCanvasCourse(course?: CanvasCorpusCourse): boolean
export declare function retireUnsupportedCanvasCorpusCourses(input: { accountId: string; origin: string; courses?: CanvasCorpusCourse[] }): Promise<{ retired: number; cancelled: number; mode?: string }>
export declare function retrievalEditionOrder<T extends { academicYear?: string | null }>(editions?: T[], options?: { academicYear?: string; includeHistorical?: boolean }): T[]
export declare function enqueueCanvasCatalogSync(input: { accountId: string; origin: string; force?: boolean }): Promise<Record<string, unknown>>
export declare function canvasCorpusPermission(input: { accountId: string; origin: string }): Promise<Record<string, unknown>>
export declare function setCanvasCorpusPermission(input: { accountId: string; origin: string; collectionEnabled: boolean; sharingMode?: 'private' | 'community' }): Promise<Record<string, unknown>>
export declare function listCanvasCorpusMaterials(input: { accountId: string; courseCode?: string; academicYear?: string }): Promise<Array<Record<string, unknown>>>
export declare function canvasCorpusAsset(input: { accountId: string; assetId: string }): Promise<Record<string, unknown> | null>
export declare function canvasCorpusAssetChunks(input: { assetId: string; first?: number; last?: number }): Promise<Array<{ chunk_index: number; data: Uint8Array }>>
export declare function enqueueCanvasCourseSync(input: { accountId: string; origin: string; course: Record<string, unknown>; force?: boolean }): Promise<Record<string, unknown>>
export declare function observeCanvasCorpusCourses(input: { accountId: string; origin: string; courses: CanvasCorpusCourse[] }): Promise<{ observed: number; queued: number; mode?: string }>
export declare function canvasCorpusStatus(input: { accountId: string }): Promise<Record<string, unknown>>
