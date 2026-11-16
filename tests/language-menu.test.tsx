// @vitest-environment jsdom
// The top bar's language button (LanguageMenu, preview variant lang:a): a menu button with four menuitemradio items in
// their own languages, SourceMenu's keyboard, the top bar held shown while it is open, and the choice written to the
// cookie before a reload.
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useLayoutEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageMenu } from '@/components/app/LanguageMenu'
import { TopBar } from '@/components/app/TopBar'
import { withI18n } from './i18n-render'

vi.mock('next/navigation', () => ({ usePathname: () => '/settings', useRouter: () => ({ push: () => {}, prefetch: () => {} }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }))

/** How many holds on the top bar are live (useHoldTopBar mounted and not yet unmounted). */
const holds = vi.hoisted(() => ({ live: 0 }))
vi.mock('@/components/dialog-utils', async (orig) => ({
  ...(await orig<typeof import('@/components/dialog-utils')>()),
  useHoldTopBar: () => {
    useLayoutEffect(() => {
      holds.live++
      return () => { holds.live-- }
    }, [])
  },
}))

const reload = vi.fn()
const realLocation = window.location

beforeEach(() => {
  reload.mockReset()
  vi.stubGlobal('location', { host: realLocation.host, search: realLocation.search, protocol: realLocation.protocol, reload })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.cookie = 'everybird-lang=; Max-Age=0; Path=/'
  history.replaceState(null, '', '/')
})

const open = () => fireEvent.click(screen.getByRole('button', { name: /^Idioma/ }))

describe('LanguageMenu', () => {
  it('shows the current code and names the language for screen readers', () => {
    render(<LanguageMenu />, { wrapper: withI18n('es') })
    const btn = screen.getByRole('button', { name: 'Idioma: Español' })
    expect(btn).toHaveTextContent('ES')
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    cleanup()
    render(<LanguageMenu />, { wrapper: withI18n('nl') })
    expect(screen.getByRole('button', { name: 'Taal: Nederlands' })).toHaveTextContent('NL')
    cleanup()
    render(<LanguageMenu />, { wrapper: withI18n('en') })
    expect(screen.getByRole('button', { name: 'Language: English' })).toHaveTextContent('EN')
  })

  it('opens a menu of the four languages in their own names, current one checked', () => {
    render(<LanguageMenu />, { wrapper: withI18n('es') })
    expect(screen.queryByRole('menu')).toBeNull()
    open()
    expect(screen.getByRole('button', { name: /^Idioma/ })).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Idioma' })
    const items = screen.getAllByRole('menuitemradio')
    expect(menu).toContainElement(items[0])
    expect(items.map((i) => i.textContent)).toEqual(['English', 'Español', 'Português (Brasil)', 'Nederlands'])
    expect(items.map((i) => i.getAttribute('lang'))).toEqual(['en', 'es', 'pt-BR', 'nl'])
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false'])
    // Opening focuses the checked item.
    expect(items[1]).toHaveFocus()
  })

  it('arrows wrap, Home and End jump, Esc closes and focuses the button', () => {
    render(<LanguageMenu />, { wrapper: withI18n('nl') })
    fireEvent.click(screen.getByRole('button', { name: 'Taal: Nederlands' }))
    const items = screen.getAllByRole('menuitemradio')
    expect(items[3]).toHaveFocus()
    const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k })
    key('ArrowDown')
    expect(items[0]).toHaveFocus()
    key('ArrowUp')
    expect(items[3]).toHaveFocus()
    key('ArrowUp')
    expect(items[2]).toHaveFocus()
    key('Home')
    expect(items[0]).toHaveFocus()
    key('End')
    expect(items[3]).toHaveFocus()
    key('Escape')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'Taal: Nederlands' })).toHaveFocus()
    // ArrowDown on the button opens it too, on the checked item.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Taal: Nederlands' }), { key: 'ArrowDown' })
    expect(screen.getAllByRole('menuitemradio')[3]).toHaveFocus()
  })

  it('Tab and a press outside close it', () => {
    render(<><LanguageMenu /><p>outside</p></>, { wrapper: withI18n('en') })
    fireEvent.click(screen.getByRole('button', { name: /^Language/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Language/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByText('outside'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('picking Nederlands writes everybird-lang=nl and reloads; picking the current one only closes', () => {
    const set = vi.spyOn(Document.prototype, 'cookie', 'set')
    render(<LanguageMenu />, { wrapper: withI18n('es') })
    open()
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Español' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(set).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Idioma: Español' })).toHaveFocus()

    open()
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Nederlands' }))
    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0][0]).toMatch(/^everybird-lang=nl; Max-Age=31536000; Path=\/; SameSite=Lax/)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('holds the top bar shown while open', () => {
    render(<LanguageMenu />, { wrapper: withI18n('pt') })
    expect(holds.live).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Idioma: Português (Brasil)' }))
    expect(holds.live).toBe(1)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(holds.live).toBe(0)
  })

  it('variant b renders no top-bar control', () => {
    // Variant a (no ?v=): the language button sits right before the theme switch, in DOM and reading order.
    const { unmount } = render(<TopBar />, { wrapper: withI18n('es') })
    const lang = screen.getByRole('button', { name: 'Idioma: Español' })
    const theme = screen.getByRole('switch', { name: 'Modo oscuro' })
    expect(lang.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const controls = [...screen.getByTestId('topbar').querySelectorAll('a, button')]
    expect(controls.indexOf(theme) - controls.indexOf(lang)).toBe(1)
    unmount()

    history.replaceState(null, '', '/?v=lang:b')
    vi.stubGlobal('location', { host: realLocation.host, search: '?v=lang:b', protocol: realLocation.protocol, reload })
    act(() => { render(<TopBar />, { wrapper: withI18n('es') }) })
    expect(screen.queryByRole('button', { name: /^Idioma/ })).toBeNull()
    expect(screen.getByRole('switch', { name: 'Modo oscuro' })).toBeInTheDocument()
  })
})
