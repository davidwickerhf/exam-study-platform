// Cookieless product analytics through the self-hosted Umami instance.
//
// The tracker loads from the root layout and only counts on the production
// hostname (data-domains). Every call is guarded so analytics can never break
// the app, and props must stay small enums, counts or opaque ids: never an
// email, a name, or text a student typed.

export const UMAMI_SCRIPT_URL = 'https://analytics.wicker.life/wa.js'
export const UMAMI_WEBSITE_ID = '259e0b2d-4573-4c5f-9369-a3df7d7add22'
export const UMAMI_DOMAINS = 'study.wicker.life'

type EventProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track: (event: string, props?: EventProps) => unknown }
  }
}

export function trackEvent(event: string, props?: EventProps) {
  if (typeof window === 'undefined') return
  try {
    void Promise.resolve(window.umami?.track(event, props)).catch(() => {})
  } catch {
    // Analytics is best-effort.
  }
}
