// Destructive only inside a fresh localhost PostgreSQL/pgvector database.
// STUDY_TEST_DATABASE_URL=postgres://... npm run test:study:postgres
import { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import pg from 'pg'
import * as neonModule from '@neondatabase/serverless'
const url = new URL(process.env.STUDY_TEST_DATABASE_URL || '')
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Use a disposable localhost database.')
const pool = new pg.Pool({ connectionString: url.href })
function sql(strings, ...values) {
  return pool
    .query(
      strings.reduce((out, part, i) => out + (i ? `$${i}` : '') + part, ''),
      values
    )
    .then((r) => r.rows)
}
mock.module('@neondatabase/serverless', {
  namedExports: { ...neonModule, neon: () => sql }
})
process.env.DATABASE_URL = url.href
process.env.AI_CONNECTION_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
  'base64'
)
const { withRequestContext } = await import('../../lib/request-context.mjs')
const { listStudySources, readStudySourceSnapshot } = await import(
  '../../lib/study-version-sources.mjs'
)
const {
  createStudyVersion,
  ownStudyVersion,
  studyRevision,
  pendingStudyVersions
} = await import('../../lib/study-version-store.mjs')
const { processStudyStep } = await import(
  '../../lib/study-version-pipeline.mjs'
)
const { publishStudyVersion, readStudyPublication, submitStudyVersion } =
  await import('../../lib/study-version-sharing.mjs')
const { runBudgetedStudyCall } = await import('../../lib/study-ai-budget.mjs')
const { course, lesson } = await import('./study-fixtures.mjs')
const as = (userId, fn) => withRequestContext({ userId, mode: 'local' }, fn)
try {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  for (const name of (await readdir(new URL('../../db/', import.meta.url)))
    .filter((n) => n.endsWith('.sql'))
    .sort())
    await pool.query(
      await readFile(new URL('../../db/' + name, import.meta.url), 'utf8')
    )
  await pool.query(`INSERT INTO editorial_course_editions(id,canonical_course_id,course_code,course_name,academic_year,period,edition_key,created_by) VALUES('edition','cs101','CS101','Foundations','2026-2027','1','cs101-2026','owner');
 INSERT INTO editorial_source_assets(id,sha256,filename,media_type,byte_size,created_by,is_complete) VALUES('asset','abc','Lecture.pdf','application/pdf',100,'owner',true);
 INSERT INTO editorial_contributions(id,edition_id,asset_id,contributor_user_id,consent_status) VALUES('contribution','edition','asset','owner','private');
 INSERT INTO canvas_course_bindings(id,origin,canvas_course_id,edition_id,canonical_course_id,course_code,course_name,academic_year,period) VALUES('binding','https://canvas.example.test','123','edition','cs101','CS101','Foundations','2026-2027','1');
 INSERT INTO canvas_corpus_access(user_id,binding_id) VALUES('owner','binding'),('peer','binding');
 INSERT INTO canvas_source_snapshots(id,binding_id,asset_id,contribution_id,contributor_user_id,resource_key,source_path,sha256) VALUES('snapshot','binding','asset','contribution','owner','file:1','Lecture.pdf','abc');
 INSERT INTO editorial_source_retrieval_chunks(edition_id,asset_id,page_number,chunk_index,content) VALUES('edition','asset',1,0,'Two plus three is five. Addition combines disjoint quantities with matching units; subtraction checks the result.');`)
  assert.equal((await as('peer', () => listStudySources(course))).length, 0)
  const sources = await as('owner', () => listStudySources(course))
  assert.equal(sources.length, 1)
  let id, publication
  await as('owner', async () => {
    const snapshot = await readStudySourceSnapshot(course, [sources[0].key])
    assert.equal(snapshot.chunks[0].page, 1)
    const v = await createStudyVersion(course, 'programme', snapshot)
    id = v.id
    assert.ok((await pendingStudyVersions()).some((r) => r.key === id))
    let mappingCalls = 0
    const generate = async (prompt) => {
      const ids = snapshot.chunks.map((c) => c.id)
      if (prompt.includes('Map this evidence batch')) {
        mappingCalls++
        await new Promise((r) => setTimeout(r, 30))
        return {
          topics: [{ id: 'addition', title: 'Addition', sourceIds: ids }],
          gaps: []
        }
      }
      return prompt.includes('Independently check')
        ? { issues: [] }
        : lesson(ids)
    }
    await Promise.all([
      processStudyStep(id, { generate }),
      processStudyStep(id, { generate })
    ])
    assert.equal(mappingCalls, 1)
    for (let i = 0; i < 12; i++) {
      await processStudyStep(id, { generate })
      if ((await ownStudyVersion(id)).draft.status === 'complete') break
    }
    const revision = await studyRevision(await ownStudyVersion(id))
    assert.ok(revision)
    const submission = await submitStudyVersion(id, {
      revisionId: revision.id,
      topicIds: ['addition'],
      confirmSharing: true
    })
    assert.equal(submission.request.files.length, 2)
    assert.equal(submission.request.contributionConsent, true)
    const { getCourseContentRequestFile } = await import(
      '../../lib/course-content-requests.mjs'
    )
    const derivative = await getCourseContentRequestFile(
      submission.request.id,
      submission.request.files.find(
        (f) =>
          f.name === 'study-version.md' || f.filename === 'study-version.md'
      ).id
    )
    assert.match(
      derivative.data.toString('utf8'),
      /Generated practice with worked solutions/
    )

    await assert.rejects(
      publishStudyVersion(id, {
        revisionId: revision.id,
        topicIds: ['addition'],
        audience: 'course',
        confirmSharing: true
      }),
      /accepted community/
    )
    await pool.query(
      "UPDATE canvas_source_snapshots SET sharing_mode='community'; UPDATE editorial_contributions SET consent_status='accepted'"
    )
    publication = await publishStudyVersion(id, {
      revisionId: revision.id,
      topicIds: ['addition'],
      audience: 'course',
      confirmSharing: true
    })
    await assert.rejects(
      publishStudyVersion(id, {
        revisionId: revision.id,
        topicIds: ['addition'],
        audience: 'public',
        confirmSharing: true
      }),
      /accepted community/
    )
  })
  assert.equal(
    (await as('peer', () => readStudyPublication(publication.id))).content
      .chapters.length,
    1
  )
  await assert.rejects(
    as('stranger', () => readStudyPublication(publication.id)),
    /course members/
  )
  await pool.query(
    "UPDATE editorial_contributions SET consent_status='withdrawn'"
  )
  await assert.rejects(
    as('peer', () => readStudyPublication(publication.id)),
    /course members|withdrawn/
  )
  await assert.rejects(
    as('owner', () => readStudyPublication(publication.id)),
    /withdrawn/
  )
  // Two accounts racing the same shared budget must reserve atomically in SQL.
  process.env.STUDY_PLATFORM_DAILY_USD = '0.025'
  let paid = 0
  const config = {
    billing: {
      source: 'platform',
      provider: 'openai',
      model: 'gpt-5-mini',
      maxJobUsd: 1
    },
    jobKey: 'budget-race',
    callPlatform: async () => {
      paid++
      return { text: 'ok', usage: null }
    },
    callPersonal: () => {
      throw new Error('wrong billing source')
    }
  }
  const outcomes = await Promise.allSettled(
    ['one', 'two'].map((user) =>
      as(user, () => runBudgetedStudyCall('small prompt', {}, config))
    )
  )
  assert.equal(paid, 1)
  assert.equal(outcomes.filter((r) => r.status === 'rejected').length, 1)
  console.log(
    'PostgreSQL: migrations, private Canvas generation, exact retrieval, duplicate leases, course membership, consent withdrawal and atomic shared spending passed.'
  )
} finally {
  await pool.end()
}
