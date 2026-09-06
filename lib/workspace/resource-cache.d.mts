export type ResourceEntry = { data?: unknown; error: Error | null; fetchedAt: number; pending: Promise<unknown> | null; version: number }
export function createResourceCache(options?: { fetchImpl?: typeof fetch; now?: () => number; maxAge?: number }): {
  empty: ResourceEntry
  read: (key: string) => ResourceEntry
  subscribe: (key: string, notify: () => void) => () => void
  load: (key: string, options?: { force?: boolean; requestUrl?: string }) => Promise<unknown>
  invalidate: (key?: string | null | ((key: string) => boolean), options?: { discard?: boolean }) => void
  setScope: (scope: string | null) => void
}
export function workspaceWriteAffectsReads(path: string, method: string): boolean

export function workspaceInvalidationTargets(path: string): ((key: string) => boolean) | null
