// Run only against a disposable copy of the production branch. No provider is
// configured or invoked; production IDs intentionally remain unchanged.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { withRequestContext } from '../../lib/request-context.mjs'
import { ownStudyVersion, studyRevision } from '../../lib/study-version-store.mjs'
import { nextLocalStudy, submitLocalStudy } from '../../lib/study-local-generation.mjs'
import {neonCurlFetch} from './neon-curl-fetch.mjs'
import { neonConfig, neon } from '@neondatabase/serverless'
import { writeDocument } from '../../lib/user-store.mjs'
import {teachingContent} from '../../lib/study-chapter-repair.mjs'
import { digest } from '../../lib/study-version-content.mjs'
if(!process.env.RESUME_CLONE_HOST || new URL(process.env.DATABASE_URL).hostname!==process.env.RESUME_CLONE_HOST)throw Error('Select the explicit isolated clone host.')
if(process.env.RESUME_CURL_TRANSPORT==='1')neonConfig.fetchFunction=neonCurlFetch
const manifest=JSON.parse(await readFile(process.env.RESUME_MANIFEST,'utf8'))
const report=[]
await withRequestContext({userId:process.env.RESUME_USER_ID,mode:'local'},async()=>{
  if(process.argv.includes('--seed-from-primary-read-only')) {
    if(!process.env.RESUME_PRIMARY_READ_URL || new URL(process.env.RESUME_PRIMARY_READ_URL).hostname===process.env.RESUME_CLONE_HOST)throw Error('Source must differ from the explicit clone.')
    const primaryRead=neon(process.env.RESUME_PRIMARY_READ_URL)
    for(const guide of manifest.guides) {
      const rows=await primaryRead`SELECT value FROM user_documents WHERE user_id=${process.env.RESUME_USER_ID} AND namespace='study-versions' AND document_key=${guide.id}`
      assert.equal(rows.length,1)
      // writeDocument is connected exclusively to RESUME_CLONE_HOST.
      await writeDocument('study-versions',guide.id,rows[0].value)
    }
  }
  for(const guide of manifest.guides) {
    const before=await ownStudyVersion(guide.id), revision=await studyRevision(before)
    const snapshotHash=digest(before.draft.snapshot || revision?.snapshot),ready=(before.draft.chapters || revision?.chapters || []).filter(c=>c.review==='passed')
    assert.equal(ready.length,guide.readyChapters)
    assert.equal(before.activeRevisionId,guide.revisionId)
    const old=before.draft.localRequest
    if(old)await assert.rejects(()=>submitLocalStudy(guide.id,{requestId:old.id,contractId:manifest.contractId,response:{}}),/pipeline changed/)
    assert.deepEqual((await ownStudyVersion(guide.id)).draft,before.draft)
    const next=await nextLocalStudy(guide.id)
    const after=await ownStudyVersion(guide.id)
    assert.equal(digest(after.draft.snapshot || (await studyRevision(after))?.snapshot),snapshotHash)
    assert.equal(after.activeRevisionId,before.activeRevisionId)
    assert.deepEqual(after.draft.manualRepairs,before.draft.manualRepairs)
    assert.deepEqual((after.draft.chapters || (await studyRevision(after))?.chapters || []).filter(c=>c.review==='passed'),ready)
    assert.deepEqual(after.localReceipts,before.localReceipts)
    for(const authored of before.draft.chapters || []) {
      const retained=after.draft.chapters?.find(c=>c.id===authored.id) || (after.draft.repair?.topicId===authored.id ? after.draft.repair.chapter : null)
      assert.ok(retained)
      assert.deepEqual(teachingContent(retained),teachingContent(authored))
    }
    if(revision)assert.deepEqual(await studyRevision(after),revision)
    if(guide.status==='waiting-local')assert.ok(next.request,JSON.stringify({id:guide.id,status:next.version.status,nextAction:next.nextAction}))
    report.push({id:guide.id,readyChapters:ready.length,activeRevisionId:after.activeRevisionId,status:after.draft.status,requestId:next.request?.id,phase:next.request?.task?.phase,snapshotPreserved:true,readyContentPreserved:true,receiptsPreserved:true,manualAttempts:after.draft.manualRepairs,automaticAttempts:after.draft.automaticRepairs})
  }
})
await writeFile(process.env.RESUME_REPORT || '/tmp/study-resume-clone-report.json',JSON.stringify(report,null,2))
console.log(JSON.stringify(report))
