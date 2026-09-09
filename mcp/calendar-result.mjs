// The web calendar includes reconciliation proposals and whole-term analytics.
// They are not evidence for a bounded calendar lookup and can bury its events.
export function calendarToolResult(data, { from, to } = {}) {
  if (from && to && from > to) throw new Error('from must be on or before to')
  const events = (data.events || []).filter((event) => {
    const day = String(event.start).slice(0, 10)
    return (!from || day >= from) && (!to || day <= to)
  })
  return {
    events,
    range: { from: from || null, to: to || null, inclusive: true },
    eventCount: events.length,
    feeds: data.feeds || [],
    canvas: data.canvas || { connected: false },
    problems: data.problems || [],
  }
}
