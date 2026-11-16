# everybird-stats

The anonymous usage Worker for Everybird (`stats.yusuftaleb.com`).

- `POST /e` receives the app's beacons and stores them in D1 (`everybird-events`, table `events`). Unchanged.
- `GET /dashboard` and `GET /dashboard/data` are a private dashboard for Yusuf, locked behind Cloudflare Access.

## The dashboard

One page, no framework, no CDN, no web fonts, in the site's Paper/Ink style (light and dark follow the device).
For the chosen range (Today, 7d, 14d, 30d, All; default 14 days) and an optional country it shows:

1. Headline tiles: people on the last day, collages, images downloaded, shares, posters made, poster downloads, each with the change against the equal period just before.
2. A daily bar chart with a metric switcher (People, Collages, Downloads, Shares, Posters). Hover or tap a bar for the exact value and date.
3. The funnel: landing, settings, collage page, collage made, image or poster downloaded, as person-days and a share of the landing page.
4. Breakdowns: image formats, poster sizes (portrait vs landscape), filters used, searches, interface language, browser language, devices, and the top 15 countries (a "Show all" toggle). Clicking a country filters the whole page; the chip next to the selector removes the filter.
5. A footer with the refresh button and the last refresh time.

Notes on the numbers: days are UTC; counts are an undercount (Do Not Track, Global Privacy Control and blockers are not counted). A visitor id (`vid`) lasts one UTC day, so "people" is only meaningful per day. Multi-day figures are person-days (distinct day + vid pairs) and labelled so. `/dashboard/data?from=YYYY-MM-DD&to=YYYY-MM-DD&country=XX` returns aggregates only (never rows or vids), as a handful of GROUP BY queries run in one `DB.batch`, with `Cache-Control: private, max-age=60`.

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
