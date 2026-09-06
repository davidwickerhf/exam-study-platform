import { listCanvasConnections, canvasAccessToken } from './canvas-connections.mjs'
import { fetchCanvasHub, canvasAnnouncementText } from './canvas-hub.mjs'

const RULE_UPDATE = /attendance|course\s*book|syllabus|mandatory|compulsory|assessment|pass\s+rule|requirement|deadline|updated?\s+(?:rule|policy)/i
export function courseAnnouncementContext(item) {
  const text = canvasAnnouncementText(item)
  const relevant = text.split(/(?<=[.!?])\s+|\n+/).filter(sentence => RULE_UPDATE.test(sentence)).join(' ')
  return { id: `announcement:${item.url || item.id}`, course: item.courseCode, title: item.title, postedAt: item.postedAt, author: item.author,
    text: text.slice(0, 12000), truncated: text.length > 12000, excerpt: (relevant || text).slice(0, 1400), url: item.url,
    mayAmendRules: RULE_UPDATE.test(`${item.title} ${text}`), attachments: item.attachments || [] }
}

export async function readCourseAnnouncements({ courseCode = '', days = 120, limit = 8, rulesOnly = false } = {}) {
  const connections = await listCanvasConnections()
  const results = await Promise.all(connections.map(async connection => {
    try {
      const { token } = await canvasAccessToken({ canvasUrl: connection.origin })
      const hub = await fetchCanvasHub({ origin: connection.origin, token, scope: 'current', parts: ['announcements'], days })
      return { announcements: hub.announcements.map(courseAnnouncementContext), problems: hub.problems || [] }
    } catch (error) { return { announcements: [], problems: [{ error: error.message }] } }
  }))
  const code = String(courseCode).trim().toUpperCase()
  const matching = results.flatMap(result => result.announcements).filter(item => (!code || item.course === code) && (!rulesOnly || item.mayAmendRules)).sort((a, b) => String(b.postedAt || '').localeCompare(String(a.postedAt || '')))
  const selected = matching.slice(0, limit)
  return { announcements: selected, omitted: Math.max(0, matching.length - selected.length),
    note: !connections.length ? 'Canvas is not connected.' : results.some(result => result.problems.length) ? 'Some announcements could not be read. Current course-rule coverage is incomplete.' : 'Recent course announcements are amendments only when their wording, course edition and effective date support that interpretation.',
    evidence: selected.map(item => ({ id: item.id, sourceType: 'Canvas announcement', title: item.title, course: item.course, location: `${item.postedAt || 'Date unknown'} · ${item.author || 'Author not listed'}`, excerpt: item.excerpt, url: item.url, status: 'current-announcement' })) }
}
