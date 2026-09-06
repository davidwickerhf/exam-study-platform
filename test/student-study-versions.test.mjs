import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import {
  deleteAllDocuments,
  readDocument,
  compareAndSwapDocument
} from '../lib/user-store.mjs'
import {
  addStudyNote,
  listStudySources,
  readStudySourceSnapshot
} from '../lib/study-version-sources.mjs'
import {
  claimStudyDispatch,
  createStudyVersion,
  ownStudyVersion,
  studyRevision,
  mutateStudyVersion,
  saveStudyRevision,
  saveStudyProgress,
  readStudyProgress,
  createStudyExam,
  saveStudyExam
} from '../lib/study-version-store.mjs'
import {
  processStudyStep,
  refreshStudyVersion,
  controlStudyGeneration
} from '../lib/study-version-pipeline.mjs'
import {
  publishStudyVersion,
  readStudyPublication,
  withdrawStudyPublication,
  selectStudyPublication
} from '../lib/study-version-sharing.mjs'
import {
  mapSchema,
  lessonSchema,
  parseStudyJson,
  assertEvidence,
  sourceChanges,
  evidenceBatches,
  digest
} from '../lib/study-version-content.mjs'
import {
  studyLessonQuality,
  arithmeticValue
} from '../lib/study-content-quality.mjs'
import { studyVersionApi } from '../lib/study-version-api.mjs'

import { course, lesson } from '../scripts/verification/study-fixtures.mjs'
async function fixture() {
  const userId = `study-test-${randomUUID()}`
  const context = { userId, mode: 'local', email: 'student@example.test' }
  const run = (fn) => withRequestContext(context, fn)
  const { version, snapshot } = await run(async () => {
    const note = await addStudyNote(
      { ...course, title: 'My arithmetic notes' },
      [
        {
          page: 1,
          text: 'Adding disjoint quantities: two plus three equals five. Subtract to check. All quantities need matching units.'
        }
      ]
    )
    const snapshot = await readStudySourceSnapshot(course, [note.id])
    const version = await createStudyVersion(course, 'programme-test', snapshot)
    return { version, snapshot }
  })
  return {
    run,
    context,
    version,
    snapshot,
    cleanup: () => run(deleteAllDocuments)
  }
}
async function finish(f, { reviewIssues = [] } = {}) {
  let calls = 0
  const generate = async (prompt) => {
    calls++
    const v = await ownStudyVersion(f.version.id),
      chunks = v.draft.snapshot.chunks,
      ids = chunks.map((c) => c.id)
    if (prompt.includes('Map this evidence batch'))
      return {
        topics: [{ id: 'addition', title: 'Addition', sourceIds: ids }],
        gaps: []
      }
    if (prompt.includes('Independently check')) return { issues: reviewIssues }
    return lesson(ids)
  }
  await f.run(async () => {
    for (let i = 0; i < 20; i++) {
      await processStudyStep(f.version.id, { generate })
      const v = await ownStudyVersion(f.version.id)
      if (['complete', 'failed'].includes(v.draft.status)) break
    }
  })
  return calls
}

test('private generation completes without editorial acceptance and preserves evidence, practice and history', async () => {
  const f = await fixture()
  try {
    assert.equal(await finish(f), 3)
    await f.run(async () => {
      const v = await ownStudyVersion(f.version.id),
        r = await studyRevision(v)
      assert.equal(v.draft.status, 'complete')
      assert.equal(r.chapters.length, 1)
      assert.equal(r.chapters[0].review, 'passed')
      assert.equal(r.review, 'ai-checked')
      assert.equal(r.snapshot.sources[0].kind, 'notes')
      assert.equal(r.chapters[0].questions.length, 3)
      assert.equal(r.chapters[0].flashcards.length, 3)
      await saveStudyProgress(v.id, {
        revisionId: r.id,
        topicId: 'addition',
        read: true,
        note: 'My annotation',
        attempt: {
          id: 'attempt-1',
          questionId: r.chapters[0].questions[0].id,
          answer: 'Five'
        }
      })
      const exam = await createStudyExam(v.id, { revisionId: r.id, count: 2 })
      const complete = await saveStudyExam(v.id, {
        id: exam.id,
        expectedRevision: exam.revision,
        questionId: exam.questions[0].id,
        answer: 'Five',
        complete: true
      })
      assert.equal(complete.status, 'complete')
      assert.equal(complete.questions.length, 2)
      await assert.rejects(
        saveStudyExam(v.id, {
          id: exam.id,
          expectedRevision: complete.revision,
          answer: 'change'
        }),
        /completed attempt/
      )
      await assert.rejects(
        refreshStudyVersion(
          v.id,
          { sourceKeys: r.snapshot.sources.map((s) => s.key) },
          {}
        ),
        /already includes/
      )
      const note = await addStudyNote(
        { ...course, title: 'New lecture notes' },
        [
          {
            page: 1,
            text: 'New material: add negative numbers by counting backwards. Zero leaves a number unchanged.'
          }
        ]
      )
      await refreshStudyVersion(
        v.id,
        { sourceKeys: [...r.snapshot.sources.map((s) => s.key), note.id] },
        {}
      )
    })
    await finish(f)
    await f.run(async () => {
      const v = await ownStudyVersion(f.version.id)
      assert.equal(v.history.length, 2)
      assert.equal((await readStudyProgress(v.id))[0].note, 'My annotation')
      const old = await studyRevision(v, v.history[1].id)
      assert.equal(old.snapshot.sources.length, 1)
      assert.equal((await studyRevision(v)).snapshot.sources.length, 2)
    })
  } finally {
    await f.cleanup()
  }
})

test('owner isolation and arbitrary source identifiers fail closed', async () => {
  const f = await fixture()
  try {
    await withRequestContext({ userId: `other-${randomUUID()}` }, async () => {
      await assert.rejects(ownStudyVersion(f.version.id), /not found/)
      await assert.rejects(
        readStudySourceSnapshot(course, [f.snapshot.sources[0].key]),
        /no longer available/
      )
      assert.deepEqual(await listStudySources(course), [])
    })
  } finally {
    await f.cleanup()
  }
})

test('historical source reuse is explicit and never silently selected', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const n = await addStudyNote(
        { ...course, academicYear: '2025-2026', title: 'Old assessment' },
        [{ page: 1, text: 'Old exam duration was 90 minutes.' }]
      )
      await assert.rejects(
        readStudySourceSnapshot(course, [n.id]),
        /Confirm the use/
      )
      const old = await readStudySourceSnapshot(course, [n.id], {
        includeHistorical: true
      })
      assert.equal(old.sources[0].historical, true)
    })
  } finally {
    await f.cleanup()
  }
})

test('Stop fences an in-flight paid step and retry resumes checkpoints', async () => {
  const f = await fixture()
  try {
    let resolve, started
    const entered = new Promise((r) => (started = r)),
      pending = new Promise((r) => (resolve = r))
    const work = f.run(() =>
      processStudyStep(f.version.id, {
        generate: async () => {
          started()
          await pending
          return {
            topics: [
              {
                id: 'addition',
                title: 'Addition',
                sourceIds: f.snapshot.chunks.map((c) => c.id)
              }
            ],
            gaps: []
          }
        }
      })
    )
    await entered
    await f.run(() => controlStudyGeneration(f.version.id, 'stop'))
    resolve()
    await work
    await f.run(async () => {
      const v = await ownStudyVersion(f.version.id)
      assert.equal(v.draft.status, 'stopped')
      assert.equal(v.draft.maps.length, 0)
      await controlStudyGeneration(v.id, 'retry')
    })
    await finish(f)
    assert.equal(
      (await f.run(() => ownStudyVersion(f.version.id))).draft.status,
      'complete'
    )
  } finally {
    await f.cleanup()
  }
})

test('duplicate worker notifications spend on one mapping call only', async () => {
  const f = await fixture()
  try {
    let calls = 0
    const generate = async () => {
      calls++
      await new Promise((r) => setTimeout(r, 25))
      return {
        topics: [
          {
            id: 'addition',
            title: 'Addition',
            sourceIds: f.snapshot.chunks.map((c) => c.id)
          }
        ],
        gaps: []
      }
    }
    await f.run(() =>
      Promise.all([
        processStudyStep(f.version.id, { generate }),
        processStudyStep(f.version.id, { generate })
      ])
    )
    assert.equal(calls, 1)
  } finally {
    await f.cleanup()
  }
})

test('failed independent evidence review cannot activate or publish a revision', async () => {
  const f = await fixture()
  try {
    await finish(f, {
      reviewIssues: [
        {
          topicId: 'addition',
          severity: 'error',
          detail: 'Solution contradicts the supplied source.'
        }
      ]
    })
    await f.run(async () => {
      const v = await ownStudyVersion(f.version.id)
      assert.equal(v.draft.status, 'failed')
      assert.equal(v.activeRevisionId, null)
      await assert.rejects(
        publishStudyVersion(v.id, { revisionId: v.draft.id }),
        /completed revision/
      )
      await controlStudyGeneration(v.id, 'retry')
      assert.equal((await ownStudyVersion(v.id)).draft.chapters.length, 0)
    })
  } finally {
    await f.cleanup()
  }
})

test('public release is an explicit selected snapshot, checks source consent, and can be withdrawn', async () => {
  const f = await fixture()
  try {
    await finish(f)
    let publication
    await f.run(async () => {
      const v = await ownStudyVersion(f.version.id),
        r = await studyRevision(v)
      await saveStudyProgress(v.id, {
        revisionId: r.id,
        topicId: 'addition',
        note: 'PRIVATE ANNOTATION'
      })
      await assert.rejects(
        publishStudyVersion(v.id, {
          revisionId: r.id,
          topicIds: ['addition'],
          audience: 'public',
          confirmSharing: true
        }),
        /permission to share your notes/
      )
      publication = await publishStudyVersion(v.id, {
        revisionId: r.id,
        topicIds: ['addition'],
        audience: 'public',
        confirmSharing: true,
        notesConsent: true
      })
      assert.equal(publication.review, 'unreviewed')
    })
    await withRequestContext({ userId: 'anonymous' }, async () => {
      const read = await readStudyPublication(publication.id, {
        publicOnly: true
      })
      assert.equal(read.content.chapters.length, 1)
      assert.equal(JSON.stringify(read).includes('PRIVATE ANNOTATION'), false)
      assert.equal(JSON.stringify(read).includes(f.context.userId), false)
      await assert.rejects(
        withdrawStudyPublication(publication.id),
        /not found/
      )
    })
    await f.run(() => withdrawStudyPublication(publication.id))
    await assert.rejects(
      readStudyPublication(publication.id, { publicOnly: true }),
      /not found/
    )
  } finally {
    await f.cleanup()
  }
})

test('content quality gates reject unsupported citations, arithmetic mistakes, thin lessons and executable markup', () => {
  const ids = ['e-1'],
    evidence = [{ id: 'e-1', text: 'Two plus three is five.' }]
  assert.equal(
    assertEvidence(parseStudyJson(lesson(ids), lessonSchema), evidence).title,
    'Addition'
  )
  assert.throws(
    () => assertEvidence(lesson(['e-other']), evidence),
    /outside the selected sources/
  )
  assert.throws(() => parseStudyJson('{broken', mapSchema), /study format/)
  assert.deepEqual(studyLessonQuality(lesson(ids), evidence), [])
  assert.match(
    studyLessonQuality(lesson(ids, { wrong: true }), evidence).join(' '),
    /arithmetic/
  )
  const thin = lesson(ids)
  thin.sections = thin.sections.map((s) => ({ ...s, text: 'Summary.' }))
  assert.match(studyLessonQuality(thin).join(' '), /substantive teaching/)
  const unsafe = lesson(ids)
  unsafe.sections[0].text += '<script>alert(1)</script>'
  assert.match(studyLessonQuality(unsafe).join(' '), /safe text/)
  assert.equal(arithmeticValue('-2^2'), -4)
  assert.equal(arithmeticValue('2^-2'), 0.25)
  assert.equal(arithmeticValue('2 + 3 * 4'), 14)
  assert.equal(arithmeticValue('process.exit()'), null)
  assert.equal(arithmeticValue('1/0'), null)
  assert.deepEqual(
    sourceChanges(
      [{ key: 'a', sha256: '1', title: 'A' }],
      [
        { key: 'a', sha256: '2', title: 'A' },
        { key: 'b', sha256: '1', title: 'B' }
      ]
    ),
    { added: ['B'], changed: ['A'], removed: [] }
  )
})

test('source coverage batching accounts for all passages without truncation', () => {
  const chunks = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    text: 'x'.repeat(3500)
  }))
  const batches = evidenceBatches(chunks)
  assert.deepEqual(
    batches.flat().map((c) => c.id),
    chunks.map((c) => c.id)
  )
  assert.ok(
    batches.every((b) => b.reduce((n, c) => n + c.text.length, 0) <= 36000)
  )
})

test('API keys cannot expand generation, sharing or credential permissions', async () => {
  await withRequestContext({ userId: 'agent', mode: 'api-key' }, async () => {
    await assert.rejects(
      studyVersionApi({
        pathname: '/api/study-versions',
        method: 'POST',
        body: {},
        query: {}
      }),
      /signed-in browser/
    )
    await assert.rejects(
      studyVersionApi({
        pathname: '/api/account/ai',
        method: 'GET',
        query: {}
      }),
      /signed-in browser/
    )
  })
})

test('the HTTP contract accepts notes and private generation independently of editorial requests', async () => {
  const userId = `study-api-test-${randomUUID()}`
  try {
    await withRequestContext({ userId, mode: 'local' }, async () => {
      const api = (pathname, method = 'GET', body = {}, query = {}) =>
        studyVersionApi({
          pathname,
          method,
          body,
          query,
          platform: {
            configured: true,
            provider: 'openai',
            model: 'gpt-5-mini'
          }
        })
      const { data: note } = await api('/api/study-notes', 'POST', {
        ...course,
        title: 'API lecture',
        text: 'Two plus three is five. Addition combines disjoint quantities.'
      })
      const { data: estimate } = await api(
        '/api/study-versions/estimate',
        'POST',
        { ...course, sourceKeys: [note.id], maxJobUsd: 0.1 }
      )
      assert.equal(estimate.sourceCount, 1)
      assert.equal(estimate.maxJobUsd, 0.1)
      const { status, data } = await api('/api/study-versions', 'POST', {
        ...course,
        sourceKeys: [note.id],
        maxJobUsd: 0.1
      })
      assert.equal(status, 202)
      assert.equal(data.version.visibility, 'private')
      assert.equal(data.version.draft.status, 'queued')
      assert.equal(
        (await api(`/api/study-versions/${data.version.id}`)).data.revision,
        null
      )
      await assert.rejects(
        api(
          `/api/study-versions/${data.version.id}`,
          'GET',
          {},
          { revision: 'not-owned' }
        ),
        /Revision not found/
      )
      await api(`/api/study-versions/${data.version.id}/stop`, 'POST')
      assert.equal(
        (await api(`/api/study-versions/${data.version.id}`)).data.version.draft
          .status,
        'stopped'
      )
      await deleteAllDocuments()
    })
  } finally {
  }
})

test('retracted source access pauses a queued step before any AI spending', async () => {
  const f = await fixture()
  try {
    let calls = 0
    await f.run(() =>
      processStudyStep(f.version.id, {
        checkAccess: async () => false,
        generate: async () => {
          calls++
          return {}
        }
      })
    )
    assert.equal(calls, 0)
    assert.equal(
      (await f.run(() => ownStudyVersion(f.version.id))).draft.status,
      'failed'
    )
  } finally {
    await f.cleanup()
  }
})

test('a changed source invalidates the public release without deleting private study history', async () => {
  const f = await fixture()
  try {
    await finish(f)
    await f.run(async () => {
      const v = await ownStudyVersion(f.version.id),
        r = await studyRevision(v),
        p = await publishStudyVersion(v.id, {
          revisionId: r.id,
          topicIds: ['addition'],
          audience: 'public',
          confirmSharing: true,
          notesConsent: true
        })
      const key = f.snapshot.sources[0].key,
        old = await readDocument('study-notes', key, null)
      await compareAndSwapDocument(
        'study-notes',
        key,
        {
          ...old,
          pages: [{ page: 1, text: 'Changed notes.' }],
          revision: randomUUID()
        },
        old.revision
      )
      await assert.rejects(
        readStudyPublication(p.id, { publicOnly: true }),
        /source changed/
      )
      assert.equal((await studyRevision(await ownStudyVersion(v.id))).id, r.id)
    })
  } finally {
    await f.cleanup()
  }
})

test('refresh reuses an unchanged checked chapter and only generates the newly mapped topic', async () => {
  const f = await fixture()
  try {
    await finish(f)
    await f.run(async () => {
      const firstIds = f.snapshot.chunks.map((c) => c.id)
      const added = await addStudyNote({ ...course, title: 'New topic' }, [
        {
          page: 1,
          text: 'Zero is the additive identity. Adding zero leaves the original number unchanged.'
        }
      ])
      await refreshStudyVersion(
        f.version.id,
        { sourceKeys: [f.snapshot.sources[0].key, added.id] },
        {}
      )
      let lessonCalls = 0,
        reviewCalls = 0
      for (let i = 0; i < 20; i++) {
        await processStudyStep(f.version.id, {
          generate: async (prompt) => {
            const v = await ownStudyVersion(f.version.id),
              ids = v.draft.snapshot.chunks
                .filter((c) => c.sourceKey === added.id)
                .map((c) => c.id)
            if (prompt.includes('Map this evidence batch'))
              return {
                topics: [
                  { id: 'addition', title: 'Addition', sourceIds: firstIds },
                  { id: 'zero', title: 'Zero', sourceIds: ids }
                ],
                gaps: []
              }
            if (prompt.includes('Independently check')) {
              reviewCalls++
              return { issues: [] }
            }
            lessonCalls++
            return lesson(ids)
          }
        })
        if ((await ownStudyVersion(f.version.id)).draft.status === 'complete')
          break
      }
      const v = await ownStudyVersion(f.version.id)
      assert.equal(v.draft.status, 'complete')
      assert.equal(v.history[0].reused, 1)
      assert.equal(lessonCalls, 1)
      assert.equal(reviewCalls, 1)
    })
  } finally {
    await f.cleanup()
  }
})

test('revision writes recover after a crash before activation without changing the saved content', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const version = await ownStudyVersion(f.version.id),
        draft = version.draft
      const first = await saveStudyRevision(version, {
        ...draft,
        lease: { token: 'old-worker' },
        attempts: 1
      })
      const recovered = await saveStudyRevision(version, {
        ...draft,
        lease: { token: 'replacement-worker' },
        attempts: 2,
        runAfter: Date.now() + 1000
      })
      assert.deepEqual(recovered, first)
      await assert.rejects(
        saveStudyRevision(version, {
          ...draft,
          topics: [{ id: 'changed', title: 'Changed', sourceIds: [] }]
        }),
        /record changed/
      )
    })
  } finally {
    await f.cleanup()
  }
})

test('outbox claims prevent fan-out while another course is waiting for delivery', async () => {
  const first = await fixture(),
    second = await fixture()
  try {
    const claims = (
      await Promise.all([claimStudyDispatch(), claimStudyDispatch()])
    ).flat()
    assert.equal(claims.filter((id) => id === first.version.id).length, 1)
    assert.equal(claims.filter((id) => id === second.version.id).length, 1)
    assert.equal((await claimStudyDispatch()).includes(first.version.id), false)
    await first.run(() =>
      processStudyStep(first.version.id, {
        generate: async () => ({
          topics: [
            {
              id: 'addition',
              title: 'Addition',
              sourceIds: first.snapshot.chunks.map((c) => c.id)
            }
          ],
          gaps: []
        })
      })
    )
    const next = await claimStudyDispatch()
    assert.equal(next.includes(first.version.id), true)
    assert.equal(next.includes(second.version.id), false)
    await second.run(() =>
      mutateStudyVersion(second.version.id, (v) => {
        v.queueDeliveryUntil = Date.now() - 1
      })
    )
    assert.equal((await claimStudyDispatch()).includes(second.version.id), true)
  } finally {
    await first.cleanup()
    await second.cleanup()
  }
})
