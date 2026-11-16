import type { MetadataRoute } from 'next'
import { LANGS } from '@/i18n/langs'
import { siteUrl } from '@/lib/site-meta'

// The landing page and /about are open to crawlers (so are the scripts and styles they need, under /_next/).
// /s/ is closed: a share link's token is the birder's whole list. Those pages also say noindex. So are the per-language
// copies the rewrites serve it from (/es/s/…; src/i18n/routes.ts), which are reachable by their own URLs too.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/s/', ...LANGS.map((l) => `/${l}/s/`)] },
    sitemap: siteUrl('/sitemap.xml'),
  }
}
