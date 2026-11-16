// The Red List pill's CSS (card-list.css): the text is the chart's fixed colour and the ring is Line, in both themes.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../src/components/collage/card-list.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
/** Every rule as [selector, body], media blocks flattened (their inner rules are matched on their own). */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const)
const rule = (selector: string) => rules.find(([s]) => s === selector)?.[1] ?? ''
/** The pill's own rules: `.eb-iucn` itself, not the wrapper's or the tip's. */
const pillRules = rules.filter(([s]) => /\.eb-iucn(?![-\w])/.test(s) && !/\.eb-iucn-(tip|wrap)/.test(s))

describe('the Red List pill CSS', () => {
  it('.eb-iucn takes its text from --iucn-text and has a 1px Line ring', () => {
    const body = rule('.eb-iucn')
    expect(body).toMatch(/color:\s*var\(--iucn-text\)/)
    expect(body).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--line\)/)
  })
  it('no pill rule mentions Ink or Paper (dark Ink is white)', () => {
    expect(pillRules.length).toBeGreaterThan(2)
    for (const [s, body] of pillRules) {
      expect(body, s).not.toMatch(/var\(--ink\)|var\(--paper\)/)
    }
  })
  it('the press area is 44px tall and the tip shows on data-open, focus-visible and a fine hover only', () => {
    expect(rule('button.eb-iucn::after')).toMatch(/inset:\s*-13px -9px/)
    expect(css).toMatch(/\.eb-iucn-wrap\[data-open\] \.eb-iucn-tip/)
    expect(css).toMatch(/\.eb-iucn:focus-visible \+ \.eb-iucn-tip/)
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.eb-iucn:hover \+ \.eb-iucn-tip/)
  })
  it('variant a stacks mass over pill on the right; variant b is one row', () => {
    expect(rule('.eb-card-meta')).toMatch(/flex-direction:\s*column/)
    expect(rule('.eb-card-meta')).toMatch(/align-items:\s*flex-end/)
    expect(rule('[data-pill="b"] .eb-card-meta')).toMatch(/flex-direction:\s*row/)
  })
  it('variant b anchors the tip to the meta row, so it ends at the mass and never past the card', () => {
    expect(rule('[data-pill="b"] .eb-card-meta')).toMatch(/position:\s*relative/)
    expect(rule('[data-pill="b"] .eb-iucn-wrap')).toMatch(/position:\s*static/)
    expect(rule('.eb-iucn-tip')).toMatch(/right:\s*0/)
    expect(rules.some(([s, b]) => s.includes('[data-pill="b"]') && s.includes('.eb-iucn-tip') && /left:/.test(b))).toBe(false)
  })
  it('the tip wraps rather than overflow the narrowest sheet', () => {
    const tip = rule('.eb-iucn-tip')
    expect(tip).toMatch(/max-width:\s*calc\(100vw - 96px\)/)
    expect(tip).toMatch(/width:\s*max-content/)
    expect(tip).toMatch(/white-space:\s*normal/)
    expect(tip).not.toMatch(/nowrap/)
  })
})
