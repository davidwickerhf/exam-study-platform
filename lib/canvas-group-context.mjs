import { listCanvasConnections, canvasAccessToken } from './canvas-connections.mjs'
import { fetchCanvasHub } from './canvas-hub.mjs'
import { fetchCanvasGroups } from './canvas-groups.mjs'
import { courseCanvasShells } from './workspace/course-editions.mjs'

export async function readCanvasGroups({courseCode='',academicYear='',scope='all',groupId='',canvasUrl='',refresh=false} = {}, dependencies = {}) {
  const listConnections = dependencies.listConnections || listCanvasConnections
  const accessToken = dependencies.accessToken || canvasAccessToken
  const fetchHub = dependencies.fetchHub || fetchCanvasHub
  const fetchGroups = dependencies.fetchGroups || fetchCanvasGroups
  if (!['all','course','global'].includes(scope) || (groupId && !/^\d{1,20}$/.test(groupId)) || (courseCode && !/^[A-Za-z0-9 -]{1,40}$/.test(courseCode)) || (academicYear && !/^(20\d{2}-20\d{2}|undated|all)$/.test(academicYear))) throw new Error('Choose a valid group, course and academic year.')
  const connections = (await listConnections()).filter(connection => !canvasUrl || connection.origin === canvasUrl)
  const results = []
  for (const connection of connections) {
    try {
      const {token} = await accessToken({canvasUrl:connection.origin})
      const base = {origin:connection.origin, token, force:refresh}
      const catalogue = await fetchHub({...base, parts:[]})
      const courses = catalogue.courses.map(course => ({...course,origin:connection.origin}))
      const selected = courseCode ? courseCanvasShells(courses,[courseCode]).filter(course => !academicYear || academicYear === 'all' || (course.academicYear || 'undated') === academicYear) : []
      // Never widen an unmatched course/year to every membership.
      if (courseCode && !selected.length) {results.push({groups:[],problems:[],matchedCourses:[]});continue}
      const result = await fetchGroups({...base, courses:courseCode ? selected : courses, courseIds:selected.map(course=>course.id), scope:courseCode?'course':scope, groupId})
      results.push({...result,matchedCourses:selected.map(({id,courseCode,academicYear,displayName})=>({id,courseCode,academicYear,name:displayName}))})
    } catch { results.push({groups:[],problems:[{part:'connection',message:'Canvas groups could not be reached. Check your connection in Settings and try again.'}]}) }
  }
  return {connected:connections.length>0,groups:results.flatMap(result=>result.groups),problems:results.flatMap(result=>result.problems),matchedCourses:results.flatMap(result=>result.matchedCourses||[]),fetchedAt:new Date().toISOString(),refreshMinutes:10}
}
