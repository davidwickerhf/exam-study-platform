import assert from 'node:assert/strict'
import {writeDocument} from '../../lib/user-store.mjs'
import {ownStudyVersion} from '../../lib/study-version-store.mjs'
import {enrollGuideMaintenance} from '../../lib/study-guide-maintenance.mjs'
import {reconcileModuleGuides} from '../../lib/study-module-automation.mjs'
import {dependencyHash} from '../../lib/study-review-dependencies.mjs'

// Uses the real enrollment/scheduler path in the caller's isolated local account.
// The supplied sources retain their original course/year/module provenance.
export async function queuePilotMaintenance(id,pilot,sourceOptions,reveal) {
 const before=await ownStudyVersion(id)
 const refs=pilot.moduleRefs || [...new Map(pilot.sources.filter(s=>s.academicYear===pilot.course.academicYear).flatMap(s=>(s.locations||[]).filter(l=>l.moduleId!=null).map(l=>({bindingId:s.bindingId,moduleId:String(l.moduleId)}))).filter(r=>r.bindingId&&r.moduleId!=='undefined').map(r=>[JSON.stringify(r),r])).values()]
 assert.ok(refs.length,'The course pilot needs current-year Canvas module bindings.')
 for(const bindingId of new Set(refs.map(r=>r.bindingId)))await writeDocument('canvas-module-inventories',bindingId,{bindingId,course:pilot.course,modules:refs.filter(r=>r.bindingId===bindingId).map(r=>({id:r.moduleId,name:r.moduleId,items:1})),sourcePaths:pilot.sources.filter(s=>s.bindingId===bindingId&&!pilot.updateSourceKeys.includes(s.key)).map(s=>s.sourcePath)})
 await enrollGuideMaintenance({versionId:id,expectedRevisionId:before.activeRevisionId,enabled:true,moduleRefs:refs,dryRun:false},{sourceOptions})
 const enrolled=await ownStudyVersion(id)
 await reconcileModuleGuides(enrolled.automation.settingsKey,{sourceOptions})
 assert.equal((await ownStudyVersion(id)).draft.id,before.draft.id,'No-change maintenance must not create a revision.')
 await reveal()
 for(const bindingId of new Set(refs.map(r=>r.bindingId)))await writeDocument('canvas-module-inventories',bindingId,{bindingId,course:pilot.course,modules:refs.filter(r=>r.bindingId===bindingId).map(r=>({id:r.moduleId,name:r.moduleId,items:1})),sourcePaths:pilot.sources.filter(s=>s.bindingId===bindingId).map(s=>s.sourcePath)})
 await reconcileModuleGuides(enrolled.automation.settingsKey,{sourceOptions,now:Date.now()+86400001})
 const queued=await ownStudyVersion(id)
 assert.notEqual(queued.draft.id,before.draft.id,'Added material must queue a revision.')
 assert.equal(queued.activeRevisionId,before.activeRevisionId,'The readable revision must remain active.')
 assert.equal(queued.draft.execution,'local','Maintenance must not switch to hosted execution.')
 return {versionId:id,readableRevisionId:before.activeRevisionId,queuedRevisionId:queued.draft.id,noChangePassed:true,executionPreserved:true}
}
export function pilotReuse(before,after) {
 const report={chaptersRetained:0,sectionsRetained:0,questionsRetained:0,priorChapters:before.chapters.length}
 for(const chapter of after.chapters){const old=before.chapters.find(c=>c.id===chapter.id);if(!old)continue
  if(old.inputHash===chapter.inputHash)report.chaptersRetained++
  for(const [field,key,count] of [['sections','id','sectionsRetained'],['questions','key','questionsRetained']])for(const item of chapter[field])if(old[field].some(v=>v[key]===item[key]&&dependencyHash(v)===dependencyHash(item)))report[count]++
 }
 return report
}
