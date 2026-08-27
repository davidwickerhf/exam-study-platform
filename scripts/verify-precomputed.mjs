#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const data = (...parts) => resolve(root, 'data', ...parts)
const state = JSON.parse(await readFile(data('study-state.template.json'), 'utf8'))
const flashcards = JSON.parse(await readFile(data('flashcards.template.json'), 'utf8'))
const activeCourses = (state.courses || []).filter((course) => !course.archived)
const failures = []
const totals = { courses: 0, chapters: 0, questions: 0, mockQuestions: 0, flashcards: 0, papers: 0, paperQuestions: 0 }

function isSupportChapter(chapter) {
  return /exam skills|cram sheets|self tests|worked drills|cipher workthroughs|cipher walkthroughs/i.test(chapter?.name || '')
}

async function requireJson(path, label, listKey) {
  if (!existsSync(path)) {
    failures.push(`${label}: missing ${path.slice(root.length + 1)}`)
    return null
  }
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    if (listKey && (!Array.isArray(parsed[listKey]) || parsed[listKey].length === 0)) {
      failures.push(`${label}: ${listKey} is empty`)
      return null
    }
    return parsed
  } catch (error) {
    failures.push(`${label}: invalid JSON (${error.message})`)
    return null
  }
}

for (const course of activeCourses) {
  totals.courses++
  const coreChapters = (course.chapters || []).filter((chapter) => !isSupportChapter(chapter))
  const courseCards = (flashcards.cards || []).filter((card) => card.courseId === course.id)
  const mockBank = await requireJson(data('cache', 'mock-questions', `${course.id}.json`), `${course.code} mock bank`, 'questions')
  totals.mockQuestions += mockBank?.questions?.length || 0

  for (const chapter of coreChapters) {
    totals.chapters++
    const bank = await requireJson(data('cache', 'questions', `${course.id}-${chapter.id}.json`), `${course.code} chapter ${chapter.id}`, 'questions')
    totals.questions += bank?.questions?.length || 0
    const cardCount = courseCards.filter((card) => card.chapterId === chapter.id).length
    totals.flashcards += cardCount
    if (!cardCount) failures.push(`${course.code} chapter ${chapter.id}: no prepared flashcards`)
  }

  for (const paper of [...(course.mockExams || []), ...(course.tutorials || [])]) {
    totals.papers++
    const key = `${course.id}__${paper.id}`
    const parsed = await requireJson(data('cache', 'practice-exam', `${key}.json`), `${course.code} ${paper.label}`, 'questions')
    totals.paperQuestions += parsed?.questions?.length || 0
    if (paper.pdf) await requireJson(data('cache', 'mock-toc', `${key}.json`), `${course.code} ${paper.label} outline`, 'items')
  }
}

if (failures.length) {
  console.error(`Precomputed content verification failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`Precomputed corpus ready: ${totals.courses} courses, ${totals.chapters} core chapters, ${totals.questions} self-test questions, ${totals.mockQuestions} course-wide questions, ${totals.flashcards} flashcards, ${totals.papers} papers/tutorials, ${totals.paperQuestions} parsed paper questions.`)
}
