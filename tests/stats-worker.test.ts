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
