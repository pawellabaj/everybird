import { describe, expect, it } from 'vitest'
import {
  IOS_CANVAS_AREA, PRINT_CM, PRINT_DESIGN_H, PRINT_PT, PRINT_PX, PRINT_SIZES, STRIP_AREA, printDesignH, printScale, stripRanges,
} from '@/lib/share/print'
import { SAFE, SHARE_COLORS, TITLE_TOP, cardLayout, imagePackSpec, prepareCard, type ImagePack } from '@/lib/share/image'
import type { ListEntry } from '@/lib/list/model'
import { buildSpeciesIndex } from '@/lib/species/load'
import type { SpeciesRow } from '@/lib/species/types'

// Synthetic birds only.
const row = (code: string, to: number) => ({ code, com: code, sci: code, ord: 'Struthioniformes', fam: 'Struthionidae', famCom: 'Ostriches', to, g: 100000, gSrc: 'family', st: true, ar: 1, q: true }) as SpeciesRow
const species = buildSpeciesIndex([row('ostric2', 1), row('emu1', 2)])
const entry = (code: string): ListEntry => ({ code, date: '2020-05', place: { country: 'CA' }, heard: false, dead: false, media: false, sources: ['ebird'] })
const entries = [entry('ostric2'), entry('emu1')]
// A hand-made pack, so no layout worker is needed: two birds either side of the centre, the same size.
const pack: ImagePack = { W: 1000, H: 1000, boxes: new Map([['ostric2', [395, 450, 100, 100]], ['emu1', [505, 450, 100, 100]]]) }

describe('print sizes and strips', () => {
  it('the A sizes at 150 dpi, in px and ISO points', () => {
    expect(PRINT_PX).toEqual({ A4: [1240, 1754], A3: [1754, 2480], A2: [2480, 3508], A1: [3508, 4967] })
    for (const s of PRINT_SIZES) {
      expect(PRINT_PT[s][0]).toBeCloseTo((PRINT_CM[s][0] / 2.54) * 72, 1)
      expect(PRINT_PT[s][1]).toBeCloseTo((PRINT_CM[s][1] / 2.54) * 72, 1)
      expect(Math.abs(printDesignH(s) - PRINT_DESIGN_H)).toBeLessThan(3) // one pack serves every size
    }
    expect(printScale('A1')).toBeCloseTo(3.248, 3)
    expect(printScale('A4')).toBeCloseTo(1.148, 3)
  })

  it('strips: about 1 MP each, cover the poster once, never past the iOS canvas cap', () => {
    for (const s of PRINT_SIZES) {
      const [w, h] = PRINT_PX[s], st = stripRanges(w, h)
      expect(st.reduce((n, r) => n + r.rows, 0)).toBe(h)
      st.forEach((r, i) => {
        expect(r.y).toBe(i ? st[i - 1].y + st[i - 1].rows : 0)
        expect(w * r.rows).toBeLessThanOrEqual(STRIP_AREA)
      })
    }
    expect(stripRanges(3508, 4967)).toHaveLength(17)
    expect(stripRanges(1240, 1754)).toHaveLength(3)
    expect(stripRanges(3508, 4967, 4967)).toEqual([{ y: 0, rows: 4967 }]) // a rows override (one strip)
    expect(3508 * 4967).toBeGreaterThan(IOS_CANVAS_AREA) // why strips exist
  })
})

describe('the print card', () => {
  it('lays out 1080 wide at PRINT_DESIGN_H by default, with 64 margins and the story-sized latest row', () => {
    expect(SAFE.print).toEqual({ top: 64, bottom: 64 })
    expect(TITLE_TOP.print).toBe(64)
    const L = cardLayout('print', { name: true, filter: false, latest: true, count: 197 })
    expect([L.W, L.H]).toEqual([1080, PRINT_DESIGN_H])
    expect(L.name!.y).toBe(64)
    expect(L.latest!.icon).toBe(76)
    expect(L.footer.y).toBe(PRINT_DESIGN_H - 64 - 30) // no story-only lift
    expect(L.count.size).toBeLessThanOrEqual(112)
    expect(cardLayout('print', { name: true, filter: false, latest: true, count: 197 }, 1600).H).toBe(1600)
    expect(imagePackSpec('print', { name: false, filter: false, latest: true, count: 197 }).aspect)
      .toBeCloseTo(952 / cardLayout('print', { name: false, filter: false, latest: true, count: 197 }).collage.h, 6)
  })

  it('M margins, the credit and the stamp in its footer, light whatever the theme', async () => {
    const card = await prepareCard({ format: 'print', printSize: 'A2', theme: 'dark', entries, species, pack, now: new Date(2026, 10, 15) }, printScale('A2'))
    expect(card.L.collage.x).toBe(64)
    expect(card.L.W - card.L.collage.x - card.L.collage.w).toBe(64)
    expect(card.L.H).toBeCloseTo(printDesignH('A2'), 6)
    expect(card.footerLine).toContain('stickers by huashu')
    expect(card.footerLine).toContain('As of 15 Nov 2026')
    expect(card.colors).toEqual(SHARE_COLORS.light)
    expect(card.colors.paper).toBe('#f6f4ef')
    expect(card.credit.size).toBeGreaterThanOrEqual(17)
  })

  it('print tiles pick the tier by device px: a 343 design-px tile at A1 is 1024 with the 384 fallback', async () => {
    const opts = { format: 'print' as const, printSize: 'A1' as const, theme: 'light' as const, entries, species, pack }
    const a1 = await prepareCard(opts, printScale('A1'))
    expect(a1.tiles).toHaveLength(2)
    for (const t of a1.tiles) {
      expect(Math.max(t.w, t.h)).toBeCloseTo(342.72, 1) // maxTileSide(952, 0.36): a short list's largest
      expect(t.url).toMatch(/\/v1\/1024\/(ostric2|emu1)\.webp$/)
      expect(t.fallback).toBe(t.url!.replace('/1024/', '/384/'))
    }
    // The latest lifer's 76 units at A1 are about 247 px: the 384 file, no fallback.
    expect(a1.lifer!.url).toMatch(/\/v1\/384\/(ostric2|emu1)\.webp$/)
    expect(a1.lifer!.fallback).toBeNull()
    // The preview (scale 1): the same layout, the 384 file and no fallback.
    const preview = await prepareCard(opts)
    expect(preview.tiles.map((t) => [t.x, t.y, t.w, t.h])).toEqual(a1.tiles.map((t) => [t.x, t.y, t.w, t.h]))
    expect(preview.tiles.every((t) => /\/v1\/384\//.test(t.url!) && t.fallback === null)).toBe(true)
  })

  it('share images keep their 128/384 URLs and no fallback', async () => {
    const card = await prepareCard({ format: 'post', theme: 'dark', entries, species, pack })
    expect(card.colors).toEqual(SHARE_COLORS.dark)
    expect(card.tiles.every((t) => /\/v1\/384\//.test(t.url!) && t.fallback === undefined)).toBe(true)
  })
})
