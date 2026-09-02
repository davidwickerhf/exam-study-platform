/** The Canvas hub payload, as the existing API already returns it. */
export type Assignment = {
  id: string
  courseId: string
  courseCode: string | null
  courseName: string | null
  courseCurrent: boolean
  title: string
  dueAt: string | null
  pointsPossible: number | null
  status: keyof typeof STATUS_LABEL | string
  score: number | null
  late: boolean
  url: string | null
}

export type Course = { id: string; displayName: string; courseCode: string | null; current: boolean }

export type Hub = {
  connected: boolean
  assignments: Assignment[]
  courses: Course[]
  statuses: Record<string, string>
}

export const STATUS_LABEL = {
  graded: 'Graded',
  submitted: 'Submitted',
  missing: 'Missing',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  undated: 'No due date',
  offline: 'No Canvas hand-in',
  excused: 'Excused'
} as const

/**
 * Canvas marks coursework with no online submission as `offline`. It is not
 * done — it is handed in or sat in the room — so it is its own state rather
 * than being folded in with submitted and graded.
 */
export const STATES = [
  { id: 'todo', label: 'To do', statuses: ['missing', 'overdue', 'upcoming', 'undated'] },
  { id: 'offline', label: 'No hand-in', statuses: ['offline'] },
  { id: 'done', label: 'Done', statuses: ['submitted', 'graded', 'excused'] },
  { id: 'all', label: 'All', statuses: null }
] as const

export type StateId = (typeof STATES)[number]['id']

export function stateOf(status: string): StateId {
  return (STATES.find((state) => state.statuses?.includes(status as never))?.id ?? 'todo') as StateId
}

const DAY = 86_400_000

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const day = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime()
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((day - today) / DAY)
}

/** Forty-eight rows flat is a wall; grouped by how soon they are due it reads. */
export const BUCKETS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'week', label: 'Next seven days' },
  { id: 'later', label: 'Later' },
  { id: 'undated', label: 'No due date' },
  { id: 'done', label: 'Done' }
] as const

export function bucketOf(item: Assignment): (typeof BUCKETS)[number]['id'] {
  if (['submitted', 'graded', 'excused'].includes(item.status)) return 'done'
  if (item.status === 'missing' || item.status === 'overdue') return 'overdue'
  if (!item.dueAt) return 'undated'
  return (daysUntil(item.dueAt) ?? 99) <= 7 ? 'week' : 'later'
}

/** Canvas titles a deadline "BCS3120 · Quiz 1"; the row already has a course. */
export function assignmentTitle(item: Assignment): string {
  if (!item.courseCode) return item.title
  const escaped = item.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return item.title.replace(new RegExp(`^\\s*${escaped}\\s*[·:\\-–]\\s*`, 'i'), '') || item.title
}
