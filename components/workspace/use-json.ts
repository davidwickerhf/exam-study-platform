'use client'

/**
 * The one way a migrated page reads the API.
 *
 * `app/app/layout.tsx` has already attached the Clerk bearer token to
 * same-origin /api/* requests, so this is plain `fetch` with two additions
 * every surface needs: the server's own error message is surfaced rather than
 * a status code, and a component that unmounts mid-flight does not set state.
 */

import { useCallback, useEffect, useState } from 'react'

export async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers
    }
  })
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    // The API answers with { error } almost everywhere; say what it said.
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `${path} returned ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export type Resource<T> = { data: T | null; error: string | null; reload: () => void }

/** Reads `path` once, and again whenever `reload()` is called. */
export function useJson<T>(path: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (!path) return
    let live = true
    setError(null)
    readJson<T>(path)
      .then((payload) => {
        if (live) setData(payload)
      })
      .catch((cause: Error) => {
        if (live) setError(cause.message)
      })
    return () => {
      live = false
    }
  }, [path, nonce])

  return { data, error, reload }
}
