import type { Metadata } from 'next'
import { AppProviders } from '@/components/app-providers'
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
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || null
  return <AppProviders publishableKey={publishableKey}>
    <SharedCourseMaterials courseCode={code} authEnabled={Boolean(publishableKey && process.env.CLERK_SECRET_KEY)} />
  </AppProviders>
}
