export const UPDATE_TABS = ['announcements', 'assignments', 'materials', 'courses']
export const UPDATE_WINDOWS = [['14', 'Last 14 days'], ['30', 'Last 30 days'], ['90', 'Last 3 months'], ['180', 'Last 6 months'], ['365', 'Last year']]
export const ANNOUNCEMENT_SORTS = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['course', 'By course'], ['title', 'By title']]
export const ASSIGNMENT_SORTS = [['due', 'Due soonest'], ['due-desc', 'Due latest'], ['course', 'By course'], ['points', 'Most points'], ['status', 'By status']]
export const DEFAULT_PREFERENCES = Object.freeze({ scope: 'current', days: '30', announcementSort: 'newest', assignmentSort: 'due', assignmentState: 'todo' })

const allowed = (pairs, value, fallback) => pairs.some(([id]) => id === value) ? value : fallback
export function normalisePreferences(value = {}) {
  return {
    scope: value.scope === 'all' ? 'all' : 'current',
    days: allowed(UPDATE_WINDOWS, String(value.days || ''), DEFAULT_PREFERENCES.days),
    announcementSort: allowed(ANNOUNCEMENT_SORTS, value.announcementSort, DEFAULT_PREFERENCES.announcementSort),
    assignmentSort: allowed(ASSIGNMENT_SORTS, value.assignmentSort, DEFAULT_PREFERENCES.assignmentSort),
    assignmentState: ['todo', 'offline', 'done', 'all'].includes(value.assignmentState) ? value.assignmentState : DEFAULT_PREFERENCES.assignmentState
  }
}

export function parsePreferences(serialized) {
  try { return normalisePreferences(JSON.parse(String(serialized || '{}'))) }
  catch { return normalisePreferences() }
}

export function isNewAnnouncement(item, since = '') {
  if (item?.read === false) return true
  return item?.read == null && Boolean(since) && String(item?.postedAt || '') > since
}

const label = (item) => item?.courseCode || item?.courseName || 'Canvas'
export function filterAnnouncements(items = [], { courseId = 'all', query = '', unreadOnly = false, since = '', sort = 'newest' } = {}) {
  const needle = query.trim().toLowerCase()
  return items.filter((item) => courseId === 'all' || String(item.courseId) === String(courseId))
    .filter((item) => !unreadOnly || isNewAnnouncement(item, since))
    .filter((item) => !needle || [item.title, item.excerpt, item.author, label(item)].filter(Boolean).join(' ').toLowerCase().includes(needle))
    .sort((a, b) => sort === 'oldest' ? String(a.postedAt || '').localeCompare(String(b.postedAt || ''))
      : sort === 'title' ? a.title.localeCompare(b.title)
        : sort === 'course' ? label(a).localeCompare(label(b)) || String(b.postedAt || '').localeCompare(String(a.postedAt || ''))
          : String(b.postedAt || '').localeCompare(String(a.postedAt || '')))
}

const DONE = new Set(['submitted', 'graded', 'excused'])
export function assignmentState(status) {
  if (status === 'offline') return 'offline'
  return DONE.has(status) ? 'done' : 'todo'
}

export function filterAssignments(items = [], { courseId = 'all', query = '', state = 'todo', sort = 'due' } = {}) {
  const needle = query.trim().toLowerCase()
  const due = (a, b, direction = 1) => Boolean(a.dueAt) !== Boolean(b.dueAt) ? (a.dueAt ? -1 : 1) : direction * String(a.dueAt || '').localeCompare(String(b.dueAt || ''))
  const order = ['missing', 'overdue', 'upcoming', 'undated', 'submitted', 'graded', 'excused', 'offline']
  return items.filter((item) => courseId === 'all' || String(item.courseId) === String(courseId))
    .filter((item) => state === 'all' || assignmentState(item.status) === state)
    .filter((item) => !needle || [item.title, item.description, label(item)].filter(Boolean).join(' ').toLowerCase().includes(needle))
    .sort((a, b) => sort === 'due-desc' ? due(a, b, -1)
      : sort === 'course' ? label(a).localeCompare(label(b)) || due(a, b)
        : sort === 'points' ? (b.pointsPossible ?? -1) - (a.pointsPossible ?? -1) || due(a, b)
          : sort === 'status' ? order.indexOf(a.status) - order.indexOf(b.status) || due(a, b) : due(a, b))
}

export function courseRows(hub, scope = 'current') {
  const selected = new Set(hub?.selectedCourseIds || [])
  const announcements = new Map(), open = new Map(), grades = new Map((hub?.grades || []).map((item) => [String(item.courseId), item]))
  for (const item of hub?.announcements || []) announcements.set(String(item.courseId), (announcements.get(String(item.courseId)) || 0) + 1)
  for (const item of hub?.assignments || []) if (!DONE.has(item.status) && item.status !== 'offline') open.set(String(item.courseId), (open.get(String(item.courseId)) || 0) + 1)
  return (hub?.courses || []).filter((course) => scope === 'all' || course.current || course.upcoming || selected.has(String(course.id))).map((course) => ({ ...course, announcementCount: announcements.get(String(course.id)) || 0, openCount: open.get(String(course.id)) || 0, grade: grades.get(String(course.id)) || null }))
}

export function connectionOrigin(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' ? url.origin : null
  } catch { return null }
}
