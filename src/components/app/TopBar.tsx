'use client'
// The top bar on every page, after the site's phone top bar (framer-site code-components/SiteNav.tsx): the Everybird
// wordmark home on the left, then Collage, Settings and About (the current page carries aria-current="page" and the
// site's active style: Surface fill, Hairline border, Accent), and the sun/moon theme switch on the right. One row
// down to 320px. Sticky with headroom (src/lib/headroom.ts): it slides out of view while the page scrolls down and back
// on any upward scroll, at the top, while a dialog holds it and while focus is inside it.
import Link from '@/components/app/IntentLink'
import { useEffect, useRef } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { useAppPath } from '@/i18n/path'
import { attachHeadroom } from '@/lib/headroom'
import { rememberVariants } from '@/lib/variants'
import { ThemeToggle } from './ThemeToggle'

const PAGES = [
  { href: '/', key: 'collage' },
  { href: '/settings', key: 'settings' },
  { href: '/about', key: 'about' },
] as const

export function TopBar() {
  // Unprefixed on the server (/es/settings) and in the browser (/settings) alike: the same aria-current both times.
  const path = useAppPath()
  const { t } = useI18n()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => (ref.current ? attachHeadroom(ref.current) : undefined), [])
  // Preview variants: a `?v=` on any page load is remembered for the tab (src/lib/variants.ts).
  useEffect(rememberVariants, [])
  return (
    <header ref={ref} className="eb-topbar" data-testid="topbar">
      <div className="eb-topbar-in">
        <Link href="/" className="eb-wordmark">Everybird</Link>
        <nav aria-label={t.shell.nav.label} className="eb-nav">
          <ul>
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="eb-nav-link" aria-current={path === p.href ? 'page' : undefined}>{t.shell.nav[p.key]}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  )
}
