import { createHash } from 'node:crypto'
import { sql } from './db.mjs'
import { canvasAccessTokenForUser } from './canvas-connections.mjs'
import { createCanvasApi, htmlRecord } from './canvas-course-import.mjs'
import { announcementRecord, canvasAnnouncementText } from './canvas-hub.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')

// Small, current announcement requests are independent of full file downloads
// and embedding availability. Originals and lexical passages remain inspectable.
export function priorityAnnouncementDocument(row, binding) {
  if (!/^\d+$/.test(String(row.id || '')) || row.published === false) return null
  const announcement = announcementRecord({...row,course_id:binding.canvas_course_id}, {origin:binding.origin})
  if (!announcement.postedAt || new Date(announcement.postedAt).getTime() > Date.now()) return null
  const url = `${binding.origin}/courses/${binding.canvas_course_id}/discussion_topics/${row.id}`
  const context = `${announcement.title}\nPosted: ${announcement.postedAt}\nCourse: ${binding.course_code} · ${binding.academic_year || ''}\nCanvas source: ${url}\n`
  const body = canvasAnnouncementText(announcement)
  if (body.length >= 100000) throw new Error('An announcement exceeds the rule evidence limit; its full text needs review.')
  const html = htmlRecord({title:announcement.title,url,body:announcement.html,details:[['Posted',announcement.postedAt],['Author',announcement.author],['Academic year',binding.academic_year]]})
  const text = context + body
  const passages = []
  for(let offset=0;offset<body.length;offset+=7000) passages.push(context + body.slice(offset,offset+8000))
  if (!passages.length) passages.push(context)
  return {id:String(row.id),html,text,passages,sha:hash(html),path:`course-announcements/discussions/announcement--discussion-${row.id}.html`,title:announcement.title,postedAt:announcement.postedAt,url}
}

export async function refreshPriorityAnnouncements({binding,accountId,assertActive=()=>{},commit=null}) {
  const [permission] = await sql`SELECT p.sharing_mode FROM canvas_corpus_permissions p
    JOIN canvas_corpus_access a ON a.user_id=p.user_id AND a.binding_id=${binding.id}
    WHERE p.user_id=${accountId} AND p.origin=${binding.origin} AND p.collection_enabled=true AND a.sync_paused=false`
  if (!permission) throw new Error('Canvas collection is paused or permission was revoked.')
  const {token} = await canvasAccessTokenForUser({accountId,canvasUrl:binding.origin})
  const api = createCanvasApi({origin:binding.origin,accessToken:token})
  const rows = await api.getPaged(`/api/v1/courses/${encodeURIComponent(binding.canvas_course_id)}/discussion_topics?only_announcements=true&per_page=100`)
  for (const row of rows) {
    assertActive()
    const doc = priorityAnnouncementDocument(row,binding)
    if (!doc) continue
    const active=await sql`SELECT sha256,source_path FROM canvas_source_snapshots WHERE binding_id=${binding.id} AND contributor_user_id=${accountId}
      AND resource_type='announcements' AND source_path LIKE ${`%--discussion-${doc.id}.html`} AND retired_at IS NULL`
    if(active.length===1 && active[0].sha256===doc.sha && active[0].source_path===doc.path) continue
    const assetId=`esa-${doc.sha.slice(0,32)}`
    const contribution=`ec-${hash(`${binding.edition_id}:${assetId}:${accountId}:${doc.path}`).slice(0,32)}`
    const snapshot=`css-${hash(`${binding.id}:${doc.path}:${doc.sha}:${accountId}`).slice(0,32)}`
    const bytes=Buffer.from(doc.html)
    const metadata=JSON.stringify({source:'canvas-announcement-refresh',canvasAnnouncementId:doc.id,postedAt:doc.postedAt,canvasUrl:doc.url,academicYear:binding.academic_year,courseCode:binding.course_code})
    const queries=[
      sql`INSERT INTO editorial_source_assets(id,sha256,filename,media_type,byte_size,source_kind,expected_chunks,is_complete,extraction_status,extracted_text,content_sha256,metadata,created_by)
        VALUES(${assetId},${doc.sha},${`${doc.title}--discussion-${doc.id}.html`},'text/html',${bytes.length},'file',1,true,'complete',${doc.text},${hash(doc.text)},${metadata}::jsonb,${accountId}) ON CONFLICT(sha256) DO NOTHING`,
      sql`INSERT INTO editorial_source_asset_chunks(asset_id,chunk_index,data) SELECT id,0,${bytes} FROM editorial_source_assets WHERE sha256=${doc.sha} ON CONFLICT DO NOTHING`,
      ...doc.passages.map((content,index)=>sql`INSERT INTO editorial_source_retrieval_chunks(edition_id,asset_id,page_number,chunk_index,content,metadata)
        SELECT ${binding.edition_id},id,1,${index},${content},${metadata}::jsonb FROM editorial_source_assets WHERE sha256=${doc.sha} ON CONFLICT DO NOTHING`),
      sql`INSERT INTO editorial_contributions(id,edition_id,asset_id,contributor_user_id,source_path,consent_status,rights_basis)
        SELECT ${contribution},${binding.edition_id},id,${accountId},${doc.path},${permission.sharing_mode==='community'?'candidate':'private'},'Canvas collection consent; community publication requires rights review.' FROM editorial_source_assets WHERE sha256=${doc.sha} ON CONFLICT DO NOTHING`,
      // An updated announcement supersedes its prior body, including copies in
      // module folders. Disappearing items are never inferred to be deleted.
      sql`UPDATE canvas_source_snapshots SET retired_at=now() WHERE binding_id=${binding.id} AND contributor_user_id=${accountId}
        AND resource_type='announcements' AND source_path LIKE ${`%--discussion-${doc.id}.html`} AND (sha256<>${doc.sha} OR source_path<>${doc.path}) AND retired_at IS NULL`,
      sql`INSERT INTO canvas_source_snapshots(id,binding_id,asset_id,contribution_id,contributor_user_id,sharing_mode,resource_key,source_path,resource_type,sha256,metadata)
        SELECT ${snapshot},${binding.id},id,${contribution},${accountId},${permission.sharing_mode},${doc.path},${doc.path},'announcements',${doc.sha},${metadata}::jsonb FROM editorial_source_assets WHERE sha256=${doc.sha}
        ON CONFLICT(binding_id,resource_key,sha256,contributor_user_id) DO UPDATE SET last_seen_at=now(),retired_at=null,sharing_mode=excluded.sharing_mode,metadata=excluded.metadata`
    ]
    // Recheck consent under the same transaction as publication, alongside the
    // caller's queue lease fence. A stopped worker cannot publish new evidence.
    queries.unshift(sql`SELECT 1/count(*)::int FROM (SELECT user_id FROM canvas_corpus_permissions WHERE user_id=${accountId} AND origin=${binding.origin} AND collection_enabled=true FOR SHARE) permitted`)
    if(commit) await commit(queries); else await sql.transaction(queries)
  }
  return {announcements:rows.length}
}
