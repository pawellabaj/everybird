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
  it('the card pill is a toggletip button: a 44px press clear of the close button, a tip that shows on press, focus and hover', () => {
    expect(rule('button.eb-iucn::after')).toMatch(/inset:\s*-13px -9px/)
    // Right-aligned under the mass: the tip's right edge is the pill's.
    expect(rule('.eb-iucn-tip')).toMatch(/right:\s*0/)
    expect(rule('.eb-iucn-tip')).toMatch(/pointer-events:\s*none/)
    expect(rules.some(([sel]) => sel.includes('.eb-iucn-wrap[data-open] .eb-iucn-tip') && sel.includes('.eb-iucn:focus-visible + .eb-iucn-tip'))).toBe(true)
    expect(rules.some(([sel]) => sel === '.eb-iucn:hover + .eb-iucn-tip')).toBe(true)
  })
  it('the pill sits under the mass, right-aligned, in a head column that never shrinks below its content (so long names wrap on the left)', () => {
    expect(css).not.toMatch(/eb-card-meta|45%|min-content|data-pill/)
    const side = rule('.eb-card-side')
    expect(side).toMatch(/flex:\s*none/)
    expect(side).toMatch(/flex-direction:\s*column/)
    expect(side).toMatch(/align-items:\s*flex-end/)
    expect(side).toMatch(/margin-left:\s*auto/)
    expect(rule('.eb-card-names')).toMatch(/min-width:\s*0/)
    expect(rule('.eb-iucn-badge')).toMatch(/justify-content:\s*flex-end/)
    expect(css).not.toMatch(/eb-iucn-name/)
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
  it('optically: NT and EX (the only categories whose ink centroid is over 0.4px off) take an extra shift; the rest keep .0225em', () => {
    // fontTools StatisticsPen, summed over both glyphs, px at 11px, + = right of the box's centre, with .0225em applied.
    const CENTROID: Record<string, number> = { LC: -0.03, NT: -1.01, VU: 0.13, EN: 0.01, CR: 0.02, EW: 0.19, EX: -0.43, DD: -0.16 }
    const extra = (cat: string) => {
      const m = /padding:\s*0 calc\(6px - ([\d.]+)em\) 0 calc\(6px \+ \1em\)/.exec(rule(`.eb-iucn[data-cat="${cat}"]`))
      return m ? (parseFloat(m[1]) - 0.0225) * FS : 0
    }
    for (const cat of Object.keys(CENTROID)) {
      expect(Math.abs(CENTROID[cat] + extra(cat)), cat).toBeLessThan(0.3)
      if (Math.abs(CENTROID[cat]) <= 0.4) expect(extra(cat), cat).toBe(0)
    }
    expect(rule('.eb-iucn[data-cat="NT"]')).toMatch(/calc\(6px - \.1125em\) 0 calc\(6px \+ \.1125em\)/)
    expect(rule('.eb-iucn[data-cat="EX"]')).toMatch(/calc\(6px - \.0625em\) 0 calc\(6px \+ \.0625em\)/)
    // The width is the same: one side gains what the other loses (6 + 6 in total).
  })
  it('every category’s ink bounds end within 0.27px of the pill’s centre (bounds; NT’s centroid is what needs the extra shift)', () => {
    for (const cat of ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD']) {
      const cell = (ADV / UPM) * FS + LS
      const left = (INK[cat[0]][0] / UPM) * FS
      const right = cell + (INK[cat[1]][1] / UPM) * FS
      const off = (left + right) / 2 - cell + SHIFT // the box is two cells wide, trailing spacing included
      expect(Math.abs(off), cat).toBeLessThan(0.27)
    }
  })
})
