import test from 'node:test'
import assert from 'node:assert/strict'
import { localDay, rankPriorities } from '../lib/study-briefing.mjs'

test('the student’s day is the university’s day, not UTC', () => {
  // 22:30 UTC on 1 September is already 2 September in Maastricht, and that is
  // exactly when someone checks what is due tomorrow. Reading the date off a
  // UTC timestamp put the whole briefing a day behind.
  assert.equal(localDay(new Date('2026-09-01T22:30:00Z')), '2026-09-02')
  assert.equal(localDay(new Date('2026-09-01T10:00:00Z')), '2026-09-01')
  // Winter is UTC+1, so the boundary moves with the offset rather than being
  // assumed at two hours year-round.
  assert.equal(localDay(new Date('2026-12-01T23:30:00Z')), '2026-12-02')
  assert.equal(localDay(new Date('2026-12-01T22:30:00Z')), '2026-12-01')
  // An unknown zone falls back rather than throwing mid-briefing.
  assert.equal(localDay(new Date('2026-09-01T10:00:00Z'), 'Not/AZone'), '2026-09-01')
  assert.equal(localDay(new Date('nonsense')), '')
})

test('priorities rank by what actually costs the student, not by date alone', () => {
  const ranked = rankPriorities([
    { kind: 'teaching', when: '2026-09-02', title: 'Lecture tomorrow' },
    { kind: 'due', when: '2026-09-03', title: 'Quiz' },
    { kind: 'exam', when: '2026-10-14', title: 'Exam next month' },
    { kind: 'missing', when: '2026-08-20', title: 'Missed hand-in' },
    { kind: 'overdue', when: '2026-08-30', title: 'Late report' },
    { kind: 'due', when: '2026-09-02', title: 'Checkpoint today' }
  ])
  assert.deepEqual(ranked.map((item) => item.title), [
    // Work Canvas has already marked missing comes first, then an overdue
    // hand-in, then an exam a month out — before a lecture tomorrow.
    'Missed hand-in',
    'Late report',
    'Exam next month',
    'Checkpoint today',
    'Quiz',
    'Lecture tomorrow'
  ])
})
