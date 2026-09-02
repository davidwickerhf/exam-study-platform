export declare function embeddingConfiguration(): { configured: boolean; model: string; dimensions: number }
export declare function embedTexts(values?: string[]): Promise<(number[] | null)[]>
