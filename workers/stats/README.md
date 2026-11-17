# everybird-stats

The anonymous usage Worker for Everybird (`stats.yusuftaleb.com`).

- `POST /e` receives the app's beacons and stores them in D1 (`everybird-events`, table `events`). Unchanged.
- `GET /dashboard` and `GET /dashboard/data` are a private dashboard for Yusuf, locked behind Cloudflare Access.

## The dashboard

One page, no framework, no CDN, no web fonts, in the site's Paper/Ink style. Light and dark use the site's seven tokens through `[data-theme]` on `<html>`; with no saved choice the page follows the device, and the sun/moon switch in the header saves a choice per device (localStorage `everybird:theme`, wrapped in try/catch). Loading shows skeletons; changing the range, country or metric grows the bars (not under `prefers-reduced-motion`).
For the chosen range (Today, 7d, 14d, 30d, All; default 14 days) and an optional country it shows:

1. Headline tiles: people on the last day, collages, images downloaded, shares, posters made, poster downloads, each with its daily sparkline and the change against the equal period just before (a quiet arrow, no colour; none on All, whose previous period has no data).
2. A daily bar chart with a metric switcher (People, Collages, Downloads, Shares, Posters). Hover, tap or use the arrow keys for the exact value and date. **Compare** draws the previous period as ghost bars behind. **Export CSV** saves the daily series for the current range and country.
3. **Rates**: the share of person-days that made a collage, downloaded an image or poster, shared, and made a poster.
4. **Since launch** (all time, all countries): collages, images, posters, the busiest day (by people), and a Copy button for a postable sentence ("More than N collages made on Everybird."), rounded down and strictly below the count. It counts only collages from a real list (not the landing demo's `sample`, not a `restore`).
5. The funnel: landing, settings, collage page, collage made, image or poster downloaded, as person-days and a share of the landing page.
6. Breakdowns: image formats, poster sizes, filters used, searches, interface language, browser language, devices, and the top 15 countries. Clicking a country (or choosing it in the selector) filters the whole page and opens a compact **country panel**: people a day, collage rate, downloads per person-day, share rate, top formats, browser language and interface language. Interface language counts people who switched it (the site only records a switch); browser language counts visits.
7. A footer with the refresh button (it skips the browser's 60-second cache), an optional **auto-refresh** every 60 s while the tab is visible (saved per device), and the last refresh time.

The URL hash keeps the view, so a link reopens it: `#r=7&c=MX&m=collages&cmp=1` (range 1, 7, 14, 30 or `all`; country; metric; compare). Defaults are left out.

The page's small pure functions (hash parse and serialize, CSV, the safe claim, rates, change) live in `src/pure.ts` as a plain-JS string that `page.ts` inlines and the tests evaluate, so there is one copy.

Notes on the numbers: days are Pacific (America/Vancouver) from 17 Nov 2026, and UTC days before (see **Day boundary** below); counts are an undercount (Do Not Track, Global Privacy Control and blockers are not counted). A visitor id (`vid`) lasts one stats day, so "people" is only meaningful per day. Multi-day figures are person-days (distinct day + vid pairs) and labelled so. `/dashboard/data?from=YYYY-MM-DD&to=YYYY-MM-DD&country=XX` returns aggregates only (never rows or vids), as ten statements (GROUP BY queries, bound params only) run in one `DB.batch`, with `Cache-Control: private, max-age=60`. New fields: `days[]` also carry `images` and `posterDownloads`; `prevDays[]` is the previous period day for day (empty on All); `rates` (person-days with each action, over all person-days); `launch` (`since`, `collages`, `own`, `images`, `posters`, `peak`).

## Day boundary (Pacific from 17 Nov 2026)

- **Cutover:** `CUTOVER` is `2026-11-17T00:00:00Z` (`src/event.ts`). From that instant a row's `day` is the America/Vancouver date (`statsDay()`), and before it the UTC date. Vancouver is UTC-7 all year from 1 Nov 2026 (tzdata 2026f; `wrangler dev --local` agrees), so the Pacific date is 16 Nov until 07:00Z and 17 Nov from then. The visitor id (`vid`), the visit dedupe and the daily cap all use the same day.
- "Today" and the default ranges on the dashboard are the Pacific date (`pacificDay`, and `pacific()` in the page from `src/pure.ts`).
- The old Worker writes UTC dates, so the rows it wrote from 00:00Z until the new Worker went live carry day `2026-11-17` but are Pacific 16 Nov evening. The relabel moves them.
- **Deploy the Worker before 2026-11-17T07:00Z, then run the relabel right after the deploy, and before 07:00Z.** From 07:00Z the new Worker writes Pacific 17 Nov rows under the same label, so the relabel must not run after that. SQL cannot read the clock; this deadline is the operator's to keep.

```
cd workers/stats
npx wrangler d1 execute everybird-events --remote --command "SELECT COUNT(*) AS n FROM events WHERE day = '2026-11-17'"   # rows to move
npx wrangler d1 execute everybird-events --remote --file migrations/2026-11-17-pacific-relabel.sql
npx wrangler d1 execute everybird-events --remote --command "SELECT COUNT(*) AS n FROM events WHERE day = '2026-11-17'"   # now 0
```

  Old instances can still write for a short time after a deploy. If the last count is not 0 and it is still before 07:00Z, run the migration again; it is safe to repeat before 07:00Z.
- 16 Nov, after the relabel, is **31 hours**: from 15 Nov 17:00 to 16 Nov 24:00 Pacific. The dashboard footer says so.
- Known and accepted: a visitor who visited between 00:00Z and the deploy (their visit keyed on the UTC 17 Nov string) and again on the same Pacific 16 Nov after the deploy is counted twice on 16 Nov. The "busiest day" figure can be 16 Nov, a 31-hour day.

## Environment variables

All three are required; if any is missing, or the Access token does not verify, both dashboard routes answer 404 (fail closed). Set them as secrets (never commit values):

```
cd workers/stats
npx wrangler secret put ACCESS_AUD           # the application's AUD tag
npx wrangler secret put ACCESS_TEAM_DOMAIN   # e.g. yourteam.cloudflareaccess.com
npx wrangler secret put DASHBOARD_EMAILS     # comma-separated, e.g. you@example.com
```

The Worker checks the `Cf-Access-Jwt-Assertion` JWT: RS256 signature against `https://<team domain>/cdn-cgi/access/certs`, `iss` = `https://<ACCESS_TEAM_DOMAIN>`, `aud` contains `ACCESS_AUD`, not expired, and the `email` claim is in `DASHBOARD_EMAILS`.

## Create the Cloudflare Access application (one time)

1. Open https://one.dash.cloudflare.com and pick the account. If asked to set up Zero Trust, choose the Free plan and a team name (this becomes `<team>.cloudflareaccess.com`).
2. Settings, Authentication: under Login methods, make sure **One-time PIN** is listed (add it if not).
3. Access controls, Applications, **Add an application**, then **Self-hosted**.
4. Application name: `Everybird stats`. Session duration: your choice (24 hours is fine).
5. **Add public hostname**: Domain `yusuftaleb.com`, Subdomain `stats`, Path `dashboard*`. (Older dashboards: Application domain `stats.yusuftaleb.com`, path `dashboard*`.) Do not cover `/e`: the app's beacons must stay public.
6. Identity providers: allow only **One-time PIN**; turn off "Accept all available identity providers".
7. Policies, **Create new policy**: name `Yusuf only`, action **Allow**, rule Include, selector **Emails**, value your email address. Save the policy, attach it to the application, and Save.
8. Find the AUD tag: Access controls, Applications, click `Everybird stats`, Edit, **Overview** tab, "Application Audience (AUD) Tag" (copy it). Use it for `ACCESS_AUD`.
9. Find the team domain: Settings, Custom pages (or General), "Team domain": `<team>.cloudflareaccess.com`. Use it for `ACCESS_TEAM_DOMAIN`.
10. Set the three secrets (above), deploy the Worker, then open `https://stats.yusuftaleb.com/dashboard`, enter your email, and type the PIN that arrives.

Access runs in front of the Worker and adds the JWT; the Worker verifies it itself, so the page stays closed even if the Access rule were ever removed.

## Checks

```
npx vitest run tests/stats-worker.test.ts tests/stats-dashboard.test.ts   # from the repo root
cd workers/stats && npx wrangler types && npx -p typescript tsc --noEmit
```
