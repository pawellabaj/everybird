import { expect, test, type Page } from "@playwright/test";
import { SAMPLE_ORDERS } from "./sample";
import { checkTopbar, useLang } from "./topbar";
import { LANGS } from "../src/i18n/langs";

// Phones, as /lifelist's phone view: the controls bar in two rows (the view icons, True and Sci. or the list's
// "Heaviest", and the magnifier; then Places, Time and Status: the landing sample has Red List statuses), and the taxonomy as one "Choose an order" button, the landing
// included. Chromium and WebKit; 440 is the widest iPhone. From 600px the taxonomy is /lifelist's chips: the mono rank
// label, then chips that wrap onto more rows, never a sideways strip.

/** The bar's buttons by row (their tops, rounded), whether the magnifier is in the first row, and sideways overflow. */
async function bar(page: Page) {
  return page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>(".eb-dock")!;
    const buttons = Array.from(dock.querySelectorAll<HTMLElement>("button")).filter((b) => !b.closest(".eb-find") && b.getBoundingClientRect().width > 0);
    const rows = new Map<number, string[]>();
    for (const b of buttons) {
      const top = Math.round(b.getBoundingClientRect().top);
      const row = [...rows.keys()].find((t) => Math.abs(t - top) < 6) ?? top;
      rows.set(row, [...(rows.get(row) ?? []), b.getAttribute("aria-label") || b.innerText.trim()]);
    }
    const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, names]) => names);
    return {
      rows: ordered,
      dock: dock.scrollWidth - dock.clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

/** The four insets of the phone bar, in CSS px (the dock's border box; the Hairline is the second row's top border). */
async function dockGaps(page: Page) {
  return page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>(".eb-dock")!.getBoundingClientRect();
    const tab = document.querySelector<HTMLElement>('.eb-dock-tab[aria-pressed="true"]')!.getBoundingClientRect();
    const row = document.querySelector<HTMLElement>(".eb-dock-filters")!.getBoundingClientRect();
    const btn = document.querySelector<HTMLElement>(".eb-dock-filters .eb-dock-drop")!.getBoundingClientRect();
    const b = 1; // the dock's 1px border, and the row's 1px Hairline
    const r = (n: number) => Math.round(n * 10) / 10;
    return {
      tabTop: r(tab.top - dock.top - b),
      tabLine: r(row.top - tab.bottom),
      lineButtons: r(btn.top - row.top - b),
      buttonsBottom: r(dock.bottom - b - btn.bottom),
    };
  });
}

for (const width of [320, 390, 430, 440, 600] as const) {
  test.describe(`${width}px phone`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: true });

    test("the landing: two rows of controls with the search in the first, no chip strip, the order picker works", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".eb-dock")).toBeVisible();
      await expect(page.getByTestId("picker-order")).toBeVisible();

      const m = await bar(page);
      expect(m.rows, JSON.stringify(m.rows)).toHaveLength(2);
      expect(m.rows[0]).toEqual(["Collage", "List", expect.stringMatching(/^True/), expect.stringMatching(/^Sci\./), "Find a bird"]);
      expect(m.rows[1]).toEqual([expect.stringMatching(/^Places/), expect.stringMatching(/^Time/), expect.stringMatching(/^(Conservation )?[Ss]tatus/)]); // aria-label first: the whole name
      expect(m.dock).toBeLessThanOrEqual(0);
      expect(m.page).toBeLessThanOrEqual(0);

      // No sideways chip strip: the order level is one button, "Choose an order" and its count.
      await expect(page.getByTestId("filter-strip")).toHaveCount(0);
      await expect(page.getByTestId("level-order")).toHaveCount(0);
      const pick = page.getByTestId("picker-order");
      await expect(pick).toHaveText(/^Choose an order\s*\d+$/);
      const fill = await pick.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const view = el.closest(".eb-view")!.getBoundingClientRect();
        return { h: Math.round(box.height), fullWidth: Math.round(box.width) === Math.round(view.width) };
      });
      expect(fill).toEqual({ h: 44, fullWidth: true });

      // Picking an order: the sheet closes, the breadcrumb names it, and the families' button follows.
      await pick.tap();
      const sheet = page.getByRole("dialog", { name: "Orders" });
      await sheet.getByRole("button", { name: /^Perching birds/ }).tap();
      await expect(sheet).toHaveCount(0);
      const crumbs = page.getByRole("navigation", { name: "Filter by group" });
      await expect(crumbs.locator(".eb-path")).toHaveText(/All birds\s*\/\s*Perching birds/);
      await expect(page.getByTestId("picker-family")).toHaveText(/^Choose a family\s*\d+$/);
      expect((await bar(page)).page).toBeLessThanOrEqual(0);

      // The search opens over row one and closes back to the magnifier.
      await page.getByRole("button", { name: "Find a bird" }).tap();
      const field = page.getByRole("combobox", { name: "Find a bird" });
      await expect(field).toBeFocused();
      await field.press("Escape");
      await expect(page.getByRole("button", { name: "Find a bird" })).toBeFocused();
    });

    test("the bar's 4px inset all round: pressed tab to the top, tab to the Hairline, Hairline to Places and Time, to the bottom", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".eb-dock-filters")).toBeVisible();
      expect(await dockGaps(page)).toEqual({ tabTop: 4, tabLine: 4, lineButtons: 4, buttonsBottom: 4 });
    });

    test("list view: the sort button keeps the search in row one, with its full name", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".eb-dock")).toBeVisible();
      await page.getByRole("button", { name: "List", exact: true }).tap();
      const dir = page.getByRole("button", { name: "Sorted by body mass, heaviest first. Reverse order" });
      await expect(dir).toHaveText(/^Heaviest$/, { useInnerText: true });
      const m = await bar(page);
      expect(m.rows, JSON.stringify(m.rows)).toHaveLength(2);
      expect(m.rows[0].at(-1)).toBe("Find a bird");
      expect(m.page).toBeLessThanOrEqual(0);
      await dir.tap();
      await expect(page.getByRole("button", { name: "Sorted by body mass, lightest first. Reverse order" })).toHaveText(/^Lightest$/, { useInnerText: true });
      expect((await bar(page)).rows).toHaveLength(2);
    });
  });
}

/** Every drop's label in the bar: its text, and whether it is cut (an ellipsis: scrollWidth over clientWidth). */
async function dropLabels(page: Page) {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(".eb-dock-filters")!;
    return {
      labels: Array.from(row.querySelectorAll<HTMLElement>(".eb-drop-label")).map((l) => ({
        text: l.innerText.trim(), cut: l.scrollWidth > l.clientWidth,
      })),
      row: row.scrollWidth - row.clientWidth,
      dock: document.querySelector<HTMLElement>(".eb-dock")!.scrollWidth - document.querySelector<HTMLElement>(".eb-dock")!.clientWidth,
    };
  });
}

// The three-drop phone row sizes by content (app.css, the three-drop `@container (max-width: 599px)` block; pinned in
// tests/dock-css.test.ts): with Status, two places and a Time range all set, every active label reads in full at 390.
// The landing sample has Red List statuses (LC and NT), so Status shows. Written in Round 4 and not run by agents.
test.describe("390px phone, three drops active", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("active labels read in full: Places · 2, Time · a range, Status · 1 (the phone's short label), nothing cut and the row doesn't overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("filter-tab-status")).toBeVisible();
    const pressRow = (panel: ReturnType<Page["getByTestId"]>, input: ReturnType<Page["locator"]>) =>
      panel.locator("label.eb-check", { has: input }).locator(".eb-check-name");

    // Status first (the other panels count under it): the first category the sample has.
    await page.getByTestId("filter-tab-status").tap();
    const status = page.getByTestId("filter-panel-status");
    await pressRow(status, status.locator('input[data-testid^="status-"]').first()).tap();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("filter-tab-status")).toContainText("Status · 1");

    // Time: a range of years from the keyboard, the start a year on and the end a year back (the start alone reads
    // "from 2019"). Keys commit KEY_COMMIT_MS after the last one, and closing the panel cancels a pending commit, so
    // wait for the button to say the range before Escape (as flows.spec.ts).
    await page.getByTestId("filter-tab-time").tap();
    await page.getByRole("slider", { name: "Start month" }).focus();
    await page.keyboard.press("PageUp");
    await page.getByRole("slider", { name: "End month" }).focus();
    await page.keyboard.press("PageDown");
    await expect(page.getByTestId("filter-tab-time")).toContainText(/Time · \d{4}–\d{4}/);
    await page.keyboard.press("Escape");

    // Places: two countries.
    await page.getByTestId("filter-tab-places").tap();
    const places = page.getByTestId("filter-panel-places");
    const countries = places.locator('input[data-testid^="country-"]');
    await pressRow(places, countries.nth(0)).tap();
    await pressRow(places, countries.nth(1)).tap();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("filter-tab-places")).toContainText("Places · 2");

    const m = await dropLabels(page);
    expect(m.labels.map((l) => l.text)).toEqual([
      expect.stringMatching(/^Places · 2$/), expect.stringMatching(/^Time · \d{4}–\d{4}$/), expect.stringMatching(/^Status · 1$/),
    ]);
    for (const l of m.labels) expect(l.cut, `"${l.text}" is cut`).toBe(false);
    expect(m.row).toBeLessThanOrEqual(0);
    expect(m.dock).toBeLessThanOrEqual(0);
    // Still two rows, the three drops in the second, each a 44px press.
    const b = await bar(page);
    expect(b.rows, JSON.stringify(b.rows)).toHaveLength(2);
    expect(b.page).toBeLessThanOrEqual(0);
    const widths = await page.locator(".eb-dock-filters .eb-dock-drop").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(44);
  });
});

/** The order chips' rows, whether each chip is wholly inside the viewport, and anything that scrolls sideways. */
async function chips(page: Page) {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="level-order"] .eb-chip'));
    const tops = new Set(els.map((c) => Math.round(c.getBoundingClientRect().top)));
    const out = els.filter((c) => { const b = c.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth; }).map((c) => c.textContent);
    const sideways = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((e) => e.scrollWidth > e.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowX) && !e.closest(".eb-bird"))
      .map((e) => e.className || e.tagName);
    return { n: els.length, rows: tops.size, out, sideways, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}

for (const width of [768, 1280, 1440] as const) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("the landing's order chips wrap as /lifelist's: a rank label, rows of whole chips, nothing scrolls sideways", async ({ page }) => {
      await page.goto("/");
      const level = page.getByTestId("level-order");
      await expect(level).toBeVisible();
      await expect(level.locator(".eb-level-label")).toHaveText("Orders");
      await expect(page.getByTestId("filter-strip")).toHaveCount(0);
      await expect(page.getByTestId("picker-order")).toHaveCount(0);
      // The long labels stay above 600px.
      await expect(page.getByRole("switch", { name: /^True size/ })).toBeVisible();
      await expect(page.getByRole("switch", { name: /^Scientific/ })).toBeVisible();

      const m = await chips(page);
      expect(m.n).toBe(SAMPLE_ORDERS);
      // The sample's orders (30) are wider than any of these screens: more than one row.
      expect(m.rows).toBeGreaterThan(1);
      expect(m.out).toEqual([]);
      expect(m.sideways).toEqual([]);
      expect(m.page).toBeLessThanOrEqual(0);

      // An order chosen: the breadcrumb, then its families' chips, wrapped the same way.
      await level.getByRole("button", { name: /^Perching birds/ }).click();
      await expect(page.getByRole("navigation", { name: "Filter by group" }).locator(".eb-path")).toHaveText(/All birds\s*\/\s*Perching birds/);
      const fam = page.getByTestId("level-family");
      await expect(fam.locator(".eb-level-label")).toHaveText("Families");
      const f = await fam.evaluate((el) => {
        const cs = Array.from(el.querySelectorAll<HTMLElement>(".eb-chip"));
        return { rows: new Set(cs.map((c) => Math.round(c.getBoundingClientRect().top))).size, out: cs.filter((c) => c.getBoundingClientRect().right > innerWidth).length };
      });
      expect(f.out).toBe(0);
      expect(f.rows).toBeGreaterThan(1);
      expect((await chips(page)).sideways).toEqual([]);
    });
  });
}

// The top bar on phones and the first tablet widths, per preview variant (lang:a|b|c) and language (e2e/topbar.ts):
// a puts the nav on row two under 430px, b under 384px in Spanish and Dutch and 366px in English and Portuguese, c
// keeps one row down to 310px by hiding Collage under 480px. 195–300 CSS px: text-size.spec.ts.
for (const width of [320, 360, 375, 390, 414, 430, 440, 480, 500, 600] as const) {
  test.describe(`${width}px: the top bar`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: true });
    for (const variant of ["a", "b", "c"] as const) {
      for (const lang of ["en", "es", "pt", "nl"] as const) {
        test(`lang:${variant} in ${lang}: row one inside the gutter, the nav in its row, --topbar-h the bar's height`, async ({ page, context, baseURL }) => {
          await useLang(context, baseURL!, lang);
          for (const path of ["/", "/settings", "/about"]) await checkTopbar(page, path, variant, lang, width);
        });
      }
    }
  });
}

// The controls bar and every page at the phone and desktop widths in Spanish, Portuguese and Dutch (longer labels):
// nothing scrolls sideways, and row one of the bar (tabs, tools, search) stays on one line. For manual runs.
for (const lang of LANGS.filter((l) => l !== "en")) {
  for (const width of [320, 390, 440, 768, 1280, 1440] as const) {
    test.describe(`${width}px in ${lang}`, () => {
      test.use({ viewport: { width, height: 900 }, hasTouch: width < 600 });
      test("no page scrolls sideways and the controls bar's row one holds", async ({ page, context, baseURL }) => {
        await context.addCookies([{ name: "everybird-lang", value: lang, url: baseURL! }]);
        for (const path of ["/", "/settings", "/about"]) {
          await page.goto(path);
          await expect(page.getByTestId("topbar")).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path}: sideways scroll`).toBeLessThanOrEqual(width);
        }
        await page.goto("/");
        const tops = await page.locator(".eb-dock").evaluate((d) => [".eb-dock-tabs", ".eb-dock-tools", ".eb-dock-end"].map((s) => Math.round(d.querySelector(s)!.getBoundingClientRect().top)));
        expect(new Set(tops).size, `row one tops ${tops}`).toBe(1);
      });
    });
  }
}
