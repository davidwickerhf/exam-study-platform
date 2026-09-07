import type { CalendarEvent } from './workspace/home.mjs'
export function calendarLocalDay(event: CalendarEvent): string
export function isCalendarDeadline(event: CalendarEvent): boolean
export function calendarFilterMatches(event: CalendarEvent, filters: string[]): boolean
export function calendarDeadlineTime(event: CalendarEvent): string
