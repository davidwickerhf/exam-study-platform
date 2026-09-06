import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID,createHash } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments,listDocuments } from '../lib/user-store.mjs'
import { recordAcademicDocumentVersion } from '../lib/academic-document-register.mjs'
import { createAcademicProgramme,selectAcademicProgramme } from '../lib/academics.mjs'
import { removeOnboardingDocument } from '../lib/onboarding-documents.mjs'
import { originalContext,originalStatus,beginOriginal,putOriginalChunk,completeOriginal,readOriginalChunk,ORIGINAL_CHUNK_BYTES,ORIGINAL_MAX_BYTES } from '../lib/academic-originals.mjs'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
async function fixture(fn) {
 const owner=`original-test-${randomUUID()}`
 return withRequestContext({userId:owner,mode:'clerk'},async()=>{try{
  await recordAcademicDocumentVersion({kind:'transcript',label:'Transcript.pdf',fingerprint:randomUUID()})
  await fn(owner)
 }finally{await deleteAllDocuments()}})
}
async function start(bytes,name='Transcript.pdf') {return beginOriginal('transcript',{...(await originalStatus('transcript')),name,size:bytes.length,sha256:sha(bytes)})}
async function put(file,bytes) {for(let i=0;i<file.chunks;i++)await putOriginalChunk('transcript',file.id,i,bytes.subarray(i*ORIGINAL_CHUNK_BYTES,(i+1)*ORIGINAL_CHUNK_BYTES).toString('base64'))}
test('private originals survive storage round trips and are isolated by account and programme',()=>fixture(async(owner)=>{
 const bytes=Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(ORIGINAL_CHUNK_BYTES+19,42)])
 const file=await start(bytes);await put(file,bytes);await completeOriginal('transcript',file.id)
 assert.deepEqual(Buffer.concat(await Promise.all([0,1].map(i=>readOriginalChunk('transcript',file.id,i)))),bytes)
 const originalProgramme=(await originalContext('transcript')).key.split(':')[0]
 await withRequestContext({userId:owner+'-other',mode:'clerk'},async()=>{try{assert.equal((await originalStatus('transcript')).original,null);await assert.rejects(readOriginalChunk('transcript',file.id,0),{status:404})}finally{await deleteAllDocuments()}})
 await createAcademicProgramme({programme:'Other programme'})
 assert.equal((await originalStatus('transcript')).original,null)
 await assert.rejects(readOriginalChunk('transcript',file.id,0),{status:404})
 await selectAcademicProgramme(originalProgramme)
 assert.equal((await originalStatus('transcript')).original.id,file.id)
}))
test('incomplete uploads stay unreadable; chunks are immutable and replacement removes old bytes',()=>fixture(async()=>{
 const bytes=Buffer.from('%PDF-1.4\nhello'),file=await start(bytes)
 await assert.rejects(completeOriginal('transcript',file.id),{status:409})
 assert.equal((await originalStatus('transcript')).original,null)
 await put(file,bytes);await put(file,bytes)
 await assert.rejects(putOriginalChunk('transcript',file.id,0,Buffer.alloc(bytes.length,1).toString('base64')))
 await completeOriginal('transcript',file.id)
 const next=await start(bytes);await put(next,bytes);await completeOriginal('transcript',next.id)
 assert.equal((await listDocuments('academic-original-chunks')).length,1)
 await assert.rejects(readOriginalChunk('transcript',file.id,0),{status:404})
 await removeOnboardingDocument('transcript')
 assert.equal((await listDocuments('academic-originals')).length,0)
 assert.equal((await listDocuments('academic-original-chunks')).length,0)
}))
test('original upload rejects oversized files, corrupt bytes, non-PDF content and stale source versions',()=>fixture(async()=>{
 const binding=(await originalStatus('transcript')).binding,bytes=Buffer.from('%PDF-1.4\nhello')
 await assert.rejects(beginOriginal('transcript',{binding,name:'a.pdf',size:ORIGINAL_MAX_BYTES+1,sha256:sha(bytes)}),{status:413})
 const file=await start(bytes)
 await assert.rejects(putOriginalChunk('transcript',file.id,0,'invalid base64'))
 await putOriginalChunk('transcript',file.id,0,Buffer.alloc(bytes.length,0).toString('base64'))
 await assert.rejects(completeOriginal('transcript',file.id),/checksum/)
 const fake=Buffer.from('not a PDF'),bad=await start(fake);await put(bad,fake)
 await assert.rejects(completeOriginal('transcript',bad.id),/not a PDF/)
 await new Promise(resolve=>setTimeout(resolve,2))
 await recordAcademicDocumentVersion({kind:'transcript',label:'New.pdf',fingerprint:randomUUID()})
 await assert.rejects(beginOriginal('transcript',{binding,name:'a.pdf',size:bytes.length,sha256:sha(bytes)}),{status:409})
 await assert.rejects(completeOriginal('transcript',bad.id),{status:409})
}))
