import { expect, test, type Page } from "@playwright/test";

// The controls bar answers to its own width (container queries on .eb-dockwrap). Swept from 280 to 1100px of bar in
// 4px steps, in collage view and list view, with the three drops (Places, Time and Status: the landing sample has Red
// List statuses): row one (the view tabs, the tools, the search) never breaks, the drops sit in row one from 980px
// and on a row of their own under it, no resting label is cut (nothing is filtered here), and the search never spills
// out of the bar. Run at a desktop viewport so only the bar's own width decides.
test.use({ viewport: { width: 1280, height: 900 } });

/** Widths where row one breaks, the drops sit on the wrong row, a label is cut or the search overflows, as "w:reason". */
async function sweep(page: Page) {
  return page.evaluate(() => {
    const wrap = document.querySelector<HTMLElement>(".eb-dockwrap")!;
    const dock = wrap.querySelector<HTMLElement>(".eb-dock")!;
    const bad: string[] = [];
    for (let w = 280; w <= 1100; w += 4) {
      wrap.style.width = `${w}px`;
      wrap.style.flex = "none";
      const top = (s: string) => Math.round(dock.querySelector<HTMLElement>(s)!.getBoundingClientRect().top);
      const tops = [top(".eb-dock-tabs"), top(".eb-dock-tools"), top(".eb-dock-end")];
      const d = dock.getBoundingClientRect(), end = dock.querySelector<HTMLElement>(".eb-dock-end")!.getBoundingClientRect();
      if (new Set(tops).size > 1) bad.push(`${w}:rows ${tops.join("/")}`);
      const drops = top(".eb-dock-filters");
      if (w >= 980 ? drops !== tops[0] : drops <= tops[0]) bad.push(`${w}:drops ${w >= 980 ? "not in row one" : "not below row one"} ${drops}/${tops[0]}`);
      const cut = [...dock.querySelectorAll<HTMLElement>(".eb-drop-label")].filter((l) => l.scrollWidth > l.clientWidth).map((l) => l.textContent);
      if (cut.length) bad.push(`${w}:label cut ${cut.join(", ")}`);
      if (end.right > d.right - 1 + 0.5) bad.push(`${w}:search overflows ${Math.round(end.right - d.right)}`);
      if (dock.scrollWidth > dock.clientWidth) bad.push(`${w}:dock scrolls`);
    }
    wrap.style.width = "";
    wrap.style.flex = "";
    return bad;
  });
}

test("row one of the controls bar holds from 280 to 1100px of bar with three drops, collage view and list view", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".eb-dock")).toBeVisible();
  await expect(page.getByTestId("filter-tab-status")).toBeVisible();
  expect.soft(await sweep(page), "collage view").toEqual([]);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Sorted by body mass/ })).toBeVisible();
  expect.soft(await sweep(page), "list view").toEqual([]);
});
