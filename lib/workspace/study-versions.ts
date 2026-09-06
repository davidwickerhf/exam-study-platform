export type StudyCourseIdentity = {
  courseCode: string
  courseName: string
  academicYear: string
  period: string
}
export type StudySource = {
  key: string
  title: string
  kind: 'canvas' | 'editorial' | 'notes'
  academicYear: string
  period?: string
  sha256: string
  historical?: boolean
  periodMismatch?: boolean
  url?: string
}
export type Evidence = {
  id: string
  sourceKey: string
  page: number | null
  text: string
}
export type GroundedText = { text: string; sourceIds: string[] }
export type StudyVisualSpec = {
  title: string; caption: string; basis: 'source' | 'illustrative'; sourceIds: string[]
  diagram:
    | { kind: 'process'; nodes: { id: string; label: string; description: string }[]; edges: { from: string; to: string; label: string }[] }
    | { kind: 'comparison'; columns: string[]; rows: { label: string; cells: string[] }[] }
    | { kind: 'plot'; style: 'bar' | 'line'; xLabel: string; yLabel: string; points: { label: string; x: number; y: number }[] }
    | { kind: 'sets'; aLabel: string; bLabel: string; universe: string[]; a: string[]; b: string[] }
}
export type StudyQuestion = {
  id: string
  question: string
  answer: string
  kind: string
  skill?: string
  difficulty?: string
  objective?: string
  hint?: string
  sourceIds: string[]
}
export type StudyChapter = {
  id: string
  title: string
  review: string
  formatVersion?: 2
  learningGoals?: string[]
  sections: (GroundedText & { title: string; takeaway?: string; detail?: string | null; visual?: StudyVisualSpec | null; callouts?: { kind: 'definition' | 'rule' | 'formula' | 'pitfall'; title: string; text: string; sourceIds: string[] }[] })[]
  summary: GroundedText[]
  questions: StudyQuestion[]
  flashcards: { kind?: string; id: string; front: string; back: string; sourceIds: string[] }[]
  walkthrough: { title: string; steps: GroundedText[] } | null
  caveats: string[]
}
export type StudyEdit = { kind: string; label: string; topicId?: string; feedback?: string; baseRevisionId: string }
export type StudyRevision = {
  edit?: StudyEdit
  id: string
  versionId: string
  course: StudyCourseIdentity
  createdAt?: string
  chapters: StudyChapter[]
  topics: { id: string; title: string; sourceIds: string[] }[]
  snapshot: {
    sources: StudySource[]
    chunks: Evidence[]
    capturedAt: string
    excluded: { title: string; reason: string }[]
  }
  gaps: string[]
  issues: { topicId: string; detail: string; severity: string }[]
  review: string
}
export type StudyVersion = {
  billing?: { source: string; model: string; maxJobUsd: number; unlimited?: boolean } | null
  id: string
  title: string
  course: StudyCourseIdentity
  activeRevisionId: string | null
  createdAt: string
  updatedAt: string
  history: { id: string; createdAt: string; chapters: number; reused: number; edit?: StudyEdit }[]
  draft: {
    id: string
    status: string
    stage: string
    error?: string
    runAfter?: number
    chapters: number
    total: number
    mapped: number
    batches: number
    issues: { topicId: string; detail: string; severity: string }[]
    excluded: { title: string; reason: string }[]
  } | null
}
export type StudyProgress = {
  topicId: string
  revisionId: string
  read?: boolean
  note?: string
  attempts?: {
    id: string
    question: StudyQuestion
    answer: string
    revisionId: string
    createdAt: string
  }[]
}
export type StudyVersionPayload = {
  version: StudyVersion
  revision: StudyRevision | null
  proposal?: StudyRevision | null
  partial: StudyRevision | null
  progress: StudyProgress[]
  sourceKeys: string[]
  freshness: {
    added: string[]
    changed: string[]
    removed: string[]
    newSources: string[]
  }
}
export type StudyPublication = {
  id: string
  title: string
  course: StudyCourseIdentity
  attribution: string
  createdAt: string
  audience: string
  chapters?: number
  content?: StudyRevision
  owned?: boolean
}
export async function studyRequest<T>(
  url: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST'
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const result = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(
      (typeof result?.error === 'string'
        ? result.error
        : result?.error?.message) ||
        `Study service is unavailable (HTTP ${response.status}). Please try again.`
    )
  return result
}
export function generationLabel(draft: StudyVersion['draft']) {
  if (!draft) return ''
  if (draft.status === 'complete') return 'Revision ready'
  if (draft.status === 'failed') return 'Generation needs attention'
  if (draft.status === 'stopped') return 'Generation paused'
  if (draft.stage === 'mapping')
    return `Reading sources · ${draft.mapped} of ${draft.batches} batches`
  if (draft.stage === 'outline') return 'Organizing chapters'
  if (draft.stage === 'review')
    return `Checking evidence · ${draft.chapters} of ${draft.total} chapters ready`
  if (draft.stage === 'finish') return 'Saving your revision'
  return `Writing chapters · ${draft.chapters} of ${draft.total} ready`
}
export type StudyBudget = {
  unlimited?: boolean
  exemptionReason?: string | null
  limits: {
    chaptersDay: number
    chaptersMonth: number
    userDayUsd: number
    userMonthUsd: number
    maxJobUsd: number; unlimited?: boolean
  }
  platform: {
    provider?: string
    configured: boolean
    model: string
    spentTodayUsd: number
    spentMonthUsd: number
    chaptersToday: number
    chaptersMonth: number
  }
  personal: {
    connected: boolean
    storageConfigured: boolean
    model: string
    provider: string
    monthlyLimitUsd: number
    spentMonthUsd: number
    models: Record<string, { provider: string; label: string }>
  }
}
export type StudyEstimate = {
  chapterRange: number[]
  estimatedUsd: number[]
  maxJobUsd: number; unlimited?: boolean
  billingSource: string
  model: string
  explanation: string
}
