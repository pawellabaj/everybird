import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import linkIndex from "../data/link-index.json";

// The global IUCN Red List status (item 3): the stats line's threatened count, the Conservation status dropdown, the card's pill (with its name in plain text), the shared view, and the pill's Line ring in the dark theme. A synthetic list of eleven species picked
// from the published data by their status: one LC, NT, VU, EN, EW, EX and DD, two CR, and two without a status, all
// with their own sticker and in the link index (so a copied link carries every one). Threatened: VU + EN + 2 CR = 4.
// Written in Round 4 and not run yet: whoever runs e2e next, check it first.
type Row = { code: string; com: string; st?: boolean; iu?: string };
const ALL = (JSON.parse(readFileSync(resolve(__dirname, "../public/data/species.v1.json"), "utf8")) as { species: Row[] }).species;
const linked = new Set(linkIndex as string[]);
function pick(iu: string | undefined, n = 1): Row[] {
  const rows = ALL.filter((r) => r.st && linked.has(r.code) && r.iu === iu).slice(0, n);
  if (rows.length < n) throw new Error(`the species file has fewer than ${n} drawn, linked species with status ${iu ?? "none"}`);
  return rows;
}
const BY = {
  LC: pick("LC")[0], NT: pick("NT")[0], VU: pick("VU")[0], EN: pick("EN")[0],
  EW: pick("EW")[0], EX: pick("EX")[0], DD: pick("DD")[0],
};
const CR = pick("CR", 2);
const NONE = pick(undefined, 2);
const BIRDS = [...Object.values(BY), ...CR, ...NONE];
// A threatened bird with a long name, for the card's meta column: White-throated Mountain-Babbler (wtmbab1, VU) when it is
// drawn and linked, else the longest-named VU, EN or CR bird that is.
const LONG: Row =
  ALL.find((r) => r.code === "wtmbab1" && r.st && linked.has(r.code) && r.iu === "VU") ??
  ALL.filter((r) => r.st && linked.has(r.code) && ["VU", "EN", "CR"].includes(r.iu ?? "")).sort((a, b) => b.com.length - a.com.length)[0];
const TOTAL = BIRDS.length; // 11
const SR = " (Vulnerable, Endangered or Critically Endangered)";

function syntheticSaved(birds: Row[] = BIRDS) {
  const records = birds.map((r, i) => ({ code: r.code, source: "ebird", date: `2021-${String(1 + i).padStart(2, "0")}-10`, place: { country: "CA" } }));
  return {
    v: 1, records: { ebird: records, inat: [], manual: [] }, unmatched: [],
    edits: { removed: [], added: [], marks: {}, fixes: {} }, rules: { hideHeard: false, hideDead: false, researchOnly: false },
    savedAt: new Date().toISOString(),
  };
}
async function seed(page: Page, theme: "light" | "dark" = "light", birds: Row[] = BIRDS) {
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
    [syntheticSaved(birds), theme] as const,
  );
  await page.goto("/");
  await expect(shownBirds(page)).toHaveCount(birds.length);
}

const shownBirds = (page: Page) => page.getByTestId("collage-stage").locator("[data-code]:not([data-off])");
const stats = (page: Page) => page.getByTestId("collage-stats");

/** Opens a bird's card from the keyboard (a tap on the stage could land between silhouettes). */
async function openCard(page: Page, r: Row) {
  await page.waitForFunction(() => document.getAnimations().filter((a) => a.playState === "running").length === 0, null, { timeout: 10_000 });
  await page.getByTestId("collage-stage").locator(`.eb-bird[data-code="${r.code}"]`).focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog", { name: r.com });
  await expect(card).toBeVisible();
  return card;
}

/** Checks VU, EN and CR in the Conservation status panel by their rows' names (the whole row is the label). */
async function threatened(page: Page) {
  await page.getByTestId("filter-tab-status").click();
  const panel = page.getByTestId("filter-panel-status");
  await expect(panel).toBeVisible();
  for (const name of ["Vulnerable", "Endangered", "Critically Endangered"]) await panel.getByText(name, { exact: true }).click();
  return panel;
}

for (const width of [1280, 390]) {
  const phone = width < 600;
  test.describe(`conservation status at ${width}px`, () => {
    test.use({ viewport: { width, height: phone ? 844 : 900 }, hasTouch: phone });

    test("the threatened count; Conservation status lists eight categories, filters to the threatened birds, and Clear restores them", async ({ page }) => {
      await seed(page);
      await expect(stats(page)).toHaveText(new RegExp(`^${TOTAL} species · .* · 4 threatened${SR.replace(/[()]/g, "\\$&")} · since `));
      const panel = await threatened(page);
      await expect(panel.getByRole("checkbox")).toHaveCount(8);
      await expect(panel.getByTestId("status-CR")).toBeChecked();
      await expect(stats(page)).toContainText(`4 of ${TOTAL} species`);
      await expect(page.getByTestId("filter-tab-status")).toContainText("· 3");
      // The visible label is "Conservation status" on the wide bar and "Status" on a phone; the accessible name is whole.
      await expect(page.getByTestId("filter-tab-status")).toContainText(phone ? "Status · 3" : "Conservation status");
      await expect(page.getByTestId("filter-tab-status")).toHaveAttribute("aria-label", "Conservation status: Vulnerable, Endangered, Critically Endangered");
      await expect(shownBirds(page)).toHaveCount(4);
      await panel.getByTestId("status-clear").click();
      await expect(shownBirds(page)).toHaveCount(TOTAL);
      await expect(stats(page)).toHaveText(new RegExp(`^${TOTAL} species`));
    });

    test("no pills on the collage's stickers (they overlapped neighbours); the List view's rows keep theirs", async ({ page }) => {
      await seed(page);
      const stage = page.getByTestId("collage-stage");
      await expect(stage.locator(".eb-smark")).toHaveCount(0);
      for (const r of [BY.VU, BY.EN, CR[0]]) await expect(stage.locator(`.eb-bird[data-code="${r.code}"]`)).toHaveAccessibleName(r.com);
      await page.getByRole("button", { name: "List", exact: true }).click();
      const row = page.locator(`.eb-row-btn[data-code="${BY.VU.code}"]`);
      await expect(row.locator(".eb-smark")).toHaveText("VU");
      await expect(page.locator(`.eb-row-btn[data-code="${BY.LC.code}"] .eb-smark`)).toHaveCount(0);
    });

    test("the card shows the pill and the category's name without a press; a bird without a status has none", async ({ page }) => {
      await seed(page);
      const card = await openCard(page, BY.VU);
      const badge = card.getByTestId("iucn-badge");
      await expect(badge.locator(".eb-iucn")).toHaveText("VU");
      await expect(badge.locator(".eb-iucn-name")).toBeVisible();
      await expect(badge.locator(".eb-iucn-name")).toContainText("Vulnerable");
      await expect(badge.getByRole("button")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(card).toHaveCount(0);

      const plain = await openCard(page, NONE[0]);
      await expect(plain.getByTestId("iucn-badge")).toHaveCount(0);
    });

    test("a long-named threatened bird: the card's badge never overlaps the name column", async ({ page }) => {
      await seed(page, "light", [LONG]);
      const card = await openCard(page, LONG);
      const names = await card.locator(".eb-card-names").boundingBox();
      const badge = await card.getByTestId("iucn-badge").boundingBox();
      const mass = await card.locator(".eb-card-mass").boundingBox();
      expect(names && badge && mass).toBeTruthy();
      const apart = (a: NonNullable<typeof names>, b: NonNullable<typeof names>) => a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5;
      expect(apart(names!, badge!), `badge ${JSON.stringify(badge)} against names ${JSON.stringify(names)}`).toBe(true);
      expect(apart(names!, mass!), `mass ${JSON.stringify(mass)} against names ${JSON.stringify(names)}`).toBe(true);
      // The column keeps its narrowest unit: the badge is never narrower than the pill and its longest word.
      expect(badge!.width).toBeGreaterThanOrEqual(26);
    });

    test("the shared view: Conservation status filters the copied link's birds and the card has the pill", async ({ page, baseURL }) => {
      test.setTimeout(90_000);
      // A stand-in clipboard in every engine records what Copy link writes (flows.spec.ts covers the real one).
      await page.addInitScript(() => {
        const w = window as unknown as { __clip: string[] };
        w.__clip = [];
        const clip = {
          write: async (items: ClipboardItem[]) => { for (const it of items) w.__clip.push(await (await it.getType("text/plain")).text()); },
          writeText: async (t: string) => { w.__clip.push(t); },
        };
        Object.defineProperty(navigator, "clipboard", { value: clip, configurable: true });
      });
      await seed(page);
      await page.getByRole("button", { name: "Share", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Share your collage" });
      await dialog.getByRole("button", { name: "Copy link" }).click();
      await expect(dialog.getByTestId("share-note")).toHaveText(/^Link copied/);
      const url = await page.evaluate(() => (window as unknown as { __clip: string[] }).__clip.at(-1)!);
      expect(url).toMatch(/\/s\/1/);
      await page.goto(new URL(new URL(url).pathname, baseURL).toString());
      await expect(shownBirds(page)).toHaveCount(TOTAL);
      await expect(stats(page)).toContainText("4 threatened");
      const panel = await threatened(page);
      await expect(stats(page)).toContainText(`4 of ${TOTAL} species`);
      await expect(shownBirds(page)).toHaveCount(4);
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      const card = await openCard(page, CR[0]);
      await expect(card.getByTestId("iucn-badge").locator(".eb-iucn")).toHaveText("CR");
    });

    test("in the dark theme the EX pill keeps its Line ring", async ({ page }) => {
      await seed(page, "dark");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      const card = await openCard(page, BY.EX);
      const pill = card.getByTestId("iucn-badge").locator(".eb-iucn");
      await expect(pill).toHaveText("EX");
      // tokens.css's dark --line, #76767f; the fill stays the Red List's black in both themes.
      expect(await pill.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(118, 118, 127)");
      expect(await pill.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(0, 0, 0)");
    });
  });
}
