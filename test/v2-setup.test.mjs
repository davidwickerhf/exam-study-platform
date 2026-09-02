// Setup's rules, tested where they run.
//
// The one that matters is honesty: a checklist that reports a source as
// connected when it is not is worse than no checklist. `setupState()` on the
// server reports `electives: true` for an account with no programme — that is
// correct for the model, which is being told not to ask about it yet, and a
// lie on a page that draws a tick beside it. The first three tests pin that.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SETUP_STEPS,
  connectedCount,
  eventLine,
  isComplete,
  nextStep,
  outstandingSteps,
  pdfPageText,
  setupSteps,
  stepDetail,
  stepStatus
} from '../lib/workspace/setup.mjs'

// What GET /api/onboarding returns for an account that has done nothing. Note
// `electives: true` — see the header.
const EMPTY = {
  programme: false,
  programmeName: null,
  courseCount: 0,
  record: false,
  recordSummary: null,
  calendar: false,
  calendarDates: 0,
  timetable: false,
  timetableEvents: 0,
  canvas: false,
  electives: true,
  electivesPending: 0,
  electivesChosen: 0
}

const withState = (patch) => ({ ...EMPTY, ...patch })

test('an empty account has nothing connected, and electives are blocked rather than done', () => {
  const steps = setupSteps({ state: EMPTY })
  assert.equal(connectedCount(steps), 0)
  assert.equal(steps.find((step) => step.id === 'electives').status, 'blocked')
  assert.equal(steps.find((step) => step.id === 'electives').done, false)
  assert.equal(stepDetail('electives', EMPTY), 'Waiting on your programme.')
})

test('the first thing to do on an empty account is the programme, not the electives', () => {
  assert.equal(nextStep(setupSteps({ state: EMPTY })).id, 'programme')
})

test('electives only become answerable once a programme exists', () => {
  const state = withState({ programme: true, programmeName: 'Bachelor Computer Science', courseCount: 14, electives: false, electivesPending: 2 })
  const steps = setupSteps({ state })
  assert.equal(steps.find((step) => step.id === 'electives').status, 'todo')
  assert.equal(nextStep(steps).id, 'electives')
  // The programme is done, and says so with the numbers the server gave.
  assert.equal(stepDetail('programme', state), 'Bachelor Computer Science · 14 courses')
})

test('a skipped step reads as skipped, never as done, and is not offered as the next thing', () => {
  const state = withState({ programme: true, courseCount: 9, electives: false })
  const steps = setupSteps({ state, skipped: ['electives', 'record'] })
  const electives = steps.find((step) => step.id === 'electives')
  assert.equal(electives.status, 'skipped')
  assert.equal(electives.done, false)
  assert.match(electives.detail, /^You skipped this\./)
  assert.equal(connectedCount(steps), 1)
  // Skipped is still outstanding — it is not connected.
  assert.deepEqual(outstandingSteps(steps).map((step) => step.id), ['electives', 'record', 'calendar', 'timetable', 'canvas'])
  assert.equal(nextStep(steps).id, 'calendar')
})

test('connecting something that was skipped clears the skip', () => {
  const state = withState({ programme: true, canvas: true })
  const steps = setupSteps({ state, skipped: ['canvas'] })
  assert.equal(steps.find((step) => step.id === 'canvas').status, 'done')
})

test('only the programme is required', () => {
  assert.deepEqual(SETUP_STEPS.filter((step) => step.required).map((step) => step.id), ['programme'])
})

test('the checklist walks the same order the conversation asks in', () => {
  // lib/onboarding-runtime.mjs openingMessage(): programme, electives, record,
  // calendar, timetable, canvas.
  assert.deepEqual(SETUP_STEPS.map((step) => step.id), ['programme', 'electives', 'record', 'calendar', 'timetable', 'canvas'])
})

test('a fully connected account is complete and has nothing outstanding', () => {
  const state = withState({
    programme: true, programmeName: 'Bachelor Data Science and Artificial Intelligence', courseCount: 21,
    electives: true, electivesChosen: 2,
    record: true, recordSummary: { earnedEcts: 96, passedCourses: 17, weightedAverage: 7.4 },
    calendar: true, calendarDates: 34,
    timetable: true, timetableEvents: 212,
    canvas: true
  })
  const steps = setupSteps({ state })
  assert.equal(connectedCount(steps), 6)
  assert.equal(isComplete(steps), true)
  assert.deepEqual(outstandingSteps(steps), [])
  assert.equal(nextStep(steps), null)
  assert.equal(stepDetail('record', state), '96 credits earned · 17 courses passed · weighted average 7.4')
  assert.equal(stepDetail('calendar', state), '34 dates maintained for your programme.')
  assert.equal(stepDetail('timetable', state), '212 appointments from your timetable feed.')
  assert.equal(stepDetail('electives', state), '2 electives recorded for this period.')
})

test('a number the server did not give is not invented', () => {
  // A record snapshot with no summary, a timetable feed that returned nothing,
  // and Canvas — which carries no count at all — must not print a zero that
  // reads like a measurement.
  const state = withState({ programme: true, record: true, recordSummary: null, timetable: true, timetableEvents: 0, canvas: true })
  assert.equal(stepDetail('record', state), 'A reading is on file.')
  assert.equal(stepDetail('timetable', state), 'A feed is connected, but it carried no appointments.')
  assert.equal(stepDetail('canvas', state), 'Connected.')
  assert.doesNotMatch(stepDetail('canvas', state), /\d/)
})

test('a single course and a single elective are not pluralised', () => {
  const state = withState({ programme: true, programmeName: 'Bachelor Psychology', courseCount: 1, electives: true, electivesChosen: 1 })
  assert.equal(stepDetail('programme', state), 'Bachelor Psychology · 1 course')
  assert.equal(stepDetail('electives', state), '1 elective recorded for this period.')
})

test('an unnamed programme with courses is still a programme', () => {
  const state = withState({ programme: true, programmeName: null, courseCount: 6 })
  assert.equal(stepDetail('programme', state), 'A programme is set · 6 courses')
})

test('with no state at all nothing is claimed either way', () => {
  assert.equal(stepStatus('canvas', null), 'todo')
  assert.equal(stepDetail('canvas', null), 'Checking…')
})

test('a redacted turn is shown as the fact, not as the instruction to the model', () => {
  assert.equal(
    eventLine('The timetable is connected: 212 appointments across 7 course codes. Confirm this briefly and move on.'),
    'The timetable is connected: 212 appointments across 7 course codes.'
  )
  assert.equal(eventLine('Canvas is connected: 5 current courses are visible. Confirm this briefly and move on'), 'Canvas is connected: 5 current courses are visible.')
  assert.equal(eventLine('Nothing to strip.'), 'Nothing to strip.')
})

// ── The Academic Work overview ────────────────────────────────────────────
// It is read as a table by lib/academic-work.mjs, so the columns have to
// survive extraction: a wide gap is a column, a narrow one is a space.

test('a page is rebuilt top down, left to right', () => {
  const items = [
    { text: 'second', x: 40, y: 700, width: 30 },
    { text: 'row', x: 10, y: 700, width: 20 },
    { text: 'first', x: 10, y: 720, width: 25 }
  ]
  assert.equal(pdfPageText(items), 'first\nrow second')
})

test('a wide gap between runs is a column boundary, a narrow one is a space', () => {
  const row = [
    { text: 'BCS1110', x: 10, y: 500, width: 40 },
    { text: 'Computer Science', x: 55, y: 500, width: 90 },
    { text: '7.5', x: 400, y: 500, width: 15 }
  ]
  // 55 - 50 = 5, so a space. 400 - 145 = 255, so a tab.
  assert.equal(pdfPageText(row), 'BCS1110 Computer Science\t7.5')
})

test('a run a hair off the baseline still belongs to its row', () => {
  const items = [
    { text: 'passed', x: 10, y: 300, width: 30 },
    { text: '5', x: 45, y: 301.5, width: 8 }
  ]
  assert.equal(pdfPageText(items), 'passed 5')
  // Beyond the tolerance it is a row of its own, and PDF y grows upwards.
  assert.equal(pdfPageText([{ text: 'passed', x: 10, y: 300, width: 30 }, { text: '5', x: 45, y: 306, width: 8 }]), '5\npassed')
})

test('blank runs and an empty page produce nothing rather than blank lines', () => {
  assert.equal(pdfPageText([{ text: '   ', x: 10, y: 10, width: 5 }]), '')
  assert.equal(pdfPageText([]), '')
  assert.equal(pdfPageText(null), '')
})
