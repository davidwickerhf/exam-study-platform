export const CANVAS_QUEUE_TOPIC: string
export function signCanvasTask(body: string, timestamp?: string, key?: string): string
export function verifyCanvasTask(body: string, signature: string | null, options?: { now?: number; key?: string }): boolean
