/**
 * What setup is still missing, in the order it is asked for.
 *
 * The server already computes the truth: `GET /api/onboarding` returns a
 * `state` object built by `setupState()` in lib/onboarding-runtime.mjs, and
 * that is the only source these rules read. Nothing here re-derives a fact
 * from a client cache — the vanilla checklist did, and it could report a step
 * as done while the conversation, reading the server, asked for it again.
 *
 * Two rules carry the whole module:
 *
 *   1. A step is done only when the server says the source is connected. Not
 *      "probably", not "skipped so let us stop nagging". Skipping is its own
 *      status and it reads as not connected, because it is.
 *   2. `state.electives` is `true` when there is nothing to choose from *and*
 *      when there is no programme at all — the server says so deliberately,
 *      because with no programme the programme step is what is blocking. Taken
 *      at face value on a checklist that reads as "electives: done" on an
 *      empty account, which is a lie. So it is reported as blocked until a
 *      programme exists.
 */

// The order the server's opening message walks (lib/onboarding-runtime.mjs
// `openingMessage`), so the checklist and the conversation cannot disagree
// about what comes next. The vanilla checklist used its own order and put the
// academic record last, after Canvas, while the conversation asked for it
// third.
export const SETUP_STEPS = Object.freeze([
  Object.freeze({
    id: 'programme',
    title: 'Your programme',
    required: true,
    blurb: 'Which degree you are on, and the courses it carries.',
    action: 'Set up my plan',
    href: '/app/planning?tab=overview'
  }),
  Object.freeze({
    id: 'electives',
    title: "This period's electives",
    required: false,
    blurb: 'The optional courses you are taking, which nobody can fill in for you.',
    action: 'Choose electives',
    href: '/app/planning?tab=courses'
  }),
  Object.freeze({
    id: 'record',
    title: 'Your academic record',
    required: false,
    blurb: 'Credits earned, courses passed, and what you are registered for.',
    action: 'Upload Academic Work',
    href: '/app/planning?tab=documents'
  }),
  Object.freeze({
    id: 'calendar',
    title: 'The academic calendar',
    required: false,
    blurb: 'Teaching periods, exam weeks and holidays for your programme.',
    action: 'Review the calendar',
    href: '/app/calendar'
  }),
  Object.freeze({
    id: 'timetable',
    title: 'Your timetable',
    required: false,
    blurb: 'Lectures, tutorials and labs, with times and rooms.',
    action: 'Connect timetable',
    href: '/app/planning?tab=documents'
  }),
  Object.freeze({
    id: 'canvas',
    title: 'Canvas',
    required: false,
    blurb: 'Announcements, assignment deadlines and course material.',
    action: 'Connect Canvas',
    href: '/app/account?tab=connections'
  })
])

/** 'done' | 'skipped' | 'blocked' | 'todo'. Never anything else. */
export function stepStatus(id, state, skipped = []) {
  if (!state) return 'todo'
  // Electives cannot be answered — or judged — before a programme exists, and
  // the server reports them as settled in that case. See the header.
  if (id === 'electives' && !state.programme) return 'blocked'
  if (state[id] === true) return 'done'
  // Connected wins over skipped: a student who skipped Canvas in the
  // conversation and connected it from Account has connected it.
  if (skipped.includes(id)) return 'skipped'
  return 'todo'
}

const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const plural = (value, word) => `${value} ${word}${value === 1 ? '' : 's'}`

// What is actually lost while a source is missing. Said in those terms because
// "not connected" on its own is not a reason to connect anything.
const MISSING = Object.freeze({
  programme: 'Not set, so there are no courses, periods or exam weeks to work from.',
  electives: 'Unanswered, so your plan is missing whichever optional courses you are sitting.',
  record: 'Not uploaded, so credits earned and courses passed are unknown.',
  calendar: 'Not maintained for your programme, so no teaching period can be named.',
  timetable: 'Not connected, so lectures, tutorials and labs are not shown.',
  canvas: 'Not connected, so announcements and hand-in deadlines are not shown.'
})

/**
 * One line of fact under a step, sourced only from `state`. Where there is a
 * number the server gave us it is used; where there is not, the line says what
 * is missing rather than printing a zero that reads like a measurement.
 */
export function stepDetail(id, state, status = stepStatus(id, state)) {
  const missing = MISSING[id]
  if (!state) return 'Checking…'
  if (status === 'blocked') return 'Waiting on your programme.'
  if (status === 'skipped') return `You skipped this. ${missing}`
  if (status !== 'done') return missing

  if (id === 'programme') {
    const courses = count(state.courseCount)
    return [state.programmeName || 'A programme is set', courses ? plural(courses, 'course') : null].filter(Boolean).join(' · ')
  }
  if (id === 'electives') {
    if (state.customProgramme) return 'No maintained elective groups. Add courses from your personal plan.'
    const chosen = count(state.electivesChosen)
    return chosen ? `${plural(chosen, 'elective')} recorded for this period.` : 'No elective group is left unanswered for this period.'
  }
  if (id === 'record') {
    const summary = state.recordSummary
    if (!summary) return 'A reading is on file.'
    return [
      `${count(summary.earnedEcts)} credits earned`,
      `${plural(count(summary.passedCourses), 'course')} passed`,
      summary.weightedAverage == null ? null : `weighted average ${summary.weightedAverage}`
    ].filter(Boolean).join(' · ')
  }
  if (id === 'calendar') {
    const dates = count(state.calendarDates)
    return dates ? `${plural(dates, 'date')} maintained for your programme.` : 'Maintained for your programme.'
  }
  if (id === 'timetable') {
    const events = count(state.timetableEvents)
    return events ? `${plural(events, 'appointment')} from your timetable feed.` : 'A feed is connected, but it carried no appointments.'
  }
  // Canvas: the state carries no count, so no count is claimed.
  return 'Connected.'
}

/** Every step, with its status and its one line of fact. */
export function setupSteps({ state = null, skipped = [] } = {}) {
  const declined = Array.isArray(skipped) ? skipped : []
  return SETUP_STEPS.map((step) => {
    const status = stepStatus(step.id, state, declined)
    return { ...step, status, done: status === 'done', detail: stepDetail(step.id, state, status) }
  })
}

export function connectedCount(steps) {
  return steps.filter((step) => step.status === 'done').length
}

/** Everything not connected — skipped and blocked included, because neither is done. */
export function outstandingSteps(steps) {
  return steps.filter((step) => step.status !== 'done')
}

/** The first step that can be acted on now. Blocked and skipped ones are not it. */
export function nextStep(steps) {
  return steps.find((step) => step.status === 'todo') ?? null
}

export function isComplete(steps) {
  return steps.length > 0 && steps.every((step) => step.status === 'done')
}

/**
 * A redacted turn is the server telling the model what a credential did, so it
 * ends with an instruction addressed to the model. The student is shown the
 * fact, not the stage direction.
 */
export function eventLine(content) {
  return String(content || '').replace(/\s*Confirm this briefly and move on\.?\s*$/, '').trim()
}

/**
 * One page of the Academic Work overview, rebuilt from the positioned text
 * runs a PDF is really made of.
 *
 * The parser on the server reads that overview as a table, so the columns have
 * to survive: a gap wider than `columnGap` is a column boundary and becomes a
 * tab, anything closer is a space. Rows are grouped by baseline — PDF y grows
 * upwards, hence the descending sort — with a small tolerance, because a run
 * that sits a hair off the baseline still belongs to its row.
 *
 * Items are `{ text, x, y, width }`; pdf.js's own shape is mapped to it by the
 * caller so this stays testable without a PDF.
 */
export function pdfPageText(items, { rowTolerance = 2, columnGap = 10 } = {}) {
  const rows = []
  for (const item of items || []) {
    const text = String(item?.text ?? '').trim()
    if (!text) continue
    const x = Number(item.x) || 0
    const y = Number(item.y) || 0
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= rowTolerance)
    if (!row) { row = { y, items: [] }; rows.push(row) }
    row.items.push({ x, end: x + (Number(item.width) || 0), text })
  }
  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) => {
      const cells = row.items.sort((left, right) => left.x - right.x)
      let end = 0
      return cells
        .map((cell, index) => {
          const separator = index && cell.x - end > columnGap ? '\t' : index ? ' ' : ''
          end = Math.max(end, cell.end)
          return `${separator}${cell.text}`
        })
        .join('')
    })
    .join('\n')
    .trim()
}
