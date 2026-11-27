// Fit pass (2026-11-27): can a player see everything at every screen size, in a crowded game?
// Setup tray (all 40 pieces), a late game with 30+ pieces removed, and the "their army left" list,
// at 393x659, 320x568, 659x393 (sideways), 1280x800 and 1440x900. WebKit (Safari's engine).
// Run: node tests/fit-ui.mjs            (serves this folder on a random port)
//      BASE=https://timothyhadfield.github.io/stratego/ node tests/fit-ui.mjs
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
const { webkit } = createRequire(join(homedir(), '.claude/tools/') + 'x.js')('playwright');

let server = null, BASE = process.env.BASE;
if (!BASE) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
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
let lateG = null;
for (let n = 260; n < 900 && !lateG; n += 40) { const g = game(n); if (g.phase === 'play' && E.publicView(g).dead.length >= 30) lateG = g; }
const LATE = { state: JSON.parse(JSON.stringify(lateG)), me: 0, level: 'easy' };
// a game still in its setup phase: the Setup tab shows all 40 pieces with "Back to game"
const SETUPG = { state: JSON.parse(JSON.stringify(E.newGame({ variant: 'classic' }, ['You', 'Computer']))), me: 0, level: 'easy' };
const store = extra => Object.assign({
  settings: { numbering: 'modern', prior: 'real', showOdds: true, scoutStrike: true, twoSq: 3, chase: true, aggressor: false, silent: false, name: '' },
  newGame: { mode: 'computer', level: 'easy', variant: 'classic', color: 0 },
  setups: { classic: null, barrage: null }, local: null, last: null,
  record: { easy: [0, 0], medium: [0, 0], hard: [0, 0] }, inRoom: false,
}, extra || {});

const wk = await webkit.launch({ headless: true });
const SIZES = { phone: { width: 393, height: 659 }, se: { width: 320, height: 568 }, side: { width: 659, height: 393 }, laptop: { width: 1280, height: 800 }, wide: { width: 1440, height: 900 } };
async function page(vp, saved, tab) {
  const phone = vp.width < 900;
  const ctx = await wk.newContext({ viewport: vp, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE); await p.waitForTimeout(400);
  await p.evaluate(s => { localStorage.setItem('stratego:v1', JSON.stringify(s)); localStorage.setItem('coach-offer:stratego-first', 'true'); }, saved);
  await p.reload(); await p.waitForTimeout(700);
  if (tab) { await p.click('nav.tabs [data-tab="' + tab + '"]'); await p.waitForTimeout(700); }
  return { p, ctx, errs };
}
// the smallest rank number printed on a piece, in screen px (svg width / viewBox width x font-size)
const minRankPx = (p, sel) => p.evaluate(sel => {
  const a = [...document.querySelectorAll(sel)].filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.ownerSVGElement.getBoundingClientRect().width / t.ownerSVGElement.viewBox.baseVal.width * parseFloat(getComputedStyle(t).fontSize));
  return a.length ? Math.min(...a) : 0;
}, sel);
const pageScroll = p => p.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));

let pass = 0, fail = 0;
async function check(label, fn) {
  try { await fn(); pass++; console.log('  PASS  ' + label); }
  catch (e) { fail++; console.log('  FAIL  ' + label + '\n        ' + e.message.split('\n')[0]); }
}

// ---- the setup tray: all 40 pieces readable, its buttons in one row, no page scroll
for (const [name, vp] of [['phone', SIZES.phone], ['320x568', SIZES.se], ['sideways 659x393', SIZES.side], ['laptop', SIZES.laptop]]) {
  await check(name + ' Setup tab: 40 pieces with 12px+ rank numbers, the four tool buttons in one row, all on screen', async () => {
    const { p, ctx, errs } = await page(vp, store({ local: SETUPG }), 'setup');
    const r = await minRankPx(p, '#sugrid svg text');
    assert.ok(r >= 12, 'tray rank number ' + r.toFixed(1) + 'px');
    const t = await p.evaluate(() => {
      const bs = [...document.querySelectorAll('.sutools .btn')].map(b => b.getBoundingClientRect());
      const g = document.querySelector('#sugrid').getBoundingClientRect();
      const heat = document.querySelector('.heatpick') && document.querySelector('.heatpick').getBoundingClientRect();
      return { n: document.querySelectorAll('#sugrid .sucell').length, rows: new Set(bs.map(b => Math.round(b.top))).size, minH: Math.min(...bs.map(b => b.height)),
        bottom: Math.max(g.bottom, ...bs.map(b => b.bottom), heat ? heat.bottom : 0), vh: innerHeight, nav: document.querySelector('nav.tabs').getBoundingClientRect() };
    });
    assert.equal(t.n, 40);
    assert.equal(t.rows, 1, 'tool buttons on ' + t.rows + ' rows');
    assert.ok(t.minH >= 36, 'tool button ' + t.minH + 'px tall');
    // above the bottom tab bar on an upright phone, inside the screen otherwise
    const limit = t.nav.top > t.vh / 2 ? t.nav.top : t.vh;
    assert.ok(t.bottom <= limit, 'tray/tools/heat row end at ' + Math.round(t.bottom) + ', visible area ends ' + Math.round(limit));
    assert.deepEqual(await pageScroll(p), { x: 0, y: 0 });
    assert.deepEqual(errs, []);
    await ctx.close();
  });
}

// ---- their army left (the captured list): readable rank numbers, nothing clipped
for (const [name, vp, min] of [['phone', SIZES.phone, 12], ['sideways 659x393', SIZES.side, 12], ['laptop', SIZES.laptop, 12], ['320x568', SIZES.se, 10.5]]) {
  await check(name + ' late game: "their army left" pieces print their rank at ' + min + 'px+, counts not clipped', async () => {
    const { p, ctx, errs } = await page(vp, store({ local: LATE }));
    const box = vp.width >= 900 ? '#army-side' : '#info-phone';
    const r = await minRankPx(p, box + ' .rk .mini svg text');
    assert.ok(r >= min, 'army rank number ' + r.toFixed(1) + 'px');
    const c = await p.evaluate(box => {
      const host = document.querySelector(box).getBoundingClientRect();
      const bad = [...document.querySelectorAll(box + ' .rk b, ' + box + ' .rk span')].filter(e => { const b = e.getBoundingClientRect(); return b.bottom > host.bottom + 0.5 || b.top < host.top; }).length;
      return { bad, counts: Math.min(...[...document.querySelectorAll(box + ' .rk b')].map(e => parseFloat(getComputedStyle(e).fontSize))) };
    }, box);
    assert.equal(c.bad, 0, c.bad + ' counts cut off by the panel');
    assert.ok(c.counts >= 12, 'count ' + c.counts + 'px');
    assert.deepEqual(errs, []);
    await ctx.close();
  });
}

// ---- the removed-piece margins: counts readable, every stack inside the margin
for (const [name, vp] of [['phone', SIZES.phone], ['320x568', SIZES.se], ['sideways 659x393', SIZES.side], ['laptop', SIZES.laptop]]) {
  await check(name + ' late game: removed-piece counts 12px+, all stacks inside the board margin', async () => {
    const { p, ctx } = await page(vp, store({ local: LATE }));
    const g = await p.evaluate(() => [...document.querySelectorAll('.grave')].map(gr => {
      const host = gr.getBoundingClientRect();
      const items = [...gr.querySelectorAll('.gs, .gs b')].map(e => e.getBoundingClientRect());
      return { n: gr.querySelectorAll('.gs').length, out: items.filter(b => b.right > host.right + 0.5 || b.left < host.left - 0.5).length,
        font: Math.min(...[...gr.querySelectorAll('.gs b')].map(b => parseFloat(getComputedStyle(b).fontSize))) };
    }));
    assert.ok(g.every(x => x.n >= 5), 'stacks ' + g.map(x => x.n));
    assert.ok(g.every(x => x.out === 0), 'stacks cut off: ' + g.map(x => x.out));
    assert.ok(g.every(x => x.font >= 12), 'count font ' + g.map(x => x.font));
    await ctx.close();
  });
}

// ---- every size, every crowded state: the board as big as the screen allows, no page scroll
for (const [name, vp] of Object.entries(SIZES)) {
  await check(name + ': board fills the free height, pieces readable, no page scroll (early + late game)', async () => {
    for (const st of [MID, LATE]) {
      const { p, ctx, errs } = await page(vp, store({ local: st }));
      const r = await minRankPx(p, '#g-board .pc svg text');
      assert.ok(r >= (vp.width < 360 ? 9.8 : 12), 'board rank number ' + r.toFixed(1) + 'px');
      const b = await p.evaluate(() => {
        const f = document.querySelector('.bframe').getBoundingClientRect(), w = document.querySelector('.bwrap').offsetWidth;
        const nav = document.querySelector('nav.tabs').getBoundingClientRect();
        return { w, top: f.top, bottom: f.bottom, vh: innerHeight, vw: innerWidth, navTop: nav.top };
      });
      // the board is the biggest thing: at least 60% of the short side of the screen (wide screens: of the height)
      const short = Math.min(b.vw, b.vh);
      assert.ok(b.w >= 0.6 * short, 'board ' + b.w + 'px on a ' + b.vw + 'x' + b.vh + ' screen');
      assert.ok(b.bottom <= b.vh + 0.5, 'board frame ends at ' + Math.round(b.bottom));
      assert.deepEqual(await pageScroll(p), { x: 0, y: 0 });
      assert.deepEqual(errs, []);
      await ctx.close();
    }
  });
}

await wk.close();
if (server) server.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
