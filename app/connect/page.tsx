import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AgentConnect } from '@/components/connect/agent-connect'

export const metadata: Metadata = {
  title: 'Connect an agent',
  description: 'Authorise a locally running agent to use your Wicker Study account.',
  robots: { index: false, follow: false }
}

export default function AgentConnectPage() {
  return (
    <Suspense fallback={null}>
      <AgentConnect />
    </Suspense>
  )
}
