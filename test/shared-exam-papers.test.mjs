import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canOpenSharedExam, examMaterialKind, sharedExamCourseCode } from '../lib/shared-exam-policy.mjs'
import { safeAuthDestination } from '../lib/workspace/auth-session.mjs'

test('only exam PDFs enter the original-sharing review queue', () => {
  assert.equal(examMaterialKind({ filename: 'Past exam 2024.pdf' }), 'paper')
  assert.equal(examMaterialKind({ filename: 'Mock exam solutions.pdf' }), 'solutions')
  assert.equal(examMaterialKind({ filename: 'Solutions.pdf', sourcePath: 'Course/Exam 2025/Solutions.pdf' }), 'solutions')
  assert.equal(examMaterialKind({ filename: 'Lecture slides.pdf', sourcePath: 'Course/Exam preparation/Lecture slides.pdf' }), null)
  assert.equal(examMaterialKind({ filename: 'Assignment solutions.pdf' }), null)
  assert.equal(examMaterialKind({ filename: 'Past exam 2024.docx' }), null)
})

test('original-file access requires an eligible signed-in browser identity', () => {
  assert.equal(canOpenSharedExam(null), false)
  assert.equal(canOpenSharedExam({ authenticated: false, mode: 'clerk' }), false)
  assert.equal(canOpenSharedExam({ authenticated: true, mode: 'api-key', email: 'student@student.maastrichtuniversity.nl' }), false)
  assert.equal(canOpenSharedExam({ authenticated: true, mode: 'clerk', email: 'student@student.maastrichtuniversity.nl' }), true)
  assert.equal(canOpenSharedExam({ authenticated: true, mode: 'clerk', email: 'student@other.example' }), false)
  assert.equal(canOpenSharedExam({ authenticated: true, mode: 'clerk', email: 'reviewer@other.example', admin: true }), true)
})

test('course share links survive sign-in without accepting off-site redirects', () => {
  const origin = 'https://study.wicker.life'
  assert.equal(sharedExamCourseCode(' bcs1540 '), 'BCS1540')
  assert.equal(sharedExamCourseCode('..'), null)
  assert.equal(safeAuthDestination('/share/courses/BCS1540/exam-papers?year=2025', origin), '/share/courses/BCS1540/exam-papers?year=2025')
  assert.equal(safeAuthDestination('https://evil.example/share/courses/BCS1540/exam-papers', origin), '/app')
  assert.equal(safeAuthDestination('/share/courses/../exam-papers', origin), '/app')
})
