// Executing what the setup conversation decides.
//
// The model chooses which tool to call and when. What each tool then does is
// ordinary code: it reads the catalogue, writes the workspace, saves a feed.
// The model never produces a course list, a credit total, or a connection
// result — it is told the outcome and reports it.

import { loadEditorialProgrammeCatalogue } from './editorial-programmes.mjs'
import { lookupUmProgramme } from './programme-lookup.mjs'
import { findProgrammes, OnboardingError } from './onboarding-agent.mjs'
import { readAcademicState, saveActiveAcademicWorkspace, normalizeAcademicWorkspace } from './academics.mjs'
import { canvasAccessToken, listCanvasConnections, removeCanvasConnection, saveCanvasConnection } from './canvas-connections.mjs'
import { setCanvasCorpusPermission } from './course-corpus.mjs'
import { normalizeCalendarLink, fetchCalendar } from './academic-documents.mjs'
import { resolveAcademicTimeContext } from './calendar-feed.mjs'
import { listAcademicSnapshots } from './academic-snapshots.mjs'
import { fetchCanvasHub } from './canvas-hub.mjs'
import { currentAuth } from './request-context.mjs'
import { validateSetupSources } from './setup-validation.mjs'

const CURRENT_ACADEMIC_YEAR = () => {
  const now = new Date()
  // A Dutch academic year starts in September.
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${start + 1}`
}

export async function setupState() {
  const [{ workspace }, connections, snapshots] = await Promise.all([
    readAcademicState(),
    listCanvasConnections().catch(() => []),
    listAcademicSnapshots({ withCourses: true }).catch(() => [])
  ])
  const snapshot = snapshots.find((entry) => entry.kind !== 'transcript') || null
  const transcriptSnapshot = snapshots.find((entry) => entry.kind === 'transcript') || null
  const catalogue = loadEditorialProgrammeCatalogue()
  const programmeId = workspace?.programmeTemplate?.programmeId || null
  const programme = programmeId ? catalogue.programmes.find((entry) => entry.id === programmeId) : null
  const issues = validateSetupSources({
    programmeName: workspace?.profile?.programme,
    recordProgramme: snapshot?.summary?.programme,
    selectedCourses: workspace?.courses,
    recordCourses: snapshot?.courses
  })
  return {
    programme: Boolean(workspace?.profile?.programme || workspace?.courses?.length),
    programmeName: workspace?.profile?.programme || null,
    customProgramme: Boolean(workspace?.profile?.programme && !programmeId),
    courseCount: workspace?.courses?.length || 0,
    record: Boolean(snapshot),
    recordSummary: snapshot?.summary || null,
    transcript: Boolean(transcriptSnapshot) || (workspace?.courses || []).some((course) => (course.attempts || []).some((attempt) => attempt.examDate || attempt.grade != null)),
    transcriptAttempts: transcriptSnapshot?.courses?.reduce((total, course) => total + Math.max(1, (course.attempts || []).length), 0) || (workspace?.courses || []).reduce((total, course) => total + (course.attempts || []).length, 0),
    calendar: (programme?.calendar || []).length > 0,
    calendarDates: (programme?.calendar || []).length,
    timetable: (workspace?.calendars || []).length > 0,
    timetableEvents: (workspace?.calendars || []).reduce((total, link) => total + (link.eventCount || 0), 0),
    canvas: connections.length > 0,
    issues,
    // An unanswered elective group is a hole in the plan that looks like an
    // answer, so setup and the dashboard both need to see it.
    ...electiveState(workspace, programme)
  }
}

function electiveState(workspace, programme) {
  const template = workspace?.programmeTemplate
  const version = programme && template
    ? programme.versions.find((entry) => entry.id === template.versionId) || programme.versions[0]
    : null
  // Nothing to choose is not the same as unanswered: with no programme yet,
  // the programme step is what is blocking, not this one.
  if (!version) return { electives: true, electivesPending: 0, electivesChosen: 0 }
  const context = resolveAcademicTimeContext(programme?.calendar || [], { date: new Date() })
  const groups = relevantElectiveGroups(version, {
    studyYear: (String(template?.currentStudyYear || '').match(/(\d+)/) || [])[0] ? `Year ${String(template.currentStudyYear).match(/(\d+)/)[1]}` : null,
    period: context?.period || null
  })
  const answered = groups.filter((group) => Array.isArray(template?.selectedChoices?.[group.id]))
  return {
    electives: answered.length === groups.length,
    electivesPending: groups.length - answered.length,
    electivesChosen: answered.reduce((total, group) => total + (template.selectedChoices[group.id] || []).length, 0)
  }
}

// Catalogue course → the student's own record. Required courses are taken;
// electives are not chosen for them, because that is their decision and
// pre-filling it would put courses they are not taking on their dashboard.
function workspaceCourses(version, { studyYear = null } = {}) {
  return (version.courses || [])
    .filter((course) => course.requirement !== 'elective')
    .filter((course) => !studyYear || !course.yearLevel || course.yearLevel === `Year ${studyYear}`)
    .map((course) => ({
      // The planner rebuilds the curriculum by matching templateCourseId. A
      // course written without one is not recognised as the same course, so it
      // was kept as a custom entry *and* added again from the catalogue.
      id: `programme-${course.id}`,
      code: course.code,
      name: course.name,
      ects: course.ects,
      yearLevel: course.yearLevel,
      period: course.period,
      templateCourseId: course.id,
      programmeRequirement: 'required',
      attempts: []
    }))
}

export async function applyProgramme({ programmeId, versionId = null, studyYear = null } = {}) {
  const catalogue = loadEditorialProgrammeCatalogue()
  const programme = catalogue.programmes.find((entry) => entry.id === programmeId)
  if (!programme) throw new OnboardingError(`No maintained programme with id "${programmeId}".`)
  const version = (versionId && programme.versions.find((entry) => entry.id === versionId)) || programme.versions[0]
  if (!version) throw new OnboardingError(`${programme.name} has no curriculum version to use.`)

  const state = await readAcademicState()
  const existing = state.workspace || normalizeAcademicWorkspace({})
  const academicYear = CURRENT_ACADEMIC_YEAR()
  const courses = workspaceCourses(version, { studyYear })
  // A course the student already has stays as it is: their attempts and grades
  // are theirs, and the catalogue is a starting point, not an overwrite.
  const held = new Map((existing.courses || []).map((course) => [String(course.code || course.id).toUpperCase(), course]))
  const merged = courses.map((course) => held.get(course.code.toUpperCase()) || course)
  for (const course of existing.courses || []) {
    if (!merged.some((entry) => String(entry.code || entry.id).toUpperCase() === String(course.code || course.id).toUpperCase())) merged.push(course)
  }

  const workspace = normalizeAcademicWorkspace({
    ...existing,
    profile: {
      ...existing.profile,
      university: programme.institution?.name || existing.profile?.university || '',
      programme: `${programme.degree} ${programme.name}`,
      academicYear,
      currentYearKey: academicYear
    },
    programmeTemplate: { programmeId: programme.id, versionId: version.id, currentStudyYear: studyYear ? `Year ${studyYear}` : '', pathwayId: null, selectedChoices: {} },
    courses: merged
  })
  const saved = await saveActiveAcademicWorkspace(workspace, state.workspace?.revision ?? 0)
  return {
    programme: `${programme.degree} ${programme.name}`,
    curriculum: version.label || version.id,
    courseCount: saved.workspace?.courses?.length ?? merged.length,
    electivesOmitted: (version.courses || []).filter((course) => course.requirement === 'elective').length,
    calendarDates: (programme.calendar || []).length,
    // Said plainly so the model repeats it rather than implying the plan is complete.
    note: 'Required courses only. Electives are the student\'s own choice and were not added.',
    nextStep: 'Call list_electives now: their plan is incomplete until this period\'s electives are recorded.'
  }
}

export async function connectTimetable(url) {
  const link = normalizeCalendarLink({ url, label: 'University timetable' })
  const events = await fetchCalendar(link.url)
  if (!events.length) throw new OnboardingError('That feed was reachable but contained no appointments. Check that it is the timetable subscription URL rather than the timetable page.')
  const state = await readAcademicState()
  const workspace = state.workspace || normalizeAcademicWorkspace({})
  const calendars = [...(workspace.calendars || []).filter((entry) => entry.url !== link.url), {
    ...link,
    lastSyncedAt: new Date().toISOString(),
    eventCount: events.length,
    rangeStart: events.map((event) => event.date).sort()[0] || null,
    rangeEnd: events.map((event) => event.date).sort().at(-1) || null
  }]
  await saveActiveAcademicWorkspace(normalizeAcademicWorkspace({ ...workspace, calendars }), state.workspace?.revision ?? 0)
  const codes = [...new Set(events.flatMap((event) => String(event.title || '').match(/\b[A-Z]{2,4}\d{3,5}[A-Z]?\b/g) || []))]
  return { events: events.length, courses: codes.slice(0, 12), from: events.map((event) => event.date).sort()[0] || null, to: events.map((event) => event.date).sort().at(-1) || null }
}

// Every tool the model can call, and nothing else. `secure` tools are not in
// this table: a credential is applied by the route, never by the model.
// Electives are the half of a curriculum nobody can fill in for the student.
// The required courses are the same for everyone in the year; which of this
// period's six electives they actually sit is a decision only they have made,
// and until it is recorded the dashboard, the tutor and the credit count are
// all describing someone else's degree.
//
// So setup asks — about the period they are in, not all three years of it —
// and everything else is editable afterwards in programme settings.

function templateOf(workspace) {
  return workspace?.programmeTemplate || null
}

function resolveVersion(template) {
  if (!template?.programmeId) return { programme: null, version: null }
  const catalogue = loadEditorialProgrammeCatalogue()
  const programme = catalogue.programmes.find((entry) => entry.id === template.programmeId) || null
  const version = programme
    ? programme.versions.find((entry) => entry.id === template.versionId) || programme.versions[0] || null
    : null
  return { programme, version }
}

function studyYearOf(template) {
  const match = String(template?.currentStudyYear || '').match(/(\d+)/)
  return match ? `Year ${match[1]}` : null
}

/**
 * The groups worth asking about now: the student's own study year, and — when
 * the academic calendar says which period we are in — that period plus the
 * year-long and semester-long slots that overlap it.
 */
export function relevantElectiveGroups(version, { studyYear = null, period = null } = {}) {
  const groups = (version?.choiceGroups || []).filter((group) => group.derived)
  const inYear = studyYear ? groups.filter((group) => group.yearLevel === studyYear) : groups
  if (!period) return inYear
  const semester = /^Period ([1-3])$/.test(period) ? 'Semester 1' : /^Period ([4-6])$/.test(period) ? 'Semester 2' : null
  return inYear.filter((group) => group.period === period || group.period === 'Year' || (semester && group.period === semester))
}

export async function electiveChoices({ scope = 'current' } = {}) {
  const { workspace } = await readAcademicState()
  const template = templateOf(workspace)
  const { programme, version } = resolveVersion(template)
  if (!version) throw new OnboardingError('No programme is set yet, so there are no electives to choose from.')

  const context = resolveAcademicTimeContext(programme?.calendar || [], { date: new Date() })
  const studyYear = studyYearOf(template)
  const groups = scope === 'all'
    ? (version.choiceGroups || []).filter((group) => group.derived)
    : relevantElectiveGroups(version, { studyYear, period: context?.period || null })
  const chosen = template?.selectedChoices || {}

  return {
    programme: programme ? `${programme.degree} ${programme.name}` : null,
    studyYear,
    // Named so the assistant can say "your Period 1 electives" instead of
    // asking about a period the student is not in.
    period: context?.period || null,
    periodKnown: Boolean(context?.period),
    groups: groups.map((group) => ({
      id: group.id,
      label: group.label,
      period: group.period,
      yearLevel: group.yearLevel,
      chosen: (chosen[group.id] || []).slice(),
      courses: group.courseIds.map((courseId) => {
        const course = version.courses.find((entry) => entry.id === courseId)
        return course ? { id: course.id, code: course.code, name: course.name, ects: course.ects, coordinator: course.coordinator || null } : null
      }).filter(Boolean)
    })),
    note: groups.length
      ? 'Read the options out and let the student pick. They may pick none.'
      : 'Nothing to choose in this period. Say so and move on.'
  }
}

export async function chooseElectives({ groupId = null, courseIds = [] } = {}) {
  const state = await readAcademicState()
  const workspace = state.workspace
  const template = templateOf(workspace)
  const { programme, version } = resolveVersion(template)
  if (!version) throw new OnboardingError('No programme is set yet.')

  // Course codes are accepted alongside ids. The assistant reads the codes out
  // to the student — they are in its own opening message — so requiring ids
  // forced a round trip it kept skipping, and then it recorded nothing.
  const asked = [...new Set((Array.isArray(courseIds) ? courseIds : [courseIds]).map((value) => String(value || '').trim()).filter(Boolean))]
  const identify = (candidate, entry) => {
    const course = version.courses.find((item) => item.id === entry)
    return course && (course.id.toLowerCase() === candidate.toLowerCase() || course.code.toLowerCase() === candidate.toLowerCase())
  }

  const candidates = (version.choiceGroups || []).filter((entry) => entry.derived || entry.maxSelections !== 1)
  const group = groupId
    ? (version.choiceGroups || []).find((entry) => entry.id === groupId)
    // Without a group, the one that offers every course they named is the one
    // they mean; the assistant should not have to look the id up first.
    : candidates.find((entry) => asked.length && asked.every((candidate) => entry.courseIds.some((id) => identify(candidate, id))))
  if (!group) {
    const context = resolveAcademicTimeContext(programme?.calendar || [], { date: new Date() })
    const relevant = relevantElectiveGroups(version, { studyYear: studyYearOf(template), period: context?.period || null })
    throw new OnboardingError(groupId
      ? `No elective group "${groupId}" in this curriculum.`
      : `Those courses are not all in one elective group. Call list_electives and pass its groupId. Groups open now: ${relevant.map((entry) => entry.id).join(', ') || 'none'}.`)
  }

  const wanted = []
  const unknown = []
  for (const candidate of asked) {
    const match = group.courseIds.find((id) => identify(candidate, id))
    if (match) wanted.push(match)
    else unknown.push(candidate)
  }
  if (unknown.length) throw new OnboardingError(`${unknown.join(', ')} is not offered in ${group.label}.`)

  const held = new Map((workspace.courses || []).map((course) => [String(course.templateCourseId || course.id || course.code).toLowerCase(), course]))
  // Dropping a course the student had chosen must not delete the attempts they
  // recorded against it, so a course with history stays and only loses its
  // place in the plan.
  const previous = template?.selectedChoices?.[group.id] || []
  const removed = previous.filter((courseId) => !wanted.includes(courseId))
  const courses = (workspace.courses || []).filter((course) => {
    const id = String(course.templateCourseId || course.id || course.code)
    return !removed.includes(id) || (course.attempts || []).length > 0
  })
  for (const courseId of wanted) {
    if (held.has(courseId.toLowerCase())) continue
    const course = version.courses.find((entry) => entry.id === courseId)
    if (!course) continue
    courses.push({
      id: `programme-${course.id}`,
      code: course.code,
      name: course.name,
      ects: course.ects,
      yearLevel: course.yearLevel,
      period: course.period,
      templateCourseId: course.id,
      choiceGroupId: group.id,
      programmeRequirement: 'elective',
      attempts: []
    })
  }

  const next = normalizeAcademicWorkspace({
    ...workspace,
    programmeTemplate: { ...template, selectedChoices: { ...(template?.selectedChoices || {}), [group.id]: wanted } },
    courses
  })
  const saved = await saveActiveAcademicWorkspace(next, workspace?.revision ?? 0)
  const named = wanted.map((courseId) => version.courses.find((entry) => entry.id === courseId)?.code).filter(Boolean)
  return {
    group: group.label,
    chosen: named,
    courseCount: saved.workspace?.courses?.length ?? courses.length,
    keptForHistory: removed.filter((courseId) => courses.some((course) => String(course.templateCourseId || course.id || course.code) === courseId)).length,
    note: named.length
      ? 'Added to their plan. They can change this later in programme settings.'
      : 'Recorded that they are taking none of these. They can change this later in programme settings.'
  }
}

export const TOOL_HANDLERS = {
  async find_programme({ query }) {
    const matches = findProgrammes(String(query || ''))
    return matches.length
      ? { matches, note: 'Confirm with the student before calling set_programme.' }
      : { matches: [], note: 'Not in the maintained catalogue. Try lookup_programme_page to confirm the programme exists, then explain that their course list will come from their academic record instead.' }
  },
  async lookup_programme_page({ name, level = 'bachelor' }) {
    const result = await lookupUmProgramme({ name, level })
    return {
      ...result,
      carriesCourseList: false,
      note: 'This page confirms the programme and links its official curriculum. It contains no course list — do not invent one.'
    }
  },
  async set_programme({ programmeId, versionId, studyYear }) {
    return applyProgramme({ programmeId, versionId, studyYear })
  },
  async remember_name({ name }) {
    const first = String(name || '').trim().slice(0, 40)
    if (!first) return { error: 'A name is required.' }
    return { name: first, note: 'Recorded. Use it sparingly.' }
  },
  async get_setup_state() {
    return setupState()
  },
  async request_upload({ kind = 'academic-work' } = {}) {
    if (!['academic-work', 'transcript'].includes(kind)) throw new OnboardingError('Unknown document type.')
    return { shown: true, kind, note: 'The correct document control is now visible. Wait for the student to use it or decline.' }
  },
  async request_secure_input({ kind }) {
    if (!['timetable', 'canvas'].includes(kind)) throw new OnboardingError('Unknown secure input.')
    return {
      shown: true,
      kind,
      note: kind === 'timetable'
        ? 'A protected field and the illustrated guide to finding the timetable URL are now visible. Wait for the student.'
        : 'A protected field and the steps for creating a Canvas Personal Access Token are now visible. Wait for the student. Never ask them to paste the token into the conversation.'
    }
  },
  async list_electives({ scope }) {
    return electiveChoices({ scope: scope === 'all' ? 'all' : 'current' })
  },
  async choose_electives({ groupId, courseIds }) {
    return chooseElectives({ groupId, courseIds })
  },
  async skip_step({ step }) {
    return { skipped: step, note: 'Acknowledge briefly, say it can be added later from the dashboard, and move to the next step.' }
  },
  async finish({ summary }) {
    return { finished: true, summary: String(summary || '').slice(0, 1200) }
  }
}

export async function runTool(name, args) {
  const handler = TOOL_HANDLERS[name]
  if (!handler) return { error: `Unknown tool "${name}".` }
  try {
    return await handler(args || {})
  } catch (error) {
    // A failure is a fact the model should relay, not a crash.
    return { error: error instanceof Error ? error.message : 'That step could not be completed.' }
  }
}

// ── The model loop ────────────────────────────────────────────────────────
// Chat Completions with tools. Deliberately its own call rather than the
// editorial `runCodex` path: that one is single-shot with a JSON schema, and
// this one is a conversation that has to call tools and come back.

import { ONBOARDING_TOOLS, onboardingSystemPrompt, historyForModel } from './onboarding-agent.mjs'
import { callModel as sharedCallModel } from './model-loop.mjs'

// A confused model must not be able to loop at the account's expense.
const MAX_TOOL_ROUNDS = 6

async function callModel(messages) {
  try { return await sharedCallModel(messages, { tools: ONBOARDING_TOOLS, maxOutputTokens: 1200 }) }
  catch (error) { throw new OnboardingError(error.message, error.status || 502) }
}

/**
 * One turn: the student's message in, the assistant's reply and any control it
 * asked for out. Tool calls run in between, up to a bounded number of rounds so
 * a confused model cannot loop at the account's expense.
 */
export async function runOnboardingTurn(conversation, { message = null, systemState = null } = {}) {
  const history = historyForModel(conversation)
  const messages = [
    { role: 'system', content: onboardingSystemPrompt({ name: conversation.name, state: systemState }) },
    ...history.map(({ role, content, tool_calls, tool_call_id, name }) => ({ role, content, ...(tool_calls ? { tool_calls } : {}), ...(tool_call_id ? { tool_call_id } : {}), ...(name ? { name } : {}) }))
  ]
  if (message) messages.push({ role: 'user', content: message })

  const added = message ? [{ role: 'user', content: message, at: new Date().toISOString() }] : []
  let prompt = null
  let name = null
  let finished = false
  let summary = null
  const skipped = []
  const applied = []
  let usage = null

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { message: reply, usage: turnUsage } = await callModel(messages)
    usage = turnUsage || usage
    const calls = reply.tool_calls || []
    messages.push(reply)
    added.push({ role: 'assistant', content: reply.content || '', tool_calls: calls.length ? calls : undefined, at: new Date().toISOString() })

    if (!calls.length) {
      // An assistant turn with nothing in it is a dead end for the student, not
      // a valid reply. Ask once more before giving up on the turn.
      if (!String(reply.content || '').trim()) {
        added.pop()
        messages.push({ role: 'system', content: 'Your last reply was empty. Say something useful to the student now: acknowledge what they told you and ask the next question.' })
        continue
      }
      return { added, prompt, name, finished, summary, skipped, applied, usage }
    }

    for (const call of calls) {
      let args = {}
      try { args = JSON.parse(call.function?.arguments || '{}') } catch {}
      const result = await runTool(call.function?.name, args)
      if (call.function?.name === 'request_upload') prompt = { kind: 'upload', upload: result.kind || 'academic-work' }
      if (call.function?.name === 'request_secure_input' && result.kind) prompt = { kind: 'secure', secure: result.kind }
      if (call.function?.name === 'skip_step' && result.skipped) skipped.push(result.skipped)
      if (call.function?.name === 'set_programme' && !result.error) applied.push('programme')
      if (call.function?.name === 'remember_name' && result.name) name = result.name
      if (call.function?.name === 'finish') { finished = true; summary = result.summary || null }
      const payload = { role: 'tool', tool_call_id: call.id, name: call.function?.name, content: JSON.stringify(result) }
      messages.push(payload)
      added.push({ ...payload, at: new Date().toISOString() })
    }
    if (finished) {
      // Let the model close in its own words rather than emitting the tool's summary.
      const { message: closing } = await callModel(messages)
      added.push({ role: 'assistant', content: closing.content || summary || '', at: new Date().toISOString() })
      return { added, prompt: null, name, finished, summary, skipped, applied, usage }
    }
  }
  added.push({ role: 'assistant', content: 'I got stuck working that out. You can finish setup from the checklist instead — everything there does the same thing.', at: new Date().toISOString() })
  return { added, prompt, name, finished, summary, skipped, applied, usage }
}

// ── Session ───────────────────────────────────────────────────────────────
// One conversation per account, in the per-user document store. It is resumable
// because a student who closes the tab mid-setup should not start again.

import { readDocument, writeDocument, deleteDocument } from './user-store.mjs'
import { emptyConversation, conversationTurns, visibleMessages, MAX_TURNS } from './onboarding-agent.mjs'

const NAMESPACE = 'onboarding'
const KEY = 'conversation'

// What setup opens with.
//
// It used to open with "say hello when you're ready", which spent the student's
// first turn, and a model call, on a greeting. The first thing they see should
// be the first thing that is actually missing — so the opener is derived from
// the account rather than written in advance, and their first reply answers a
// real question instead of starting a conversation.
//
// Deterministic on purpose: no model call to draw the page.
const OPENING_PLACEHOLDERS = {
  programme: 'e.g. Computer Science, third year',
  electives: 'Name the ones you are taking, or say none',
  record: 'Choose your Academic Work PDF',
  transcript: 'Choose your official Transcript PDF',
  calendar: 'Paste a link, or say skip',
  timetable: 'Say go and I will show you where to find it',
  canvas: 'Say go and I will show you where to find it',
  done: 'Ask me to change anything'
}

export async function openingMessage() {
  const state = await setupState()

  if (!state.programme) {
    return {
      step: 'programme',
      heading: 'Which programme are you on?',
      body: 'Your own words are enough — "Computer Science, third year" will do. This is the only thing I need: it brings your required courses, your teaching periods, and your exam weeks with it.'
    }
  }

  if (!state.electives) {
    const offered = await electiveChoices({ scope: 'current' }).catch(() => null)
    const group = (offered?.groups || []).find((entry) => entry.courses.length)
    if (group) {
      return {
        step: 'electives',
        heading: `Which ${group.label} electives are you taking?`,
        // Listed here rather than after another round trip: the student is
        // being asked to choose, so they need to see what there is to choose.
        body: `Your programme is set, and I added the courses everyone in your year takes. These are the optional ones on offer:\n\n${group.courses.map((course) => `- **${course.code}** — ${course.name} (${course.ects} ECTS)`).join('\n')}\n\nName the ones you are taking, or say none. You can change this later in programme settings.`
      }
    }
  }

  if (!state.record) {
    return {
      step: 'record',
      heading: 'Bring in your study record.',
      body: 'Choose the Academic Work PDF from My Study. It fills in completed courses, credits, attempts, and current registrations in one step.'
    }
  }

  if (!state.transcript) {
    return {
      step: 'transcript',
      heading: 'Add your attempt history.',
      body: 'Your Transcript is separate from Academic Work. It records dated attempts, repeats and failures, which lets the planner distinguish a future course from a retake and show what is still outstanding.'
    }
  }

  if (!state.calendar) {
    return {
      step: 'calendar',
      heading: 'Next: your academic calendar.',
      body: 'I do not have maintained teaching periods and exam weeks for your programme, so I need its academic calendar — a link or a PDF. Without it I cannot tell you which period you are in. Say go, or skip.'
    }
  }

  if (!state.timetable) {
    return {
      step: 'timetable',
      heading: 'Next: your timetable.',
      body: 'Your university timetable subscription puts your lectures, tutorials and labs — with times and rooms — on your dashboard and calendar. Say go and I will show you where to find the link, or skip.'
    }
  }

  if (!state.canvas) {
    return {
      step: 'canvas',
      heading: 'Last one: Canvas.',
      body: 'Connecting Canvas brings your announcements, assignment deadlines and course material into one place. Say go and I will show you how to create the access token, or skip.'
    }
  }

  return {
    step: 'done',
    heading: 'Everything is connected.',
    body: 'Your programme, electives, Academic Work, Transcript, calendar, timetable and Canvas are all set up. Ask me to change any of them, or head back to your dashboard.'
  }
}

function withPlaceholder(opening) {
  return { ...opening, placeholder: OPENING_PLACEHOLDERS[opening.step] || 'Type your reply…' }
}

export async function readConversation() {
  const stored = await readDocument(NAMESPACE, KEY, null)
  const conversation = stored && stored.id ? stored : emptyConversation()
  if (!(conversation.messages || []).length) {
    const opening = await openingMessage()
    conversation.opening = withPlaceholder(opening)
    conversation.messages = [{ role: 'assistant', content: opening.body, at: new Date().toISOString() }]
  }
  return conversation
}

export async function writeConversation(conversation) {
  await writeDocument(NAMESPACE, KEY, conversation)
  return conversation
}

export async function resetConversation() {
  await deleteDocument(NAMESPACE, KEY)
  return emptyConversation()
}

// What the client renders. The stored transcript keeps tool traffic for the
// model's benefit; the student sees only what was said.
export async function onboardingView(conversation = null) {
  const stored = conversation || await readConversation()
  const state = await setupState()
  return {
    id: stored.id,
    startedAt: stored.startedAt,
    name: stored.name,
    messages: visibleMessages(stored),
    prompt: stored.prompt || null,
    skipped: stored.skipped || [],
    finished: Boolean(stored.finished),
    summary: stored.summary || null,
    turns: conversationTurns(stored),
    maxTurns: MAX_TURNS,
    // Only present until the student has replied; the client uses it to draw
    // the opening screen rather than a one-line transcript.
    opening: stored.opening || null,
    state
  }
}

export async function sendOnboardingMessage(messageText) {
  const conversation = await readConversation()
  if (conversation.finished) throw new OnboardingError('This setup conversation has already finished. Start a new one to go through it again.', 409)
  if (conversationTurns(conversation) >= MAX_TURNS) throw new OnboardingError('This conversation has run long. Finish setup from the checklist instead — it does the same thing.', 429)

  const systemState = await setupState()
  const turn = await runOnboardingTurn(conversation, { message: messageText, systemState })
  conversation.messages = [...(conversation.messages || []), ...turn.added]
  conversation.prompt = turn.prompt
  conversation.skipped = [...new Set([...(conversation.skipped || []), ...turn.skipped])]
  if (turn.finished) { conversation.finished = true; conversation.summary = turn.summary }
  if (turn.name) conversation.name = turn.name
  delete conversation.opening
  await writeConversation(conversation)
  return { view: await onboardingView(conversation), usage: turn.usage }
}

/**
 * A value the model must never see. The route applies it and records only that
 * it was applied; the transcript carries the outcome, never the credential.
 */
export async function applySecureValue(kind, value, options = {}) {
  const conversation = await readConversation()
  let outcome
  if (kind === 'timetable') {
    const result = await connectTimetable(value)
    outcome = `The timetable is connected: ${result.events} appointments${result.courses.length ? ` across ${result.courses.length} course codes` : ''}.`
  } else if (kind === 'canvas') {
    // The same guarantee the dedicated credential route makes: this path is
    // refused to API keys, so a token only ever arrives from a signed-in
    // browser. It is encrypted here and never returned.
    const origin = process.env.WICKER_CANVAS_URL || 'https://canvas.maastrichtuniversity.nl'
    try {
      await saveCanvasConnection({ canvasUrl: origin, accessToken: value })
    } catch (error) {
      throw new OnboardingError(error instanceof Error ? error.message : 'That Canvas token could not be saved.')
    }
    // Prove it works before claiming it does: a token that saves but cannot
    // read anything is not a connection.
    let courses = null
    try {
      const { token } = await canvasAccessToken({ canvasUrl: origin })
      const hub = await fetchCanvasHub({ origin, token, scope: 'current', parts: ['announcements'], days: 14 })
      courses = hub.selectedCourseIds.length
    } catch (error) {
      await removeCanvasConnection({ canvasUrl: origin }).catch(() => {})
      throw new OnboardingError(`Canvas did not accept that token: ${error instanceof Error ? error.message : 'it could not be used.'}`)
    }
    const permission = await setCanvasCorpusPermission({
      accountId: currentAuth().userId,
      origin,
      collectionEnabled: options.collectionEnabled === true,
      sharingMode: options.sharingMode === 'community' ? 'community' : 'private'
    })
    const collection = permission.collectionEnabled
      ? permission.sharingMode === 'community' ? ' Server-side material collection is queued, with explicit community sharing permission.' : ' Server-side material collection is queued for this account only.'
      : ' Lesson-material collection was not authorised.'
    outcome = `Canvas is connected: ${courses} current course${courses === 1 ? '' : 's'} are visible.${collection}`
  } else {
    throw new OnboardingError('Unknown secure input.')
  }
  conversation.messages = [...(conversation.messages || []), { role: 'user', content: outcome, at: new Date().toISOString(), redacted: true }]
  conversation.prompt = null
  // A secure connection has a known result and a known next step. Do not pay
  // for (or wait on) a model call just to paraphrase those facts: it also gives
  // a provider-side reminder an opportunity to leak into the transcript.
  const next = withPlaceholder(await openingMessage())
  if (next.step === 'done') {
    conversation.finished = true
    conversation.summary = next.body
  } else {
    conversation.messages.push({ role: 'assistant', content: next.body, at: new Date().toISOString() })
  }
  await writeConversation(conversation)
  return onboardingView(conversation)
}
