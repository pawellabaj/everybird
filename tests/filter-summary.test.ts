import { describe, expect, it } from 'vitest'
import { COUNT_WORDS, countHead, countriesLabel, placesLabel, placesNoteFor, placesSpoken, placesSummary, statusLabel, statusSpoken, statusSummary, timeSpoken, timeSummary } from '@/lib/list/filter-summary'

const name = (c: string) => ({ CA: 'Canada', EG: 'Egypt', US: 'United States', ZA: 'South Africa' })[c] ?? c
const regions = { countries: { CA: 'Canada', EG: 'Egypt', KE: 'Kenya' }, sub1: { 'CA-BC': 'British Columbia' } }

describe('countriesLabel (share image)', () => {
  it('one, two joined by +, three or more as "and N more"', () => {
    expect(countriesLabel(undefined, name)).toBeUndefined()
    expect(countriesLabel([], name)).toBeUndefined()
    expect(countriesLabel(['CA'], name)).toBe('Canada')
    expect(countriesLabel(['CA', 'EG'], name)).toBe('Canada + Egypt')
    expect(countriesLabel(['CA', 'EG', 'US'], name)).toBe('Canada and 2 more')
    expect(countriesLabel(['CA', 'EG', 'US', 'ZA'], name)).toBe('Canada and 3 more')
  })
})

describe('the bar buttons', () => {
  it('Places: the number checked; spoken as the names', () => {
    expect(placesSummary({})).toBeUndefined()
    expect(placesSummary({ countries: ['CA', 'EG'] })).toBe('2')
    expect(placesSpoken({ countries: ['CA', 'EG'] }, regions)).toBe('Canada, Egypt')
    expect(placesSpoken({}, regions)).toBeUndefined()
  })
  it('Places at every level: counted together; spoken in full, "; " between places once a province or county is in', () => {
    expect(placesSummary({ countries: ['KE'], provinces: ['CA-BC'], counties: ['CA-ON|Ottawa'] })).toBe('3')
    expect(placesSummary({ provinces: ['CA-BC'] })).toBe('1')
    expect(placesSpoken({ countries: ['KE'], provinces: ['CA-BC'] }, regions)).toBe('Kenya; British Columbia, Canada')
    expect(placesSpoken({ counties: ['CA-BC|Capital'] }, regions)).toBe('Capital, British Columbia')
  })
  it('Places on the share image: short names, in the filter\'s order', () => {
    expect(placesLabel({}, regions)).toBeUndefined()
    expect(placesLabel({ provinces: ['CA-BC'] }, regions)).toBe('British Columbia')
    expect(placesLabel({ provinces: ['CA-BC'], countries: ['KE'] }, regions)).toBe('Kenya + British Columbia')
    expect(placesLabel({ counties: ['CA-BC|Capital', 'CA-BC|Okanagan', 'CA-BC|Sooke'] }, regions)).toBe('Capital and 2 more')
  })
  it('Time: years for a range, a month for one month; spoken in full', () => {
    expect(timeSummary({})).toBeUndefined()
    expect(timeSummary({ from: '2022-04', to: '2024-09' })).toBe('2022–2024')
    expect(timeSummary({ from: '2022-01', to: '2022-12' })).toBe('2022')
    expect(timeSummary({ from: '2021-09', to: '2021-09' })).toBe('Sep 2021')
    expect(timeSummary({ from: '2022-04' })).toBe('from 2022')
    expect(timeSummary({ to: '2024-09' })).toBe('to 2024')
    expect(timeSpoken({ from: '2022-04', to: '2024-09' })).toBe('April 2022 to September 2024')
    expect(timeSpoken({ from: '2021-09', to: '2021-09' })).toBe('September 2021')
    expect(timeSpoken({ to: '2024-09' })).toBe('up to September 2024')
    expect(timeSpoken({})).toBeUndefined()
  })
})

describe('placesNoteFor (the lifer-only notice)', () => {
  const rec = (seen?: string[]) => ({ code: 'a', source: 'ebird' as const, seen })
  const saved = (ebird: ReturnType<typeof rec>[], list: ReturnType<typeof rec>[] = []) => ({ records: { ebird, 'ebird-list': list, inat: [], manual: [] } })
  it('hidden on an empty list and when seen-here is known', () => {
    expect(placesNoteFor(saved([]), 0, false)).toBeUndefined()
    expect(placesNoteFor(saved([rec(['|CA'])]), 3, true)).toBeUndefined()
  })
  it('a MyEBirdData import saved before seen-here: import it again', () => {
    expect(placesNoteFor(saved([rec(), rec()]), 2, false)).toBe('reimport')
  })
  it('only the life list download or ticks by hand: add MyEBirdData or iNaturalist', () => {
    expect(placesNoteFor(saved([], [rec()]), 1, false)).toBe('add')
  })
})

describe('Status in words', () => {
  it('the button: the number checked; spoken as the full names in IUCN_CATS order', () => {
    expect(statusSummary({})).toBeUndefined()
    expect(statusSummary({ statuses: [] })).toBeUndefined()
    expect(statusSummary({ statuses: ['VU', 'EN'] })).toBe('2')
    expect(statusSpoken({})).toBeUndefined()
    expect(statusSpoken({ statuses: ['VU', 'EN'] })).toBe('Vulnerable, Endangered')
    expect(statusSpoken({ statuses: ['CR', 'EX', 'DD'] })).toBe('Critically Endangered, Extinct, Data Deficient')
  })
  it('the share label: exactly VU, EN and CR read "Threatened"; else one, two joined by +, or "and N more"', () => {
    expect(statusLabel(undefined)).toBeUndefined()
    expect(statusLabel([])).toBeUndefined()
    expect(statusLabel(['VU', 'EN', 'CR'])).toBe('Threatened')
    expect(statusLabel(['EN'])).toBe('Endangered')
    expect(statusLabel(['VU', 'EN'])).toBe('Vulnerable + Endangered')
    expect(statusLabel(['NT', 'VU', 'EN', 'CR'])).toBe('Near Threatened and 3 more')
    expect(statusLabel(['VU', 'EN', 'CR', 'EW'])).toBe('Vulnerable and 3 more')
  })
})

describe('countHead', () => {
  it('count first, " · N checked" only when some are', () => {
    expect(countHead(20, COUNT_WORDS.country, 7)).toBe('20 countries · 7 checked')
    expect(countHead(20, COUNT_WORDS.country, 0)).toBe('20 countries')
    expect(countHead(1, COUNT_WORDS.country, 0)).toBe('1 country')
    expect(countHead(8, COUNT_WORDS.province, 1)).toBe('8 states and provinces · 1 checked')
    expect(countHead(1, COUNT_WORDS.province, 0)).toBe('1 state or province')
    expect(countHead(14, COUNT_WORDS.county, 0)).toBe('14 counties')
    expect(countHead(5, COUNT_WORDS.status, 2)).toBe('5 categories · 2 checked')
    expect(countHead(1200, COUNT_WORDS.country, 0)).toBe('1,200 countries')
  })
})
