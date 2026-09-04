export type PlannerAttempt = { status: 'upcoming' | 'passed' | 'failed' | 'no-show'; type?: string; examDate?: string | null; grade?: number | null; academicYear?: string; period?: string | null }
export type PlannerCourse = { id: string; code: string; name: string; ects: number; yearLevel?: string | null; period?: string | null; passMark?: number; hiddenFromStats?: boolean; attempts: PlannerAttempt[]; courseProfile?: { assessment?: { status?: string; resitRules?: Array<string | { text?: string }> } } }
export type PlannerGate = { id: string; label: string; type: 'course' | 'credit-level' | 'all-level' | 'total-credits'; courseId?: string | null; level?: string | null; target: number }
export type Objective = { mode: 'current' | 'resit' | 'none'; outcome: 'actual' | 'pass' | 'fail'; expectedGrade?: number; targetSession?: string }
export type PlannerAcademicPeriod = { id: string; title: string; date: string; endDate?: string | null; kind?: string; period?: number | null; semester?: number | null; resit?: boolean; academicYear?: string }
export type PlanningSession = { id: string; label: string; academicYear: string | null; period: number | null; semester?: number | null; startsAt: string | null; endsAt: string | null; kind: string; resit: boolean }
export type PlannerWorkspace = {
  revision: number
  courses: PlannerCourse[]
  gates: PlannerGate[]
  profile?: { programme?: string; academicYear?: string; currentYearKey?: string }
  programmeTemplate?: { currentStudyYear?: string } | null
  planning: { objectives: Record<string, Objective>; periodAssignments?: unknown[]; academicPeriods?: PlannerAcademicPeriod[] }
  events?: { id: string; title: string; date?: string | null; endDate?: string | null; type?: string }[]
  [key: string]: unknown
}
export type Priority = { course: PlannerCourse; days: number | null; score: number; risk: 'critical' | 'high' | 'medium' | 'low' }

export declare const DEFAULT_OBJECTIVE: Readonly<Objective>
export declare function objectiveFor(workspace: PlannerWorkspace, courseId: string): Objective
export declare function isPassed(course?: PlannerCourse): boolean
export declare function gateResolved(gate: PlannerGate, workspace: PlannerWorkspace, projected?: boolean): boolean
export declare function plannerSummary(workspace: PlannerWorkspace): { projectedCredits: number; totalCredits: number; earnedCredits: number; openCourses: PlannerCourse[]; plannedCount: number; projectedGates: number }
export declare function groupOpenCourses(courses: PlannerCourse[]): { level: string; ects: number; courses: PlannerCourse[] }[]
export declare function planningInsights(workspace: PlannerWorkspace, options?: { today?: Date }): { priority: Priority[]; periods: { period: string; ects: number; count: number }[]; minimumPaths: { gate: PlannerGate; gap: number; courses: PlannerCourse[] }[] }
export declare function withObjective(workspace: PlannerWorkspace, courseId: string, patch: Partial<Objective>): PlannerWorkspace
export declare function planningSessions(workspace: PlannerWorkspace): PlanningSession[]
export declare function planningDestinations(workspace: PlannerWorkspace, courseId: string): { courseId: string; courseCode: string; teachingPeriod: string | null; evidenceSource: string; period: number | null; semester: number | null; resitRules: Array<string | { text?: string }>; allowedSessionIds: string[]; destinations: Array<PlanningSession & { allowed: boolean; reason: string | null }> }
export declare function planningContext(workspace: PlannerWorkspace): Record<string, unknown>
export declare function updatePlanningObjective(workspace: PlannerWorkspace, courseId: string, patch?: Partial<Objective> & { expectedGrade?: number | null; targetSession?: string | null }): { workspace: PlannerWorkspace; course: PlannerCourse; before: Objective; after: Objective }
export declare function resetObjectives(workspace: PlannerWorkspace): PlannerWorkspace
