/**
 * Types for lib/app/setup.mjs.
 *
 * The implementation is plain ESM with these declarations beside it so that
 * test/app-setup.test.mjs imports the same module app/app/setup/page.tsx does —
 * this project's TypeScript is the native 7.x build, which has no
 * transpileModule, and a hand-maintained second copy is how rules drift.
 */

/** The shape of the `state` block on `GET /api/onboarding`, from `setupState()`. */
export type RecordSummary = {
  earnedEcts: number
  passedCourses: number
  failedAttempts?: number
  currentCourses?: number
  weightedAverage: number | null
  programme?: string | null
}

export type SetupIssue = {
  id: string
  step: string
  relatedStep?: string
  severity: 'warning' | 'error'
  title: string
  detail: string
  recovery: string
  unexpectedCourses?: { code: string; name: string; status: string }[]
  expectedCourses?: { code: string; name: string }[]
}

export type CurriculumPlacement = {
  versionId: string
  code: string
  yearLevel: string
  period: string
  source: 'catalogue' | 'academic-record'
}

export type CurriculumReconciliation = {
  selectedVersionId: string
  currentCount: number
  recognizedCount: number
  outsideCount: number
  otherYearCount: number
  historicalCount: number
  changes: {
    id: string
    name: string
    currentCode: string
    kind: 'placement' | 'code-and-placement'
    placements: CurriculumPlacement[]
  }[]
}

export type SetupSourceState = {
  programme: boolean
  programmeName: string | null
  programmeTemplate?: { programmeId: string; versionId: string; currentStudyYear: string } | null
  customProgramme?: boolean
  courseCount: number
  record: boolean
  recordSummary: RecordSummary | null
  transcript: boolean
  transcriptAttempts: number
  calendar: boolean
  calendarDates: number
  timetable: boolean
  timetableEvents: number
  canvas: boolean
  electives: boolean
  electivesPending: number
  electivesChosen: number
  curriculumReconciliation?: CurriculumReconciliation
  issues?: SetupIssue[]
}

export type SetupStepId = 'programme' | 'electives' | 'record' | 'transcript' | 'calendar' | 'timetable' | 'canvas'

export type SetupStepStatus = 'done' | 'skipped' | 'blocked' | 'todo'

export type SetupStepSpec = {
  id: SetupStepId
  title: string
  required: boolean
  blurb: string
  action: string
  href: string
}

export type SetupStep = SetupStepSpec & {
  status: SetupStepStatus
  done: boolean
  detail: string
}

export type PdfTextItem = { text: string; x: number; y: number; width?: number }

export declare const SETUP_STEPS: readonly SetupStepSpec[]
export declare function stepStatus(id: string, state: SetupSourceState | null, skipped?: string[]): SetupStepStatus
export declare function stepDetail(id: string, state: SetupSourceState | null, status?: SetupStepStatus): string
export declare function setupSteps(view?: { state?: SetupSourceState | null; skipped?: string[] }): SetupStep[]
export declare function connectedCount(steps: SetupStep[]): number
export declare function outstandingSteps(steps: SetupStep[]): SetupStep[]
export declare function nextStep(steps: SetupStep[]): SetupStep | null
export declare function isComplete(steps: SetupStep[]): boolean
export declare function eventLine(content: string): string
export declare function pdfPageText(items: PdfTextItem[], options?: { rowTolerance?: number; columnGap?: number }): string
