// The horizontal share images (desktop 16:9, wide 5:4) and the landscape poster's layouts: everything inside the card and
// clear of the platform's chrome, the latest row beside the footer where the card is wide and short, the packed collage
// filling the frame, the 2x desktop canvas, and the analytics allow-lists. Synthetic birds for the layout and the canvas;
// real masks and masses (public/data, as count-box.test.ts) for the packing. The print sizes are in print-landscape.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { en } from '@/i18n/messages/en'
import { es } from '@/i18n/messages/es'
import { nl } from '@/i18n/messages/nl'
import { pt } from '@/i18n/messages/pt'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ALLOWED as APP_ALLOWED } from '@/lib/analytics'
import { holeRects, rectGap, type Hole, type Rect } from '@/lib/layout/count-box'
import { decodeMask, maskCell, type Mask } from '@/lib/layout/mask'
import { packFrame, type PackBird, type PackResult } from '@/lib/layout/pack'
import { ALLOWED as WORKER_ALLOWED } from '../workers/stats/src/event'
import {
  IMAGE_SCALE, IMAGE_SIZE, SAFE, SPREAD, cardLayout, drawShareImage, fitPack, imageShape, isPrint, maxTileSide, packSpec,
  prepareCard, spreadY, type CardFormat, type ImagePack,
} from '@/lib/share/image'
import { installStubs, NOW, entries, pack as harnessPack, species } from './fixtures/share-image-harness'

afterEach(() => vi.unstubAllGlobals())

const M = 64
/** The gap between the footer line and the latest row beside it (image.ts FOOTER_GAP). */
const FOOTER_GAP = 32
const LANDSCAPE: CardFormat[] = ['desktop', 'wide', 'printLandscape']
const CONTENTS = [
  { name: true, filter: true, latest: true },
  { name: false, filter: false, latest: true },
  { name: true, filter: false, latest: false },
  { name: false, filter: false, latest: false },
]

// The real masks and masses, as count-box.test.ts loads them.
const DATA = resolve(__dirname, '../public/data')
let POOL: PackBird[] = []
beforeAll(() => {
  const masks = new Map<string, Mask>()
  for (const f of readdirSync(resolve(DATA, 'masks')).sort()) {
    const rec = JSON.parse(readFileSync(resolve(DATA, 'masks', f), 'utf8')) as Record<string, [number, number, string]>
    for (const [code, m] of Object.entries(rec)) masks.set(code, decodeMask(m))
  }
  const rows = (JSON.parse(readFileSync(resolve(DATA, 'species.v1.json'), 'utf8')).species as { code: string; g: number }[])
    .filter((s) => masks.has(s.code))
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  POOL = rows.map((s, i) => ({ id: i, mass: s.g, mask: masks.get(s.code)! }))
})
const sample = (n: number) => { const step = POOL.length / n; return Array.from({ length: n }, (_, i) => POOL[Math.floor(i * step)]) }

/** Silhouette cells of every placed sticker as rects about the frame's centre (count-box.test.ts's clash). */
function clash(birds: PackBird[], r: PackResult, hole: Hole, slack = 2) {
  const cx = r.W / 2, cy = r.H / 2
  const byId = new Map(birds.map((b) => [b.id, b]))
  let onText = 0, inAir = 0
  for (const [id, [x, y, w, h]] of r.boxes) {
    const m = byId.get(id)!.mask
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      if (!maskCell(m, i, j)) continue
      const sx = w / m.w, sy = h / m.h
      const c: Rect = [x + i * sx - cx, y + j * sy - cy, x + (i + 1) * sx - cx, y + (j + 1) * sy - cy]
      const d = Math.min(...holeRects(hole).map((t) => rectGap(c, t)))
      if (d <= 0) onText++
      if (d < hole.pad - slack) inAir++
    }
  }
  return { onText, inAir }
}

/** The collage's fill of its frame: the bounding box of the drawn stickers over the collage, as image.ts draws them. */
function fill(format: CardFormat, n: number) {
  const L = cardLayout(format, { name: true, filter: false, latest: true, count: n })
  const spec = packSpec(L)
  const r = packFrame(sample(n), spec.aspect, spec)
  const pack: ImagePack = { W: r.W, H: r.H, boxes: new Map([...r.boxes].map(([id, b]) => [String(id), b])) }
  const fit = fitPack(pack, L.collage, maxTileSide(L.collage.w, L.maxTile, L.maxSide), SPREAD[format])
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [, [bx, by, bw, bh]] of pack.boxes) {
    const x = fit.cx + (bx - fit.ux) * fit.s, w = bw * fit.s, h = bh * fit.s
    const y = spreadY(fit, by + bh / 2) - h / 2
    x0 = Math.min(x0, x); x1 = Math.max(x1, x + w); y0 = Math.min(y0, y); y1 = Math.max(y1, y + h)
  }
  return { x: (x1 - x0) / L.collage.w, y: (y1 - y0) / L.collage.h, L, r, fit }
}

describe('the orientation shapes', () => {
  it('turns story into desktop and post into wide when horizontal, and keeps square square', () => {
    expect(imageShape('story', 'vertical')).toBe('story')
    expect(imageShape('post', 'vertical')).toBe('post')
    expect(imageShape('story', 'horizontal')).toBe('desktop')
    expect(imageShape('post', 'horizontal')).toBe('wide')
    expect(imageShape('square', 'horizontal')).toBe('square')
    expect(IMAGE_SIZE.desktop).toEqual([1920, 1080])
    expect(IMAGE_SIZE.wide).toEqual([1350, 1080])
    expect(IMAGE_SCALE.desktop).toBe(2) // the PNG is 3840 × 2160
    expect(IMAGE_SCALE.wide).toBe(1)
  })

  it('tells a poster from a share image', () => {
    expect(isPrint('printLandscape') && isPrint('print')).toBe(true)
    expect(isPrint('desktop') || isPrint('story')).toBe(false)
  })
})

describe('the landscape layouts', () => {
  for (const format of LANDSCAPE) {
    for (const c of CONTENTS) {
      const name = `${format}${c.name ? ' name' : ''}${c.filter ? ' filter' : ''}${c.latest ? ' latest' : ' no-latest'}`
      it(`${name}: everything inside the card and clear of the menu bar, the Dock and each other`, () => {
        const L = cardLayout(format, { ...c, count: 197 })
        const { x, y, w, h } = L.collage
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x + w).toBeLessThanOrEqual(L.W)
        expect(y).toBeGreaterThanOrEqual(SAFE[format].top)
        if (L.name) expect(L.name.y).toBeGreaterThanOrEqual(SAFE[format].top)
        // The footer's line stays above the bottom safe line (the Dock on a desktop).
        expect(L.footer.y + L.footer.size).toBeLessThanOrEqual(L.H - SAFE[format].bottom)
        expect(L.footer.y).toBeGreaterThan(L.rule.y)
        if (L.latest) {
          expect(L.latest.x).toBeGreaterThanOrEqual(M)
          expect(L.latest.x + L.latest.icon + 20 + L.latest.tw).toBeLessThanOrEqual(L.W - M)
          expect(L.latest.y + L.latest.icon).toBeLessThanOrEqual(L.footer.y + L.footer.size)
          if (L.latest.beside) expect(L.latest.y).toBeGreaterThan(L.rule.y)
          // Nothing of the collage sits on the latest row or the rule.
          expect(y + h).toBeLessThanOrEqual(L.latest.beside ? L.rule.y : L.latest.y)
        } else {
          expect(y + h).toBeLessThanOrEqual(L.rule.y)
        }
      })
    }
  }

  it('the latest row goes beside the footer where the card is wide, and stacks in the 5:4 wide post', () => {
    const content = { name: true, filter: true, latest: true, count: 197 }
    expect(cardLayout('desktop', content).latest?.beside).toBe(true)
    expect(cardLayout('printLandscape', content).latest?.beside).toBe(true)
    expect(cardLayout('wide', content).latest?.beside).toBe(false)
    expect(cardLayout('wide', content).latest?.x).toBe(M)
  })

  it('the row beside the footer gives the wide, short desktop collage back its row height (about 60 units)', () => {
    // Stacked, the row sits above the hairline (the footer's line less 30, then the gap and the row's icon) and the
    // collage ends 32 above the row; beside, the hairline moves up above the row, so the collage ends 60 units lower.
    const L = cardLayout('desktop', { name: true, filter: false, latest: true, count: 197 })
    const footerTop = L.footer.y
    const stackedBottom = footerTop - 30 - 24 - 76 - 32
    expect(L.collage.y + L.collage.h - stackedBottom).toBeCloseTo(60, 0)
  })
})

describe('the footer beside the latest row fits in every language', () => {
  for (const [lang, m] of Object.entries({ en, es, nl, pt })) {
    it(`${lang}: the footer line stays on the wordmark's line, never on its own line, clear of the row`, async () => {
      for (const format of ['desktop', 'printLandscape'] as const) {
        const opts = { format, theme: 'light' as const, entries, species, pack: harnessPack, now: NOW, strings: m.ui, ...(format === 'printLandscape' ? { printSize: 'A2' as const } : {}) }
        const card = await prepareCard(opts, format === 'desktop' ? IMAGE_SCALE.desktop : 1)
        expect(card.credit.below).toBe(false)
        expect(card.credit.size).toBeGreaterThanOrEqual(17)
        // The estimate measureText makes without a DOM (0.6 em a character in mono): the line ends before the row's column.
        const lineEnd = M + card.brandW + card.footerLine.length * 0.6 * card.credit.size
        expect(lineEnd).toBeLessThanOrEqual(card.L.latest!.x - FOOTER_GAP)
      }
    })
  }
})

describe('the packed collage uses the frame', () => {
  for (const format of LANDSCAPE) {
    for (const n of [197, 1089]) {
      it(`${format}, ${n} species: the stickers reach the frame's edges both ways`, () => {
        const f = fill(format, n)
        expect(f.x).toBeGreaterThan(0.95)
        expect(f.y).toBeGreaterThan(0.95)
      }, 60_000)
    }
    it(`${format}, 12 species: a short list still fills the frame's height and most of its width`, () => {
      const f = fill(format, 12)
      expect(f.x).toBeGreaterThan(0.8)
      expect(f.y).toBeGreaterThan(0.9)
    }, 60_000)
  }

  for (const format of LANDSCAPE) {
    for (const n of [197, 1089]) {
      it(`${format}, ${n} species: no sticker on the count, and the count's column is kept clear`, () => {
        const f = fill(format, n)
        // In px: the frame's width is the collage's, as count-box.test.ts does.
        const k = f.L.collage.w / f.r.W
        const px: PackResult = { ...f.r, W: f.r.W * k, H: f.r.H * k, boxes: new Map([...f.r.boxes].map(([id, [x, y, w, h]]) => [id, [x * k, y * k, w * k, h * k]])) }
        expect(clash(sample(n), px, f.L.count.hole, 2 * k)).toEqual({ onText: 0, inAir: 0 })
      }, 60_000)
    }
  }
})

describe('the 4K desktop image', () => {
  it('draws 3840 × 2160: the design at 2× (a setTransform of 2), and the vertical story at 1080 × 1920 without one', async () => {
    const logs = installStubs()
    const desktop = await drawShareImage({ format: 'desktop', theme: 'light', entries, species, pack: harnessPack, now: NOW, strings: en.ui })
    expect([desktop.width, desktop.height]).toEqual([3840, 2160])
    const dLog = logs.get(desktop as unknown as object)!
    expect(dLog).toContain('setTransform(2, 0, 0, 2, 0, 0)')
    expect(dLog.filter((l) => l.startsWith('fillText')).length).toBeGreaterThan(3)

    const story = await drawShareImage({ format: 'story', theme: 'light', entries, species, pack: harnessPack, now: NOW, strings: en.ui })
    expect([story.width, story.height]).toEqual([1080, 1920])
    expect(logs.get(story as unknown as object)!.some((l) => l.startsWith('setTransform'))).toBe(false)
  })

  it('the wide 5:4 image is 1350 × 1080 at 1×', async () => {
    installStubs()
    const wide = await drawShareImage({ format: 'wide', theme: 'dark', entries, species, pack: harnessPack, now: NOW, strings: en.ui })
    expect([wide.width, wide.height]).toEqual([1350, 1080])
  })
})

describe('analytics', () => {
  it('the app and the Worker allow the horizontal formats for downloads and shares alike', () => {
    for (const event of ['image_downloaded', 'shared'] as const) {
      expect([...WORKER_ALLOWED[event]]).toEqual(APP_ALLOWED[event])
      expect(APP_ALLOWED[event]).toEqual(expect.arrayContaining(['desktop', 'wide']))
    }
  })
})
