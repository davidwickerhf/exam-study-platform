import { randomUUID } from 'node:crypto'
import { readDocument, compareAndSwapDocument, listDocuments } from './user-store.mjs'
import { sql } from './db.mjs'
import { currentAuth, currentUserId } from './request-context.mjs'
import { StudyVersionError } from './study-version-content.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
export const RECURRING_POLICY = 'study-recurring-pipelines'
const defaults={guides:true,papers:true,priorities:true}
export async function recurringPolicy() { return (await readDocument(RECURRING_POLICY,'settings',null))?.settings || defaults }
export async function recurringEnabled(kind) {return (await recurringPolicy())[kind]!==false}
export async function saveRecurringPolicy(settings) {
  if(currentAuth().mode==='api-key')throw new StudyVersionError('Manage recurring pipeline controls in Settings.',403)
  if(!settings || Object.keys(defaults).some(key=>typeof settings[key]!=='boolean')) throw new StudyVersionError('Choose an on/off setting for each recurring pipeline.')
  const old=await readDocument(RECURRING_POLICY,'settings',null)
  const next={settings:Object.fromEntries(Object.keys(defaults).map(key=>[key,settings[key]])),revision:randomUUID(),updatedAt:new Date().toISOString()}
  await compareAndSwapDocument(RECURRING_POLICY,'settings',next,old?.revision??null)
  return next.settings
}
export async function recurringStatus() {
  const programmeId=await activeProgrammeId()
  const [settings,policies,versions,papers]=await Promise.all([recurringPolicy(),listDocuments('study-module-settings'),listDocuments('study-versions'),listDocuments('study-paper-jobs')])
  return {settings,courses:policies.map(r=>r.value).filter(r=>r.programmeId===programmeId).map(r=>({course:r.course,settings:r.settings,checkedAt:r.checkedAt,error:r.error,modules:r.modules?.length||0})),
    events:policies.map(r=>r.value).filter(r=>r.programmeId===programmeId).flatMap(r=>(r.events||[]).map(e=>({...e,courseCode:r.course.courseCode}))).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,100),
    jobs:[...versions.map(r=>r.value).filter(v=>v.programmeId===programmeId&&v.automation).map(v=>({id:v.id,title:v.title,courseCode:v.course.courseCode,kind:'guide',status:!settings.guides || !policies.some(p=>p.key===v.automation.settingsKey && p.value.settings.enabled)?'paused':v.draft.status,stage:v.draft.stage,error:v.draft.error,updatedAt:v.updatedAt,url:`/app/study/${v.id}`})),
      ...papers.map(r=>r.value).filter(p=>p.programmeId===programmeId).map(p=>({id:p.id,title:p.title,courseCode:p.course.courseCode,kind:'paper',status:!settings.papers && ['queued','running'].includes(p.status)?'paused':p.status,stage:`${p.completedSections}/${p.sections.length} sections`,error:p.error,updatedAt:p.updatedAt||p.createdAt,url:`/app/courses/${encodeURIComponent(p.course.courseCode)}?tab=mock-exams`}))].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100)}
}
export async function automaticGuideAllowed(automation, execution) {
  if(!automation)return true
  const row=await readDocument('study-module-settings',automation.settingsKey,null)
  if(!await recurringEnabled('guides') || !row?.settings.enabled || row.programmeId!==await activeProgrammeId())return false
  if(sql) {
    const [permission]=await sql`SELECT a.binding_id FROM canvas_corpus_access a JOIN canvas_course_bindings b ON b.id=a.binding_id JOIN canvas_corpus_permissions p ON p.user_id=a.user_id AND p.origin=b.origin WHERE a.user_id=${currentUserId()} AND a.binding_id=${automation.candidate?.bindingId || ''} AND NOT a.sync_paused AND a.auto_refresh AND p.collection_enabled AND p.refresh_enabled AND p.study_status='studying'`
    if(!permission)return false
  }
  return true
}
