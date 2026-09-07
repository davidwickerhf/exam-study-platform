export type CanvasGroup = {
  id:string; origin:string; name:string; scope:'course'|'global'; courseId:string|null; courseCode:string|null;
  courseName:string|null; academicYear:string|null; contextName:string|null; categoryId:string|null;
  memberCount:number|null; url:string; membership:'member';
  members:Array<{id:string;name:string;isYou:boolean|null}>|null; membersStatus:'not-loaded'|'loaded'|'unavailable'
}
export type CanvasGroupsPayload = {connected:boolean;groups:CanvasGroup[];problems:Array<{part:string;message:string;groupId?:string}>;matchedCourses:Array<{id:string;courseCode:string;academicYear:string}>;fetchedAt:string;refreshMinutes:number}
export function canvasGroupRecord(row:unknown, options?:unknown):CanvasGroup|null
export function fetchCanvasGroups(options?:unknown):Promise<CanvasGroupsPayload>
