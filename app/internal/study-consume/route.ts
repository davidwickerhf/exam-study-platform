// Separate queue capacity keeps long imports from blocking personal generation.
import { POST as consume } from '../canvas-consume/route'
export const maxDuration = 300
export const runtime = 'nodejs'
export const POST = consume
