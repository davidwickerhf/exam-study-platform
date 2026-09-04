export type UpdatePreferences = { scope: 'current' | 'all'; days: string; announcementSort: string; assignmentSort: string; assignmentState: string }
export declare const UPDATE_TABS: string[]
export declare const UPDATE_WINDOWS: [string, string][]
export declare const ANNOUNCEMENT_SORTS: [string, string][]
export declare const ASSIGNMENT_SORTS: [string, string][]
export declare const DEFAULT_PREFERENCES: UpdatePreferences
export declare function normalisePreferences(value?: Partial<UpdatePreferences>): UpdatePreferences
export declare function parsePreferences(serialized?: string | null): UpdatePreferences
export declare const PREFERENCES_KEY: string
export declare const SEEN_AT_KEY: string
export declare function readPreferences(storage?: Storage | null): UpdatePreferences
export declare function writePreferences(preferences: UpdatePreferences, storage?: Storage | null): UpdatePreferences
export declare function readSeenAt(storage?: Storage | null): string
export declare function markSeen(at?: string, storage?: Storage | null): string
export declare function canRecordAnnouncementVisit(hub?: { connected?: boolean; truncated?: boolean; problems?: { part?: string }[] }): boolean
export declare function isNewAnnouncement(item: any, since?: string): boolean
export declare function filterAnnouncements(items: any[], options?: any): any[]
export declare function assignmentState(status: string): string
export declare function updateBriefing(hub?: { announcements?: any[]; assignments?: any[]; problems?: { part?: string }[]; truncated?: boolean }, options?: { since?: string; now?: number }): { newAnnouncements: number | null; openAssignments: number | null; nextDeadline: any | null; announcementsAvailable: boolean; assignmentsAvailable: boolean; truncated: boolean }
export declare function filterAssignments(items: any[], options?: any): any[]
export declare function courseRows(hub: any, scope?: string): any[]
export declare function connectionOrigin(value: string): string | null
