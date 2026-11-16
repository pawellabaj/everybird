import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The controls bar with three drops (Places, Time, Status). Round 4: no browser, so these read app.css as text and hold
// the rules the width arithmetic (in the CSS's own comments) derives.
const css = readFileSync(resolve(__dirname, "../src/components/app/app.css"), "utf8");

/** Body of the first block whose selector text matches `selector` (as tests/tokens.test.ts). */
function block(source: string, selector: RegExp): string {
  const m = selector.exec(source);
  if (!m) throw new Error(`selector not found: ${selector}`);
  const start = source.indexOf("{", m.index);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(start + 1, i);
  }
  throw new Error("unbalanced braces");
}

/** Body of the rule at the top level (outside every @media and @container) whose selector is exactly `selector`. */
function topLevelRule(source: string, selector: string): string {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) {
        const sel = text.slice(from, i).trim();
        if (sel === selector) return block(text.slice(i - 1), /./);
      }
      depth++;
    } else if (text[i] === "}") {
      if (--depth === 0) from = i + 1;
    } else if (depth === 0 && text[i] === ";") from = i + 1;
  }
  throw new Error(`no top-level rule ${selector}`);
}

const THREE = ":where(.eb-dock:has(.eb-dock-drop:nth-child(3)))";

/** The three-drop phone row: the `@container (max-width: 599px)` block that holds three-drop rules (the second one). */
function threeDropPhoneRow(): string {
  const re = /@container \(max-width: 599px\)/g;
  const found: string[] = [];
  for (let m = re.exec(css); m; m = re.exec(css)) found.push(block(css.slice(m.index), /./));
  const three = found.filter((b) => b.includes(THREE));
  if (three.length !== 1) throw new Error(`expected one three-drop 599px block, found ${three.length}`);
  return three[0];
}

describe("the controls bar's CSS: three drops", () => {
  it("one row from W: the three-drop break is the derived W, and the two-drop 820 break is untouched", () => {
    const w = block(css, /@container \(max-width: 979px\)/);
    expect(w).toContain(`${THREE} { flex-wrap: wrap; row-gap: 4px; }`);
    expect(w).toMatch(/\.eb-dock-filters\s*\{\s*order: 1; flex: 1 0 100%/);
    expect(w).toContain(`${THREE} .eb-find`);
    // Without Status the bar is as it was: the 819px rule still wraps every dock.
    const two = block(css, /@container \(max-width: 819px\)/);
    expect(two).toMatch(/^\s*\.eb-dock \{ flex-wrap: wrap; row-gap: 4px; \}/);
    expect(two).not.toContain(".eb-drop-label");
  });

  it("a drop label can always shrink (outside every rule): it never pushes the magnifier", () => {
    const label = topLevelRule(css, ".eb-drop-label");
    expect(label).toMatch(/min-width:\s*0/);
    expect(label).toMatch(/overflow:\s*hidden/);
    expect(label).toMatch(/text-overflow:\s*ellipsis/);
    expect(topLevelRule(css, ".eb-dock-filters")).toMatch(/min-width:\s*0/);
    expect(topLevelRule(css, ".eb-dock-drop")).toMatch(/flex:\s*0 1 auto/);
  });

  it("the glyphs drop under G, and under 300px the three drops are content-sized", () => {
    const g = block(css, /@container \(max-width: 319px\)/);
    expect(g).toMatch(/\.eb-dock-filters \.eb-dock-drop svg\s*\{\s*display:\s*none/);
    expect(g).toMatch(/\.eb-dock-filters \.eb-dock-drop\s*\{\s*gap: 0; padding: 0 6px/);
    for (const q of [/@media \(max-width: 299px\)/, /@media \(max-width: 239px\)/]) expect(block(css, q)).toMatch(/\.eb-dock-drop\s*\{\s*flex:\s*0 1 auto/);
    expect(block(css, /@media \(max-width: 299px\)/)).toMatch(/\.eb-dock-filters \{ justify-content: space-between; \}/);
    // The labels inherit .eb-view's 14px everywhere: no font-size of their own under 240px.
    expect(block(css, /@media \(max-width: 239px\)/)).not.toContain(".eb-drop-label");
    // Content-sized, each drop still holds a 44px press (the 599px row's min-width: 0 would let "Time" fall to ~38).
    for (const q of [/@media \(max-width: 299px\)/, /@media \(max-width: 239px\)/]) {
      expect(block(css, q)).toMatch(new RegExp(`${THREE.replace(/[().:]/g, "\\$&")} \\.eb-dock-filters \\.eb-dock-drop \\{[^}]*min-width: 44px`));
    }
  });

  it("every three-drop rule is scoped under :where(), so it weighs no more than the two-drop rule it follows", () => {
    const g = block(css, /@container \(max-width: 319px\)/);
    const rules = [
      ...block(css, /@container \(max-width: 979px\)/).split("}"),
      ...threeDropPhoneRow().split("}"),
      ...g.split("}"),
    ].map((r) => r.trim()).filter((r) => r.includes("{"));
    expect(rules.length).toBeGreaterThan(4);
    for (const r of rules) expect(r.startsWith(THREE), r).toBe(true);
    // The three-drop break comes after the 599px row (the order the cascade relies on), the glyph rule after both.
    expect(css.indexOf("@container (max-width: 599px)")).toBeLessThan(css.indexOf("@container (max-width: 979px)"));
    expect(css.indexOf("@container (max-width: 979px)")).toBeLessThan(css.indexOf("@container (max-width: 319px)"));
    // The three-drop phone row sits between the 979px break and the 319px glyph rule (both later rules of equal weight
    // rely on it: 319's padding, and the <300px grid's `flex: 0 1 auto`, must still win).
    const phone = css.indexOf(threeDropPhoneRow());
    expect(phone).toBeGreaterThan(css.indexOf("@container (max-width: 979px)"));
    expect(phone).toBeLessThan(css.indexOf("@container (max-width: 319px)"));
    expect(css.indexOf("@container (max-width: 319px)")).toBeLessThan(css.indexOf("@media (max-width: 299px)"));
  });

  it("phones: an active label reads whole with three drops (e2e/responsive.spec.ts checks it at 390px)", () => {
    const row = threeDropPhoneRow();
    const esc = (x: string) => x.replace(/[().:\[\]="]/g, "\\$&");
    // Sized by content, not thirds: each grows into what is left, Places and Status never shrink (their number is never
    // cut), each a 44px press.
    expect(row, "see e2e/responsive.spec.ts 'active labels read in full'").toMatch(
      new RegExp(`${esc(THREE)} \\.eb-dock-filters \\.eb-dock-drop \\{ flex: 1 0 auto; min-width: 44px; \\}`),
    );
    // Only Time may give way (down to its 44px press), so the longest summary is the one that ellipses on a 320px phone.
    expect(row, "see e2e/responsive.spec.ts").toMatch(new RegExp(`${esc(THREE)} \\.eb-dock-filters ${esc('[data-drop="time"]')} \\{ flex-shrink: 1; \\}`));
    // An active drop drops its glyph: the accent text and the summary say it.
    expect(row, "see e2e/responsive.spec.ts").toMatch(new RegExp(`${esc(THREE)} \\.eb-dock-filters \\.eb-dock-drop${esc("[data-active]")} svg \\{ display: none; \\}`));
    // The two-drop row is untouched: thirds that shrink.
    expect(block(css, /@container \(max-width: 599px\)/)).toMatch(/\.eb-dock-filters \.eb-dock-drop \{[^}]*flex: 1 1 0; min-width: 0;/);
    // The drops carry data-drop for the Time rule.
    const tsx = readFileSync(resolve(__dirname, "../src/components/filters/FilterDropdowns.tsx"), "utf8");
    expect(tsx).toContain("data-drop={id}");
  });

  it("the drop glyph is 18px: its rule outweighs .eb-dock-tab svg's 20px, and leaves the 14px caret alone", () => {
    expect(topLevelRule(css, ".eb-dock-drop svg:not(.eb-drop-caret)")).toMatch(/width: 18px; height: 18px/);
    expect(topLevelRule(css, ".eb-dock-tab svg")).toMatch(/width: 20px/);
  });

  it("the Status panel's long category names wrap rather than cut", () => {
    const filters = readFileSync(resolve(__dirname, "../src/components/filters/filters.css"), "utf8");
    expect(topLevelRule(filters, ".eb-status-row .eb-check-name")).toMatch(/white-space:\s*normal/);
  });
});
