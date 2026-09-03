// The conversational setup. A model drives the conversation and calls tools;
// every tool that changes the account is deterministic code, so the model can
// choose *when* to act but never what the result is.
//
// Two rules shape the whole design:
//
//   1. A credential never enters the conversation. The Canvas token and the
//      timetable URL are submitted through their own field, applied by the
//      server, and recorded in the transcript only as the fact that they were
//      applied. The model is told the outcome, never the value. It is also
//      instructed never to ask for one in chat, and it has no tool that could
//      accept one if it did.
//   2. Only the programme is required. Every other step can be skipped, and a
//      skipped step is resumable from the dashboard rather than lost.

import { randomUUID } from 'node:crypto'
import { loadEditorialProgrammeCatalogue } from './editorial-programmes.mjs'
import { lookupUmProgramme } from './programme-lookup.mjs'

export const ONBOARDING_STEPS = Object.freeze(['programme', 'electives', 'record', 'transcript', 'calendar', 'timetable', 'canvas'])
export const MAX_TURNS = 60
const MAX_TOOL_ROUNDS = 6
const MAX_HISTORY = 40

export class OnboardingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

function text(value, max = 4000) {
  return String(value ?? '').replace(/\0/g, '').trim().slice(0, max)
}

// ── Tool surface ──────────────────────────────────────────────────────────
// Descriptions are written for the model. They carry the product's rules, not
// just the parameters, because a rule the model cannot see is a rule it breaks.

export const ONBOARDING_TOOLS = Object.freeze([
  {
    type: 'function',
    function: {
      name: 'find_programme',
      description: 'Search the maintained curriculum catalogue by programme name. Always try this before anything else: a maintained programme comes with its full course list, its teaching periods, and its academic calendar, so the student has to do nothing. Returns candidates with a confidence you should confirm rather than assume.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'What the student called their programme, in their own words.' } },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lookup_programme_page',
      description: 'For a programme the catalogue does NOT carry. Reads the university\'s own programme page to confirm the programme exists and returns the official curriculum link. It deliberately returns no course list — those pages contain none. Use it to confirm you have the right programme, then tell the student their course list will come from their academic record instead, and that their programme will be added to the catalogue.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          level: { type: 'string', enum: ['bachelor', 'master'], description: 'Default bachelor.' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_programme',
      description: 'Record the programme on the student\'s account, after they have confirmed it in their own words. This creates their course list from the maintained curriculum. Only call this once the student has agreed to the specific programme and version you named.',
      parameters: {
        type: 'object',
        properties: {
          programmeId: { type: 'string' },
          versionId: { type: 'string', description: 'Curriculum year, e.g. 2026-2027. Omit for the newest.' },
          studyYear: { type: 'integer', minimum: 1, maximum: 6, description: 'Which year of the programme the student is in, if they said.' }
        },
        required: ['programmeId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remember_name',
      description: 'Record the student\'s first name once they have given it. Only call this when they have actually told you their name — a greeting is not a name.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'First name only, as they wrote it.' } },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_setup_state',
      description: 'What the account already has: programme, academic record, academic calendar, timetable, Canvas. Call this before asking for something — a returning student may already have connected it, and asking again wastes their time.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'request_upload',
      description: 'Show the correct protected document control. Academic Work supplies the current credit summary; Transcript is a different document and supplies dated attempts, repeats, failures and outstanding courses. The file is read in the browser and never stored.',
      parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['academic-work', 'transcript'] } }, required: ['kind'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'request_secure_input',
      description: 'Show a protected field for a value that must never appear in the conversation: the student\'s timetable subscription URL, or their Canvas Personal Access Token. Whatever they type goes straight to the server and is applied without passing through this conversation. NEVER ask the student to type a token, URL, or password as a chat message — always use this.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['timetable', 'canvas'], description: '"timetable" shows the guide for finding the university timetable URL. "canvas" shows how to create a Canvas Personal Access Token.' }
        },
        required: ['kind']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_electives',
      description: 'The electives the student can choose between, for the study year and teaching period they are actually in. Call this straight after set_programme: set_programme adds only the required courses, so until this is answered the plan is missing whichever optional courses they are sitting. Read the options out with their credits and let them pick; picking none is a valid answer. Do not guess on their behalf.',
      parameters: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['current', 'all'], description: 'Default "current": this period only. Use "all" only if the student asks to see the whole degree.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'choose_electives',
      description: 'Record which electives from one group the student is taking, and add them to their plan. Course codes are accepted, so when your opening message already listed the options you can record their answer straight away without calling list_electives first. Pass an empty list to record that they are taking none of that group. Call this only after the student has named their courses, and pass only the courses they named — never a course you inferred, and never a placeholder. If what they said matches more than one course, or none, ask them which they meant instead of choosing. Call it once per group, not once per course.',
      parameters: {
        type: 'object',
        properties: {
          groupId: { type: 'string', description: 'The group id from list_electives. Omit it when the courses come from your own opening message and all belong to the same group.' },
          courseIds: { type: 'array', items: { type: 'string' }, description: 'The courses they are taking, as ids or as course codes such as BCS3111. Empty means none.' }
        },
        required: ['courseIds']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'skip_step',
      description: 'Record that the student chose to skip a step. Say plainly what they lose by skipping and that they can add it later from the dashboard, then move on without pressing. Never skip the programme step.',
      parameters: {
        type: 'object',
        properties: {
          step: { type: 'string', enum: ['electives', 'record', 'transcript', 'calendar', 'timetable', 'canvas'] },
          reason: { type: 'string' }
        },
        required: ['step']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'End setup. Call this when the student has been through every step, whether connected or skipped, or when they ask to stop. Summarise in one short paragraph what is connected and what they can still add later.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string', description: 'One short paragraph, addressed to the student.' } },
        required: ['summary']
      }
    }
  }
])

export function onboardingSystemPrompt({ name = null, state = null } = {}) {
  return [
    'You are the setup assistant for Wicker Study, a private study workspace for university students.',
    'Your job is to get this student to a working dashboard with as little effort from them as possible. You are not giving a tour.',
    '',
    'Voice: precise, calm, and brief. Two or three sentences per turn. No exclamation marks, no emoji, no bullet lists unless you are listing courses. Never say "Great!", "Perfect!", or "Awesome".',
    '',
    'The steps, in order: the programme (required), this period\'s electives, Academic Work, Transcript, the academic calendar, their timetable, and Canvas. Academic Work and Transcript are separate documents and neither substitutes for the other.',
    'The conversation opens on the first step still outstanding, and that opening message is yours. Continue from it rather than restarting from the beginning.',
    'Everything except the programme is optional. Offer each one, explain in one line what it makes possible, and accept a no without pushing. Say that a skipped step can be added later from the dashboard.',
    // set_programme adds required courses only. Without this the plan silently
    // describes a degree the student is not taking.
    'Electives: set_programme adds only the courses everyone in the year takes. Call list_electives immediately after it, read out what is on offer this period with the credits, and record their answer with choose_electives — in one call per group, listing only the courses they actually named. A course they did not name is not a course they are taking. If they would rather decide later, say the choice lives in programme settings and move on.',
    '',
    'Rules you must not break:',
    '- Never ask the student to type a password, an access token, an MFA code, or a subscription URL as a chat message. Use request_secure_input, which gives them a protected field.',
    '- Never state a fact about their programme, their credits, or their courses that a tool did not return. If you do not know, say so.',
    '- Before calling set_programme, name the programme and the curriculum year once and let them correct you. That applies only while the programme is unset; once it is recorded it is settled, so never re-confirm it and never make another step wait on it.',
    '- When they agree, call the tool in that same turn. Asking for the same confirmation twice is a failure — if you have already asked and they said yes, act.',
    '- One question at a time.',
    '- Academic Work and Transcript: do not ask whether to reveal an upload control. Call request_upload with the correct kind as soon as either step is reached; the visible control explains the difference and includes a skip action.',
    '- "ok", "sure", "go on", "next" after you have offered something means yes. Only treat an explicit no, "skip", or "later" as a decline.',
    '- After a tool succeeds, say what it did in one sentence and move to the next step. Do not re-offer a step that is already done.',
    '- When setup state contains issues, you are a contextual resolver rather than an interviewer. Explain the conflicting evidence, ask only for the fact needed to distinguish it, and never present an unresolved requirement as confirmed.',
    '',
    'Explain why you are asking for each thing, once, in a single clause — what it lets the dashboard do. Do not repeat the privacy explanation on every step; the upload control states its own terms.',
    name ? `The student's name is ${name}. Use it sparingly.` : 'Ask for their first name early, and use it sparingly.',
    // Resuming setup used to re-open a settled step: asked about electives with
    // the programme already recorded, the assistant demanded the programme be
    // confirmed again before it would act.
    state ? `Already done, and not to be asked about again: ${Object.entries(state).filter(([, value]) => value === true).map(([key]) => key).join(', ') || 'nothing yet'}. Treat each as settled fact and act on the step under discussion.${state.issues?.length ? ` Current source issues: ${JSON.stringify(state.issues).slice(0, 12000)}` : ''}` : ''
  ].filter(Boolean).join('\n')
}

// ── Catalogue matching ────────────────────────────────────────────────────

function normalise(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const STOP_WORDS = new Set(['and', 'for', 'of', 'in', 'the', 'with'])
const LEVEL_WORDS = { bachelor: 'Bachelor', bachelors: 'Bachelor', bsc: 'Bachelor', ba: 'Bachelor', undergrad: 'Bachelor', undergraduate: 'Bachelor', master: 'Master', masters: 'Master', msc: 'Master', ma: 'Master', graduate: 'Master' }

// Students type "CS", "DSAI", "AI master", "bsc comp sci". Every one of those
// is the real answer to "what do you study", so the lookup has to take them.
export function programmeAliases(programme) {
  const words = normalise(programme.name).split(' ').filter(Boolean)
  const significant = words.filter((word) => !STOP_WORDS.has(word))
  const aliases = new Set([
    normalise(programme.name),
    // Initials of the words that carry meaning: Data Science and Artificial
    // Intelligence is DSAI, not DSAAI.
    significant.map((word) => word[0]).join(''),
    words.map((word) => word[0]).join('')
  ])
  for (const version of programme.versions || []) {
    // The course-code prefix a student sees on every one of their courses.
    for (const course of version.courses || []) {
      const prefix = String(course.code || '').match(/^[A-Za-z]{2,4}/)?.[0]
      if (prefix) aliases.add(prefix.toLowerCase())
    }
  }
  aliases.delete('')
  return [...aliases]
}

export function scoreProgramme(query, programme) {
  const raw = normalise(query)
  if (!raw) return 0
  const queryWords = raw.split(' ').filter(Boolean)
  const level = queryWords.map((word) => LEVEL_WORDS[word]).find(Boolean) || null
  // "master" is a filter, not a word to match against the programme name.
  const needleWords = queryWords.filter((word) => !LEVEL_WORDS[word] && !STOP_WORDS.has(word))
  const needle = needleWords.join(' ')
  const levelMismatch = level && !programme.degree.startsWith(level)
  if (levelMismatch && !needle) return 0

  const name = normalise(programme.name)
  const aliases = programmeAliases(programme)
  let score = 0
  if (!needle) score = 0.5
  else if (name === needle) score = 1
  else if (aliases.includes(needle.replace(/ /g, ''))) score = 0.95
  else if (name.startsWith(needle) || needle.startsWith(name)) score = 0.85
  else if (name.includes(needle)) score = 0.75
  else {
    // Prefix matching so "comp sci" reaches "computer science".
    const target = name.split(' ').filter((word) => !STOP_WORDS.has(word))
    const matched = needleWords.filter((word) => target.some((candidate) => candidate.startsWith(word) || word.startsWith(candidate))).length
    score = matched ? (matched / Math.max(needleWords.length, target.length)) * 0.8 : 0
  }
  // A stated level is a strong signal in both directions: it promotes the right
  // degree and demotes the same subject at the wrong one.
  if (level) score = levelMismatch ? score * 0.35 : Math.min(1, score + 0.15)
  return score
}

export function findProgrammes(query, { catalogue = loadEditorialProgrammeCatalogue() } = {}) {
  return catalogue.programmes
    .map((programme) => ({ programme, score: scoreProgramme(query, programme) }))
    .filter((entry) => entry.score >= 0.3)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ programme, score }) => ({
      id: programme.id,
      name: programme.name,
      degree: programme.degree,
      institution: programme.institution?.name || null,
      durationYears: programme.durationYears,
      totalEcts: programme.totalEcts,
      confidence: Number(score.toFixed(2)),
      versions: programme.versions.map((version) => ({ id: version.id, label: version.label, courses: version.courses.length })),
      calendarDates: (programme.calendar || []).length
    }))
}

// ── Conversation state ────────────────────────────────────────────────────

export function emptyConversation() {
  return {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    name: null,
    messages: [],
    skipped: [],
    finished: false,
    summary: null,
    // What the conversation is asking the student to do right now. The client
    // renders a control for it rather than a paragraph telling them to find one.
    prompt: null
  }
}

export function conversationTurns(conversation) {
  return (conversation.messages || []).filter((message) => message.role === 'user').length
}

export function visibleMessages(conversation) {
  return (conversation.messages || [])
    .filter((message) => ['user', 'assistant'].includes(message.role) && text(message.content))
    // Provider-side instruction echoes are not conversation. Besides looking
    // broken, rendering one teaches the next model turn to repeat it.
    .filter((message) => message.role !== 'assistant' || !/(?:remember to follow|follow the) (?:the )?(?:developer|system) instructions?|(?:developer|system) instructions?:/i.test(text(message.content)))
    .map((message) => ({
      // A redacted turn is the server telling the model what a credential did.
      // The student did not type it, so it must not be drawn as if they had.
      role: message.redacted ? 'event' : message.role,
      content: message.content,
      at: message.at || null
    }))
}

// Trim the middle, never the ends: the opening establishes the task and the
// recent turns carry the thread.
export function historyForModel(conversation) {
  const messages = (conversation.messages || []).filter((message) => (
    message.role !== 'assistant' || !/(?:remember to follow|follow the) (?:the )?(?:developer|system) instructions?|(?:developer|system) instructions?:/i.test(text(message.content))
  ))
  if (messages.length <= MAX_HISTORY) return messages
  return [...messages.slice(0, 4), ...messages.slice(-(MAX_HISTORY - 4))]
}

// The conversation needs a model; the checklist at #/setup does not, and is the
// fallback wherever one is not configured.
export function onboardingAvailable(env = process.env) {
  const provider = String(env.LLM_PROVIDER || 'codex').toLowerCase()
  if (provider === 'openai') return Boolean(env.OPENAI_API_KEY)
  if (provider === 'anthropic' || provider === 'api') return Boolean(env.ANTHROPIC_API_KEY)
  // The CLI providers are a developer convenience and are not driven per turn.
  return false
}
