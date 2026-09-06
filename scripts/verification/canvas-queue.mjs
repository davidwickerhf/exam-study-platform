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
  try {await client.query('BEGIN');const results=[];for(const q of queries) results.push((await client.query(q.text,q.values)).rows);await client.query('COMMIT');return results}
  catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
mock.module('../../lib/db.mjs',{namedExports:{...db,sql:statement}})
const connections=await import('../../lib/canvas-connections.mjs')
mock.module('../../lib/canvas-connections.mjs',{namedExports:{...connections,canvasAccessTokenForUser:async()=>({token:'fixture-token'})}})
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
const {controlCanvasSyncJob}=await import('../../lib/course-corpus.mjs')
const file=Buffer.alloc(9*1024*1024+13,97)
let downloads=0
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
  if(url.pathname.endsWith('/files/7'))return Response.json({id:7,url:'https://files.fixture/7',size:file.length})
  if(url.pathname==='/api/v1/users/self/profile')return Response.json({id:1})
  if(url.pathname==='/api/v1/courses/8')return Response.json({id:8,name:'Fixture',syllabus_body:'Weekly attendance. '.repeat(12000)})
  if(url.pathname==='/api/v1/courses/8/files')return Response.json([{id:7,url:'https://files.fixture/7',filename:'lecture.mp4',content_type:'video/mp4',size:file.length}])
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
  // A student retry reuses saved originals and finished indexes. Stop prevents further writes.
  const retry=await controlCanvasSyncJob({accountId:'fixture',jobId:'csj-fixture',action:'retry',database:statement})
  await processCanvasQueueStep(retry.jobId)
  assert.equal(downloads,3)
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
  console.log(JSON.stringify({ok:true,checks:['byte-range recovery','no premature completeness','byte-exact durable video','duplicate delivery','expired lease','embedding batch recovery','retry reuse','stop fencing','expired-message recovery','hard-timeout isolation'],downloads,embeddingCalls,passages:Number(total.n)}))
}finally{globalThis.fetch=originalFetch;await pool.end();mock.restoreAll()}
