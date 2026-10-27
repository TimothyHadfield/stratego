// Can a player see what's happening? Board size, readable ranks, no jumps, the removed-piece margins,
// and taps on the tilted laptop board. From the 2026-10-21 visibility pass. WebKit (Safari's engine)
// for the phone, Chrome for the laptop tilt (headless WebKit draws the tilt flat).
// Run: node tests/visibility.test.mjs            (serves this folder on a random port)
//      BASE=https://timothyhadfield.github.io/stratego/ node tests/visibility.test.mjs   (checks the live site)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const E = require('../js/engine.js');
const Bots = require('../js/bots.js');
const { webkit, chromium } = createRequire(join(homedir(), '.claude/tools/') + 'x.js')('playwright');

let server = null, BASE = process.env.BASE;
if (!BASE) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
  server = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    try { const body = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(body); }
    catch (e) { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(20000 + Math.floor(Math.random() * 20000), '127.0.0.1', r));
  BASE = 'http://127.0.0.1:' + server.address().port + '/';
}

// ---- real-shaped saved games, played by the game's own bots
let seedN = 7;
const rng = () => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
function game(n) {
  const g = E.newGame({ variant: 'classic' }, ['You', 'Computer']);
  for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup('classic', 'easy', rng), s) });
  while (g.phase === 'play' && g.ply < n) {
    const s = g.turn, m = Bots.chooseMove(E.publicView(g), E.privateView(g, s), s, 'easy', rng);
    E.apply(g, s, { type: 'move', from: m.from, to: m.to });
  }
  if (g.phase === 'play' && g.turn !== 0) { const m = Bots.chooseMove(E.publicView(g), E.privateView(g, 1), 1, 'easy', rng); E.apply(g, 1, { type: 'move', from: m.from, to: m.to }); }
  return g;
}
const MID = { state: JSON.parse(JSON.stringify(game(50))), me: 0, level: 'easy' };
// late game: most of both armies gone (both margins crowded), still being played
let lateG = null;
for (let n = 260; n < 900 && !lateG; n += 40) { const g = game(n); if (g.phase === 'play' && E.publicView(g).dead.length >= 30) lateG = g; }
const LATE = { state: JSON.parse(JSON.stringify(lateG)), me: 0, level: 'easy' };
const store = extra => Object.assign({
  settings: { numbering: 'modern', prior: 'real', showOdds: true, scoutStrike: true, twoSq: 3, chase: true, aggressor: false, silent: false, name: '' },
  newGame: { mode: 'computer', level: 'easy', variant: 'classic', color: 0 },
  setups: { classic: null, barrage: null }, local: null, last: null,
  record: { easy: [0, 0], medium: [0, 0], hard: [0, 0] }, inRoom: false,
}, extra || {});
const finished = () => {
  const g = game(120); E.apply(g, 1, { type: 'resign' });
  const pub = E.publicView(g);
  return { key: 'computer:' + g.gid, opts: pub.opts, layouts: pub.layouts, hist: pub.hist, me: 0, names: pub.names, result: pub.result, mode: 'computer', level: 'easy' };
};

const wk = await webkit.launch({ headless: true });
let ch = null;
try { ch = await chromium.launch({ channel: 'chrome', headless: true }); } catch (e) { console.log('  (Chrome not found: the tilt check runs in WebKit only)'); }
const PHONE = { width: 393, height: 659 }, SE = { width: 320, height: 568 }, LAND = { width: 659, height: 393 }, LAPTOP = { width: 1280, height: 800 };
async function page(vp, saved, br) {
  const phone = vp.width < 900;
  const ctx = await (br || wk).newContext({ viewport: vp, ...(phone && (br || wk) === wk ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(400);
  if (saved) { await p.evaluate(s => localStorage.setItem('stratego:v1', JSON.stringify(s)), saved); await p.reload(); await p.waitForTimeout(600); }
  return { p, ctx, errs };
}
const boardW = p => p.evaluate(() => document.querySelector('.view.on .bwrap').offsetWidth);
const tap = (p, sq) => p.click('#g-board .cell[data-sq="' + sq + '"]', { force: true });
// the smallest rank number printed on a piece, in screen px (svg width / 40 x font-size)
const minRankPx = (p, sel) => p.evaluate(sel => Math.min(...[...document.querySelectorAll(sel)].map(t => t.ownerSVGElement.getBoundingClientRect().width / 40 * +t.getAttribute('font-size'))), sel);

let pass = 0, fail = 0;
async function check(label, fn) {
  try { await fn(); pass++; console.log('  PASS  ' + label); }
  catch (e) { fail++; console.log('  FAIL  ' + label + '\n        ' + e.message.split('\n')[0]); }
}

await check('phone: the board is 350px+ and keeps its size when pieces are tapped', async () => {
  const { p, ctx, errs } = await page(PHONE, store({ local: MID }));
  const w0 = await boardW(p);
  const m = await p.evaluate(() => { const s = window.__strat.snap(), E = window.StrEngine; return E.legalMoves(E.fromView(s.pub, s.mine), s.mySeat)[0]; });
  await tap(p, m[0]); await p.waitForTimeout(300);
  const w1 = await boardW(p);
  const enemy = await p.evaluate(() => window.__strat.snap().pub.cells.findIndex(c => c && c[0] === 1 && c[2] === null));
  await tap(p, enemy); await p.waitForTimeout(300);
  const w2 = await boardW(p);
  assert.ok(w0 >= 350, 'board ' + w0);
  assert.deepEqual([w1, w2], [w0, w0], 'board size changed on a tap');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check('phone: rank numbers print at 12px+, odds badges at 12px+ and inside their square', async () => {
  const { p, ctx } = await page(PHONE, store({ local: MID }));
  const r = await minRankPx(p, '#g-board .pc svg text');
  assert.ok(r >= 12, 'rank number ' + r.toFixed(1) + 'px');
  const b = await p.evaluate(() => { const cell = document.querySelector('#g-board .cell').getBoundingClientRect().width; return [...document.querySelectorAll('#g-board .pc .badge')].map(x => ({ f: parseFloat(getComputedStyle(x).fontSize), w: x.getBoundingClientRect().width, cell })); });
  assert.ok(b.length > 5, 'badges ' + b.length);
  assert.ok(b.every(x => x.f >= 12), 'badge font ' + Math.min(...b.map(x => x.f)));
  assert.ok(b.every(x => x.w <= x.cell), 'a badge is wider than its square');
  await ctx.close();
});

await check('phone: the odds and hint buttons are on screen, next to Resign', async () => {
  const { p, ctx } = await page(PHONE, store({ local: MID }));
  const r = await p.evaluate(() => ['odds', 'hint', 'resign'].map(a => { const e = document.querySelector('#v-play [data-a="' + a + '"]'); if (!e || !e.offsetParent) return a + ' missing'; const b = e.getBoundingClientRect(); return b.bottom <= innerHeight && b.height >= 40 ? 'ok' : a + ' ' + Math.round(b.height) + 'px'; }));
  assert.deepEqual(r, ['ok', 'ok', 'ok']);
  await ctx.close();
});

await check('phone: a tap on the removed-piece margin shows them 30px+ tall, on screen', async () => {
  const { p, ctx, errs } = await page(PHONE, store({ local: LATE }));
  await p.click('#grave-near', { force: true }); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const pp = document.querySelector('.pop'); if (!pp) return null; const b = pp.getBoundingClientRect(); const s = [...pp.querySelectorAll('.gb i')].map(i => i.getBoundingClientRect().height); return { n: s.length, min: Math.min(...s), on: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight }; });
  assert.ok(r, 'nothing opened');
  assert.ok(r.n >= 10 && r.min >= 30 && r.on, JSON.stringify(r));
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check('small phone (320x568): board 265px+, rank numbers about 10px', async () => {
  const { p, ctx } = await page(SE, store({ local: MID }));
  const w = await boardW(p);
  assert.ok(w >= 265, 'board ' + w);
  const r = await minRankPx(p, '#g-board .pc svg text');
  assert.ok(r >= 9.8, 'rank number ' + r.toFixed(1));
  const wide = await p.evaluate(() => { const cell = document.querySelector('#g-board .cell').getBoundingClientRect().width; return [...document.querySelectorAll('#g-board .pc .badge')].filter(x => x.getBoundingClientRect().width > cell).length; });
  assert.equal(wide, 0, wide + ' odds badges are wider than their square');
  await ctx.close();
});

await check('phone Study: board 285px+', async () => {
  const { p, ctx } = await page(PHONE, store({ last: finished() }));
  await p.click('nav.tabs [data-tab="study"]'); await p.waitForTimeout(1200);
  const w = await boardW(p);
  assert.ok(w >= 285, 'study board ' + w);
  await ctx.close();
});

await check('phone sideways: their-army pieces 28px+', async () => {
  const { p, ctx } = await page(LAND, store({ local: MID }));
  const m = await p.evaluate(() => Math.round(document.querySelector('#info-phone .rk .mini').getBoundingClientRect().width));
  assert.ok(m >= 28, 'mini ' + m);
  await ctx.close();
});

await check('turning the phone moves the odds/hint buttons (button row upright, beside the board sideways) and back', async () => {
  const { p, ctx, errs } = await page(PHONE, store({ local: MID }));
  const where = () => p.evaluate(() => { const o = document.querySelector('#v-play [data-a="odds"]'); return o ? o.parentElement.id : 'none'; });
  const a = await where();
  await p.setViewportSize(LAND); await p.waitForTimeout(600);
  const b = await where();
  await p.setViewportSize(PHONE); await p.waitForTimeout(600);
  const c = await where();
  assert.deepEqual([a, b, c], ['acts-phone', 'g-status', 'acts-phone']);
  assert.ok(await boardW(p) >= 350, 'board after turning back ' + await boardW(p));
  assert.deepEqual(errs, []);
  await ctx.close();
});

for (const [name, br] of [['Chrome', ch], ['WebKit', wk]]) {
  if (!br) continue;
  await check('laptop 1280x800 (' + name + '): board 660px+, all of the tilted board on screen, every square takes its own tap', async () => {
    const { p, ctx, errs } = await page(LAPTOP, store({ local: MID }), br);
    const w = await boardW(p);
    assert.ok(w >= 660, 'board ' + w);
    const r = await p.evaluate(() => {
      const f = document.querySelector('.bframe').getBoundingClientRect(), nav = document.querySelector('nav.tabs').getBoundingClientRect();
      let bad = [];
      for (const c of document.querySelectorAll('#g-board .cell')) { const b = c.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); const hc = h && h.closest('.cell'); if (!hc || hc.dataset.sq !== c.dataset.sq) bad.push(c.dataset.sq); }
      return { top: Math.round(f.top), nav: Math.round(nav.bottom), bottom: Math.round(f.bottom), vh: innerHeight, bad: bad.length, cells: document.querySelectorAll('#g-board .cell').length };
    });
    assert.ok(r.top >= r.nav && r.bottom <= r.vh, 'frame ' + r.top + '..' + r.bottom + ' (nav ends ' + r.nav + ', screen ' + r.vh + ')');
    assert.equal(r.cells, 92);
    assert.equal(r.bad, 0, r.bad + ' squares take the wrong tap');
    const mini = await p.evaluate(() => Math.round(document.querySelector('#army-side .rk .mini').getBoundingClientRect().width));
    assert.ok(mini >= 36, 'their-army piece ' + mini);
    assert.deepEqual(errs, []);
    await ctx.close();
  });
}

await wk.close();
if (ch) await ch.close();
if (server) server.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
