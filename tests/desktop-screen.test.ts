// The desktop wallpaper's size follows the viewer's screen (desktopSize): the height stays 1080 and the width is 1080 ×
// the screen's shape, so the OS's "fill" has nothing to crop. The text keeps the normal margins and the vertical clearance
// (60 at the top, 110 at the bottom). The other formats, and the desktop with no usable screen (16:9), are pinned against
// the layouts and draw calls from before this change (the hashes below were taken from them).
import { createHash } from 'node:crypto'
import { en } from '@/i18n/messages/en'
import { es } from '@/i18n/messages/es'
import { nl } from '@/i18n/messages/nl'
import { pt } from '@/i18n/messages/pt'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CREDIT_MIN, IMAGE_SCALE, cardDims, cardLayout, clearStickerCache, desktopSize, drawShareImage, prepareCard, screenAspect, type CardFormat } from '@/lib/share/image'
import { entries, installStubs, NOW, pack, species } from './fixtures/share-image-harness'

afterEach(() => vi.unstubAllGlobals())

const MACBOOK_14 = 1512 / 982
const M = 64
/** The laptop text clearance: at least 60 from the top, 110 from the bottom (menu bar and notch, Dock and taskbar). */
const TOP_CLEAR = 60, BOTTOM_CLEAR = 110

describe('desktopSize', () => {
  it('is the screen shape at 1080 high, the width rounded', () => {
    expect(desktopSize(MACBOOK_14)).toEqual([1663, 1080])
    expect(desktopSize(1920 / 1080)).toEqual([1920, 1080])
    expect(desktopSize(1440 / 900)).toEqual([1728, 1080])
    expect(desktopSize(2560 / 1080)).toEqual([2560, 1080]) // ultrawide
  })

  it('takes the range ends (1.33 and 2.4) and falls back to 16:9 outside them, and without an aspect', () => {
    expect(desktopSize(1.33)).toEqual([1436, 1080])
    expect(desktopSize(2.4)).toEqual([2592, 1080])
    expect(desktopSize(1.32)).toEqual([1920, 1080])
    expect(desktopSize(2.41)).toEqual([1920, 1080])
    expect(desktopSize(390 / 844)).toEqual([1920, 1080]) // a phone is portrait
    expect(desktopSize(undefined)).toEqual([1920, 1080])
    expect(desktopSize(Number.NaN)).toEqual([1920, 1080])
    expect(desktopSize(Number.POSITIVE_INFINITY)).toEqual([1920, 1080])
  })

  it('reads a screen as width ÷ height, and nothing usable as undefined', () => {
    expect(screenAspect({ width: 1512, height: 982 })).toBeCloseTo(MACBOOK_14, 10)
    expect(screenAspect(undefined)).toBeUndefined()
    expect(screenAspect({ width: 0, height: 900 })).toBeUndefined()
    expect(screenAspect({ width: 1440, height: Number.NaN })).toBeUndefined()
  })

  it('is the desktop card dimension; the other formats ignore the screen', () => {
    expect(cardDims('desktop', MACBOOK_14)).toEqual([1663, 1080])
    expect(cardDims('desktop')).toEqual([1920, 1080])
    expect(cardDims('story', MACBOOK_14)).toEqual([1080, 1920])
    expect(cardDims('wide', MACBOOK_14)).toEqual([1350, 1080])
  })
})

const CONTENTS = [
  { name: true, filter: true, latest: true },
  { name: false, filter: false, latest: true },
  { name: true, filter: false, latest: false },
  { name: false, filter: false, latest: false },
]
const SHAPES: (number | undefined)[] = [MACBOOK_14, 1.33, 2.4, 1920 / 1080, undefined]

describe('the desktop text stays in the laptop safe zone', () => {
  for (const aspect of SHAPES) {
    for (const c of CONTENTS) {
      const name = `${aspect === undefined ? '16:9' : aspect.toFixed(3)}${c.name ? ' name' : ''}${c.filter ? ' filter' : ''}${c.latest ? ' latest' : ' no-latest'}`
      it(name, () => {
        const dims = cardDims('desktop', aspect)
        const L = cardLayout('desktop', { ...c, count: 197 }, dims)
        const [W, H] = dims
        expect(L.W).toBe(desktopSize(aspect)[0])
        expect(L.H).toBe(1080)
        // Top: the title (or the collage) clears the menu bar and notch.
        if (L.name) expect(L.name.y).toBeGreaterThanOrEqual(TOP_CLEAR)
        expect(L.collage.y).toBeGreaterThanOrEqual(TOP_CLEAR)
        // Bottom: the footer line (wordmark, site, credit) and the latest-lifer row end clear of the Dock.
        expect(H - (L.footer.y + L.footer.size)).toBeGreaterThanOrEqual(BOTTOM_CLEAR)
        if (L.latest) expect(H - (L.latest.y + L.latest.icon)).toBeGreaterThanOrEqual(BOTTOM_CLEAR)
        // Sides: the text stays inside the card at the normal margin, and the collage keeps M too.
        expect(L.footer.y).toBeGreaterThan(L.rule.y)
        expect(L.collage.x).toBe(M)
        expect(L.collage.x + L.collage.w).toBe(W - M)
        if (L.latest) expect(L.latest.x + L.latest.icon + 20 + L.latest.tw).toBeLessThanOrEqual(W - M)
      })
    }
  }

  it('a MacBook Pro 14 gets 1663 × 1080 units and a 3326 × 2160 PNG, the same shape as its screen', async () => {
    const logs = installStubs()
    const canvas = await drawShareImage({ format: 'desktop', theme: 'light', entries, species, pack, now: NOW, strings: en.ui, screenAspect: MACBOOK_14 })
    expect((canvas as unknown as { width: number; height: number }).width).toBe(3326)
    expect((canvas as unknown as { width: number; height: number }).height).toBe(2160)
    expect(logs.size).toBeGreaterThan(0)
    expect(canvas.width / canvas.height).toBeCloseTo(MACBOOK_14, 2)
    expect(IMAGE_SCALE.desktop).toBe(2)
  })

  it('with no usable screen it draws the 16:9 image, 3840 × 2160', async () => {
    installStubs()
    const canvas = await drawShareImage({ format: 'desktop', theme: 'light', entries, species, pack, now: NOW, strings: en.ui, screenAspect: 390 / 844 })
    expect((canvas as unknown as { width: number; height: number }).width).toBe(3840)
    expect((canvas as unknown as { width: number; height: number }).height).toBe(2160)
  })
})

describe('the one-line footer in the narrowest and widest desktop', () => {
  // The narrowest desktop (1.33) has 1,308 units of text; the widest (2.4) 2,464. A long name must be clipped so the credit
  // keeps CREDIT_MIN beside the wordmark, and the row stays inside the text band.
  const LONG = 'A Black-crowned Night-Heron of a very long name'
  for (const aspect of [1.33, 2.4]) {
    for (const [lang, m] of Object.entries({ en, es, nl, pt })) {
      it(`${aspect} ${lang}: the credit stays beside the wordmark at ${CREDIT_MIN}px or more, the name clipped`, async () => {
        installStubs() // the harness measures 0.6 em a character, whatever the font
        const opts = { format: 'desktop' as CardFormat, theme: 'light' as const, entries, species, pack, now: NOW, strings: m.ui, screenAspect: aspect, nameOf: () => LONG }
        const card = await prepareCard(opts, IMAGE_SCALE.desktop)
        const W = card.L.W
        expect(card.oneLine).toBeDefined()
        expect(card.credit.below).toBe(false)
        expect(card.credit.size).toBeGreaterThanOrEqual(CREDIT_MIN)
        const lineEnd = M + card.brandW + card.footerLine.length * 0.6 * card.credit.size
        expect(lineEnd).toBeLessThanOrEqual(card.oneLine!.x - 32)
        expect(card.oneLine!.nameText.endsWith('…')).toBe(true)
        const { icon } = card.L.latest!
        // The harness measures the name's font at 0.5 em a character (the mono label and footer at 0.6).
        const blockEnd = card.oneLine!.x + icon + 14 + card.oneLine!.labelW + 14 + card.oneLine!.nameText.length * 0.5 * card.L.latest!.name
        expect(blockEnd).toBeLessThanOrEqual(W - M + 1)
      })
    }
  }
})

// The hashes of every layout and every draw call from before this change (cardLayout and drawShareImage on the harness,
// over the content combinations, counts and themes below). A hash per format: the image formats are unchanged, and so is
// the desktop with no usable screen.
const BEFORE: Record<CardFormat | 'desktop', { layout: string; draws: string }> = {
  story: { layout: '42ea58674d4ee8d18505c49684fe983e7edf1b10', draws: 'b0ded4d027f4cc596410b35a1f4846b52e62ea3c' },
  post: { layout: '6385621f4f386188b50d6ff70c67618f6e3644a4', draws: '0518e41faffdfefc76fe286a74296ab4e54c8c56' },
  square: { layout: '9baa675c2529f2777654d3ec49d5940ebd5ad2f4', draws: '24075c510ce9b9e68892a3e731f3d63cd57a1b01' },
  wide: { layout: '4e9d6e75750df1125d6ac5c9c4159790b8af3f4b', draws: '44f52e9bb3bdd87d450385258b9e77289f5ce407' },
  print: { layout: 'bd2bbab39ecbf7d82d9e7aadffb714b7f2601f7c', draws: '1357a1f83954c8b9461ead75455dc42a4f2d1c7b' },
  printLandscape: { layout: '68b608dbefd61791383888516529cf2b1644805a', draws: 'b8db39bea513454e900b6c67feffea8f96cfee20' },
  desktop: { layout: '39c2e55ad22b18f3712a3b660f0852163a8387c2', draws: '36d34566acfdfd7ff74a84379e15813543de2cb6' },
}
const sha = (s: string) => createHash('sha1').update(s).digest('hex')

describe('the other formats, and the desktop with no screen, draw as before', () => {
  const FORMATS = Object.keys(BEFORE) as (CardFormat | 'desktop')[]
  for (const f of FORMATS) {
    it(`${f}: the layouts are unchanged`, () => {
      const out: Record<string, unknown> = {}
      for (const c of CONTENTS) for (const count of [12, 197, 1089]) out[`${f} ${JSON.stringify(c)} ${count}`] = cardLayout(f, { ...c, count })
      expect(sha(JSON.stringify(out))).toBe(BEFORE[f].layout)
    })
    it(`${f}: the draw calls are unchanged`, async () => {
      const out: Record<string, string[]> = {}
      for (const theme of ['light', 'dark'] as const) for (const name of [undefined, 'Ada Lovelace’s life list']) for (const filterLabel of [undefined, 'Perching birds · Canada + Egypt']) for (const latest of [true, false]) {
        const logs = installStubs()
        clearStickerCache()
        const canvas = await drawShareImage({ format: f, theme, name, filterLabel, latest, entries, species, pack, now: NOW, strings: en.ui, printSize: 'A2' } as never)
        out[`${f} ${theme} ${name ? 'name' : '-'} ${filterLabel ? 'filter' : '-'} ${latest ? 'latest' : 'nolatest'}`] = logs.get(canvas as unknown as object)!
        vi.unstubAllGlobals()
      }
      expect(sha(JSON.stringify(out))).toBe(BEFORE[f].draws)
    })
  }
})

