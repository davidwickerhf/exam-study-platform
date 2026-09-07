export const CANVAS_QUEUE_TOPIC: string
export const STUDY_QUEUE_TOPIC: string
export function queueTopicForJob(jobId: string): string
export function signCanvasTask(body: string, timestamp?: string, key?: string): string
export function verifyCanvasTask(body: string, signature: string | null, options?: { now?: number; key?: string }): boolean
