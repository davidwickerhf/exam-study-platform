import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, open, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { sql } from './db.mjs'
import { canvasAccessTokenForUser } from './canvas-connections.mjs'
import { createCanvasApi, importCanvasCourse, CANVAS_IMPORT_LIMITS } from './canvas-course-import.mjs'
import { extracted, retrievalRecords, MEDIA_TYPES, sourceTypeForPath, runCatalog, scheduleDueRefreshes } from './canvas-corpus-worker.mjs'
import { createCanvasSyncLogger, safeSyncEvent } from './canvas-sync-log.mjs'
import { embedTexts, embeddingConfiguration } from './embeddings.mjs'
import { scanCanvasPriorityEvidence } from './priority-evidence.mjs'
import { promoteReviewedProgrammePolicyAsset } from './programme-policy-sources.mjs'
import { CanvasCheckpointYield, resourceId, validateDownloadRange } from './canvas-queue-protocol.mjs'

const CHUNK = 512 * 1024
const RANGE = 8 * 1024 * 1024
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = value => JSON.stringify(value)

// Lock and assert the parent lease in the SAME transaction as every mutation.
// A stopped/superseded worker cannot publish bytes, checkpoints or index rows.
function fenced(job, queries) {
  return sql.transaction([
    sql`SELECT 1 / count(*)::int FROM (SELECT id FROM canvas_sync_jobs WHERE id=${job.id}
      AND lease_token=${job.lease_token} AND status='running' FOR UPDATE) held`,
    ...queries
  ])
}
async function checkpoint(job, key, value) {
  await fenced(job, [sql`INSERT INTO canvas_sync_checkpoints(job_id,key,value) VALUES(${job.id},${key},${json(value)}::jsonb)
    ON CONFLICT(job_id,key) DO UPDATE SET value=excluded.value`])
}

// The SQL inventory is also an outbox. If publishing fails, or a queue message
// expires during an outage, the next sweep republishes unfinished jobs.
export async function dispatchCanvasQueue() {
  if (!sql || process.env.VERCEL_ENV === 'preview') return []
  await scheduleDueRefreshes()
  const rows = await sql`SELECT j.id FROM canvas_sync_jobs j
    JOIN canvas_corpus_permissions p ON p.user_id=j.user_id AND p.origin=j.origin AND p.collection_enabled=true
    WHERE j.status IN ('pending','running') AND j.run_after<=now()
      AND (j.lease_token IS NULL OR coalesce(j.heartbeat_at,j.started_at)<now()-interval '5 minutes')
      AND (j.queue_sent_at IS NULL OR j.queue_sent_at<now()-interval '5 minutes')
      AND NOT EXISTS(SELECT 1 FROM canvas_corpus_access a WHERE a.user_id=j.user_id AND a.binding_id=j.binding_id AND a.sync_paused=true)
    ORDER BY j.priority DESC,j.created_at LIMIT 50`
  return rows.map(row => row.id)
}
export async function noteCanvasQueueSent(ids) {
  if (ids.length) await sql`UPDATE canvas_sync_jobs SET queue_sent_at=now() WHERE id=ANY(${ids}::text[])`
}

async function restoreRetry(job) {
  if (!job.payload?.retryOf) return
  const [old] = await sql`SELECT id FROM canvas_sync_jobs WHERE id=${job.payload.retryOf} AND user_id=${job.user_id} AND binding_id=${job.binding_id}`
  if (!old) return
  const [done] = await sql`SELECT key FROM canvas_sync_checkpoints WHERE job_id=${job.id} AND key='retry-restored'`
  if (done) return
  await fenced(job, [
    sql`INSERT INTO canvas_sync_checkpoints(job_id,key,value) SELECT ${job.id},key,value FROM canvas_sync_checkpoints
      WHERE job_id=${old.id} AND key NOT IN ('rules','retry-restored','inventory') AND coalesce(value->>'status','') NOT IN ('403','404') ON CONFLICT DO NOTHING`,
    // Preserve resource IDs through a separate deterministic mapping for the new job.
    sql`INSERT INTO canvas_sync_resources(id,job_id,source_path,payload,stage,asset_id,downloaded_bytes,total_bytes,etag,index_offset)
      SELECT concat(${job.id},':',md5(source_path)),${job.id},source_path,payload,
        CASE WHEN stage='failed' THEN CASE WHEN asset_id IS NULL THEN 'download' ELSE 'extract' END ELSE stage END,
        asset_id,downloaded_bytes,total_bytes,etag,CASE WHEN stage='failed' THEN 0 ELSE index_offset END
      FROM canvas_sync_resources WHERE job_id=${old.id} ON CONFLICT DO NOTHING`,
    sql`INSERT INTO canvas_sync_resource_bytes(resource_id,chunk_index,data)
      SELECT n.id,b.chunk_index,b.data FROM canvas_sync_resource_bytes b JOIN canvas_sync_resources o ON o.id=b.resource_id
      JOIN canvas_sync_resources n ON n.job_id=${job.id} AND n.source_path=o.source_path WHERE o.job_id=${old.id} ON CONFLICT DO NOTHING`,
    sql`INSERT INTO canvas_sync_index_staging(resource_id,ordinal,page_number,chunk_index,content,embedding,embedding_model)
      SELECT n.id,s.ordinal,s.page_number,s.chunk_index,s.content,s.embedding,s.embedding_model FROM canvas_sync_index_staging s
      JOIN canvas_sync_resources o ON o.id=s.resource_id JOIN canvas_sync_resources n ON n.job_id=${job.id} AND n.source_path=o.source_path
      WHERE o.job_id=${old.id} AND o.stage<>'failed' ON CONFLICT DO NOTHING`,
    sql`INSERT INTO canvas_sync_checkpoints(job_id,key,value) VALUES(${job.id},'retry-restored','true') ON CONFLICT DO NOTHING`
  ])
}

async function discover(job, binding, budget) {
  const rows = await sql`SELECT key,value FROM canvas_sync_checkpoints WHERE job_id=${job.id}`
  const cache = new Map(rows.map(row => [row.key,row.value]))
  if (cache.has('inventory')) return true
  const resources = await sql`SELECT source_path FROM canvas_sync_resources WHERE job_id=${job.id}`
  const known = new Set(resources.map(row => row.source_path))
  const { token } = await canvasAccessTokenForUser({ accountId: job.user_id, canvasUrl: job.origin })
  let operations = 0
  const check = () => { budget(); if (++operations > 100) throw new CanvasCheckpointYield() }
  const put = async (path, payload) => {
    if (known.has(path)) return
    check()
    await fenced(job, [sql`INSERT INTO canvas_sync_resources(id,job_id,source_path,payload)
      VALUES(${resourceId(job.id,path)},${job.id},${path},${json(payload)}::jsonb) ON CONFLICT DO NOTHING`])
    known.add(path)
  }
  job.log({ stage:'discovery',message:'Discovering resources; each result is saved before continuing.' })
  await importCanvasCourse({
    courseUrl:`${job.origin}/courses/${binding.canvas_course_id}/modules`, accessToken:token, outputFolder:'/canvas-inventory',
    onProgress: async () => {},
    durable: {
      checkpoint: {
        get: key => cache.get(key), beforeRequest: check,
        set: async (key,value) => { await checkpoint(job,key,value); cache.set(key,value) }
      },
      write: (path,content) => put(path,{ content }),
      file: async (path,detail) => {
        // Store identity/version, never an expiring signed download URL.
        await put(path,{ fileId:String(detail.id), size:detail.size, updatedAt:detail.updated_at, mediaType:detail.content_type })
        return Number(detail.size || 0)
      },
      finish: async summary => {
        const inventory = { course:summary.course, resources:summary.resources.length, skipped:summary.skipped }
        await checkpoint(job,'inventory',inventory)
        for (const item of summary.skipped) job.log({stage:'discovery',level:'warning',message:item.reason,item:item.label})
      }
    }
  })
  return true
}

async function storeDownloadBatch(job, resource, chunks, offset, total, etag) {
  await fenced(job, [
    ...chunks.map(([index,bytes]) => sql`INSERT INTO canvas_sync_resource_bytes(resource_id,chunk_index,data)
      VALUES(${resource.id},${index},${bytes}) ON CONFLICT(resource_id,chunk_index) DO NOTHING`),
    sql`UPDATE canvas_sync_resources SET downloaded_bytes=${offset},total_bytes=${total},etag=${etag},updated_at=now() WHERE id=${resource.id}`
  ])
}
async function download(job, binding, resource, budget, signal) {
  if (resource.payload.content !== undefined) {
    const bytes = Buffer.from(resource.payload.content)
    const chunks = []
    for (let at=0;at<bytes.length;at+=CHUNK) chunks.push([at/CHUNK,bytes.subarray(at,at+CHUNK)])
    await storeDownloadBatch(job,resource,chunks,bytes.length,bytes.length,null)
    resource.downloaded_bytes=bytes.length; resource.total_bytes=bytes.length
  } else if (resource.total_bytes == null || Number(resource.downloaded_bytes)<Number(resource.total_bytes)) {
    const { token } = await canvasAccessTokenForUser({accountId:job.user_id,canvasUrl:job.origin})
    const api = createCanvasApi({origin:job.origin,accessToken:token})
    const detail = await api.getJson(`/api/v1/courses/${binding.canvas_course_id}/files/${encodeURIComponent(resource.payload.fileId)}`)
    const url = new URL(detail.url)
    if (url.protocol !== 'https:') throw new Error('Canvas returned an invalid download address.')
    const offset=Number(resource.downloaded_bytes)
    const headers={Range:`bytes=${offset}-${offset+RANGE-1}`, ...(resource.etag ? {'If-Range':resource.etag}: {})}
    let response=await fetch(url,{headers,signal})
    if (response.status===401 && url.origin===job.origin) response=await fetch(url,{headers:{...headers,Authorization:`Bearer ${token}`},signal})
    let range
    try { range=validateDownloadRange(response,offset,resource.total_bytes,resource.etag) }
    catch(error) {
      await response.body?.cancel()
      if (/changed during download/.test(error.message)) await fenced(job,[
        sql`DELETE FROM canvas_sync_resource_bytes WHERE resource_id=${resource.id}`,
        sql`UPDATE canvas_sync_resources SET downloaded_bytes=0,total_bytes=null,etag=null WHERE id=${resource.id}`
      ])
      throw error
    }
    if(range.total>CANVAS_IMPORT_LIMITS.maxFileBytes) { await response.body?.cancel(); throw new Error('File exceeds the 1 GB collection limit; original remains on Canvas.') }
    job.log({stage:'download',message:'Saving original file.',item:resource.source_path,completed:offset,total:range.total})
    let cursor=range.start, buffer=Buffer.alloc(0), batch=[], saved=offset
    const reader=response.body.getReader()
    const flush=async()=>{
      if(!batch.length) return
      await storeDownloadBatch(job,resource,batch,saved,range.total,range.etag)
      batch=[]
    }
    const consume=async(bytes)=>{
      if(cursor<offset) {
        const [old]=await sql`SELECT data FROM canvas_sync_resource_bytes WHERE resource_id=${resource.id} AND chunk_index=${cursor/CHUNK}`
        if(!old || !Buffer.from(old.data).equals(bytes)) throw new Error('Canvas file changed during download; retry to collect its new version.')
      } else { batch.push([cursor/CHUNK,bytes]); saved=cursor+bytes.length }
      cursor+=bytes.length
      if(batch.length===16) {await flush(); budget()}
    }
    try {
      while(true) {
        const {done,value}=await reader.read()
        if(done) break
        buffer=Buffer.concat([buffer,Buffer.from(value)])
        if(cursor+buffer.length>range.end) throw new Error('Canvas sent more bytes than its declared range.')
        while(buffer.length>=CHUNK) { const part=buffer.subarray(0,CHUNK); buffer=buffer.subarray(CHUNK); await consume(part) }
      }
      if(buffer.length) {
        if(cursor+buffer.length!==range.total) throw new Error('Canvas returned an incomplete byte range.')
        await consume(buffer)
      }
      if(cursor!==range.end) throw new Error('Canvas download ended before all declared bytes arrived.')
      await flush()
    } catch (error) {
      if (/changed during download/.test(error.message)) await fenced(job,[
        sql`DELETE FROM canvas_sync_resource_bytes WHERE resource_id=${resource.id}`,
        sql`UPDATE canvas_sync_resources SET downloaded_bytes=0,total_bytes=null,etag=null WHERE id=${resource.id}`
      ])
      throw error
    } finally { await reader.cancel().catch(()=>{}); reader.releaseLock() }
    resource.downloaded_bytes=saved;resource.total_bytes=range.total
    if(saved<range.total) return
  }
  // Verify the entire saved original, including every checkpointed chunk, before
  // publishing an asset. Promotion and completeness happen atomically in SQL.
  budget()
  const digest=createHash('sha256')
  let bytes=0, count=0
  for(let first=0;first<Math.ceil(Number(resource.total_bytes)/CHUNK);first+=32) {
    const rows=await sql`SELECT chunk_index,data FROM canvas_sync_resource_bytes WHERE resource_id=${resource.id}
      AND chunk_index>=${first} AND chunk_index<${first+32} ORDER BY chunk_index`
    for(const row of rows) {
      if(Number(row.chunk_index)!==count++) throw new Error('Saved original has a missing byte chunk.')
      const part=Buffer.from(row.data);bytes+=part.length;digest.update(part)
    }
  }
  if(bytes!==Number(resource.total_bytes) || !bytes) throw new Error('Saved original did not match its declared size.')
  const sha=digest.digest('hex'),assetId=`esa-${sha.slice(0,32)}`
  const mediaType=resource.payload.mediaType || MEDIA_TYPES.get(extname(resource.source_path).toLowerCase()) || 'application/octet-stream'
  await fenced(job,[
    sql`INSERT INTO editorial_source_assets(id,sha256,filename,media_type,byte_size,source_kind,expected_chunks,is_complete,extraction_status,metadata,created_by)
      VALUES(${assetId},${sha},${resource.source_path.split('/').at(-1)},${mediaType},${bytes},'file',${count},false,'pending','{"source":"canvas-auto-sync"}',${job.user_id})
      ON CONFLICT(sha256) DO NOTHING`,
    sql`INSERT INTO editorial_source_asset_chunks(asset_id,chunk_index,data)
      SELECT a.id,b.chunk_index,b.data FROM canvas_sync_resource_bytes b CROSS JOIN editorial_source_assets a
      WHERE b.resource_id=${resource.id} AND a.sha256=${sha} ON CONFLICT(asset_id,chunk_index) DO UPDATE SET data=excluded.data`,
    sql`UPDATE editorial_source_assets SET is_complete=true,expected_chunks=${count},metadata=metadata-'localObjectKey',updated_at=now() WHERE sha256=${sha}`,
    sql`UPDATE canvas_sync_resources SET asset_id=(SELECT id FROM editorial_source_assets WHERE sha256=${sha}),stage='extract',failures=0,updated_at=now() WHERE id=${resource.id}`,
    sql`DELETE FROM canvas_sync_resource_bytes WHERE resource_id=${resource.id}`
  ])
}

async function extractResource(job,resource,budget) {
  const [asset]=await sql`SELECT * FROM editorial_source_assets WHERE id=${resource.asset_id} AND is_complete=true`
  if(!asset) throw new Error('The original file is not yet complete.')
  let result
  if(asset.extraction_status==='complete') result={text:asset.extracted_text,pages:asset.extracted_pages,status:'complete'}
  else if (!/\.(pdf|docx|pptx|xlsx|ipynb|zip|md|txt|csv|tex|py|r|m|html|htm)$/i.test(resource.source_path)) {
    result={text:null,pages:null,status:'unsupported',error:null}
    await fenced(job,[sql`UPDATE editorial_source_assets SET extraction_status='unsupported' WHERE id=${asset.id}`])
  } else {
    const root=await mkdtemp(join(tmpdir(),'canvas-text-'))
    const path=join(root,'original')
    try {
      const file=await open(path,'w')
      try {
        for(let first=0;first<Number(asset.expected_chunks);first+=32) {
          budget()
          const chunks=await sql`SELECT data FROM editorial_source_asset_chunks WHERE asset_id=${asset.id}
            AND chunk_index>=${first} AND chunk_index<${first+32} ORDER BY chunk_index`
          for(const chunk of chunks) await file.write(Buffer.from(chunk.data))
        }
      } finally {await file.close()}
      // Binary formats without a text extractor need no copy into a large JS buffer.
      const ext=extname(resource.source_path).toLowerCase()
      result=/\.(pdf|docx|pptx|xlsx|ipynb|zip|md|txt|csv|tex|py|r|m|html|htm)$/.test(ext)
        ? await extracted(await readFile(path),resource.source_path)
        : {text:null,pages:null,status:'unsupported',error:null}
    } finally {await rm(root,{recursive:true,force:true})}
    await fenced(job,[sql`UPDATE editorial_source_assets SET extracted_text=${result.text},extracted_pages=${result.pages?json(result.pages):null}::jsonb,
      content_sha256=${result.text?hash(result.text):null},extraction_status=${result.status},extraction_error=${result.error || null},updated_at=now() WHERE id=${asset.id}`])
  }
  if(result.status==='failed') throw new Error(result.error || 'Text extraction failed; the original is safely stored.')
  job.log({stage:'extraction',message:result.status==='unsupported'?'Original safely stored. This format has no searchable text.':'Document text saved.',item:resource.source_path})
  await fenced(job,[sql`UPDATE canvas_sync_resources SET stage='index',failures=0,updated_at=now() WHERE id=${resource.id}`])
}

async function indexResource(job,binding,resource) {
  const [asset]=await sql`SELECT * FROM editorial_source_assets WHERE id=${resource.asset_id}`
  const records=retrievalRecords({text:asset.extracted_text,pages:asset.extracted_pages})
  const offset=Number(resource.index_offset),batch=records.slice(offset,offset+64)
  const embedding=embeddingConfiguration()
  const vectors=embedding.configured && batch.length ? await embedTexts(batch.map(row=>row.content)) : batch.map(()=>null)
  if(batch.length) await fenced(job,[
    ...batch.map((row,i)=>sql`INSERT INTO canvas_sync_index_staging(resource_id,ordinal,page_number,chunk_index,content,embedding,embedding_model)
      VALUES(${resource.id},${offset+i},${row.page},${row.chunkIndex},${row.content},${vectors[i]?`[${vectors[i].join(',')}]`:null}::vector,${vectors[i]?embedding.model:null})
      ON CONFLICT(resource_id,ordinal) DO UPDATE SET content=excluded.content,embedding=excluded.embedding,embedding_model=excluded.embedding_model`),
    sql`UPDATE canvas_sync_resources SET index_offset=${offset+batch.length},failures=0,updated_at=now() WHERE id=${resource.id}`
  ])
  job.log({stage:'indexing',message:'Search passages saved.',item:resource.source_path,completed:offset+batch.length,total:records.length})
  if(offset+batch.length<records.length) return
  const [permission]=await sql`SELECT sharing_mode FROM canvas_corpus_permissions WHERE user_id=${job.user_id} AND origin=${job.origin} AND collection_enabled=true`
  if(!permission) throw new Error('Canvas collection permission was revoked.')
  const contribution=`ec-${hash(`${binding.edition_id}:${asset.id}:${job.user_id}:${resource.source_path}`).slice(0,32)}`
  const snapshot=`css-${hash(`${binding.id}:${resource.source_path}:${asset.sha256}:${job.user_id}`).slice(0,32)}`
  await fenced(job,[
    sql`DELETE FROM editorial_source_retrieval_chunks WHERE edition_id=${binding.edition_id} AND asset_id=${asset.id}`,
    sql`INSERT INTO editorial_source_retrieval_chunks(edition_id,asset_id,page_number,chunk_index,content,metadata,embedding,embedding_model,embedded_at)
      SELECT ${binding.edition_id},${asset.id},page_number,chunk_index,content,${json({sourcePath:resource.source_path})}::jsonb,embedding,embedding_model,
        CASE WHEN embedding IS NULL THEN null ELSE now() END FROM canvas_sync_index_staging WHERE resource_id=${resource.id} ORDER BY ordinal`,
    sql`INSERT INTO editorial_contributions(id,edition_id,asset_id,contributor_user_id,source_path,consent_status,rights_basis)
      VALUES(${contribution},${binding.edition_id},${asset.id},${job.user_id},${resource.source_path},${permission.sharing_mode==='community'?'candidate':'private'},'Canvas collection consent; community publication requires rights review.') ON CONFLICT DO NOTHING`,
    sql`UPDATE canvas_source_snapshots SET retired_at=now() WHERE binding_id=${binding.id} AND contributor_user_id=${job.user_id}
      AND resource_key=${resource.source_path} AND sha256<>${asset.sha256} AND retired_at IS NULL`,
    sql`INSERT INTO canvas_source_snapshots(id,binding_id,asset_id,contribution_id,contributor_user_id,sharing_mode,resource_key,source_path,resource_type,sha256,metadata)
      VALUES(${snapshot},${binding.id},${asset.id},${contribution},${job.user_id},${permission.sharing_mode},${resource.source_path},${resource.source_path},${sourceTypeForPath(resource.source_path)},${asset.sha256},${json({academicYear:binding.academic_year,courseCode:binding.course_code})}::jsonb)
      ON CONFLICT(binding_id,resource_key,sha256,contributor_user_id) DO UPDATE SET last_seen_at=now(),retired_at=null,sharing_mode=excluded.sharing_mode`,
    sql`UPDATE canvas_sync_resources SET stage='complete',error=null,failures=0,updated_at=now() WHERE id=${resource.id}`,
    sql`DELETE FROM canvas_sync_index_staging WHERE resource_id=${resource.id}`
  ])
  await promoteReviewedProgrammePolicyAsset({assetId:asset.id,sha256:asset.sha256,editionId:binding.edition_id})
}

export async function processCanvasQueueStep(jobId) {
  if(!sql || process.env.VERCEL_ENV==='preview') return {again:false,disabled:true}
  const token=randomUUID()
  const [job]=await sql`UPDATE canvas_sync_jobs j SET status='running',lease_token=${token},heartbeat_at=now(),started_at=coalesce(started_at,now()),
      queue_sent_at=null,attempts=greatest(attempts,1),payload=payload || '{"pipeline":"queue-v1"}'::jsonb
    WHERE j.id=${jobId} AND j.status IN ('pending','running') AND j.run_after<=now()
      AND (j.lease_token IS NULL OR coalesce(j.heartbeat_at,j.started_at)<now()-interval '5 minutes')
      AND EXISTS(SELECT 1 FROM canvas_corpus_permissions p WHERE p.user_id=j.user_id AND p.origin=j.origin AND p.collection_enabled=true)
      AND NOT EXISTS(SELECT 1 FROM canvas_corpus_access a WHERE a.user_id=j.user_id AND a.binding_id=j.binding_id AND a.sync_paused=true)
    RETURNING j.*`
  if(!job) return {again:false}
  const logger=createCanvasSyncLogger(job);job.log=logger.record
  const started=Date.now(),signal=AbortSignal.timeout(150_000)
  const budget=()=>{ if(Date.now()-started>110_000) throw new CanvasCheckpointYield() }
  let resource=null,terminal=false
  try {
    await restoreRetry(job)
    if(job.job_type==='catalog') {
      const result=await runCatalog(job,budget)
      await fenced(job,[sql`UPDATE canvas_sync_jobs SET result=${json(result)}::jsonb WHERE id=${job.id}`])
      terminal=true
    } else {
      const [binding]=await sql`SELECT * FROM canvas_course_bindings WHERE id=${job.binding_id}`
      if(!binding) throw new Error('Course edition no longer exists.')
      if(job.payload?.stage!=='priorities') await discover(job,binding,budget)
      const rows=await sql`SELECT * FROM canvas_sync_resources WHERE job_id=${job.id} AND stage NOT IN ('complete','failed')
        ORDER BY CASE stage WHEN 'download' THEN 2 WHEN 'extract' THEN 1 ELSE 0 END,source_path LIMIT 1`
      resource=rows[0]
      if(resource) {
        if(resource.stage==='download') await download(job,binding,resource,budget,signal)
        else if(resource.stage==='extract') await extractResource(job,resource,budget)
        else await indexResource(job,binding,resource)
      } else {
        const [inventory]=await sql`SELECT value FROM canvas_sync_checkpoints WHERE job_id=${job.id} AND key='inventory'`
        const [counts]=await sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE stage='failed')::int AS failed FROM canvas_sync_resources WHERE job_id=${job.id}`
        if(Number(counts.failed)) throw new Error(`${counts.failed} resources need attention. Originals already saved are retained; retry resumes unfinished resources.`)
        const [rules]=await sql`SELECT value FROM canvas_sync_checkpoints WHERE job_id=${job.id} AND key='rules'`
        if(!rules) {
          job.log({stage:'rules',message:'Analysing saved course material and announcements.'})
          const result=await scanCanvasPriorityEvidence({bindingId:binding.id,accountId:job.user_id,force:false,assertActive:budget,onProgress:event=>job.log(event)})
          await checkpoint(job,'rules',{status:result.status,candidates:result.candidates})
        }
        const skipped=inventory?.value?.skipped || []
        const result={files:Number(counts.total),indexed:Number(counts.total),skipped:skipped.length,warnings:skipped,pipeline:'queue-v1'}
        // Missing resources from a partial/changed listing are NEVER auto-retired.
        await fenced(job,[sql`UPDATE canvas_course_bindings SET last_synced_at=now(),next_sync_at=now()+interval '1 day',updated_at=now() WHERE id=${binding.id}`,
          sql`UPDATE canvas_sync_jobs SET result=${json(result)}::jsonb WHERE id=${job.id}`])
        terminal=true
      }
    }
    await logger.finish()
    await fenced(job,[sql`UPDATE canvas_sync_jobs SET status=${terminal?'completed':'running'},lease_token=null,heartbeat_at=now(),
      error=null,finished_at=${terminal?new Date().toISOString():null}::timestamptz,run_after=now() WHERE id=${job.id}`])
    return {again:!terminal}
  } catch(error) {
    const yielding=error?.checkpointYield===true
    const message=safeSyncEvent({stage:'queue',message:error.message}).message
    if(!yielding) job.log({stage:resource?.stage==='download'?'download':resource?.stage==='index'?'indexing':'queue',level:'error',message,item:resource?.source_path})
    await logger.finish()
    const retry=yielding || (resource ? Number(resource.failures)<2 : Number(job.payload?.queueFailures || 0)<2)
    try {
      await fenced(job,[
        ...(resource && !yielding ? [sql`UPDATE canvas_sync_resources SET failures=failures+1,error=${message},stage=CASE WHEN failures>=2 THEN 'failed' ELSE stage END,updated_at=now() WHERE id=${resource.id}`] : []),
        sql`UPDATE canvas_sync_jobs SET lease_token=null,heartbeat_at=now(),error=${yielding?null:message},
          status=${retry || resource?'running':'failed'},finished_at=${retry || resource?null:new Date().toISOString()}::timestamptz,
          payload=payload || ${json({queueFailures:yielding?0:Number(job.payload?.queueFailures || 0)+1})}::jsonb,
          run_after=now()+make_interval(secs=>${yielding?0:30}) WHERE id=${job.id}`
      ])
    } catch { return {again:false} /* cancellation or lease transfer */ }
    return {again:Boolean(retry || resource),delay:yielding?0:30}
  }
}
