import { randomUUID } from 'node:crypto'
import { z } from 'zod/v3'
import { readDocument, compareAndSwapDocument } from './user-store.mjs'
import { ownStudyVersion, studyRevision, mutateStudyVersion } from './study-version-store.mjs'
import { listStudySources, readStudySourceSnapshot } from './study-version-sources.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
import { digest, StudyVersionError } from './study-version-content.mjs'
import { refreshStudyVersion } from './study-version-pipeline.mjs'
import { automaticGuideAllowed } from './study-recurring-policy.mjs'
const schema=z.object({versionId:z.string(),enabled:z.boolean(),moduleRefs:z.array(z.object({bindingId:z.string(),moduleId:z.string()})).min(1).max(20),expectedRevisionId:z.string(),dryRun:z.boolean().default(true)})
export async function enrollGuideMaintenance(input,{sourceOptions={}}={}) {
  const body=schema.parse(input),version=await ownStudyVersion(body.versionId),revision=await studyRevision(version)
  if(!revision || version.activeRevisionId!==body.expectedRevisionId)throw new StudyVersionError('Reload the completed guide before enrolling its current revision.',409)
  if(version.programmeId!==await activeProgrammeId())throw new StudyVersionError('Select the guide’s programme.',403)
  if(version.automation && version.automation.kind!=='maintenance')throw new StudyVersionError('This guide already belongs to automatic module generation.',409)
  if(version.draft.execution!=='local')throw new StudyVersionError('This enrollment supports local maintenance only; it cannot enable hosted spending.',409)
  if(body.enabled && version.draft.status!=='complete')throw new StudyVersionError('Finish the current run before enrolling maintenance.',409)
  const refs=[...new Map(body.moduleRefs.map(r=>[`${r.bindingId}:${r.moduleId}`,r])).values()]
  const sources=body.enabled ? await listStudySources(version.course,sourceOptions) : []
  for(const ref of body.enabled ? refs : []) {
    const inventory=await readDocument('canvas-module-inventories',ref.bindingId,null)
    if(!inventory || inventory.course.courseCode!==version.course.courseCode || inventory.course.academicYear!==version.course.academicYear || String(inventory.course.period||'')!==version.course.period || !inventory.modules.some(m=>String(m.id)===ref.moduleId) || !sources.some(s=>s.bindingId===ref.bindingId))throw new StudyVersionError('Select an accessible current-edition Canvas module from the course inventory.',403)
  }
  const settingsKey=digest([version.course.courseCode,version.course.academicYear,version.course.period])
  const selection={versionId:version.id,enabled:body.enabled,moduleRefs:refs,sourceKeys:revision.snapshot.sources.map(s=>s.key),enrolledRevisionId:revision.id}
  if(body.dryRun)return {...selection,dryRun:true,execution:'local',createsNewGuide:false}
  const old=await readDocument('study-module-settings',settingsKey,null)
  if(old && old.programmeId!==version.programmeId)throw new StudyVersionError('Course maintenance belongs to another programme.',409)
  // Write policy first; automaticGuideAllowed requires both policy and matching
  // enrollment on the version, so a partial write cannot launch work.
  const entries=(old?.maintainedGuides || []).filter(g=>g.versionId!==version.id)
  await compareAndSwapDocument('study-module-settings',settingsKey,{...old,course:version.course,programmeId:version.programmeId,settings:old?.settings || {enabled:false,execution:'local',rule:'auto',historicalMode:'suggest',supportingSourceKeys:[],billing:{source:'platform',quality:'astra',maxJobUsd:10}},maintainedGuides:[...entries,selection],checkedAt:null,revision:randomUUID()},old?.revision??null)
  await mutateStudyVersion(version.id,v=>{
    if(v.activeRevisionId!==revision.id || (body.enabled && v.draft.status!=='complete'))throw new StudyVersionError('The guide changed during enrollment. Retry with its current revision.',409)
    v.automation={kind:'maintenance',versionId:v.id,settingsKey,candidate:{bindingId:refs[0].bindingId,moduleRefs:refs}}
  })
  return {...selection,dryRun:false,execution:'local',createsNewGuide:false}
}
export function maintenanceSourceSelection(entry,course,sources,inventories) {
  const keys=new Set(entry.sourceKeys), refs=entry.moduleRefs
  for(const source of sources) {
    if(source.academicYear!==course.academicYear || (source.period && source.period!==course.period))continue
    const matches=refs.filter(r=>r.bindingId===source.bindingId)
    if(matches.length && (source.announcement || source.locations?.some(l=>matches.some(r=>r.moduleId===String(l.moduleId))))) {
      const inventory=inventories.find(i=>i.bindingId===source.bindingId)
      if(source.announcement || !inventory?.sourcePaths || inventory.sourcePaths.includes(source.sourcePath))keys.add(source.key)
    }
  }
  // Removed/withdrawn sources require attention; do not silently substitute or
  // broaden the guide into other modules or historical editions.
  if([...keys].some(key=>!sources.some(s=>s.key===key)))throw new StudyVersionError('A maintained guide source was withdrawn. Review its selection before updating.',409)
  return [...keys]
}
export async function reconcileMaintainedGuides(row,{sourceOptions={},sources,inventories}) {
  const events=[]
  for(const entry of (row.maintainedGuides || []).filter(e=>e.enabled)) {
    const version=await ownStudyVersion(entry.versionId).catch(()=>null)
    if(!version || version.automation?.kind!=='maintenance' || !await automaticGuideAllowed(version.automation,'local'))continue
    try {
      const sourceKeys=maintenanceSourceSelection(entry,row.course,sources,inventories)
      const snapshot=await readStudySourceSnapshot(row.course,sourceKeys,{...sourceOptions,includeHistorical:true})
      const revision=await studyRevision(version)
      if(revision?.snapshot.sourceHash===snapshot.sourceHash)continue
      if(snapshot.excluded.length)throw new StudyVersionError('Selected updated material has no readable text yet.',409)
      if(version.draft.status!=='complete') {row.pendingWork=true;events.push({versionId:version.id,status:'waiting',message:'Source change pending; existing work is preserved.'});continue}
      await refreshStudyVersion(version.id,{sourceKeys},{...sourceOptions,includeHistorical:true,execution:'local',billing:{source:'local',model:'local-agent',provider:'local'}})
      events.push({versionId:version.id,status:'queued',message:'Incremental local revision queued; the current guide remains readable.'})
    }catch(error){events.push({versionId:version.id,status:'needs-attention',message:error.status?error.message:'Maintenance check failed; saved guide is unchanged.'})}
  }
  return events
}
