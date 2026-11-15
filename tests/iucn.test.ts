import { describe, expect, it } from 'vitest'
import { IUCN_CATS, IUCN_COLORS, IUCN_NAMES, IUCN_SOURCE, THREATENED, isIucnCat, parseIucn } from '../src/lib/species/iucn'

/** WCAG relative-luminance contrast of two #rrggbb colours, as in tokens.test.ts. */
function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('IUCN categories', () => {
  it('parses the eight categories and parenthesised flags; nothing else', () => {
    expect(IUCN_CATS).toEqual(['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD'])
    for (const cat of IUCN_CATS) expect(parseIucn(cat)).toBe(cat)
    expect(parseIucn('CR (PE)')).toBe('CR')
    expect(parseIucn('CR (PEW)')).toBe('CR')
    expect(parseIucn('  VU  ')).toBe('VU')
    expect(parseIucn('LC (FLAG)')).toBe('LC')
    for (const bad of [undefined, '', 'NE', 'RE', 'LR/cd', 'vu', 'VU?', 'CR PE', 'CR (pe)', 'CR (PE) extra']) {
      expect(parseIucn(bad)).toBeUndefined()
    }
  })

  it('recognises only literal categories, without flags or whitespace', () => {
    for (const cat of IUCN_CATS) expect(isIucnCat(cat)).toBe(true)
    for (const bad of [undefined, null, 1, {}, ['VU'], ' VU ', 'CR (PE)', 'NE', 'vu']) expect(isIucnCat(bad)).toBe(false)
    expect(THREATENED).toEqual(['VU', 'EN', 'CR'])
    expect(IUCN_SOURCE).toBe('BirdLife v10 via AviList v2026')
  })

  it('names and the official Red List colours', () => {
    expect(IUCN_NAMES).toEqual({
      LC: 'Least Concern', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered',
      CR: 'Critically Endangered', EW: 'Extinct in the Wild', EX: 'Extinct', DD: 'Data Deficient',
    })
    expect(IUCN_COLORS).toEqual({
      LC: { fill: '#60c659', text: '#1e1e24' }, NT: { fill: '#cce226', text: '#1e1e24' },
      VU: { fill: '#f9e814', text: '#1e1e24' }, EN: { fill: '#fc7f3f', text: '#1e1e24' },
      CR: { fill: '#d81e05', text: '#ffffff' }, EW: { fill: '#542344', text: '#ffffff' },
      EX: { fill: '#000000', text: '#ffffff' }, DD: { fill: '#d1d1c6', text: '#1e1e24' },
    })
  })

  it('every pill text passes AA (4.5:1) on its fill', () => {
    for (const c of IUCN_CATS) expect(contrast(IUCN_COLORS[c].text, IUCN_COLORS[c].fill), c).toBeGreaterThanOrEqual(4.5)
  })

  it('the pill ring (Line) meets 3:1 against Paper in both themes', () => {
    expect(contrast('#857f74', '#f6f4ef')).toBeGreaterThanOrEqual(3)
    expect(contrast('#76767f', '#1e1e24')).toBeGreaterThanOrEqual(3)
  })
})
