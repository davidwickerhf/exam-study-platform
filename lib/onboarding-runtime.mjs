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
import { listCanvasConnections } from './canvas-connections.mjs'
import { normalizeCalendarLink, fetchCalendar } from './academic-documents.mjs'
import { latestAcademicSnapshot } from './academic-snapshots.mjs'

const CURRENT_ACADEMIC_YEAR = () => {
  const now = new Date()
  // A Dutch academic year starts in September.
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${start + 1}`
}

export async function setupState() {
  const [{ workspace }, connections, snapshot] = await Promise.all([
    readAcademicState(),
    listCanvasConnections().catch(() => []),
    latestAcademicSnapshot().catch(() => null)
  ])
  const catalogue = loadEditorialProgrammeCatalogue()
  const programmeId = workspace?.programmeTemplate?.programmeId || null
  const programme = programmeId ? catalogue.programmes.find((entry) => entry.id === programmeId) : null
  return {
    programme: Boolean(workspace?.courses?.length),
    programmeName: workspace?.profile?.programme || null,
    courseCount: workspace?.courses?.length || 0,
    record: Boolean(snapshot),
    recordSummary: snapshot?.summary || null,
    calendar: (programme?.calendar || []).length > 0,
    calendarDates: (programme?.calendar || []).length,
    timetable: (workspace?.calendars || []).length > 0,
    timetableEvents: (workspace?.calendars || []).reduce((total, link) => total + (link.eventCount || 0), 0),
    canvas: connections.length > 0
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
      id: course.id,
      code: course.code,
      name: course.name,
      ects: course.ects,
      yearLevel: course.yearLevel,
      period: course.period,
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
    note: 'Required courses only. Electives are the student\'s own choice and were not added.'
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
  async request_upload() {
    return { shown: true, note: 'The upload control is now visible to the student. Wait for them to use it or decline; do not describe how to attach a file.' }
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

import { readFile } from 'node:fs/promises'
import { ONBOARDING_TOOLS, onboardingSystemPrompt, historyForModel } from './onboarding-agent.mjs'

const MODEL_TIMEOUT_MS = 60_000
// A confused model must not be able to loop at the account's expense.
const MAX_TOOL_ROUNDS = 6
let cachedConfig = null
async function llmSettings(env = process.env) {
  if (!cachedConfig) {
    try { cachedConfig = JSON.parse(await readFile(new URL('../data/llm-config.json', import.meta.url), 'utf8')) }
    catch { cachedConfig = {} }
  }
  return {
    apiKey: env.OPENAI_API_KEY || cachedConfig.openaiApiKey || '',
    model: env.ONBOARDING_MODEL || env.OPENAI_MODEL || cachedConfig.openaiModel || 'gpt-5-mini',
    baseUrl: (env.OPENAI_BASE_URL || cachedConfig.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  }
}

async function callModel(messages, { signal } = {}) {
  const { apiKey, model, baseUrl } = await llmSettings()
  if (!apiKey) throw new OnboardingError('The setup conversation needs a language model. Use the checklist at #/setup instead.', 503)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, tools: ONBOARDING_TOOLS, tool_choice: 'auto', max_completion_tokens: 1200 }),
    signal: signal ?? AbortSignal.timeout(MODEL_TIMEOUT_MS)
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new OnboardingError(`The setup assistant is unavailable (${response.status}). ${detail.slice(0, 200)}`, 502)
  }
  const data = await response.json()
  const choice = data.choices?.[0]?.message
  if (!choice) throw new OnboardingError('The setup assistant returned nothing.', 502)
  return { message: choice, usage: data.usage || null }
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
      if (call.function?.name === 'request_upload') prompt = { kind: 'upload' }
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

export async function readConversation() {
  const stored = await readDocument(NAMESPACE, KEY, null)
  return stored && stored.id ? stored : emptyConversation()
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
  await writeConversation(conversation)
  return { view: await onboardingView(conversation), usage: turn.usage }
}

/**
 * A value the model must never see. The route applies it and records only that
 * it was applied; the transcript carries the outcome, never the credential.
 */
export async function applySecureValue(kind, value) {
  const conversation = await readConversation()
  let outcome
  if (kind === 'timetable') {
    const result = await connectTimetable(value)
    outcome = `The timetable is connected: ${result.events} appointments${result.courses.length ? ` across ${result.courses.length} course codes` : ''}. Confirm this briefly and move on.`
  } else if (kind === 'canvas') {
    // Canvas credentials are account data and are stored by their own route,
    // which requires a browser session. This only records that it happened.
    const connections = await listCanvasConnections()
    if (!connections.length) throw new OnboardingError('Canvas is still not connected. Check the token was pasted in full.')
    outcome = `Canvas is connected to ${connections[0].origin}. Confirm this briefly and move on.`
  } else {
    throw new OnboardingError('Unknown secure input.')
  }
  conversation.messages = [...(conversation.messages || []), { role: 'user', content: outcome, at: new Date().toISOString(), redacted: true }]
  conversation.prompt = null
  await writeConversation(conversation)
  const turn = await runOnboardingTurn(conversation, { message: null, systemState: await setupState() })
  conversation.messages = [...conversation.messages, ...turn.added]
  conversation.prompt = turn.prompt
  if (turn.finished) { conversation.finished = true; conversation.summary = turn.summary }
  await writeConversation(conversation)
  return onboardingView(conversation)
}
