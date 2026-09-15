import {readFile,writeFile,rename} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'

export async function writePilotJson(path,value){
 const temporary=`${path}.${randomUUID()}.tmp`
 await writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'})
 await rename(temporary,path)
}

export async function readPilotLedger(path,manifest,units){
 let ledger
 try{ledger=JSON.parse(await readFile(path,'utf8'))}
 catch(error){if(error.code!=='ENOENT')throw error;ledger={course:manifest.course,maximumUsd:manifest.maximumUsd,attempts:[],units:[]}}
 const fingerprint=createHash('sha256').update(JSON.stringify({manifest,units})).digest('hex')
 if(ledger.fingerprint && ledger.fingerprint!==fingerprint)throw Error('Course inputs changed: preserve this ledger and investigate before resuming.')
 if(!ledger.fingerprint && (ledger.units.some(unit=>unit.passed)||ledger.course.courseCode!==manifest.course.courseCode))throw Error('Cannot adopt an existing completed or different course ledger without verified inputs.')
 if(ledger.attempts.some(a=>!Number.isFinite(a.costUsd)||a.costUsd<0))throw Error('Invalid recorded pilot spending.')
 if(ledger.pending)throw Error(`An unfinished attempt is recorded at ${ledger.pending.report}. Inspect its process and reconcile its reservation before resuming; do not reset the ledger.`)
 return {...ledger,fingerprint}
}

export async function assertPilotNotPaused(path){
 if(!path)return
 try{await readFile(path)}catch(error){if(error.code==='ENOENT')return;throw error}
 const error=new Error('Paused at a completed-call checkpoint for course-planning optimization.')
 error.code='pilot_paused'
 throw error
}
