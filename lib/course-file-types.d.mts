export function fileExtension(name: string): string;
export function isCodeFile(name: string): boolean;
export function isTextFile(name: string): boolean;
export function supportsTextExtraction(name: string): boolean;
export function fileKind(name: string, mediaType?: string): string;
export function cleanMaterialName(name: string): string;
export function courseFileMediaType(name: string): string | null;

export function needsExtractionUpgrade(
  name: string,
  asset: { extraction_status?: string; metadata?: Record<string, unknown> },
): boolean;
