/**
 * Reader rules.
 *
 * The outline is derived from the same headings the renderer emits ids for, so
 * a link in the outline always lands on a heading that exists — the two cannot
 * disagree because both use `slugOf`.
 */

/**
 * GitHub-style slugs, matching what rehype-slug produces, so the outline's
 * hrefs and the rendered headings' ids agree without a second pass over the
 * DOM.
 */
export function slugOf(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{Zs}-]/gu, '')
    .replace(/\s+/g, '-')
}

/**
 * Headings, in document order, skipping anything inside a fenced code block —
 * a `# comment` in a shell example is not a section of the chapter.
 */
export function outlineOf(markdown, { min = 2, max = 3 } = {}) {
  const outline = []
  let fenced = false
  for (const line of String(markdown ?? '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue }
    if (fenced) continue
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!heading) continue
    const depth = heading[1].length
    if (depth < min || depth > max) continue
    // The rendered text drops inline markup, and so must the slug.
    const text = heading[2].replace(/`([^`]+)`/g, '$1').replace(/\*\*|__|\*|_/g, '').trim()
    if (text) outline.push({ depth, text, id: slugOf(text) })
  }
  return outline
}

/** Rough reading time, stated as a range rather than a false precision. */
export function readingMinutes(markdown, wordsPerMinute = 200) {
  const words = String(markdown ?? '').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / wordsPerMinute))
}

/** The chapter before and after this one, for moving through a course. */
export function neighbours(chapters, chapterId) {
  const index = (chapters ?? []).findIndex((chapter) => chapter.id === chapterId)
  if (index === -1) return { previous: null, next: null }
  return {
    previous: chapters[index - 1] ?? null,
    next: chapters[index + 1] ?? null
  }
}
