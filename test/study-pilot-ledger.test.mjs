import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {readPilotLedger,writePilotJson,assertPilotNotPaused} from '../scripts/verification/study-pilot-ledger.mjs'

test('pilot resume preserves spending and rejects changed inputs, corrupt ledgers and unfinished attempts',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pilot-ledger-'))
 const path=join(directory,'suite.json'),manifest={course:{courseCode:'TEST'},maximumUsd:50},units=[{sources:['source-a']}]
 try{
  await assertPilotNotPaused(path)
  await writeFile(path,'pause')
  await assert.rejects(assertPilotNotPaused(path),{code:'pilot_paused'})
  await rm(path)
  const ledger=await readPilotLedger(path,manifest,units)
  ledger.attempts.push({costUsd:1.2})
  await writePilotJson(path,ledger)
  assert.equal((await readPilotLedger(path,manifest,units)).attempts[0].costUsd,1.2)
  await assert.rejects(readPilotLedger(path,manifest,[{sources:['source-b']}]),/inputs changed/)
  await writePilotJson(path,{...ledger,pending:{report:'attempt.json'}})
  await assert.rejects(readPilotLedger(path,manifest,units),/unfinished attempt/)
  await writeFile(path,'{broken')
  await assert.rejects(readPilotLedger(path,manifest,units),SyntaxError)
 }finally{await rm(directory,{recursive:true,force:true})}
})

test('bounded pilot segments never raise the course cap and stop only at a checked checkpoint',async()=>{
 const {pilotAttemptCap,assertPilotChapterTarget}=await import('../scripts/verification/study-pilot-ledger.mjs')
 assert.equal(pilotAttemptCap(50,26.5,'5'),31.5)
 assert.equal(pilotAttemptCap(50,48,'5'),50)
 assert.equal(pilotAttemptCap(50,26.5,undefined),50)
 for(const invalid of ['', 'NaN','-1','0'])assert.throws(()=>pilotAttemptCap(50,26.5,invalid))
 const draft={chapters:[{review:'passed',evidenceReview:{},pedagogicalReview:{}},{review:'pending',evidenceReview:{}}]}
 assert.doesNotThrow(()=>assertPilotChapterTarget(draft,'2'))
 assert.throws(()=>assertPilotChapterTarget(draft,'1'),{code:'pilot_paused'})
 assert.throws(()=>assertPilotChapterTarget(draft,'0'),/Invalid/)
 assert.doesNotThrow(()=>assertPilotChapterTarget(draft,undefined))
})
