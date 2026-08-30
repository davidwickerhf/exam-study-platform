import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAcademicCalendarText, detectAcademicYear } from '../lib/academic-calendar-parser.mjs'

const LEGEND = `Academisch Calendar 2026-2027                                                               version 29-6-2026

Inkom Maastricht University                              Introduction Days
17 - 20 August 2026                                      26 August: Bachelor CS

Education periods                                        Exam and Resit periods
Period 1: 31 August - 9 October                          Period 1 - Exams all: 12 - 16 October
period 4: 25 Januari - 12 March 2027                     Semester 1 - Resits BY1: 18 - 22 January 2027

Study weeks                                              (Public) Holidays - no education
Period 1: 19 - 23 October                                Christmas Holiday: 14 December - 1 January 2027
                                                         King's Day & Bridging Day: 26 & 27 April
                                                         Graduation
                                                         November 2027`

test('academic year is detected from the header', () => {
  assert.deepEqual(detectAcademicYear(LEGEND).label, '2026-2027')
})

test('legend lines become dated events with headings, ranges, and year roll-over', () => {
  const { events } = parseAcademicCalendarText(LEGEND)
  const byTitle = Object.fromEntries(events.map((event) => [event.title, event]))
  assert.equal(byTitle['Inkom Maastricht University'].date, '2026-08-17')
  assert.equal(byTitle['Inkom Maastricht University'].endDate, '2026-08-20')
  assert.equal(byTitle['Bachelor CS'].date, '2026-08-26')
  assert.equal(byTitle['Period 1'].endDate, '2026-10-09')
  assert.equal(byTitle['Period 1'].kind, 'period')
  assert.equal(byTitle['Period 1'].period, 1)
  assert.equal(byTitle['Study week · Period 1'].date, '2026-10-19')
  assert.equal(byTitle['Study week · Period 1'].kind, 'study-week')
  assert.equal(byTitle['Exam week · Period 1'].type, 'deadline')
  assert.equal(byTitle['Exam week · Period 1'].kind, 'exam-week')
  assert.equal(byTitle['Resits · Semester 1 (BY1)'].kind, 'resit-week')
  assert.deepEqual(byTitle['Resits · Semester 1 (BY1)'].cohorts, ['BY1'])
  assert.equal(byTitle['Resits · Semester 1 (BY1)'].semester, 1)
  assert.equal(byTitle['Period 4'].date, '2027-01-25', 'Dutch month names and second-year roll-over')
  assert.equal(byTitle['Christmas Holiday'].endDate, '2027-01-01')
  assert.equal(byTitle['Christmas Holiday'].kind, 'holiday')
  assert.equal(byTitle['Inkom Maastricht University'].kind, 'intro')
  assert.equal(byTitle["King's Day & Bridging Day"].endDate, '2027-04-27')
  assert.equal(byTitle.Graduation.date, '2027-11-01')
  assert.equal(byTitle.Graduation.type, 'ceremony')
  assert.match(byTitle.Graduation.notes, /Month only/)
})
