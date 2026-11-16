import { describe, expect, it } from 'vitest'
import { ALLOWED as APP_ALLOWED } from '@/lib/analytics'
import { ALLOWED, eventRow } from '../workers/stats/src/event'

const ctx = { day: '2026-11-15', country: 'MX', device: 'iphone', vid: 'abc123' }

describe("the stats Worker's row", () => {
  it("keeps a visit's browser language", () => {
    expect(eventRow({ n: 'visit', p: 'landing', l: 'es' }, ctx)).toEqual({ ...ctx, name: 'visit', value: 'landing', lang: 'es' })
    expect(eventRow({ n: 'visit', p: 'landing', l: 'es' }, ctx)!.lang).toBe('es')
    expect(eventRow({ n: 'visit', p: 'about', l: 'zh' }, ctx)?.lang).toBe('zh')
    expect(eventRow({ n: 'visit', p: 'about' }, ctx)?.lang).toBe('')
  })
  it('stores only a primary subtag: anything else is ""', () => {
    for (const l of ['ES-es', 'ES', 'es-MX', '<script>', 'x', 'abcd', '', 12, null, ['es']]) {
      expect(eventRow({ n: 'visit', p: 'landing', l }, ctx)?.lang, String(l)).toBe('')
    }
  })
  it('never keeps a language on other events', () => {
    expect(eventRow({ n: 'shared', p: 'post', l: 'es' }, ctx)).toEqual({ ...ctx, name: 'shared', value: 'post', lang: '' })
    expect(eventRow({ n: 'collage_made', p: 'inat', l: 'pt' }, ctx)?.lang).toBe('')
  })
  it('drops anything off the allow-list', () => {
    for (const body of [null, 'visit', 7, {}, { n: 'visit', p: '/s/v1.token' }, { n: 'nope', p: 'landing' }, { n: 'toString', p: 'x' }, { n: 'visit' }, { p: 'landing' }]) {
      expect(eventRow(body, ctx), JSON.stringify(body)).toBeNull()
    }
  })
  it("matches the app's allow-list (AGENTS.md: they change together)", () => {
    expect(Object.fromEntries(Object.entries(ALLOWED).map(([k, v]) => [k, [...v]]))).toEqual(APP_ALLOWED)
  })
})

describe('the horizontal share formats', () => {
  it('the Worker allows desktop and wide for downloads and shares, matching the app', () => {
    for (const event of ['image_downloaded', 'shared'] as const) {
      expect([...ALLOWED[event]]).toEqual(APP_ALLOWED[event])
      expect([...ALLOWED[event]]).toEqual(expect.arrayContaining(['desktop', 'wide']))
    }
  })
})

describe('landscape posters', () => {
  it('counts a landscape poster by its size with an -l suffix, and keeps the portrait sizes', () => {
    for (const size of ['a4-l', 'a3-l', 'a2-l', 'a1-l', 'a4', 'a1']) {
      expect(eventRow({ n: 'poster_made', p: size }, ctx)).toEqual({ ...ctx, name: 'poster_made', value: size, lang: '' })
    }
    expect(eventRow({ n: 'poster_made', p: 'a5-l' }, ctx)).toBeNull()
    expect(eventRow({ n: 'poster_made', p: 'A2-l' }, ctx)).toBeNull()
  })
})
