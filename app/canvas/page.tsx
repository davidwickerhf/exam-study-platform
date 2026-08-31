import type { Metadata } from 'next'
import { CanvasArchive } from '@/components/canvas/canvas-archive'

export const metadata: Metadata = {
  title: 'Canvas archive',
  description: 'Choose Canvas course materials and create a private local archive.'
}

export default function CanvasArchivePage() {
  return <CanvasArchive />
}
