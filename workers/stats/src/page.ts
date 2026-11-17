// The dashboard page: one self-contained HTML document (inline CSS and JS, no framework, no CDN, no web fonts: the
// site's families are named first and fall back to the system's). The page body is String.raw, so it has no backticks
// and no ${}; the one interpolation is the small pure functions from pure.ts (hash state, CSV, rates, the safe claim).
import { PURE_JS } from './pure'

export const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Everybird stats</title>
<script>(function(){try{var t=localStorage.getItem('everybird:theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()</script>
<style>
/* The site's seven tokens, two themes. No data-theme: follow the device. data-theme (the toggle, saved per device) wins. */
:root {
  --ink: #1e1e24; --paper: #f6f4ef; --accent: #92140c; --muted: #5f5f69; --line: #857f74; --hairline: #dedad2; --surface: #ebe8e1;
  --display: "Cabinet Grotesk", "Satoshi", system-ui, sans-serif;
  --body: "Satoshi", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --ease: cubic-bezier(.16, 1, .3, 1); --corner: .566;
  color-scheme: light dark;
}
@supports (corner-shape: superellipse(2)) { :root { --corner: 1; } }
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { --ink: #fff; --paper: #1e1e24; --accent: #f06a5f; --muted: #a9a9b2; --line: #76767f; --hairline: #3d3d45; --surface: #28282f; color-scheme: dark; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { --ink: #fff; --paper: #1e1e24; --accent: #f06a5f; --muted: #a9a9b2; --line: #76767f; --hairline: #3d3d45; --surface: #28282f; }
}
* { box-sizing: border-box; }
::selection { background: color-mix(in srgb, var(--accent) 22%, transparent); }
body { margin: 0; background: var(--paper); color: var(--ink); font: 500 15px/1.45 var(--body); -webkit-text-size-adjust: 100%; caret-color: var(--accent); transition: background-color .2s var(--ease), color .2s var(--ease); }
.page { max-width: 1152px; margin: 0 auto; padding: 20px 16px 56px; display: grid; gap: 20px; }
@media (min-width: 720px) { .page { padding: 40px 32px 72px; gap: 28px; } }
h1 { font: 700 clamp(32px, 5vw, 48px)/1.05 var(--display); letter-spacing: -.02em; margin: 0; }
h2 { font: 700 18px/1.2 var(--display); margin: 0; }
.mono { font: 500 12px/1.3 var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-variant-numeric: tabular-nums; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 8px; }
.between { justify-content: space-between; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.head .mono { margin-top: 10px; text-transform: none; letter-spacing: .02em; font-size: 13px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* Buttons and fields: the site's 8px squircle on Surface, 44px to press. */
.btn, select {
  font: inherit; font-size: 14px; color: var(--ink); background: var(--surface); border: 1px solid var(--hairline); min-height: 44px; padding: 0 14px; cursor: pointer;
  border-radius: calc(8px * var(--corner)); corner-shape: superellipse(2); transition: border-color .15s var(--ease), opacity .15s var(--ease);
}
select { font-size: 16px; /* 16px so iOS does not zoom */ max-width: 100%; min-width: 0; flex: 1 1 160px; border-color: var(--line); }
.btn:disabled { color: var(--muted); cursor: default; }
.btn.chip { min-height: 32px; padding: 0 12px; position: relative; }
.btn.chip::after { content: ""; position: absolute; inset: -6px -3px; }
.btn.on { border-color: var(--accent); }
@media (hover: hover) and (pointer: fine) { .btn:not(:disabled):hover, select:hover { border-color: var(--line); } .btn.on:hover { border-color: var(--accent); } }
/* The site's theme toggle (.eb-theme): a bare 44px squircle with the sun or the moon. */
.theme { position: relative; display: grid; place-items: center; width: 44px; height: 44px; flex: none; padding: 0; border: 0; background: transparent; color: var(--ink); cursor: pointer; -webkit-tap-highlight-color: transparent; border-radius: calc(14px * var(--corner)); corner-shape: superellipse(2); transition: background-color .15s var(--ease); }
.theme svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
@media (hover: hover) and (pointer: fine) { .theme:hover { background: var(--surface); } }
.theme .sun { display: none; }
:root[data-theme="dark"] .theme .sun { display: block; } :root[data-theme="dark"] .theme .moon { display: none; }
@media (prefers-color-scheme: dark) { :root:not([data-theme]) .theme .sun { display: block; } :root:not([data-theme]) .theme .moon { display: none; } }
/* The site's segmented control: no accent; the chosen one is full opacity on Surface, the rest at 66%. */
.seg { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 4px; border: 1px solid var(--hairline); border-radius: calc(16px * var(--corner)); corner-shape: superellipse(2); }
.seg button { font: inherit; font-size: 14px; color: var(--ink); border: 0; background: none; opacity: .66; min-height: 44px; min-width: 44px; padding: 0 14px; cursor: pointer; border-radius: calc(12px * var(--corner)); corner-shape: superellipse(2); transition: opacity .25s cubic-bezier(.25, .1, .25, 1), background-color .25s cubic-bezier(.25, .1, .25, 1); }
.seg button[aria-pressed="true"] { opacity: 1; background: var(--surface); }
#range { width: 100%; } #range button { flex: 1; } @media (min-width: 720px) { #range { width: auto; } }
/* The site's switch: Surface track with a Line ring, Muted knob; on, the track is Accent and the knob Paper. */
.sw { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 4px; font: inherit; font-size: 14px; color: var(--ink); background: none; border: 0; cursor: pointer; }
.sw i { position: relative; width: 34px; height: 20px; flex: none; border-radius: 10px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); transition: background-color .15s var(--ease); }
.sw i::after { content: ""; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--muted); transition: transform .15s var(--ease), background-color .15s var(--ease); }
.sw[aria-checked="true"] i { background: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.sw[aria-checked="true"] i::after { background: var(--paper); transform: translateX(14px); }
.sw:disabled { color: var(--muted); cursor: default; }
#controls { display: grid; gap: 8px; } #controls .row { flex-wrap: nowrap; }
@media (min-width: 720px) { #controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; } #controls select { flex: 0 1 220px; } }
/* Cards: hairline, Paper, no shadow at rest (only the tooltip floats). */
.card { border: 1px solid var(--hairline); border-radius: calc(16px * var(--corner)); corner-shape: superellipse(2); padding: 16px; min-width: 0; }
.card h2 { margin-bottom: 4px; }
.sub { font-size: 13px; line-height: 1.4; color: var(--muted); margin: 0 0 12px; }
.tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 720px) { .tiles { grid-template-columns: repeat(3, 1fr); gap: 16px; } }
.tile { display: grid; gap: 8px; padding: 14px 16px 12px; }
.num { font: 700 34px/1 var(--display); letter-spacing: -.025em; font-variant-numeric: tabular-nums; min-height: 34px; }
.tile .num { margin-top: 2px; }
.delta { display: inline-flex; align-items: center; gap: 4px; font: 500 12px/1.2 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; min-height: 16px; }
.delta svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.spark { display: block; width: 100%; height: 28px; margin-top: 2px; }
.spark path { vector-effect: non-scaling-stroke; }
.spark .a { fill: var(--surface); stroke: none; } .spark .l { fill: none; stroke: var(--muted); stroke-width: 1.5; stroke-linejoin: round; } .spark .z { stroke: var(--hairline); stroke-width: 1; stroke-dasharray: 3 3; }
.grid { display: grid; gap: 12px; grid-template-columns: 1fr; align-items: start; }
@media (min-width: 720px) { .grid { grid-template-columns: 1fr 1fr; gap: 16px; } .grid .wide { grid-column: 1 / -1; } }
@media (min-width: 1000px) { .grid.three { grid-template-columns: repeat(3, 1fr); } }
.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 12px; }
.stats .num { font-size: 28px; margin: 6px 0 2px; } .stats small { display: block; font-size: 12px; line-height: 1.35; color: var(--muted); }
@media (min-width: 720px) { .stats.four { grid-template-columns: repeat(4, 1fr); } }
.bar { display: grid; grid-template-columns: minmax(70px, 34%) 1fr auto; gap: 10px; align-items: center; padding: 6px 0; font-size: 14px; width: 100%; background: none; border: 0; color: inherit; text-align: left; font-family: inherit; }
button.bar { cursor: pointer; min-height: 44px; }
@media (hover: hover) and (pointer: fine) { button.bar:hover .fill { background: var(--accent); } }
.bar .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track { height: 8px; border-radius: 4px; background: var(--surface); overflow: hidden; }
.fill { display: block; height: 100%; background: var(--ink); opacity: .85; border-radius: 4px; min-width: 2px; transform-origin: left; }
.go .fill { animation: sweep .45s var(--ease) both; }
.bar.f .fill { background: var(--accent); opacity: 1; }
.val { font: 500 12px/1 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.more { margin-top: 8px; }
.chartbox { position: relative; margin-top: 12px; }
svg.chart { display: block; width: 100%; touch-action: pan-y; }
svg.chart:focus-visible { outline-offset: 4px; }
svg text { font: 500 11px var(--mono); fill: var(--muted); }
.bars rect { transform-box: fill-box; transform-origin: bottom; transition: fill .12s var(--ease); }
.bars.go rect { animation: grow .5s var(--ease) both; animation-delay: calc(var(--i) * var(--step, 12ms)); }
.bars .ghost { fill: var(--line); opacity: .32; } .bars .cur { fill: var(--muted); }
.tip { position: absolute; pointer-events: none; background: var(--paper); border: 1px solid var(--line); border-radius: calc(8px * var(--corner)); corner-shape: superellipse(2); padding: 6px 10px; font-size: 13px; line-height: 1.4; white-space: nowrap; transform: translate(-50%, -100%); box-shadow: 0 12px 32px rgb(0 0 0 / .08), 0 2px 6px rgb(0 0 0 / .04); animation: fade .15s var(--ease); }
.tip b { font: 700 16px var(--display); font-variant-numeric: tabular-nums; } .tip .p { display: block; color: var(--muted); font-size: 12px; }
.key { display: flex; gap: 16px; font-size: 12px; color: var(--muted); } .key i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.empty { color: var(--muted); font-size: 14px; padding: 8px 0; }
.claim { margin: 12px 0 0; display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; font-size: 14px; }
.foot { color: var(--muted); font-size: 13px; display: grid; gap: 8px; }
#err { color: var(--accent); min-height: 0; }
/* Loading: skeleton blocks at the content's own size, then a gentle dim while a new range loads. */
.sk { color: transparent !important; background: var(--surface); border-radius: calc(8px * var(--corner)); animation: pulse 1.4s ease-in-out infinite; user-select: none; }
.sk * { visibility: hidden; }
#content { display: grid; gap: 20px; transition: opacity .2s var(--ease); } @media (min-width: 720px) { #content { gap: 28px; } } #content[aria-busy="true"] { opacity: .6; }
@keyframes grow { from { transform: scaleY(0); } }
@keyframes sweep { from { transform: scaleX(0); } }
@keyframes fade { from { opacity: 0; } }
@keyframes pulse { 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<main class="page">
  <header class="head">
    <div><h1>Usage</h1><div class="mono" id="sub">Everybird &middot; private &middot; days are Pacific from 17 Nov</div></div>
    <button class="theme" id="theme" type="button" role="switch" aria-checked="false" aria-label="Dark mode">
      <svg class="moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.2 8.2 0 1 0 20 14.2Z"/></svg>
      <svg class="sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>
    </button>
  </header>
  <div id="controls">
    <div class="seg" id="range" role="group" aria-label="Range"></div>
    <div class="row"><select id="country" aria-label="Country"></select><button class="sw" id="cmp" type="button" role="switch" aria-checked="false">Compare<i></i></button></div>
  </div>
  <div id="content" aria-busy="true">
    <section class="tiles" id="tiles" aria-label="Headline numbers"></section>
    <section class="card" id="panel" aria-label="Country" hidden></section>
    <section class="card" aria-label="Daily chart">
      <div class="row between"><h2 id="ctitle">Daily</h2><div class="seg" id="seg" role="group" aria-label="Metric"></div></div>
      <div class="chartbox" id="chart"></div>
      <div class="row between" style="margin-top: 8px"><div class="key" id="key"></div><button class="btn chip" id="csv" type="button">Export CSV</button></div>
    </section>
    <section class="grid">
      <div class="card" id="rates" aria-label="Rates"></div>
      <div class="card" id="launch" aria-label="Since launch"></div>
      <div class="card wide" id="funnel" aria-label="Funnel"></div>
    </section>
    <section class="grid three" id="cards"></section>
  </div>
  <footer class="foot">
    <div id="err" role="status"></div>
    <div class="row"><button class="btn" id="refresh" type="button">Refresh</button><button class="sw" id="auto" type="button" role="switch" aria-checked="false">Auto-refresh every minute<i></i></button></div>
    <span id="stamp" class="mono"></span>
    <div>Days are Pacific time (Vancouver) from 17 Nov 2026; earlier days are UTC days, so 16 Nov runs from 15 Nov 17:00 to 16 Nov 24:00 Pacific (31 hours). Counts are an undercount: visitors who send Do Not Track or Global Privacy Control, and anyone with a blocker, are not counted. A visitor id lasts one day, so "people" is per day; a range adds up person-days (the same person on two days counts twice).</div>
  </footer>
</main>
<script>
(function () {
  'use strict';
${PURE_JS}
  var NS = 'http://www.w3.org/2000/svg';
  var RANGES = [['Today', 1], ['7d', 7], ['14d', 14], ['30d', 30], ['All', 0]];
  var METRICS = [['people', 'People'], ['collages', 'Collages'], ['downloads', 'Downloads'], ['shares', 'Shares'], ['posters', 'Posters']];
  // [label, tiles key, days key, caption for the change]
  var TILES = [['People', 'peopleLast', 'people', 'vs day before'], ['Collages', 'collages', 'collages'], ['Images', 'images', 'images'], ['Shares', 'shares', 'shares'], ['Posters', 'posters', 'posters'], ['Poster downloads', 'posterDownloads', 'posterDownloads']];
  var st = parseHash(location.hash); st.data = null; st.showAll = false;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function sv(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function btn(text, cls, fn) { var b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pacific(offset) { return addDays(pacificDay(Date.now()), offset); } // "today" and the presets are Pacific dates (pure.ts)
  function dayLabel(d) { return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function names(type) { try { return new Intl.DisplayNames(['en'], { type: type }); } catch (e) { return null; } }
  var REGION = names('region'), LANGUAGE = names('language');
  function region(c) { try { return c === 'XX' ? 'Unknown' : REGION && REGION.of(c) || c; } catch (e) { return c; } }
  function language(c) { try { return LANGUAGE && LANGUAGE.of(c) || c; } catch (e) { return c; } }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function poster(k) { var l = /-l$/.test(k); return k.replace(/-l$/, '').toUpperCase() + (l ? ' landscape' : ' portrait'); }
  function store(k, v) { try { if (v == null) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function metricLabel() { return METRICS.filter(function (m) { return m[0] === st.metric; })[0][1]; }

  // ---- theme: the site's mechanism ([data-theme] on <html>, saved per device); with no choice it follows the device ----
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() { var t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : dark.matches; }
  function themeUi() { $('theme').setAttribute('aria-checked', String(isDark())); }
  $('theme').onclick = function () { var t = isDark() ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); store('everybird:theme', t); themeUi(); };
  if (dark.addEventListener) dark.addEventListener('change', themeUi);

  // ---- loading ----
  var seq = 0, animate = true, timer = 0;
  // quiet: a background refresh keeps the page as it is (no dimming).
  function load(fresh, quiet) {
    var to = pacific(0), from = st.all ? '2020-01-01' : pacific(1 - st.days), n = ++seq;
    var url = '/dashboard/data?from=' + from + '&to=' + to + (st.country ? '&country=' + st.country : '');
    $('err').textContent = ''; if (!quiet) $('content').setAttribute('aria-busy', 'true');
    // Refresh skips the browser's 60 s cache; a late answer to an older request is dropped.
    fetch(url, { credentials: 'same-origin', cache: fresh === true ? 'reload' : 'default' }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 404 ? 'Session expired: reload the page.' : 'Could not load (' + r.status + ').');
      return r.json();
    }).then(function (d) { if (n === seq) { st.data = d; render(); } }).catch(function (e) { if (n === seq) { $('err').textContent = e.message; $('content').setAttribute('aria-busy', 'false'); } });
  }
  // Any change of view: keep it in the URL hash, redraw the controls, and fetch (the bars grow again).
  function change(patch, noLoad) {
    for (var k in patch) st[k] = patch[k];
    st.showAll = false; animate = true;
    try { history.replaceState(null, '', location.pathname + location.search + serializeHash(st)); } catch (e) { /* sandboxed: the view just isn't kept in the URL */ }
    controls(); if (!noLoad) load(); else if (st.data) render();
  }
  window.addEventListener('hashchange', function () { var s = parseHash(location.hash); if (serializeHash(s) !== serializeHash(st)) { st.days = s.days; st.all = s.all; st.country = s.country; st.metric = s.metric; st.compare = s.compare; st.showAll = false; animate = true; controls(); load(); } });

  function controls() {
    var r = clear($('range'));
    RANGES.forEach(function (x) {
      var b = btn(x[0], null, function () { change({ all: x[1] === 0, days: x[1] || st.days, compare: x[1] === 0 ? false : st.compare }); });
      b.setAttribute('aria-pressed', String(x[1] === 0 ? st.all : !st.all && st.days === x[1])); r.appendChild(b);
    });
    var sel = $('country'), list = st.data ? st.data.breakdowns.countries.slice() : [];
    if (st.country && !list.some(function (x) { return x.k === st.country; })) list.push({ k: st.country, n: 0 });
    list.sort(function (a, b) { return region(a.k).localeCompare(region(b.k)); });
    var sig = list.map(function (x) { return x.k; }).join();
    if (sel.dataset.sig !== sig) {
      clear(sel); sel.dataset.sig = sig;
      var any = h('option', null, 'All countries'); any.value = ''; sel.appendChild(any);
      list.forEach(function (x) { var o = h('option', null, region(x.k)); o.value = x.k; sel.appendChild(o); });
    }
    sel.value = st.country;
    $('cmp').setAttribute('aria-checked', String(st.compare && !st.all)); $('cmp').disabled = st.all; $('cmp').title = st.all ? 'Not available for All' : '';
    var m = clear($('seg'));
    METRICS.forEach(function (x) { var b = btn(x[1], null, function () { change({ metric: x[0] }, true); }); b.setAttribute('aria-pressed', String(st.metric === x[0])); m.appendChild(b); });
  }
  $('country').onchange = function () { change({ country: this.value }); };
  $('cmp').onclick = function () { change({ compare: !st.compare }, true); };
  $('csv').onclick = function () {
    if (!st.data) return;
    var a = h('a'), u = URL.createObjectURL(new Blob([buildCsv(st.data.days, st.data.range.country)], { type: 'text/csv' }));
    a.href = u; a.download = 'everybird-' + st.data.range.from + '-to-' + st.data.range.to + (st.data.range.country ? '-' + st.data.range.country : '') + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  };

  // ---- skeletons: the real structure with blocks where the numbers go, so nothing jumps when data arrives ----
  function skeleton() {
    var t = clear($('tiles'));
    TILES.forEach(function (x) { var c = tile(x); c.querySelectorAll('.num, .delta, .spark').forEach(function (e) { e.classList.add('sk'); }); t.appendChild(c); });
    var sk = clear($('chart')); var b = h('div', 'sk'); b.style.height = '200px'; sk.appendChild(b);
    for (var j = 0; j < 3; j++) { var cd = h('div', 'card'); $('cards').appendChild(cd).appendChild(h('div', 'sk')).style.height = '148px'; }
    ['rates', 'launch', 'funnel'].forEach(function (id) { var c = clear($(id)); for (var i = 0; i < 3; i++) { var l = h('div', 'sk'); l.style.height = '20px'; l.style.margin = '12px 0'; c.appendChild(l); } });
  }
  function tile(x) {
    var c = h('div', 'card tile'); c.appendChild(h('div', 'mono', x[0])); c.appendChild(h('div', 'num', '0')); c.appendChild(h('div', 'delta', '–'));
    var s = sv('svg', { class: 'spark', viewBox: '0 0 100 28', preserveAspectRatio: 'none', 'aria-hidden': 'true' }); c.appendChild(s); return c;
  }

  // ---- headline tiles: built once, then updated in place (numbers roll, nothing is rebuilt) ----
  function roll(el, to) {
    var from = Number(el.dataset.v), t0 = performance.now(); el.dataset.v = to; el.classList.remove('sk');
    if (reduced() || isNaN(from) || from === to) { el.textContent = fmt(to); return; }
    el.dataset.t = t0;
    (function step(t) { if (el.dataset.t !== String(t0)) return; var k = Math.min(1, (t - t0) / 320); k = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); })(t0);
  }
  var ARROW = { up: 'M5 9V1M1.5 4.5 5 1l3.5 3.5', down: 'M5 1v8M1.5 5.5 5 9l3.5-3.5', flat: 'M1 5h8' };
  function deltaEl(e, v, p, caption) {
    clear(e); e.classList.remove('sk');
    var d = deltaInfo(v, p);
    if (d.dir === 'none') { e.textContent = '–'; return; }
    if (d.dir === 'new') { e.textContent = 'new ' + caption; return; }
    var s = sv('svg', { viewBox: '0 0 10 10', 'aria-hidden': 'true' }); s.appendChild(sv('path', { d: ARROW[d.dir] })); e.appendChild(s);
    e.appendChild(h('span', 'sr', d.dir === 'up' ? 'Up ' : d.dir === 'down' ? 'Down ' : ''));
    e.appendChild(document.createTextNode((d.dir === 'flat' ? 'no change' : d.pct + '%') + ' ' + caption));
  }
  function spark(svg, vals) {
    clear(svg);
    if (vals.length < 2) { svg.appendChild(sv('path', { class: 'z', d: 'M0 27H100' })); return; }
    var max = Math.max.apply(null, vals.concat([1])), pts = vals.map(function (v, i) { return (i / (vals.length - 1) * 100).toFixed(1) + ' ' + (26 - v / max * 24).toFixed(1); });
    svg.appendChild(sv('path', { class: 'a', d: 'M' + pts.join('L') + 'L100 28L0 28Z' })); svg.appendChild(sv('path', { class: 'l', d: 'M' + pts.join('L') }));
  }
  function tiles() {
    var d = st.data, box = $('tiles'), last = d.tiles.peopleLast.day === pacific(0);
    if (box.children.length !== TILES.length || box.querySelector('.sk')) { clear(box); TILES.forEach(function (x) { box.appendChild(tile(x)); }); }
    TILES.forEach(function (x, i) {
      var c = box.children[i], t = d.tiles[x[1]];
      c.firstChild.textContent = x[0] + (i === 0 ? ' · ' + (last ? 'today' : dayLabel(t.day)) : '');
      roll(c.querySelector('.num'), t.value);
      // "All" starts at the first day with data, so its previous period is empty: no comparison there.
      if (st.all && !x[3]) { var e = c.querySelector('.delta'); clear(e).classList.remove('sk'); e.textContent = 'all time'; } else deltaEl(c.querySelector('.delta'), t.value, t.prev, x[3] || 'vs previous');
      var sp = c.querySelector('.spark'); sp.classList.remove('sk'); spark(sp, d.days.map(function (y) { return y[x[2]]; }));
    });
  }

  // ---- the daily chart: bars, with the previous period as ghost bars behind when Compare is on ----
  function niceMax(v) { if (v <= 4) return 4; var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  var hideTip = null;
  function chart() {
    var box = clear($('chart')), d = st.data, days = d.days, key = st.metric, label = metricLabel(), cmp = st.compare && !st.all && d.prevDays.length === days.length;
    $('ctitle').textContent = 'Daily ' + label.toLowerCase();
    clear($('key'));
    if (cmp) { var k1 = h('span'), k2 = h('span'); k1.appendChild(h('i')).style.background = 'var(--muted)'; k1.appendChild(document.createTextNode('This period')); k2.appendChild(h('i')).style.background = 'var(--line)'; k2.appendChild(document.createTextNode('Previous period')); $('key').appendChild(k1); $('key').appendChild(k2); }
    var W = Math.max(box.clientWidth || box.parentNode.clientWidth - 32, 260), H = 200, L = 32, B = 22, T = 8, R = 4;
    var all = days.map(function (x) { return x[key]; }).concat(cmp ? d.prevDays.map(function (x) { return x[key]; }) : [], [0]);
    var max = niceMax(Math.max.apply(null, all));
    var svg = sv('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', tabindex: 0, 'aria-label': 'Daily ' + label.toLowerCase() + ', ' + days.length + ' days. Arrow keys read each day.' });
    [0, .5, 1].forEach(function (f) {
      var y = T + (H - B - T) * (1 - f);
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: 'var(--hairline)', 'stroke-width': 1 }));
      var tx = sv('text', { x: L - 6, y: y + 4, 'text-anchor': 'end' }); tx.textContent = fmt(max * f); svg.appendChild(tx);
    });
    var slot = (W - L - R) / days.length, bw = Math.max(1, Math.min(28, slot * .7)), gw = Math.min(slot, bw + 8), g = sv('g', { class: 'bars' + (animate && !reduced() ? ' go' : '') }), cur = [];
    var yOf = function (v) { return H - B - (H - B - T) * v / max; };
    function bar(cls, v, w, i) { var x = L + slot * i + (slot - w) / 2, r = sv('rect', { class: cls, x: x, y: yOf(v), width: w, height: Math.max(H - B - yOf(v), v ? 1 : 0), rx: Math.min(4, w / 2) }); r.style.setProperty('--i', i); g.appendChild(r); return r; }
    if (cmp) d.prevDays.forEach(function (x, i) { bar('ghost', x[key], gw, i); });
    days.forEach(function (x, i) { cur.push(bar('cur', x[key], bw, i)); });
    g.style.setProperty('--step', Math.min(12, 240 / days.length).toFixed(2) + 'ms'); // the whole stagger stays under a quarter second
    svg.appendChild(g);
    [0, Math.floor((days.length - 1) / 2), days.length - 1].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (i, n, a) {
      var tx = sv('text', { x: L + slot * (i + .5), y: H - 6, 'text-anchor': a.length > 1 && n === 0 ? 'start' : a.length > 1 && n === a.length - 1 ? 'end' : 'middle' });
      if (a.length > 1 && n === 0) tx.setAttribute('x', L); if (a.length > 1 && n === a.length - 1) tx.setAttribute('x', W - R);
      tx.textContent = dayLabel(days[i].d); svg.appendChild(tx);
    });
    var tip = h('div', 'tip'); tip.hidden = true;
    function show(i) {
      var rect = svg.getBoundingClientRect(); cur.forEach(function (b, j) { b.style.fill = j === i ? 'var(--accent)' : ''; });
      clear(tip); tip.appendChild(h('b', null, fmt(days[i][key]))); tip.appendChild(h('span', null, ' ' + label.toLowerCase() + ' · ' + dayLabel(days[i].d)));
      if (cmp) tip.appendChild(h('span', 'p', fmt(d.prevDays[i][key]) + ' on ' + dayLabel(d.prevDays[i].d)));
      tip.hidden = false; svg.dataset.i = i;
      var px = (L + slot * (i + .5)) * rect.width / W; tip.style.left = Math.max(60, Math.min(rect.width - 60, px)) + 'px';
      tip.style.top = Math.max(cmp ? 44 : 30, yOf(Math.max(days[i][key], cmp ? d.prevDays[i][key] : 0)) * rect.height / H - 6) + 'px';
    }
    function at(ev) { var rect = svg.getBoundingClientRect(); show(Math.max(0, Math.min(days.length - 1, Math.floor(((ev.clientX - rect.left) * W / rect.width - L) / slot)))); }
    function off() { tip.hidden = true; cur.forEach(function (b) { b.style.fill = ''; }); }
    // A touch "leaves" as the finger lifts, so a tapped tip stays until a tap elsewhere (hideTip, below).
    svg.addEventListener('pointermove', at); svg.addEventListener('pointerdown', at);
    svg.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch') off(); });
    svg.addEventListener('keydown', function (ev) {
      var i = Number(svg.dataset.i == null ? -1 : svg.dataset.i), step = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (ev.key === 'Escape') off(); if (!step) return; ev.preventDefault(); show(Math.max(0, Math.min(days.length - 1, i + step)));
    });
    svg.addEventListener('blur', off);
    hideTip = off; box.appendChild(svg); box.appendChild(tip);
    if (key === 'people') box.appendChild(h('p', 'sub', 'People = distinct anonymous visitors that day; ids change daily.')).style.marginTop = '8px';
  }

  // ---- bar lists, rates, launch totals, funnel ----
  function bars(parent, items, o) {
    o = o || {};
    var total = items.reduce(function (a, x) { return a + x.n; }, 0), max = items.reduce(function (a, x) { return Math.max(a, x.n); }, 0);
    if (!total) { parent.appendChild(h('div', 'empty', 'Nothing yet.')); return; }
    (o.limit && !st.showAll ? items.slice(0, o.limit) : o.top ? items.slice(0, o.top) : items).forEach(function (x) {
      var row = h(o.click ? 'button' : 'div', 'bar' + (o.mark && o.mark(x) ? ' f' : ''));
      if (o.click) { row.type = 'button'; row.onclick = function () { o.click(x); }; row.title = 'Filter to ' + (o.label ? o.label(x.k) : x.k); }
      row.appendChild(h('span', 'name', o.label ? o.label(x.k) : x.k));
      var tr = h('span', 'track'), f = h('span', 'fill'); f.style.width = (x.n / max * 100) + '%'; tr.appendChild(f); row.appendChild(tr);
      row.appendChild(h('span', 'val', fmt(x.n) + ' · ' + Math.round(x.n / total * 100) + '%'));
      parent.appendChild(row);
    });
    if (o.limit && items.length > o.limit) parent.appendChild(btn(st.showAll ? 'Show top ' + o.limit : 'Show all ' + items.length, 'btn chip more', function () { st.showAll = !st.showAll; cards(); }));
  }
  function card(title, sub, items, o) { var c = h('div', 'card'); c.appendChild(h('h2', null, title)); c.appendChild(h('p', 'sub', sub)); bars(c, items, o); return c; }
  function stat(parent, label, value, note) { var s = h('div'); s.appendChild(h('div', 'mono', label)); s.appendChild(h('div', 'num', value)); s.appendChild(h('small', null, note)); parent.appendChild(s); }
  function rates() {
    var r = st.data.rates, c = clear($('rates')), g = h('div', 'stats four');
    c.appendChild(h('h2', null, 'Rates')); c.appendChild(h('p', 'sub', 'Of ' + fmt(r.pd) + ' person-days, the share that did each thing at least once.'));
    stat(g, 'Collage', pct(r.collage, r.pd), 'made a collage'); stat(g, 'Download', pct(r.downloaded, r.pd), 'saved an image or poster');
    stat(g, 'Share', pct(r.shared, r.pd), 'shared'); stat(g, 'Poster', pct(r.poster, r.pd), 'made a poster'); c.appendChild(g);
  }
  function launch() {
    var l = st.data.launch, c = clear($('launch')), g = h('div', 'stats'), claim = safeClaim(l.own, 'collages made on Everybird');
    c.appendChild(h('h2', null, 'Since launch')); c.appendChild(h('p', 'sub', 'All time, all countries' + (l.since ? ', from ' + dayLabel(l.since) : '') + '.'));
    stat(g, 'Collages', fmt(l.collages), 'made, ' + fmt(l.own) + ' from real lists'); stat(g, 'Images', fmt(l.images), 'downloaded'); stat(g, 'Posters', fmt(l.posters), 'made');
    stat(g, 'Busiest day', l.peak ? dayLabel(l.peak.day) : '–', l.peak ? fmt(l.peak.people) + ' people' : 'no data'); c.appendChild(g);
    var p = h('div', 'claim'); p.appendChild(h('span', null, claim || 'Not enough yet for a claim.'));
    if (claim) { var b = btn('Copy', 'btn chip', function () { copy(claim); b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }); p.appendChild(b); }
    c.appendChild(p);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(function () {}); return; }
    var t = h('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* nothing to do */ } t.remove();
  }
  function funnel() {
    var f = st.data.funnel, box = clear($('funnel')), n = { landing: 'Landing page', settings: 'Settings', collage: 'Collage page', collage_made: 'Collage made', downloaded: 'Image or poster downloaded' };
    box.appendChild(h('h2', null, 'Funnel')); box.appendChild(h('p', 'sub', 'Person-days that reached each step, as a share of the landing page.'));
    var base = f[0].n || Math.max.apply(null, f.map(function (x) { return x.n; }));
    if (!base) { box.appendChild(h('div', 'empty', 'Nothing yet.')); return; }
    f.forEach(function (x) {
      var row = h('div', 'bar'); row.appendChild(h('span', 'name', n[x.k]));
      var tr = h('span', 'track'), fl = h('span', 'fill'); fl.style.width = Math.min(100, x.n / base * 100) + '%'; tr.appendChild(fl); row.appendChild(tr);
      row.appendChild(h('span', 'val', fmt(x.n) + ' · ' + Math.round(x.n / base * 100) + '%')); box.appendChild(row);
    });
  }

  // ---- country panel: shown when a country is chosen (the whole page is already filtered to it) ----
  function panel() {
    var d = st.data, c = $('panel'), cc = d.range.country; c.hidden = !cc; if (!cc) return; clear(c);
    var r = d.rates, g = h('div', 'stats four'), top = h('div', 'row between');
    top.appendChild(h('h2', null, region(cc))); top.appendChild(btn('All countries', 'btn chip', function () { change({ country: '' }); })); c.appendChild(top);
    c.appendChild(h('p', 'sub', 'Person-days in range, this country only. Interface language counts people who switched it; browser language counts visits.'));
    var daily = sv('svg', { class: 'spark', viewBox: '0 0 100 28', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'People per day' }); spark(daily, d.days.map(function (y) { return y.people; })); daily.style.height = '40px'; daily.style.marginBottom = '16px'; c.appendChild(daily);
    var avg = d.days.length ? r.pd / d.days.length : 0;
    stat(g, 'People', avg >= 10 ? fmt(Math.round(avg)) : avg.toFixed(1), 'a day, on average'); stat(g, 'Collage rate', pct(r.collage, r.pd), 'of person-days made a collage');
    stat(g, 'Downloads', perPerson(d.tiles.downloads.value, r.pd), 'per person-day'); stat(g, 'Share rate', pct(r.shared, r.pd), 'of person-days shared'); c.appendChild(g);
    var cols = h('div', 'grid three'); cols.style.marginTop = '16px';
    var b = d.breakdowns;
    [['Top formats', b.formats, cap], ['Browser language', b.browserLanguages, language], ['Interface switched to', b.uiLanguages, language]].forEach(function (x) {
      var col = h('div'); col.appendChild(h('div', 'mono', x[0])).style.marginBottom = '4px';
      bars(col, x[1], { label: x[2], top: 3 }); cols.appendChild(col);
    });
    c.appendChild(cols);
  }

  function cards() {
    var b = st.data.breakdowns, g = clear($('cards')), land = 0, port = 0;
    b.posterSizes.forEach(function (x) { if (/-l$/.test(x.k)) land += x.n; else port += x.n; });
    g.appendChild(card('Image formats', 'Downloads by format.', b.formats, { label: cap }));
    g.appendChild(card('Poster sizes', 'Made: ' + fmt(port) + ' portrait, ' + fmt(land) + ' landscape.', b.posterSizes, { label: poster }));
    g.appendChild(card('Filters used', 'Once per kind per page load.', b.filters, { label: cap }));
    g.appendChild(card('Searches', 'Smart filters vs a bird.', b.search, { label: function (k) { return k === 'smart' ? 'Smart filters' : 'Bird'; } }));
    g.appendChild(card('Interface language', 'Switched to.', b.uiLanguages, { label: language }));
    g.appendChild(card('Browser language', 'Visits, person-days.', b.browserLanguages, { label: language }));
    g.appendChild(card('Devices', 'Person-days.', b.devices, { label: function (k) { return cap(k.replace(/-/g, ' ')); } }));
    var cc = card('Countries', 'Person-days. Tap one to filter the page.', b.countries, { label: region, limit: 15, click: function (x) { change({ country: x.k }); }, mark: function (x) { return x.k === st.country; } });
    cc.classList.add('wide'); g.appendChild(cc);
  }
  function render() {
    var d = st.data; $('content').classList.toggle('go', animate);
    tiles(); panel(); chart(); lastW = $('chart').clientWidth; rates(); launch(); funnel(); cards(); controls(); animate = false;
    $('content').setAttribute('aria-busy', 'false');
    $('sub').textContent = 'Everybird · private · ' + (st.country ? region(st.country) : 'all countries') + ' · days are Pacific from 17 Nov';
    $('stamp').textContent = 'Updated ' + new Date(d.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + dayLabel(d.range.from) + ' to ' + dayLabel(d.range.to);
  }

  // ---- auto-refresh: every 60 s, only while the tab is visible ----
  function auto(on, keep) {
    clearInterval(timer); timer = 0; $('auto').setAttribute('aria-checked', String(on)); if (keep) store('everybird:stats-auto', on ? '1' : '0');
    if (on) timer = setInterval(function () { if (document.visibilityState === 'visible') load(true, true); }, 60000);
  }
  $('auto').onclick = function () { auto($('auto').getAttribute('aria-checked') !== 'true', true); };
  $('refresh').onclick = function () { load(true); };
  document.addEventListener('pointerdown', function (ev) { if (hideTip && !$('chart').contains(ev.target)) hideTip(); });
  var rt, lastW = 0;
  // Redraw on a real width change only: a phone's URL bar collapsing fires resize too, and a redraw would drop a tapped tip.
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var w = $('chart').clientWidth; if (!st.data || w === lastW) return; lastW = w; var a = animate; animate = false; chart(); animate = a; }, 120);
  });
  themeUi(); skeleton(); controls(); auto(store('everybird:stats-auto') === '1'); load();
})();
</script>
</body>
</html>
`
