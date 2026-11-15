import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPrintStickers } from '@/lib/share/print-stickers'
import { printStickerUrl } from '@/lib/sticker-url'

const print = (code = 'synthetic') => printStickerUrl(code, 500, 'abc123')
const screen = (code = 'synthetic') => printStickerUrl(code, 200)
const bitmap = () => ({ width: 1, height: 1, close: vi.fn() }) as unknown as ImageBitmap
const ok = () => ({ ok: true, status: 200, blob: async () => new Blob(['synthetic sticker']) }) as Response
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('print stickers', () => {
  it.each(['404', 'network', 'decode'] as const)('a 1024 %s failure draws its versioned 384 fallback, counted as soft', async (failure) => {
    const image = bitmap()
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/1024/')) {
        if (failure === 'network') throw new TypeError('CORS')
        if (failure === '404') return new Response(null, { status: 404 })
      }
      return ok()
    })
    const decode = vi.fn().mockResolvedValue(image)
    if (failure === 'decode') decode.mockRejectedValueOnce(new Error('invalid image'))
    const loader = createPrintStickers({ fetch, decode })
    expect(await loader.get(print())).toBe(image)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([print().url, print().fallback])
    expect(fetch.mock.calls.every(([, opts]) => opts?.mode === 'cors')).toBe(true)
    expect(loader.stats()).toEqual({ soft: 1, missing: 0 })
    loader.dispose()
  })

  it('12 parallel gets with no print tier make exactly 3 serial probes, then use 384 for all', async () => {
    let active = 0, peak = 0
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/1024/')) {
        peak = Math.max(peak, ++active)
        await Promise.resolve()
        active--
        return new Response(null, { status: 404 })
      }
      return ok()
    })
    const loader = createPrintStickers({ fetch, decode: async () => bitmap() })
    const images = await Promise.all(Array.from({ length: 12 }, (_, i) => loader.get(print(`bird${i}`))))
    expect(images.every(Boolean)).toBe(true)
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/1024/'))).toHaveLength(3)
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/384/'))).toHaveLength(12)
    expect(peak).toBe(1)
    expect(loader.stats()).toEqual({ soft: 12, missing: 0 })
    loader.dispose()
  })

  it('one successful print decode unlocks parallel requests and keeps the breaker closed after later misses', async () => {
    const first = deferred<ImageBitmap>()
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(ok())
    const decode = vi.fn().mockImplementation(() => first.promise)
    const loader = createPrintStickers({ fetch, decode })
    const a = loader.get(print('first'))
    const others = ['second', 'third', 'fourth'].map((code) => loader.get(print(code)))
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1) // gate includes decode, not only HTTP
    const held = deferred<Response>()
    fetch.mockImplementation(() => held.promise)
    decode.mockImplementation(async () => bitmap())
    first.resolve(bitmap())
    await a
    await flush()
    expect(fetch).toHaveBeenCalledTimes(4) // all three start before any completes
    held.resolve(new Response(null, { status: 404 }))
    // The fallback requests need fresh response bodies.
    fetch.mockImplementation(async () => ok())
    await Promise.all(others)
    await loader.get(print('fifth'))
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/1024/'))).toHaveLength(5)
    expect(loader.stats()).toEqual({ soft: 3, missing: 0 })
    loader.dispose()
  })

  it.each([false, true])('a failed used URL retries once after 1000 ms, then null (fallback=%s)', async (fallback) => {
    vi.useFakeTimers()
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response(null, { status: 503 }))
    const decode = vi.fn()
    const loader = createPrintStickers({ fetch, decode })
    const source = fallback ? print() : screen()
    const result = loader.get(source)
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(fallback ? 2 : 1)
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(fallback ? 3 : 2)
    expect(decode).not.toHaveBeenCalled()
    expect(loader.stats()).toEqual({ soft: 0, missing: 1 }) // an outline is missing only, never soft
    expect(await loader.get(source)).toBeNull() // failed result is cached by original URL
    loader.dispose()
  })

  it('a transient failure of the used file can succeed on its retry', async () => {
    vi.useFakeTimers()
    const image = bitmap()
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(new TypeError('offline')).mockImplementation(async () => ok())
    const loader = createPrintStickers({ fetch, decode: async () => image }, { retryMs: 15 })
    const result = loader.get(screen())
    await vi.advanceTimersByTimeAsync(15)
    expect(await result).toBe(image)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(loader.stats()).toEqual({ soft: 0, missing: 0 })
    loader.dispose()
  })

  it('a timed-out print request falls back immediately and aborts its fetch', async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | undefined
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((url, opts) => {
      if (String(url).includes('/1024/')) {
        requestSignal = opts?.signal as AbortSignal
        return new Promise(() => {})
      }
      return Promise.resolve(ok())
    })
    const image = bitmap()
    const loader = createPrintStickers({ fetch, decode: async () => image })
    const result = loader.get(print())
    await vi.advanceTimersByTimeAsync(19_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toBe(image)
    expect(requestSignal?.aborted).toBe(true)
    expect(loader.stats()).toEqual({ soft: 1, missing: 0 })
    loader.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['body', 'decode'] as const)('timeout covers %s, retries once and closes late bitmaps', async (phase) => {
    vi.useFakeTimers()
    const late = [deferred<ImageBitmap>(), deferred<ImageBitmap>()]
    const images = [bitmap(), bitmap()]
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => {
      if (phase === 'body') return { ok: true, blob: () => new Promise<Blob>(() => {}) } as Response
      return ok()
    })
    const decode = vi.fn().mockImplementationOnce(() => late[0].promise).mockImplementationOnce(() => late[1].promise)
    const loader = createPrintStickers({ fetch, decode }, { timeoutMs: 10, retryMs: 5 })
    const result = loader.get(screen())
    await vi.advanceTimersByTimeAsync(25)
    expect(await result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
    late.forEach((d, i) => d.resolve(images[i]))
    await flush()
    images.forEach((b) => expect(b.close).toHaveBeenCalledTimes(phase === 'decode' ? 1 : 0))
    expect(loader.stats()).toEqual({ soft: 0, missing: 1 })
    loader.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('caches by the original URL, releases a fallback by that key and counts each URL once across strips', async () => {
    const images: ImageBitmap[] = []
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) => String(url).includes('/1024/') ? new Response(null, { status: 404 }) : ok())
    const loader = createPrintStickers({ fetch, decode: async () => { const b = bitmap(); images.push(b); return b } })
    const [a, b] = await Promise.all([loader.get(print()), loader.get(print())])
    expect(a).toBe(b)
    expect(await loader.get(print())).toBe(a)
    expect(fetch).toHaveBeenCalledTimes(2)
    loader.release(print().fallback!)
    expect(a?.close).not.toHaveBeenCalled()
    loader.release(print().url)
    loader.release(print().url)
    expect(a?.close).toHaveBeenCalledTimes(1)
    await loader.get(print())
    expect(loader.stats()).toEqual({ soft: 1, missing: 0 })
    loader.dispose()
    loader.dispose()
    expect(images).toHaveLength(2)
    expect(images.every((b) => vi.mocked(b.close).mock.calls.length === 1)).toBe(true)
    await expect(loader.get(screen())).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('a queued probe can abort without fetching or counting as a failed probe', async () => {
    const pending = deferred<Response>()
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => pending.promise)
    const loader = createPrintStickers({ fetch, decode: async () => bitmap() })
    const first = loader.get(print('first'))
    const c = new AbortController()
    const queued = loader.get(print('queued'), c.signal)
    c.abort()
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).toHaveBeenCalledTimes(1)
    pending.resolve(ok())
    await first
    expect(loader.stats()).toEqual({ soft: 0, missing: 0 })
    loader.dispose()
  })

  it('abort during fetch rejects promptly, cancels the request and does not poison the URL cache', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise(() => {}))
    const image = bitmap()
    const loader = createPrintStickers({ fetch, decode: async () => image })
    const c = new AbortController()
    const result = loader.get(screen(), c.signal)
    await flush()
    c.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
    fetch.mockImplementation(async () => ok())
    expect(await loader.get(screen())).toBe(image)
    expect(loader.stats()).toEqual({ soft: 0, missing: 0 })
    await expect(loader.get(screen(), c.signal)).rejects.toMatchObject({ name: 'AbortError' })
    loader.dispose()
  })

  it('one caller aborting a shared URL leaves another caller able to use it', async () => {
    const pending = deferred<ImageBitmap>()
    const image = bitmap()
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => ok())
    const loader = createPrintStickers({ fetch, decode: () => pending.promise })
    const c = new AbortController()
    const a = loader.get(screen(), c.signal)
    const b = loader.get(screen())
    c.abort()
    await expect(a).rejects.toMatchObject({ name: 'AbortError' })
    pending.resolve(image)
    expect(await b).toBe(image)
    expect(fetch).toHaveBeenCalledTimes(1)
    loader.dispose()
  })

  it.each(['release', 'dispose'] as const)('%s cancels pending decode, closes its late bitmap and starts no queued fetches', async (action) => {
    const pending = deferred<ImageBitmap>()
    const image = bitmap()
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => ok())
    const loader = createPrintStickers({ fetch, decode: () => pending.promise })
    const result = loader.get(print())
    const queued = action === 'dispose' ? loader.get(print('queued')) : null
    await flush()
    if (action === 'dispose') loader.dispose()
    else loader.release(print().url)
    // A release mid-load is not a user cancel, so it must not look like one.
    await expect(result).rejects.toMatchObject(action === 'dispose'
      ? { name: 'AbortError' }
      : { name: 'StickerReleased', message: 'print sticker released while loading' })
    if (queued) await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    pending.resolve(image)
    await flush()
    expect(image.close).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(loader.stats()).toEqual({ soft: 0, missing: 0 })
    loader.dispose()
  })

  it('abort during the retry delay prevents a second request and clears timers', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('offline'))
    const loader = createPrintStickers({ fetch })
    const c = new AbortController()
    const result = loader.get(screen(), c.signal)
    await vi.advanceTimersByTimeAsync(1)
    c.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(loader.stats()).toEqual({ soft: 0, missing: 0 })
    expect(vi.getTimerCount()).toBe(0)
    loader.dispose()
  })

  it('a release mid-load rejects a caller whose own signal never aborted with StickerReleased', async () => {
    const pending = deferred<ImageBitmap>()
    const image = bitmap()
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => ok())
    const loader = createPrintStickers({ fetch, decode: () => pending.promise })
    const c = new AbortController()
    const a = loader.get(screen(), c.signal)
    const b = loader.get(screen())
    await flush()
    loader.release(screen().url)
    await expect(a).rejects.toMatchObject({ name: 'StickerReleased' })
    await expect(b).rejects.toMatchObject({ name: 'StickerReleased' })
    expect(c.signal.aborted).toBe(false)
    pending.resolve(image)
    await flush()
    expect(image.close).toHaveBeenCalledTimes(1)
    // The released entry stays out of the cache: the next get loads again.
    expect(await loader.get(screen())).toBe(image)
    expect(fetch).toHaveBeenCalledTimes(2)
    loader.dispose()
  })

  it('calls injected fetch and decode as plain functions, so window.fetch and createImageBitmap can be passed', async () => {
    const image = bitmap()
    const fetch = function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation')
      return Promise.resolve(ok())
    } as typeof globalThis.fetch
    const decode = function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation')
      return Promise.resolve(image)
    }
    const loader = createPrintStickers({ fetch, decode })
    expect(await loader.get(print())).toBe(image)
    expect(loader.stats()).toEqual({ soft: 0, missing: 0 })
    loader.dispose()
  })

  it('defaults use fetch in CORS mode and createImageBitmap', async () => {
    const image = bitmap()
    const fetch = vi.fn().mockImplementation(async () => ok())
    const decode = vi.fn().mockResolvedValue(image)
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('createImageBitmap', decode)
    const loader = createPrintStickers()
    expect(await loader.get(screen())).toBe(image)
    expect(fetch.mock.calls[0][1].mode).toBe('cors')
    expect(decode).toHaveBeenCalledWith(expect.any(Blob))
    loader.dispose()
  })
})
