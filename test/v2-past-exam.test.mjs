import test from 'node:test'
import assert from 'node:assert/strict'
import { coursePapers, paperAssetHref, paperPdfHref, pastExamGradeRequest } from '../lib/workspace/past-exam.mjs'

test('paper arrays win and legacy single papers remain usable', () => {
  assert.equal(coursePapers({ mockExams: [{ id: 'x' }], mockExamPdf: 'old.pdf' })[0].id, 'x')
  assert.deepEqual(coursePapers({ mockExamPdf: 'exam.pdf', mockExamSolutionsPdf: 'answers.pdf' }), [{ id: 'default', label: 'Mock exam', pdf: 'exam.pdf', solutionsPdf: 'answers.pdf' }])
})

test('past-paper grading trims the attempt', () => assert.deepEqual(pastExamGradeRequest('q1', '  answer  '), { questionId: 'q1', attempt: 'answer' }))
test('asset paths encode every untrusted segment', () => assert.equal(paperAssetHref('a b', 'final/1', 'Figures/a b.png'), '/api/practice-exam-asset/a%20b/final%2F1/Figures/a%20b.png'))
test('paper PDF routes distinguish question and solution copies', () => { assert.equal(paperPdfHref('alg', 'final 1'), '/api/pdf/alg/final%201'); assert.equal(paperPdfHref('alg', 'final 1', true), '/api/pdf/alg/final%201/solutions') })
