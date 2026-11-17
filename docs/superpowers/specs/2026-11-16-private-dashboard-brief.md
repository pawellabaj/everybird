# Private analytics dashboard: design brief

Status: approved by Yusuf on 2026-11-16; implementation prepared locally on `feat/visit-timestamps`. Code validation and release status are recorded in the Worker README and the implementation handoff below. No push, migration or deployment is authorized by design approval.

## Job and outcome

Yusuf needs to understand Everybird's growth, visitors' countries, and what people do, then investigate a question without losing his place. Provide both a guided dashboard and a Tableau-like Explore builder. This is an Operate surface, using the existing Paper/Ink identity, restrained accent, theme toggle and familiar controls.

Success means Yusuf can answer these questions from clearly labelled aggregates:

- How has daily activity changed over a selected period?
- Which countries and devices account for that activity?
- How often are personal-list collages, downloads, shares, searches and filters used?
- When are recorded visits received, within the timestamped data?
- Can a selected breakdown be inspected and exported with the same totals?

## Current implementation findings

Reviewed `workers/stats/src/{page,dashboard,pure,event,index}.ts` and the Worker README. These findings are from source, not a rendered UI review.

- The headline People tile uses the final day, while neighbouring tiles use the selected period. The dates and units need to be explicit and consistent.
- Filtered period numbers, global lifetime numbers, rates and many breakdown cards share one long page. Their different scopes increase the effort needed to interpret them.
- The so-called funnel is independent action reach, not an ordered visitor journey. It cannot establish conversion or abandonment between steps.
- Collage totals include demo and restore events; the separate lifetime personal-list count excludes them. These categories need to be visible in ordinary analysis too.
- The current country breakdown intentionally ignores the selected country, while most other results respect it. Exploration needs one explicit filter contract.
- Browser language is recorded only on visits. Interface-language events record a language switch, not every visitor's chosen language.
- Receipt timestamps and hourly aggregates are prepared locally in this branch. Historical rows have no time and must remain visibly unassigned to an hour.

## Structure and navigation

Keep one private workspace with three clearly named destinations: **Overview**, **Explore**, and **Definitions**. Desktop navigation stays visible; on a phone use a compact labelled view switch. Preserve selected dates and filters when moving between Overview and Explore, and support browser Back/Forward.

Overview presents, in this order:

1. A shared filter bar with date presets, custom dates, country, device and a previous-period comparison. Show exact dates, timezone and removable filter chips, with Reset in one place.
2. A compact summary of average daily active visitors, personal-list collages, downloads and share actions. Every number states its unit and period. Demo and restore counts are available separately.
3. One daily trend with a measure selector and an optional previous-period series. The current incomplete day is marked; default comparisons use completed days. Today remains available with no misleading full-day percentage comparison.
4. Countries and devices as ranked bars with exact values and a table alternative. Selecting an item explicitly filters the workspace and adds a removable chip. Keep unknown values visible.
5. An activity breakdown for collage sources, image/poster formats, sharing, search and filters. Rename action reach accurately; do not draw an ordered conversion funnel.
6. Recorded visits by hour, including timestamp coverage and a separate count without a time. Keep lifetime totals in a clearly labelled disclosure stating that they ignore period filters.

The dominant task is reading a trend and narrowing it, rather than scrolling through every possible statistic. Each section offers **Explore this** with its compatible measure, breakdown and filters already selected.

## Explore builder

Use labelled controls for **Measure**, **Break down by**, **Display** and **Filters**, beside a result area on desktop and above it on phones. Start with a useful populated query. Choosing fields must not require dragging.

- Measures include active visitor-days, recorded visits, personal-list collages, downloads, share actions and other recorded event counts. Explain the unit beside the measure, not only in a help page.
- Breakdowns include stored day, receipt hour, country, device and event-specific categories. Browser language is available for visits only; import source for collage events only; image format for image events only. Define supported pairs in a shared capability registry and reject unsupported pairs on the server too.
- Offer line charts for time, ranked bars for categories, and a sortable table for exact values. Unavailable displays explain why. Avoid a chart-type catalogue with unsupported combinations.
- Selecting a date/category can narrow the query through an explicit filter action. Never make a hover silently change other results. Reset and removal are reversible; a saved view restores the complete query.
- Keep a readable query summary above the result, for example: “Personal-list collages by country, 1–14 November, all devices.”
- Chart, table and CSV derive from the same aggregate result and include the unit, scope and coverage notes. Top-N charts include Other; the table/export retains the complete bounded aggregate. Do not export visitor ids or individual event timestamps.
- Save named views locally and encode query state in the URL. These are private convenience features, not public sharing or a new account system.

## Counting and smart behaviour

Daily ids rotate. A multi-day sum is **active visitor-days**, never unique people across the period; a daily figure counts distinct anonymous ids with a recorded event. Explain that this is an approximation, not identified individuals. Event counts, active visitor-days and page-level deduplicated visits must remain separate units.

Recorded visits are the first recorded visit per anonymous visitor, page and stats day, not every page load. Hours represent server receipt time. Countries are coarse request locations, not referral sources. Do not add referral tracking or cross-day identity to fulfil this brief.

Show rates only where a defined numerator is a subset of the stated denominator under the same filters. Display numerator and denominator on inspection. Do not add independently deduplicated categories to produce a distinct total; overlapping breakdowns need a note. A zero baseline gives “no previous activity”, not an infinite percentage. Missing identity/time/language is missing coverage, not zero activity.

Smart behaviour means compatible field suggestions, sensible defaults, preserved context and deterministic descriptive observations. An observation must name its range, unit and comparison, show its underlying values, and disappear when coverage or the comparison is unsuitable. Do not infer causes, retention, sessions or ordered journeys from these data.

Preserve the documented UTC/Pacific cutover, including the extended 16 November 2026 stats day and possible duplicate daily identities at the transition. Surface a coverage warning when a selection intersects it; do not silently relabel historical days or invent hourly history.

## States, accessibility and implementation boundaries

Handle loading, valid zero results, missing coverage, invalid queries, expired access, request failure and stale refresh results separately. During refresh retain the last successful result with its timestamp and mark it stale on failure. Ignore responses superseded by a newer query. Pause background refresh in a hidden tab; announce meaningful updates without moving focus.

Maintain keyboard access, visible focus, labelled native controls, 44px targets, reduced motion and both themes. Provide chart data in a semantic table. At 320px, controls stack and the page does not scroll sideways; a wide data table may have its own labelled scroll container. Keep labels and exact values available without hover.

Retain Cloudflare Access, fail-closed authorization, aggregate-only responses and the lightweight Worker implementation. Use bounded, allowlisted, parameter-bound queries. The builder does not accept SQL, arbitrary expressions or unbounded groupings. No new UI framework or remote font/chart dependency is needed. This work concerns the private analytics surface; public Everybird flows and promotional materials are outside scope.

## Build sequence and acceptance

After confirmation, first implement the metric/capability contract and aggregate query layer, then Overview and navigation, then Explore, exports and saved views. Include the prepared timestamp work and its migration runbook. Update the Worker README to describe the finished behaviour.

Code acceptance checks use synthetic SQLite fixtures for correct units and denominators; every supported filter and field pair; unknown and missing fields; empty/partial ranges; midnight, cutover and untimed history; comparison arithmetic; top-N plus Other; and chart/table/CSV agreement. Check query validation, bound parameters, Access protection, URL state, export escaping and stale-response handling with unit tests. Run scoped lint/typechecks/tests while building and one full unit suite when finished.

Per Yusuf's instructions, agents do not run browser tests, screenshots, visual checks or model design reviews. Yusuf checks navigation, readability and responsive visuals. Correctness is defined through these explicit contracts and checks, not a promise of zero defects. Pushing, migration and deployment remain separate approval steps once the implementation is concrete and tested.

## Implementation handoff (2026-11-16)

Implemented locally on `feat/visit-timestamps`: Overview, Explore and Definitions; shared filters/custom dates; compatible measure/breakdown controls; explicit drill-downs; sorted/paginated tables and full CSV; local saved views and URL navigation; coverage-aware hourly visits; separate demo/restore counts; exact Other reach; and stale-response/refresh handling. Previous-period comparison is an Overview control; Explore reports the selected aggregate. Dates before collection are excluded from averages, the first collection day is marked partial, and wholly uncollected periods have an unavailable state.

Validation: 81 scoped stats tests and all 2,144 tests across 149 files passed; route type generation, root and Worker typechecks, and changed-file lint passed (one inherited anonymous-default-export warning in the Worker entry). Final Worker deployment dry run passed: 81.64 KiB, gzip 26.04 KiB. No browser, screenshot or visual testing performed. Yusuf's UI review remains pending. No push, migration or deployment performed. Follow the nullable timestamp-column-first release procedure and rollback notes in `workers/stats/README.md` after release approval.
