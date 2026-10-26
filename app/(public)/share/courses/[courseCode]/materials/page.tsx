import type { Metadata } from 'next'
import { hostedAuthEnabled } from '@/lib/hosted-auth.mjs'
import { SharedCourseMaterials } from '@/components/site/shared-course-materials'
import { sharedExamCourseCode } from '@/lib/shared-exam-policy.mjs'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Shared course materials',
  description: 'Course files, indexed passages and practice for Maastricht University members.',
  robots: { index: false, follow: false }
}

export default async function SharedCourseMaterialsPage({ params }: { params: Promise<{ courseCode: string }> }) {
  const code = sharedExamCourseCode((await params).courseCode)
  if (!code) notFound()
  return <SharedCourseMaterials courseCode={code} authEnabled={hostedAuthEnabled()} />
}
