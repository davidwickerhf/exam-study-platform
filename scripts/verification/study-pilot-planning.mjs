import {outlinePlanningStale} from '../../lib/study-course-scope-policy.mjs'
// Planning is a resumable checkpoint, never a quality pass or active revision.
// A whole-course outline saved under an older planning policy with nothing
// authored is not a finished plan: plan-only mode resumes it into a replan.
export function pilotPlanReady(draft) {
 return !!draft?.topics?.length && ['chapters','review','complete'].includes(draft.stage) && !outlinePlanningStale(draft)
}
export function coursePilotCompletion(units,jobs,guideCount) {
 const completed=job=>units.some(unit=>unit.index===job.index&&(unit.phase||'initial')===job.phase&&unit.passed)
 return {
  complete:jobs.every(completed),
  planningComplete:Array.from({length:guideCount},(_,index)=>index).every(index=>units.some(unit=>unit.index===index&&(unit.phase||'initial')==='initial'&&(unit.planned||unit.passed)))
 }
}
