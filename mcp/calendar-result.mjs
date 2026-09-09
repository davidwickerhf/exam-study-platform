// The web calendar includes reconciliation proposals and whole-term analytics.
// They are not evidence for a bounded calendar lookup and can bury its events.
export function calendarToolResult(data, { from, to } = {}) {
  if (from && to && from > to) throw new Error('from must be on or before to')
  const inRange = (day) => (!from || day >= from) && (!to || day <= to)
  const events = (data.events || []).filter((event) => inRange(String(event.start).slice(0, 10)))
  // Existing notices keep the original date in their server-generated detail.
  // Include moves both away from and into the requested day.
  const changes = (data.changes || []).filter((change) =>
    [change.date, ...(String(change.detail || '').match(/\b\d{4}-\d{2}-\d{2}\b/g) || [])]
      .filter(Boolean).some(inRange))
  return {
    events,
    changes,
    range: { from: from || null, to: to || null, inclusive: true },
    eventCount: events.length,
    feeds: data.feeds || [],
    canvas: data.canvas || { connected: false },
    problems: data.problems || [],
  }
}
