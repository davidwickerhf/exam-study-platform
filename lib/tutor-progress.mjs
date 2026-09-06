// Public activity labels only. Never expose tool arguments, hidden reasoning,
// raw source contents or provider errors in progress events.
export function tutorToolProgress(name, args = {}) {
  const code = /^[A-Z]{2,5}\d{3,5}$/.test(args.courseCode || '') ? ` for ${args.courseCode}` : ''
  const labels = {
    search_study_sources: 'Searching course material and relevant announcements',
    read_study_source: 'Reading the indexed document',
    get_announcements: 'Checking course announcements',
    get_course_obligations: 'Checking requirements and recent rule changes',
    get_schedule: 'Checking your schedule', get_attendance: 'Checking your attendance record',
    get_study_work: 'Checking your tracked work', get_briefing: 'Checking upcoming priorities',
    get_progress: 'Checking your academic record', search_conversation_history: 'Finding relevant earlier discussions',
    search_programme_regulations: 'Checking programme regulations'
  }
  return `${labels[name] || (name.startsWith('propose_') ? 'Preparing an action for your review' : name.startsWith('prepare_') ? 'Preparing your study material' : 'Checking relevant workspace evidence')}${code}…`
}

export function openTutorStream(res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' })
  res.flushHeaders?.()
  return (type, data) => { if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify({ type, ...data })}\n`) }
}
