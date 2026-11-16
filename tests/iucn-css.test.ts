// The Red List pill's CSS (card-list.css): the text is the chart's fixed colour and the ring is Line, in both themes.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../src/components/collage/card-list.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
/** Every rule as [selector, body], media blocks flattened (their inner rules are matched on their own). */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const)
const rule = (selector: string) => rules.find(([s]) => s === selector)?.[1] ?? ''
/** The pill's own rules: `.eb-iucn` itself, not the badge's or the name's. */
const pillRules = rules.filter(([s]) => /\.eb-iucn(?![-\w])/.test(s))

// Geist Mono, variable, wght 600 (what draws: layout.tsx loads the whole axis), read with fontTools: units per em 1000,
// OS/2 typo = hhea ascender 1005, descender -295, cap height 710, advance 600. Ink bounds (xMin, xMax) at wght 600.
const UPM = 1000, ASC = 1005, DESC = -295, CAP = 710, ADV = 600
const INK: Record<string, [number, number]> = {
  L: [96, 544], C: [34, 561], N: [66, 534], T: [40, 560], V: [23.6, 576.4], U: [56, 544], E: [86, 534], R: [64.4, 542],
  W: [26, 574], X: [39.6, 560.4], D: [75.6, 566],
}
const FS = 11, LS = 0.06 * FS, SHIFT = 0.0225 * FS

describe('the Red List pill CSS', () => {
  it('.eb-iucn takes its text from --iucn-text and has a 1px Line ring', () => {
    const body = rule('.eb-iucn')
    expect(body).toMatch(/color:\s*var\(--iucn-text\)/)
    expect(body).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--line\)/)
  })
  it('no pill rule mentions Ink or Paper (dark Ink is white)', () => {
    expect(pillRules.length).toBeGreaterThanOrEqual(1)
    for (const [s, body] of pillRules) {
      expect(body, s).not.toMatch(/var\(--ink\)|var\(--paper\)/)
    }
  })
  it('the card badge is plain text: no press area, no toggletip rules left', () => {
    expect(css).not.toMatch(/eb-iucn-tip|eb-iucn-wrap|::after|:hover/)
    expect(rule('.eb-iucn-name')).toMatch(/font:\s*500 12px\/18px var\(--font-mono\)/)
    expect(rule('.eb-iucn-name')).toMatch(/color:\s*var\(--muted\)/)
  })
  it('variant a stacks mass over badge on the right; variant b is one wrapping row', () => {
    expect(rule('.eb-card-meta')).toMatch(/flex-direction:\s*column/)
    expect(rule('.eb-card-meta')).toMatch(/align-items:\s*flex-end/)
    expect(rule('[data-pill="b"] .eb-card-meta')).toMatch(/flex-direction:\s*row/)
    expect(rule('[data-pill="b"] .eb-card-meta')).toMatch(/flex-wrap:\s*wrap/)
  })
  it('the meta column leaves a 320px phone sheet room: the longest unit fits its 45% cap, so the name wraps, never overflows', () => {
    expect(rule('.eb-card-meta')).toMatch(/max-width:\s*45%/)
    expect(rule('.eb-iucn-name')).toMatch(/min-width:\s*0/)
    expect(rule('.eb-iucn-name')).toMatch(/overflow-wrap:\s*break-word/)
    const head = 320 - 2 * 8 - 2 * 14 - 2 // sheet inset, card padding and border
    const close = 44 - 3 - 10 // the close button net of its margins
    const pill = 2 * (ADV / UPM * FS + LS) + 12
    const word = 'Endangered'.length * 0.6 * 12
    expect(pill + 6 + word).toBeLessThanOrEqual(0.45 * head)
    expect(head - close - 24 - 0.45 * head).toBeGreaterThanOrEqual(95)
  })
})

describe('the pill centres its abbreviation (Geist Mono 600 metrics)', () => {
  it('vertically: the capitals’ centre is the line box’s centre, so line-height 1 needs no correction', () => {
    const lineH = FS // line-height: 1
    const content = ((ASC - DESC) / UPM) * FS
    const baseline = (lineH - content) / 2 + (ASC / UPM) * FS
    const capCentre = baseline - ((CAP / UPM) * FS) / 2
    expect(Math.abs(capCentre - lineH / 2)).toBeLessThan(0.25)
    expect(rule('.eb-iucn')).toMatch(/font:\s*600 11px\/1 var\(--font-mono\)/)
    expect(rule('.eb-iucn')).toMatch(/align-items:\s*center/)
    expect(rule('.eb-iucn')).toMatch(/height:\s*18px/)
  })
  it('horizontally: the padding moves the text right by .0225em and keeps the width', () => {
    expect(rule('.eb-iucn')).toMatch(/padding:\s*0 calc\(6px - \.0225em\) 0 calc\(6px \+ \.0225em\)/)
    expect(rule('.eb-iucn')).toMatch(/letter-spacing:\s*\.06em/)
  })
  it('every category’s ink ends within 0.27px of the pill’s centre', () => {
    for (const cat of ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD']) {
      const cell = (ADV / UPM) * FS + LS
      const left = (INK[cat[0]][0] / UPM) * FS
      const right = cell + (INK[cat[1]][1] / UPM) * FS
      const off = (left + right) / 2 - cell + SHIFT // the box is two cells wide, trailing spacing included
      expect(Math.abs(off), cat).toBeLessThan(0.27)
    }
  })
})
