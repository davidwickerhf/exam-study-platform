'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { createResourceCache } from '@/lib/workspace/resource-cache.mjs'

export const workspaceCache = createResourceCache()
export async function cachedWorkspaceJson<T>(key: string, force = false): Promise<T> {
  const value = await workspaceCache.load(key, { force })
  if (workspaceCache.read(key).error) throw workspaceCache.read(key).error
  return value as T
}
export const mutate = (key: string) => workspaceCache.load(key, { force: true })
export const forget = (key?: string) => workspaceCache.invalidate(key, { discard: true })

export type WorkspaceData<T> = {
  data: T | undefined
  error: Error | null
  loading: boolean
  refresh: () => void
}

/** Reuse fresh reads for 30 seconds; keep known data visible during revalidation. */
export function useWorkspaceData<T>(key: string | null): WorkspaceData<T> {
  const subscribe = useCallback((notify: () => void) => key ? workspaceCache.subscribe(key, notify) : () => {}, [key])
  const read = useCallback(() => key ? workspaceCache.read(key) : workspaceCache.empty, [key])
  const entry = useSyncExternalStore(subscribe, read, () => workspaceCache.empty)
  useEffect(() => { if (key) void workspaceCache.load(key) }, [key, entry.version])
  const refresh = useCallback(() => { if (key) { workspaceCache.invalidate(key); void workspaceCache.load(key, { force: true }) } }, [key])
  return { data: entry.data as T | undefined, error: entry.error, loading: !!key && entry.data === undefined && entry.error === null, refresh }
}
