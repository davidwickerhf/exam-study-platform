import { resolveAcademicTimeContext } from './calendar-feed.mjs'

export const CANVAS_REFRESH_DEFAULTS = Object.freeze({ enabled: true, updatesMinutes: 30, materialsMinutes: 360, studyStatus: 'studying' })
export function validateCanvasRefreshSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose automatic refresh settings.')
  const { enabled, updatesMinutes, materialsMinutes, studyStatus } = value
  if (typeof enabled !== 'boolean' || ![15,30,60,180,360,1440].includes(updatesMinutes) || ![60,360,720,1440,10080].includes(materialsMinutes) || !['studying','completed'].includes(studyStatus)) throw new Error('Choose a supported refresh frequency and study status.')
  return { enabled, updatesMinutes, materialsMinutes, studyStatus }
}

// Calendar dates, rather than month names, distinguish a teaching period from
// a break. During a break we retain the ending year AND discover the next year.
// No academic record total, elapsed degree duration or failed attempt implies graduation.
export function canvasRefreshWindow(calendar = [], { date = new Date(), hasProgramme = true, studyStatus = 'studying' } = {}) {
  const today = date.toISOString().slice(0,10)
  if (!hasProgramme || studyStatus === 'completed') return { mode: 'paused', reason: hasProgramme ? 'Programme marked completed' : 'No active programme', years: [], periodNumber: null }
  const periods = calendar.filter(e => e.kind === 'period' && e.date && e.endDate && e.academicYear)
    .sort((a,b) => a.date.localeCompare(b.date))
  const context = resolveAcademicTimeContext(calendar, { date })
  const active = context && context.activeStart <= today && context.activeEnd >= today
  if (active) return { mode: 'period', reason: context.label, years: [context.academicYear], periodNumber: context.periodNumber }
  const previous = periods.filter(e => e.endDate < today).at(-1)
  const next = periods.find(e => e.date > today)
  const recent = previous && (date - new Date(previous.endDate)) / 86400000 <= 120
  const soon = next && (new Date(next.date) - date) / 86400000 <= 60
  const startYear = date.getUTCMonth() >= 7 ? date.getUTCFullYear() : date.getUTCFullYear()-1
  const years = [...new Set([recent && previous.academicYear, soon && next.academicYear].filter(Boolean))]
  if (!years.length) years.push(`${startYear}-${startYear+1}`)
  // August can precede a new calendar's publication: keep the ending year too.
  if (date.getUTCMonth() === 7 && !years.includes(`${startYear-1}-${startYear}`)) years.push(`${startYear-1}-${startYear}`)
  return { mode: years.length && (recent || soon) ? 'break' : 'calendar-unavailable', reason: recent || soon ? 'Between teaching periods: watching summer and next-period updates' : 'Calendar unavailable: using Canvas enrolment dates', years, periodNumber: null }
}
