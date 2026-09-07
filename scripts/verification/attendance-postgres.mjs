// Use a disposable, empty localhost database. No hosted data or model calls.
// STUDY_TEST_DATABASE_URL=postgres://... node --experimental-test-module-mocks scripts/verification/attendance-postgres.mjs
import {mock} from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import pg from 'pg'
import * as neonModule from '@neondatabase/serverless'
const url=new URL(process.env.STUDY_TEST_DATABASE_URL || '')
if(!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Use a disposable localhost database.')
const pool=new pg.Pool({connectionString:url.href})
const sql=(strings,...values)=>pool.query(strings.reduce((out,part,i)=>out+(i?`$${i}`:'')+part,''),values).then(r=>r.rows)
mock.module('@neondatabase/serverless',{namedExports:{...neonModule,neon:()=>sql}})
process.env.DATABASE_URL=url.href
const {canvasPriorityProfiles}=await import('../../lib/priority-evidence.mjs')
const {supportedCourseAssessment}=await import('../../lib/course-rule-evidence.mjs')
try {
  assert.equal((await pool.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n,0,'Database must be empty')
  for(const name of (await readdir(new URL('../../db/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()) await pool.query(await readFile(new URL('../../db/'+name,import.meta.url),'utf8'))
  await pool.query(`INSERT INTO editorial_course_editions(id,canonical_course_id,course_code,course_name,academic_year,period,edition_key,created_by) VALUES('edition','cs101','CS101','Foundations','2026-2027','1','cs101-2026','owner');
    INSERT INTO editorial_source_assets(id,sha256,filename,media_type,byte_size,created_by,is_complete) VALUES('asset','abc','Course manual.pdf','application/pdf',100,'owner',true);
    INSERT INTO canvas_course_bindings(id,origin,canvas_course_id,edition_id,canonical_course_id,course_code,course_name,academic_year,period) VALUES('binding','https://canvas.example.test','123','edition','cs101','CS101','Foundations','2026-2027','1');
    INSERT INTO canvas_corpus_access(user_id,binding_id) VALUES('owner','binding'),('peer','binding');
    INSERT INTO canvas_corpus_permissions(user_id,origin,collection_enabled) VALUES('owner','https://canvas.example.test',true),('peer','https://canvas.example.test',true);
    INSERT INTO canvas_source_snapshots(id,binding_id,asset_id,contributor_user_id,resource_key,source_path,sha256) VALUES('snapshot','binding','asset','owner','file:1','Course manual.pdf','abc');
    INSERT INTO editorial_source_retrieval_chunks(edition_id,asset_id,page_number,chunk_index,content) VALUES('edition','asset',2,0,'Attendance and participation in these debates counts for 10% of your final grade (pass/fail).');`)
  const profile={assessment:{status:'needs-review',attendanceEvidence:[],conflicts:[{title:'Priority scan allowance reached',chunkIds:[]}]}}
  for(const user of ['owner','peer']) await pool.query("INSERT INTO canvas_priority_scans(id,binding_id,user_id,evidence_hash,status,course_profile) VALUES($1,'binding',$1,'failed','needs-review',$2)",[user,profile])
  const [owner]=await canvasPriorityProfiles({accountId:'owner'})
  const rule=supportedCourseAssessment(owner).attendanceEvidence[0]
  assert.equal(rule.participationAssessed,true)
  assert.equal(rule.evidence[0].assetId,'asset')
  assert.equal(rule.evidence[0].page,2)
  assert.equal(supportedCourseAssessment((await canvasPriorityProfiles({accountId:'peer'}))[0]),null,'private snapshots must not leak to a peer sharing the binding')
  await pool.query("UPDATE canvas_source_snapshots SET retired_at=now() WHERE id='snapshot'")
  assert.equal(supportedCourseAssessment((await canvasPriorityProfiles({accountId:'owner'}))[0]),null,'retired evidence is not recovered')
  await pool.query("UPDATE canvas_source_snapshots SET retired_at=NULL WHERE id='snapshot'; UPDATE canvas_corpus_permissions SET collection_enabled=false WHERE user_id='owner'")
  assert.deepEqual(await canvasPriorityProfiles({accountId:'owner'}),[],'revoked collection excludes profiles and sources')
  assert.equal((await pool.query("SELECT course_profile FROM canvas_priority_scans WHERE id='owner'")).rows[0].course_profile.assessment.attendanceEvidence.length,0,'recovery never rewrites the scan')
  console.log('Attendance PostgreSQL checks passed: recovery, source page, private contributor isolation, retirement, revocation, read-only behavior.')
} finally {await pool.end()}
