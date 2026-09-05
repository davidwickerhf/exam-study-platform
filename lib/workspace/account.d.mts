/** Types for lib/app/account.mjs. */

export type AccountIdentity = {
  id: string
  email: string | null
  firstName?: string | null
  lastName?: string | null
  createdAt: string | null
  admin?: boolean
  mode: 'clerk' | 'local' | 'api-key'
  storage: string
}

export type ProgrammeMembership = {
  programmeId: string
  role: string
  programme: { id: string; degree: string; name: string; institution?: { name?: string } | null } | null
}

export type NamespaceEntry = {
  namespace: string
  table?: string
  label: string
  count: number
  bytes: number | null
  updatedAt: string | null
  study: boolean
  detail?: string | null
}

export type AccountSummary = {
  account: AccountIdentity
  programmes: ProgrammeMembership[]
  namespaces: NamespaceEntry[]
  totals: { documents: number; bytes: number; updatedAt: string | null }
}

export type ApiKey = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
}

export type CreatedApiKey = ApiKey & { secret: string }

export type AiUsageEvent = {
  id: string
  feature: 'chat' | 'exercises' | 'intake'
  status: 'pending' | 'completed' | 'failed'
  inputTokens: number
  outputTokens: number
  reservedTokens: number
  estimated: boolean
  createdAt: string
}

export type AiUsage = {
  limits: {
    chat: { requestsPerDay: number; requestsPerMinute: number; maxOutputTokens: number }
    exercises: { requestsPerDay: number; requestsPerMinute: number; maxOutputTokens: number }
    intake: { requestsPerDay: number; requestsPerMinute: number; maxOutputTokens: number }
    tokensPerDay: number
    tokensPerMonth: number
  }
  usage: {
    minute: UsageTally
    today: UsageTally
    month: UsageTally
  }
  remaining: { chatToday: number; exercisesToday: number; intakeToday: number; tokensToday: number; tokensMonth: number }
  resetsAt: { day: string; month: string }
  recent: AiUsageEvent[]
}

export type UsageTally = {
  requests: { chat: number; exercises: number; intake: number }
  inputTokens: number
  outputTokens: number
  reservedTokens: number
  tokens: number
}

export type ActivityDay = { date: string; total: number; answer: number; review: number; mock: number; resolve: number; read: number }

export type ActivityEvent = {
  type: 'answer' | 'review' | 'mock' | 'resolve' | 'read'
  at: string
  courseId: string | null
  chapterId: string | null
  score: number | null
  label: string | null
}

export type Activity = {
  days: number
  series: ActivityDay[]
  streak: number
  week: { total: number; answer: number; review: number; mock: number; resolve: number; read: number }
  previousWeek: number
  activeDays: number
  averageScore: number | null
  recent: ActivityEvent[]
}

export type Meter = {
  id: string
  label: string
  unit: 'requests' | 'tokens'
  resets: 'day' | 'month'
  used: number
  limit: number | null
  remaining: number | null
  percent: number | null
}

export type NamespaceBlock = {
  entries: NamespaceEntry[]
  count: number
  bytes: number
  measured: boolean
}

export type ResetScope = 'study' | 'everything'

export type KeyState = 'active' | 'revoked' | 'expired'

export type CorpusJob = {
  id: string
  bindingId?: string | null
  syncId?: string
  origin?: string
  type: string
  status: string
  attempts?: number
  result?: { files?: number; indexed?: number; skipped?: number }
  error?: string | null
  courseCode?: string | null
  courseName?: string | null
  academicYear?: string | null
  createdAt?: string
  startedAt?: string | null
  finishedAt?: string | null
}

export type CorpusCourseEdition = {
  id: string
  canonicalCourseId?: string
  courseCode: string
  courseName: string
  academicYear?: string | null
  academicYears?: string[]
  period?: string | null
  sources: number
  editionCount?: number
  editions?: Array<{ id?: string; editionId?: string | null; academicYear?: string | null; period?: string | null; sources?: number; lastSyncedAt?: string | null }>
  lastSyncedAt?: string | null
}

export type CorpusStatus = { jobs?: CorpusJob[]; latestJobs?: CorpusJob[]; courses?: CorpusCourseEdition[] }

export type CorpusSummary = {
  jobs: CorpusJob[]
  active: CorpusJob[]
  failed: CorpusJob[]
  latestByCourse: CorpusJob[]
  latestByEdition: CorpusJob[]
  failureGroups: [string, CorpusJob[]][]
  courseEditions: number
  storedMaterials: number
}

export type CanvasSyncProgress = {
  active: boolean
  percent: number | null
  stage: string | null
  activeJobs: CorpusJob[]
  jobs: CorpusJob[]
  totalCourses: number
  settledCourses: number
  completedCourses: number
  failedCourses: number
  indexedFiles: number
}

export type CurrentCourseFigure = { count: number; period: string | null; codes: string[] }

export type ProgrammeFacts = {
  programme: string | null
  source: 'record' | 'membership' | null
  institution: string | null
  memberships: { id: string; label: string; admin: boolean }[]
  membership: string
  empty: boolean
}

export declare function formatBytes(bytes: number | null | undefined): string
export declare function formatCount(value: number | null | undefined): string
export declare function approximateBytes(bytes: number | null | undefined): string | null
export declare function periodLabel(value: unknown): string | null
export declare function currentCourseFigure(calendar: { currentCourses?: { code?: string }[]; academicContext?: { period?: string } | null } | null | undefined): CurrentCourseFigure | null
export declare function programmeFacts(summary: AccountSummary | null | undefined, workspace: { profile?: { programme?: string; university?: string } } | null | undefined): ProgrammeFacts
export declare function canvasCorpusSummary(status: CorpusStatus | null | undefined): CorpusSummary
export declare function canvasSyncProgress(status: CorpusStatus | null | undefined): CanvasSyncProgress
export declare function meterPercent(used: number, limit: number | null | undefined): number | null
export declare function allowanceMeters(summary: AiUsage | null): Meter[]
export declare const AI_FEATURE_LABEL: Record<string, string>
export declare function requestTokens(event: AiUsageEvent | null): { input: number; output: number; estimated: boolean }
export declare function groupNamespaces(namespaces: NamespaceEntry[]): { cleared: NamespaceBlock; kept: NamespaceBlock }
export declare function namespaceLabel(entry: NamespaceEntry | null): string
export declare const RESET_SCOPES: Record<ResetScope, { title: string; description: string; action: string; removes: string[] }>
export declare function confirmationMatches(typed: string, word: string): boolean
export declare const API_SCOPES: string[]
export declare const SCOPE_COPY: Record<string, string>
export declare const KEY_LIFETIMES: [string, string][]
export declare function availableScopes(admin: boolean): string[]
export declare function normalizeScopes(scopes: string[], options?: { admin?: boolean }): string[]
export declare function keyState(key: ApiKey | null, now?: number): KeyState
export declare const KEY_STATE_LABEL: Record<KeyState, string>
export declare function activeKeys(keys: ApiKey[] | null, now?: number): ApiKey[]
export declare const KEY_PLACEHOLDER: string
export declare function mcpSnippet(origin: string): string
export declare function skillSnippet(origin: string): string
export declare const ACTIVITY_LABEL: Record<string, string>
export declare function activityBars(series: ActivityDay[], today?: string): { date: string; total: number; height: number; today: boolean }[]
export declare function weekTrend(activity: Activity | null): { now: number; before: number; delta: number; label: string } | null
