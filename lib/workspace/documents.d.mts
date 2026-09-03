/** Types for lib/app/documents.mjs. */

export type ChangeKind =
  | 'profile'
  | 'profile-conflict'
  | 'course-detail'
  | 'course-conflict'
  | 'attempt-context'
  | 'attempt-conflict'
  | 'result'
  | 'exam-date'
  | 'new-course'
  | 'history'
  | 'enrollment'
  | 'event'

/** One reviewable proposal, exactly as buildChangeSet in lib/academic-documents.mjs emits it. */
export type Change = {
  id: string
  kind: ChangeKind | string
  label: string
  detail?: string
  payload?: Record<string, unknown>
  source?: string
  sourceLabel?: string
  issue?: string | null
  requiresDecision?: boolean
  selectedByDefault?: boolean
  requiresCourseChangeId?: string | null
}

export type ReconciliationItem = {
  key?: string
  courseId?: string | null
  code?: string | null
  name?: string | null
  evidence?: string[]
  changeId?: string | null
}

export type ReconciliationConflict = { id: string; label: string; issue?: string | null }

export type Reconciliation = {
  kind?: string
  sourceLabel?: string
  status: 'aligned' | 'review' | 'attention' | 'not-applicable' | string
  coverage?: { observed: number; matched: number; selectedInScope: number; missing: number }
  matched?: ReconciliationItem[]
  unselected?: ReconciliationItem[]
  historical?: ReconciliationItem[]
  missing?: ReconciliationItem[]
  conflicts?: ReconciliationConflict[]
}

export type FeedSummary = {
  eventCount: number
  rangeStart: string | null
  rangeEnd: string | null
  matchedEvents?: number
  unselectedEvents?: number
  generalEvents?: number
  matchedCourseCount: number
  unselectedCourseCount: number
  refreshIntervalMinutes?: number
}

export type CalendarLink = {
  id: string
  label: string
  url: string
  lastSyncedAt: string | null
  eventCount: number
  rangeStart: string | null
  rangeEnd: string | null
  matchedCourseCount: number
  unselectedCourseCount: number
}

export type ChangeSet = {
  kind: string
  sourceLabel?: string
  changes: Change[]
  counts?: Record<string, number>
  warnings?: string[]
  reconciliation?: Reconciliation | null
  feedSummary?: FeedSummary | null
  sources?: { name?: string }[]
  link?: Partial<CalendarLink> | null
  usedAi?: boolean
  revision?: number
}

/** A file after it has been read in the browser, ready to post. */
export type SourceFile = {
  name: string
  type: string
  size?: number
  text: string
  images: string[]
  pageCount: number
}

export type ChangeGroup = {
  kind: string
  label: string
  changes: Change[]
  decisions: number
  defaultOpen: boolean
}

export type SelectionSummary = {
  total: number
  selected: number
  applying: number
  blocked: number
  decisions: number
  decisionsSelected: number
}

export type ReconciliationSummary = {
  status: string
  matched: ReconciliationItem[]
  unselected: ReconciliationItem[]
  missing: ReconciliationItem[]
  conflicts: ReconciliationConflict[]
  issueCount: number
  currentEnrollment: boolean
}

export declare const DOCUMENT_KINDS: [string, string][]
export declare const CHANGE_GROUPS: [string, string][]
export declare const MAX_SOURCES: number
export declare const MAX_SOURCE_BYTES: number
export declare const MAX_IMAGE_PAGES: number
export declare const MAX_DESCRIPTION: number

export declare function groupChanges(changes: Change[]): ChangeGroup[]
export declare function needsDecision(change: Change | null | undefined): boolean
export declare function defaultSelection(changes: Change[]): Set<string>
export declare function toggleChange(changes: Change[], selected: Set<string>, id: string, checked: boolean): Set<string>
export declare function selectAll(changes: Change[]): Set<string>
export declare function selectedChanges(changes: Change[], selected: Set<string>): Change[]
export declare function selectionSummary(changes: Change[], selected: Set<string>): SelectionSummary
export declare function mergeReconciliations(left: Reconciliation | null, right: Reconciliation | null): Reconciliation | null
export declare function mergeChangeSets(left: ChangeSet | null, right: ChangeSet | null, source?: { name?: string } | null): ChangeSet | null
export declare function reconciliationSummary(result: ChangeSet | null | undefined): ReconciliationSummary | null
export declare function analysisPayload(files: SourceFile[]): {
  documents: { name: string; type: string; pageCount: number; text: string; images: string[] }[]
  calendars: SourceFile[]
}
export declare function describeSource(file: SourceFile): string

export type ChangeStatus = 'new' | 'match' | 'conflict'
export type AnalysisRequest = { path: string; body: Record<string, unknown>; source: { name?: string } | null }

export declare function analysisRequests(
  files: SourceFile[],
  options?: { kind?: string; description?: string; date?: string | null }
): AnalysisRequest[]
export declare function mergeAnalysisResults(
  results: { result: ChangeSet | null; source: { name?: string } | null }[]
): ChangeSet | null
export declare function changeStatus(change: Change): ChangeStatus
export declare const CHANGE_STATUS_LABEL: Record<ChangeStatus, string>
export declare function changeDiff(change: Change): { current: string; source: string; proposed: string } | null
