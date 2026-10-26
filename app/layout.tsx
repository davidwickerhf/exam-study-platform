import type { Metadata } from 'next'
import { Archivo, Archivo_Narrow } from 'next/font/google'
import { headers } from 'next/headers'
import Script from 'next/script'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import './tailwind.css'
import './public.css'
import './next.css'
import { cn } from "@/lib/utils";
import { UMAMI_DOMAINS, UMAMI_SCRIPT_URL, UMAMI_WEBSITE_ID } from "@/lib/analytics";



// Archivo is a grotesque drawn for high-performance print and signage, and
// Archivo Narrow is its condensed companion: the register of a departure
// board. Every numeral, course code and time in the product is set in the
// narrow cut, tabular, so columns line up at any size.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--next-font-ui',
  // shadcn components resolve type through --font-sans; the world's UI face
  // is Archivo, so it answers to both names rather than pulling in a second.
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  display: 'swap'
})

const archivoNarrow = Archivo_Narrow({
  subsets: ['latin'],
  variable: '--next-font-data',
  weight: ['400', '500', '600', '700'],
  display: 'swap'
})

// The direction this surface is built to, kept in the emitted markup so it
// survives the production build and can be audited against the render.
const DIRECTION_CONTRACT = `<!--
THESIS: Wicker Study turns a whole degree into one clear next move; the public
site refuses the generic feature-card landing page and lets the product prove it.
OWN-WORLD: warm academic canvas, near-black ink, signal indigo, broad grotesque
headings, narrow data, full-span rules, compact registers, and white working planes.
STORY: understand the promise, inspect a faithful Study Itinerary, follow the
source-to-action loop, then open a private workspace.
FIRST VIEWPORT: a poster-scale statement and compact action column lead into a
near-full-width real product composition; Plan, Follow, Study, Remember forms
its index, and the route reveal is the signature motion.
FORM: Study Control Room, dealt structure seven; seed 4cd51852.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`

export const metadata: Metadata = {
  metadataBase: new URL('https://study.wicker.life'),
  title: {
    default: 'Wicker Study — Academic exam preparation',
    template: '%s · Wicker Study'
  },
  description: 'A private, source-grounded academic workspace for structured university course study, practice, and exam readiness.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  manifest: '/site.webmanifest',
  applicationName: 'Wicker Study'
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // The strict CSP uses a fresh request nonce, so every document must be
  // rendered against the request headers rather than emitted as static HTML.
  await connection()
  // The proxy (and server.mjs locally) puts the per-request CSP nonce here.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" className={cn(archivo.variable, archivoNarrow.variable, "font-sans")} suppressHydrationWarning>
      <body>
        {/* eslint-disable-next-line react/no-danger */}
        <div dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        {children}
        {/* Cookieless Umami. Query strings and hashes are dropped because
            they can carry OAuth state, redirect targets and conversation ids;
            data-domains keeps localhost, previews and staging out. */}
        <Script
          src={UMAMI_SCRIPT_URL}
          strategy="afterInteractive"
          nonce={nonce}
          data-website-id={UMAMI_WEBSITE_ID}
          data-domains={UMAMI_DOMAINS}
          data-exclude-search="true"
          data-exclude-hash="true"
        />
      </body>
    </html>
  )
}
