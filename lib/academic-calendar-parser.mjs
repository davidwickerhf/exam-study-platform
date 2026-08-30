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

function classify(label) {
  const lower = label.toLowerCase()
  if (/exam|resit|test/.test(lower)) return 'deadline'
  if (/registration|enrol|deadline/.test(lower)) return 'registration'
  if (/graduation|ceremony|conference|presentation/.test(lower)) return 'ceremony'
  return 'other'
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/^[\s:\-–—]+|[\s:\-–—]+$/g, '').trim()
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
  const push = (label, phrase) => {
    const title = clean(label)
    if (!title || title.length > 160 || /^\d+$/.test(title)) return
    const parsed = parseDatePhrase(phrase, years)
    if (!parsed?.date) return
    const key = `${title.toLowerCase()}|${parsed.date}`
    if (seen.has(key)) return
    seen.add(key)
    events.push({ id: `cal-${events.length + 1}`, title, date: parsed.date, endDate: parsed.endDate && parsed.endDate !== parsed.date ? parsed.endDate : null, type: classify(title), notes: parsed.approximate ? 'Month only — exact date not given' : '', academicYear: years.label || '' })
  }
  // Two-column PDFs interleave sections; track a heading and a pending label
  // per column so "Study weeks / Period 1: …" and "Inkom / 17 - 20 August"
  // resolve correctly.
  const columns = [{ heading: '', pending: '' }, { heading: '', pending: '' }, { heading: '', pending: '' }]
  const isHeading = (segment) => !/\d/.test(segment) && !segment.includes(':') && clean(segment).length > 2 && clean(segment).length < 48
  const titled = (column, label) => {
    const heading = column.heading
    if (!heading) return label
    const generic = /^(period|semester|p\d|s\d|year|week)\b/i.test(label) || label.length < 10
    return generic && !label.toLowerCase().includes(heading.toLowerCase()) ? `${heading} — ${label}` : label
  }
  for (const rawLine of String(text || '').replace(/\r/g, '').split('\n')) {
    const segments = splitColumns(rawLine)
    if (!segments.length) { for (const column of columns) column.pending = ''; continue }
    for (const { text: segment, column: columnIndex } of segments) {
      const column = columns[columnIndex]
      if (parseDatePhrase(segment, years)) { if (column.pending) push(column.pending, segment); column.pending = ''; continue }
      const colon = segment.indexOf(':')
      if (colon > 0) {
        const left = segment.slice(0, colon), right = segment.slice(colon + 1)
        if (parseDatePhrase(right, years)) { push(titled(column, clean(left)), right); column.pending = ''; continue }
        if (parseDatePhrase(left, years)) { push(clean(right), left); column.pending = ''; continue }
        if (!clean(right)) { column.heading = clean(left); column.pending = clean(left); continue }
      }
      const tail = segment.match(new RegExp(`^(.*?)[\\s:]+((?:\\d{1,2}\\s*[-–&]\\s*)?\\d{1,2}\\s+${MONTH_RE}(?:\\s+20\\d{2})?(?:\\s*[-–]\\s*\\d{1,2}\\s+${MONTH_RE}(?:\\s+20\\d{2})?)?)$`, 'i'))
      if (tail && clean(tail[1])) { push(titled(column, clean(tail[1])), tail[2]); column.pending = ''; continue }
      if (isHeading(segment)) { column.heading = clean(segment); column.pending = clean(segment); continue }
      column.pending = ''
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date))
  return { events, academicYear: years.label || null }
}
