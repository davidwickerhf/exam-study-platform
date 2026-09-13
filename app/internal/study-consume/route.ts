// Long guide calls have independent runtime and delivery visibility.
import { createCanvasConsumer } from '@/lib/canvas-queue-consumer'
export const maxDuration = 800
export const runtime = 'nodejs'
export const POST = createCanvasConsumer(900)
