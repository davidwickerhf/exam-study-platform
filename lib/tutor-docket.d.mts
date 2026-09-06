export function tutorDocket<P extends { id: string }, D>(messages: { proposals?: P[]; presentation?: { drafts: D[] } }[]): { proposals: P[]; drafts: D[] }
export function reusableTutorProposal<P>(existing: P[], proposal: P): P | undefined
