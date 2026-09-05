// The permanent tutor: a conversation that can see the student's actual
// situation and their course material, and remembers what it is told to.
//
// Every claim it makes about dates, deadlines, grades, or course content comes
// from a tool. It has no other source, and it is told to say so rather than
// guess — a tutor that invents a deadline is worse than one that admits it
// cannot see the timetable.

import { randomUUID } from 'node:crypto'
import { runToolLoop, chatAvailable } from './model-loop.mjs'
import { studyBriefing } from './study-briefing.mjs'
import { aggregateCalendar, feedEvents } from './calendar-feed.mjs'
import { readAcademicState } from './academics.mjs'
import { academicProgress } from './academic-snapshots.mjs'
import { listCanvasConnections, canvasAccessToken } from './canvas-connections.mjs'
import { fetchCanvasHub } from './canvas-hub.mjs'
import { loadEditorialProgrammeCatalogue } from './editorial-programmes.mjs'
import { loadEditorialState } from './editorial-store.mjs'
import { canvasPriorityProfiles } from './priority-evidence.mjs'
import { currentUserId } from './request-context.mjs'
import { formatRetrievalContext, retrieveCanvasCorpus, retrieveCourseContent, retrievalMode } from './retrieval-store.mjs'
import { retrieveProgrammePolicies } from './programme-policy-sources.mjs'
import { readTutorMemory } from './tutor-store.mjs'
import { searchTutorAttachments } from './tutor-attachments.mjs'
import { planningContext, updatePlanningObjective } from './workspace/planner.mjs'

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
      description: 'What the university publishes about a course: description, official coordinator, prerequisites, recommended reading, teaching and assessment methods, credits, and the teaching window. Use for stable catalogue facts. For who currently teaches lectures, tutorials or labs, use get_course_staff instead.',
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
      name: 'get_course_staff',
      description: 'Fast, course-scoped lookup for who currently teaches or coordinates a course. It checks the selected curriculum entry and only a few high-signal passages from that course. Distinguish the official coordinator from the people currently responsible for lectures, tutorials or labs. Use this exactly once for staff questions; do not also search every course or fetch all announcements unless it returns no evidence.',
      parameters: {
        type: 'object',
        properties: { courseCode: { type: 'string', description: 'Course code, e.g. BCS3210.' } },
        required: ['courseCode']
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
      name: 'get_planning_context',
      description: 'The student\'s private exam scenario: which sitting each course is planned for, expected grades, what-if outcomes, actual dated examination windows, registration dates, and whether progression gates remain safe. One calendar window can combine a period\'s primary exams with another period\'s resits; use each course\'s allowed destination role. Recorded academic facts are labelled separately. Use for any question about their plan, resits, deferrals, expected grades, or how a decision affects degree progress.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_announcements',
      description: 'Recent Canvas announcements, optionally restricted to one course. Use for "did I miss anything" or "what has been announced". For a named course, always pass courseCode. Do not use this as a second broad search after get_course_staff.',
      parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 120, description: 'Default 21.' }, courseCode: { type: 'string', description: 'Optional course code.' }, limit: { type: 'integer', minimum: 1, maximum: 8, description: 'Maximum returned announcements. Default 5.' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_programme_regulations',
      description: 'Focused retrieval from the official programme-level regulations connected to this student: Education and Examination Regulations, Rules and Regulations, Board of Examiners rules, exam and resit procedures, registration, inspection, appeals, exemptions, fraud, hardship, projects, internships and transition rules. Use this first for regulatory or procedural questions. It is separate from course material and returns page-level evidence.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The concrete rule or procedure to retrieve.' },
          academicYear: { type: 'string', description: 'Optional exact academic year, e.g. 2026-2027.' },
          documentKind: { type: 'string', enum: ['education-examination-regulations', 'rules-regulations', 'board-of-examiners', 'exam-procedure', 'programme-policy', 'other'] }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_study_sources',
      description: 'Retrieve passages from maintained course material and the student\'s private Canvas corpus. Use for explanations, exercises, syllabus questions, requirements, assignments, submission details, and any claim that should cite course material. The current course lens is used when courseCode is omitted; omit courseCode only for a genuinely workspace-wide question.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The concrete concept or requirement to retrieve.' },
          courseCode: { type: 'string', description: 'Optional course code, e.g. BCS1540.' },
          sourceType: { type: 'string', enum: ['syllabus', 'requirements', 'slides', 'assessments', 'activities', 'readings', 'materials'] }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_course_obligations',
      description: 'Verified or review-needed attendance rules, assignments, group projects, presentations, deadlines, minimums, pass rules and resit rules extracted from course sources. Use whenever absence, attendance, group work, assessment obligations, or consequences are involved. Never upgrade needs-review evidence into a confirmed requirement.',
      parameters: { type: 'object', properties: { courseCode: { type: 'string', description: 'Optional course code. Omit to check every active course.' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_practice_set',
      description: 'Stage a private practice set for student approval. This does not create anything. Use only after the student asks for exercises or when a practice set is the clearest next step.',
      parameters: {
        type: 'object',
        properties: {
          courseCode: { type: 'string' },
          chapterId: { type: 'string' },
          topic: { type: 'string' },
          count: { type: 'integer', minimum: 4, maximum: 20 },
          types: { type: 'array', items: { type: 'string', enum: ['written', 'calc', 'tf', 'mc', 'pseudocode'] } }
        },
        required: ['courseCode', 'topic']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_calendar_action',
      description: 'Stage a personal planning entry for approval, such as an unavailable day, a replacement study block, or a reminder. This does not change the calendar.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
          endDate: { type: 'string', description: 'Optional ISO end date.' },
          notes: { type: 'string' },
          kind: { type: 'string', enum: ['availability', 'study', 'deadline', 'other'] }
        },
        required: ['title', 'date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_remember_plan',
      description: 'Stage a bounded availability or study constraint for approval so it can inform future conversations and plans. This does not remember anything until the student approves it.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          startDate: { type: 'string', description: 'Optional ISO date YYYY-MM-DD.' },
          endDate: { type: 'string', description: 'Optional ISO date YYYY-MM-DD.' },
          recurrence: { type: 'string', enum: ['none', 'weekly'] },
          behaviour: { type: 'string', description: 'How Tutor should adapt future planning.' }
        },
        required: ['title', 'behaviour']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_planning_update',
      description: 'Stage one change to a course in the saved exam scenario for approval. This does not update the plan. Call get_planning_context first and use a session id listed in that course\'s planningRules.allowedSessionIds. Check allowedDestinations for the course-specific role because one dated window may contain both primary exams and earlier-period resits. These rules come from its recorded teaching period, academic calendar, transcript fallback, and verified resit rules. Use for resits, deferrals, expected grades, or restoring a course to the current sitting.',
      parameters: {
        type: 'object',
        properties: {
          courseCode: { type: 'string', description: 'Course code from planning context.' },
          mode: { type: 'string', enum: ['current', 'resit', 'none'] },
          targetSession: { type: 'string', description: 'Stable session id from get_planning_context.' },
          expectedGrade: { type: 'number' },
          clearExpectedGrade: { type: 'boolean' },
          outcome: { type: 'string', enum: ['actual', 'pass', 'fail'] }
        },
        required: ['courseCode']
      }
    }
  }
])

export function tutorSystemPrompt({ memory, briefing, planner, context, today, now = new Date() }) {
  const preferences = memory?.preferences || {}
  return [
    'You are the study tutor inside Wicker Study, a private academic workspace. You are talking to the student whose account this is.',
    // A date alone cannot answer "what is next"; asked, the tutor had to ask
    // the student what time it was.
    `Right now it is ${new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Amsterdam' }).format(now)} (Europe/Amsterdam, the university's timezone). Use it to answer "next", "today", and "still time to".`,
    '',
    'Everything you say about dates, deadlines, grades, course content, or teaching staff must come from a tool. You have no other source. If a tool did not return it, say you do not know — and if `notConnected` names a source, say that source is not connected rather than implying the week is empty.',
    'Call a tool before answering any question about the student\'s situation. Do not answer from the conversation history alone; things change between turns.',
    'For institution or programme regulations, the Board of Examiners, exam or resit procedures, exam registration, inspection, appeals, exemptions, hardship, fraud, transition rules, internships, or formal programme requirements, call search_programme_regulations first. Do not scan course sources for a programme-level rule. For course explanations, syllabus claims, exercises, or assignment requirements, call search_study_sources. For a teaching-staff question, call get_course_staff exactly once and distinguish official coordinator from current teaching roles. For course-specific absences, attendance, group work, or assessment consequences, also call get_course_obligations and get_schedule. For the student\'s saved resit choice, deferral, expected grade, or degree-plan consequence, call get_planning_context.',
    'Never change the student\'s data directly. Practice sets, calendar entries, remembered plans, and exam-scenario changes are proposals. Explain the exact effect, call the matching propose_* tool, and tell the student it is waiting for their approval.',
    'Do not print a bibliography or a Sources section in the answer. The interface renders the evidence returned by your tools in a collapsed panel. Keep the prose focused on the answer.',
    '',
    `Answer length: ${preferences.answerLength || 'normal'}. Tone: ${preferences.tone || 'direct'}.`,
    preferences.proactive === 'no' ? 'Answer what was asked and stop. Do not volunteer next steps.' : 'When it helps, end with the single most useful next step — one, not a list.',
    'No exclamation marks, no emoji, no cheerleading. Do not open with "Great question".',
    'Prefer specifics over hedging: a date, a course code, a room, a number.',
    '',
    memory?.facts?.length
      ? `Things you have been asked to remember:\n${memory.facts.map((entry) => `- (${entry.id}) ${entry.fact}`).join('\n')}`
      : 'You have not been asked to remember anything yet.',
    memory?.plans?.length
      ? `Approved plans and availability constraints:\n${memory.plans.map((entry) => `- (${entry.id}) ${entry.title}${entry.startDate ? ` from ${entry.startDate}${entry.endDate && entry.endDate !== entry.startDate ? ` to ${entry.endDate}` : ''}` : ''}${entry.recurrence === 'weekly' ? ', weekly' : ''}. Planning behaviour: ${entry.behaviour || 'Use this when planning.'}`).join('\n')}`
      : 'There are no approved availability plans yet.',
    context?.courseCode
      ? `Current lens: ${context.courseCode}${context.courseName ? ` — ${context.courseName}` : ''}${context.chapterName ? `, ${context.chapterName}` : ''}. Treat this as a relevance boost, not a boundary. You may and should check other courses when the question crosses the workspace.`
      : 'Current lens: workspace-wide across active courses and connected sources.',
    '',
    briefing ? `Their situation as of this turn, so you can answer simple questions without a tool call — but call get_briefing when they ask about the week, priorities, or anything due:\n${JSON.stringify(briefing)}` : '',
    planner ? `Their saved planning scenario as of this turn — call get_planning_context before relying on it or proposing a change because its revision may have moved:\n${JSON.stringify(planner)}` : ''
  ].filter(Boolean).join('\n')
}

// ── Tools ─────────────────────────────────────────────────────────────────

function courseFacts(code, workspace = null) {
  const wanted = String(code || '').trim().toUpperCase()
  const catalogue = loadEditorialProgrammeCatalogue()
  const preferredProgramme = catalogue.programmes.find((entry) => entry.id === workspace?.programmeTemplate?.programmeId)
  const placements = catalogue.programmes.flatMap((programme) => programme.versions.flatMap((version) => {
    const course = version.courses.find((entry) => entry.code.toUpperCase() === wanted)
    return course ? [{ programme, version, course }] : []
  }))
  placements.sort((left, right) =>
    Number(right.programme.id === preferredProgramme?.id && right.version.id === workspace?.programmeTemplate?.versionId)
      - Number(left.programme.id === preferredProgramme?.id && left.version.id === workspace?.programmeTemplate?.versionId)
    || Number(right.programme.id === preferredProgramme?.id) - Number(left.programme.id === preferredProgramme?.id)
    || Number(right.version.status === 'current') - Number(left.version.status === 'current')
    || String(right.version.id).localeCompare(String(left.version.id))
  )
  const match = placements[0]
  if (match) {
    const { programme, version, course } = match
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
  return { found: false, code: wanted, note: 'No maintained course with that code. It may be from a programme that is not in the catalogue, or the code may be wrong.' }
}

const clean = (value, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const isoDay = (value) => /^20\d{2}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10)) ? String(value).slice(0, 10) : null

export function tutorTurnNeedsBriefing(message = '') {
  return /\b(today|tomorrow|tonight|week|weekend|next|due|deadline|priority|priorities|schedule|calendar|lecture|tutorial|lab|class|exam|quiz|assignment|announcement|miss|missing|overdue|attend|attendance|work shift|take care of)\b/i.test(String(message))
}

export function normalizeTutorContext(value = {}) {
  return {
    courseId: clean(value.courseId, 120) || null,
    courseCode: clean(value.courseCode, 40).toUpperCase() || null,
    courseName: clean(value.courseName, 160) || null,
    chapterId: clean(value.chapterId, 120) || null,
    chapterName: clean(value.chapterName, 200) || null,
    sourcePath: clean(value.sourcePath, 500) || null,
    attachmentIds: [...new Set((Array.isArray(value.attachmentIds) ? value.attachmentIds : []).map((id) => clean(id, 120)).filter(Boolean))].slice(0, 12)
  }
}

async function courseDirectory() {
  const [{ workspace }, editorial] = await Promise.all([
    readAcademicState(),
    loadEditorialState(new URL('../data/study-state.template.json', import.meta.url))
  ])
  const activeCodes = new Set((workspace?.courses || []).map((course) => clean(course.code, 40).toUpperCase()).filter(Boolean))
  const courses = (editorial?.courses || []).filter((course) => !activeCodes.size || activeCodes.has(clean(course.code, 40).toUpperCase()))
  return { workspace, courses }
}

function findCourse(courses, { courseId, courseCode } = {}) {
  const id = clean(courseId, 120)
  const code = clean(courseCode, 40).toUpperCase()
  if (code) return courses.find((course) => clean(course.code, 40).toUpperCase() === code) || null
  return id ? courses.find((course) => course.id === id) || null : null
}

function sourceEvidence(chunk, index) {
  const sourcePath = clean(chunk.sourcePath, 500) || 'Course source'
  const course = clean(chunk.courseCode, 40) || null
  const page = Number(chunk.page) || null
  const editionLabels = [...new Set((Array.isArray(chunk.editions) ? chunk.editions : [])
    .map((edition) => clean(edition?.academicYear, 30) ? `${clean(edition.academicYear, 30)}${clean(edition.period, 10) ? ` P${clean(edition.period, 10)}` : ''}` : '')
    .filter(Boolean))]
  const fallbackEdition = clean(chunk.academicYear, 30)
    ? `${clean(chunk.academicYear, 30)}${clean(chunk.period, 10) ? ` P${clean(chunk.period, 10)}` : ''}`
    : null
  const edition = editionLabels.length ? `${editionLabels.length > 1 ? 'Canvas editions' : 'Canvas edition'} ${editionLabels.join(', ')}` : fallbackEdition ? `Canvas edition ${fallbackEdition}` : null
  const policy = chunk.corpus === 'programme-policy'
  const policyOrigin = policy && chunk.sourceProvenance?.kind === 'canvas-course'
    ? `Canvas ${clean(chunk.sourceProvenance.courseCode, 40)} · ${clean(chunk.sourceProvenance.courseName, 120)}`
    : null
  const location = [sourcePath, page ? `p. ${page}` : null, edition, policy ? clean(chunk.academicYear, 30) : null, policy ? clean(chunk.authority, 180) : null, policyOrigin].filter(Boolean).join(', ')
  return {
    id: clean(`${chunk.corpus || 'course'}:${chunk.assetId || chunk.courseId || course || 'source'}:${sourcePath}:${page || 'page'}:${chunk.chunkIndex ?? index}`, 800),
    sourceType: policy ? 'Programme regulation' : clean(chunk.sourceType, 60) || (chunk.corpus === 'canvas' ? 'Canvas course material' : 'Maintained course material'),
    title: clean(chunk.title, 240) || sourcePath.split('/').pop() || sourcePath,
    course,
    location,
    excerpt: clean(chunk.content, 700),
    url: clean(chunk.materialUrl || chunk.sourceUrl, 600) || null,
    status: chunk.current === false ? 'historical' : policy && chunk.visibility === 'programme' ? 'programme-only' : policy && chunk.visibility === 'university' ? 'university-source' : editionLabels.length > 1 ? 'versioned' : 'current',
    updatedAt: chunk.canvasUpdatedAt || chunk.lastSeenAt || null
  }
}

export function proposalFromTool(name, result) {
  return name.startsWith('propose_') && result?.proposal ? result.proposal : null
}

export function evidenceFromTool(name, result) {
  if (Array.isArray(result?.evidence)) return result.evidence
  if (name === 'get_announcements' && Array.isArray(result?.announcements)) {
    return result.announcements.map((item, index) => ({
      id: `announcement:${item.url || item.title || index}`,
      sourceType: 'Canvas announcement',
      title: item.title,
      course: item.course || null,
      location: item.postedAt || 'Canvas',
      excerpt: item.excerpt || '',
      url: item.url || null,
      status: 'current'
    }))
  }
  if (name === 'get_briefing') {
    return [
      ...(result?.priorities || []).map((item, index) => ({ id: `priority:${item.url || item.title || index}`, sourceType: item.url ? 'Canvas assignment' : item.kind === 'exam' ? 'Academic calendar' : 'Study record', title: item.title, course: item.course || null, location: item.when || '', excerpt: item.why || '', url: item.url || null, status: 'current' })),
      ...(result?.announcements || []).map((item, index) => ({ id: `brief-announcement:${item.url || item.title || index}`, sourceType: 'Canvas announcement', title: item.title, course: item.course || null, location: item.postedAt || '', excerpt: item.excerpt || '', url: item.url || null, status: 'current' }))
    ]
  }
  if (name === 'get_schedule' && Array.isArray(result?.events)) {
    return result.events.map((item, index) => ({ id: `schedule:${item.when}:${item.course || ''}:${index}`, sourceType: item.category === 'timetable' ? 'Timetable' : item.category === 'exam' ? 'Academic calendar' : 'Calendar', title: item.title, course: item.course || null, location: [item.when, item.room].filter(Boolean).join(' · '), excerpt: [item.activity, item.status].filter(Boolean).join(' · '), url: null, status: 'current' }))
  }
  return []
}

function proposal(type, title, summary, payload, detail, reversible = true) {
  return {
    id: `proposal-${randomUUID()}`,
    type,
    title: clean(title, 160),
    summary: clean(summary, 360),
    detail: clean(detail, 500),
    payload,
    reversible
  }
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
      .map((event) => ({
        when: event.start,
        category: event.category,
        course: event.courseCode,
        title: event.courseName || event.title,
        activity: event.activity || null,
        // The briefing carries the room; the schedule dropped it, so asked
        // where the next lecture was the tutor had to say it did not know.
        room: (String(event.notes || '').split('·')[1] || '').trim() || null,
        status: event.canvasStatusLabel || null
      }))
    return { from, to, count: events.length, events, timetableConnected: feeds.length > 0 }
  },
  async get_course_facts({ code }) {
    const { workspace } = await readAcademicState()
    return courseFacts(code, workspace)
  },
  async get_course_staff({ courseCode = '' } = {}, runtime = {}) {
    const lens = normalizeTutorContext(runtime.context)
    const code = clean(courseCode, 40).toUpperCase() || lens.courseCode || ''
    if (!code) return { error: 'A course code is required for a staff lookup.' }
    const { workspace, courses } = await courseDirectory()
    const workspaceCourse = (workspace?.courses || []).find((course) => clean(course.code, 40).toUpperCase() === code)
    const editorialCourse = findCourse(courses, { courseCode: code })
    const facts = courseFacts(code, workspace)
    const query = 'lecturer OR coordinator OR professor OR teacher OR instructor OR responsible OR lectures OR tutorials OR labs'
    const [published, canvas] = await Promise.all([
      editorialCourse ? retrieveCourseContent({ query, courseId: editorialCourse.id, limit: 2 }).catch(() => []) : [],
      retrieveCanvasCorpus({ query, courseCode: code, includeHistorical: false, limit: 5 }).catch(() => [])
    ])
    const chunks = [
      ...canvas,
      ...published.map((chunk) => ({ ...chunk, courseCode: code, courseName: editorialCourse?.name || workspaceCourse?.name, corpus: 'course' }))
    ].sort((left, right) => Number(right.score || 0) - Number(left.score || 0)).slice(0, 5)
    return {
      courseCode: code,
      courseName: workspaceCourse?.name || editorialCourse?.name || facts.name || null,
      officialCoordinator: facts.coordinator || null,
      curriculum: facts.curriculum || null,
      evidence: chunks.map(sourceEvidence),
      context: formatRetrievalContext(chunks),
      note: chunks.length
        ? 'The official coordinator and current teaching roles can differ. State each role separately and do not call everyone the professor.'
        : 'Only the selected curriculum coordinator is available; current lecture, tutorial and lab responsibilities could not be confirmed.'
    }
  },
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
  async get_planning_context() {
    const { workspace } = await readAcademicState()
    return planningContext(workspace)
  },
  async get_announcements({ days = 21, courseCode = '', limit = 5 }) {
    const out = []
    const wanted = clean(courseCode, 40).toUpperCase()
    for (const connection of await listCanvasConnections().catch(() => [])) {
      try {
        const { token } = await canvasAccessToken({ canvasUrl: connection.origin })
        const hub = await fetchCanvasHub({ origin: connection.origin, token, scope: 'current', parts: ['announcements'], days })
        out.push(...hub.announcements.map((item) => ({ course: item.courseCode, title: item.title, postedAt: item.postedAt, author: item.author, excerpt: item.excerpt, url: item.url })))
      } catch (error) {
        return { announcements: [], error: error instanceof Error ? error.message : 'Canvas could not be reached.' }
      }
    }
    const matching = wanted ? out.filter((item) => clean(item.course, 40).toUpperCase() === wanted) : out
    const count = Math.min(8, Math.max(1, Number(limit) || 5))
    return matching.length ? { announcements: matching.slice(0, count) } : { announcements: [], note: wanted ? `No recent ${wanted} announcement was found in this window.` : 'Canvas is not connected, or there is nothing in this window.' }
  },
  async search_programme_regulations({ query, academicYear = '', documentKind = '' }) {
    const { workspace } = await readAcademicState()
    const programmeId = clean(workspace?.programmeTemplate?.programmeId, 240)
    const year = clean(academicYear, 30) || clean(workspace?.profile?.academicYear, 30)
    const chunks = await retrieveProgrammePolicies({
      query,
      programmeId,
      academicYear: year,
      kinds: documentKind ? [documentKind] : [],
      limit: 8
    }).catch(() => [])
    return {
      query: clean(query, 500),
      programmeId: programmeId || null,
      academicYear: year || null,
      retrieval: retrievalMode(),
      evidence: chunks.map(sourceEvidence),
      context: formatRetrievalContext(chunks),
      note: chunks.length
        ? 'These are programme-level rules. Distinguish what the regulation says from advice about the student\'s individual case; the Board of Examiners decides requests within its authority.'
        : 'No matching indexed programme regulation was found for the active programme and academic year. Do not infer a formal rule from course material or general knowledge.'
    }
  },
  async search_study_sources({ query, courseCode = '', sourceType = '' }, runtime = {}) {
    const { courses } = await courseDirectory()
    const lens = normalizeTutorContext(runtime.context)
    const wanted = clean(courseCode, 40).toUpperCase() || lens.courseCode || ''
    const targets = wanted ? courses.filter((course) => clean(course.code, 40).toUpperCase() === wanted) : courses.slice(0, 8)
    const staffLookup = /\b(who|professor|lecturer|teacher|instructor|coordinator|staff|teaches|teaching)\b/i.test(String(query))
    const perCorpusLimit = staffLookup ? 3 : 8
    const groups = await Promise.all(targets.map(async (course) => {
      const [published, canvas] = await Promise.all([
        retrieveCourseContent({ query, courseId: course.id, sourcePath: lens.courseId === course.id ? lens.sourcePath : null, limit: perCorpusLimit }).catch(() => []),
        retrieveCanvasCorpus({ query, courseCode: course.code, sourceType, includeHistorical: !staffLookup, limit: perCorpusLimit }).catch(() => [])
      ])
      return [
        ...published.map((chunk) => ({ ...chunk, courseCode: course.code, courseName: course.name, corpus: 'course' })),
        ...canvas
      ]
    }))
    const privateSources = await searchTutorAttachments({ query, courseCode: wanted, attachmentIds: lens.attachmentIds, limit: staffLookup ? 2 : 10 }).catch(() => [])
    const privateChunks = privateSources.map((chunk) => ({
      ...chunk,
      corpus: 'private-upload',
      courseCode: chunk.attachment.courseCode,
      sourcePath: chunk.attachment.name,
      sourceType: 'Private Tutor source',
      assetId: chunk.attachment.id,
      materialUrl: `/api/tutor/attachments/${encodeURIComponent(chunk.attachment.id)}/file`,
      content: chunk.content,
      current: true
    }))
    const chunks = [...groups.flat(), ...privateChunks].sort((left, right) => Number(right.score || 0) - Number(left.score || 0)).slice(0, staffLookup ? 5 : 12)
    return {
      query: clean(query, 500),
      searchedCourses: targets.map((course) => course.code),
      retrieval: retrievalMode(),
      evidence: chunks.map(sourceEvidence),
      context: formatRetrievalContext(chunks),
      note: chunks.length ? null : 'No matching indexed passage was found. Do not infer the answer from general knowledge.'
    }
  },
  async get_course_obligations({ courseCode = '' } = {}, runtime = {}) {
    const { courses } = await courseDirectory()
    const lens = normalizeTutorContext(runtime.context)
    const wanted = clean(courseCode, 40).toUpperCase() || lens.courseCode || ''
    const scans = await canvasPriorityProfiles({ accountId: currentUserId() }).catch(() => [])
    const scansByCode = new Map(scans.map((item) => [clean(item.courseCode, 40).toUpperCase(), item]))
    const targets = courses.filter((course) => !wanted || clean(course.code, 40).toUpperCase() === wanted)
    const obligations = targets.map((course) => {
      const scan = scansByCode.get(clean(course.code, 40).toUpperCase())
      const published = course.courseProfile?.assessment
      const assessment = published?.status === 'confirmed' ? published : scan?.courseProfile?.assessment || published || null
      return {
        courseCode: course.code,
        courseName: course.name,
        status: assessment?.status || scan?.status || 'not-found',
        attendanceRules: assessment?.attendanceEvidence || assessment?.attendanceRules || [],
        components: assessment?.components || [],
        overallPassRules: assessment?.overallPassRules || [],
        resitRules: assessment?.resitRules || [],
        conflicts: assessment?.conflicts || scan?.conflicts || [],
        scannedAt: scan?.scannedAt || null
      }
    })
    const evidence = obligations.flatMap((course) => [
      ...(course.attendanceRules || []).flatMap((rule, index) => {
        const refs = Array.isArray(rule?.evidence) ? rule.evidence : []
        const title = typeof rule === 'string' ? rule : rule.text
        return (refs.length ? refs : [{ chunkId: index + 1 }]).map((ref) => ({ id: `obligation:${course.courseCode}:attendance:${ref.chunkId || index}`, sourceType: 'Course requirement', title: clean(title, 180) || 'Attendance requirement', course: course.courseCode, location: ref.chunkId ? `Indexed evidence · chunk ${ref.chunkId}` : 'Maintained course profile', excerpt: clean(title, 700), url: null, status: course.status }))
      }),
      ...(course.components || []).flatMap((component, index) => {
        const refs = Array.isArray(component?.evidence) ? component.evidence : []
        return (refs.length ? refs : [{ chunkId: index + 1 }]).map((ref) => ({ id: `obligation:${course.courseCode}:component:${ref.chunkId || index}`, sourceType: 'Assessment requirement', title: component.name, course: course.courseCode, location: ref.chunkId ? `Indexed evidence · chunk ${ref.chunkId}` : 'Maintained course profile', excerpt: clean([component.deadlineText, component.notes].filter(Boolean).join(' · '), 700), url: null, status: course.status }))
      })
    ])
    return { obligations, evidence, note: obligations.some((item) => item.status !== 'not-found') ? null : 'No verified course obligations were found in the connected sources.' }
  },
  async propose_practice_set({ courseCode, chapterId = '', topic, count = 10, types = [] }, runtime = {}) {
    const { courses } = await courseDirectory()
    const lens = normalizeTutorContext(runtime.context)
    const course = findCourse(courses, { courseCode: courseCode || lens.courseCode, courseId: lens.courseId })
    if (!course) return { error: 'The proposed practice set needs a recognised active course.' }
    const chapter = (course.chapters || []).find((item) => item.id === chapterId)
      || (course.chapters || []).find((item) => clean(item.name).toLowerCase().includes(clean(topic).toLowerCase()))
      || (lens.chapterId ? (course.chapters || []).find((item) => item.id === lens.chapterId) : null)
    if (!chapter) return { error: 'The proposed practice set needs a specific published chapter.' }
    const questionTypes = [...new Set((types || []).filter((type) => ['written', 'calc', 'tf', 'mc', 'pseudocode'].includes(type)))]
    const quantity = Math.min(20, Math.max(4, Number(count) || 10))
    return { proposal: proposal(
      'practice-set',
      `Create ${quantity}-question practice set`,
      `${course.code} · ${chapter.name}`,
      { courseId: course.id, courseCode: course.code, courseName: course.name, chapterId: chapter.id, chapterName: chapter.name, topic: clean(topic, 240), count: quantity, types: questionTypes },
      `${questionTypes.length ? questionTypes.join(', ') : 'Mixed question types'} · private set`,
      true
    ) }
  },
  async propose_calendar_action({ title, date, endDate = '', notes = '', kind = 'other' }) {
    const start = isoDay(date)
    const end = isoDay(endDate) || start
    if (!start) return { error: 'A planning proposal needs a valid date.' }
    const type = ['availability', 'study', 'deadline', 'other'].includes(kind) ? kind : 'other'
    return { proposal: proposal('calendar-event', title, start === end ? start : `${start} to ${end}`, { title: clean(title, 160), date: start, endDate: end, notes: clean(notes, 500), kind: type }, clean(notes, 500) || 'Add this to the personal academic plan.', true) }
  },
  async propose_remember_plan({ title, startDate = '', endDate = '', recurrence = 'none', behaviour }) {
    const start = isoDay(startDate)
    const end = isoDay(endDate) || start
    const repeats = recurrence === 'weekly' ? 'weekly' : 'none'
    return { proposal: proposal('remember-plan', `Remember: ${title}`, start ? (start === end ? start : `${start} to ${end}`) : 'Ongoing plan', { title: clean(title, 160), startDate: start, endDate: end, recurrence: repeats, behaviour: clean(behaviour, 400) }, clean(behaviour, 400), true) }
  },
  async propose_planning_update({ courseCode, mode, targetSession, expectedGrade, clearExpectedGrade = false, outcome }) {
    const { workspace } = await readAcademicState()
    const patch = {
      ...(mode !== undefined ? { mode } : {}),
      ...(targetSession !== undefined ? { targetSession } : {}),
      ...(clearExpectedGrade ? { expectedGrade: null } : expectedGrade !== undefined ? { expectedGrade } : {}),
      ...(outcome !== undefined ? { outcome } : {})
    }
    const update = updatePlanningObjective(workspace, clean(courseCode, 40).toUpperCase(), patch)
    if (JSON.stringify(update.before) === JSON.stringify(update.after)) return { error: `${update.course.code} already has that planning objective.` }
    const context = planningContext(update.workspace)
    const planned = context.courses.find((course) => course.id === update.course.id)?.plannedSession
    const summary = update.after.mode === 'none' ? 'Following year' : planned?.label || (update.after.mode === 'resit' ? 'Resit session' : 'Current sitting')
    const detail = [update.after.expectedGrade !== undefined ? `Expected grade ${update.after.expectedGrade}` : 'No expected grade', update.after.outcome !== 'actual' ? `What-if outcome: ${update.after.outcome}` : 'Recorded outcome only'].join(' · ')
    return { proposal: proposal('planning-objective', `Update ${update.course.code} exam plan`, summary, { courseId: update.course.id, expectedRevision: workspace.revision, objective: update.after }, detail, true) }
  }
}

export async function runTutorTool(name, args, runtime = {}) {
  const handler = TUTOR_HANDLERS[name]
  if (!handler) return { error: `Unknown tool "${name}".` }
  try { return await handler(args || {}, runtime) }
  catch (error) { return { error: error instanceof Error ? error.message : 'That could not be read.' } }
}

/**
 * One tutor turn. The briefing is fetched up front and put in the system
 * prompt so a simple question does not cost a tool round trip; the model is
 * still told to call get_briefing for anything about the week, because the
 * cached copy is one turn old.
 */
export async function runTutorTurn(conversation, { message, context = {} }) {
  const lens = normalizeTutorContext(context)
  const [memory, academicState, briefing] = await Promise.all([
    readTutorMemory(),
    readAcademicState().catch(() => null),
    tutorTurnNeedsBriefing(message) ? studyBriefing({ days: 7 }).catch(() => null) : Promise.resolve(null)
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
    { role: 'system', content: tutorSystemPrompt({ memory, briefing: compact, planner: academicState?.workspace ? planningContext(academicState.workspace) : null, context: lens, today: briefing?.today || new Date().toISOString().slice(0, 10), now: new Date() }) },
    ...history.map(({ role, content, tool_calls, tool_call_id, name }) => ({ role, content, ...(tool_calls ? { tool_calls } : {}), ...(tool_call_id ? { tool_call_id } : {}), ...(name ? { name } : {}) })),
    { role: 'user', content: message }
  ]

  const proposals = []
  const evidence = []
  const { added, usage, exhausted } = await runToolLoop({
    messages,
    tools: TUTOR_TOOLS,
    runTool: (name, args) => runTutorTool(name, args, { context: lens }),
    maxRounds: 5,
    maxOutputTokens: 2200,
    onToolCall: (name, args, result) => {
      const staged = proposalFromTool(name, result)
      if (staged) proposals.push(staged)
      evidence.push(...evidenceFromTool(name, result))
    }
  })

  const uniqueEvidence = [...new Map(evidence.filter((item) => item?.id).map((item) => [item.id, item])).values()].slice(0, 10)
  const lastAnswer = [...added].reverse().find((entry) => entry.role === 'assistant' && String(entry.content || '').trim())
  if (lastAnswer) {
    lastAnswer.evidence = uniqueEvidence
    lastAnswer.proposals = proposals
    lastAnswer.context = lens
  }

  return {
    added: [{ role: 'user', content: message, at: new Date().toISOString(), context: lens }, ...added],
    usage,
    proposals,
    evidence: uniqueEvidence,
    exhausted
  }
}
