export function searchable(query) { return String(query ?? '').trim().length >= 2 }
export function searchHref(courseId, result) {
  const base = `/app/courses/${encodeURIComponent(courseId)}/${encodeURIComponent(result.chapterId)}`
  return result.headingSlug ? `${base}#${encodeURIComponent(result.headingSlug)}` : base
}
export function searchLabel(result) {
  return [result.chapterName, result.headingText && result.headingText !== result.chapterName ? result.headingText : null].filter(Boolean).join(' · ')
}
