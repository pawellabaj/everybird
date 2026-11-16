import { expect, it } from 'vitest'
import { PRINT, PRINT_FROM, STICKER_BASE, printStickerUrl, stickerPath } from '../src/lib/sticker-url'

it('selects print tiers by device pixels and preserves versions in the fallback', () => {
  expect(PRINT).toBe(1024)
  expect(PRINT_FROM).toBe(440)
  expect(stickerPath('crowa', PRINT, 'd79c59489f')).toBe('v1/1024/crowa.d79c59489f.webp')
  for (const [px, size] of [[1, 128], [128, 128], [129, 384], [440, 384]]) {
    expect(printStickerUrl('crowa', px)).toEqual({ url: `${STICKER_BASE}/v1/${size}/crowa.webp`, fallback: null })
  }
  expect(printStickerUrl('crowa', 441, 'ab12')).toEqual({ url: `${STICKER_BASE}/v1/1024/crowa.ab12.webp`, fallback: `${STICKER_BASE}/v1/384/crowa.ab12.webp` })
})
