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
    expect(block(css, /@media \(max-width: 239px\)/)).toMatch(/\.eb-drop-label \{ font-size: 14px; \}/);
  });

  it("every three-drop rule is scoped under :where(), so it weighs no more than the two-drop rule it follows", () => {
    const g = block(css, /@container \(max-width: 319px\)/);
    const rules = [
      ...block(css, /@container \(max-width: 979px\)/).split("}"),
      ...g.split("}"),
    ].map((r) => r.trim()).filter((r) => r.includes("{"));
    expect(rules.length).toBeGreaterThan(4);
    for (const r of rules) expect(r.startsWith(THREE), r).toBe(true);
    // The three-drop break comes after the 599px row (the order the cascade relies on), the glyph rule after both.
    expect(css.indexOf("@container (max-width: 599px)")).toBeLessThan(css.indexOf("@container (max-width: 979px)"));
    expect(css.indexOf("@container (max-width: 979px)")).toBeLessThan(css.indexOf("@container (max-width: 319px)"));
    expect(css.indexOf("@container (max-width: 319px)")).toBeLessThan(css.indexOf("@media (max-width: 299px)"));
  });

  it("the Status panel's long category names wrap rather than cut", () => {
    const filters = readFileSync(resolve(__dirname, "../src/components/filters/filters.css"), "utf8");
    expect(topLevelRule(filters, ".eb-status-row .eb-check-name")).toMatch(/white-space:\s*normal/);
  });
});
