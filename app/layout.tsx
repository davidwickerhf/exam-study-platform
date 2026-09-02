import type { Metadata } from 'next'
import { Archivo, Archivo_Narrow } from 'next/font/google'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import '../public/styles.css'
import '../public/polish.css'
import '../public/system.css'
import '../public/dash.css'
import '../public/public-site.css'
import './next.css'
import '../public/world.css'

// Archivo is a grotesque drawn for high-performance print and signage, and
// Archivo Narrow is its condensed companion: the register of a departure
// board. Every numeral, course code and time in the product is set in the
// narrow cut, tabular, so columns line up at any size.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--next-font-ui',
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
THESIS: a degree is a timetable, not a dashboard; this refuses the study-app
grid of same-size metric cards on off-white for the form the student's own
country uses for dense public truth — the departure board.
OWN-WORLD: ink ground, paper-white type, exactly one colour (signal blue)
marking what is live and never spent on decoration; long reading in punched
paper windows; rules never cards; Archivo, Archivo Narrow for all numerals,
always tabular; orthogonal, 2px radii, no soft shadow on the board.
STORY: opened at 01:35 to learn what is true tomorrow; the live row is the
only thing carrying colour, so it is read first, and acted on.
FIRST VIEWPORT: a board header ruling the top — period, week, the year's
eight blocks as a measure — then the next rows in date order, large and
tabular, one signal rule under the live row.
FORM: Dutch public information design (NS board, Crouwel, Total Design);
candidate 4 of seven; seed key wicker1.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
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
    <html lang="en" className={`${archivo.variable} ${archivoNarrow.variable}`} suppressHydrationWarning>
      <body>
        {/* eslint-disable-next-line react/no-danger */}
        <div dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        {children}
      </body>
    </html>
  )
}
