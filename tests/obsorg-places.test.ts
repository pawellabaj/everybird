import { describe, expect, it } from 'vitest'
import { countryNameMap, makeObsOrgPlaces, OBSORG_COUNTRY_ALIASES, OBSORG_SUB1_ALIASES } from '@/lib/import/obsorg-places'
import { regions } from './obsorg-helpers'
const place = () => makeObsOrgPlaces(regions)

describe('observation.org country and division names', () => {
  it('maps country names in nl, en, fr, de and es', () => {
    const p = place()
    for (const [name, country] of Object.entries({ Nederland: 'NL', België: 'BE', Spanje: 'ES', 'Verenigd Koninkrijk': 'GB', Belgique: 'BE', Deutschland: 'DE', España: 'ES', Netherlands: 'NL', belgie: 'BE', 'Sint-Helena, Ascension en Tristan da Cunha':'SH', 'Zuid-Georgië en de Zuidelijke Sandwicheilanden':'GS' })) expect(p(name, '')).toEqual({ country })
  })
  it('oceans and unknown countries give no place', () => {
    const p = place()
    expect(p('World','Southern Atlantic Ocean')).toBeUndefined()
    expect(p('Atlantis','X')).toBeUndefined()
  })
  it('maps divisions within the country, dropping one trailing parenthesis and never matching fuzzily', () => {
    const p = place()
    for (const [country, division, iso, sub1] of [
      ['België','Antwerpen','BE','BE-VAN'], ['België','Oost-Vlaanderen','BE','BE-VOV'],
      ['Nederland','Noord-Holland','NL','NL-NH'], ['Frankrijk','Pas-de-Calais (62)','FR','FR-62'],
      ['België','Limburg (B)','BE','BE-VLI'], ['Nederland','Limburg','NL','NL-LI'],
      ['Peru','Cuzco','PE','PE-CUS'], ['Spanje','Murcia','ES','ES-MC'], ['Duitsland','Beieren','DE','DE-BY'],
    ]) expect(p(country,division)).toEqual({ country:iso, sub1 })
    expect(p('Nederland','Noord Holand')).toEqual({ country:'NL' })
    expect(p('Nederland','Antwerpen')).toEqual({ country:'NL' })
  })
  it('falls back to country for empty or unknown divisions and caches a pair', () => {
    const p = place()
    expect(p('Nederland','')).toEqual({ country:'NL' })
    expect(p('Nederland','Atlantis')).toEqual({ country:'NL' })
    expect(p('Nederland','Atlantis')).toBe(p('Nederland','Atlantis'))
  })
  it('every alias points to a real code', () => {
    for (const code of Object.keys(OBSORG_SUB1_ALIASES)) expect(regions.sub1[code]).toBeDefined()
    for (const code of Object.values(OBSORG_COUNTRY_ALIASES)) expect(regions.countries[code]).toBeDefined()
  })
  it('drops colliding country names permanently, even if repeated', () => {
    const r = { v:1 as const, countries:{ AA:'Collision', BB:'Collision', CC:'Unique' }, sub1:{} }
    expect(countryNameMap(r, []).has('collision')).toBe(false)
    expect(countryNameMap(r, []).get('unique')).toBe('CC')
  })
})
