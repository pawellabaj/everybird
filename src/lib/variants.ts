// Preview variants: `?v=<letter>` (every feature) or `?v=<key>:<letter>,…` picks a design to compare on local servers
// and Vercel previews. Never on the production domain: there every feature is its first option. A `v` in the address
// is remembered for the tab (sessionStorage), so it survives in-app navigation; `?v=` clears it.
import { useSyncExternalStore } from 'react'
import { SHARE_ORIGIN } from '@/lib/share/origin'

const PROD_HOST = new URL(SHARE_ORIGIN).host
const KEY = 'everybird:v'
const LETTER = /^[a-z]$/
const FEATURE = /^[a-z][a-z0-9-]*$/

/** False on the production domain or a Vercel production build; true elsewhere (local dev, e2e, previews). */
export function variantsEnabled(host: string | undefined = typeof location === 'undefined' ? undefined : location.host): boolean {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') return false
  return host !== PROD_HOST
}

/** `?v=b` → `{ '*': 'b' }`; `?v=stamp:b,pill:c` → `{ stamp: 'b', pill: 'c' }`; letters a–z only, the rest ignored. */
export function parseVariants(search: string): Record<string, string> {
  return parseValue(new URLSearchParams(search).get('v') ?? '')
}

function parseValue(value: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of value.split(',')) {
    const bits = part.trim().split(':')
    if (bits.length === 1 && LETTER.test(bits[0])) out['*'] = bits[0]
    else if (bits.length === 2 && FEATURE.test(bits[0]) && LETTER.test(bits[1])) out[bits[0]] = bits[1]
  }
  return out
}

/** The tab's `v` value: the address's (remembered, or cleared when empty), else the one remembered earlier. */
function currentValue(): string {
  if (typeof location === 'undefined') return ''
  const v = new URLSearchParams(location.search).get('v')
  try {
    if (v === null) return sessionStorage.getItem(KEY) ?? ''
    if (v) sessionStorage.setItem(KEY, v)
    else sessionStorage.removeItem(KEY)
  } catch {
    // No storage: the address alone decides.
  }
  return v ?? ''
}

/** The feature's variant: its own key, else `*`, if it is one of `options`; `options[0]` otherwise and when disabled. */
export function readVariant<T extends string>(feature: string, options: readonly [T, ...T[]], search?: string): T {
  if (!variantsEnabled()) return options[0]
  const picked = search === undefined ? parseValue(currentValue()) : parseVariants(search)
  const v = picked[feature] ?? picked['*']
  return (options as readonly string[]).includes(v) ? (v as T) : options[0]
}

const noSubscribe = () => () => {}

/**
 * readVariant for a component: `options[0]` on the server and while hydrating (React renders the server snapshot,
 * then the read value), so there is no hydration mismatch; a component mounted after hydration reads it at once.
 */
export function useVariant<T extends string>(feature: string, options: readonly [T, ...T[]]): T {
  return useSyncExternalStore(noSubscribe, () => readVariant(feature, options), () => options[0])
}
