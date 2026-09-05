export type TourStep = { id: string; route: string; target: string; fallback?: string; title: string; body: string; hint?: string; mobileHint?: string }
export type TourRect = { left: number; top: number; right: number; bottom: number; width: number; height: number }
export declare const TOUR_STEPS: readonly TourStep[]
export declare function tourPosition(anchor: TourRect | null, panel: { width: number; height: number }, viewport: { width: number; height: number }): { left: number; top: number; width: number }
