'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import { operatorName } from '@/lib/site-content'
import { ContactLink } from './contact-link'
import { SiteIcon } from './icon'

const links = [['/', 'Product'], ['/about', 'About'], ['/courses', 'Courses'], ['/docs', 'Docs']] as const

export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('public-mode')
    document.documentElement.classList.remove('app-mode')
    document.body.classList.add('public-mode')
    document.body.classList.remove('app-mode')
    const accountDeleted = new URLSearchParams(window.location.search).get('account-deleted') === '1'
    if (accountDeleted) {
      setDeleted(true)
      window.history.replaceState(null, '', window.location.pathname)
    }
    return () => {
      document.documentElement.classList.remove('public-mode')
      document.body.classList.remove('public-mode')
    }
  }, [])

  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div id="public-site" className={menuOpen ? 'site-menu-open' : undefined}>
        {deleted && (
          <div className="site-notice" role="status">
            <strong>Account deleted.</strong>
            <span>Your Wicker Study account and active personal study record were removed.</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setDeleted(false)}>×</button>
          </div>
        )}
        <header className="site-header">
          <Link className="site-brand" href="/" aria-label="Wicker Study home"><BrandMark className="site-brand-mark" /><strong>Wicker Study</strong></Link>
          <button className="site-menu-button" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen((open) => !open)}>
            <SiteIcon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <nav className="site-nav" aria-label="Primary navigation">
            {links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
            <Link className="site-nav-signin" href="/sign-in">Sign in</Link>
            <a className="site-button site-button-primary" href="/app">Open workspace <SiteIcon name="arrow" /></a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <div className="site-footer-main">
            <Link className="site-brand" href="/" aria-label="Wicker Study home"><BrandMark className="site-brand-mark" /><strong>Wicker Study</strong></Link>
            <p>A private academic workspace built around maintained university course material.</p>
          </div>
          <nav aria-label="Legal and product links">
            <Link href="/about">About</Link><Link href="/courses">Courses</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><ContactLink kind="info">Contact</ContactLink><Link href="/sign-in">Sign in</Link>
          </nav>
          <p className="site-footer-note">© 2026 {operatorName}, operating as Wicker Study. Essential authentication storage only; no advertising trackers.</p>
        </footer>
      </div>
    </>
  )
}
