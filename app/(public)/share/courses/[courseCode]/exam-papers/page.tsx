import type { Metadata } from 'next'
import { AppProviders } from '@/components/app-providers'
import { SharedExamPapers } from '@/components/site/shared-exam-papers'
import { sharedExamCourseCode } from '@/lib/shared-exam-policy.mjs'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Shared exam papers',
  description: 'Browse exam papers shared with verified Maastricht University members.',
  robots: { index: false, follow: false }
}

export default async function SharedExamPapersPage({ params }: { params: Promise<{ courseCode: string }> }) {
  const code = sharedExamCourseCode((await params).courseCode)
  if (!code) notFound()
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || null
  const authEnabled = Boolean(publishableKey && process.env.CLERK_SECRET_KEY)
  return <AppProviders publishableKey={publishableKey}>
    <SharedExamPapers courseCode={code} authEnabled={authEnabled} />
  </AppProviders>
}
