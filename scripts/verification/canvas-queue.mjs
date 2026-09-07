// Run against a disposable local pgvector database only:
// QUEUE_TEST_DATABASE_URL=postgres://... node --experimental-test-module-mocks scripts/verification/canvas-queue.mjs
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import pg from 'pg'
const url=new URL(process.env.QUEUE_TEST_DATABASE_URL || '')
if(!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('This destructive fixture only accepts localhost.')
const pool=new pg.Pool({connectionString:url.href})
process.env.DATABASE_URL='';process.env.OPENAI_API_KEY='';process.env.VERCEL_ENV='';
const db=await import('../../lib/db.mjs')
function statement(strings,...values) {
  const text=strings.reduce((out,part,i)=>out+(i?`$${i}`:'')+part,'')
  return {text,values,then(resolve,reject){return pool.query(text,values).then(result=>result.rows).then(resolve,reject)}}
}
statement.transaction=async queries=>{
  const client=await pool.connect()
  try {await client.query('BEGIN');const results=[];for(const q of queries) {
    // Neon infers unknown parameter types before binding. Exercise that phase
    // explicitly for polymorphic concat rather than relying on pg wire types.
    if (q.text.includes('SELECT concat(')) {
      await client.query(`PREPARE retry_type_check AS ${q.text}`)
      await client.query('DEALLOCATE retry_type_check')
    }
    results.push((await client.query(q.text,q.values)).rows)
  }await client.query('COMMIT');return results}
  catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
mock.module('../../lib/db.mjs',{namedExports:{...db,sql:statement}})
const connections=await import('../../lib/canvas-connections.mjs')
let credentialsBlocked=false
mock.module('../../lib/canvas-connections.mjs',{namedExports:{...connections,canvasAccessTokenForUser:async()=>{if(credentialsBlocked)throw new connections.CanvasConnectionError(connections.CANVAS_DECRYPTION_ERROR,'CANVAS_CONNECTION_UNREADABLE');return {token:'fixture-token'}}}})
const embeddings=await import('../../lib/embeddings.mjs')
let failEmbedding=false,embeddingCalls=0
mock.module('../../lib/embeddings.mjs',{namedExports:{...embeddings,embeddingConfiguration:()=>({configured:true,model:'fixture'}),embedTexts:async texts=>{
  embeddingCalls++;if(failEmbedding){failEmbedding=false;throw new Error('Injected embedding interruption')}
  return texts.map(()=>Array(1536).fill(0.01))
}}})
const priorities=await import('../../lib/priority-evidence.mjs')
mock.module('../../lib/priority-evidence.mjs',{namedExports:{...priorities,scanCanvasPriorityEvidence:async()=>({status:'confirmed',candidates:1})}})
const policies=await import('../../lib/programme-policy-sources.mjs')
mock.module('../../lib/programme-policy-sources.mjs',{namedExports:{...policies,promoteReviewedProgrammePolicyAsset:async()=>null}})
const {processCanvasQueueStep,dispatchCanvasQueue}=await import('../../lib/canvas-queue-pipeline.mjs')
const {controlCanvasSyncJob,observeCanvasCorpusCourses,setCanvasRefreshSettings}=await import('../../lib/course-corpus.mjs')
const file=Buffer.alloc(9*1024*1024+13,97)
let downloads=0,fileVersion="2026-09-01T00:00:00Z"
const originalFetch=globalThis.fetch
let failDownload=false
fetch=async(value,options={})=>{
  const url=new URL(value)
  if(url.hostname==='files.fixture'){
    downloads++
    if(failDownload){failDownload=false;throw new Error('Injected download interruption')}
    const match=/bytes=(\d+)-(\d+)/.exec(options.headers.Range),start=Number(match[1]),end=Math.min(file.length-1,Number(match[2]))
    return new Response(file.subarray(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${file.length}`,etag:'"fixture-v1"'}})
  }
  if(url.pathname.endsWith('/files/7'))return Response.json({id:7,url:'https://files.fixture/7',size:file.length,updated_at:fileVersion})
  if(url.pathname==='/api/v1/users/self/profile')return Response.json({id:1})
  if(url.pathname==='/api/v1/courses/8')return Response.json({id:8,name:'Fixture',syllabus_body:'Weekly attendance. '.repeat(12000)})
  if(url.pathname==='/api/v1/courses/8/files')return Response.json([{id:7,url:'https://files.fixture/7',filename:'lecture.mp4',content_type:'video/mp4',size:file.length,updated_at:fileVersion}])
  return Response.json([])
}
const query=(text,values=[])=>pool.query(text,values).then(result=>result.rows)
const one=async(text,values)=>(await query(text,values))[0]
try {
  await query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  for(const name of (await readdir(new URL('../../db/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort()) await query(await readFile(new URL('../../db/'+name,import.meta.url),'utf8'))
  await query("INSERT INTO editorial_course_editions(id,canonical_course_id,course_name,edition_key,created_by) VALUES('edition','bcs2120','Fixture','fixture','fixture')")
  await query("INSERT INTO canvas_course_bindings(id,origin,canvas_course_id,edition_id,canonical_course_id,course_code,course_name) VALUES('binding','https://canvas.fixture','8','edition','bcs2120','BCS2120','Fixture')")
  await query("INSERT INTO canvas_corpus_permissions(user_id,origin,collection_enabled) VALUES('fixture','https://canvas.fixture',true)")
  await query("INSERT INTO academic_programmes(user_id,id,is_active) VALUES('fixture','programme',true)")
  await query("INSERT INTO canvas_corpus_access(user_id,binding_id) VALUES('fixture','binding')")
  await query("INSERT INTO canvas_sync_jobs(id,user_id,origin,binding_id,job_type) VALUES('csj-fixture','fixture','https://canvas.fixture','binding','course')")
  assert.equal((await processCanvasQueueStep('csj-fixture')).again,true)
  const media=await one("SELECT * FROM canvas_sync_resources WHERE payload->>'fileId'='7'")
  // First range survives a worker's disappearance without publishing partial bytes.
  let interrupted=false
  while(Number((await one('SELECT downloaded_bytes FROM canvas_sync_resources WHERE id=$1',[media.id])).downloaded_bytes)===0) {
    const candidate=await one("SELECT * FROM canvas_sync_resources WHERE stage='index' AND index_offset>=64 LIMIT 1")
    if(candidate && !interrupted){failEmbedding=true;interrupted=true}
    await processCanvasQueueStep('csj-fixture')
    await query("UPDATE canvas_sync_jobs SET run_after=now() WHERE id='csj-fixture'")
  }
  assert.equal(Number((await one('SELECT downloaded_bytes FROM canvas_sync_resources WHERE id=$1',[media.id])).downloaded_bytes),8*1024*1024)
  assert.equal((await one("SELECT count(*) AS n FROM editorial_source_assets WHERE media_type='video/mp4'")).n,'0')
  failDownload=true
  await processCanvasQueueStep('csj-fixture')
  await query("UPDATE canvas_sync_jobs SET run_after=now() WHERE id='csj-fixture'")
  await processCanvasQueueStep('csj-fixture')
  const saved=await one("SELECT * FROM editorial_source_assets WHERE media_type='video/mp4'")
  assert.equal(saved.is_complete,true);assert.equal(Number(saved.byte_size),file.length);assert.equal(saved.metadata.localObjectKey,undefined)
  const bytes=Buffer.concat((await query('SELECT data FROM editorial_source_asset_chunks WHERE asset_id=$1 ORDER BY chunk_index',[saved.id])).map(row=>row.data))
  assert.ok(bytes.equals(file));assert.equal(downloads,3)
  // Lease fencing: a second delivery cannot take a live job; an expired claim is recoverable.
  await query("UPDATE canvas_sync_jobs SET lease_token='held',heartbeat_at=now() WHERE id='csj-fixture'")
  assert.equal((await processCanvasQueueStep('csj-fixture')).again,false)
  await query("UPDATE canvas_sync_jobs SET heartbeat_at=now()-interval '6 minutes' WHERE id='csj-fixture'")
  await processCanvasQueueStep('csj-fixture')
  for(let i=0;i<100;i++){
    const candidate=await one("SELECT * FROM canvas_sync_resources WHERE stage='index' AND index_offset>=64 LIMIT 1")
    if(candidate && !interrupted){ failEmbedding=true;interrupted=true }
    const result=await processCanvasQueueStep('csj-fixture')
    await query("UPDATE canvas_sync_jobs SET run_after=now() WHERE id='csj-fixture'")
    if(!result.again)break
  }
  assert.equal((await one("SELECT status FROM canvas_sync_jobs WHERE id='csj-fixture'")).status,'completed')
  assert.equal(interrupted,true)
  const total=await one('SELECT count(*) n FROM editorial_source_retrieval_chunks')
  assert.ok(Number(total.n)>64)
  await processCanvasQueueStep('csj-fixture')
  assert.equal((await one('SELECT count(*) n FROM editorial_source_retrieval_chunks')).n,total.n)
  // Recurring refresh reuses versioned files and identical HTML. Changed or
  // unversioned files must still download; size alone is not version evidence.
  await query("INSERT INTO canvas_sync_jobs(id,user_id,origin,binding_id,job_type,payload) VALUES('csj-refresh','fixture','https://canvas.fixture','binding','course','{\"scheduled\":true}')")
  for(let i=0;i<10;i++){ const result=await processCanvasQueueStep('csj-refresh'); if(!result.again)break }
  assert.equal((await one("SELECT status FROM canvas_sync_jobs WHERE id='csj-refresh'")).status,'completed')
  assert.equal(downloads,3)
  assert.equal((await one('SELECT count(*) n FROM editorial_source_retrieval_chunks')).n,total.n)
  for(const [id,version] of [['csj-changed','2026-09-02T00:00:00Z'],['csj-unversioned',undefined]]) {
    fileVersion=version
    await query("INSERT INTO canvas_sync_jobs(id,user_id,origin,binding_id,job_type) VALUES($1,'fixture','https://canvas.fixture','binding','course')",[id])
    await processCanvasQueueStep(id)
    assert.equal((await one("SELECT stage FROM canvas_sync_resources WHERE job_id=$1 AND payload->>'fileId'='7'",[id])).stage,'download')
    await query("UPDATE canvas_sync_jobs SET status='cancelled' WHERE id=$1",[id])
  }
  fileVersion='2026-09-01T00:00:00Z'
  const beforeRetryDownloads=downloads
  // A student retry reuses saved originals and finished indexes. Stop prevents further writes.
  const retry=await controlCanvasSyncJob({accountId:'fixture',jobId:'csj-fixture',action:'retry',database:statement})
  await processCanvasQueueStep(retry.jobId)
  assert.equal(downloads,beforeRetryDownloads)
  assert.equal((await one('SELECT count(*) n FROM editorial_source_retrieval_chunks')).n,total.n)
  const stopped=await controlCanvasSyncJob({accountId:'fixture',jobId:retry.jobId,action:'retry',database:statement})
  await controlCanvasSyncJob({accountId:'fixture',jobId:stopped.jobId,action:'stop',database:statement})
  assert.equal((await processCanvasQueueStep(stopped.jobId)).again,false)
  await query("UPDATE canvas_corpus_access SET sync_paused=false WHERE user_id='fixture'")
  await query("INSERT INTO canvas_sync_jobs(id,user_id,origin,binding_id,job_type,queue_sent_at) VALUES('csj-expired-message','fixture','https://canvas.fixture','binding','course',now()-interval '8 days')")
  assert.ok((await dispatchCanvasQueue()).includes('csj-expired-message'))
  // Three hard terminations leave persisted attempts, even with no catch block.
  // The exhausted resource is isolated and another resource still publishes.
  await query("INSERT INTO canvas_sync_checkpoints(job_id,key,value) VALUES('csj-expired-message','inventory','{}')")
  await query(`INSERT INTO canvas_sync_resources(id,job_id,source_path,payload,stage,asset_id,failures)
    SELECT 'fatal-fixture','csj-expired-message','a-fatal.txt','{}','index',r.asset_id,3
    FROM canvas_sync_resources r JOIN editorial_source_assets a ON a.id=r.asset_id
    WHERE r.stage='complete' AND length(a.extracted_text)>0 ORDER BY length(a.extracted_text) LIMIT 1`)
  await query(`INSERT INTO canvas_sync_resources(id,job_id,source_path,payload,stage,asset_id,failures)
    SELECT 'healthy-fixture','csj-expired-message','z-healthy.txt','{}','index',asset_id,0 FROM canvas_sync_resources WHERE id='fatal-fixture'`)
  await processCanvasQueueStep('csj-expired-message')
  assert.equal((await one("SELECT stage FROM canvas_sync_resources WHERE id='fatal-fixture'")).stage,'failed')
  for(let i=0;i<10;i++) {
    await processCanvasQueueStep('csj-expired-message')
    if((await one("SELECT stage FROM canvas_sync_resources WHERE id='healthy-fixture'")).stage==='complete') break
  }
  assert.equal((await one("SELECT stage FROM canvas_sync_resources WHERE id='healthy-fixture'")).stage,'complete')
  const {retrieveCanvasCorpus,readCanvasSource}=await import('../../lib/retrieval-store.mjs')
  const {withRequestContext}=await import('../../lib/request-context.mjs')
  await query("UPDATE canvas_source_snapshots SET resource_type='readings' WHERE binding_id='binding'")
  await query("UPDATE editorial_source_retrieval_chunks SET content='IMWUT Paper list: 17 MindScape Study; 9 CurvFed; 13 Domain Generalization' WHERE id=(SELECT id FROM editorial_source_retrieval_chunks ORDER BY id DESC LIMIT 1)")
  await withRequestContext({userId:'fixture'},async()=>{
    const matches=await retrieveCanvasCorpus({query:'paper list',courseCode:'BCS2120',sourceType:'materials',database:statement})
    assert.ok(matches.some(row=>row.content.includes('MindScape Study')))
    assert.ok(matches.every(row=>row.score<=2/61+Number.EPSILON), 'a duplicate source path must not add another rank vote')
    const hit=matches.find(row=>row.content.includes('MindScape Study'))
    const page=await readCanvasSource({assetId:hit.assetId,courseCode:'BCS2120',database:statement})
    assert.equal(page.chunks.length,12)
    assert.equal(page.nextOffset,12)
    assert.equal((await readCanvasSource({assetId:hit.assetId,courseCode:'BCS9999',database:statement})).chunks.length,0)
    await withRequestContext({userId:'another-student'},async()=>{
      assert.equal((await readCanvasSource({assetId:hit.assetId,courseCode:'BCS2120',database:statement})).chunks.length,0)
      assert.equal((await retrieveCanvasCorpus({query:'paper list',courseCode:'BCS2120',sourceType:'materials',database:statement})).length,0)
    })
  })
  // Current-edition policy is per student, refreshes at most once per interval,
  // and does not resume paused collection or remove old edition access.
  const origin='https://policy.fixture',accountId='policy-student'
  await query("INSERT INTO canvas_corpus_permissions(user_id,origin,collection_enabled) VALUES($1,$2,true)",[accountId,origin])
  await query("INSERT INTO academic_programmes(user_id,id,is_active) VALUES($1,'programme',true)",[accountId])
  const courses=[{id:'101',courseCode:'BCS2120',name:'AI 2025-2026-100-BCS2120',current:true},{id:'102',courseCode:'BCS2120',name:'AI 2026-2027-100-BCS2120',current:true},{id:'103',courseCode:'BCS2140',name:'OS 2026-2027-200-BCS2140',current:true}]
  await observeCanvasCorpusCourses({accountId,origin,courses,explicit:true})
  await query("UPDATE canvas_sync_jobs SET status='cancelled' WHERE user_id=$1",[accountId])
  await query("UPDATE canvas_course_bindings SET last_synced_at=now(),next_sync_at=now()+interval '6 hours' WHERE origin=$1",[origin])
  await observeCanvasCorpusCourses({accountId,origin,courses,automatic:true,refreshPolicy:true,timeContext:{academicYear:'2026-2027',periodNumber:1}})
  await query("UPDATE canvas_sync_jobs SET status='cancelled' WHERE user_id=$1",[accountId])
  const access=await query("SELECT b.canvas_course_id,a.auto_refresh FROM canvas_corpus_access a JOIN canvas_course_bindings b ON b.id=a.binding_id WHERE a.user_id=$1 ORDER BY b.canvas_course_id",[accountId])
  assert.deepEqual(access,[{canvas_course_id:'101',auto_refresh:false},{canvas_course_id:'102',auto_refresh:true},{canvas_course_id:'103',auto_refresh:false}])
  await query(`INSERT INTO canvas_priority_scans(id,binding_id,user_id,evidence_hash,status,course_profile)
    SELECT concat('scan-',binding_id),binding_id,user_id,'fixture','confirmed',$2::jsonb FROM canvas_corpus_access WHERE user_id=$1`,[accountId,JSON.stringify({priorityExtractionVersion:priorities.PRIORITY_EXTRACTION_VERSION})])
  const {scheduleDueRefreshes}=await import('../../lib/canvas-corpus-worker.mjs')
  await query("UPDATE canvas_corpus_access SET sync_paused=true WHERE user_id=$1 AND auto_refresh=true",[accountId])
  await scheduleDueRefreshes()
  assert.equal((await one("SELECT count(*) n FROM canvas_sync_jobs WHERE user_id=$1 AND job_type='course' AND status='pending'",[accountId])).n,'0')
  await query("UPDATE canvas_corpus_access SET sync_paused=false WHERE user_id=$1",[accountId])
  await scheduleDueRefreshes();await scheduleDueRefreshes()
  await observeCanvasCorpusCourses({accountId,origin,courses,automatic:true,refreshPolicy:true,timeContext:{academicYear:'2026-2027',periodNumber:1}})
  const scheduled=await query("SELECT b.canvas_course_id FROM canvas_sync_jobs j JOIN canvas_course_bindings b ON b.id=j.binding_id WHERE j.user_id=$1 AND j.status='pending'",[accountId])
  assert.deepEqual(scheduled,[{canvas_course_id:'102'}])
  assert.equal((await one("SELECT count(*) n FROM canvas_sync_jobs WHERE user_id=$1 AND job_type='catalog' AND status='pending'",[accountId])).n,'1')
  await query("UPDATE canvas_sync_jobs SET status='completed',finished_at=now() WHERE user_id=$1 AND status='pending'",[accountId])
  await scheduleDueRefreshes()
  await observeCanvasCorpusCourses({accountId,origin,courses,automatic:true,refreshPolicy:true,timeContext:{academicYear:'2026-2027',periodNumber:1}})
  assert.equal((await one("SELECT count(*) n FROM canvas_sync_jobs WHERE user_id=$1 AND status='pending'",[accountId])).n,'0')
  await query("UPDATE canvas_sync_jobs SET finished_at=now()-interval '7 hours',created_at=now()-interval '7 hours' WHERE user_id=$1",[accountId])
  await query("UPDATE canvas_corpus_permissions SET collection_enabled=false WHERE user_id=$1",[accountId])
  await scheduleDueRefreshes()
  assert.equal((await one("SELECT count(*) n FROM canvas_sync_jobs WHERE user_id=$1 AND status='pending'",[accountId])).n,'0')
  // Settings never cancel manual work, never change another account, and fence
  // automatic notifications after opt-out/completion.
  await query("UPDATE canvas_corpus_permissions SET collection_enabled=true WHERE user_id=$1",[accountId])
  const settings={enabled:true,updatesMinutes:15,materialsMinutes:60,studyStatus:'studying'}
  await setCanvasRefreshSettings({accountId,origin,settings})
  const preferences=await one("SELECT refresh_updates_minutes,refresh_materials_minutes FROM canvas_corpus_permissions WHERE user_id=$1",[accountId])
  assert.deepEqual(preferences,{refresh_updates_minutes:15,refresh_materials_minutes:60})
  await query("INSERT INTO canvas_sync_jobs(id,user_id,origin,job_type,payload) VALUES('manual-settings',$1,$2,'course','{}')",[accountId,origin])
  await setCanvasRefreshSettings({accountId,origin,settings:{...settings,enabled:false}})
  await scheduleDueRefreshes()
  assert.equal((await one("SELECT count(*) n FROM canvas_sync_jobs WHERE user_id=$1 AND status IN ('pending','running') AND payload->>'scheduled'='true'",[accountId])).n,'0')
  assert.equal((await one("SELECT status FROM canvas_sync_jobs WHERE id='manual-settings'")).status,'pending')
  assert.equal((await one("SELECT refresh_enabled FROM canvas_corpus_permissions WHERE user_id='fixture'")).refresh_enabled,true)
  await setCanvasRefreshSettings({accountId,origin,settings:{...settings,studyStatus:'completed'}})
  await scheduleDueRefreshes()
  assert.equal((await one("SELECT count(*) n FROM canvas_sync_jobs WHERE user_id=$1 AND status='pending' AND payload->>'scheduled'='true'",[accountId])).n,'0')
  await setCanvasRefreshSettings({accountId,origin,settings})
  assert.equal((await one("SELECT count(*) n FROM canvas_sync_jobs WHERE user_id=$1 AND status='pending' AND job_type='catalog'",[accountId])).n,'1')
  // A key mismatch is terminal until a compatible worker can read the connection.
  await query("INSERT INTO canvas_corpus_permissions(user_id,origin,collection_enabled) VALUES('credential-student','https://credentials.fixture',true)")
  await query("INSERT INTO academic_programmes(user_id,id,is_active) VALUES('credential-student','programme',true)")
  await query("INSERT INTO canvas_sync_jobs(id,user_id,origin,job_type) VALUES('csj-credentials','credential-student','https://credentials.fixture','catalog')")
  credentialsBlocked=true
  assert.equal((await processCanvasQueueStep('csj-credentials')).again,false)
  const blocked=await one("SELECT status,attempts,payload,error FROM canvas_sync_jobs WHERE id='csj-credentials'")
  assert.equal(blocked.status,'failed');assert.equal(blocked.attempts,1)
  assert.equal(blocked.payload.blockedReason,'canvas-connection')
  assert.match(blocked.error,/same encryption key/)
  assert.match((await one("SELECT message FROM canvas_sync_events WHERE job_id='csj-credentials' ORDER BY id DESC LIMIT 1")).message,/Automatic retries are paused/)
  await dispatchCanvasQueue()
  assert.equal((await one("SELECT status FROM canvas_sync_jobs WHERE id='csj-credentials'")).status,'failed')
  assert.equal((await processCanvasQueueStep('csj-credentials')).again,false)
  credentialsBlocked=false
  await dispatchCanvasQueue()
  assert.equal((await one("SELECT status FROM canvas_sync_jobs WHERE id='csj-credentials'")).status,'pending')
  await processCanvasQueueStep('csj-credentials')
  assert.equal((await one("SELECT status FROM canvas_sync_jobs WHERE id='csj-credentials'")).status,'completed')
  // Preview snapshots contain production rows. Only the configured test account
  // may dispatch or acquire leases; automatic schedules must not fan out.
  await query("UPDATE canvas_sync_jobs SET status='cancelled',lease_token=null WHERE user_id='fixture' AND status IN ('pending','running')")
  await query("INSERT INTO canvas_sync_jobs(id,user_id,origin,binding_id,job_type) VALUES('csj-preview-allowed','fixture','https://canvas.fixture','binding','course')")
  await query("INSERT INTO canvas_sync_jobs(id,user_id,origin,job_type) VALUES('csj-preview-denied','credential-student','https://credentials.fixture','catalog')")
  process.env.VERCEL_ENV='preview'
  process.env.DATABASE_URL='postgres://test:fixture@preview.test/db'
  process.env.WICKER_PREVIEW_DATABASE_HOST='preview.test'
  process.env.WICKER_PREVIEW_WORKER_USERS='fixture'
  const jobsBefore=(await one('SELECT count(*) n FROM canvas_sync_jobs')).n
  const previewIds=await dispatchCanvasQueue()
  assert.ok(previewIds.includes('csj-preview-allowed'))
  assert.ok(!previewIds.includes('csj-preview-denied'))
  assert.equal((await one('SELECT count(*) n FROM canvas_sync_jobs')).n,jobsBefore)
  assert.equal((await processCanvasQueueStep('csj-preview-denied')).again,false)
  assert.equal((await one("SELECT attempts FROM canvas_sync_jobs WHERE id='csj-preview-denied'")).attempts,0)
  await processCanvasQueueStep('csj-preview-allowed')
  assert.equal((await one("SELECT attempts FROM canvas_sync_jobs WHERE id='csj-preview-allowed'")).attempts,1)
  process.env.DATABASE_URL='postgres://test:fixture@production.test/db'
  assert.deepEqual(await dispatchCanvasQueue(),[])
  assert.equal((await processCanvasQueueStep('csj-preview-allowed')).disabled,true)
  console.log(JSON.stringify({ok:true,checks:['byte-range recovery','no premature completeness','byte-exact durable video','duplicate delivery','expired lease','embedding batch recovery','retry reuse','unchanged refresh reuse','changed and unversioned refresh','latest current-period selection','pause and opt-out respected','refresh cadence and duplicate dispatch','stop fencing','expired-message recovery','hard-timeout isolation','materials retrieval across classifications','source pagination and access isolation','preview database guard','preview account isolation','preview manual-only scheduling'],downloads,embeddingCalls,passages:Number(total.n)}))
}finally{globalThis.fetch=originalFetch;await pool.end();mock.restoreAll()}
