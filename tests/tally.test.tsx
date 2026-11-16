// @vitest-environment jsdom
// Tally's screen-reader text: the settled count in a polite live region, in the UI language (English pinned byte for byte).
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Tally } from '@/components/collage/Tally'
import { withI18n } from './i18n-render'

afterEach(cleanup)

const live = (container: HTMLElement) => container.querySelector('[aria-live="polite"]')

describe('Tally live text', () => {
  it('English: "12 species", "1 species" (never "1 specie"), "1,089 species", "0 species"', () => {
    for (const [n, text] of [[12, '12 species'], [1, '1 species'], [1089, '1,089 species'], [0, '0 species']] as const) {
      const { container, unmount } = render(<Tally value={n} />, { wrapper: withI18n('en') })
      expect(live(container)).toHaveTextContent(new RegExp(`^${text}$`))
      expect(container.querySelector('.eb-mono')).toHaveTextContent('species')
      unmount()
    }
  })
  it('follows the language: grouping and the one/other forms', () => {
    const es = render(<Tally value={1089} />, { wrapper: withI18n('es') })
    expect(live(es.container)).toHaveTextContent(/^1\.089 especies$/)
    es.unmount()
    const pt = render(<Tally value={1} />, { wrapper: withI18n('pt') })
    expect(live(pt.container)).toHaveTextContent(/^1 espécie$/)
  })
})
