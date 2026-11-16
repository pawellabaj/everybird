import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import linkIndex from "../data/link-index.json";

// The global IUCN Red List status (item 3): the stats line's threatened count, the Status dropdown, the card's pill (with its name in plain text), the shared view, and the pill's Line ring in the dark theme. A synthetic list of eleven species picked
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
const TOTAL = BIRDS.length; // 11
const SR = " (Vulnerable, Endangered or Critically Endangered)";

function syntheticSaved() {
  const records = BIRDS.map((r, i) => ({ code: r.code, source: "ebird", date: `2021-${String(1 + i).padStart(2, "0")}-10`, place: { country: "CA" } }));
  return {
    v: 1, records: { ebird: records, inat: [], manual: [] }, unmatched: [],
    edits: { removed: [], added: [], marks: {}, fixes: {} }, rules: { hideHeard: false, hideDead: false, researchOnly: false },
    savedAt: new Date().toISOString(),
  };
}
async function seed(page: Page, theme: "light" | "dark" = "light") {
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
    [syntheticSaved(), theme] as const,
  );
  await page.goto("/");
  await expect(shownBirds(page)).toHaveCount(TOTAL);
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

/** Checks VU, EN and CR in the Status panel by their rows' names (the whole row is the label). */
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

    test("the threatened count; Status lists eight categories, filters to the threatened birds, and Clear restores them", async ({ page }) => {
      await seed(page);
      await expect(stats(page)).toHaveText(new RegExp(`^${TOTAL} species · .* · 4 threatened${SR.replace(/[()]/g, "\\$&")} · since `));
      const panel = await threatened(page);
      await expect(panel.getByRole("checkbox")).toHaveCount(8);
      await expect(panel.getByTestId("status-CR")).toBeChecked();
      await expect(stats(page)).toContainText(`4 of ${TOTAL} species`);
      await expect(page.getByTestId("filter-tab-status")).toContainText("Status · 3");
      await expect(page.getByTestId("filter-tab-status")).toHaveAttribute("aria-label", "Status: Vulnerable, Endangered, Critically Endangered");
      await expect(shownBirds(page)).toHaveCount(4);
      await panel.getByTestId("status-clear").click();
      await expect(shownBirds(page)).toHaveCount(TOTAL);
      await expect(stats(page)).toHaveText(new RegExp(`^${TOTAL} species`));
    });

    test("a threatened bird's mark shows on the stage and in the list without a tap; no other bird has one", async ({ page }) => {
      await seed(page);
      const stage = page.getByTestId("collage-stage");
      for (const [cat, r] of [["VU", BY.VU], ["EN", BY.EN], ["CR", CR[0]]] as const) {
        const mark = stage.locator(`.eb-bird[data-code="${r.code}"] > .eb-status`);
        await expect(mark).toBeVisible();
        await expect(mark).toHaveText(cat);
        await expect(mark).toHaveCSS("pointer-events", "none");
        await expect(stage.locator(`.eb-bird[data-code="${r.code}"]`)).toHaveAccessibleName(new RegExp(`^${r.com}, `));
      }
      await expect(stage.locator(`.eb-bird[data-code="${BY.LC.code}"] > .eb-status`)).toHaveCount(0);
      await expect(stage.locator(`.eb-bird[data-code="${NONE[0].code}"] > .eb-status`)).toHaveCount(0);
      await page.getByRole("button", { name: "List", exact: true }).click();
      const row = page.locator(`.eb-row-btn[data-code="${BY.VU.code}"]`);
      await expect(row.locator(".eb-status")).toHaveText("VU");
      await expect(page.locator(`.eb-row-btn[data-code="${BY.LC.code}"] .eb-status`)).toHaveCount(0);
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

    test("the shared view: Status filters the copied link's birds and the card has the pill", async ({ page, baseURL }) => {
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
