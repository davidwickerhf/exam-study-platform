'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './canvas-archive.module.css'

const DEFAULT_CANVAS = 'https://canvas.maastrichtuniversity.nl'
const LOCAL_AGENT = 'http://127.0.0.1:41917'

type Connection = { origin: string; configured: true; createdAt: string; updatedAt: string; lastUsedAt: string | null }
type Course = { id: string; name: string; courseCode: string | null; workflowState: string | null; term: { name: string | null } | null; courseUrl: string }
type Module = { id: string; name: string; position: number; items: Array<{ id: string; title: string; type: string }> }
type LocalStatus = { ok: boolean; tokenAvailable: boolean }
type ExportJob = { id: string; status: 'running' | 'ready' | 'failed'; error: string | null; result: { course: { name: string; code: string }; modules: number; resources: number; bytes: number; fileName: string } | null; downloadUrl: string | null }
type Notice = { kind: 'error' | 'success' | 'info'; text: string } | null

function originFor(value: string) {
  try { return new URL(value).origin } catch { return DEFAULT_CANVAS }
}

function compactTerm(course: Course) {
  return course.term?.name || course.workflowState || 'Canvas course'
}

function bytes(value: number) {
  if (!Number.isFinite(value) || value < 1) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

function Icon({ name }: { name: 'archive' | 'check' | 'arrow' | 'lock' | 'refresh' | 'folder' }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  return <svg {...common}>{name === 'archive' && <><path d="M4 7.5h16v12H4z" /><path d="M3 4h18v3.5H3zM9 12h6" /></>}{name === 'check' && <path d="m5 12 4 4L19 6" />}{name === 'arrow' && <path d="M5 12h14m-5-5 5 5-5 5" />}{name === 'lock' && <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>}{name === 'refresh' && <><path d="M20 11a8 8 0 0 0-14.8-4M4 5v4h4" /><path d="M4 13a8 8 0 0 0 14.8 4M20 19v-4h-4" /></>}{name === 'folder' && <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />}</svg>
}

export function CanvasArchive() {
  const [canvasUrl, setCanvasUrl] = useState(DEFAULT_CANVAS)
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionLoading, setConnectionLoading] = useState(true)
  const [local, setLocal] = useState<LocalStatus | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [query, setQuery] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('course') || '')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [modulesLoading, setModulesLoading] = useState(false)
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set())
  const [job, setJob] = useState<ExportJob | null>(null)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const canvasOrigin = originFor(canvasUrl)
  const remoteConnection = connections.find((connection) => connection.origin === canvasOrigin) || null
  const usingRemoteCatalog = Boolean(remoteConnection)

  // /app is still a compatibility surface that locks the document viewport.
  // A direct route transition must release that lock so this independent page
  // uses ordinary document scrolling on every browser.
  useEffect(() => {
    document.documentElement.classList.remove('app-mode')
    document.body.classList.remove('app-mode')
  }, [])

  const refreshConnections = useCallback(async () => {
    setConnectionLoading(true)
    try {
      const response = await fetch('/api/account/integrations/canvas', { cache: 'no-store' })
      if (response.status === 401) { setNotice({ kind: 'info', text: 'Sign in to save a Canvas connection to your Wicker Study account.' }); setConnections([]); return }
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not check Canvas settings.')
      setConnections(Array.isArray(payload.connections) ? payload.connections : [])
    } catch (error) {
      setNotice({ kind: 'info', text: error instanceof Error ? error.message : 'Canvas settings are unavailable right now.' })
    } finally {
      setConnectionLoading(false)
    }
  }, [])

  const refreshLocal = useCallback(async () => {
    try {
      const response = await fetch(`${LOCAL_AGENT}/v1/status?canvasUrl=${encodeURIComponent(canvasOrigin)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const payload = await response.json() as LocalStatus
      setLocal(payload)
    } catch {
      setLocal(null)
    }
  }, [canvasOrigin])

  const loadCourses = useCallback(async () => {
    if (!usingRemoteCatalog && !local?.tokenAvailable) return
    setCoursesLoading(true)
    setNotice(null)
    setSelectedCourse(null)
    setModules([])
    try {
      const endpoint = usingRemoteCatalog
        ? `/api/integrations/canvas/courses?canvasUrl=${encodeURIComponent(canvasOrigin)}`
        : `${LOCAL_AGENT}/v1/canvas/courses?canvasUrl=${encodeURIComponent(canvasOrigin)}`
      const response = await fetch(endpoint, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Canvas course list could not be read.')
      setCourses(Array.isArray(payload.courses) ? payload.courses : [])
    } catch (error) {
      setCourses([])
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Canvas course list could not be read.' })
    } finally {
      setCoursesLoading(false)
    }
  }, [canvasOrigin, local?.tokenAvailable, usingRemoteCatalog])

  useEffect(() => { void refreshConnections() }, [refreshConnections])
  useEffect(() => { void refreshLocal() }, [refreshLocal])
  useEffect(() => { if (usingRemoteCatalog || local?.tokenAvailable) void loadCourses() }, [loadCourses, local?.tokenAvailable, usingRemoteCatalog])

  const visibleCourses = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return courses
    return courses.filter((course) => [course.name, course.courseCode, course.term?.name].filter(Boolean).join(' ').toLocaleLowerCase().includes(term))
  }, [courses, query])

  async function chooseCourse(course: Course) {
    setSelectedCourse(course)
    setModules([])
    setSelectedModules(new Set())
    setJob(null)
    setModulesLoading(true)
    setNotice(null)
    try {
      const endpoint = usingRemoteCatalog
        ? `/api/integrations/canvas/courses/${encodeURIComponent(course.id)}/modules?canvasUrl=${encodeURIComponent(canvasOrigin)}`
        : `${LOCAL_AGENT}/v1/canvas/courses/${encodeURIComponent(course.id)}/modules?canvasUrl=${encodeURIComponent(canvasOrigin)}`
      const response = await fetch(endpoint, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not read this course’s modules.')
      const next = Array.isArray(payload.modules) ? payload.modules : []
      setModules(next)
      setSelectedModules(new Set(next.map((module: Module) => module.id)))
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not read this course’s modules.' })
    } finally {
      setModulesLoading(false)
    }
  }

  function toggleModule(id: string) {
    setSelectedModules((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function saveCopiedTokenLocally() {
    if (!local) return
    try {
      const response = await fetch(`${LOCAL_AGENT}/v1/canvas/token/from-clipboard`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ canvasUrl: canvasOrigin })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Wicker Local could not save the copied token.')
      setNotice({ kind: 'success', text: 'Wicker Local is ready to create ZIPs directly on this Mac.' })
      await refreshLocal()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Wicker Local could not save the copied token.' })
    }
  }

  async function createZip() {
    if (!selectedCourse || !local?.tokenAvailable || !selectedModules.size) return
    setExporting(true)
    setNotice(null)
    setJob(null)
    try {
      const allSelected = selectedModules.size === modules.length
      const response = await fetch(`${LOCAL_AGENT}/v1/exports`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ canvasUrl: canvasOrigin, courseId: selectedCourse.id, ...(allSelected ? {} : { moduleIds: [...selectedModules] }) })
      })
      const payload = await response.json() as ExportJob
      if (!response.ok) throw new Error((payload as ExportJob & { error?: string }).error || 'Could not start the local archive.')
      setJob(payload)
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not start the local archive.' })
      setExporting(false)
    }
  }

  useEffect(() => {
    if (!job || job.status !== 'running') return
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${LOCAL_AGENT}/v1/exports/${encodeURIComponent(job.id)}`, { cache: 'no-store' })
        const payload = await response.json() as ExportJob
        if (!response.ok) throw new Error(payload.error || 'The local archive is no longer available.')
        setJob(payload)
        if (payload.status !== 'running') setExporting(false)
      } catch (error) {
        setJob((current) => current ? { ...current, status: 'failed', error: error instanceof Error ? error.message : 'Archive status could not be read.' } : current)
        setExporting(false)
      }
    }, 1_250)
    return () => window.clearInterval(timer)
  }, [job])

  const selectionLabel = selectedModules.size === modules.length ? 'Entire course' : `${selectedModules.size} of ${modules.length} modules`

  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/app" className={styles.back}>Workspace</a>
      <div className={styles.brand}><img className={styles.brandMark} src="/brand-mark.svg" width="23" height="23" alt="" /><span>Wicker Study</span></div>
      <span className={styles.headerMeta}>Private Canvas archive</span>
    </header>

    <section className={styles.intro}>
      <p className={styles.kicker}>Personal source collection</p>
      <h1>Archive Canvas material without losing its structure.</h1>
      <p>Choose a current or prior course, select the modules you need, and create a private ZIP on this device. Wicker follows Canvas pages within the course, saves accessible linked files, and keeps a reviewable index of every URL.</p>
    </section>

    {notice && <p className={`${styles.notice} ${styles[`notice${notice.kind[0].toUpperCase()}${notice.kind.slice(1)}`]}`} role="status">{notice.text}</p>}

    <div className={styles.layout}>
      <section className={styles.connection} aria-labelledby="canvas-connection-title">
        <div className={styles.sectionHeading}><span className={styles.iconBox}><Icon name="lock" /></span><div><p className={styles.eyebrow}>1. Connection</p><h2 id="canvas-connection-title">Your Canvas account</h2></div></div>
        <label className={styles.field}><span>Canvas address</span><input value={canvasUrl} onChange={(event) => setCanvasUrl(event.target.value)} inputMode="url" autoComplete="url" /></label>
        {connectionLoading ? <p className={styles.muted}>Checking your saved connection…</p> : remoteConnection ? <div className={styles.connectionState}><span className={styles.stateOk}><Icon name="check" /></span><div><strong>Connected to this Wicker account</strong><p>Encrypted at rest · last used {remoteConnection.lastUsedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(remoteConnection.lastUsedAt)) : 'not yet'}.</p><a className={styles.settingsLink} href="/app#/account/connections">Manage Canvas connection</a></div></div> : <div className={styles.connectionState}><span className={styles.statePending}>1</span><div><strong>Connect Canvas in Account settings</strong><p>Your Personal Access Token is managed once under your account, encrypted immediately, and never displayed again. This archive never asks for your password, OTP, cookies, or session.</p><a className={styles.settingsLink} href="/app#/account/connections">Open Canvas settings</a></div></div>}
      </section>

      <aside className={styles.local} aria-label="Local ZIP delivery">
        <div className={styles.sectionHeading}><span className={styles.iconBox}><Icon name="folder" /></span><div><p className={styles.eyebrow}>Device delivery</p><h2>Wicker Local</h2></div></div>
        {local ? <div className={styles.connectionState}><span className={local.tokenAvailable ? styles.stateOk : styles.statePending}>{local.tokenAvailable ? <Icon name="check" /> : '…'}</span><div><strong>{local.tokenAvailable ? 'Ready on this Mac' : 'Running, but needs Canvas access'}</strong><p>{local.tokenAvailable ? 'ZIPs are created locally and downloaded straight to this browser.' : 'Copy a Canvas token, then save it in your Mac Keychain.'}</p></div></div> : <div className={styles.connectionState}><span className={styles.statePending}>…</span><div><strong>Not running on this Mac</strong><p>Start Wicker Local to create direct device ZIPs. Your course bytes do not pass through Wicker Study.</p></div></div>}
        {local && !local.tokenAvailable && <button type="button" className={styles.secondaryButton} onClick={saveCopiedTokenLocally}>Use copied Canvas token</button>}
        {!local && <code className={styles.command}>npm run canvas:agent</code>}
      </aside>
    </div>

    <section className={styles.catalogue} aria-labelledby="course-catalogue-title">
      <div className={styles.catalogueHead}><div><p className={styles.eyebrow}>2. Choose material</p><h2 id="course-catalogue-title">Course catalogue</h2><p>{usingRemoteCatalog ? 'Showing every current and concluded course attached to your encrypted Canvas connection.' : local?.tokenAvailable ? 'Showing courses available through Wicker Local.' : 'Connect Canvas or start Wicker Local to load your course catalogue.'}</p></div><button type="button" className={styles.refreshButton} onClick={() => void loadCourses()} disabled={coursesLoading || (!usingRemoteCatalog && !local?.tokenAvailable)}><Icon name="refresh" /> Refresh</button></div>
      <label className={styles.search}><span className="sr-only">Search Canvas courses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a course, code, or year" type="search" /></label>
      <div className={styles.courseList} aria-busy={coursesLoading}>
        {coursesLoading && <p className={styles.placeholder}>Reading your Canvas course history…</p>}
        {!coursesLoading && !visibleCourses.length && <p className={styles.placeholder}>{courses.length ? 'No course matches that search.' : 'No courses are loaded yet.'}</p>}
        {!coursesLoading && visibleCourses.map((course) => <button key={course.id} type="button" className={`${styles.courseRow} ${selectedCourse?.id === course.id ? styles.courseSelected : ''}`} onClick={() => void chooseCourse(course)}><span className={styles.courseLead}><strong>{course.courseCode || 'Canvas course'}</strong><span>{course.name}</span></span><span className={styles.courseTerm}>{compactTerm(course)}</span><Icon name="arrow" /></button>)}
      </div>
    </section>

    {selectedCourse && <section className={styles.modules} aria-labelledby="module-selection-title">
      <div className={styles.modulesHead}><div><p className={styles.eyebrow}>3. Select scope</p><h2 id="module-selection-title">{selectedCourse.name}</h2><p>{modulesLoading ? 'Reading module contents…' : `${selectionLabel} selected. Sub-pages and Canvas file links are followed recursively within this course.`}</p></div><button type="button" className={styles.textButton} onClick={() => setSelectedModules(new Set(modules.map((module) => module.id)))} disabled={modulesLoading || selectedModules.size === modules.length}>Select all</button></div>
      {!modulesLoading && <div className={styles.moduleList}>{modules.map((module) => <label key={module.id} className={styles.moduleRow}><input type="checkbox" checked={selectedModules.has(module.id)} onChange={() => toggleModule(module.id)} /><span><strong>{String(module.position || 0).padStart(2, '0')} · {module.name}</strong><small>{module.items.length} Canvas item{module.items.length === 1 ? '' : 's'}</small></span></label>)}</div>}
      {!modulesLoading && !modules.length && <p className={styles.placeholder}>Canvas did not return modules for this course.</p>}
      <footer className={styles.exportBar}><div><strong>{selectionLabel}</strong><p>Personal archive only. Downloading does not submit or publish course materials.</p></div>{local?.tokenAvailable ? <button type="button" className={styles.primaryButton} disabled={!selectedModules.size || exporting || Boolean(job && job.status === 'running')} onClick={() => void createZip()}>{exporting ? 'Creating local ZIP…' : 'Create ZIP on this Mac'}</button> : <button type="button" className={styles.primaryButton} disabled>Start Wicker Local to create ZIP</button>}</footer>
      {job && <div className={`${styles.job} ${job.status === 'failed' ? styles.jobFailed : job.status === 'ready' ? styles.jobReady : ''}`}><span className={styles.jobMark}>{job.status === 'ready' ? <Icon name="check" /> : job.status === 'failed' ? '!' : '…'}</span><div>{job.status === 'running' && <><strong>Building your local archive</strong><p>Large files are streamed to a temporary local folder, then bundled into one ZIP.</p></>}{job.status === 'failed' && <><strong>The archive could not be completed</strong><p>{job.error || 'Try again after checking Canvas access.'}</p></>}{job.status === 'ready' && <><strong>{job.result?.fileName || 'Your Canvas archive'} is ready</strong><p>{job.result ? `${job.result.modules} module${job.result.modules === 1 ? '' : 's'} · ${job.result.resources} collected resources · ${bytes(job.result.bytes)}` : 'Download it before it expires from Wicker Local.'}</p></>}</div>{job.status === 'ready' && job.downloadUrl && <a className={styles.primaryButton} href={`${LOCAL_AGENT}${job.downloadUrl}`}>Download ZIP</a>}</div>}
    </section>}

    <section className={styles.boundary}><span><Icon name="lock" /></span><p><strong>Private collection is not publication.</strong> A Canvas archive helps you study and, where you are authorised, prepare a candidate source set. Course-wide editorial content stays behind consent, rights review, versioning, and administrator approval.</p></section>
  </main>
}
