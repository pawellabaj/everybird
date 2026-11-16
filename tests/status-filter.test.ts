import { describe, expect, it } from 'vitest'
import { IUCN_CATS, IUCN_COLORS, IUCN_NAMES } from '../src/lib/species/iucn'
import { NE_COLOR, NE_NAME, STATUS_FILTER_CATS, isStatusFilterCat, statusColor, statusName } from '../src/lib/species/status-filter'

/** WCAG relative-luminance contrast of two #rrggbb colours, as in iucn.test.ts. */
function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('the Status filter categories', () => {
  it('the Red List categories, then NE last', () => {
    expect(STATUS_FILTER_CATS).toEqual([...IUCN_CATS, 'NE'])
    expect(STATUS_FILTER_CATS[STATUS_FILTER_CATS.length - 1]).toBe('NE')
  })

  it('recognises the categories and NE, nothing else', () => {
    for (const c of STATUS_FILTER_CATS) expect(isStatusFilterCat(c)).toBe(true)
    for (const bad of [undefined, null, 1, {}, ['NE'], ' NE ', 'ne', 'RE', 'CR (PE)']) expect(isStatusFilterCat(bad)).toBe(false)
  })

  it('names: the Red List names, and "Not evaluated" for NE', () => {
    expect(NE_NAME).toBe('Not evaluated')
    expect(statusName('NE')).toBe('Not evaluated')
    for (const c of IUCN_CATS) expect(statusName(c)).toBe(IUCN_NAMES[c])
  })

  it('NE is a grey pill: not a Red List colour, dark text at AA on its fill', () => {
    expect(statusColor('NE')).toEqual(NE_COLOR)
    expect(contrast(NE_COLOR.text, NE_COLOR.fill)).toBeGreaterThanOrEqual(4.5)
    for (const c of IUCN_CATS) expect(statusColor(c)).toEqual(IUCN_COLORS[c])
    for (const c of IUCN_CATS) expect(IUCN_COLORS[c].fill).not.toBe(NE_COLOR.fill)
    // Told apart from DD's grey by more than its name.
    expect(NE_COLOR.fill).not.toBe(IUCN_COLORS.DD.fill)
  })
})
