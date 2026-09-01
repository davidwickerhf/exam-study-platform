// The permanent tutor: a conversation that can see the student's actual
// situation and their course material, and remembers what it is told to.
//
// Every claim it makes about dates, deadlines, grades, or course content comes
// from a tool. It has no other source, and it is told to say so rather than
// guess — a tutor that invents a deadline is worse than one that admits it
// cannot see the timetable.

import { runToolLoop, chatAvailable } from './model-loop.mjs'
import { studyBriefing } from './study-briefing.mjs'
import { aggregateCalendar, feedEvents } from './calendar-feed.mjs'
import { readAcademicState } from './academics.mjs'
import { academicProgress } from './academic-snapshots.mjs'
import { listCanvasConnections, canvasAccessToken } from './canvas-connections.mjs'
import { fetchCanvasHub } from './canvas-hub.mjs'
import { loadEditorialProgrammeCatalogue } from './editorial-programmes.mjs'
import { forgetFact, readTutorMemory, rememberFact } from './tutor-store.mjs'

export { chatAvailable as tutorAvailable }

export const TUTOR_TOOLS = Object.freeze([
  {
    type: 'function',
    function: {
      name: 'get_briefing',
      description: 'The student\'s whole situation, ranked: work Canvas marks missing, overdue hand-ins, upcoming exams, what is due in the next days, this week\'s lectures and tutorials with rooms, recent announcements, and credits so far. Use this for any question about priorities, the week ahead, or what is due — it is one call and it is already ranked. `notConnected` names sources that could not be read; say a source is not connected rather than reporting an empty week.',
      parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 31, description: 'How far ahead. Default 7.' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule',
      description: 'The calendar itself, when the briefing\'s week is not enough: a date range across the timetable, Canvas deadlines, exam attempts, and institution dates. Use for "when is X", "what does next month look like", or a specific day.',
      parameters: {
        type: 'object',
        properties: { from: { type: 'string', description: 'ISO date, inclusive.' }, to: { type: 'string', description: 'ISO date, inclusive.' } },
        required: ['from', 'to']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_course_facts',
      description: 'What the university publishes about a course: description, coordinator, prerequisites, recommended reading, teaching and assessment methods, credits, and the teaching window. Use for "who teaches X", "how is X assessed", "what is X about", "what should I read".',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: 'Course code, e.g. BCS2140.' } },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_progress',
      description: 'The student\'s academic record: credits earned, courses passed, failed attempts, weighted average, what they are registered for now, and how it has moved since the previous reading. Use for "how am I doing", "what do I still need", "am I on track".',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_announcements',
      description: 'Recent Canvas announcements across the student\'s current courses. Use for "did I miss anything", "what has been announced", or when they mention hearing something from a teacher.',
      parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 120, description: 'Default 21.' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Store a durable fact about the student that is not in any system — a resit they plan to take, a supervisor\'s name, a personal deadline, a constraint on their week. Only when they ask you to remember, or clearly state something lasting that would change your advice. Never store a password, a token, or anything they told you in confidence about another person.',
      parameters: {
        type: 'object',
        properties: { fact: { type: 'string', description: 'One sentence, in the third person: "Is retaking BCS2120 in period 4."' } },
        required: ['fact']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'forget',
      description: 'Remove a remembered fact by its id, when the student says it is wrong or no longer true.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
    }
  }
])

export function tutorSystemPrompt({ memory, briefing, today }) {
  const preferences = memory?.preferences || {}
  return [
    'You are the study tutor inside Wicker Study, a private academic workspace. You are talking to the student whose account this is.',
    `Today is ${today}.`,
    '',
    'Everything you say about dates, deadlines, grades, course content, or teaching staff must come from a tool. You have no other source. If a tool did not return it, say you do not know — and if `notConnected` names a source, say that source is not connected rather than implying the week is empty.',
    'Call a tool before answering any question about the student\'s situation. Do not answer from the conversation history alone; things change between turns.',
    '',
    `Answer length: ${preferences.answerLength || 'normal'}. Tone: ${preferences.tone || 'direct'}.`,
    preferences.proactive === 'no' ? 'Answer what was asked and stop. Do not volunteer next steps.' : 'When it helps, end with the single most useful next step — one, not a list.',
    'No exclamation marks, no emoji, no cheerleading. Do not open with "Great question".',
    'Prefer specifics over hedging: a date, a course code, a room, a number.',
    '',
    memory?.facts?.length
      ? `Things you have been asked to remember:\n${memory.facts.map((entry) => `- (${entry.id}) ${entry.fact}`).join('\n')}`
      : 'You have not been asked to remember anything yet.',
    '',
    briefing ? `Their situation as of this turn, so you can answer simple questions without a tool call — but call get_briefing when they ask about the week, priorities, or anything due:\n${JSON.stringify(briefing)}` : ''
  ].filter(Boolean).join('\n')
}

// ── Tools ─────────────────────────────────────────────────────────────────

function courseFacts(code) {
  const wanted = String(code || '').trim().toUpperCase()
  const catalogue = loadEditorialProgrammeCatalogue()
  for (const programme of catalogue.programmes) {
    for (const version of programme.versions) {
      const course = version.courses.find((entry) => entry.code.toUpperCase() === wanted)
      if (course) {
        return {
          ...course,
          programme: `${programme.degree} ${programme.name}`,
          curriculum: version.id,
          // Enrichment is optional, so say when it is absent rather than
          // letting a null read as "this course has no coordinator".
          detailAvailable: Boolean(course.description),
          note: course.description ? null : 'Only the curriculum entry is maintained for this course; its description and coordinator have not been imported yet.'
        }
      }
    }
  }
  return { found: false, code: wanted, note: 'No maintained course with that code. It may be from a programme that is not in the catalogue, or the code may be wrong.' }
}

export const TUTOR_HANDLERS = {
  async get_briefing({ days = 7 }) {
    return studyBriefing({ days: Math.min(31, Math.max(1, Number(days) || 7)) })
  },
  async get_schedule({ from, to }) {
    const { workspace } = await readAcademicState()
    const feeds = []
    for (const link of workspace?.calendars || []) {
      try { feeds.push({ link, events: await feedEvents(link) }) } catch {}
    }
    const canvas = { assignments: [], events: [] }
    for (const connection of await listCanvasConnections().catch(() => [])) {
      try {
        const { token } = await canvasAccessToken({ canvasUrl: connection.origin })
        const hub = await fetchCanvasHub({ origin: connection.origin, token, scope: 'current', parts: ['assignments', 'events'], days: 30 })
        canvas.assignments.push(...hub.assignments)
        canvas.events.push(...hub.events)
      } catch {}
    }
    const catalogue = loadEditorialProgrammeCatalogue()
    const programme = catalogue.programmes.find((entry) => entry.id === workspace?.programmeTemplate?.programmeId)
    const result = aggregateCalendar({ workspace: workspace || { courses: [] }, institutionCalendar: programme?.calendar || [], feeds, canvas })
    const events = result.events
      .filter((event) => String(event.start).slice(0, 10) >= String(from) && String(event.start).slice(0, 10) <= String(to))
      .slice(0, 120)
      .map((event) => ({ when: event.start, category: event.category, course: event.courseCode, title: event.title, status: event.canvasStatusLabel || null }))
    return { from, to, count: events.length, events, timetableConnected: feeds.length > 0 }
  },
  async get_course_facts({ code }) { return courseFacts(code) },
  async get_progress() {
    const [progress, { workspace }] = await Promise.all([academicProgress().catch(() => null), readAcademicState()])
    return {
      programme: workspace?.profile?.programme || null,
      plannedCourses: (workspace?.courses || []).length,
      record: progress?.latest?.summary || null,
      since: progress?.since ? { ectsDelta: progress.since.ectsDelta, newlyPassed: progress.since.newlyPassed?.map((course) => course.code) } : null,
      readings: progress?.snapshots?.length || 0,
      note: progress?.snapshots?.length ? null : 'No academic record has been uploaded, so credits and grades are unknown.'
    }
  },
  async get_announcements({ days = 21 }) {
    const out = []
    for (const connection of await listCanvasConnections().catch(() => [])) {
      try {
        const { token } = await canvasAccessToken({ canvasUrl: connection.origin })
        const hub = await fetchCanvasHub({ origin: connection.origin, token, scope: 'current', parts: ['announcements'], days })
        out.push(...hub.announcements.map((item) => ({ course: item.courseCode, title: item.title, postedAt: item.postedAt, author: item.author, excerpt: item.excerpt, url: item.url })))
      } catch (error) {
        return { announcements: [], error: error instanceof Error ? error.message : 'Canvas could not be reached.' }
      }
    }
    return out.length ? { announcements: out.slice(0, 25) } : { announcements: [], note: 'Canvas is not connected, or there is nothing in this window.' }
  },
  async remember({ fact }) {
    const result = await rememberFact(fact)
    return { remembered: result.stored.fact, id: result.stored.id, duplicate: result.duplicate }
  },
  async forget({ id }) {
    return { forgotten: await forgetFact(String(id || '')) }
  }
}

export async function runTutorTool(name, args) {
  const handler = TUTOR_HANDLERS[name]
  if (!handler) return { error: `Unknown tool "${name}".` }
  try { return await handler(args || {}) }
  catch (error) { return { error: error instanceof Error ? error.message : 'That could not be read.' } }
}

/**
 * One tutor turn. The briefing is fetched up front and put in the system
 * prompt so a simple question does not cost a tool round trip; the model is
 * still told to call get_briefing for anything about the week, because the
 * cached copy is one turn old.
 */
export async function runTutorTurn(conversation, { message }) {
  const [memory, briefing] = await Promise.all([
    readTutorMemory(),
    studyBriefing({ days: 7 }).catch(() => null)
  ])
  const compact = briefing ? {
    today: briefing.today,
    period: briefing.period?.label || null,
    counts: briefing.counts,
    notConnected: briefing.notConnected,
    topPriorities: briefing.priorities.slice(0, 5)
  } : null

  const history = (conversation.messages || []).slice(-30)
  const messages = [
    { role: 'system', content: tutorSystemPrompt({ memory, briefing: compact, today: briefing?.today || new Date().toISOString().slice(0, 10) }) },
    ...history.map(({ role, content, tool_calls, tool_call_id, name }) => ({ role, content, ...(tool_calls ? { tool_calls } : {}), ...(tool_call_id ? { tool_call_id } : {}), ...(name ? { name } : {}) })),
    { role: 'user', content: message }
  ]

  const remembered = []
  const { added, usage, exhausted } = await runToolLoop({
    messages,
    tools: TUTOR_TOOLS,
    runTool: runTutorTool,
    maxRounds: 5,
    onToolCall: (name, args, result) => { if (name === 'remember' && result?.remembered) remembered.push(result.remembered) }
  })

  return {
    added: [{ role: 'user', content: message, at: new Date().toISOString() }, ...added],
    usage,
    remembered,
    exhausted
  }
}
