'use client'

/**
 * The workspace's read layer, in one small module.
 *
 * Every signed-in page used to fetch its JSON in a `useEffect` and hold it in
 * `useState`, so leaving Home and coming back re-fetched five endpoints and
 * showed skeletons for a screen the student had already been looking at. This
 * keeps one module-level cache keyed by URL and behaves the way that problem
 * is normally solved: render whatever is cached at once, revalidate behind it,
 * and never run the same request twice at the same time.
 *
 * Deliberately not a dependency. It is roughly a hundred lines, the project
 * has no data-fetching library, and adding one to fix a navigation stutter
 * would be the larger change.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'

type Entry = {
  data?: unknown
  error: Error | null
  fetchedAt: number
  /** The in-flight request, so concurrent readers share one round trip. */
  pending: Promise<unknown> | null
}

const EMPTY: Entry = { error: null, fetchedAt: 0, pending: null }

const cache = new Map<string, Entry>()
const watchers = new Map<string, Set<() => void>>()

function publish(key: string, entry: Entry) {
  cache.set(key, entry)
  for (const notify of watchers.get(key) ?? []) notify()
}

function load(key: string): Promise<unknown> {
  const current = cache.get(key)
  if (current?.pending) return current.pending
  const pending = fetch(key, { headers: { accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`${key} returned ${response.status}`)
      return response.json()
    })
    .then((data: unknown) => {
      publish(key, { data, error: null, fetchedAt: Date.now(), pending: null })
      return data
    })
    .catch((cause: unknown) => {
      // A failed revalidation must not blank a screen that already has an
      // answer, so the previous reading stays and the failure is reported
      // beside it.
      publish(key, {
        data: cache.get(key)?.data,
        error: cause instanceof Error ? cause : new Error(String(cause)),
        fetchedAt: Date.now(),
        pending: null
      })
      return undefined
    })
  publish(key, { ...(current ?? EMPTY), pending })
  return pending
}

/** Re-read one key now. Callers that just wrote to it use this. */
export function mutate(key: string): Promise<unknown> {
  return load(key)
}

/** Drop a cached reading without fetching — used when an account is reset. */
export function forget(key?: string) {
  if (key === undefined) cache.clear()
  else cache.delete(key)
  for (const [watched, listeners] of watchers) {
    if (key === undefined || watched === key) for (const notify of listeners) notify()
  }
}

export type WorkspaceData<T> = {
  data: T | undefined
  error: Error | null
  /** True only before anything at all is known: a revalidation is not a load. */
  loading: boolean
  refresh: () => void
}

/**
 * Read one JSON endpoint. `key` is the URL; pass `null` to hold off entirely.
 */
export function useWorkspaceData<T>(key: string | null): WorkspaceData<T> {
  const subscribe = useCallback((notify: () => void) => {
    if (!key) return () => {}
    const listeners = watchers.get(key) ?? new Set<() => void>()
    watchers.set(key, listeners)
    listeners.add(notify)
    return () => {
      listeners.delete(notify)
      if (!listeners.size) watchers.delete(key)
    }
  }, [key])

  const read = useCallback(() => (key ? cache.get(key) ?? EMPTY : EMPTY), [key])
  const entry = useSyncExternalStore(subscribe, read, () => EMPTY)

  useEffect(() => {
    if (key) void load(key)
  }, [key])

  const refresh = useCallback(() => {
    if (key) void load(key)
  }, [key])

  return {
    data: entry.data as T | undefined,
    error: entry.error,
    loading: entry.data === undefined && entry.error === null,
    refresh
  }
}
