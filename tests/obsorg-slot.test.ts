// The observation.org slots in the stored list, backups, the merged list and the per-source counts. Synthetic only.
import { describe, expect, it } from 'vitest'
import { buildList } from '@/lib/list/build-list'
import { DEFAULT_RULES, unmatchedKey, type ImportResult, type SourceRecord, type Unmatched } from '@/lib/list/model'
import { fromJson, toJson } from '@/lib/list/export'
import { countParts, sourceCounts } from '@/lib/list/source-counts'
import { emptySaved, migrateSaved, removeSource, replaceSource, type Saved } from '@/lib/list/storage'
import { recordsOf } from '@/lib/list/store'

const AT = '2026-11-15T10:00:00.000Z'
const rec = (code: string, source: SourceRecord['source'], extra: Partial<SourceRecord> = {}): SourceRecord => ({ code, source, date: '2024-05-04', ...extra })
const listResult: ImportResult = {
  records: [rec('a', 'obsorg'), rec('b', 'obsorg')],
  unmatched: [
    { source: 'obsorg', row: 2, sci: 'Avis inventa', reason: 'no-match', date: '2020-01-01', suggestion: 'b' },
    { source: 'obsorg', row: 5, sci: 'Avis spec.', reason: 'not-species' },
  ],
  skipped: 0,
  rows: 3,
}
const obsResult: ImportResult = {
  records: [rec('a', 'obsorg', { place: { country: 'NL', sub1: 'NL-NH' }, seen: ['2024-05-04|NL-NH'] })],
  unmatched: [{ source: 'obsorg', row: 7, sci: 'Avis ignota', reason: 'no-match', place: { country: 'BE' }, seen: ['2021-02-02|BE'] }],
  skipped: 0,
  rows: 12,
}
const withBoth = (): Saved => {
  let s = emptySaved()
  s.records.ebird = [rec('e', 'ebird')]
  s = replaceSource(s, 'obsorg-list', listResult, { kind: 'species-list', file: 'x.csv', rows: 3, at: AT })
  return replaceSource(s, 'obsorg', obsResult, { kind: 'observations', file: 'y.csv', rows: 12, at: AT, excluded: { escape: 1, uncertain: 2 } })
}

describe('the observation.org slots', () => {
  it('a v4 list without obsorg gains empty slots and stays v4', () => {
    const old = emptySaved() as Saved & { records: Partial<Saved['records']> }
    delete old.records.obsorg
    delete old.records['obsorg-list']
    const m = migrateSaved(old as Saved)
    expect(m.records.obsorg).toEqual([])
    expect(m.records['obsorg-list']).toEqual([])
    expect(m.v).toBe(4)
  })

  it('importing replaces only its slot; Remove takes its records, unmatched, skipped and details', () => {
    const s = withBoth()
    const listRows = s.unmatched.filter((u) => u.slot === 'obsorg-list')
    expect(listRows.map((u) => u.row)).toEqual([2, 5])
    expect(unmatchedKey(listRows[0])).toBe('obsorg-list:2')
    expect(s.unmatched.find((u) => u.row === 7)?.slot).toBeUndefined() // the observations slot is the source's own
    const gone = removeSource(s, 'obsorg-list')
    expect(gone.records.ebird).toEqual(s.records.ebird)
    expect(gone.records.obsorg).toEqual(s.records.obsorg)
    expect(gone.records['obsorg-list']).toEqual([])
    expect(gone.sources?.['obsorg-list']).toBeUndefined()
    expect(gone.sources?.obsorg).toEqual(s.sources?.obsorg)
    expect(gone.skipped?.['obsorg-list']).toBeUndefined()
    expect(gone.unmatched.map((u) => u.row)).toEqual([7])
  })

  it('backups carry observation.org: records, unmatched rows and details', () => {
    const s = withBoth()
    const back = fromJson(toJson(s))
    expect(back.records.obsorg).toEqual(s.records.obsorg)
    expect(back.records['obsorg-list']).toEqual(s.records['obsorg-list'])
    expect(back.unmatched).toEqual(s.unmatched)
    expect(back.sources).toEqual(s.sources)
    expect(back.sources?.obsorg?.excluded).toEqual({ escape: 1, uncertain: 2 })
  })

  it('refuses malformed observation.org details and slots', () => {
    const bad = (sources: unknown) => () => fromJson(JSON.stringify({ ...withBoth(), sources }))
    expect(bad({ 'obsorg-list': { kind: 'observations' } })).toThrow('Backup source details are malformed.')
    expect(bad({ obsorg: { kind: 'species-list' } })).toThrow('Backup source details are malformed.')
    expect(bad({ obsorg: { kind: 'observations', excluded: { escape: -1, uncertain: 0 } } })).toThrow('Backup source details are malformed.')
    expect(bad({ obsorg: { kind: 'observations', excluded: { escape: 1 } } })).toThrow('Backup source details are malformed.')
    expect(bad({ 'obsorg-list': { kind: 'species-list', excluded: { escape: 0, uncertain: 0 } } })).toThrow('Backup source details are malformed.')
    expect(bad({ obsorg: { kind: 'observations', rows: 'many' } })).toThrow('Backup source details are malformed.')
    const wrongSlot: Unmatched = { source: 'inat', slot: 'obsorg-list', row: 1, reason: 'no-match' }
    expect(() => fromJson(JSON.stringify({ ...withBoth(), unmatched: [wrongSlot] }))).toThrow(/unmatched/)
  })

  it('buildList orders sources ebird, inat, obsorg, manual; on a date tie place detail, then source order', () => {
    const edits = { removed: [], added: [rec('a', 'manual')], marks: {}, fixes: {} }
    const [entry] = buildList([rec('a', 'obsorg'), rec('a', 'inat'), rec('a', 'ebird')], edits, DEFAULT_RULES)
    expect(entry.sources).toEqual(['ebird', 'inat', 'obsorg', 'manual'])
    const none = { removed: [], added: [], marks: {}, fixes: {} }
    // Equal dates: an eBird record with a place beats observation.org's life list (no place).
    expect(buildList([rec('a', 'obsorg'), rec('a', 'ebird', { place: { country: 'NL' } })], none, DEFAULT_RULES)[0].place).toEqual({ country: 'NL' })
    // The observations export (a place) beats the life list (none) though both are observation.org.
    expect(buildList([rec('a', 'obsorg'), rec('a', 'obsorg', { place: { country: 'BE', sub1: 'BE-VAN' } })], none, DEFAULT_RULES)[0].place).toEqual({ country: 'BE', sub1: 'BE-VAN' })
    // Same place detail: source order decides (eBird before observation.org).
    const tie = buildList([rec('a', 'obsorg', { place: { country: 'BE' } }), rec('a', 'ebird', { place: { country: 'NL' } })], none, DEFAULT_RULES)
    expect(tie[0].place).toEqual({ country: 'NL' })
    // An earlier date wins whatever the source.
    expect(buildList([rec('a', 'ebird', { place: { country: 'NL' } }), rec('a', 'obsorg', { date: '2020-01-01' })], none, DEFAULT_RULES)[0].date).toBe('2020-01-01')
  })

  it('observation.org is one source for "only": shown once, on its file with more species', () => {
    const s = withBoth()
    const c = sourceCounts(s, buildList(recordsOf(s), s.edits, s.rules))
    // eBird: e. observation.org: a b (list), a (observations); only in observation.org: a b.
    expect(c.rows['obsorg-list']).toEqual({ species: 2, only: 2, onlyIn: 'observation.org' })
    expect(c.rows.obsorg).toEqual({ species: 1, only: 0, onlyIn: 'here' })
    expect(countParts(c.rows['obsorg-list'])).toEqual(['2 species', '2 only in observation.org'])
    expect(c.rows.ebird).toEqual({ species: 1, only: 1, onlyIn: 'here' })
    expect(c.parts).toEqual([{ group: 'ebird', n: 1 }, { group: 'obsorg', n: 2 }])
    // One observation.org file: "only here".
    const one = removeSource(s, 'obsorg-list')
    const c1 = sourceCounts(one, buildList(recordsOf(one), one.edits, one.rules))
    expect(c1.rows.obsorg).toEqual({ species: 1, only: 1, onlyIn: 'here' })
  })
})
