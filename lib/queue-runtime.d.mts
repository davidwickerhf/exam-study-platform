type Environment = Record<string, string | undefined>
export function previewWorkerUsers(env?: Environment): string[]
export function queueWorkersEnabled(env?: Environment): boolean
export function queueWorkerAllowsUser(userId: string, env?: Environment): boolean
export function queueDispatcherOrigin(env?: Environment): string
export function queueRequestHeaders(env?: Environment): Record<string, string>
