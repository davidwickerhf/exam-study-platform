export declare function safeAuthDestination(value: string | null | undefined, origin: string): string
export declare function createAuthenticatedFetch(options: {
  fetchImpl: typeof fetch
  origin: string
  onUnauthorized?: (failure: { error?: string; reason?: string } | null) => void
  isActive?: () => boolean
}): typeof fetch
