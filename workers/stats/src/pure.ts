// The dashboard page's small pure functions, as the plain JavaScript the page inlines. One source: page.ts
// embeds this string, and tests/stats-dashboard.test.ts evaluates the same string, so nothing is duplicated.
// ES5, no backticks and no ${} (String.raw below), and no reliance on the page.
export const PURE_JS = String.raw`
var RANGE_DAYS = [1, 7, 14, 30];
var METRIC_KEYS = ['people', 'collages', 'downloads', 'shares', 'posters'];

/* The URL hash keeps the view: #r=7&c=MX&m=collages&cmp=1. Defaults (14 days, all countries, people, no compare) are left out. */
function parseHash(hash) {
  var q = {}, s = { days: 14, all: false, country: '', metric: 'people', compare: false };
  String(hash || '').replace(/^#/, '').split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1); });
  if (q.r === 'all') s.all = true; else if (RANGE_DAYS.indexOf(Number(q.r)) >= 0) s.days = Number(q.r);
  if (/^[A-Za-z]{2}$/.test(q.c || '')) s.country = q.c.toUpperCase();
  if (METRIC_KEYS.indexOf(q.m) >= 0) s.metric = q.m;
  s.compare = q.cmp === '1' && !s.all; // "All" has no previous period
  return s;
}
function serializeHash(s) {
  var a = [];
  if (s.all) a.push('r=all'); else if (s.days !== 14) a.push('r=' + s.days);
  if (s.country) a.push('c=' + s.country);
  if (s.metric !== 'people') a.push('m=' + s.metric);
  if (s.compare && !s.all) a.push('cmp=1');
  return a.length ? '#' + a.join('&') : '';
}

/* America/Vancouver calendar dates in the browser, the same rule as event.ts pacificDay: the Pacific date of an instant
   (ms), and day arithmetic on a YYYY-MM-DD string (no 24-hour steps, so daylight saving can't shift a day). */
var PACIFIC_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' });
function pacificDay(ms) {
  var p = {};
  PACIFIC_FMT.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}
function addDays(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }

/* The daily series as CSV (one row per day). */
var CSV_COLUMNS = ['d', 'people', 'collages', 'images', 'posterDownloads', 'downloads', 'shares', 'posters'];
function csvCell(v) { var t = String(v == null ? '' : v); return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
function buildCsv(days, country) {
  var rows = [['date', 'country', 'people', 'collages', 'images', 'poster_downloads', 'downloads', 'shares', 'posters'].join(',')];
  days.forEach(function (x) { rows.push([x.d, country || 'all'].concat(CSV_COLUMNS.slice(1).map(function (k) { return x[k] || 0; })).map(csvCell).join(',')); });
  return rows.join('\n') + '\n';
}

/* A sentence that is true and safe to post: strictly below the count, rounded down (two significant figures from 100 up, tens below that). */
function floorNice(m) {
  if (m < 10) return m;
  if (m < 100) return Math.floor(m / 10) * 10;
  var p = Math.pow(10, String(Math.floor(m)).length - 2);
  return Math.floor(m / p) * p;
}
function safeClaim(n, what) {
  n = Math.floor(Number(n));
  if (!(n > 2)) return '';
  return 'More than ' + floorNice(n - 1).toLocaleString('en-US') + ' ' + what + '.';
}

/* A share as text: one decimal under 10%, whole above; a dash when nothing to divide by. */
function pct(a, b) {
  if (!b) return '–';
  var v = a / b * 100;
  return (v < 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v))) + '%';
}
function perPerson(a, b) { return b ? (a / b).toFixed(2) : '–'; }
/* Change against the previous period: dir is up, down, flat, new or none. */
function deltaInfo(v, p) {
  if (!p) return { dir: v ? 'new' : 'none', pct: 0 };
  var d = Math.round((v - p) / p * 100);
  return { dir: d > 0 ? 'up' : d < 0 ? 'down' : 'flat', pct: Math.abs(d) };
}
`
