import type { Metadata } from 'next'
import { SharedCourseArchive } from '@/components/site/shared-course-archive'

export const metadata: Metadata = {
  title: 'Course archive',
  description: 'Browse released Maastricht University course files and Wicker practice questions.',
  robots: { index: false, follow: false },
}

export default function SharedCourseArchivePage() {
  return <SharedCourseArchive />
}
