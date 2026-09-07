import { createCanvasApi } from './canvas-course-import.mjs'
import { cachedCanvasResponse } from './canvas-shared-cache.mjs'
import { canvasEditionYear } from './workspace/course-editions.mjs'

const text = (value, limit = 300) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
const numericId = value => /^\d{1,20}$/.test(String(value ?? '')) ? String(value) : null

export function canvasGroupRecord(row, { origin, courses = [], courseId = null } = {}) {
  const id = numericId(row.id)
  if (!id || row.non_collaborative === true) return null
  const parentId = numericId(row.course_id) || numericId(courseId)
  const course = courses.find(item => String(item.id) === parentId)
  return {
    id, origin, name: text(row.name) || 'Unnamed group', scope: parentId ? 'course' : 'global',
    courseId: parentId, courseCode: String(course?.courseCode || '').toUpperCase().match(/\b[A-Z]{2,4}[\s-]*\d{3,5}[A-Z]?\b/)?.[0]?.replace(/[\s-]/g, '') || text(course?.courseCode, 40) || null,
    courseName: course?.displayName || course?.name || (parentId ? text(row.context_name) || null : null),
    academicYear: course ? canvasEditionYear(course) || null : null,
    contextName: text(row.context_name) || null, categoryId: numericId(row.group_category_id),
    memberCount: Number.isSafeInteger(row.members_count) && row.members_count >= 0 ? row.members_count : null,
    url: `${origin}/groups/${id}`, membership: 'member', members: null, membersStatus: 'not-loaded'
  }
}

// Only memberships from Canvas's own-groups endpoints are eligible for roster
// reads. Knowing another group's numeric ID is never enough to load its members.
export async function fetchCanvasGroups({ origin, token, courses = [], courseIds = [], scope = 'all', groupId = '', force = false, fetchImpl = fetch } = {}) {
  return cachedCanvasResponse({origin, token, courseIds, scope, force, parts:[`groups-v1:${groupId}`]}, async () => {
    const api = createCanvasApi({origin, accessToken:token, fetchImpl})
    const problems = [], groups = new Map()
    const add = (rows, courseId = null) => {
      for (const row of rows) {
        const group = canvasGroupRecord(row, {origin, courses, courseId})
        if (group) groups.set(group.id, group)
      }
    }
    const selected = new Set(courseIds.map(String))
    const error = (part, message, extra = {}) => problems.push({part, message, ...extra})
    let membershipsLoaded = false
    try { add(await api.getPaged('/api/v1/users/self/groups?per_page=100')); membershipsLoaded = true }
    catch { error('groups', 'Canvas group memberships could not be loaded. Check your Canvas connection and try again.') }
    // Course-specific memberships may be available even when a global listing
    // is restricted. Limit concurrency to protect the student's Canvas token.
    for (let offset = 0; offset < courseIds.length; offset += 3) {
      await Promise.all(courseIds.slice(offset, offset + 3).map(async id => {
        try { add(await api.getPaged(`/api/v1/courses/${encodeURIComponent(id)}/groups?only_own_groups=true&per_page=100`), id) }
        catch { error('course-groups', 'Groups for this Canvas course could not be checked. Available memberships are shown.', {courseId:String(id)}) }
      }))
    }
    const visible = [...groups.values()].filter(group => (scope === 'all' || group.scope === scope) && (!selected.size || group.scope === 'course' && selected.has(group.courseId)))
      .sort((a,b) => String(b.academicYear || '').localeCompare(String(a.academicYear || '')) || a.name.localeCompare(b.name))
    if (groupId) {
      const group = visible.find(item => item.id === String(groupId))
      if (!group) error('members', 'This group is not in your available memberships. Refresh your groups before trying again.', {groupId:String(groupId)})
      else {
        try {
          const [users, self] = await Promise.all([
            api.getPaged(`/api/v1/groups/${group.id}/users?exclude_inactive=true&per_page=100`),
            api.getJson('/api/v1/users/self/profile').catch(() => null)
          ])
          group.members = [...new Map(users.filter(user => numericId(user.id)).map(user => [String(user.id), {
            id:String(user.id), name:text(user.name || user.short_name) || 'Unnamed member', isYou:self ? String(user.id) === String(self.id) : null
          }])).values()].sort((a,b) => Number(b.isYou) - Number(a.isYou) || a.name.localeCompare(b.name))
          group.membersStatus = 'loaded'
        } catch {
          group.membersStatus = 'unavailable'
          error('members', 'Canvas did not allow the member list to load. Open the group in Canvas or try again.', {groupId:group.id})
        }
      }
    }
    return {groups:visible, problems, membershipsLoaded, fetchedAt:new Date().toISOString(), refreshMinutes:10}
  })
}
