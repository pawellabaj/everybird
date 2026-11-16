// Settings > Your list: what each source brings to the collage ("185 species · 12 only here") and the summary line,
// counted from the list the collage shows, so they always agree with it. Synthetic codes only.
import { describe, expect, it } from 'vitest'
import { buildList } from '@/lib/list/build-list'
import { DEFAULT_RULES, unmatchedKey, type Rules, type SourceRecord, type Unmatched } from '@/lib/list/model'
import { countParts, sourceCounts, summaryLine } from '@/lib/list/source-counts'
import { emptySaved, type Saved } from '@/lib/list/storage'
import { recordsOf } from '@/lib/list/store'
import { plural } from '@/i18n/core'
import { en } from '@/i18n/messages/en'
import { es } from '@/i18n/messages/es'
import { pt } from '@/i18n/messages/pt'

const t = en.ui

const r = (code: string, source: SourceRecord['source'], extra: Partial<SourceRecord> = {}): SourceRecord => ({ code, source, date: '2024-05-04', ...extra })

/**
 * Life list download: a b c d(heard only) + a fixed row k. MyEBirdData: b c e h(heard) x(removed). iNaturalist: c f
 * g(not research grade) h. By hand: a (also on eBird) and m.
 */
function fixture(rules: Partial<Rules> = {}, marks: Saved['edits']['marks'] = {}): Saved {
  const s = emptySaved()
  s.records['ebird-list'] = [r('a', 'ebird'), r('b', 'ebird'), r('c', 'ebird'), r('d', 'ebird', { heard: true })]
  s.records.ebird = [r('b', 'ebird'), r('c', 'ebird'), r('e', 'ebird'), r('h', 'ebird', { heard: true }), r('x', 'ebird')]
  s.records.inat = [r('c', 'inat', { research: true }), r('f', 'inat', { research: true }), r('g', 'inat', { research: false }), r('h', 'inat', { research: true })]
  const u: Unmatched = { source: 'ebird', slot: 'ebird-list', row: 9, com: 'Typo bird', reason: 'no-match', date: '2020-01-01' }
  s.unmatched = [u]
  s.edits = { removed: ['x'], added: [r('a', 'manual'), r('m', 'manual')], marks, fixes: { [unmatchedKey(u)]: 'k' } }
  s.rules = { ...DEFAULT_RULES, ...rules }
  return s
}
/** The collage's list, built as the store builds it. */
const listOf = (s: Saved) => buildList(recordsOf(s), s.edits, s.rules)
const counts = (s: Saved) => sourceCounts(s, listOf(s))
const sum = (c: ReturnType<typeof sourceCounts>) => c.parts.reduce((a, p) => a + p.n, 0)

describe('sourceCounts', () => {
  it('counts each row, the eBird files as one source for "only here", and parts that sum to the collage', () => {
    const c = counts(fixture())
    expect(c.total).toBe(10) // a b c d e h k f g m; x removed
    expect(c.rows['ebird-list']).toEqual({ species: 5, only: 4, onlyIn: 'eBird' }) // a b c d k; only eBird: b d e k
    expect(c.rows.ebird).toEqual({ species: 4, only: 0, onlyIn: 'here' }) // b c e h: eBird's number is on the bigger row
    expect(c.rows.inat).toEqual({ species: 4, only: 2, onlyIn: 'here' }) // c f g h; only f g
    expect(c.rows.manual).toEqual({ species: 2, only: 1, onlyIn: 'here' }) // a m; only m
    expect(c.parts).toEqual([{ group: 'ebird', n: 7 }, { group: 'inat', n: 2 }, { group: 'manual', n: 1 }])
    expect(sum(c)).toBe(c.total)
    expect(summaryLine(c, t)).toBe('Your collage has 10 species: 7 from eBird, 2 more from iNaturalist, 1 ticked by hand.')
    expect(countParts(c.rows['ebird-list'], t)).toEqual(['5 species', '4 only in eBird'])
    expect(countParts(c.rows.ebird, t)).toEqual(['4 species'])
    expect(countParts(c.rows.inat, t)).toEqual(['4 species', '2 only here'])
  })

  it('hide heard only: a heard-only bird leaves, and a source whose only record was heard no longer brings it', () => {
    const c = counts(fixture({ hideHeard: true }))
    expect(c.total).toBe(9) // d goes; h stays (iNaturalist saw it) but MyEBirdData's h was heard only
    expect(c.rows['ebird-list']).toMatchObject({ species: 4, only: 3 }) // a b c k; only eBird: b e k
    expect(c.rows.ebird.species).toBe(3) // b c e
    expect(c.rows.inat).toMatchObject({ species: 4, only: 3 }) // c f g h; only f g h
    expect(c.parts.map((p) => p.n)).toEqual([5, 3, 1])
    expect(sum(c)).toBe(c.total)
  })

  it('a mark saying not heard only keeps the bird and its source', () => {
    const c = counts(fixture({ hideHeard: true }, { d: { heard: false } }))
    expect(c.total).toBe(10)
    expect(c.rows['ebird-list'].species).toBe(5)
    expect(sum(c)).toBe(c.total)
  })

  it('research grade only drops the observation the community has not agreed on', () => {
    const c = counts(fixture({ researchOnly: true }))
    expect(c.total).toBe(9) // g goes
    expect(c.rows.inat).toMatchObject({ species: 3, only: 1 }) // c f h; only f
    expect(c.parts.map((p) => p.n)).toEqual([7, 1, 1])
    expect(sum(c)).toBe(c.total)
  })

  it('one eBird file says "only here"; one source says "all from"; nothing says nothing', () => {
    const s = fixture()
    s.records.ebird = []
    const c = counts(s)
    expect(c.rows['ebird-list']).toEqual({ species: 5, only: 3, onlyIn: 'here' }) // b d k
    expect(countParts(c.rows['ebird-list'], t)).toEqual(['5 species', '3 only here'])
    const inat = emptySaved()
    inat.records.inat = [r('f', 'inat')]
    expect(summaryLine(counts(inat), t)).toBe('Your collage has 1 species, all from iNaturalist.')
    const hand = emptySaved()
    hand.edits = { ...hand.edits, added: [r('m', 'manual'), r('n', 'manual')] }
    expect(summaryLine(counts(hand), t)).toBe('Your collage has 2 species, all ticked by hand.')
    expect(summaryLine(counts(emptySaved()), t)).toBeNull()
  })

  it('a source wholly inside an earlier one adds no part', () => {
    const s = emptySaved()
    s.records['ebird-list'] = [r('a', 'ebird'), r('b', 'ebird')]
    s.records.inat = [r('a', 'inat')]
    const c = counts(s)
    expect(c.parts).toEqual([{ group: 'ebird', n: 2 }])
    expect(summaryLine(c, t)).toBe('Your collage has 2 species, all from eBird.')
    expect(c.rows.inat).toEqual({ species: 1, only: 0, onlyIn: 'here' })
  })

  it('a lone source (or the two eBird files alone) never says "only here"', () => {
    const s = emptySaved()
    s.records['ebird-list'] = [r('a', 'ebird'), r('b', 'ebird')]
    s.records.ebird = [r('b', 'ebird'), r('c', 'ebird')]
    const c = counts(s)
    expect(c.rows['ebird-list']).toMatchObject({ species: 2, only: 0 })
    expect(c.rows.ebird).toMatchObject({ species: 2, only: 0 })
    expect(summaryLine(c, t)).toBe('Your collage has 3 species, all from eBird.')
  })

  it('observation.org: its summary parts, one source alone, and "only in observation.org" on its bigger file', () => {
    const s = emptySaved()
    s.records['ebird-list'] = [r('a', 'ebird'), r('b', 'ebird'), r('c', 'ebird')]
    s.records.obsorg = [r('c', 'obsorg'), r('d', 'obsorg')]
    s.records['obsorg-list'] = [r('c', 'obsorg'), r('d', 'obsorg'), r('e', 'obsorg')]
    const c = counts(s)
    expect(summaryLine(c, t)).toBe('Your collage has 5 species: 3 from eBird, 2 more from observation.org.')
    expect(c.rows['obsorg-list']).toEqual({ species: 3, only: 2, onlyIn: 'observation.org' }) // c d e; only d e
    expect(c.rows.obsorg).toEqual({ species: 2, only: 0, onlyIn: 'here' })
    expect(countParts(c.rows['obsorg-list'], t)).toEqual(['3 species', '2 only in observation.org'])
    expect(countParts(c.rows.obsorg, t)).toEqual(['2 species'])
    // The observations file bigger: the number moves to it.
    s.records.obsorg = [r('c', 'obsorg'), r('d', 'obsorg'), r('e', 'obsorg'), r('f', 'obsorg')]
    const c2 = counts(s)
    expect(c2.rows.obsorg).toEqual({ species: 4, only: 3, onlyIn: 'observation.org' })
    expect(c2.rows['obsorg-list']).toEqual({ species: 3, only: 0, onlyIn: 'here' })
    const alone = emptySaved()
    alone.records.obsorg = [r('d', 'obsorg'), r('e', 'obsorg')]
    expect(summaryLine(counts(alone), t)).toBe('Your collage has 2 species, all from observation.org.')
  })

  it('a bird kept only by two records together (one heard, one dead) still has a source', () => {
    const s = emptySaved()
    s.records['ebird-list'] = [r('a', 'ebird', { heard: true })]
    s.records.inat = [r('a', 'inat', { dead: true })]
    s.rules = { ...DEFAULT_RULES, hideHeard: true, hideDead: true }
    const c = counts(s)
    expect(c.total).toBe(1)
    expect(sum(c)).toBe(1)
  })
})

describe('the summary and the row counts in other languages', () => {
  const many = { total: 199, parts: [{ group: 'ebird', n: 185 }, { group: 'inat', n: 11 }, { group: 'manual', n: 3 }] } as ReturnType<typeof sourceCounts>
  const one = { total: 576, parts: [{ group: 'inat', n: 576 }] } as ReturnType<typeof sourceCounts>
  it('reads the summary in Spanish and Portuguese', () => {
    expect(summaryLine(many, es.ui)).toBe('Tu collage tiene 199 especies: 185 de eBird, 11 más de iNaturalist, 3 marcadas a mano.')
    expect(summaryLine(many, pt.ui)).toBe('Sua colagem tem 199 espécies: 185 do eBird, 11 a mais do iNaturalist, 3 marcadas à mão.')
    expect(summaryLine(many, en.ui)).toBe('Your collage has 199 species: 185 from eBird, 11 more from iNaturalist, 3 ticked by hand.')
  })
  it('one source: "all from"', () => {
    expect(summaryLine(one, es.ui)).toBe('Tu collage tiene 576 especies, todas de iNaturalist.')
    expect(summaryLine(one, pt.ui)).toBe('Sua colagem tem 576 espécies, todas do iNaturalist.')
    expect(summaryLine(one, en.ui)).toBe('Your collage has 576 species, all from iNaturalist.')
  })
  it('groups thousands with the language separator', () => {
    const big = { total: 1089, parts: [{ group: 'ebird', n: 1089 }] } as ReturnType<typeof sourceCounts>
    expect(summaryLine(big, es.ui)).toBe('Tu collage tiene 1.089 especies, todas de eBird.')
    expect(summaryLine(big, en.ui)).toBe('Your collage has 1,089 species, all from eBird.')
  })
  it('countParts and the skipped count in Spanish', () => {
    expect(countParts({ species: 160, only: 149, onlyIn: 'eBird' }, es.ui)).toEqual(['160 especies', '149 solo en eBird'])
    expect(countParts({ species: 46, only: 11, onlyIn: 'here' }, es.ui)).toEqual(['46 especies', '11 solo aquí'])
    expect(plural(es.ui.import.skipped, 7, { n: '7' })).toBe('7 omitidas')
    expect(es.ui.import.why).toBe('¿por qué?')
  })
})
