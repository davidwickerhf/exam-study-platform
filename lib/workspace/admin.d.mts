/** Types for lib/app/admin.mjs. */

export type AdminStatus = {
  mode: 'neon' | 'local'
  writable: boolean
  releaseId?: number
  activatedAt?: string | null
  counts?: Record<string, number>
}

export type EditionCounts = {
  sources: number
  acceptedSources: number
  pendingJobs: number
  reviewArtifacts: number
  approvedArtifacts: number
}

export type Edition = {
  id: string
  programmeId: string | null
  canonicalCourseId: string
  courseCode: string
  courseName: string
  academicYear: string
  period: string
  status: string
  createdAt: string
  updatedAt: string
  counts?: EditionCounts
}

export type RequestFile = { id: string; name: string; size: number; type?: string }

export type ContentRequest = {
  id: string
  userId?: string
  requesterEmail?: string | null
  programmeId: string | null
  academicCourseId: string
  courseCode: string
  courseName: string
  academicYear: string
  period: string
  categories: string[]
  notes: string
  urls: string[]
  status: string
  pipelineStage: string
  adminNote?: string
  contributionConsent: boolean
  contributionLicense: string
  editionId: string | null
  createdAt: string
  updatedAt: string
  files: RequestFile[]
}

export type IngestionStage = { id: string; label: string; detail: string }

export type Coverage = { totalPending: number; totalSteps: number; courses: Record<string, { total: number; pending: number }> }

export type AdminCourse = { id: string; code: string; name: string; archived?: boolean }

export type Stage = { id: string; label: string; next: string | null }

export type QueueItem = { id: string; title: string; detail: string; href: string; weight: number }

export type Counter = { key: string; label: string; value: number | null }

export type CoverageRow = { id: string; code: string; name: string; total: number; pending: number; done: number; percent: number | null }

export declare function editionStage(edition: Edition | null): Stage
export declare const REQUEST_STATUS_LABEL: Record<string, string>
export declare function isOpenRequest(request: ContentRequest | null): boolean
export declare function openRequests(requests: ContentRequest[] | null): ContentRequest[]
export declare function attentionQueue(sources: { editions?: Edition[]; requests?: ContentRequest[] }): QueueItem[]
export declare const RELEASE_COUNTERS: [string, string][]
export declare function releaseCounters(status: AdminStatus | null): Counter[]
export declare function coverageRows(coverage: Coverage | null, courses: AdminCourse[] | null): CoverageRow[]
