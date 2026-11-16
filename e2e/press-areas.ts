import type { Page } from "@playwright/test";

/**
 * Controls whose press area is under 44px, and how far the page scrolls sideways. A control's press area counts an
 * absolutely placed ::after (the hit areas drawn smaller pills and underlines carry). Exempt: stickers (sized by mass,
 * reached by keyboard too), links inside running text (WCAG 2.5.8's inline exception), a checkbox inside its row's
 * label (the 44px row is the target), file inputs behind their buttons, and the small source buttons on a fine pointer
 * (40px for a mouse, 44px for touch: flows.spec.ts's touch test holds them to 44px).
 */
export async function pressAreas(page: Page) {
  return page.evaluate(() => {
    const small: string[] = [];
    const fine = matchMedia("(pointer: fine)").matches;
    const sel = 'a[href], button, [role="button"], [role="switch"], [role="option"], [role="slider"], input, select, summary';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (el.closest("[inert], [aria-hidden=true]") || el.closest(".eb-bird, .ebd")) continue;
      if (el.matches('input[type="file"]') || (el.matches('input[type="checkbox"]') && el.closest("label"))) continue;
      if (fine && el.matches(".eb-btn-sm")) continue;
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      if (cs.visibility === "hidden" || b.width === 0 || b.height === 0) continue;
      if (el.tagName === "A" && cs.display === "inline" && /^(P|LI|SPAN|SMALL|FIGCAPTION|DD)$/.test(el.parentElement?.tagName ?? "")) continue;
      let w = b.width, h = b.height;
      const af = getComputedStyle(el, "::after");
      if (af.content !== "none" && af.position === "absolute") {
        const t = parseFloat(af.top), l = parseFloat(af.left);
        if (t < 0) h = b.height - 2 * t;
        if (l < 0) w = b.width - 2 * l;
        w = Math.max(w, parseFloat(af.width) || 0);
        h = Math.max(h, parseFloat(af.height) || 0);
      }
      if (Math.round(w) < 44 || Math.round(h) < 44) small.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40)} ${Math.round(w)}x${Math.round(h)}`);
    }
    return { small, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}
