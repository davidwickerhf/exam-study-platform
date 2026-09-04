'use client'

import { FormEvent, useEffect, useState } from 'react'
import { SiteIcon } from './icon'

type Entry = {
  id: string
  kind: 'programme' | 'module'
  code: string | null
  title: string
  language?: string | null
  url: string
  officialUrl?: string | null
  lastModified?: string | null
  source: string
}

type Result = { entries: Entry[]; total: number; unresolvedTotal?: number; fetchedAt: string | null; source: string; warning: string | null }

export function CourseDiscovery() {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null)
    const params = new URLSearchParams({ limit: '50', kind })
    if (query) params.set('q', query)
    fetch(`/api/public/course-repository?${params}`, { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || `Course discovery returned ${response.status}`)
        setResult(body)
      })
      .catch((cause: Error) => { if (cause.name !== 'AbortError') setError(cause.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, kind])

  function submit(event: FormEvent) {
    event.preventDefault()
    setQuery(draft.trim())
  }

  return (
    <section className="course-discovery" aria-labelledby="course-discovery-title">
      <div className="course-discovery-heading">
        <div>
          <h2 id="course-discovery-title">Explore Maastricht courses</h2>
          <p>Search verified, human-readable records from the university’s public Course Repository. Results open at Maastricht University.</p>
        </div>
        <a href="https://www.maastrichtuniversity.nl/education/bachelor/programmes/computer-science/courses-and-curriculum" target="_blank" rel="noopener noreferrer">View the official curriculum page <SiteIcon name="arrow" /></a>
      </div>

      <form className="course-discovery-form" onSubmit={submit} role="search">
        <label htmlFor="course-search-query">
          <span>Programme or module</span>
          <input id="course-search-query" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Computer Science or catalogue code" />
        </label>
        <label htmlFor="course-search-kind">
          <span>Type</span>
          <select id="course-search-kind" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">All</option>
            <option value="programmes">Programmes</option>
            <option value="modules">Modules</option>
          </select>
        </label>
        <button className="site-button site-button-primary" type="submit">Search</button>
      </form>

      <div className="course-discovery-status" aria-live="polite">
        {loading ? 'Checking the public catalogue…' : error ? error : `${result?.total ?? 0} ${result?.total === 1 ? 'result' : 'results'}${result?.warning ? ' · Some catalogue sections could not be refreshed; showing verified records from the available index.' : ''}`}
      </div>

      {!loading && !error && result && (
        result.entries.length ? (
          <div className="course-discovery-results">
            {result.entries.map((entry) => (
              <article key={entry.url}>
                <span>{entry.kind}</span>
                <div><strong>{entry.title}</strong><small>{[entry.language === 'EN' ? 'English' : entry.language === 'NL' ? 'Dutch' : entry.language, entry.source === 'verified-index' ? 'Verified public record' : 'Course Repository'].filter(Boolean).join(' · ')}</small></div>
                <div className="course-discovery-links">
                  <a href={entry.url} target="_blank" rel="noopener noreferrer">View record <SiteIcon name="arrow" /></a>
                  {entry.officialUrl && <a href={entry.officialUrl} target="_blank" rel="noopener noreferrer">Programme page</a>}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="course-discovery-empty">No public records match that search. Try the full programme name or a shorter course code.</p>
      )}
      <p className="course-discovery-note">This is read-only discovery. Wicker Study does not sign in to the Student Portal or send information to Maastricht University.</p>
    </section>
  )
}
