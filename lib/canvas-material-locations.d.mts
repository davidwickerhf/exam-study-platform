export type MaterialLocation = {moduleId?:string|null;moduleName?:string|null;modulePosition?:number|null;itemPosition?:number|null;assignmentId?:string|null;assignmentTitle?:string|null}
export function materialModuleNames(material: {sourcePath?:string;locations?:MaterialLocation[]}): string[]
export function materialLocations(records: {path?:string;target?:string;source?:MaterialLocation}[], path: string): MaterialLocation[]
