# Cloudflare cutover: everybird.yusuftaleb.com from Vercel to the Worker

Status (2026-11-17): the test copy runs on Cloudflare Workers at `https://everybird.yusufbtaleb.workers.dev` (Worker name `everybird`). It has no routes and no custom domain, so `everybird.yusuftaleb.com` still serves from Vercel. Nothing in this runbook has been run yet. Each step below is for Yusuf to approve and run.

Deadline: Vercel's Hobby plan pauses the project at about **2026-11-18 23:35 America/Vancouver** (more than 1M CDN requests in a rolling 30 days). After that the live domain stops serving until Vercel is unpaused. Cut over before the pause. A rollback to Vercel only works while the Vercel project is live.

## What is already in place

- `wrangler.jsonc`: Worker `everybird`, `main` `.open-next/worker.js`, the `ASSETS` binding, `WORKER_SELF_REFERENCE`, and the R2 incremental cache `NEXT_INC_CACHE_R2_BUCKET` on the existing `everybird-opennext-cache` bucket. It has **no** `routes` and **no** `custom_domain`, and it must stay that way until the cutover commit.
- `open-next.config.ts`: the R2 incremental cache. The Vercel build never reads it.
- Build-time values: the production Vercel values of `NEXT_PUBLIC_DATA_BASE` and `NEXT_PUBLIC_STICKER_BASE` are inlined by `next build`. They must be in the environment of any Cloudflare build (`npm run cf:build`). They are not Worker runtime variables, and the values are not committed.
- The Worker needs no runtime secrets. The Vercel-only variables (`VERCEL_ENV`, `VERCEL_URL`) are not needed: the production origin comes from the code, and the Cloudflare Web Analytics beacon loads on the production hostname only.
- Static assets (`public/_headers`) carry the same cache and referrer rules as `next.config.ts`'s `headers()`.

## 1. Preflight (before the cutover commit)

1. Merge the cloudflare-hosting branch to `main` only after Yusuf approves (AGENTS.md: ask first before pushing or deploying).
2. From a clean checkout of the merged commit:
   ```
   npm ci
   set -a; . <path to a file with only NEXT_PUBLIC_DATA_BASE and NEXT_PUBLIC_STICKER_BASE>; set +a
   npm run cf:build
   npx opennextjs-cloudflare populateCache remote
   npx wrangler deploy
   ```
   `npm run cf:deploy` runs the populate step and `wrangler deploy` together. A bare `wrangler deploy` skips the populate step, so the prerendered pages and their R2 entries would be missing.
3. Confirm the test copy still matches Vercel. Compare status, content type, size, the metadata tags of `/`, `/es`, `/pt`, `/nl`, `/about`, `/settings`, a share link (`/s/<token>`), and the OG images (`/s/<token>/opengraph-image`, `/s/<token>/twitter-image`) on `https://everybird.yusufbtaleb.workers.dev` and `https://everybird.yusuftaleb.com`. The OG images differ in byte size but must match in dimensions and opacity.
4. Note the current DNS record for `everybird.yusuftaleb.com` in the yusuftaleb.com zone: type, target, and proxy state. It is a proxied record pointing at Vercel today (it resolves to Cloudflare's proxy IPs and responses carry `x-vercel-id`). Save these values; the rollback needs them.
5. Confirm the Vercel project is still linked to the domain (Vercel dashboard → Domains), so a rollback has somewhere to go.

## 2. Attach the custom domain

Use one of the two options. Both need the existing Vercel record out of the way first.

**Option A, dashboard:** Workers & Pages → `everybird` → Settings → Domains & Routes → Add → Custom domain → `everybird.yusuftaleb.com`. Cloudflare asks to replace the existing record for that host. Accept only after step 4 of the preflight is saved.

**Option B, config:** add to `wrangler.jsonc` in the cutover commit:
```jsonc
"routes": [{ "pattern": "everybird.yusuftaleb.com", "custom_domain": true }]
```
then `npx wrangler deploy`. Remove the existing Vercel record first, or the deploy reports a conflicting record.

What happens to DNS: the Vercel record for `everybird.yusuftaleb.com` is replaced by a proxied record that points at the Worker. Cloudflare manages the record, so there is no TTL to wait out beyond normal propagation. The Vercel project keeps its domain binding, which is what makes the rollback possible.

## 3. Verify (no browser)

```
curl -sI https://everybird.yusuftaleb.com/ | grep -i '^server\|^x-opennext\|^x-vercel-id'
```
Expect `server: cloudflare`, `x-opennext: 1`, and no `x-vercel-id`. Then repeat the preflight comparison (step 1.3) against `https://everybird.yusuftaleb.com` alone, and check:

- `/s/<token>` shows the same metadata (27 tags), and `/s/<token>/opengraph-image` returns a 1200×630 PNG.
- `robots.txt` disallows `/s/`, `sitemap.xml` lists the landing page and `/about`, and `manifest.webmanifest` and icons return 200 with the immutable or week-long cache rules.
- The `/data/*` files return the same bytes as on Vercel.
- The stats beacon: the Worker's origin allow-list is `https://everybird.yusuftaleb.com`, so visits from the production domain are accepted and the workers.dev copy's beacons are rejected (as expected). Confirm a visit appears on the stats dashboard after the cutover.
- Cloudflare Web Analytics: the app loads its beacon only on the production hostname, so confirm that visits show in the Web Analytics dashboard.

Then purge the zone cache (Caching → Configuration → Purge Everything), because Cloudflare may still hold Vercel-era responses for icons and other static files at the old origin.

## 4. Rollback (instant)

1. Remove the custom domain: Worker `everybird` → Domains & Routes → remove `everybird.yusuftaleb.com`; or delete the `routes` block from `wrangler.jsonc` and run `npx wrangler deploy`.
2. Restore the DNS record saved in preflight step 4 (the proxied record pointing at Vercel).
3. Verify: `curl -sI https://everybird.yusuftaleb.com/ | grep -i x-vercel-id` returns the Vercel header. Purge the zone cache.

The rollback only works while the Vercel project is live and still has the domain. After about 2026-11-18 23:35 Vercel pauses the project, and the rollback does not serve the site until Vercel is unpaused.

## 5. Follow-ups after the cutover

- Watch errors for at least 48 hours: Worker logs (observability is on in `wrangler.jsonc`), the OG routes, and the stats dashboard.
- Keep the Vercel project and its domain for about two weeks as a fallback. Then remove the domain from the Vercel project, and downgrade or delete the project. The Vercel build (`npm run build`) keeps passing meanwhile; `.vercelignore` keeps the Cloudflare-only files out of Vercel's upload.
- Decide on edge caching. Vercel cached the prerendered HTML and the OG images at its CDN for a year (`s-maxage`). Cloudflare does not cache HTML or extensionless OG responses without a Cache Rule, so every page view and every OG image costs a Worker run (plus an R2 read for the prerendered page). Add Cache Rules only if the cost matters; the browser-visible headers already match.
- Keep `public/_headers` and the header rules in `next.config.ts` in step (`public/_headers` is ignored by Vercel).
- Build environment: a future Cloudflare build (laptop or CI) needs `NEXT_PUBLIC_DATA_BASE` and `NEXT_PUBLIC_STICKER_BASE` set, or the app loads data from the wrong place.
- The zone's Cloudflare Web Analytics auto-injection (visible on Vercel's HTML today) is zone-level, so it carries on after the cutover. Check that counts are not doubled.
- Update the hosting notes in README.md and AGENTS.md once Yusuf has decided the cutover is final.

## Cost notes

Figures from memory of Cloudflare's pricing (Workers Paid, R2): verify on the current pricing pages before relying on them.

- Static assets (JS, CSS, icons, the `/data` JSON, fonts) are served by Workers Static Assets and do not count as Worker requests.
- Each HTML page view is one Worker invocation, plus an R2 read of the prerendered entry. Each share-link OG image is one invocation with WebP decoding and resizing of up to about 60 stickers on the CPU, so OG images are the most CPU-heavy route. Workers Paid includes 10 million requests and 30 million CPU-milliseconds a month.
- R2: the cache bucket holds small JSON entries, and reads and writes are billed per operation beyond the included monthly allowance. The data and sticker buckets are unchanged.
- No Cloudflare Images transformations: image optimisation is off (`images.unoptimized`), no `IMAGES` binding exists, and the sticker conversion runs in the Worker.
- The stats Worker and D1 are unchanged and not part of this migration.
- Vercel stops counting CDN requests once the domain is on the Worker, so its 30-day total stops mattering.
