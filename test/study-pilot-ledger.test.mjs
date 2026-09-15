import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {readPilotLedger,writePilotJson} from '../scripts/verification/study-pilot-ledger.mjs'

test('pilot resume preserves spending and rejects changed inputs, corrupt ledgers and unfinished attempts',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pilot-ledger-'))
 const path=join(directory,'suite.json'),manifest={course:{courseCode:'TEST'},maximumUsd:50},units=[{sources:['source-a']}]
 try{
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
