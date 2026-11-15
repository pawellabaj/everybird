// @vitest-environment jsdom
// The language preference cookie (src/i18n/choose.ts) and the provider's refresh of it on every page load.
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { refreshLangCookie, setLangCookie } from '@/i18n/choose'
import { withI18n } from './i18n-render'

/** A stand-in document recording every cookie write. */
function fakeDoc(cookie: string, protocol = 'https:') {
  const writes: string[] = []
  return { writes, location: { protocol }, get cookie() { return cookie }, set cookie(v: string) { writes.push(v) } }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.cookie = 'everybird-lang=; Max-Age=0; Path=/'
})

describe('the language cookie', () => {
  it('re-writes a present cookie on load and never creates one', () => {
    const present = fakeDoc('theme=x; everybird-lang=es')
    refreshLangCookie(present)
    expect(present.writes).toEqual(['everybird-lang=es; Max-Age=31536000; Path=/; SameSite=Lax; Secure'])

    for (const c of ['', 'theme=x', 'everybird-lang=fr', 'everybird-lang=', 'my-everybird-lang=es']) {
      const doc = fakeDoc(c)
      refreshLangCookie(doc)
      expect(doc.writes, c).toEqual([])
    }

    // On http (local servers) there is no Secure.
    const http = fakeDoc('everybird-lang=nl', 'http:')
    setLangCookie('nl', http)
    expect(http.writes).toEqual(['everybird-lang=nl; Max-Age=31536000; Path=/; SameSite=Lax'])

    // The provider does it once on mount, with the real document.
    const set = vi.spyOn(Document.prototype, 'cookie', 'set')
    render(<p>page</p>, { wrapper: withI18n('en') })
    expect(set).not.toHaveBeenCalled()
    cleanup()
    set.mockRestore()
    document.cookie = 'everybird-lang=pt; Path=/'
    const set2 = vi.spyOn(Document.prototype, 'cookie', 'set')
    render(<p>page</p>, { wrapper: withI18n('en') })
    expect(set2).toHaveBeenCalledTimes(1)
    expect(set2.mock.calls[0][0]).toMatch(/^everybird-lang=pt; Max-Age=31536000; Path=\/; SameSite=Lax/)
  })
})
