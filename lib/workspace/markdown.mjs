/**
 * The tutor's Markdown.
 *
 * The node tests pin wrong-but-plausible renderings that shipped before they
 * existed, keeping the React tutor's output stable.
 *
 * Escape-first by design: this is model output, so nothing reaches the DOM
 * that was not produced by one of the rules below. That is what makes it safe
 * to hand to dangerouslySetInnerHTML, and it is tested for injection.
 *
 * The chapter reader will need a fuller pipeline than this — KaTeX, wikilinks,
 * embeds — and should not be squeezed into it.
 */

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}

export function tutorLinkLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.includes('canvas') ? 'Open in Canvas' : host
  } catch { return url }
}

export function tutorInline(text) {
  const links = []
  const hold = (url, label) => `@@wsL${links.push({ url, label }) - 1}@@`
  let out = String(text || '')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => hold(url, label))
    // Trailing punctuation belongs to the sentence, not to the address.
    .replace(/(https?:\/\/[^\s<>()]*[^\s<>().,;:!?])/g, (url) => hold(url, null))
  out = escapeHtml(out)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/\n/g, '<br>')
  return out.replace(/@@wsL(\d+)@@/g, (_, index) => {
    const { url, label } = links[Number(index)]
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || tutorLinkLabel(url))}</a>`
  })
}

export function tutorMarkdown(source) {
  const out = []
  let list = null
  let para = ''
  let blank = true
  // Markdown's hard break: a line ending in two spaces continues the same
  // block on a new line rather than flowing into it.
  let hardBreak = false
  const join = (existing, addition) => existing + (hardBreak ? '\n' : ' ') + addition
  const flushPara = () => { if (para) { out.push(`<p>${tutorInline(para)}</p>`); para = '' } }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((item) => `<li>${tutorInline(item.text)}${item.sub.length
      ? `<ul>${item.sub.map((entry) => `<li>${tutorInline(entry)}</li>`).join('')}</ul>` : ''}</li>`).join('')
    // A blank line between steps ends the list element but not the sequence:
    // without the source's own start number, step 3 renders as a second step 1.
    const open = list.type === 'ol' && list.start > 1 ? `<ol start="${list.start}">` : `<${list.type}>`
    out.push(`${open}${items}</${list.type}>`)
    list = null
  }

  for (const raw of String(source || '').replace(/\r/g, '').split('\n')) {
    if (!raw.trim()) { flushPara(); blank = true; continue }
    const indent = raw.match(/^\s*/)[0].length
    const heading = raw.match(/^\s*#{1,6}\s+(.*)$/)
    const ordered = raw.match(/^\s*(\d+)[.)]\s+(.*)$/)
    const bullet = raw.match(/^\s*[-*•]\s+(.*)$/)

    if (heading) { flushPara(); flushList(); out.push(`<h4>${tutorInline(heading[1].trim())}</h4>`); blank = false; continue }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) { flushPara(); flushList(); continue }

    if (ordered) {
      flushPara()
      if (list && list.type !== 'ol') flushList()
      if (!list) list = { type: 'ol', items: [], start: Number(ordered[1]) || 1 }
      list.items.push({ text: ordered[2].trim(), sub: [] })
      blank = false
      hardBreak = / {2,}$/.test(raw)
      continue
    }
    if (bullet) {
      flushPara()
      // A bullet under a numbered step is that step's detail — either indented,
      // or simply on the next line, which is how the tutor writes out a day's
      // sessions. A blank line in between makes it a list of its own.
      if (list && list.items.length && (indent >= 2 || (list.type === 'ol' && !blank))) {
        list.items[list.items.length - 1].sub.push(bullet[1].trim())
        blank = false
        hardBreak = / {2,}$/.test(raw)
        continue
      }
      if (list && list.type !== 'ul') flushList()
      if (!list) list = { type: 'ul', items: [] }
      list.items.push({ text: bullet[1].trim(), sub: [] })
      blank = false
      hardBreak = / {2,}$/.test(raw)
      continue
    }
    if (list && indent >= 2 && list.items.length && !blank) {
      const item = list.items[list.items.length - 1]
      if (item.sub.length) item.sub[item.sub.length - 1] = join(item.sub[item.sub.length - 1], raw.trim())
      else item.text = join(item.text, raw.trim())
      blank = false
      hardBreak = / {2,}$/.test(raw)
      continue
    }
    flushList()
    para = para ? join(para, raw.trim()) : raw.trim()
    blank = false
    hardBreak = / {2,}$/.test(raw)
  }
  flushPara()
  flushList()
  return out.join('')
}
