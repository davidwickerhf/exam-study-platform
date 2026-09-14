import {readFile,writeFile,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {withRequestContext} from '../../lib/request-context.mjs'
import {readStudySourceSnapshot} from '../../lib/study-version-sources.mjs'
import {validateLocalPaperImport} from '../../lib/study-practice.mjs'
if(!process.env.RESUME_CLONE_HOST || new URL(process.env.DATABASE_URL).hostname!==process.env.RESUME_CLONE_HOST)throw Error('Use the explicit validation clone.')
const folder=process.env.PARSED_PAPER_DIR,report=[]
await withRequestContext({userId:process.env.RESUME_USER_ID,mode:'local'},async()=>{
 for(const file of (await readdir(folder)).filter(f=>f.endsWith('.parsed.json'))) {
  const parsed=JSON.parse(await readFile(join(folder,file),'utf8')),sourceKey=parsed.questions[0].sourceKey
  const keys=[...new Set([sourceKey,...parsed.questions.flatMap(q=>(q.dependencies||[]).map(d=>d.sourceKey))])]
  const snapshot=await readStudySourceSnapshot({courseCode:'BCS2120',academicYear:'2026-2027',period:'1'},keys,{includeHistorical:true})
  const result=validateLocalPaperImport(parsed,{mode:'extract',snapshot,questionSourceKey:sourceKey})
  report.push({file,total:parsed.questions.length,valid:result.valid,validated:result.result.questions.length,issues:result.issues.map(issue=>({...issue,question:parsed.questions[issue.index].question,evidence:snapshot.chunks.filter(c=>c.sourceKey===sourceKey&&c.page===parsed.questions[issue.index].page).map(c=>c.text).join('\n')}))})
  await writeFile(process.env.PAPER_IMPORT_REPORT || '/tmp/study-paper-import-dry-run.json',JSON.stringify(report,null,2))
 }
})
console.log(JSON.stringify(report.map(({issues,...r})=>({...r,issues:issues.length}))))
