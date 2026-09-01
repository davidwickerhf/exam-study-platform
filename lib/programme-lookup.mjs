// Finding a university programme the maintained catalogue does not yet carry.
//
// What is actually reachable from a server, established by measurement:
//
//   • The maintained catalogue. Authoritative where it has an entry.
//   • https://www.maastrichtuniversity.nl/education/bachelor/programmes/<slug>/courses-and-curriculum
//     is server-rendered and carries the programme's name, its description, and
//     a link to the official course repository — but no course codes at all. It
//     is prose.
//   • https://courserepository.maastrichtuniversity.nl/p/program/EN/<id> does
//     carry the full curriculum, and is a Mendix single-page application that
//     loads it through POST /xas/, a session-bound internal endpoint. There is
//     no public data API, so a server cannot read it without driving a browser.
//
// So this module resolves a programme's *identity* and hands back the official
// curriculum link for the student to confirm against. The course list itself
// comes from the student's own record, which for anyone past their first year
// is more accurate than a prospectus anyway.

import { assertPublicUrl } from './security.mjs'

export const UM_PROGRAMME_HOST = 'https://www.maastrichtuniversity.nl'
const CURRICULUM_PATH = (slug, level = 'bachelor') => `/education/${level}/programmes/${slug}/courses-and-curriculum`
const FETCH_TIMEOUT_MS = 20_000
const MAX_PAGE_BYTES = 4 * 1024 * 1024

export class ProgrammeLookupError extends Error {}

function text(value, max = 400) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Only a leading degree phrase is stripped. Removing "science" wherever it
// appeared turned Computer Science into "computer" and Data Science and
// Artificial Intelligence into "data-and-artificial-intelligence" — neither of
// which is a page.
const DEGREE_PREFIX = /^\s*(?:(?:bachelor|master)(?:'s)?(?:\s+of\s+(?:science|arts|laws))?|bsc|msc|ba|ma|llb|llm)\b(?:\s+(?:in|of)\b)?\s*/i

export function programmeSlug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(DEGREE_PREFIX, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripMarkup(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function fetchPage(url, { fetchImpl = fetch } = {}) {
  const checked = await assertPublicUrl(url)
  const response = await fetchImpl(checked.url ?? url, {
    headers: { accept: 'text/html', 'user-agent': 'WickerStudy/1.0 (+https://study.wicker.life)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
  if (!response.ok) throw new ProgrammeLookupError(`That page could not be read (HTTP ${response.status}).`)
  const body = await response.text()
  if (body.length > MAX_PAGE_BYTES) throw new ProgrammeLookupError('That page is too large to read.')
  return body
}

/**
 * Reads a university programme page.
 *
 * Returns the identity and the official curriculum link. `courses` is
 * deliberately absent: these pages do not list them, and inventing a course
 * list from a prospectus paragraph would be worse than admitting the gap.
 */
export function readProgrammePage(html, { url = '' } = {}) {
  const lines = stripMarkup(html)
  const joined = lines.join('\n')
  const title = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.split('|')[0], 160)
  const heading = text(lines.find((line) => /^(bachelor|master|bsc|msc|ba|ma)\b/i.test(line) && line.length < 120), 160)
  const repository = html.match(/https?:\/\/courserepository\.maastrichtuniversity\.nl\/p\/program\/[A-Z]{2}\/(\d+)/i)
  // If a page ever does carry course codes, keep them; today none do.
  const codes = [...new Set(joined.match(/\b[A-Z]{2,4}\d{4}[A-Z]?\b/g) || [])]
  const years = lines.filter((line) => /^year\s+[1-6]$/i.test(line)).length
  return {
    url,
    name: heading || title || null,
    title: title || null,
    curriculumRepository: repository ? repository[0] : null,
    repositoryProgrammeId: repository ? repository[1] : null,
    courseCodes: codes,
    // What the page is good for, stated rather than left to be discovered.
    carriesCourseList: codes.length > 0,
    years,
    summary: lines.filter((line) => line.length > 60).slice(0, 6).join(' ').slice(0, 1200) || null
  }
}

export async function lookupUmProgramme({ name, slug, level = 'bachelor', url, fetchImpl = fetch } = {}) {
  const candidates = []
  if (url) candidates.push(url)
  else {
    const resolved = slug || programmeSlug(name)
    if (!resolved) throw new ProgrammeLookupError('Give the programme a name to look up.')
    for (const candidateLevel of level === 'any' ? ['bachelor', 'master'] : [level]) {
      candidates.push(`${UM_PROGRAMME_HOST}${CURRICULUM_PATH(resolved, candidateLevel)}`)
    }
  }
  const problems = []
  for (const candidate of candidates) {
    try {
      const page = readProgrammePage(await fetchPage(candidate, { fetchImpl }), { url: candidate })
      if (page.name || page.curriculumRepository) return { found: true, ...page }
    } catch (error) {
      problems.push(`${candidate}: ${error.message}`)
    }
  }
  return {
    found: false,
    tried: candidates,
    problems,
    // The honest next move, rather than a silent empty result.
    next: 'Ask the student for the programme page URL, or for the course list itself — their transcript already carries every course they are registered for.'
  }
}
