'use client'
import { useParams } from 'next/navigation'
import { SharedStudyPage } from '@/components/workspace/shared-study-page'
export default function Page() {
  const { publicationId } = useParams<{ publicationId: string }>()
  return <SharedStudyPage id={publicationId} publicView />
}
