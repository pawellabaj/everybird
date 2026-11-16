// The dashboard page: one self-contained HTML document (inline CSS and JS, no framework, no CDN, no web fonts: the
// site's families are named first and fall back to the system's). Kept free of backticks and ${} so String.raw is safe.
export const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Everybird stats</title>
<style>
:root {
  --ink: #1e1e24; --paper: #f6f4ef; --accent: #92140c; --muted: #5f5f69; --line: #857f74; --hairline: #dedad2; --surface: #ebe8e1;
  --display: "Cabinet Grotesk", "Satoshi", system-ui, sans-serif;
  --body: "Satoshi", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --corner: .566;
  color-scheme: light dark;
}
@supports (corner-shape: superellipse(2)) { :root { --corner: 1; } }
@media (prefers-color-scheme: dark) {
  :root { --ink: #fff; --paper: #1e1e24; --accent: #f06a5f; --muted: #a9a9b2; --line: #76767f; --hairline: #3d3d45; --surface: #28282f; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 500 15px/1.45 var(--body); -webkit-text-size-adjust: 100%; }
.page { max-width: 1152px; margin: 0 auto; padding: 24px 16px 56px; display: grid; gap: 24px; }
@media (min-width: 720px) { .page { padding: 40px 32px 72px; gap: 32px; } }
h1 { font: 700 clamp(32px, 5vw, 48px)/1.05 var(--display); letter-spacing: -.02em; margin: 4px 0 0; }
h2 { font: 700 18px/1.2 var(--display); margin: 0; }
.mono { font: 500 12px/1.3 var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-variant-numeric: tabular-nums; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 6px; }
.chip, select, .seg button, .btn {
  font: inherit; font-size: 14px; color: var(--ink); background: var(--surface); border: 1px solid var(--hairline);
  min-height: 32px; padding: 4px 12px; cursor: pointer; border-radius: calc(8px * var(--corner)); corner-shape: superellipse(2);
}
.chip { position: relative; }
.chip::after { content: ""; position: absolute; inset: -6px -3px; }
.chip[aria-pressed="true"] { border-color: var(--accent); }
.chip:hover, select:hover, .btn:hover { border-color: var(--line); }
.chip[aria-pressed="true"]:hover { border-color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
select { max-width: 100%; }
/* The site's segmented control (.eb-seg): no accent; the chosen one is full opacity on Surface, the rest at 66%. */
.seg { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 4px; border: 1px solid var(--hairline); border-radius: calc(16px * var(--corner)); corner-shape: superellipse(2); }
.seg button { border: 0; background: none; opacity: .66; min-height: 44px; padding: 0 14px; border-radius: calc(12px * var(--corner)); }
.seg button[aria-pressed="true"] { opacity: 1; background: var(--surface); }
.tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 720px) { .tiles { grid-template-columns: repeat(6, 1fr); } }
.card { border: 1px solid var(--hairline); border-radius: calc(16px * var(--corner)); corner-shape: superellipse(2); padding: 14px 16px 16px; min-width: 0; }
.tile .num { font: 700 32px/1 var(--display); letter-spacing: -.02em; margin: 10px 0 6px; font-variant-numeric: tabular-nums; }
.delta { font: 500 12px/1.2 var(--mono); color: var(--muted); }
.grid { display: grid; gap: 12px; grid-template-columns: 1fr; align-items: start; }
@media (min-width: 720px) { .grid { grid-template-columns: 1fr 1fr; } }
.card h2 { margin-bottom: 4px; }
.sub { font-size: 13px; color: var(--muted); margin: 0 0 12px; }
.bar { display: grid; grid-template-columns: minmax(70px, 34%) 1fr auto; gap: 10px; align-items: center; padding: 5px 0; font-size: 14px; width: 100%; background: none; border: 0; color: inherit; text-align: left; font-family: inherit; }
button.bar { cursor: pointer; }
button.bar:hover .fill { background: var(--accent); }
.bar .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track { height: 8px; border-radius: 4px; background: var(--surface); overflow: hidden; }
.fill { height: 100%; background: var(--ink); opacity: .85; border-radius: 4px; min-width: 2px; }
.bar.f .fill { background: var(--accent); opacity: 1; }
.val { font: 500 12px/1 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.more { margin-top: 8px; }
.chartbox { position: relative; margin-top: 12px; }
svg { display: block; width: 100%; touch-action: pan-y; }
svg text { font: 500 11px var(--mono); fill: var(--muted); }
.tip { position: absolute; pointer-events: none; background: var(--paper); border: 1px solid var(--line); border-radius: calc(8px * var(--corner)); corner-shape: superellipse(2); padding: 6px 10px; font-size: 13px; white-space: nowrap; transform: translate(-50%, -100%); box-shadow: 0 12px 32px rgb(0 0 0 / .08), 0 2px 6px rgb(0 0 0 / .04); }
.tip b { font-family: var(--display); font-size: 16px; }
.empty { color: var(--muted); font-size: 14px; padding: 8px 0; }
.foot { color: var(--muted); font-size: 13px; display: grid; gap: 8px; }
#err { color: var(--accent); }
</style>
</head>
<body>
<main class="page">
  <header>
    <div class="mono">Everybird &middot; private stats</div>
    <h1>Usage</h1>
  </header>
  <div class="row" id="controls"></div>
  <section class="tiles" id="tiles" aria-label="Headline numbers"></section>
  <section class="card" aria-label="Daily chart">
    <div class="row" style="justify-content: space-between"><h2 id="ctitle">Daily</h2><div class="seg" id="seg" role="group" aria-label="Metric"></div></div>
    <div class="chartbox" id="chart"></div>
  </section>
  <section class="card" id="funnel" aria-label="Funnel"></section>
  <section class="grid" id="cards"></section>
  <footer class="foot">
    <div id="err" role="status"></div>
    <div class="row"><button class="btn" id="refresh" type="button">Refresh</button><span id="stamp" class="mono"></span></div>
    <div>Days are UTC. Counts are an undercount: visitors who send Do Not Track or Global Privacy Control, and anyone with a blocker, are not counted. A visitor id lasts one day, so "people" is per day; a range adds up person-days (the same person on two days counts twice).</div>
  </footer>
</main>
<script>
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var RANGES = [['Today', 1], ['7d', 7], ['14d', 14], ['30d', 30], ['All', 0]];
  var METRICS = [['people', 'People'], ['collages', 'Collages'], ['downloads', 'Downloads'], ['shares', 'Shares'], ['posters', 'Posters']];
  var st = { days: 14, country: '', metric: 'people', all: false, data: null, showAll: false };
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function sv(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function utc(offset) { return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); }
  function dayLabel(d) { return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function names(type) { try { return new Intl.DisplayNames(['en'], { type: type }); } catch (e) { return null; } }
  var REGION = names('region'), LANGUAGE = names('language');
  function region(c) { try { return c === 'XX' ? 'Unknown' : REGION && REGION.of(c) || c; } catch (e) { return c; } }
  function language(c) { try { return LANGUAGE && LANGUAGE.of(c) || c; } catch (e) { return c; } }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function poster(k) { var l = /-l$/.test(k); return k.replace(/-l$/, '').toUpperCase() + (l ? ' landscape' : ' portrait'); }

  var seq = 0;
  function load(fresh) {
    var to = utc(0), from = st.all ? '2020-01-01' : utc(1 - st.days), n = ++seq;
    var url = '/dashboard/data?from=' + from + '&to=' + to + (st.country ? '&country=' + st.country : '');
    $('err').textContent = '';
    // Refresh skips the browser's 60 s cache; a late answer to an older request is dropped.
    fetch(url, { credentials: 'same-origin', cache: fresh === true ? 'reload' : 'default' }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 404 ? 'Session expired: reload the page.' : 'Could not load (' + r.status + ').');
      return r.json();
    }).then(function (d) { if (n === seq) { st.data = d; render(); } }).catch(function (e) { if (n === seq) $('err').textContent = e.message; });
  }

  function controls() {
    var c = clear($('controls'));
    RANGES.forEach(function (r) {
      var b = h('button', 'chip', r[0]); b.type = 'button';
      b.setAttribute('aria-pressed', String(r[1] === 0 ? st.all : !st.all && st.days === r[1]));
      b.onclick = function () { st.all = r[1] === 0; if (r[1]) st.days = r[1]; load(); controls(); };
      c.appendChild(b);
    });
    var sel = h('select'); sel.setAttribute('aria-label', 'Country');
    var any = h('option', null, 'All countries'); any.value = ''; sel.appendChild(any);
    var list = st.data ? st.data.breakdowns.countries.slice() : [];
    if (st.country && !list.some(function (x) { return x.k === st.country; })) list.push({ k: st.country, n: 0 });
    list.sort(function (a, b) { return region(a.k).localeCompare(region(b.k)); }).forEach(function (x) { var o = h('option', null, region(x.k)); o.value = x.k; sel.appendChild(o); });
    sel.value = st.country;
    sel.onchange = function () { setCountry(sel.value); };
    c.appendChild(sel);
    if (st.country) {
      var x = h('button', 'chip', region(st.country) + ' ×'); x.type = 'button'; x.setAttribute('aria-pressed', 'true'); x.setAttribute('aria-label', 'Remove country filter');
      x.onclick = function () { setCountry(''); };
      c.appendChild(x);
    }
  }
  function setCountry(c) { st.country = c; st.showAll = false; load(); controls(); }

  function delta(v, p) {
    if (!p) return v ? 'new' : '–';
    var pct = Math.round((v - p) / p * 100);
    return (pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '= ') + Math.abs(pct) + '%';
  }
  function tiles() {
    var t = st.data.tiles, box = clear($('tiles')), last = t.peopleLast.day === utc(0);
    [['People · ' + (last ? 'today' : dayLabel(t.peopleLast.day)), t.peopleLast, 'vs day before'], ['Collages', t.collages], ['Images', t.images], ['Shares', t.shares], ['Posters', t.posters], ['Poster downloads', t.posterDownloads]].forEach(function (x) {
      var c = h('div', 'card tile'); c.appendChild(h('div', 'mono', x[0]));
      c.appendChild(h('div', 'num', fmt(x[1].value)));
      // "All" starts at the first day with data, so its previous period is empty: no comparison there.
      c.appendChild(h('div', 'delta', st.all && !x[2] ? 'all time' : delta(x[1].value, x[1].prev) + ' ' + (x[2] || 'vs previous')));
      box.appendChild(c);
    });
  }

  function seg() {
    var s = clear($('seg'));
    METRICS.forEach(function (m) {
      var b = h('button', null, m[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(st.metric === m[0]));
      b.onclick = function () { st.metric = m[0]; seg(); if (st.data) chart(); };
      s.appendChild(b);
    });
  }
  function niceMax(v) { if (v <= 4) return 4; var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function chart() {
    var box = clear($('chart')), days = st.data.days, key = st.metric;
    var label = METRICS.filter(function (m) { return m[0] === key; })[0][1];
    $('ctitle').textContent = 'Daily ' + label.toLowerCase();
    var W = Math.max(box.clientWidth || box.parentNode.clientWidth - 32, 260), H = 200, L = 32, B = 22, T = 8, R = 4;
    var max = niceMax(Math.max.apply(null, days.map(function (d) { return d[key]; }).concat([0])));
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Daily ' + label.toLowerCase() + ', ' + days.length + ' days' });
    [0, .5, 1].forEach(function (f) {
      var y = T + (H - B - T) * (1 - f);
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: 'var(--hairline)', 'stroke-width': 1 }));
      var tx = sv('text', { x: L - 6, y: y + 4, 'text-anchor': 'end' }); tx.textContent = fmt(max * f); svg.appendChild(tx);
    });
    var slot = (W - L - R) / days.length, bw = Math.max(1, Math.min(28, slot * .7)), bars = [];
    days.forEach(function (d, i) {
      var hh = (H - B - T) * d[key] / max, x = L + slot * i + (slot - bw) / 2;
      var r = sv('rect', { x: x, y: H - B - hh, width: bw, height: Math.max(hh, d[key] ? 1 : 0), rx: Math.min(4, bw / 2), fill: 'var(--muted)' });
      svg.appendChild(r); bars.push(r);
    });
    [0, Math.floor((days.length - 1) / 2), days.length - 1].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (i, n, a) {
      var tx = sv('text', { x: L + slot * (i + .5), y: H - 6, 'text-anchor': n === 0 && a.length > 1 ? 'start' : n === a.length - 1 && a.length > 1 ? 'end' : 'middle' });
      if (n === 0 && a.length > 1) tx.setAttribute('x', L); if (n === a.length - 1 && a.length > 1) tx.setAttribute('x', W - R);
      tx.textContent = dayLabel(days[i].d); svg.appendChild(tx);
    });
    var tip = h('div', 'tip'); tip.hidden = true;
    function at(ev) {
      var rect = svg.getBoundingClientRect(), x = (ev.clientX - rect.left) * W / rect.width;
      var i = Math.max(0, Math.min(days.length - 1, Math.floor((x - L) / slot)));
      bars.forEach(function (b, j) { b.style.fill = j === i ? 'var(--accent)' : ''; });
      clear(tip); tip.appendChild(h('b', null, fmt(days[i][key]))); tip.appendChild(h('span', null, ' ' + label.toLowerCase() + ' · ' + dayLabel(days[i].d)));
      tip.hidden = false;
      var px = (L + slot * (i + .5)) * rect.width / W; tip.style.left = Math.max(60, Math.min(rect.width - 60, px)) + 'px';
      tip.style.top = Math.max(26, (H - B - (H - B - T) * days[i][key] / max) * rect.height / H - 6) + 'px';
    }
    function off() { tip.hidden = true; bars.forEach(function (b) { b.style.fill = ''; }); }
    // A touch "leaves" as the finger lifts, so a tapped tip stays until a tap elsewhere (hideTip, below).
    svg.addEventListener('pointermove', at); svg.addEventListener('pointerdown', at);
    svg.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch') off(); });
    hideTip = off;
    box.appendChild(svg); box.appendChild(tip);
    if (key === 'people') box.appendChild(h('p', 'sub', 'People = distinct anonymous visitors that day; ids change daily.'));
  }

  function bars(parent, items, o) {
    o = o || {};
    var total = items.reduce(function (a, x) { return a + x.n; }, 0), max = items.reduce(function (a, x) { return Math.max(a, x.n); }, 0);
    if (!total) { parent.appendChild(h('div', 'empty', 'Nothing yet.')); return; }
    var shown = o.limit && !st.showAll ? items.slice(0, o.limit) : items;
    shown.forEach(function (x) {
      var row = h(o.click ? 'button' : 'div', 'bar' + (o.mark && o.mark(x) ? ' f' : ''));
      if (o.click) { row.type = 'button'; row.onclick = function () { o.click(x); }; row.title = 'Filter to ' + (o.label ? o.label(x.k) : x.k); }
      row.appendChild(h('span', 'name', o.label ? o.label(x.k) : x.k));
      var tr = h('span', 'track'), f = h('span', 'fill'); f.style.display = 'block'; f.style.width = (x.n / max * 100) + '%'; tr.appendChild(f); row.appendChild(tr);
      row.appendChild(h('span', 'val', fmt(x.n) + ' · ' + Math.round(x.n / total * 100) + '%'));
      parent.appendChild(row);
    });
    if (o.limit && items.length > o.limit) {
      var m = h('button', 'chip more', st.showAll ? 'Show top ' + o.limit : 'Show all ' + items.length); m.type = 'button';
      m.onclick = function () { st.showAll = !st.showAll; cards(); }; parent.appendChild(m);
    }
  }
  function card(title, sub, items, o) {
    var c = h('div', 'card'); c.appendChild(h('h2', null, title)); c.appendChild(h('p', 'sub', sub)); bars(c, items, o); return c;
  }
  function funnel() {
    var f = st.data.funnel, box = clear($('funnel')), names = { landing: 'Landing page', settings: 'Settings', collage: 'Collage page', collage_made: 'Collage made', downloaded: 'Image or poster downloaded' };
    box.appendChild(h('h2', null, 'Funnel'));
    box.appendChild(h('p', 'sub', 'Person-days that reached each step, as a share of the landing page.'));
    var base = f[0].n || Math.max.apply(null, f.map(function (x) { return x.n; }));
    if (!base) { box.appendChild(h('div', 'empty', 'Nothing yet.')); return; }
    f.forEach(function (x) {
      var row = h('div', 'bar'); row.appendChild(h('span', 'name', names[x.k]));
      var tr = h('span', 'track'), fl = h('span', 'fill'); fl.style.display = 'block'; fl.style.width = Math.min(100, x.n / base * 100) + '%'; tr.appendChild(fl); row.appendChild(tr);
      row.appendChild(h('span', 'val', fmt(x.n) + ' · ' + Math.round(x.n / base * 100) + '%')); box.appendChild(row);
    });
  }
  function cards() {
    var b = st.data.breakdowns, g = clear($('cards')), land = 0, port = 0;
    b.posterSizes.forEach(function (x) { if (/-l$/.test(x.k)) land += x.n; else port += x.n; });
    var pick = function (x) { setCountry(x.k); };
    g.appendChild(card('Image formats', 'Downloads by format.', b.formats, { label: cap }));
    g.appendChild(card('Poster sizes', 'Made: ' + fmt(port) + ' portrait, ' + fmt(land) + ' landscape.', b.posterSizes, { label: poster }));
    g.appendChild(card('Filters used', 'Once per kind per page load.', b.filters, { label: cap }));
    g.appendChild(card('Searches', 'Smart filters vs a bird.', b.search, { label: function (k) { return k === 'smart' ? 'Smart filters' : 'Bird'; } }));
    g.appendChild(card('Interface language', 'Switched to.', b.uiLanguages, { label: language }));
    g.appendChild(card('Browser language', 'Visits, person-days.', b.browserLanguages, { label: language }));
    g.appendChild(card('Devices', 'Person-days.', b.devices, { label: function (k) { return cap(k.replace(/-/g, ' ')); } }));
    g.appendChild(card('Countries', 'Person-days. Click one to filter the page.', b.countries, { label: region, limit: 15, click: pick, mark: function (x) { return x.k === st.country; } }));
  }
  function render() {
    var d = st.data;
    tiles(); chart(); funnel(); cards(); controls();
    $('stamp').textContent = 'Updated ' + new Date(d.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + dayLabel(d.range.from) + ' to ' + dayLabel(d.range.to) + ' UTC';
  }
  var hideTip = null;
  document.addEventListener('pointerdown', function (ev) { if (hideTip && !$('chart').contains(ev.target)) hideTip(); });
  $('refresh').onclick = function () { load(true); };
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (st.data) chart(); }, 120); });
  seg(); controls(); load();
})();
</script>
</body>
</html>
`
