import {coursePilotCompletion,pilotPlanReady} from './study-pilot-planning.mjs'
import {readPilotLedger,writePilotJson} from './study-pilot-ledger.mjs'
import {pilotAccounting} from './study-pilot-accounting.mjs'
// A whole-course experiment is a bundle of focused guides sharing one hard
// cumulative test allowance. Private source manifests/results stay outside git.
import {readFile,mkdir,open,unlink} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
if(process.env.DATABASE_URL)throw new Error('Course pilots require isolated local storage.')
const manifestPath=resolve(process.argv[2]||''),manifest=JSON.parse(await readFile(manifestPath,'utf8'))
const output=resolve(process.argv[3]||dirname(manifestPath)+'/results-'+manifest.course.courseCode)
await mkdir(output,{recursive:true,mode:0o700})
const ledgerPath=output+'/suite.json'
if(!Number.isFinite(manifest.maximumUsd)||manifest.maximumUsd<=0||manifest.maximumUsd>50)throw new Error('Choose a course pilot cap up to $50.')
const units=await Promise.all(manifest.units.map(async path=>({path,pilot:JSON.parse(await readFile(path,'utf8'))})))
// An exclusive lock prevents two coordinators from spending the same allowance.
const lockPath=output+'/suite.lock'
const lock=await open(lockPath,'wx',0o600)
await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}))
try{
let ledger=await readPilotLedger(ledgerPath,manifest,units)
ledger.isolatedUserId ||= `live-validation-${randomUUID()}`
const covered=new Set(units.flatMap(u=>u.pilot.sources.filter(s=>!u.pilot.updateSourceKeys.includes(s.key)).map(s=>s.key)))
if(manifest.sourceKeys.some(key=>!covered.has(key)))throw new Error('The guide bundle omits course sources.')
const planOnly=process.env.STUDY_PIPELINE_PLAN_ONLY==='1'
const jobs=[...units.map((_,index)=>({index,phase:'initial'})),...units.flatMap((u,index)=>u.pilot.updateSourceKeys.length?[{index,phase:'update'}]:[])]
for(const {index,phase} of jobs){
 if(planOnly && phase==='update')continue
 const plannedUnit=planOnly&&ledger.units.find(u=>u.index===index&&(u.phase||'initial')===phase&&u.planned)
 // A saved plan made under an older planning policy is replanned, not skipped.
 if(plannedUnit && await readFile(plannedUnit.report,'utf8').then(r=>pilotPlanReady(JSON.parse(r).runs?.findLast(run=>run.draft)?.draft),()=>true))continue
 if(ledger.units.some(u=>u.index===index&&(u.phase||'initial')===phase&&u.passed))continue
 const prior=ledger.attempts.reduce((n,a)=>n+a.costUsd,0),previous=ledger.attempts.findLast(a=>a.index===index&&(a.phase||'initial')===phase)
 const path=output+`/guide-${index+1}-${phase}-attempt-${ledger.attempts.filter(a=>a.index===index&&(a.phase||'initial')===phase).length+1}.json`
 const env={...process.env,STUDY_PIPELINE_RUNTIME:'agents-sdk-responses',STUDY_PIPELINE_MODEL:'gpt-6-astra',STUDY_PIPELINE_MODE:'local',STUDY_PIPELINE_COURSE_FILE:units[index].path,STUDY_PIPELINE_MAX_USD:String(manifest.maximumUsd),STUDY_PIPELINE_PRIOR_USD:String(prior),STUDY_PIPELINE_OUTPUT_LIMIT:process.env.STUDY_PIPELINE_OUTPUT_LIMIT||'32000',STUDY_PIPELINE_REPORT:path}
 delete env.DATABASE_URL;delete env.STUDY_PIPELINE_RESUME_FILE;delete env.STUDY_PIPELINE_UPDATE_ONLY;delete env.STUDY_PIPELINE_DEFER_UPDATE
 env.STUDY_PIPELINE_ISOLATED_USER_ID=ledger.isolatedUserId
 if(phase==='initial')env.STUDY_PIPELINE_DEFER_UPDATE='1'
 else if(!previous){env.STUDY_PIPELINE_UPDATE_ONLY='1';env.STUDY_PIPELINE_RESUME_FILE=ledger.units.find(u=>u.index===index&&(u.phase||'initial')==='initial'&&u.passed)?.report;if(!env.STUDY_PIPELINE_RESUME_FILE)throw Error('No completed initial guide for update.')}
 if(previous)env.STUDY_PIPELINE_RESUME_FILE=previous.report
 ledger.pending={index,phase,report:path,startedAt:new Date().toISOString()}
 await writePilotJson(ledgerPath,ledger)
 console.log(`COURSE ${manifest.course.courseCode} ${phase.toUpperCase()} GUIDE ${index+1}/${units.length}: ${units[index].pilot.title}; prior recorded/reserved $${prior.toFixed(4)}`)
 const code=await new Promise(resolveCode=>{const child=spawn(process.execPath,['scripts/verification/study-pipeline-live.mjs'],{env,stdio:'inherit'});child.on('error',()=>resolveCode(1));child.on('exit',resolveCode)})
 const result=await readFile(path,'utf8').then(JSON.parse).catch(()=>null)
 if(!result)throw new Error('Pilot has no durable result; inspect the process before any retry.')
 ledger.attempts.push({index,phase,report:path,costUsd:result.calculatedUsd,calls:result.calls,accounting:pilotAccounting(result),exitCode:code})
 if(!Number.isFinite(result.calculatedUsd)||result.calculatedUsd<0)throw Error('Invalid attempt spending; preserve pending reservation for investigation.')
 const planned=code===0&&result.runs?.some(r=>r.phase===phase&&r.planned)
 const passed=code===0&&result.runs?.some(r=>r.phase===phase&&r.passed)&&result.runs.every(r=>r.passed)
 ledger.units=ledger.units.filter(u=>u.index!==index||(u.phase||'initial')!==phase).concat({index,phase,title:units[index].pilot.title,passed,planned,report:path})
 ledger.knownUsageUsd=ledger.attempts.reduce((n,a)=>n+(a.accounting?.knownUsageUsd||0),0);ledger.unsettledReservationUsd=ledger.attempts.reduce((n,a)=>n+(a.accounting?.unsettledReservationUsd??a.costUsd),0)
 ledger.totalUsd=ledger.attempts.reduce((n,a)=>n+a.costUsd,0);Object.assign(ledger,coursePilotCompletion(ledger.units,jobs,units.length))
 delete ledger.pending
 await writePilotJson(ledgerPath,ledger)
 if(!passed && !(planOnly&&planned)){process.exitCode=1;break}
}
console.log(JSON.stringify({course:ledger.course.courseCode,complete:ledger.complete,planningComplete:ledger.planningComplete,knownUsageUsd:ledger.knownUsageUsd,unsettledReservationUsd:ledger.unsettledReservationUsd,committedBudgetUsd:ledger.totalUsd,units:ledger.units},null,2))

}finally{await lock.close();await unlink(lockPath)}
