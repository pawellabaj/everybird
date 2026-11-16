// The page's path without its language. A page prerendered at /es/settings is served at /settings (the rewrites in
// routes.ts): on the server usePathname() reads "/es/settings", in the browser "/settings". Everything that compares
// paths reads useAppPath(), so the server's HTML and the first client render agree (no hydration mismatch).
import { usePathname } from 'next/navigation'
import { LANGS } from './langs'

const PREFIX = new RegExp(`^/(?:${LANGS.join('|')})(?=/|$)`)

/** "/es/settings" -> "/settings", "/es" -> "/", anything else unchanged. */
export function stripLang(path: string): string {
  if (!PREFIX.test(path)) return path
  return path.replace(PREFIX, '') || '/'
}

/** usePathname() without the language prefix. */
export function useAppPath(): string {
  return stripLang(usePathname())
}
