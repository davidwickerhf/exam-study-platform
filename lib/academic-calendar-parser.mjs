// Deterministic reader for institutional academic calendars. University
// calendars almost always carry a legend such as
//   Period 1: 31 August - 9 October
//   Christmas Holiday: 14 December - 1 January 2027
//   26 August: Bachelor CS
//   Period 1 - Exams all: 12 - 16 October
// This turns those lines into dated events without any AI, and is the fallback
// (or complement) for the AI reader.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTH_ALIASES = { januari: 0, februari: 1, maart: 2, mei: 4, juni: 5, juli: 6, augustus: 7, oktober: 9, sept: 8, sep: 8, oct: 9, nov: 10, dec: 11, jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7 }
const MONTH_RE = '(january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|maart|mei|juni|juli|augustus|oktober|sept|sep|oct|nov|dec|jan|feb|mar|apr|jun|jul|aug)'

function monthIndex(name) {
  const lower = String(name).toLowerCase()
  const full = MONTHS.indexOf(lower)
  return full >= 0 ? full : MONTH_ALIASES[lower] ?? null
}

function iso(year, month, day) {
  const date = new Date(Date.UTC(year, month, day))
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

// Academic years run August→July; a month without an explicit year belongs to
// the first calendar year when it is August or later, otherwise the second.
function yearFor(month, explicit, { startYear, endYear }) {
  if (explicit) return Number(explicit)
  if (startYear == null) return new Date().getUTCFullYear()
  return month >= 7 ? startYear : (endYear ?? startYear + 1)
}

// Structured classification: what kind of academic date this is, which period
// or semester it belongs to, whether it is a resit, and which cohorts it names.
export const CALENDAR_KINDS = Object.freeze({
  period: 'Education period',
  'exam-week': 'Exam week',
  'resit-week': 'Resit week',
  'study-week': 'Study week',
  'project-week': 'Project period',
  holiday: 'Holiday',
  intro: 'Introduction',
  deadline: 'Deadline',
  ceremony: 'Ceremony',
  other: 'Other'
})

export function classifyCalendarEvent(label, heading = '') {
  const text = `${heading} ${label}`.toLowerCase()
  const own = label.toLowerCase()
  const semester = own.match(/\bsemester\s*(\d)\b/)?.[1] ?? null
  const period = semester ? null : (own.match(/\bperiod\s*(\d)\b/)?.[1] ?? own.match(/^p(\d)\b/)?.[1] ?? heading.toLowerCase().match(/\bperiod\s*(\d)\b/)?.[1] ?? null)
  const cohorts = [...new Set((label.match(/\b(?:BA?Y\s?\d(?:\/\d)?|MA?Y\s?\d(?:\/\d)?|BY\s?\d(?:\/\d)?|MA\s?P\d|BA\s?P\d(?:&\d)?|BSc|MSc|Bachelor[s]?|Master[s]?)\b/gi) || []).map((item) => item.replace(/\s+/g, '')))]
  let kind = 'other'
  if (/graduation|ceremony|conference|presentation|seminar/.test(own)) kind = 'ceremony'
  else if (/registration|enrol|deadline|intake/.test(own)) kind = 'deadline'
  else if (/holiday|break|no education|king's day|liberation|ascension|whit|easter|good friday|christmas|carnival/.test(text) && !/exam|resit/.test(own)) kind = 'holiday'
  else if (/resit/.test(own) && !/exam/.test(own)) kind = 'resit-week'
  else if (/exam|resit|test/.test(own)) kind = 'exam-week'
  else if (/study week/.test(text)) kind = 'study-week'
  else if (/project/.test(text)) kind = 'project-week'
  else if (/inkom|introduction|intro day|mentor event|welcome/.test(text)) kind = 'intro'
  else if (/^period\s*\d/i.test(label) || /education period/.test(heading.toLowerCase())) kind = 'period'
  const type = kind === 'exam-week' || kind === 'resit-week' || kind === 'deadline' ? (kind === 'deadline' ? 'registration' : 'deadline') : kind === 'ceremony' ? 'ceremony' : 'other'
  return { kind, type, period: period ? Number(period) : null, semester: semester ? Number(semester) : null, resit: /resit/.test(own), cohorts }
}

function displayTitle(label, heading, info) {
  const base = clean(label)
  const ref = info.period ? `Period ${info.period}` : info.semester ? `Semester ${info.semester}` : ''
  const cohort = info.cohorts.length ? ` (${info.cohorts.join(', ')})` : ''
  if (info.kind === 'period' && ref) return ref
  if (info.kind === 'study-week' && ref) return `Study week · ${ref}`
  if (info.kind === 'project-week' && ref) return `Project period · ${ref}${cohort}`
  if (info.kind === 'exam-week' && ref) return `${info.resit ? 'Exams and resits' : 'Exam week'} · ${ref}${cohort}`
  if (info.kind === 'resit-week' && ref) return `Resits · ${ref}${cohort}`
  return base
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/^[\s:\-–—]+|[\s:\-–—]+$/g, '').trim()
}

// A single printed calendar band can serve several academic purposes, for
// example "Period 2 exams and Period 1 resits". Preserve those as parallel
// facts with identical dates so the planner can recombine them into one
// truthful examination window while still enforcing course-specific routes.
function examPurposeLabels(label) {
  const purposes = new Map()
  const add = (scope, number, sitting) => {
    const normalized = /^(resit|retake)/i.test(sitting) ? 'resits' : 'exams'
    purposes.set(`${scope.toLowerCase()}:${number}:${normalized}`, `${scope[0].toUpperCase()}${scope.slice(1).toLowerCase()} ${number} ${normalized}`)
  }
  for (const match of label.matchAll(/\b(period|semester)\s*(\d+)\s*(?:[-–:]\s*)?(exams?|tests?|resits?|retakes?)\b/gi)) add(match[1], match[2], match[3])
  for (const match of label.matchAll(/\b(exams?|tests?|resits?|retakes?)\s*(?:of|for)?\s*(period|semester)\s*(\d+)\b/gi)) add(match[2], match[3], match[1])
  for (const match of label.matchAll(/\b(period|semester)s?\s*(\d+)\s*(?:and|&|\/|\+|,)\s*(?:(?:period|semester)\s*)?(\d+)\s*(exams?|tests?|resits?|retakes?)\b/gi)) {
    add(match[1], match[2], match[4]); add(match[1], match[3], match[4])
  }
  for (const match of label.matchAll(/\b(exams?|tests?|resits?|retakes?)\s*(?:of|for)?\s*(period|semester)s?\s*(\d+)\s*(?:and|&|\/|\+|,)\s*(?:(?:period|semester)\s*)?(\d+)\b/gi)) {
    add(match[2], match[3], match[1]); add(match[2], match[4], match[1])
  }
  return purposes.size > 1 ? [...purposes.values()] : []
}

export function detectAcademicYear(text) {
  const match = String(text || '').match(/\b(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b/)
  if (!match) return { startYear: null, endYear: null }
  const startYear = Number(match[1])
  const endYear = match[2].length === 2 ? Number(match[1].slice(0, 2) + match[2]) : Number(match[2])
  return endYear === startYear + 1 ? { startYear, endYear, label: `${startYear}-${endYear}` } : { startYear: null, endYear: null }
}

// Splits the two-column layouts pdftotext produces ("left text        right text")
// into separate lines so each side is parsed on its own.
function splitColumns(line) {
  const parts = []
  for (const match of line.matchAll(/\S(?:.*?\S)?(?=\s{4,}|\s*$)/g)) {
    if (match[0].trim()) parts.push({ text: match[0].trim(), column: match.index >= 30 ? 1 : 0 })
  }
  return parts
}

const RANGE_SAME_MONTH = new RegExp(`^(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+${MONTH_RE}(?:\\s+(20\\d{2}))?$`, 'i')
const RANGE_TWO_MONTHS = new RegExp(`^(\\d{1,2})\\s+${MONTH_RE}(?:\\s+(20\\d{2}))?\\s*[-–]\\s*(\\d{1,2})\\s+${MONTH_RE}(?:\\s+(20\\d{2}))?$`, 'i')
const SINGLE = new RegExp(`^(\\d{1,2})\\s+${MONTH_RE}(?:\\s+(20\\d{2}))?$`, 'i')
const DAY_PAIR = new RegExp(`^(\\d{1,2})\\s*&\\s*(\\d{1,2})\\s+${MONTH_RE}(?:\\s+(20\\d{2}))?$`, 'i')
const MONTH_ONLY = new RegExp(`^${MONTH_RE}(?:\\s+(20\\d{2}))?$`, 'i')

function parseDatePhrase(phrase, years) {
  const value = clean(phrase)
  let match
  if ((match = value.match(RANGE_SAME_MONTH))) {
    const month = monthIndex(match[3]); if (month == null) return null
    const year = yearFor(month, match[4], years)
    return { date: iso(year, month, Number(match[1])), endDate: iso(year, month, Number(match[2])) }
  }
  if ((match = value.match(RANGE_TWO_MONTHS))) {
    const m1 = monthIndex(match[2]), m2 = monthIndex(match[5]); if (m1 == null || m2 == null) return null
    const y1 = yearFor(m1, match[3], years)
    const y2 = match[6] ? Number(match[6]) : (m2 < m1 ? y1 + 1 : yearFor(m2, null, { ...years, startYear: years.startYear ?? y1 }))
    return { date: iso(y1, m1, Number(match[1])), endDate: iso(y2, m2, Number(match[4])) }
  }
  if ((match = value.match(DAY_PAIR))) {
    const month = monthIndex(match[3]); if (month == null) return null
    const year = yearFor(month, match[4], years)
    return { date: iso(year, month, Number(match[1])), endDate: iso(year, month, Number(match[2])) }
  }
  if ((match = value.match(SINGLE))) {
    const month = monthIndex(match[2]); if (month == null) return null
    return { date: iso(yearFor(month, match[3], years), month, Number(match[1])), endDate: null }
  }
  if ((match = value.match(MONTH_ONLY))) {
    const month = monthIndex(match[1]); if (month == null) return null
    const year = yearFor(month, match[2], years)
    return { date: iso(year, month, 1), endDate: null, approximate: true }
  }
  return null
}

export function parseAcademicCalendarText(text, { academicYear } = {}) {
  const years = academicYear ? detectAcademicYear(academicYear) : detectAcademicYear(text)
  const events = []
  const seen = new Set()
  const pushOne = (label, phrase, heading = '', originalLabel = label) => {
    const raw = clean(label)
    if (!raw || raw.length > 160 || /^\d+$/.test(raw)) return
    const parsed = parseDatePhrase(phrase, years)
    if (!parsed?.date) return
    const info = classifyCalendarEvent(raw, heading)
    const title = displayTitle(raw, heading, info)
    const key = `${title.toLowerCase()}|${parsed.date}`
    if (seen.has(key)) return
    seen.add(key)
    events.push({ id: `cal-${events.length + 1}`, title, date: parsed.date, endDate: parsed.endDate && parsed.endDate !== parsed.date ? parsed.endDate : null, type: info.type, kind: info.kind, period: info.period, semester: info.semester, resit: info.resit, cohorts: info.cohorts, notes: [parsed.approximate ? 'Month only — exact date not given' : '', clean(originalLabel) !== title ? clean(originalLabel) : ''].filter(Boolean).join(' · '), academicYear: years.label || '' })
  }
  const push = (label, phrase, heading = '') => {
    const purposes = examPurposeLabels(clean(label))
    if (purposes.length) { for (const purpose of purposes) pushOne(purpose, phrase, heading, label); return }
    pushOne(label, phrase, heading)
  }
  // Two-column PDFs interleave sections; track a heading and a pending label
  // per column so "Study weeks / Period 1: …" and "Inkom / 17 - 20 August"
  // resolve correctly.
  const columns = [{ heading: '', pending: '' }, { heading: '', pending: '' }, { heading: '', pending: '' }]
  const isHeading = (segment) => !/\d/.test(segment) && !segment.includes(':') && clean(segment).length > 2 && clean(segment).length < 48
  const titled = (column, label) => label
  for (const rawLine of String(text || '').replace(/\r/g, '').split('\n')) {
    const segments = splitColumns(rawLine)
    if (!segments.length) { for (const column of columns) column.pending = ''; continue }
    for (const { text: segment, column: columnIndex } of segments) {
      const column = columns[columnIndex]
      if (parseDatePhrase(segment, years)) { if (column.pending) push(column.pending, segment, column.heading === column.pending ? '' : column.heading); column.pending = ''; continue }
      const colon = segment.indexOf(':')
      if (colon > 0) {
        const left = segment.slice(0, colon), right = segment.slice(colon + 1)
        if (parseDatePhrase(right, years)) { push(clean(left), right, column.heading); column.pending = ''; continue }
        if (parseDatePhrase(left, years)) { push(clean(right), left, column.heading); column.pending = ''; continue }
        if (!clean(right)) { column.heading = clean(left); column.pending = clean(left); continue }
      }
      const tail = segment.match(new RegExp(`^(.*?)[\\s:]+((?:\\d{1,2}\\s*[-–&]\\s*)?\\d{1,2}\\s+${MONTH_RE}(?:\\s+20\\d{2})?(?:\\s*[-–]\\s*\\d{1,2}\\s+${MONTH_RE}(?:\\s+20\\d{2})?)?)$`, 'i'))
      if (tail && clean(tail[1])) { push(clean(tail[1]), tail[2], column.heading); column.pending = ''; continue }
      if (isHeading(segment)) { column.heading = clean(segment); column.pending = clean(segment); continue }
      column.pending = ''
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date))
  return { events, academicYear: years.label || null }
}
