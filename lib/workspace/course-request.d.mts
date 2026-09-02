export declare const MAX_REQUEST_FILES: number
export declare const MAX_REQUEST_FILE_BYTES: number
export declare const MAX_REQUEST_TOTAL_BYTES: number
export declare const REQUEST_CHUNK_BYTES: number
export declare const REQUEST_STATUS_LABEL: Record<string, string>
export declare function validateRequestFiles<T extends { name: string; size: number }>(existing?: T[], incoming?: T[]): T[]
export declare function requestPayload(input: any): any
export declare function currentRequest(requests?: any[]): any | null
export declare function stageState(stages: any[], request: any): any[]
