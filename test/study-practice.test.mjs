import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, readDocument } from '../lib/user-store.mjs'
import {
  addStudyNote,
  readStudySourceSnapshot,
} from '../lib/study-version-sources.mjs'
import {
  createStudyVersion,
  ownStudyVersion,
  mutateStudyVersion,
  saveStudyRevision,
} from '../lib/study-version-store.mjs'
import {
  createStudyPractice,
  createStudyAssessment,
  stepStudyPractice,
  listStudyPractice,
  validatePracticeSet,
  canonicalGrade,
  localPracticeGrade,
} from '../lib/study-practice.mjs'
import { studyTutorContext } from '../lib/study-chapter-context.mjs'
import { course, lesson } from '../scripts/verification/study-fixtures.mjs'

async function fixture(fn) {
  return withRequestContext(
    { userId: `practice-test-${randomUUID()}`, mode: 'local' },
    async () => {
      try {
        const paper = await addStudyNote({ ...course, title: 'Past exam' }, [
          {
            page: 1,
            text: '1(a) What is 2 + 3? [2 marks]\n1(b) Select the sum of 2 and 3. A: 4 B: 5 [1 mark]',
          },
        ])
        const solution = await addStudyNote({ ...course, title: 'Solutions' }, [
          {
            page: 1,
            text: '1(a) 5. Two units plus three units gives five units. 1(b) B: 5.',
          },
        ])
        const snapshot = await readStudySourceSnapshot(course, [
            paper.id,
            solution.id,
          ]),
          ids = snapshot.chunks.map((c) => c.id)
        const version = await createStudyVersion(
          course,
          'test-programme',
          snapshot,
        )
        const chapter = {
          ...lesson(ids),
          id: 'addition',
          questions: lesson(ids).questions.map((q, i) => ({
            ...q,
            id: `q-${i + 1}`,
          })),
          review: 'passed',
        }
        const draft = {
          ...version.draft,
          chapters: [chapter],
          topics: [{ id: 'addition', title: 'Addition', sourceIds: ids }],
          issues: [],
        }
        const revision = await saveStudyRevision(version, draft)
        await mutateStudyVersion(version.id, (v) => {
          v.activeRevisionId = revision.id
          v.history = [{ id: revision.id }]
          v.draft = null
        })
        const base = { revisionId: revision.id, topicId: 'addition' }
        const questionId = snapshot.chunks.find(
            (c) => c.sourceKey === paper.id,
          ).id,
          answerId = snapshot.chunks.find((c) => c.sourceKey === solution.id).id
        const questions = [
          {
            label: '1(a)',
            question: 'What is 2 + 3?',
            sharedContext: '',
            type: 'written',
            options: [],
            correctOptions: [],
            marks: 2,
            page: 1,
            answer: '5. Two units plus three units gives five units.',
            answerBasis: 'source',
            hint: '',
            difficulty: 'foundation',
            sourceIds: [questionId],
            answerSourceIds: [answerId],
            needsOriginal: false,
          },
          {
            label: '1(b)',
            question: 'Select the sum of 2 and 3.',
            sharedContext: '',
            type: 'mc',
            options: ['4', '5'],
            correctOptions: [1],
            marks: 1,
            page: 1,
            answer: '5',
            answerBasis: 'source',
            hint: '',
            difficulty: 'foundation',
            sourceIds: [questionId],
            answerSourceIds: [answerId],
            needsOriginal: false,
          },
        ]
        await fn({
          version,
          revision,
          base,
          paper,
          solution,
          snapshot,
          questions,
        })
      } finally {
        await deleteAllDocuments()
      }
    },
  )
}
const billing = { source: 'platform', model: 'gpt-5-mini', maxJobUsd: 1 }
async function extracted(f) {
  const set = await createStudyPractice(
    f.version.id,
    {
      ...f.base,
      mode: 'extract',
      questionSourceKey: f.paper.id,
      solutionSourceKey: f.solution.id,
    },
    { billing },
  )
  let calls = 0
  const generate = async (prompt, options) => {
    assert.ok(options.responseSchema)
    assert.equal(options.billing.model, 'gpt-5-mini')
    assert.equal(options.jobKey, set.id)
    calls++
    return JSON.stringify(
      calls === 1
        ? { title: 'Original exam', questions: f.questions, warnings: [] }
        : { issues: [] },
    )
  }
  assert.equal(
    (await stepStudyPractice(f.version.id, set.id, { generate })).stage,
    'review',
  )
  const done = await stepStudyPractice(f.version.id, set.id, { generate })
  assert.equal(done.status, 'complete')
  assert.equal(calls, 2)
  return done
}
test('paper extraction preserves subquestions, original marks/options and separate solution evidence; identical sets are cached', () =>
  fixture(async (f) => {
    const set = await extracted(f)
    assert.deepEqual(
      set.result.questions.map((q) => [q.label, q.marks, q.type]),
      [
        ['1(a)', 2, 'written'],
        ['1(b)', 1, 'mc'],
      ],
    )
    assert.notDeepEqual(
      set.result.questions[0].sourceIds,
      set.result.questions[0].answerSourceIds,
    )
    const cached = await createStudyPractice(
      f.version.id,
      {
        ...f.base,
        mode: 'extract',
        questionSourceKey: f.paper.id,
        solutionSourceKey: f.solution.id,
      },
      { billing },
    )
    assert.equal(cached.id, set.id)
    await stepStudyPractice(f.version.id, set.id, {
      generate: () => assert.fail('cached extraction must not spend again'),
    })
    assert.equal((await listStudyPractice(f.version.id)).length, 1)
  }))
test('paper fidelity rejects invented wording, invalid options, guessed solutions and wrong-page provenance', () =>
  fixture(async (f) => {
    const record = {
      mode: 'extract',
      snapshot: f.snapshot,
      questionSourceKey: f.paper.id,
      solutionSourceKey: f.solution.id,
    }
    const raw = { title: 'Paper', questions: f.questions, warnings: [] }
    for (const [field, value] of [
      ['question', 'What is 200 + 30?'],
      ['correctOptions', [8]],
      ['answerBasis', 'generated'],
      ['page', 99],
      ['answerSourceIds', []],
    ]) {
      const changed = structuredClone(raw)
      changed.questions[0][field] = value
      assert.throws(
        () => validatePracticeSet(changed, record),
        undefined,
        field,
      )
    }
  }))
test('assessment derives its reference from stored question, records feedback/marks, caches answers and survives chapter edits', () =>
  fixture(async (f) => {
    const set = await extracted(f)
    const attempt = await createStudyAssessment(
      f.version.id,
      {
        ...f.base,
        setId: set.id,
        questionId: 'q-1',
        answer: 'The sum is five units.',
        marks: 100,
        expected: 'evil client reference',
      },
      { billing },
    )
    assert.equal(attempt.question.marks, 2)
    assert.equal(attempt.question.answer, f.questions[0].answer)
    const done = await stepStudyPractice(f.version.id, attempt.id, {
      generate: async (prompt) => {
        assert.match(prompt, /sum.*five units/)
        assert.doesNotMatch(prompt, /evil client reference/)
        return JSON.stringify({
          assessable: true,
          feedback: 'Correct sum and units.',
          criteria: [
            { criterion: 'Sum', earned: 2, possible: 2, feedback: 'Correct.' },
          ],
          nextStep: 'Check by subtraction.',
        })
      },
    })
    assert.equal(done.result.earned, 2)
    assert.equal(done.result.possible, 2)
    await mutateStudyVersion(f.version.id, (v) => {
      v.activeRevisionId = 'a-later-revision'
    })
    const same = await createStudyAssessment(
      f.version.id,
      {
        ...f.base,
        setId: set.id,
        questionId: 'q-1',
        answer: 'The sum is five units.',
      },
      { billing },
    )
    assert.equal(same.id, attempt.id)
    assert.equal(
      (await listStudyPractice(f.version.id)).find((r) => r.id === attempt.id)
        .result.earned,
      2,
    )
  }))
test('choices use the saved answer key without a model call, and missing keys/graphics never receive made-up scores', () =>
  fixture(async (f) => {
    const set = await extracted(f)
    const attempt = await createStudyAssessment(
      f.version.id,
      { ...f.base, setId: set.id, questionId: 'q-2', answer: '1' },
      { billing },
    )
    const done = await stepStudyPractice(f.version.id, attempt.id, {
      generate: () => assert.fail('choice scoring is free'),
    })
    assert.equal(done.result.earned, 1)
    assert.equal(
      localPracticeGrade({ ...f.questions[1], answerBasis: 'unavailable' }, '0')
        .assessable,
      false,
    )
    assert.equal(
      localPracticeGrade({ ...f.questions[1], needsOriginal: true }, '1')
        .earned,
      null,
    )
    assert.equal(localPracticeGrade(f.questions[1], '0').earned, 0)
    assert.throws(() => localPracticeGrade(f.questions[1], '5'), /valid answer/)
  }))
test('saving an answer does not require AI; assessment can explicitly resume that same saved record', () =>
  fixture(async (f) => {
    const input = {
      ...f.base,
      questionId: 'q-1',
      answer: 'My reasoning',
      saveOnly: true,
    }
    const draft = await createStudyAssessment(f.version.id, input)
    assert.equal(draft.status, 'draft')
    assert.equal(
      (await stepStudyPractice(f.version.id, draft.id)).status,
      'draft',
    )
    const started = await createStudyAssessment(
      f.version.id,
      { ...input, saveOnly: false },
      { billing },
    )
    assert.equal(started.id, draft.id)
    assert.equal(started.status, 'pending')
  }))
test('an incomplete or wrong extraction stays flagged; retries and concurrent steps preserve checkpoints', () =>
  fixture(async (f) => {
    const set = await createStudyPractice(
      f.version.id,
      {
        ...f.base,
        mode: 'extract',
        questionSourceKey: f.paper.id,
        solutionSourceKey: f.solution.id,
      },
      { billing },
    )
    let release, started
    const ready = new Promise((resolve) => {
      started = resolve
    })
    const pending = stepStudyPractice(f.version.id, set.id, {
      generate: () => {
        started()
        return new Promise((resolve) => {
          release = () =>
            resolve(
              JSON.stringify({
                title: 'Paper',
                questions: f.questions,
                warnings: [],
              }),
            )
        })
      },
    })
    await ready
    await stepStudyPractice(f.version.id, set.id, {
      generate: () => assert.fail('duplicate worker'),
    })
    release()
    await pending
    const correction = await stepStudyPractice(f.version.id, set.id, {
      generate: async () =>
        JSON.stringify({ issues: ['One original subquestion is missing.'] }),
    })
    assert.equal(correction.status, 'pending')
    assert.equal(correction.repairs, 1)
    await stepStudyPractice(f.version.id, set.id, {
      generate: async (prompt) => {
        assert.match(prompt, /One original subquestion is missing/)
        return JSON.stringify({
          title: 'Paper',
          questions: f.questions,
          warnings: [],
        })
      },
    })
    const failed = await stepStudyPractice(f.version.id, set.id, {
      generate: async () =>
        JSON.stringify({
          issues: ['One original subquestion is still missing.'],
        }),
    })
    assert.equal(failed.status, 'failed')
    await stepStudyPractice(f.version.id, set.id, {
      generate: () => assert.fail('second failure requires explicit retry'),
    })
  }))
test('private practice and tutor context cannot cross accounts or use unknown revisions/questions', () =>
  fixture(async (f) => {
    const set = await extracted(f)
    const context = {
      studyVersionId: f.version.id,
      studyRevisionId: f.revision.id,
      chapterId: 'addition',
      studyQuestionId: 'q-1',
    }
    const lens = await studyTutorContext(context)
    assert.equal(lens.question.id, 'q-1')
    assert.equal(lens.revisionId, f.revision.id)
    await assert.rejects(
      studyTutorContext({ ...context, studyQuestionId: 'not-a-question' }),
      /selected question/,
    )
    await assert.rejects(
      studyTutorContext({ ...context, studyRevisionId: 'unpublished-draft' }),
      /saved study revision/,
    )
    await withRequestContext(
      { userId: `other-${randomUUID()}`, mode: 'local' },
      async () => {
        await assert.rejects(studyTutorContext(context), /not found/)
        await assert.rejects(
          stepStudyPractice(f.version.id, set.id, {
            generate: () => assert.fail('no spend for strangers'),
          }),
          /not found/,
        )
      },
    )
  }))
test('a withdrawn source prevents old practice and tutor retrieval', () =>
  fixture(async (f) => {
    const set = await extracted(f)
    const { compareAndSwapDocument } = await import('../lib/user-store.mjs')
    const old = await readDocument('study-notes', f.paper.id, null)
    await compareAndSwapDocument(
      'study-notes',
      f.paper.id,
      { ...old, deleted: true, revision: randomUUID() },
      old.revision,
    )
    assert.equal((await listStudyPractice(f.version.id)).length, 0)
    await assert.rejects(
      stepStudyPractice(f.version.id, set.id),
      /no longer accessible/,
    )
    await assert.rejects(
      studyTutorContext({
        studyVersionId: f.version.id,
        chapterId: 'addition',
      }),
      /no longer accessible/,
    )
  }))
test('grade quality contract rejects over-awards, missing criteria and wrong totals; uncertainty is unscored', () => {
  const q = { marks: 2 }
  const result = {
    assessable: true,
    feedback: 'Reasoning review',
    criteria: [
      { criterion: 'Calculation', earned: 2, possible: 2, feedback: 'Correct' },
    ],
    nextStep: 'Check units.',
  }
  assert.equal(canonicalGrade(result, q).earned, 2)
  assert.throws(
    () =>
      canonicalGrade(
        { ...result, criteria: [{ ...result.criteria[0], earned: 3 }] },
        q,
      ),
    /marks/,
  )
  assert.throws(() => canonicalGrade({ ...result, criteria: [] }, q), /marks/)
  assert.throws(() => canonicalGrade(result, { marks: 5 }), /marks/)
  assert.equal(canonicalGrade({ ...result, assessable: false }, q).earned, null)
})

test('concurrent identical generation requests create only one payable practice job', () =>
  fixture(async (f) => {
    const body = {
      ...f.base,
      mode: 'extract',
      questionSourceKey: f.paper.id,
      solutionSourceKey: f.solution.id,
    }
    const results = await Promise.all([
      createStudyPractice(f.version.id, body, { billing }),
      createStudyPractice(f.version.id, body, { billing }),
    ])
    assert.equal(results[0].id, results[1].id)
    assert.equal((await listStudyPractice(f.version.id)).length, 1)
  }))
test('exam assessment resolves the original revision and rejects an answer not saved in the exam', () =>
  fixture(async (f) => {
    const { createStudyExam, saveStudyExam } = await import(
      '../lib/study-version-store.mjs'
    )
    let exam = await createStudyExam(f.version.id, {
      revisionId: f.revision.id,
      count: 4,
    })
    const question = exam.questions[0]
    await assert.rejects(
      createStudyAssessment(f.version.id, {
        examId: exam.id,
        questionId: question.id,
        answer: 'Unsaved',
        saveOnly: true,
      }),
      /Save this answer/,
    )
    exam = await saveStudyExam(f.version.id, {
      id: exam.id,
      expectedRevision: exam.revision,
      questionId: question.id,
      answer: 'Five units',
    })
    const attempt = await createStudyAssessment(f.version.id, {
      examId: exam.id,
      questionId: question.id,
      answer: 'Five units',
      revisionId: 'tampered',
      topicId: 'tampered',
      saveOnly: true,
    })
    assert.equal(attempt.revisionId, f.revision.id)
    assert.equal(attempt.examId, exam.id)
  }))

test('verbatim extraction accepts a leaf question spanning overlapping retrieval chunks', async () => {
  const { joinedPracticeEvidence } = await import('../lib/study-practice.mjs')
  const chunks = [
    {
      id: 'a',
      sourceKey: 'paper',
      page: 1,
      text: '1c Jeffrey says the agent needs to understand code written for any purpose. Andi disagrees.',
    },
    {
      id: 'b',
      sourceKey: 'paper',
      page: 1,
      text: 'needs to understand code written for any purpose. Andi disagrees. Who is right? Explain why.',
    },
  ]
  const question =
    'Jeffrey says the agent needs to understand code written for any purpose. Andi disagrees. Who is right? Explain why.'
  assert.equal(joinedPracticeEvidence(chunks), '1c ' + question)
  const raw = {
    title: 'Paper',
    warnings: [],
    questions: [
      {
        label: '1c',
        question,
        sharedContext: '',
        type: 'written',
        options: [],
        correctOptions: [],
        marks: 2,
        page: 1,
        answer: '',
        answerBasis: 'unavailable',
        hint: '',
        difficulty: 'standard',
        sourceIds: ['a', 'b'],
        answerSourceIds: [],
        needsOriginal: false,
      },
    ],
  }
  assert.equal(
    validatePracticeSet(raw, {
      mode: 'extract',
      questionSourceKey: 'paper',
      snapshot: { chunks },
    }).questions[0].question,
    question,
  )
})

test('negative-marking questions do not silently use all-or-nothing scores', () => {
  const result = localPracticeGrade(
    {
      type: 'multi',
      question: 'Select all that apply; wrong answers give negative points.',
      answerBasis: 'source',
      answer: 'A and B',
      options: ['A', 'B', 'C'],
      correctOptions: [0, 1],
      marks: 2,
    },
    '0,2',
  )
  assert.equal(result.assessable, false)
  assert.equal(result.earned, null)
})
