export type StepResult = { again?: boolean; delay?: number; ids?: string[]; disabled?: boolean; ok?: boolean }
export function callCanvasService(payload: Record<string, unknown>): Promise<StepResult>
export function sendCanvasStep(jobId: string, delaySeconds?: number): Promise<void>
export function dispatchCanvasSteps(): Promise<{ disabled?: boolean; sent: number; studySent?: number; studyDeferred?: boolean }>
export function runDispatchSweep(): Promise<{ ok: boolean; error?: string; feedback: 'processed' | 'deferred'; [key: string]: unknown }>
export function sendCanvasProbe(): Promise<{ probe: string }>
export function wakeCurrentCanvasDispatcher(): Promise<void>
