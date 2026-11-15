import { describe, expect, it } from 'vitest'
import { fmt, plural, rich } from '@/i18n/core'
import { formatInt, formatMass, formatMonth, shortDay } from '@/i18n/format'
import { en } from '@/i18n/messages/en'
import { es } from '@/i18n/messages/es'
import { nl } from '@/i18n/messages/nl'
import { pt } from '@/i18n/messages/pt'
import { formatDate, formatMass as legacyMass, MONTHS } from '@/lib/format'
import { shortDate } from '@/components/import/SourceLine'

describe('formatInt: grouped from 4 digits', () => {
  it('groups by language', () => {
    expect(formatInt(1089, en.ui.num)).toBe('1,089')
    expect(formatInt(1089, es.ui.num)).toBe('1.089')
    expect(formatInt(11019, pt.ui.num)).toBe('11.019')
    expect(formatInt(197, es.ui.num)).toBe('197')
    expect(formatInt(1089, nl.ui.num)).toBe('1.089')
  })
  it('handles big, small, negative and odd numbers', () => {
    expect(formatInt(1234567, en.ui.num)).toBe('1,234,567')
    expect(formatInt(1000, es.ui.num)).toBe('1.000')
    expect(formatInt(999, en.ui.num)).toBe('999')
    expect(formatInt(0, en.ui.num)).toBe('0')
    expect(formatInt(-1089, en.ui.num)).toBe('-1,089')
    expect(formatInt(1088.6, en.ui.num)).toBe('1,089')
    expect(formatInt(Number.NaN, en.ui.num)).toBe('')
  })
  it('agrees with en-US grouping for English', () => {
    for (const n of [0, 7, 99, 197, 1089, 11019, 123456, 9999999]) expect(formatInt(n, en.ui.num)).toBe(n.toLocaleString('en-US'))
  })
})

describe('formatMass', () => {
  it('uses the language’s decimal', () => {
    expect(formatMass(2400, es.ui.num)).toBe('2,4 kg')
    expect(formatMass(7.25, pt.ui.num)).toBe('7,3 g')
    expect(formatMass(33, nl.ui.num)).toBe('33 g')
  })
  it('is today’s English output in English', () => {
    for (const g of [33, 4.27, 1130, 999.6, 2400, 7.25, 0, 10, 1_000_000, Number.NaN, -1, Infinity]) {
      expect(formatMass(g, en.ui.num)).toBe(legacyMass(g))
    }
  })
})

describe('formatMonth', () => {
  it('uses the language’s months', () => {
    expect(formatMonth('2026-09', es.ui.date.months)).toBe('sept 2026')
    expect(formatMonth('2026-03', nl.ui.date.months)).toBe('mrt 2026')
    expect(formatMonth('2026-02-14', pt.ui.date.months)).toBe('fev 2026')
  })
  it('is formatDate’s output in English', () => {
    expect(en.ui.date.months).toEqual(MONTHS)
    for (const d of ['2026-09-30', '2026-09', '2022', 'junk', undefined, '2026-13', '2026-00', '']) {
      expect(formatMonth(d, en.ui.date.months)).toBe(formatDate(d))
    }
  })
})

describe('shortDay', () => {
  const now = new Date('2026-11-15T12:00:00Z')
  it('is shortDate’s output in English (outside September, where the engines say "Sept")', () => {
    for (const iso of ['2026-11-06T10:00:00Z', '2025-03-01T10:00:00Z', '2026-01-20T10:00:00Z', '2024-12-31T10:00:00Z']) {
      expect(shortDay(iso, en.ui.date.months, now)).toBe(shortDate(iso, now))
    }
  })
  it('adds the year only when it is not this year, and says nothing for a bad date', () => {
    expect(shortDay('2026-11-06T10:00:00Z', es.ui.date.months, now)).toBe('6 nov')
    expect(shortDay('2025-09-01T10:00:00Z', es.ui.date.months, now)).toBe('1 sept 2025')
    expect(shortDay('2026-09-06T10:00:00Z', en.ui.date.months, now)).toBe('6 Sep')
    expect(shortDay('nope', en.ui.date.months, now)).toBe('')
    expect(shortDay('', en.ui.date.months, now)).toBe('')
  })
})

describe('core', () => {
  it('plural: one exactly when n is 1', () => {
    const p = { one: '{n} especie', other: '{n} especies' }
    expect(plural(p, 0, { n: '0' })).toBe('0 especies')
    expect(plural(p, 1, { n: '1' })).toBe('1 especie')
    expect(plural(p, 2, { n: '2' })).toBe('2 especies')
    expect(plural(p, 1089, { n: '1.089' })).toBe('1.089 especies')
    expect(plural(p, 3)).toBe('3 especies')
  })
  it('fmt fills known keys and leaves unknown ones', () => {
    expect(fmt("{name}'s birds", { name: 'Ada' })).toBe("Ada's birds")
    expect(fmt('{a} and {b}', { a: 1 })).toBe('1 and {b}')
    expect(fmt('no vars')).toBe('no vars')
  })
  it('rich: tags become nodes, text stays text', () => {
    expect(rich('Read <link>the guide</link>.', { link: (c) => c.toUpperCase() }).join('')).toBe('Read THE GUIDE.')
    expect(rich('<b>one</b> and <i>two</i>', { b: (c) => `[${c}]`, i: (c) => `(${c})` }).join('')).toBe('[one] and (two)')
    expect(rich('no tags', {})).toEqual(['no tags'])
    expect(rich('an <x>unknown</x> tag', {}).join('')).toBe('an unknown tag')
  })
})
