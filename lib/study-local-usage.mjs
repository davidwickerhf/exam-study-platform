import { z } from 'zod/v3'
import { ownStudyVersion, listOwnStudyVersions, mutateStudyVersion } from './study-version-store.mjs'
import { StudyVersionError } from './study-version-content.mjs'
const count=z.number().int().nonnegative().nullable().optional()
export const localUsageSchema=z.object({provider:z.string().max(80).optional(),model:z.string().max(120).optional(),inputTokens:count,outputTokens:count,cachedInputTokens:count,reasoningTokens:count,credits:z.number().nonnegative().nullable().optional(),elapsedMs:count}).strict()
export function localUsageSummary(version) {
  const receipts=version.localReceipts || [], groups=new Map()
  for(const row of receipts) {
    const task=row.task || {}, phase=task.phase || 'historical-unclassified',chapterId=task.chapterId || null,key=JSON.stringify([phase,chapterId])
    const group=groups.get(key)||{phase,chapterId,tasks:0,reportedUsage:0,inputTokens:null,outputTokens:null,cachedInputTokens:null,reasoningTokens:null,credits:null,elapsedMs:null}
    group.tasks++
    if(row.usage)group.reportedUsage++
    for(const field of ['inputTokens','outputTokens','cachedInputTokens','reasoningTokens','credits','elapsedMs'])if(typeof row.usage?.[field]==='number')group[field]=(group[field]??0)+row.usage[field]
    groups.set(key,group)
  }
  const reviewTasks=receipts.filter(r=>['reviewer','independent-solver'].includes(r.task?.role)).length
  const chapters=version.draft?.chapters || []
  const projectedReviewTasks=chapters.reduce((n,c)=>n+2*Math.ceil(c.questions.length/24)+Math.ceil((c.sections.length+Math.ceil(c.flashcards.length/4)+2)/24)+Math.ceil((c.teachingPlan?.objectives.length||0)/4),0)
  const budget=version.localReviewTaskBudget ?? null
  return {versionId:version.id,course:version.course,provenance:'client-reported usage; unknown is not zero',historyComplete:receipts.every(r=>r.task),recordedTasks:receipts.length,reviewTasks,authorTasks:receipts.filter(r=>r.task?.role==='generator').length,reviewTaskBudget:budget,overBudget:budget!==null&&reviewTasks>budget,remainingReviewTasks:budget===null?null:Math.max(0,budget-reviewTasks),projectedReviewTasks:chapters.length?projectedReviewTasks:null,projectionBasis:'one review round before cache reuse; bounded packets can split further',phases:[...groups.values()],correctionCycles:version.draft?.correctionHistory?.length ?? null}
}
export async function courseLocalUsage(courseCode) {
  return {guides:(await listOwnStudyVersions()).filter(v=>!courseCode||v.course.courseCode===courseCode).map(localUsageSummary)}
}
export async function setLocalReviewBudget(id, limit) {
  if(!Number.isInteger(limit)||limit<1||limit>10000)throw new StudyVersionError('Choose a review-task budget between 1 and 10,000.')
  await ownStudyVersion(id)
  return localUsageSummary(await mutateStudyVersion(id,v=>{v.localReviewTaskBudget=limit}))
}
