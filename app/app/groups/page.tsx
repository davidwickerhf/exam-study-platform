import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { CanvasGroups } from '@/components/workspace/canvas-groups'
export default function GroupsPage() {
  return <main className="w-full min-w-0"><header className="border-b px-5 py-6 sm:px-8"><Link href="/app/courses" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeftIcon className="size-4"/>All courses</Link><h1 className="mt-4 text-3xl font-semibold tracking-tight">Canvas groups</h1></header><div className="mx-auto max-w-5xl px-5 py-8 sm:px-8"><CanvasGroups/></div></main>
}
