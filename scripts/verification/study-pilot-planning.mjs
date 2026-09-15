// Planning is a resumable checkpoint, never a quality pass or active revision.
export function pilotPlanReady(draft) {
 return !!draft?.topics?.length && ['chapters','review','complete'].includes(draft.stage)
}
export function coursePilotCompletion(units,jobs,guideCount) {
 const completed=job=>units.some(unit=>unit.index===job.index&&(unit.phase||'initial')===job.phase&&unit.passed)
 return {
  complete:jobs.every(completed),
  planningComplete:Array.from({length:guideCount},(_,index)=>index).every(index=>units.some(unit=>unit.index===index&&(unit.phase||'initial')==='initial'&&(unit.planned||unit.passed)))
 }
}
