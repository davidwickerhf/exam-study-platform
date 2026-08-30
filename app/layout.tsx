import type { Metadata } from 'next'
import { IBM_Plex_Mono, Manrope } from 'next/font/google'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import '../public/styles.css'
import '../public/polish.css'
import '../public/system.css'
import '../public/dash.css'
import '../public/public-site.css'
import './next.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--next-font-ui',
  display: 'swap'
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--next-font-data',
  weight: ['400', '500', '600'],
  display: 'swap'
})

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
    <html lang="en" className={`${manrope.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  )
}
