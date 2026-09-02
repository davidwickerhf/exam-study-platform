export declare function legacyHashTarget(hash?: string): string | null
export declare function mergeBrowserState(local?: Record<string, string | null>, remote?: Record<string, string | null>): Record<string, string | null>
export declare function browserStateSnapshot(storage: Pick<Storage, 'length' | 'key' | 'getItem'> | null): Record<string, string | null>
