import { listCanvasConnections, canvasAccessToken } from './canvas-connections.mjs'
import { fetchCanvasHub, canvasAnnouncementText } from './canvas-hub.mjs'

const QUERY_STOP = new Set('the a an is are do does have actual access to of on in for my me it can you what which course canvas please'.split(' '))
export function selectCourseAnnouncements(items, { courseCode = '', query = '', rulesOnly = false, limit = 8 } = {}) {
  const terms = [...new Set(String(query).toLowerCase().match(/[a-z0-9]+/g) || [])].filter(term => !QUERY_STOP.has(term))
  const code = String(courseCode).trim().toUpperCase()
  return items.filter(item => (!code || item.course === code) && (!rulesOnly || item.mayAmendRules))
    .map(item => {
      const content = `${item.title}\n${item.text}`.toLowerCase()
      const score = terms.reduce((sum, term) => sum + (content.includes(term) ? 1 : 0) + (item.title.toLowerCase().includes(term) ? 2 : 0), 0)
      const start = terms.length ? Math.max(0, content.indexOf(terms.find(term => content.includes(term)) || '') - 200) : 0
      return { ...item, ...(terms.length ? { excerpt: `${item.title}\n${item.text}`.slice(start, start + 1400) } : {}), score }
    }).filter(item => !terms.length || item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.postedAt || '').localeCompare(String(a.postedAt || '')))
    .slice(0, limit)
}

const RULE_UPDATE = /attendance|course\s*book|syllabus|mandatory|compulsory|assessment|pass\s+rule|requirement|deadline|updated?\s+(?:rule|policy)/i
export function courseAnnouncementContext(item) {
  const text = canvasAnnouncementText(item)
  const relevant = text.split(/(?<=[.!?])\s+|\n+/).filter(sentence => RULE_UPDATE.test(sentence)).join(' ')
  return { id: `announcement:${item.url || item.id}`, course: String(item.courseCode || '').match(/\b[A-Z]{2,5}\d{3,5}\b/i)?.[0]?.toUpperCase() || item.courseCode, title: item.title, postedAt: item.postedAt, author: item.author,
    text: text.slice(0, 12000), truncated: text.length > 12000, excerpt: (relevant || text).slice(0, 1400), url: item.url,
    mayAmendRules: RULE_UPDATE.test(`${item.title} ${text}`), attachments: item.attachments || [] }
}

export async function readCourseAnnouncements({ courseCode = '', query = '', days = 120, limit = 8, rulesOnly = false } = {}) {
  const connections = await listCanvasConnections()
  const results = await Promise.all(connections.map(async connection => {
    try {
      const { token } = await canvasAccessToken({ canvasUrl: connection.origin })
      // A catalogue-only cached request avoids fetching every course's announcements.
      const base = { origin: connection.origin, token, scope: 'current', days }
      const catalogue = courseCode ? await fetchCanvasHub({ ...base, parts: [] }) : null
      const code = String(courseCode).trim().toUpperCase()
      const ids = catalogue?.courses.filter(course => new RegExp(`(?:^|[^A-Z0-9])${code.replace(/[^A-Z0-9]/g, '')}(?:$|[^A-Z0-9])`, 'i').test(`${course.courseCode} ${course.name}`)).map(course => course.id)
      if (ids && !ids.length) return { announcements: [], problems: [] }
      const hub = await fetchCanvasHub({ ...base, ...(ids ? { courseIds: ids } : {}), parts: ['announcements'] })
      return { announcements: hub.announcements.map(courseAnnouncementContext), problems: hub.problems || [] }
    } catch (error) { return { announcements: [], problems: [{ error: error.message }] } }
  }))
  const matching = selectCourseAnnouncements(results.flatMap(result => result.announcements), { courseCode, query, rulesOnly, limit: Infinity })
  const selected = matching.slice(0, limit)
  return { announcements: selected, omitted: Math.max(0, matching.length - selected.length),
    note: !connections.length ? 'Canvas is not connected.' : results.some(result => result.problems.length) ? 'Some announcements could not be read. Current course-rule coverage is incomplete.' : 'Recent course announcements are amendments only when their wording, course edition and effective date support that interpretation.',
    evidence: selected.map(item => ({ id: item.id, sourceType: 'Canvas announcement', title: item.title, course: item.course, location: `${item.postedAt || 'Date unknown'} · ${item.author || 'Author not listed'}`, excerpt: item.excerpt, url: item.url, status: 'current-announcement' })) }
}
