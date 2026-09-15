import {readFile,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {withRequestContext} from '../../lib/request-context.mjs'
import {readStudySourceSnapshot} from '../../lib/study-version-sources.mjs'
if(process.env.DATABASE_URL)throw new Error('Preflight must use isolated local storage.')
const manifest=JSON.parse(await readFile(process.argv[2],'utf8')),units=[]
const covered=new Set()
await withRequestContext({userId:'course-preflight-'+randomUUID(),mode:'local'},async()=>{
 for(const path of manifest.units){
  const pilot=JSON.parse(await readFile(path,'utf8'))
  const initial=pilot.sources.filter(s=>!pilot.updateSourceKeys.includes(s.key))
  const sourceOptions={editorialSources:async()=>pilot.sources,includeHistorical:true}
  const snapshot=await readStudySourceSnapshot(pilot.course,initial.map(s=>s.key),sourceOptions)
  const updated=await readStudySourceSnapshot(pilot.course,pilot.sources.map(s=>s.key),sourceOptions)
  initial.forEach(s=>covered.add(s.key))
  units.push({title:pilot.title,initialSources:snapshot.sources.length,initialCharacters:snapshot.chunks.reduce((n,c)=>n+c.text.length,0),updatedCharacters:updated.chunks.reduce((n,c)=>n+c.text.length,0),years:[...new Set(snapshot.sources.map(s=>s.academicYear))],excluded:snapshot.excluded,updateSources:pilot.updateSourceKeys.length})
 }
})
const missing=manifest.sourceKeys.filter(key=>!covered.has(key))
const report={course:manifest.course,units,missingSources:missing,passed:!missing.length&&units.every(u=>!u.excluded.length),modelCalls:0,limitation:'Source admission and exact bundle coverage only. Does not establish semantic readiness, teaching quality or full model-run completion.'}
await writeFile(process.argv[3],JSON.stringify(report,null,2),{mode:0o600})
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1
