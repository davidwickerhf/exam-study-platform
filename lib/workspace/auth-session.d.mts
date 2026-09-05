export declare function safeAuthDestination(value: string | null | undefined, origin: string): string
export declare function createAuthenticatedFetch(options: {
  fetchImpl: typeof fetch
  getToken: (options?: { skipCache?: boolean }) => Promise<string | null>
  origin: string
  onUnauthorized?: (failure: { error?: string; reason?: string } | null) => void
  tokenTimeoutMs?: number
  isActive?: () => boolean
}): typeof fetch
