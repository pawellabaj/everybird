// The share dialog's desktop grid: the orientation switch (the second row of the format column) must never run onto the
// options box below it. Read from share.css (no layout engine runs in Node), so the rules that prevent it are pinned.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/components/share/share.css', 'utf8')

/** The declarations of the first rule whose selector is exactly `selector`, optionally after the text `after`. */
function rule(selector: string, after = ''): string {
  const from = after ? css.indexOf(after) : 0
  expect(from, `"${after}" is in share.css`).toBeGreaterThanOrEqual(0)
  const re = new RegExp(`(^|[\\s}])${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
  const m = re.exec(css.slice(from))
  expect(m, `${selector} is in share.css`).not.toBeNull()
  return m![2]
}

describe('the share dialog: the orientation switch clears the options box', () => {
  it('keeps no explicit min-height on the format column (it would let the grid squeeze its row)', () => {
    expect(rule('.eb-share-formats')).not.toMatch(/min-height/)
    // Its own two rows are what make it 116px: the first at least 54px, the second the orientation switch.
    expect(rule('.eb-share-formats')).toMatch(/grid-template-rows:\s*minmax\(54px, auto\) auto/)
  })
  it("gives the desktop body a max-content first row, so the format column's rows can't be squeezed", () => {
    const body = rule('.eb-share-body', '  .eb-share-scrim .eb-share { max-height')
    expect(body).toMatch(/grid-template-rows:\s*max-content 1fr/)
    expect(body).not.toMatch(/grid-template-rows:\s*auto 1fr/)
  })
  it('does not let the dialog squeeze the body below its content (the dialog scrolls instead)', () => {
    expect(rule('.eb-share-body', '  .eb-share-scrim .eb-share { max-height')).toMatch(/flex:\s*none/)
  })
  it('keeps the 16px row gap between the format column and the controls, in share and print mode', () => {
    expect(rule('.eb-share-body', '/* The body: the format control')).toMatch(/gap:\s*16px 20px/)
    // Nothing moves the controls' column up (a negative margin or an offset on it or the options box).
    for (const sel of ['.eb-share-controls', '.eb-share-options', '.eb-share-box', '.eb-share-orient']) {
      const m = new RegExp(`(^|[\\s}])${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g')
      for (const r of css.matchAll(m)) expect(r[2]).not.toMatch(/margin[^;]*-\d|transform|\btop:/)
    }
  })
  it('lays Horizontal out side by side like Vertical, with no stacked layout left', () => {
    const wide = rule('.eb-share[data-layout="wide"] .eb-share-preview')
    expect(wide).toMatch(/width:\s*calc\(var\(--pv-h\) \* var\(--ar\)\)/)
    expect(rule('.eb-share[data-layout="wide"] .eb-share-preview')).toMatch(/--pv-h:\s*min\(var\(--ph\), var\(--pw\) \/ var\(--ar\)\)/)
    expect(css).not.toMatch(/grid-column:\s*1 \/ -1/)
    expect(css).not.toMatch(/--pv-hw|1\.15fr/)
    expect(css).toContain('min(1400px, 94vw)')
  })
})
