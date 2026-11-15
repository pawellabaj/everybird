import { describe, expect, it } from 'vitest'
import { asOfDate, withStamp } from '@/lib/share/stamp'

// The footer line as image.ts has it (FOOTER_LINE); this file must not import image.ts.
const FOOTER = 'everybird.yusuftaleb.com · stickers by huashu'

describe('asOfDate', () => {
  it('reads "As of 14 Nov 2026" from the local date', () => {
    expect(asOfDate(new Date(2026, 10, 14, 23, 59))).toBe('As of 14 Nov 2026')
  })
  it('has no leading zero and uses the short months of the rest of the site', () => {
    expect(asOfDate(new Date(2026, 10, 4))).toBe('As of 4 Nov 2026')
    expect(asOfDate(new Date(2026, 8, 30))).toBe('As of 30 Sep 2026')
    expect(asOfDate(new Date(2027, 0, 1))).toBe('As of 1 Jan 2027')
  })
  it('takes other strings, so a language is a strings object', () => {
    const es = { asOf: 'Al', months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'] }
    expect(asOfDate(new Date(2026, 10, 14), es)).toBe('Al 14 nov 2026')
  })
  it('is empty for an invalid date', () => {
    expect(asOfDate(new Date(NaN))).toBe('')
  })
})

describe('withStamp', () => {
  it('ends the line with the stamp after a middle dot', () => {
    expect(withStamp(FOOTER, 'As of 14 Nov 2026')).toBe('everybird.yusuftaleb.com · stickers by huashu · As of 14 Nov 2026')
  })
  it('leaves the line alone without a stamp', () => {
    expect(withStamp(FOOTER, '')).toBe(FOOTER)
  })
})
