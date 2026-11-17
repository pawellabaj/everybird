import { Home } from '@/components/app/Home'
import { SITE_NAME, siteUrl } from '@/lib/site-meta'

// Only the layout's four languages exist: any other first segment (/nope) is the static 404, never a render.
export const dynamicParams = false

export default function Page() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: siteUrl('/'),
    }).replace(/</g, '\\u003c') }} />
    <Home />
  </>
}
