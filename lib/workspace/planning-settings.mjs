/** Small, testable rules for Planning's portable-data settings. */

export function programmeLabel(item) {
  return String(item?.programme ?? '').trim() || 'Untitled programme'
}

export function exportEnvelope(workspace) {
  return { version: 1, data: workspace }
}

export function importCandidate(value) {
  const candidate = value?.data ?? value
  if (!candidate || typeof candidate !== 'object' || !candidate.profile || !Array.isArray(candidate.courses)) {
    throw new Error('This file does not contain an academics programme export.')
  }
  return candidate
}

export function courseMatchSummary(candidate, editorialCourses) {
  const codes = new Set((editorialCourses ?? []).map((course) => String(course?.code ?? '').trim().toUpperCase()).filter(Boolean))
  const matched = (candidate?.courses ?? []).filter((course) => codes.has(String(course?.code ?? '').trim().toUpperCase())).length
  return { total: candidate?.courses?.length ?? 0, matched, unmatched: (candidate?.courses?.length ?? 0) - matched }
}

export function exportFilename(date = new Date()) {
  return `wicker-academics-${date.toISOString().slice(0, 10)}.json`
}
