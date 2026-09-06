'use client'

import { cachedWorkspaceJson } from '@/hooks/use-workspace-data'
import { useCallback, useEffect, useRef, useState } from 'react'
import { canvasShellKey, type CanvasShell } from '@/lib/workspace/course-editions.mjs'
import type { CorpusCourse } from '@/lib/workspace/course-ledger.mjs'
import type { CorpusJob } from '@/lib/workspace/account.mjs'

type Connection = { origin: string; corpus?: { collectionEnabled: boolean } }
type Status = { courses?: CorpusCourse[]; jobs?: CorpusJob[]; latestJobs?: CorpusJob[] }
async function json(path: string, init?: RequestInit, force = false) {
  if (!init?.method || init.method === 'GET') return cachedWorkspaceJson<any>(path, force)
  const response = await fetch(path, { ...init, headers: { accept: 'application/json', 'content-type': 'application/json' }, signal: AbortSignal.timeout(45_000) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Canvas could not be reached. Try again.')
  return body
}

export function useCourseCanvas() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [catalogue, setCatalogue] = useState<CanvasShell[]>([])
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [queued, setQueued] = useState<string[]>([])
  const [revision, setRevision] = useState(0)
  const mounted = useRef(false)
  const loadingRef = useRef(false)
  const refreshing = useRef(false)
  const collecting = useRef(false)
  const refreshStatus = useCallback(async (force = false) => {
    if (refreshing.current) return
    refreshing.current = true
    try {
      const body = await cachedWorkspaceJson<any>('/api/account/integrations/canvas/corpus?view=summary', force)
      if (mounted.current) { setStatus(body.status); setQueued([]); setRevision(value => value + 1) }
    } finally { refreshing.current = false }
  }, [])
  const refresh = useCallback(async (force = true) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true); setError(null)
    try {
      const [connectionResult, statusResult] = await Promise.allSettled([json('/api/account/integrations/canvas', undefined, force), refreshStatus(force)])
      if (!mounted.current) return
      if (connectionResult.status === 'rejected') throw connectionResult.reason
      const body = connectionResult.value
      if (statusResult.status === 'rejected') setError('Collection status could not be loaded. Check available editions to retry.')
      setConnections(body.connections || [])
      const results = await Promise.allSettled((body.connections || []).map(async (connection: Connection) => {
        const data = await json(`/api/integrations/canvas/courses?canvasUrl=${encodeURIComponent(connection.origin)}`, undefined, force)
        return (data.courses || []).map((course: CanvasShell) => ({ ...course, origin: connection.origin }))
      }))
      if (!mounted.current) return
      setCatalogue(results.flatMap(result => result.status === 'fulfilled' ? result.value as CanvasShell[] : []))
      const failed = results.find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') setError(`Some Canvas editions could not be loaded. ${failed.reason.message}`)
    } catch (cause) { if (mounted.current) setError((cause as Error).message) }
    finally { loadingRef.current = false; if (mounted.current) setLoading(false) }
  }, [refreshStatus])
  useEffect(() => { mounted.current = true; void refresh(false); return () => { mounted.current = false } }, [refresh])
  const active = queued.length > 0 || (status?.latestJobs || status?.jobs || []).some(job => ['pending', 'running'].includes(job.status))
  useEffect(() => {
    if (!active) return
    const poll = () => { if (!document.hidden) void refreshStatus(true).catch(() => setActionError('Collection status could not be refreshed. Check again below.')) }
    const timer = setInterval(poll, 10_000)
    document.addEventListener('visibilitychange', poll)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', poll) }
  }, [active, refreshStatus])

  const collect = async (shells: CanvasShell[]) => {
    if (collecting.current || !shells.length) return
    collecting.current = true; setBusy(true); setActionError(null); setNotice(null)
    let accepted = 0
    const failures: string[] = []
    for (const shell of shells) {
      try {
        const result = await json('/api/integrations/canvas/corpus/course', { method: 'POST', body: JSON.stringify({ canvasUrl: shell.origin, canvasCourseId: shell.id, force: true }) })
        if (!result.observed || result.mode === 'local') throw new Error('This edition could not be queued in this workspace.')
        accepted++
        if (mounted.current) setQueued(current => [...new Set([...current, canvasShellKey(shell)])])
      } catch (cause) { failures.push(`${shell.academicYear || 'Undated'}: ${(cause as Error).message}`) }
    }
    if (mounted.current) {
      if (accepted) setNotice(`Collection requested for ${accepted} Canvas ${accepted === 1 ? 'edition' : 'editions'}. Material will appear as it is collected.`)
      if (failures.length) setActionError(failures.join(' '))
      try { await refreshStatus(true) } catch { setActionError(current => [current, 'Collection status could not be refreshed. Check again below.'].filter(Boolean).join(' ')) }
      setBusy(false)
    }
    collecting.current = false
  }
  return { connections, catalogue, status, loading, error, actionError, notice, busy, queued, revision, refresh, collect }
}
