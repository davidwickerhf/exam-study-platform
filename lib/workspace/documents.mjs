/**
 * The rules behind the document review step.
 *
 * A student drops in a transcript, an exam schedule, a timetable or an .ics
 * feed. The server reads it and answers with a *change set*: discrete,
 * self-contained proposals against the plan. Nothing is written until the
 * student ticks a proposal and applies it, so everything in this module
 * exists to make that tick honest:
 *
 * - a proposal that is not shown can never be applied (`groupChanges` has a
 *   catch-all bucket rather than silently dropping an unknown kind),
 * - a proposal that contradicts what the plan already says is never ticked
 *   for the student (`defaultSelection`),
 * - a proposal that only makes sense once another one is applied travels with
 *   it, or not at all (`toggleChange`, `selectedChanges`).
 *
 * Plain ESM with a .d.mts beside it, for the same reason as the other rule
 * modules: node:test imports the module the page uses.
 */

/** What the student can tell the reader a document is. Mirrors DOCUMENT_KINDS in lib/academic-documents.mjs. */
export const DOCUMENT_KINDS = [
  ['auto', 'Detect automatically'],
  ['academic-overview', 'Academic overview / study progress'],
  ['transcript', 'Transcript or grade list'],
  ['exam-schedule', 'Exam schedule'],
  ['timetable', 'Timetable or calendar'],
  ['academic-calendar', 'Academic calendar'],
  ['curriculum', 'Curriculum or handbook']
]

/**
 * Reading order for the review. Disagreements come first — they are the ones
 * that need a person — then what the source adds, then detail and dates.
 */
export const CHANGE_GROUPS = [
  ['profile-conflict', 'Programme conflicts'],
  ['course-conflict', 'Course conflicts'],
  ['attempt-conflict', 'Schedule and result conflicts'],
  ['enrollment', 'Current enrolment'],
  ['result', 'Results and grades'],
  ['exam-date', 'Upcoming attempts'],
  ['history', 'Academic history'],
  ['attempt-context', 'Historical course context'],
  ['new-course', 'Courses needing a decision'],
  ['course-detail', 'Current course details'],
  ['event', 'Dates and events'],
  ['profile', 'Programme details']
]

export const MAX_SOURCES = 6
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024
/** How many rendered pages may be sent as images across all sources in one read. */
export const MAX_IMAGE_PAGES = 4
export const MAX_DESCRIPTION = 20_000

const list = (value) => (Array.isArray(value) ? value : [])

/**
 * The review, grouped for reading.
 *
 * The last group is a catch-all. The vanilla review rendered a fixed list of
 * kinds, so a change with an unrecognised kind was invisible in the list yet
 * still counted, still selectable by "select all", and still applied. A
 * proposal the student never saw must not be appliable, so anything unknown
 * is shown here rather than dropped.
 */
export function groupChanges(changes) {
  const all = list(changes)
  const known = new Set(CHANGE_GROUPS.map(([kind]) => kind))
  const groups = CHANGE_GROUPS.map(([kind, label]) => ({ kind, label, changes: all.filter((change) => change.kind === kind) }))
  const other = all.filter((change) => !known.has(change.kind))
  if (other.length) groups.push({ kind: 'other', label: 'Other proposals', changes: other })
  return groups
    .filter((group) => group.changes.length)
    .map((group) => ({
      ...group,
      decisions: group.changes.filter((change) => change.requiresDecision === true).length,
      // Long, routine groups stay folded; anything that needs a person does not.
      defaultOpen: group.kind === 'other' || group.kind === 'enrollment' || group.changes.length <= 6 || group.changes.some((change) => change.requiresDecision === true)
    }))
}

/** A change the student has to decide, because the source contradicts the plan. */
export function needsDecision(change) {
  return change?.requiresDecision === true
}

/**
 * What is ticked when the review opens.
 *
 * Two rules, and the second is not redundant: the server sets both
 * `requiresDecision` and `selectedByDefault: false` on every conflict today,
 * but a proposal that overwrites a recorded fact must never arrive pre-ticked
 * even if one of those flags is ever forgotten. A dependent proposal — an
 * event for a course that is not in the plan — cannot start ticked either,
 * because its prerequisite does not.
 */
export function defaultSelection(changes) {
  const all = list(changes)
  const selected = new Set(
    all.filter((change) => change.selectedByDefault !== false && !needsDecision(change)).map((change) => change.id)
  )
  for (const change of all) {
    if (change.requiresCourseChangeId && !selected.has(change.requiresCourseChangeId)) selected.delete(change.id)
  }
  return selected
}

/**
 * Tick or untick one proposal, carrying its dependencies with it.
 *
 * Ticking an event for a course that is not in the plan also ticks the change
 * that adds the course, because the event is meaningless without it. Unticking
 * the course takes its events back out, rather than leaving them ticked and
 * silently dropped by the server.
 */
export function toggleChange(changes, selected, id, checked) {
  const all = list(changes)
  const next = new Set(selected ?? [])
  if (checked) {
    next.add(id)
    let cursor = all.find((change) => change.id === id)?.requiresCourseChangeId
    const guard = new Set()
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor)
      next.add(cursor)
      cursor = all.find((change) => change.id === cursor)?.requiresCourseChangeId
    }
    return next
  }
  next.delete(id)
  const queue = [id]
  while (queue.length) {
    const removed = queue.shift()
    for (const dependent of all.filter((change) => change.requiresCourseChangeId === removed)) {
      if (!next.delete(dependent.id)) continue
      queue.push(dependent.id)
    }
  }
  return next
}

/** Every proposal, ticked. Conflicts included: this is an explicit act. */
export function selectAll(changes) {
  return new Set(list(changes).map((change) => change.id))
}

/**
 * Exactly what is sent to /documents/apply, in the order the server received
 * the proposals. A ticked proposal whose prerequisite is not ticked is left
 * out: the server would refuse it anyway, and sending it would let the review
 * report a number of applied changes that never happened.
 */
export function selectedChanges(changes, selected) {
  const ticked = new Set(selected ?? [])
  return list(changes).filter((change) => ticked.has(change.id) && (!change.requiresCourseChangeId || ticked.has(change.requiresCourseChangeId)))
}

/**
 * The counts under the review. `blocked` is the honest gap between what the
 * student ticked and what will actually be applied.
 */
export function selectionSummary(changes, selected) {
  const all = list(changes)
  const ticked = new Set(selected ?? [])
  const applying = selectedChanges(all, ticked)
  return {
    total: all.length,
    selected: all.filter((change) => ticked.has(change.id)).length,
    applying: applying.length,
    blocked: all.filter((change) => ticked.has(change.id)).length - applying.length,
    decisions: all.filter(needsDecision).length,
    decisionsSelected: applying.filter(needsDecision).length
  }
}

const unique = (items, keyOf) => [...new Map(list(items).map((item) => [keyOf(item), item])).values()]

/** Two cross-checks over one plan, read as one. */
export function mergeReconciliations(left, right) {
  if (!left) return right ?? null
  if (!right) return left
  const matched = unique([...list(left.matched), ...list(right.matched)], (item) => item.courseId || item.key)
  const matchedIds = new Set(matched.map((item) => item.courseId).filter(Boolean))
  const unselected = unique([...list(left.unselected), ...list(right.unselected)], (item) => item.code || item.key || item.name)
  const historical = unique([...list(left.historical), ...list(right.historical)], (item) => item.code || item.key || item.name)
  const missing = unique([...list(left.missing), ...list(right.missing)], (item) => item.courseId || item.code || item.name)
    .filter((item) => !matchedIds.has(item.courseId))
  const conflicts = unique([...list(left.conflicts), ...list(right.conflicts)], (item) => item.id || item.label)
  const observed = matched.length + unselected.length
  return {
    kind: left.kind === right.kind ? left.kind : 'mixed',
    sourceLabel: [left.sourceLabel, right.sourceLabel].filter(Boolean).join(', '),
    status: unselected.length || conflicts.length ? 'attention' : missing.length ? 'review' : observed ? 'aligned' : 'not-applicable',
    coverage: {
      observed,
      matched: matched.length,
      selectedInScope: Math.max(Number(left.coverage?.selectedInScope) || 0, Number(right.coverage?.selectedInScope) || 0),
      missing: missing.length
    },
    matched,
    unselected,
    historical,
    missing,
    conflicts
  }
}

/**
 * One review over several sources. A dropped .ics is previewed by a different
 * endpoint from a PDF, and the student should still see one list. Proposal ids
 * are stable per fact, so the same fact read twice is one proposal, not two.
 */
export function mergeChangeSets(left, right, source) {
  if (!right) return left ?? null
  if (!left) return { ...right, sources: source ? [source] : list(right.sources) }
  const changes = [...list(left.changes)]
  for (const change of list(right.changes)) if (!changes.some((item) => item.id === change.id)) changes.push(change)
  return {
    ...left,
    kind: left.kind === right.kind ? left.kind : 'mixed',
    changes,
    feedSummary: left.feedSummary ?? right.feedSummary ?? null,
    sources: [...list(left.sources), ...(source ? [source] : list(right.sources))],
    warnings: [...new Set([...list(left.warnings), ...list(right.warnings)])],
    reconciliation: mergeReconciliations(left.reconciliation, right.reconciliation)
  }
}

/**
 * The cross-check, said plainly. Returns null when the source had nothing to
 * compare against — an empty panel reads as "all clear", which would be a lie.
 */
export function reconciliationSummary(result) {
  const reconciliation = result?.reconciliation
  if (!reconciliation || reconciliation.status === 'not-applicable') return null
  const matched = list(reconciliation.matched)
  const unselected = list(reconciliation.unselected)
  const missing = list(reconciliation.missing)
  const conflicts = list(reconciliation.conflicts)
  return {
    status: reconciliation.status,
    matched,
    unselected,
    missing,
    conflicts,
    issueCount: unselected.length + missing.length + conflicts.length,
    // An academic overview naming courses that are not in the plan is evidence
    // of current enrolment, not a disagreement about the plan.
    currentEnrollment: result?.kind === 'academic-overview' && unselected.length > 0 && conflicts.length === 0
  }
}

/**
 * Split the added files into the two requests that read them, and hold the
 * image budget for the whole read rather than per file. An .ics is parsed
 * exactly, never by a model, so it goes to the calendar preview instead.
 */
export function analysisPayload(files) {
  const all = list(files)
  const calendars = all.filter((file) => /\.ics$/i.test(String(file?.name ?? '')) && String(file?.text ?? '').trim())
  let remaining = MAX_IMAGE_PAGES
  const documents = all
    .filter((file) => !calendars.includes(file))
    .map((file) => {
      const images = list(file.images).slice(0, Math.max(0, remaining))
      remaining -= images.length
      return { name: file.name, type: file.type, pageCount: file.pageCount, text: file.text, images }
    })
  return { documents, calendars }
}

/**
 * The read, as an ordered list of requests.
 *
 * Which endpoint reads which file, and in which order the answers fold
 * together, is a rule about the document — not about the surface — so it lives
 * beside the merge it feeds. The component posts what it is given and merges
 * with `mergeAnalysisResults`; nothing about endpoint choice is decided in the
 * component any more.
 *
 * The documents request goes first so that a transcript's course proposals
 * exist before a calendar's events, which may depend on them.
 */
export function analysisRequests(files, options = {}) {
  const { documents, calendars } = analysisPayload(files)
  const description = String(options.description ?? '')
  const requests = []
  if (documents.length || description.trim()) {
    requests.push({
      path: '/api/academics/documents/analyze',
      body: { kind: String(options.kind ?? 'auto'), description, documents },
      source: null
    })
  }
  for (const file of calendars) {
    requests.push({
      path: '/api/academics/calendars/preview',
      body: { ics: file.text, date: options.date ?? null },
      source: { name: file.name }
    })
  }
  return requests
}

/** Every answer, folded into the one review the student reads. */
export function mergeAnalysisResults(results) {
  return list(results).reduce((left, item) => mergeChangeSets(left, item?.result ?? null, item?.source ?? null), null)
}

/**
 * What a proposal would do to the plan, in one word.
 *
 * NEW adds a record the plan does not have. MATCH touches a record it already
 * has. CONFLICT would overwrite a recorded fact with a different one, and is
 * the only status that can never arrive ticked.
 */
export function changeStatus(change) {
  const kind = String(change?.kind ?? '')
  if (needsDecision(change) || kind.endsWith('-conflict')) return 'conflict'
  if (kind === 'new-course' || kind === 'history') return 'new'
  const payload = change?.payload ?? {}
  return payload.courseId || payload.attemptId || payload.field ? 'match' : 'new'
}

export const CHANGE_STATUS_LABEL = { new: 'New', match: 'Match', conflict: 'Conflict' }

/**
 * The two sides of a disagreement, pulled apart so the review can print them
 * as a diff rather than as one sentence the student has to parse.
 *
 * The reader writes conflicts as `Selected plan: X · Source: Y`, which is the
 * only shape carrying both values; anything else has no diff to show.
 */
export function changeDiff(change) {
  const detail = String(change?.detail ?? '').trim()
  const prefix = 'Selected plan:'
  if (!detail.startsWith(prefix)) return null
  const parts = detail.slice(prefix.length).split(' · ')
  if (parts.length < 2) return null
  const current = parts[0].trim()
  const tail = parts.slice(1).join(' · ')
  const at = tail.indexOf(': ')
  if (at < 0) return null
  return {
    current: current || 'blank',
    source: tail.slice(0, at).trim(),
    // A trailing sentence of advice is guidance, not the proposed value.
    proposed: tail.slice(at + 2).split(/\.\s+(?=[A-Z])/)[0].trim() || 'blank'
  }
}

/** What a file contributes, for the list under the dropzone. */
export function describeSource(file) {
  if (file?.pageCount) return `${file.pageCount} page${file.pageCount === 1 ? '' : 's'}`
  if (String(file?.text ?? '').length) return `${Math.max(1, Math.round(String(file.text).length / 1000))}k characters`
  return list(file?.images).length ? 'image' : 'empty'
}
