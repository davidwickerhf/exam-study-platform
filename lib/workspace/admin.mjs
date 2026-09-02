/**
 * The administration surface's rules.
 *
 * Plain ESM with a .d.mts beside it, for the same reason as lib/app/account.mjs:
 * node:test imports the module the page uses.
 *
 * Everything here answers one question — what is waiting on an administrator —
 * from three independent sources: editorial editions in production, student
 * course-content requests, and the generation steps a course has not covered
 * yet. Each source is allowed to be missing without the others becoming wrong.
 */

/**
 * Where an edition sits, and the single next thing that moves it.
 *
 * The order matters: a queued job outranks a draft waiting for review,
 * because reviewing a draft that is about to be regenerated is wasted work.
 */
export function editionStage(edition) {
  const counts = edition?.counts ?? {}
  if (edition?.status === 'active') return { id: 'published', label: 'Published', next: null }
  if (counts.pendingJobs) return { id: 'processing', label: `${counts.pendingJobs} queued`, next: 'Run the queued jobs' }
  if (counts.reviewArtifacts) return { id: 'review', label: `${counts.reviewArtifacts} to review`, next: 'Approve the drafts' }
  if (counts.approvedArtifacts) return { id: 'ready', label: 'Ready to publish', next: 'Publish the edition' }
  if (counts.acceptedSources) return { id: 'drafting', label: 'Drafting', next: 'Extract, map, then generate' }
  if (counts.sources) return { id: 'rights', label: 'Rights review', next: 'Accept or reject the sources' }
  return { id: 'sources', label: 'No sources', next: 'Add the course sources' }
}

const STAGE_WEIGHT = { review: 0, rights: 1, ready: 2, processing: 3, drafting: 4, sources: 5 }

export const REQUEST_STATUS_LABEL = {
  submitted: 'Submitted',
  'in-progress': 'In production',
  review: 'Quality review',
  published: 'Published',
  declined: 'Closed'
}

/** A request is open until it has been published or closed. */
export function isOpenRequest(request) {
  return !['published', 'declined'].includes(request?.status)
}

export function openRequests(requests) {
  return (requests ?? []).filter(isOpenRequest)
}

/**
 * Everything waiting on a decision, most urgent first.
 *
 * A published edition contributes nothing — it has no next step — and neither
 * does a closed request. An empty queue therefore means the work is genuinely
 * clear, not that the sources failed to load; the page checks for that
 * separately and says which source it could not read.
 */
export function attentionQueue({ editions = [], requests = [] } = {}) {
  const items = []
  for (const edition of editions) {
    const stage = editionStage(edition)
    if (!stage.next) continue
    items.push({
      id: `edition:${edition.id}`,
      title: `${edition.courseCode || edition.courseName || 'Untitled edition'} · ${stage.label}`,
      detail: stage.next,
      href: `/app/admin?tab=production&edition=${encodeURIComponent(String(edition.id))}`,
      weight: STAGE_WEIGHT[stage.id] ?? 6
    })
  }
  const open = openRequests(requests)
  if (open.length) {
    items.push({
      id: 'requests',
      title: `${open.length} course request${open.length === 1 ? '' : 's'} open`,
      detail: 'Review the student evidence and decide on rights',
      href: '/app/admin?tab=intake',
      weight: 0
    })
  }
  return items.sort((left, right) => left.weight - right.weight || left.title.localeCompare(right.title))
}

/** The active release's counters, in a fixed reading order. */
export const RELEASE_COUNTERS = [
  ['courses', 'Courses'],
  ['chapters', 'Chapters'],
  ['materials', 'Materials'],
  ['questions', 'Questions'],
  ['flashcards', 'Flashcards'],
  ['programmes', 'Programmes']
]

export function releaseCounters(status) {
  const counts = status?.counts ?? {}
  return RELEASE_COUNTERS.map(([key, label]) => ({
    key,
    label,
    // A counter the server did not report is unknown, not zero.
    value: Number.isFinite(Number(counts[key])) ? Number(counts[key]) : null
  }))
}

/**
 * Generation coverage per course, joined onto the course names.
 *
 * A course with no planned steps has unknown coverage, not complete coverage:
 * `percent` is null and the page prints a dash. Reading it as 100% would
 * announce that an empty course is finished.
 */
export function coverageRows(coverage, courses) {
  const names = new Map((courses ?? []).map((course) => [course.id, course]))
  return Object.entries(coverage?.courses ?? {})
    .map(([id, entry]) => {
      const total = Math.max(0, Number(entry?.total) || 0)
      const pending = Math.max(0, Number(entry?.pending) || 0)
      const done = Math.max(0, total - pending)
      const course = names.get(id)
      return {
        id,
        code: course?.code ?? id,
        name: course?.name ?? id,
        total,
        pending,
        done,
        percent: total ? Math.round((done / total) * 100) : null
      }
    })
    .sort((left, right) => right.pending - left.pending || left.code.localeCompare(right.code))
}
