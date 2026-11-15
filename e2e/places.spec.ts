import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// The Places and Time dropdowns in the controls bar, on a synthetic list: Canada most months, lifers in Egypt and Costa
// Rica (full dates, 3+ lifers within days in another country).
type Row = { code: string };
function syntheticSaved() {
  const species = (JSON.parse(readFileSync(resolve(__dirname, "../public/data/species.v1.json"), "utf8")) as { species: Row[] }).species;
  const records: object[] = [];
  let k = 0;
  const add = (country: string, date: string) => records.push({ code: species[k++ * 5].code, source: "ebird", date, place: { country } });
  for (let y = 2019; y <= 2025; y++) for (let m = 1; m <= 12; m += 2) add("CA", `${y}-${String(m).padStart(2, "0")}-10`);
  for (let i = 0; i < 6; i++) add("EG", `2021-09-0${1 + i}`);
  for (let i = 0; i < 5; i++) add("CR", `2023-02-1${i}`);
  return {
    v: 1, records: { ebird: records, inat: [], manual: [] }, unmatched: [],
    edits: { removed: [], added: [], marks: {}, fixes: {} }, rules: { hideHeard: false, hideDead: false, researchOnly: false },
    savedAt: new Date().toISOString(),
  };
}
async function seed(page: Page, data: object = syntheticSaved(), theme: "light" | "dark" = "light") {
  await page.goto("/about");
  await page.evaluate(
    ([saved, theme]) =>
      new Promise<void>((done, fail) => {
        localStorage.setItem("everybird:theme", theme);
        const open = indexedDB.open("everybird");
        open.onupgradeneeded = () => open.result.createObjectStore("kv");
        open.onsuccess = () => {
          const tx = open.result.transaction("kv", "readwrite");
          tx.objectStore("kv").put(saved, "everybird:v1");
          tx.oncomplete = () => done();
          tx.onerror = () => fail(tx.error);
        };
        open.onerror = () => fail(open.error);
      }),
    [data, theme] as const,
  );
  await page.goto("/");
  await expect(page.getByTestId("collage-stage").locator("[data-code]:not([data-off])").first()).toBeVisible();
}

for (const width of [1280, 390]) {
  test.describe(`Places and Time dropdowns at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: width < 600 });

    test("several countries, the bar's summary, Esc back to the button; the bar never scrolls sideways", async ({ page }) => {
      await seed(page);
      const places = page.getByTestId("filter-tab-places");
      await places.click();
      const panel = page.getByTestId("filter-panel-places");
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("checkbox")).toHaveCount(3);
      // By the row's name (the whole row is the label; dev builds park Next's badge over the phone sheet's corner).
      await panel.getByText("Egypt", { exact: true }).click();
      await panel.getByText("Costa Rica", { exact: true }).click();
      await expect(panel.getByTestId("country-CR")).toBeChecked();
      await expect(page.getByTestId("collage-stats")).toContainText("11 of 53 species");
      await expect(places).toContainText("Places · 2");
      await expect(places).toHaveAttribute("aria-label", "Places: Costa Rica, Egypt");
      await expect(panel.locator("img.eb-flag")).toHaveCount(3); // flag-icons, same origin
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(places).toBeFocused();
      // The centre count is the shown count only, as /lifelist.
      await expect(page.locator(".eb-mid")).toHaveText(/^11species$/i);

      await page.getByTestId("filter-tab-time").click();
      await expect(page.getByTestId("timeline")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Play/ })).toHaveCount(0);
      const m = await page.evaluate(() => {
        const d = document.querySelector(".eb-dock")!;
        return { dock: d.scrollWidth - d.clientWidth, page: document.documentElement.scrollWidth - innerWidth };
      });
      expect(m.dock).toBeLessThanOrEqual(0);
      expect(m.page).toBeLessThanOrEqual(0);
    });
  });
}

// More than SEARCH_FROM countries: the panel's "Find a country" is the app's one field (globals.css .eb-input), not
// the browser's search pill: Surface, a Line border, 44px tall, the site's 16px lens at 12px, Muted placeholder, the
// Accent focus ring; in both themes. (The collage page loads no Settings CSS, so this needs the shared style.)
function manyCountriesSaved() {
  const species = (JSON.parse(readFileSync(resolve(__dirname, "../public/data/species.v1.json"), "utf8")) as { species: Row[] }).species;
  const isos = ["CA", "EG", "CR", "MX", "US", "FR", "DE", "BE", "NL", "DK", "CH", "AU", "NZ", "JP", "BR", "PE"];
  const records = isos.flatMap((country, i) => [0, 1].map((j) => ({ code: species[(i * 2 + j) * 5].code, source: "ebird", date: `2022-0${1 + (i % 9)}-1${j}`, place: { country } })));
  return {
    v: 1, records: { ebird: records, inat: [], manual: [] }, unmatched: [],
    edits: { removed: [], added: [], marks: {}, fixes: {} }, rules: { hideHeard: false, hideDead: false, researchOnly: false },
    savedAt: new Date().toISOString(),
  };
}
for (const theme of ["light", "dark"] as const) {
  test(`Find a country is the app's field style (${theme})`, async ({ page }) => {
    await seed(page, manyCountriesSaved(), theme);
    await page.getByTestId("filter-tab-places").click();
    const find = page.getByTestId("places-find");
    await expect(find).toBeVisible();
    await find.focus();
    const m = await find.evaluate((el) => {
      const cs = getComputedStyle(el);
      const probe = (v: string) => {
        const d = document.createElement("div");
        d.style.color = `var(${v})`;
        document.body.append(d);
        const c = getComputedStyle(d).color;
        d.remove();
        return c;
      };
      const icon = el.parentElement!.querySelector("svg.eb-input-icon")!.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return {
        h: box.height, bg: cs.backgroundColor, border: cs.borderTopColor, borderW: cs.borderTopWidth,
        appearance: cs.appearance || cs.getPropertyValue("-webkit-appearance"),
        pad: cs.paddingLeft, font: cs.fontSize, outline: cs.outlineStyle, outlineColor: cs.outlineColor,
        icon: { w: icon.width, left: icon.left - box.left },
        surface: probe("--surface"), line: probe("--line"), accent: probe("--accent"),
        theme: document.documentElement.dataset.theme,
      };
    });
    expect(m.theme).toBe(theme);
    expect(m.h).toBe(44);
    expect(m.bg).toBe(m.surface);
    expect(m.border).toBe(m.line);
    expect(m.borderW).toBe("1px");
    expect(m.appearance).toBe("none");
    expect(m.pad).toBe("40px");
    expect(m.font).toBe("16px");
    expect(m.icon.w).toBe(16);
    expect(m.icon.left).toBe(12);
    expect(m.outline).toBe("solid");
    expect(m.outlineColor).toBe(m.accent);
    await find.fill("new z");
    await expect(page.getByTestId("filter-panel-places").getByRole("checkbox")).toHaveCount(1);
  });
}

// Down to a county, in each design of the panel (`?v=places:<letter>`: a drills in place, b expands rows inline). Seen-
// here places: Canada (British Columbia's Capital and Greater Vancouver, Ontario) and Egypt.
function provincesSaved() {
  const species = (JSON.parse(readFileSync(resolve(__dirname, "../public/data/species.v1.json"), "utf8")) as { species: Row[] }).species;
  const where = ["CA-BC|Capital", "CA-BC|Capital", "CA-BC|Greater Vancouver", "CA-ON", "CA-ON", "EG"];
  const records = where.map((w, i) => {
    const [sub, county] = w.split("|");
    const country = sub.slice(0, 2);
    return {
      code: species[i * 5].code, source: "ebird", date: `2022-0${1 + i}-10`,
      place: { country, ...(sub.includes("-") ? { sub1: sub } : {}) }, seen: [`2022-0${1 + i}-10|${sub}${county ? `|${county}` : ""}`],
    };
  });
  return {
    v: 1, records: { ebird: records, inat: [], manual: [] }, unmatched: [],
    edits: { removed: [], added: [], marks: {}, fixes: {} }, rules: { hideHeard: false, hideDead: false, researchOnly: false },
    savedAt: new Date().toISOString(),
  };
}
for (const v of ["a", "b"] as const) {
  test(`?v=places:${v}: a province, then a county`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seed(page, provincesSaved());
    await page.goto(`/?v=places:${v}`);
    await expect(page.getByTestId("collage-stage").locator("[data-code]:not([data-off])").first()).toBeVisible();
    const places = page.getByTestId("filter-tab-places");
    await places.click();
    const panel = page.getByTestId("filter-panel-places");
    const canada = panel.getByTestId("drill-c:CA");
    await canada.click();
    if (v === "b") {
      await expect(canada).toHaveAttribute("aria-expanded", "true");
      await expect(panel.getByTestId("country-EG")).toBeVisible(); // one checklist: the countries stay
    } else {
      await expect(panel.getByTestId("places-path")).toContainText("Canada");
    }
    await panel.getByTestId("place-s:CA-BC").check();
    await expect(places).toHaveAttribute("aria-label", "Places: British Columbia, Canada");
    await expect(page.getByTestId("collage-stats")).toContainText("3 of 6 species");
    await panel.getByTestId("drill-s:CA-BC").click();
    await panel.getByTestId("place-k:CA-BC|Capital").check();
    await expect(places).toHaveAttribute("aria-label", "Places: Capital, British Columbia");
    await expect(page.getByTestId("collage-stats")).toContainText("2 of 6 species");
    const m = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(".eb-drop-body")!;
      return { body: b.scrollWidth - b.clientWidth, page: document.documentElement.scrollWidth - innerWidth };
    });
    expect(m.body).toBeLessThanOrEqual(0);
    expect(m.page).toBeLessThanOrEqual(0);
  });
}

// The lifer-only note's link is a client navigation to /settings#add-mydata: MyEBirdData's Add panel opens there with
// its picker focused and in view; with MyEBirdData already on the list (saved before seen-here), its Replace is focused.
test("the lifer-only note opens MyEBirdData's Add panel on Settings, or focuses its Replace", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const life = syntheticSaved() as ReturnType<typeof syntheticSaved> & { records: Record<string, object[]> };
  const lifeList = { ...life, v: 2, records: { ebird: [], "ebird-list": life.records.ebird.map((r) => ({ ...r, source: "ebird" })), inat: [], manual: [] } };
  await seed(page, lifeList);
  await page.getByTestId("filter-tab-places").click();
  await page.getByTestId("places-lifer-only").getByRole("link", { name: "Add MyEBirdData" }).click();
  await expect(page).toHaveURL(/\/settings#add-mydata$/);
  await expect(page.getByTestId("places-lifer-note")).toBeVisible();
  await expect(page.getByRole("group", { name: "Add MyEBirdData" })).toBeVisible();
  const choose = page.getByRole("group", { name: "Add MyEBirdData" }).getByRole("button", { name: "Choose your eBird file" });
  await expect(choose).toBeFocused();
  await expect(choose).toBeInViewport();

  await seed(page);
  await page.getByTestId("filter-tab-places").click();
  await page.getByTestId("places-lifer-only").getByRole("link", { name: "Import MyEBirdData again" }).click();
  await expect(page).toHaveURL(/\/settings#add-mydata$/);
  await expect(page.getByTestId("source-ebird").getByRole("button", { name: /^Replace/ })).toBeFocused();
});
