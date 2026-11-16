import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { LAYOUTS } from '../src/lib/layout/constants'
import { collageBoxes, rectGap, type Rect } from '../src/lib/layout/count-box'
import { decodeMask, type Mask } from '../src/lib/layout/mask'
import { packBest, type PackBird } from '../src/lib/layout/pack'
import { IUCN_CATS, type IucnCat } from '../src/lib/species/iucn'
import { hiddenMarks, markRect, markShown, markedName, MARK_PX } from '../src/lib/species/status-mark'

describe('which birds carry the mark', () => {
  it('VU, EN and CR only; never without a category', () => {
    expect(IUCN_CATS.filter((c) => markShown(c))).toEqual(['VU', 'EN', 'CR'])
    expect(markShown(undefined)).toBe(false)
  })
  it('the button name gains the status only on a marked bird', () => {
    expect(markedName('Snowy Owl', 'VU')).toBe('Snowy Owl, Vulnerable')
    expect(markedName('Snowy Owl', 'CR')).toBe('Snowy Owl, Critically Endangered')
    expect(markedName('Snowy Owl', 'LC')).toBe('Snowy Owl')
    expect(markedName('Snowy Owl', undefined)).toBe('Snowy Owl')
  })
})

describe('hiddenMarks: small stickers', () => {
  const layout = { layout: 'narrow', W: 350, H: 400, boxes: new Map<string, readonly [number, number, number, number]>([
    ['big', [10, 10, 80, 60]], ['mid', [10, 300, 25, 25]], ['tiny', [300, 300, 15, 15]],
  ]) }
  const base = { layout, visible: new Set(['big', 'mid', 'tiny']), cat: () => 'EN' as IucnCat, stagePx: 350, count: 3 }
  it('needs a long side of 32px (at the stage width the layout was packed for)', () => {
    expect([...hiddenMarks(base)].sort()).toEqual(['mid', 'tiny'])
  })
  it('sizes are in CSS px: a stage drawn at half the layout width halves every sticker', () => {
    const wide = { ...base, layout: { ...layout, boxes: new Map([...layout.boxes, ['big', [10, 10, 60, 60] as const]]) } }
    expect([...hiddenMarks(wide)].sort()).toEqual(['mid', 'tiny'])
    expect([...hiddenMarks({ ...wide, stagePx: 175 })].sort()).toEqual(['big', 'mid', 'tiny'])
  })
  it('birds that do not carry the mark are never listed', () => {
    expect(hiddenMarks({ ...base, cat: () => 'LC' }).size).toBe(0)
  })
})

// The count's text must never sit under a mark: real masks and masses packed around the hole, as count-box.test.ts does.
const DATA = resolve(__dirname, '../public/data')
let POOL: PackBird[] = []
function loadPool(): PackBird[] {
  const masks = new Map<string, Mask>()
  for (const f of readdirSync(resolve(DATA, 'masks')).sort()) {
    const rec = JSON.parse(readFileSync(resolve(DATA, 'masks', f), 'utf8')) as Record<string, [number, number, string]>
    for (const [code, m] of Object.entries(rec)) masks.set(code, decodeMask(m))
  }
  const species = (JSON.parse(readFileSync(resolve(DATA, 'species.v1.json'), 'utf8')).species as { code: string; g: number }[])
    .filter((s) => masks.has(s.code))
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  return species.map((s, i) => ({ id: i, mass: s.g, mask: masks.get(s.code)! }))
}

describe('no mark sits on the count (packed 197 species, every bird threatened)', () => {
  beforeAll(() => { POOL = loadPool() })
  for (const spec of LAYOUTS) {
    for (const px of [Math.max(spec.minWidth, 288), spec.maxWidth]) {
      {
        it(`${spec.name} at ${px}px`, () => {
          const n = 197, step = POOL.length / n
          const birds = Array.from({ length: n }, (_, i) => POOL[Math.floor(i * step)])
          const r = packBest(birds, spec, 'even')
          const boxes = new Map(birds.map((b) => [String(b.id), r.boxes.get(b.id)!] as const))
          const visible = new Set(boxes.keys())
          const hidden = hiddenMarks({
            layout: { layout: spec.name, W: r.W, H: r.H, boxes }, visible, cat: () => 'EN', stagePx: px, count: n,
          })
          // The count's text boxes in layout units, about the centre (what the hole is made of), and the bridge between.
          const { num, label } = collageBoxes(n, spec)
          const half = Math.min(num[2], label[2])
          const text: Rect[] = [num, label, [-half, num[3], half, label[1]]]
          const u = r.W / px
          let covered = 0, kept = 0
          for (const [code, box] of boxes) {
            const rect = markRect(box, r.W, r.H, px)
            // Independent of hiddenMarks: the rectangle from the box's corner by hand.
            const mine: Rect = [box[0] + box[2] - (2 + MARK_PX.w) * u - r.W / 2, box[1] + box[3] - (2 + MARK_PX.h) * u - r.H / 2, box[0] + box[2] - 2 * u - r.W / 2, box[1] + box[3] - 2 * u - r.H / 2]
            expect(rect.map((v) => Math.round(v * 1e6))).toEqual(mine.map((v) => Math.round(v * 1e6)))
            const onText = text.some((t) => rectGap(rect, t) <= 0)
            if (onText) covered++
            if (!hidden.has(code)) {
              kept++
              expect(onText, `${code}'s mark is on the count`).toBe(false)
              for (const t of text) expect(rectGap(rect, t)).toBeGreaterThan(0)
            }
          }
          expect(kept).toBeGreaterThan(0)
          // Every mark the text reaches is among the hidden ones.
          expect(hidden.size).toBeGreaterThanOrEqual(covered)
          if (process.env.MARK_LOG) console.log(spec.name, px, 'covered', covered, 'hidden', hidden.size, 'of', n)
        }, 60_000)
      }
    }
  }
})
