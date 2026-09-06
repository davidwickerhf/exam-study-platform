import { ModelError } from './model-loop.mjs'

const string = { type: 'string' }
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const array = items => ({ type: 'array', items })

// Presentation is separate from executable proposals. IDs may only refer to
// proposals actually returned by this turn's tools, never model-authored payloads.
export const TUTOR_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: { name: 'tutor_answer', strict: true, schema: object({
    summary: string,
    priorities: array(object({
      urgency: { type: 'string', enum: ['now', 'soon', 'later'] },
      title: string, course: string, timing: string, action: string,
      consequence: string, uncertainty: string, proposalIds: array(string)
    })),
    courses: array(object({ course: string, missed: string, recovery: string })),
    drafts: array(object({ key: string, title: string, recipient: string, subject: string, body: string })),
    attendance: array(string),
    work: array(string), diagnostics: array(string), reviews: array(string),
    agenda: array(object({ title: string, course: string, when: string, location: string, kind: { type: 'string', enum: ['class', 'deadline', 'exam', 'study'] }, note: string })),
    metrics: array(object({ label: string, value: string, source: string, status: { type: 'string', enum: ['recorded', 'scenario', 'needs-checking'] }, note: string })),
    options: array(object({ title: string, outcome: string, tradeoff: string, uncertainty: string, proposalIds: array(string) })),
    detail: string
  }) }
}

export const TUTOR_RESPONSE_INSTRUCTIONS = `Return the answer using the tutor_answer response schema. The interface renders priorities and courses as widgets and drafts in the Proposed Actions sidebar.
For catch-up, absence, planning, or priority questions: summary is 1–2 direct sentences (about 50 words). Put at most 5 ranked next steps in priorities, at most 8 concise course rows in courses, and at most 2 useful email drafts in drafts. Avoid repeating the same fact across summary, priorities, courses and detail. Keep each action to one sentence; consequence is the short reason it matters. Aim for 250 words visible across the summary and widgets, unless the student explicitly requests more detail. Use detail for optional supporting explanations, never to hide an urgent consequence or uncertainty.
Urgency now means action is needed today, soon means an upcoming dated obligation, later means catch-up that can wait. Put irreversible consequences first. timing must distinguish a verified deadline from a suggested study date, use readable university-local dates/times, and leave it empty when unknown. Do not label a future quiz as already missed. Scheduled sessions are not proof of non-attendance: attribute absence to the student's report and distinguish known missed work from work that needs checking. Never speculate about unofficial exceptions (for example what TAs sometimes allow). Keep needs-review rules and missing evidence visible in uncertainty.
When the student asks how to recover or what to do, prepare 1–3 useful, concrete actions with the existing propose_* tools BEFORE the final response, whenever their required inputs are supported. For requested recovery, favour a persistent catch-up checklist or focused practice set. Do not reschedule study blocks unless explicitly asked. Approval is still required to change tracked work. Use a clearly labelled suggested date for a study block, never an invented deadline. Do not ask whether to prepare an action you can already stage. Do not create duplicate proposals or repeat existing calendar deadlines. Link priority proposalIds to IDs returned by successful tools; never invent IDs or claim an action was completed. If tools cannot support a useful action, explain the specific missing input instead of creating a token proposal.
For a narrow follow-up, answer that question only. Do not repeat a previous recovery plan or restage its actions. Leave unrelated priorities, courses and drafts empty.
Each email draft has a stable key identifying its course, audience and purpose. Reuse an existing draft key when revising it; do not create another draft for the same purpose.
If an email follow-up is useful, write a short ready-to-copy draft. Use a recipient role if their identity is unknown; do not invent an email address, excuse, diagnosis or contents of an earlier email. Reference an earlier email only as reported by the student. Drafting does not send email; the student must copy and send it. Do not imply access to an email inbox. Do not stage email sending as a proposal: there is no sending tool.
For "what do I need to do today" and "what are my priorities this week", use get_briefing and get_study_work (and get_schedule where needed), then ranked priorities plus an agenda only where times/rooms add value. Separate overdue tasks, today's obligations, and later deadlines; do not turn every scheduled class into a task.
For "what has my attendance been for X out of the requirement", call get_attendance. Put the returned report IDs in attendance (up to 6), not model-calculated attendance figures in metrics. The UI uses the source counts and requirements directly. Explain incomplete coverage and unmarked sessions; a recorded rate is not a verified compliance verdict. Do not merge lecture and lab rules or different years. If the student reports attendance, stage propose_attendance_update for the unambiguously identified sessions. Never mark an ambiguous "one Blockchain lab" without clarifying which one; do not mark all labs attended or missed by assumption. Tutor cannot grant excused absence. Explain that approved marks update their personal attendance log.
Choose only widgets that directly answer the current question; normally use one or two widget families, not all of them. Agenda: use up to 8 chronological entries for "what is next", a day or week overview, including rooms and times only when returned by get_schedule/get_briefing. Every entry has kind class/deadline/exam/study; distinguish a submission deadline from a teaching session and flag suggested study time in note. Do not imply this is a complete calendar if more events exist or sources are missing; state the scope/gap in summary.
Metrics: use up to 4 figures for "am I on track", credits or results, from get_progress/get_planning_context. Include the specific source in source, and label status recorded, scenario, or needs-checking. Never add repeated attempts to earned credits; use authoritative reconciled totals returned by the tools. A disagreement between transcript and academic work must be visible in note and status needs-checking; do not invent a resolution. Unknown values are "Not available", never zero. Do not convert a what-if scenario into a recorded result.
Options: use 2–3 side-by-side choices for resit/deferral or study-plan decisions, with an outcome, tradeoff and explicit uncertainty. Read get_planning_context and relevant rules before comparing academic consequences. Do not invent probabilities or recommend an ineligible sitting. Stage only the recommended or requested change, not every mutually exclusive option. Link only real proposal IDs. Leave options empty for a single straightforward action.
Use get_study_work for personal assignments, readings, project progress and catch-up. Stage propose_study_work or propose_study_project for concrete requested changes, not just a textual offer. Mark done only when the student reports completion; Canvas submitted and graded are separate read-only observations from get_canvas_assignments. No group member is notified. Use get_weekly_review for completed/slipped work and get_study_readiness for evidence about practice and coverage. A short diagnostic and self-ratings are not official grades or proof of exam readiness.
For focused readiness checks, retrieve course material then prepare_diagnostic. For checking a draft, retrieve its attached contents and the assignment brief/rubric then prepare_submission_review. Put IDs returned by those tools into diagnostics or reviews; put existing task IDs into work. These resolve to real persisted widgets. New pending tasks belong in Proposed Actions, not work until approved. Never invent artifact IDs. Leave unused arrays empty. Do not expose diagnostic answer keys in prose before the student attempts the questions.
For conceptual explanations, calculations or simple questions: use Markdown in summary with the detail necessary to teach the concept and preserve mathematical notation. Leave unnecessary widget arrays empty. Do not force every answer into a recovery plan. Do not finish with a generic offer or a question when a prepared action already supplies the next step.`

function requiredText(value, name, max) {
  if (typeof value !== 'string' || value.length > max) throw new ModelError(`Tutor could not format ${name}. Please retry your question.`)
  return value.trim()
}
function rows(value, name, max) {
  if (!Array.isArray(value) || value.length > max || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new ModelError(`Tutor could not format ${name}. Please retry your question.`)
  return value
}

export function parseTutorResponse(content, proposals = [], attendanceReports = [], artifacts = {}) {
  let value
  try { value = JSON.parse(content) } catch { throw new ModelError('Tutor could not format the answer. Please retry your question.') }
  if (!value || typeof value !== 'object') throw new ModelError('Tutor returned an incomplete answer. Please retry your question.')
  const summary = requiredText(value.summary, 'the answer', 24000)
  if (!summary) throw new ModelError('Tutor returned an empty answer. Please retry your question.')
  const allowed = new Set(proposals.map(item => item.id))
  const priorities = rows(value.priorities, 'priorities', 5).map(item => {
    if (!['now', 'soon', 'later'].includes(item.urgency)) throw new ModelError('Tutor returned an invalid priority. Please retry your question.')
    return { urgency: item.urgency,
      ...Object.fromEntries(['title', 'course', 'timing', 'action', 'consequence', 'uncertainty'].map(key => [key, requiredText(item[key], key, key === 'course' ? 80 : 800)])),
      proposalIds: [...new Set((Array.isArray(item.proposalIds) ? item.proposalIds : []).filter(id => allowed.has(id)))]
    }
  }).sort((a, b) => ['now', 'soon', 'later'].indexOf(a.urgency) - ['now', 'soon', 'later'].indexOf(b.urgency))
  const courses = rows(value.courses, 'courses', 8).map(item => Object.fromEntries(['course', 'missed', 'recovery'].map(key => [key, requiredText(item[key], key, 1200)])))
  const drafts = rows(value.drafts, 'drafts', 2).map(item => ({ ...Object.fromEntries(['title', 'recipient', 'subject', 'body'].map(key => [key, requiredText(item[key], key, key === 'body' ? 4000 : 240)])), ...(item.key ? { key: requiredText(item.key, 'draft key', 160) } : {}) }))
  const attendance = [...new Set(Array.isArray(value.attendance) ? value.attendance.filter(id => typeof id === 'string').slice(0, 6) : [])].map(id => attendanceReports.find(report => report.id === id)).filter(Boolean)
  const agenda = rows(value.agenda ?? [], 'agenda', 8).map(item => {
    if (!['class', 'deadline', 'exam', 'study'].includes(item.kind)) throw new ModelError('Tutor returned an invalid agenda entry. Please retry your question.')
    return { kind: item.kind, ...Object.fromEntries(['title', 'course', 'when', 'location', 'note'].map(key => [key, requiredText(item[key], key, 800)])) }
  })
  const metrics = rows(value.metrics ?? [], 'progress figures', 4).map(item => {
    if (!['recorded', 'scenario', 'needs-checking'].includes(item.status)) throw new ModelError('Tutor returned an invalid progress status. Please retry your question.')
    return { status: item.status, ...Object.fromEntries(['label', 'value', 'source', 'note'].map(key => [key, requiredText(item[key], key, 800)])) }
  })
  const options = rows(value.options ?? [], 'options', 3).map(item => ({
    ...Object.fromEntries(['title', 'outcome', 'tradeoff', 'uncertainty'].map(key => [key, requiredText(item[key], key, 1200)])),
    proposalIds: [...new Set((Array.isArray(item.proposalIds) ? item.proposalIds : []).filter(id => allowed.has(id)))]
  }))
  const detail = requiredText(value.detail, 'supporting details', 16000)
  const resolveArtifacts = name => [...new Set(Array.isArray(value[name]) ? value[name].filter(id => typeof id === 'string').slice(0, name === 'work' ? 8 : 2) : [])].map(id => artifacts[name]?.get(id)).filter(Boolean)
  const work = resolveArtifacts('work'), diagnostics = resolveArtifacts('diagnostics'), reviews = resolveArtifacts('reviews')
  const presentation = { work, diagnostics, reviews, summary, priorities, courses, drafts, attendance, agenda, metrics, options, detail }
  // Canonical plain text remains complete for copy, full-text recall and older
  // clients. The current UI renders presentation instead of duplicating it.
  const transcript = [summary,
    ...priorities.map(item => [`${item.urgency === 'now' ? 'Act now' : item.urgency === 'soon' ? 'Coming up' : 'Catch up'}: ${item.title}`, item.course, item.timing, item.action, item.consequence, item.uncertainty].filter(Boolean).join(' — ')),
    ...courses.map(item => `${item.course}: ${item.missed}\nCatch up: ${item.recovery}`),
    ...attendance.map(item => `${item.course} ${item.activity} attendance (${item.from} to ${item.to}): ${item.attended} attended, ${item.missed} missed, ${item.excused} excused, ${item.unmarked} unmarked. Recorded rate: ${item.rate ?? 'unknown'}${item.rate === null ? '' : '%'}. Requirement: ${item.requirement}. ${item.note} ${item.coverageNote || ''}`),
    ...agenda.map(item => `${item.kind}: ${[item.when, item.title, item.course, item.location, item.note].filter(Boolean).join(' — ')}`),
    ...metrics.map(item => `${item.label}: ${item.value} (${item.status}; ${item.source}). ${item.note}`),
    ...options.map(item => `Option: ${item.title}\nOutcome: ${item.outcome}\nTrade-off: ${item.tradeoff}${item.uncertainty ? `\nNeeds checking: ${item.uncertainty}` : ''}`),
    ...work.map(item => `Personal ${item.kind}: ${item.title} (${item.status}). ${item.detail} Target: ${item.dueDate || 'unset'}. Responsibility: ${item.responsibility}. ${item.blocker ? `Blocked: ${item.blocker}` : ''}`),
    ...diagnostics.map(item => `Diagnostic: ${item.title} — ${item.courseCode}, ${item.topic}. ${item.questions.length} questions. ${item.attempts.map(attempt => `Recorded attempt ${attempt.score}/${attempt.total}`).join('; ')}`),
    ...reviews.map(item => `Submission check: ${item.title}. ${item.summary}\n${item.criteria.map(criterion => `${criterion.criterion}: ${criterion.status} — ${criterion.finding}`).join('\n')}`),
    ...proposals.map(item => `Proposed action (approval required): ${[item.title, item.summary, item.detail].filter(Boolean).join(' — ')}`),
    ...drafts.map(item => `Unsent email draft: ${item.title}\nTo: ${item.recipient}\nSubject: ${item.subject}\n${item.body}`),
    detail
  ].filter(Boolean).join('\n\n')
  return { content: transcript, presentation }
}
