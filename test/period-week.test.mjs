// Which week of the teaching period today falls in. Home states this at the
// top of the page, so an off-by-one is a visible lie about where the student
// is in their term — and it shipped: the first version floored the elapsed
// week count at one and then added one, so a period read "week 2 of 8" on the
// Monday morning it began.
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { periodWeek } from '../lib/workspace/home.mjs'

// Maastricht Period 1, 2026–2027: Monday 31 August through Friday 23 October.
const START = '2026-08-31'
const END = '2026-10-23'

test('the first day of a period is week 1', () => {
  assert.deepEqual(periodWeek(START, END, START), { week: 1, weeks: 8 })
})

test('the rest of the opening week is still week 1', () => {
  for (const day of ['2026-09-01', '2026-09-02', '2026-09-06']) {
    assert.equal(periodWeek(START, END, day).week, 1, `${day} is week 1`)
  }
})

test('the following Monday is week 2', () => {
  assert.equal(periodWeek(START, END, '2026-09-07').week, 2)
})

test('the period counts eight weeks, inclusive of its last day', () => {
  assert.equal(periodWeek(START, END, START).weeks, 8)
  assert.equal(periodWeek(START, END, END).week, 8)
})

test('a day past the end never exceeds the period length', () => {
  assert.equal(periodWeek(START, END, '2026-11-30').week, 8)
})

test('a day before the period starts reads as week 1 rather than zero or negative', () => {
  assert.equal(periodWeek(START, END, '2026-08-24').week, 1)
})

test('missing dates produce no claim at all', () => {
  assert.deepEqual(periodWeek(null, END, START), { week: null, weeks: null })
  assert.deepEqual(periodWeek(START, null, START), { week: null, weeks: null })
  assert.deepEqual(periodWeek(START, END, null), { week: null, weeks: null })
})

test('a full timestamp is accepted, not just a date', () => {
  assert.equal(periodWeek(`${START}T00:00:00.000Z`, `${END}T23:59:00.000Z`, '2026-09-02T01:35:00.000Z').week, 1)
})
