import { describe, expect, it } from 'vitest'
import { IUCN_CATS } from '../src/lib/species/iucn'
import { markShown } from '../src/lib/species/status-mark'

describe('which List view rows carry the pill', () => {
  it('VU, EN and CR only; never without a category', () => {
    expect(IUCN_CATS.filter((c) => markShown(c))).toEqual(['VU', 'EN', 'CR'])
    expect(markShown(undefined)).toBe(false)
  })
})
