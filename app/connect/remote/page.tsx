import { Suspense } from 'react'
import { RemoteConnect } from '@/components/connect/remote-connect'

export const metadata = { title: 'Connect a service', robots: { index: false, follow: false } }
export default function Page() { return <Suspense><RemoteConnect /></Suspense> }
