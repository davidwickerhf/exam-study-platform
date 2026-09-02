/**
 * Types for lib/v2/setup.mjs.
 *
 * The implementation is plain ESM with these declarations beside it so that
 * test/v2-setup.test.mjs imports the same module app/v2/setup/page.tsx does —
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
}

export type SetupSourceState = {
  programme: boolean
  programmeName: string | null
  courseCount: number
  record: boolean
  recordSummary: RecordSummary | null
  calendar: boolean
  calendarDates: number
  timetable: boolean
  timetableEvents: number
  canvas: boolean
  electives: boolean
  electivesPending: number
  electivesChosen: number
}

export type SetupStepId = 'programme' | 'electives' | 'record' | 'calendar' | 'timetable' | 'canvas'

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
