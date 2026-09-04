import type { Metadata } from 'next'
import { Archivo, Archivo_Narrow } from 'next/font/google'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import './tailwind.css'
import './public.css'
import './next.css'
import { cn } from "@/lib/utils";



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
OWN-WORLD: warm academic canvas, near-black ink, signal indigo, narrow display
type, full-span rules, compact registers, and white working planes.
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

  return (
    <html lang="en" className={cn(archivo.variable, archivoNarrow.variable, "font-sans")} suppressHydrationWarning>
      <body>
        {/* eslint-disable-next-line react/no-danger */}
        <div dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        {children}
      </body>
    </html>
  )
}
