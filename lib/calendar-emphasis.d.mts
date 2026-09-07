import type { CalendarEvent } from './workspace/home.mjs'
export declare function calendarEventEmphasis(event: Partial<CalendarEvent>): {label:string;tone:'required'|'deadline'|'neutral'|'unknown'}
