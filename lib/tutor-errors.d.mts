export type TutorFailure = { code: string; title: string; message: string; retryable: boolean; retryLabel: string }
export function tutorFailure(error: unknown, stopped?: boolean): TutorFailure
export function providerFailure(status: number, body: unknown): TutorFailure
