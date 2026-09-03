// The document review's rules, tested where they run.
//
// This is the module that decides what a tick means, so its edge cases are the
// ones that would let the reader change a plan the student did not agree to:
// a proposal that is never rendered, a conflict that arrives pre-ticked, an
// event that outlives the course it belongs to, and a count of "applied"
// changes larger than what the server was actually sent.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_IMAGE_PAGES,
  analysisPayload,
  analysisRequests,
  changeDiff,
  changeStatus,
  mergeAnalysisResults,
  defaultSelection,
  describeSource,
  groupChanges,
  mergeChangeSets,
  mergeReconciliations,
  reconciliationSummary,
  selectAll,
  selectedChanges,
  selectionSummary,
  toggleChange
} from '../lib/workspace/documents.mjs'

const change = (id, kind, extra = {}) => ({ id, kind, label: id, detail: '', payload: { id }, ...extra })

test('every proposal is rendered, including a kind the review does not know', () => {
  // The vanilla review listed a fixed set of kinds. A change with any other
  // kind was invisible, yet still counted and still applied by "select all".
  const changes = [change('a', 'result'), change('b', 'quantum-leap')]
  const groups = groupChanges(changes)
  assert.deepEqual(groups.flatMap((group) => group.changes.map((item) => item.id)).sort(), ['a', 'b'])
  assert.equal(groups.at(-1).kind, 'other')
  assert.equal(groups.at(-1).defaultOpen, true)
})

test('groups read conflicts first and drop the ones with nothing in them', () => {
  const groups = groupChanges([change('e', 'event'), change('c', 'attempt-conflict', { requiresDecision: true })])
  assert.deepEqual(groups.map((group) => group.kind), ['attempt-conflict', 'event'])
  assert.equal(groups[0].decisions, 1)
})

test('a long routine group folds, but any group holding a decision stays open', () => {
  const many = (kind, count, extra = {}) => Array.from({ length: count }, (_, index) => change(`${kind}-${index}`, kind, extra))
  assert.equal(groupChanges(many('event', 7))[0].defaultOpen, false)
  assert.equal(groupChanges(many('event', 6))[0].defaultOpen, true)
  // Seven events, one of which the source disagrees with the plan about.
  const withDecision = [...many('event', 6), change('event-x', 'event', { requiresDecision: true })]
  assert.equal(groupChanges(withDecision)[0].defaultOpen, true)
  // Current enrolment is short and consequential, so it is never folded.
  assert.equal(groupChanges(many('enrollment', 40))[0].defaultOpen, true)
})

test('nothing that contradicts the plan is ticked for the student', () => {
  const changes = [
    change('safe', 'result'),
    change('conflict', 'attempt-conflict', { requiresDecision: true, selectedByDefault: false }),
    // Belt and braces: a conflict whose selectedByDefault was forgotten server-side.
    change('half-flagged', 'course-conflict', { requiresDecision: true }),
    change('opt-out', 'event', { selectedByDefault: false })
  ]
  assert.deepEqual([...defaultSelection(changes)], ['safe'])
})

test('an event for a course that is not in the plan does not start ticked', () => {
  // The event's own selectedByDefault would allow it; its prerequisite does not.
  const changes = [
    change('course:new:PHY100', 'new-course', { requiresDecision: true, selectedByDefault: false }),
    change('event:lab', 'event', { requiresCourseChangeId: 'course:new:PHY100' })
  ]
  assert.deepEqual([...defaultSelection(changes)], [])
})

test('ticking a dependent event also ticks the course it needs', () => {
  const changes = [
    change('course:new:PHY100', 'new-course', { requiresDecision: true, selectedByDefault: false }),
    change('event:lab', 'event', { requiresCourseChangeId: 'course:new:PHY100' })
  ]
  const selected = toggleChange(changes, new Set(), 'event:lab', true)
  assert.deepEqual([...selected].sort(), ['course:new:PHY100', 'event:lab'])
})

test('unticking a course takes its events back out rather than orphaning them', () => {
  const changes = [
    change('course:new:PHY100', 'new-course'),
    change('event:lab', 'event', { requiresCourseChangeId: 'course:new:PHY100' }),
    change('event:exam', 'event', { requiresCourseChangeId: 'course:new:PHY100' }),
    change('event:other', 'event')
  ]
  const all = selectAll(changes)
  const selected = toggleChange(changes, all, 'course:new:PHY100', false)
  assert.deepEqual([...selected], ['event:other'])
})

test('a dependency cycle in the change set does not hang the review', () => {
  const changes = [
    change('a', 'event', { requiresCourseChangeId: 'b' }),
    change('b', 'event', { requiresCourseChangeId: 'a' })
  ]
  assert.deepEqual([...toggleChange(changes, new Set(), 'a', true)].sort(), ['a', 'b'])
  assert.deepEqual([...toggleChange(changes, selectAll(changes), 'a', false)], [])
})

test('only ticked proposals are sent, in the order they were proposed', () => {
  const changes = [change('a', 'result'), change('b', 'event'), change('c', 'profile')]
  assert.deepEqual(selectedChanges(changes, new Set(['c', 'a'])).map((item) => item.id), ['a', 'c'])
  // The payload travels intact — the server applies from it.
  assert.deepEqual(selectedChanges(changes, new Set(['a']))[0].payload, { id: 'a' })
})

test('a ticked event whose course is not ticked is withheld and counted as blocked', () => {
  // The server would refuse it. Sending it anyway would let the review claim
  // more changes were applied than were.
  const changes = [
    change('course:new:PHY100', 'new-course'),
    change('event:lab', 'event', { requiresCourseChangeId: 'course:new:PHY100' })
  ]
  const selected = new Set(['event:lab'])
  assert.deepEqual(selectedChanges(changes, selected).map((item) => item.id), [])
  assert.deepEqual(selectionSummary(changes, selected), {
    total: 2, selected: 1, applying: 0, blocked: 1, decisions: 0, decisionsSelected: 0
  })
})

test('the summary counts how many decisions the student is about to accept', () => {
  const changes = [
    change('a', 'result'),
    change('conflict', 'attempt-conflict', { requiresDecision: true, selectedByDefault: false })
  ]
  assert.equal(selectionSummary(changes, defaultSelection(changes)).decisionsSelected, 0)
  assert.equal(selectionSummary(changes, selectAll(changes)).decisionsSelected, 1)
})

test('two readings of the same fact are one proposal', () => {
  const left = { kind: 'transcript', changes: [change('a', 'result')], warnings: ['check the year'], sources: [{ name: 'a.pdf' }] }
  const right = { kind: 'timetable', changes: [change('a', 'result'), change('b', 'event')], warnings: ['check the year'] }
  const merged = mergeChangeSets(left, right, { name: 'b.ics' })
  assert.deepEqual(merged.changes.map((item) => item.id), ['a', 'b'])
  assert.deepEqual(merged.warnings, ['check the year'])
  assert.equal(merged.kind, 'mixed')
  assert.deepEqual(merged.sources, [{ name: 'a.pdf' }, { name: 'b.ics' }])
})

test('merging keeps the first reading when the second has nothing to say', () => {
  const left = { kind: 'transcript', changes: [change('a', 'result')] }
  assert.equal(mergeChangeSets(left, null), left)
  assert.deepEqual(mergeChangeSets(null, left, { name: 'a.pdf' }).sources, [{ name: 'a.pdf' }])
})

test('a course matched by one source is not also reported missing by the other', () => {
  const merged = mergeReconciliations(
    { kind: 'transcript', status: 'aligned', matched: [{ courseId: 'c1', code: 'PHY100' }], missing: [] },
    { kind: 'timetable', status: 'review', matched: [], missing: [{ courseId: 'c1', code: 'PHY100' }] }
  )
  assert.deepEqual(merged.missing, [])
  assert.equal(merged.status, 'aligned')
  assert.equal(merged.kind, 'mixed')
})

test('a cross-check with nothing to compare reports nothing rather than "all clear"', () => {
  assert.equal(reconciliationSummary({ reconciliation: { status: 'not-applicable' } }), null)
  assert.equal(reconciliationSummary({}), null)
})

test('an academic overview naming unselected courses is enrolment, not disagreement', () => {
  const overview = { kind: 'academic-overview', reconciliation: { status: 'attention', unselected: [{ code: 'PHY100' }], conflicts: [] } }
  assert.equal(reconciliationSummary(overview).currentEnrollment, true)
  assert.equal(reconciliationSummary(overview).issueCount, 1)
  // A transcript saying the same thing is a genuine gap in the plan.
  assert.equal(reconciliationSummary({ ...overview, kind: 'transcript' }).currentEnrollment, false)
  // And an overview that also disagrees about a fact is not just enrolment.
  const conflicted = { ...overview, reconciliation: { ...overview.reconciliation, conflicts: [{ id: 'x', label: 'x' }] } }
  assert.equal(reconciliationSummary(conflicted).currentEnrollment, false)
})

test('the image budget is for the whole read, not per file', () => {
  const file = (name, images) => ({ name, type: 'application/pdf', text: 't', images, pageCount: images.length })
  const { documents } = analysisPayload([file('a.pdf', ['1', '2', '3']), file('b.pdf', ['4', '5', '6']), file('c.pdf', ['7'])])
  assert.equal(documents.reduce((total, item) => total + item.images.length, 0), MAX_IMAGE_PAGES)
  assert.deepEqual(documents.map((item) => item.images.length), [3, 1, 0])
})

test('an .ics is parsed exactly, so it never goes to the model', () => {
  const ics = { name: 'timetable.ics', type: 'text/calendar', text: 'BEGIN:VCALENDAR', images: [], pageCount: 0 }
  const pdf = { name: 'transcript.pdf', type: 'application/pdf', text: 'x', images: [], pageCount: 1 }
  const payload = analysisPayload([ics, pdf])
  assert.deepEqual(payload.calendars.map((item) => item.name), ['timetable.ics'])
  assert.deepEqual(payload.documents.map((item) => item.name), ['transcript.pdf'])
  // An .ics with no text could not be parsed, so it is read like any other file.
  assert.deepEqual(analysisPayload([{ ...ics, text: '' }]).calendars, [])
})

test('the read is one ordered list of requests, decided here rather than in the surface', () => {
  const ics = { name: 'timetable.ics', type: 'text/calendar', text: 'BEGIN:VCALENDAR', images: [], pageCount: 0 }
  const pdf = { name: 'transcript.pdf', type: 'application/pdf', text: 'x', images: [], pageCount: 1 }
  const requests = analysisRequests([ics, pdf], { kind: 'transcript', description: ' ', date: '2026-09-03' })
  // The documents request goes first: a calendar's events may depend on the
  // courses a transcript proposes.
  assert.deepEqual(requests.map((request) => request.path), ['/api/academics/documents/analyze', '/api/academics/calendars/preview'])
  assert.deepEqual(requests[0].body.documents.map((item) => item.name), ['transcript.pdf'])
  assert.equal(requests[0].body.kind, 'transcript')
  assert.equal(requests[1].body.date, '2026-09-03')
  assert.deepEqual(requests[1].source, { name: 'timetable.ics' })
  // Nothing to read is no request at all, rather than an empty post.
  assert.deepEqual(analysisRequests([], {}), [])
  // A description alone is still a read.
  assert.equal(analysisRequests([], { description: 'I passed PHY100' }).length, 1)
})

test('every answer folds into the one review, in the order it was requested', () => {
  const merged = mergeAnalysisResults([
    { result: { kind: 'transcript', changes: [{ id: 'a', kind: 'result' }], sources: [{ name: 'transcript.pdf' }] }, source: null },
    { result: { kind: 'calendar-feed', changes: [{ id: 'a', kind: 'result' }, { id: 'b', kind: 'event' }] }, source: { name: 'timetable.ics' } }
  ])
  assert.deepEqual(merged.changes.map((change) => change.id), ['a', 'b'])
  assert.deepEqual(merged.sources, [{ name: 'transcript.pdf' }, { name: 'timetable.ics' }])
  assert.equal(mergeAnalysisResults([]), null)
})

test('each proposal says what it would do to the plan in one word', () => {
  assert.equal(changeStatus(change('a', 'new-course')), 'new')
  assert.equal(changeStatus(change('b', 'event', { payload: { event: {} } })), 'new')
  // Anything addressed at a record the plan already holds is a match.
  assert.equal(changeStatus(change('c', 'result', { payload: { courseId: 'c1', attempt: {} } })), 'match')
  assert.equal(changeStatus(change('d', 'profile', { payload: { field: 'university', value: 'UM' } })), 'match')
  // A conflict is a conflict whether the kind or the flag says so.
  assert.equal(changeStatus(change('e', 'course-conflict', { payload: { courseId: 'c1' } })), 'conflict')
  assert.equal(changeStatus(change('f', 'new-course', { requiresDecision: true })), 'conflict')
})

test('a conflict shows both values rather than describing the disagreement', () => {
  assert.deepEqual(
    changeDiff({ detail: 'Selected plan: 6 ECTS · Transcript: 7 ECTS' }),
    { current: '6 ECTS', source: 'Transcript', proposed: '7 ECTS' }
  )
  // A blank side is still a side.
  assert.deepEqual(changeDiff({ detail: 'Selected plan:  · Exam schedule: BCS1000' }).current, 'blank')
  // Advice trailing the proposal is guidance, not the proposed value.
  assert.equal(
    changeDiff({ detail: 'Selected plan: passed 8 · Exam schedule: upcoming 14 Oct. Add a new attempt only if this is intentional.' }).proposed,
    'upcoming 14 Oct'
  )
  // Anything that is not a disagreement has no diff to show.
  assert.equal(changeDiff({ detail: 'Currently blank' }), null)
  assert.equal(changeDiff({}), null)
})

test('a source is described by what it actually contributes', () => {
  assert.equal(describeSource({ name: 'a.pdf', pageCount: 1, text: 'x', images: [] }), '1 page')
  assert.equal(describeSource({ name: 'a.txt', pageCount: 0, text: 'x'.repeat(4200), images: [] }), '4k characters')
  assert.equal(describeSource({ name: 'a.png', pageCount: 0, text: '', images: ['data:'] }), 'image')
  assert.equal(describeSource({ name: 'a.txt', pageCount: 0, text: '', images: [] }), 'empty')
})
