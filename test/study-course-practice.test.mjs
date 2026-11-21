import { createStudyPractice } from '../lib/study-practice.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, writeDocument } from '../lib/user-store.mjs'
import { activeProgrammeId } from '../lib/programme-scope.mjs'
import {
  courseExerciseBank,
  coursePracticeHost,
  practiceQuestionFromStudy,
} from '../lib/study-course-practice.mjs'
import { coursePaperBank } from '../lib/study-paper-bank.mjs'
import {
  listOwnStudyVersions,
  createStudyVersion,
  saveStudyRevision,
  mutateStudyVersion,
} from '../lib/study-version-store.mjs'
import {
  addStudyNote,
  readStudySourceSnapshot,
} from '../lib/study-version-sources.mjs'
import { course, lesson } from '../scripts/verification/study-fixtures.mjs'
import { studyLessonQuality } from '../lib/study-content-quality.mjs'

test('course bank spans retakes, deduplicates refreshed questions, and isolates programme, owner and withdrawn sources', async () => {
  await withRequestContext(
    { userId: `course-bank-${randomUUID()}`, mode: 'local' },
    async () => {
      try {
        const programmeId = await activeProgrammeId()
        const note = await addStudyNote({ ...course, title: 'Source' }, [
          {
            page: 1,
            text: 'Addition combines disjoint quantities with matching units. Two plus three is five.',
          },
        ])
        const snapshot = await readStudySourceSnapshot(course, [note.id])
        async function guide(year, programme, title) {
          const v = await createStudyVersion(
            { ...course, academicYear: year },
            programme,
            snapshot,
            { title },
          )
          const r = await saveStudyRevision(v, {
            ...v.draft,
            chapters: [
              {
                ...lesson(snapshot.chunks.map((c) => c.id)),
                id: 'addition',
                review: title === 'Edited guide' ? 'student-edited' : 'passed',
                questions: [
                  {
                    id: 'q1',
                    question: title === 'Edited guide' ? 'Explain the edited method.' : 'Compute the total.',
                    answer: 'Five.',
                    type: 'calc',
                    difficulty: 'standard',
                  },
                ],
              },
            ],
            topics: [],
          })
          await mutateStudyVersion(v.id, (value) => {
            value.activeRevisionId = r.id
            value.history = [{ id: r.id }]
            value.draft = null
          })
          return { v, r }
        }
        const { v, r } = await guide('2024-2025', programmeId, 'Earlier guide')
        await guide('2026-2027', programmeId, 'Refreshed guide')
        await guide('2026-2027', programmeId, 'Edited guide')
        await guide(
          '2026-2027',
          'other-programme',
          'Private to other programme',
        )
        await writeDocument('study-practice', 'extra-set', {
          id: 'extra-set',
          versionId: v.id,
          revisionId: r.id,
          topicId: 'addition',
          chapterTitle: 'Addition',
          course: v.course,
          snapshot,
          kind: 'set',
          mode: 'generate',
          status: 'complete',
          result: {
            questions: [
              {
                id: 'q1',
                question: 'Diagnose double counting.',
                answer: 'Count the overlap once.',
                type: 'written',
                difficulty: 'challenge',
              },
            ],
          },
        })
        const bank = await courseExerciseBank(course.courseCode)
        assert.equal(bank.questions.length, 3)
        assert.match(bank.questions.find(q => q.question === 'Explain the edited method.').source, /^Personal edit/)
        assert.equal(
          bank.questions.find((q) => q.question === 'Compute the total.').type,
          'calc',
        )
        assert.equal(
          bank.questions.find((q) => q.question === 'Diagnose double counting.')
            .study.setId,
          'extra-set',
        )
        assert.equal((await courseExerciseBank('OTHER101')).questions.length, 0)
        await withRequestContext(
          { userId: `other-${randomUUID()}`, mode: 'local' },
          async () =>
            assert.equal(
              (await courseExerciseBank(course.courseCode)).questions.length,
              0,
            ),
        )
        await writeDocument('study-notes', note.id, { ...note, deleted: true })
        assert.equal(
          (await courseExerciseBank(course.courseCode)).questions.length,
          0,
        )
      } finally {
        await deleteAllDocuments()
      }
    },
  )
})

test('papers can be listed and prepared without a teaching version, including concurrent workspace creation', async () => {
  await withRequestContext(
    { userId: `paper-host-${randomUUID()}`, mode: 'local' },
    async () => {
      try {
        const programmeId = await activeProgrammeId()
        const bank = await coursePaperBank(
          { course, programmeId },
          {
            sourceOptions: {
              editorialSources: async () => [
                {
                  key: 'paper',
                  title: 'Practice exam.pdf',
                  kind: 'editorial',
                  academicYear: '2024-2025',
                  pages: [],
                },
              ],
            },
          },
        )
        assert.equal(bank.papers.length, 1)
        assert.equal((await listOwnStudyVersions()).length, 0)
        const [a, b] = await Promise.all([
          coursePracticeHost(course, programmeId),
          coursePracticeHost(course, programmeId),
        ])
        assert.equal(a.id, b.id)
        assert.equal(a.draft, null)
        const note = await addStudyNote({ ...course, title: 'Practice exam.pdf' }, [{ page: 1, text: '1. What is two plus three? Explain your reasoning. [2 marks]' }])
        const set = await createStudyPractice(a.id, { revisionId: a.activeRevisionId, mode: 'extract', questionSourceKey: note.id }, { billing: { source: 'platform', model: 'gpt-5-mini', maxJobUsd: 1 } })
        assert.equal(set.topicId, 'course-paper')
        assert.equal(set.status, 'pending')

        assert.equal((await listOwnStudyVersions()).length, 0)
      } finally {
        await deleteAllDocuments()
      }
    },
  )
})

test('generated questions preserve Practice types and reject broken choice keys without rewriting old written questions', () => {
  const q = practiceQuestionFromStudy(
    {
      id: 'q1',
      question: 'Choose.',
      answer: 'B, because…',
      type: 'mc',
      options: ['A', 'B'],
      difficulty: 'challenge',
    },
    { course, versionId: 'v', revisionId: 'r', topicId: 't', title: 'Guide' },
  )
  assert.deepEqual(q.options, ['A', 'B'])
  assert.equal(q.expected, 'B, because…')
  assert.equal(q.difficulty, 'hard')
  const chapter = lesson(['e1'])
  assert.equal(
    studyLessonQuality(chapter).some((i) => i.includes('Choice questions')),
    false,
  )
  chapter.questions[0] = {
    ...chapter.questions[0],
    type: 'mc',
    options: ['A', 'A'],
    correctOptions: [8],
  }
  assert.equal(
    studyLessonQuality(chapter).some((i) => i.includes('Choice questions')),
    true,
  )
})

test('the global question bank includes checked original papers without a guide and preserves provenance and isolation', async () => {
  await withRequestContext({ userId: `paper-overview-${randomUUID()}`, mode: 'local' }, async () => {
    try {
      const programmeId = await activeProgrammeId()
      const host = await coursePracticeHost(course, programmeId)
      const other = await coursePracticeHost(course, 'another-programme')
      const note = await addStudyNote({ ...course, title: 'Original mock exam.pdf' }, [{ page: 1, text: 'Question 1. Explain why addition requires disjoint groups. [2 marks]' }])
      const snapshot = await readStudySourceSnapshot(course, [note.id])
      const set = { id: 'paper-set', versionId: host.id, revisionId: host.activeRevisionId, topicId: 'course-paper', chapterTitle: 'Original mock exam', course, snapshot, kind: 'set', mode: 'extract', status: 'complete', result: { title: 'Original mock exam · pages 1–2', questions: [{ id: 'q1', label: 'Q1(a)', question: 'Explain why addition requires disjoint groups.', answer: 'An overlap would be counted twice.', marks: 2, type: 'written' }] } }
      await writeDocument('study-practice', set.id, set)
      await writeDocument('study-practice', 'pending-paper', { ...set, id: 'pending-paper', status: 'pending' })
      await writeDocument('study-practice', 'other-paper', { ...set, id: 'other-paper', versionId: other.id })
      const bank = await courseExerciseBank(course.courseCode)
      assert.equal(bank.questions.length, 1)
      assert.equal(bank.questions[0].practiceOrigin, 'paper')
      assert.equal(bank.questions[0].paperLabel, 'Q1(a)')
      assert.equal(bank.questions[0].marks, 2)
      assert.equal(bank.questions[0].guideTitle, set.result.title)
      assert.equal(bank.questions[0].study.setId, set.id)
      assert.match(bank.questions[0].source, /^Course paper/)
      assert.equal((await courseExerciseBank('UNRELATED')).questions.length, 0)
      const assessment = { id: 'saved-answer', kind: 'assessment', versionId: host.id, revisionId: host.activeRevisionId, topicId: set.topicId, setId: set.id, question: set.result.questions[0], answer: 'The overlap would be counted twice.', status: 'complete', createdAt: '2026-09-15T10:00:00Z', result: { assessable: true, earned: 1, possible: 2, feedback: 'Correct idea.', nextStep: 'Give an example.' } }
      await writeDocument('study-practice', assessment.id, assessment)
      await writeDocument('study-practice', 'exam-answer', { ...assessment, id: 'exam-answer', examId: 'timed-exam', answer: 'Separate exam answer.', createdAt: '2026-09-15T12:00:00Z' })
      const restored = (await courseExerciseBank(course.courseCode)).questions[0].savedAttempt
      assert.equal(restored.answer, assessment.answer)
      assert.equal(restored.result.score, 5)
      assert.match(restored.result.correction, /Correct idea/)
      await writeDocument('study-practice', assessment.id, { ...assessment, status: 'pending', result: null })
      assert.equal((await courseExerciseBank(course.courseCode)).questions[0].savedAttempt.result, null)

      await writeDocument('study-notes', note.id, { ...note, deleted: true })
      assert.equal((await courseExerciseBank(course.courseCode)).questions.length, 0)
    } finally { await deleteAllDocuments() }
  })
})
