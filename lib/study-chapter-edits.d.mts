import type { StudyChapter } from './workspace/study-versions'
export function chapterEditFields(chapter: StudyChapter): { key: string; label: string; text: string }[]
export function chapterTextChanges(before: StudyChapter, after: StudyChapter): { key: string; label: string; before: string; after: string }[]
