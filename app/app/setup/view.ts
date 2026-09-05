/**
 * What `GET /api/onboarding` returns, and the one way this surface talks to it.
 *
 * The page, the finish action and the file control all read the same view, so
 * the shape lives here rather than being retyped beside each of them.
 */

import type { SetupSourceState } from '@/lib/workspace/setup.mjs'

export type Message = { role: 'user' | 'assistant' | 'event'; content: string; at: string | null }
export type Prompt = { kind: 'upload'; upload?: 'academic-work' | 'transcript' } | { kind: 'secure'; secure: 'timetable' | 'canvas' }
export type Opening = { step: string; heading: string; body: string; placeholder: string }
export type ProgrammeOption = { id: string; degree: string; name: string; durationYears: number; versions: { id: string; label: string; status: string }[] }
export type ElectiveGroup = { id: string; label: string; minSelections: number; maxSelections: number; answered?: boolean; chosen: string[]; courses: { id: string; code: string; name: string; ects: number }[] }

export type View = {
  available: boolean
  id: string
  name: string | null
  messages: Message[]
  prompt: Prompt | null
  skipped: string[]
  finished: boolean
  summary: string | null
  turns: number
  maxTurns: number
  opening: Opening | null
  state: SetupSourceState
}

export async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(90_000), headers: { accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } }).catch((error) => {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('This request took too long. Please try again.')
    throw error
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? `Setup returned ${response.status}`)
  return body as T
}
