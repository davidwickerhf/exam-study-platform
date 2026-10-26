import type { Metadata } from 'next'
import { hostedAuthEnabled } from '@/lib/hosted-auth.mjs'
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
  return <SharedExamPapers courseCode={code} authEnabled={hostedAuthEnabled()} />
}
