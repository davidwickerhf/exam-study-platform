import { readAcademicState } from './academics.mjs'
import { aggregateCalendar, feedEvents } from './calendar-feed.mjs'
import { withRequestContext } from './request-context.mjs'

export function courseTimetableEvidence(events,binding) {
  const year=String(binding.academic_year || '').match(/^(20\d{2})-(20\d{2})$/)
  return events.filter(event=>event.attendanceEligible && event.courseCode===binding.course_code
    && (!year || event.start>=`${year[1]}-08-01` && event.start<`${year[2]}-08-01`))
    .map(event=>({start:event.start,end:event.end,timetableLabel:event.sourceActivity || event.activity}))
    .sort((a,b)=>a.start.localeCompare(b.start))
}

export async function priorityTimetableContext(binding,accountId) {
  return withRequestContext({userId:accountId,mode:'internal'},async()=>{
    const {workspace}=await readAcademicState()
    const feeds=await Promise.all((workspace.calendars || []).map(async link=>{
      try {return {link,events:await feedEvents(link)}} catch {return {link,events:[],failed:true}}
    }))
    const events=aggregateCalendar({workspace,editorialCourses:[],feeds}).events
    const sessions=courseTimetableEvidence(events,binding)
    return {sessions:sessions.slice(0,250),incomplete:feeds.some(feed=>feed.failed)||sessions.length>250}
  })
}
