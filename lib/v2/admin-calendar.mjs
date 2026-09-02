export function calendarPayload({ source, url, files, replace }) {
  if (source === 'url') {
    let normalized
    try { normalized = new URL(String(url || '').trim()).toString() }
    catch { throw new Error('Enter a valid calendar feed URL.') }
    if (!['http:', 'https:', 'webcal:'].includes(new URL(normalized).protocol)) throw new Error('Calendar feeds must use http, https or webcal.')
    return [{ url: normalized, replace: Boolean(replace) }]
  }
  const held = (files ?? []).filter((file) => file?.text)
  if (!held.length) throw new Error('Choose at least one readable calendar file.')
  return held.map((file, index) => ({ ics: String(file.text), replace: index === 0 ? Boolean(replace) : false }))
}

export function calendarResultLine(result, programmeName) {
  const count = Number(result?.count) || 0
  const read = Number.isFinite(Number(result?.read)) ? `${Number(result.read)} date${Number(result.read) === 1 ? '' : 's'} read · ` : ''
  return `${read}${count} now published to ${programmeName || result?.id || 'the programme'}${result?.replaced ? ' (replaced)' : ' (merged)'}.`
}
