// Odd taps, odd devices and odd screens in a real browser (WebKit, Safari's engine), from the 2026-10-20 edge pass.
// Run: node tests/edge.test.mjs            (serves this folder on a random port)
//      BASE=https://timothyhadfield.github.io/stratego/ node tests/edge.test.mjs   (checks the live site)
// Needs Playwright from ~/.claude/tools (npm i playwright there). Online-room cases need Firebase and live in
// the edge-pass harness instead (double-tap Create/Join, host closes the room).
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

// ---- a static server for this folder
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

// ---- real-shaped saved data, made by the game's own engine and bots
let seedN = 7;
const rng = () => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
function botGame(maxPly) {
  const g = E.newGame({ variant: 'classic' }, ['You', 'Computer']);
  for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup('classic', 'easy', rng), s) });
  while (g.phase === 'play' && g.ply < maxPly) {
    const s = g.turn, m = Bots.chooseMove(E.publicView(g), E.privateView(g, s), s, 'easy', rng);
    if (!m) { E.apply(g, s, { type: 'resign' }); break; }
    E.apply(g, s, { type: 'move', from: m.from, to: m.to });
  }
  return g;
}
function midGame(n) {
  let g = botGame(n);
  if (g.phase === 'play' && g.turn !== 0) { const m = Bots.chooseMove(E.publicView(g), E.privateView(g, 1), 1, 'easy', rng); E.apply(g, 1, { type: 'move', from: m.from, to: m.to }); }
  return { state: JSON.parse(JSON.stringify(g)), me: 0, level: 'easy' };
}
function finishedGame() {
  const g = botGame(3000);
  if (g.phase !== 'over') E.apply(g, 1, { type: 'resign' });
  const pub = E.publicView(g);
  return { key: 'computer:' + g.gid, opts: pub.opts, layouts: pub.layouts, hist: pub.hist, me: 0, names: pub.names, result: pub.result, mode: 'computer', level: 'easy' };
}
const store = extra => Object.assign({
  settings: { numbering: 'modern', prior: 'real', showOdds: true, scoutStrike: true, twoSq: 3, chase: true, aggressor: false, silent: false, name: '' },
  newGame: { mode: 'computer', level: 'easy', variant: 'classic', color: 0 },
  setups: { classic: null, barrage: null }, local: null, last: null,
  record: { easy: [0, 0], medium: [0, 0], hard: [0, 0] }, inRoom: false,
}, extra || {});

// ---- browser helpers
const browser = await webkit.launch({ headless: true });
const PHONE = { width: 393, height: 659 }, LAND = { width: 659, height: 393 };
async function page(vp, saved, context) {
  const ctx = context || await browser.newContext({ viewport: vp || PHONE, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(400);
  if (saved) { await p.evaluate(s => localStorage.setItem('stratego:v1', JSON.stringify(s)), saved); await p.reload(); await p.waitForTimeout(500); }
  return { p, ctx, errs };
}
const snap = p => p.evaluate(() => { const s = window.__strat.snap(); return s && s.pub ? { phase: s.pub.phase, ply: s.pub.ply, myTurn: s.myTurn } : null; });
const myMove = p => p.evaluate(() => { const s = window.__strat.snap(), E = window.StrEngine; const lm = E.legalMoves(E.fromView(s.pub, s.mine), s.mySeat); return lm.find(m => !s.pub.cells[m[1]]) || lm[0]; });
const tap = (p, sq) => p.click('#g-board .cell[data-sq="' + sq + '"]', { force: true });
const boardW = p => p.evaluate(() => Math.round(document.querySelector('.view.on .bwrap').getBoundingClientRect().width));

let pass = 0, fail = 0;
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null; // e.g. ONLY="Back|Study"
async function check(label, fn) {
  if (ONLY && !ONLY.test(label)) return;
  try { await fn(); pass++; console.log('  PASS  ' + label); }
  catch (e) { fail++; console.log('  FAIL  ' + label + '\n        ' + e.message.split('\n')[0]); }
}

await check('double-tap Ready starts the game without opening the Resign box', async () => {
  const { p, ctx, errs } = await page(PHONE, store());
  await p.click('[data-a="start"]'); await p.waitForTimeout(600);
  await p.dblclick('[data-a="ready"]'); await p.waitForTimeout(800);
  assert.equal((await snap(p)).phase, 'play');
  assert.equal(await p.$('.confirm-back'), null, 'a question box opened');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check('there is a way out of a game before Ready (Quit)', async () => {
  const { p, ctx } = await page(PHONE, store());
  await p.click('[data-a="start"]'); await p.waitForTimeout(600);
  const acts = await p.evaluate(() => [...document.querySelectorAll('#acts-phone [data-a]')].map(b => b.dataset.a));
  assert.ok(acts.includes('quit'), acts.join(','));
  await p.click('#acts-phone [data-a="quit"]'); await p.waitForTimeout(300);
  if (await p.$('.confirm-back')) await p.click('.confirm-back [data-a="yes"]');
  await p.waitForTimeout(400);
  assert.ok(await p.$('[data-a="start"]'), 'back on the new-game screen');
  await ctx.close();
});

await check('a second Hint tap keeps the hint up its full time', async () => {
  const { p, ctx } = await page(PHONE, store({ local: midGame(30) }));
  await p.click('[data-a="hint"]'); await p.waitForTimeout(600);
  await p.click('[data-a="hint"]'); await p.waitForTimeout(2200);
  assert.ok(await p.evaluate(() => !!window.__strat.ui.hint));
  await ctx.close();
});

await check('tapping a piece while the hint shows selects that piece', async () => {
  const { p, ctx } = await page(PHONE, store({ local: midGame(30) }));
  await p.click('[data-a="hint"]'); await p.waitForTimeout(400);
  const hint = await p.evaluate(() => window.__strat.ui.hint);
  const other = await p.evaluate(h => { const s = window.__strat.snap(), E = window.StrEngine; return E.legalMoves(E.fromView(s.pub, s.mine), s.mySeat).find(m => m[0] !== h.from); }, hint);
  await tap(p, other[0]); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const el = document.querySelector('#g-board .pc.sel'); const b = el && el.getBoundingClientRect(); const c = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { sel: window.__strat.ui.sel, drawn: c && c.dataset ? +c.dataset.sq : null }; });
  assert.deepEqual(r, { sel: other[0], drawn: other[0] });
  await ctx.close();
});

await check('Back closes the Resign box', async () => {
  const { p, ctx } = await page(PHONE, store({ local: midGame(30) }));
  await p.click('nav.tabs [data-tab="setup"]'); await p.waitForTimeout(400);
  await p.click('nav.tabs [data-tab="play"]'); await p.waitForTimeout(400);
  await p.click('#acts-phone [data-a="resign"]'); await p.waitForTimeout(300);
  await p.goBack(); await p.waitForTimeout(600);
  assert.equal(await p.$('.confirm-back'), null);
  await ctx.close();
});

await check('Edit setup from a Classic game opens Classic, even after looking at Barrage', async () => {
  const { p, ctx } = await page(PHONE, store());
  await p.click('nav.tabs [data-tab="setup"]'); await p.waitForTimeout(500);
  await p.click('[data-seg="suvariant"] button[data-val="barrage"]'); await p.waitForTimeout(300);
  await p.click('nav.tabs [data-tab="play"]'); await p.waitForTimeout(400);
  await p.click('[data-a="start"]'); await p.waitForTimeout(600);
  await p.click('[data-a="editsetup"]'); await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => document.querySelector('[data-seg="suvariant"] [aria-pressed="true"]').dataset.val), 'classic');
  await ctx.close();
});

await check('a second tab of the same game follows the moves made in the first', async () => {
  const ctx = await browser.newContext({ viewport: PHONE });
  const { p: A } = await page(PHONE, store({ local: midGame(30) }), ctx);
  const B = await ctx.newPage(); await B.goto(BASE); await B.waitForTimeout(600);
  const m = await myMove(A); await tap(A, m[0]); await tap(A, m[1]); await A.waitForTimeout(1600);
  await B.waitForTimeout(500);
  assert.equal((await snap(B)).ply, (await snap(A)).ply);
  await ctx.close();
});

await check('the board is as big as the screen allows (phone 342+, phone sideways 320+)', async () => {
  const { p, ctx } = await page(PHONE, store({ local: midGame(30) }));
  const w = await boardW(p);
  assert.ok(w >= 340, 'phone board ' + w);
  await ctx.close();
  const L = await page(LAND, store({ local: midGame(30) }));
  const wl = await boardW(L.p);
  assert.ok(wl >= 320, 'sideways board ' + wl);
  const fit = await L.p.evaluate(() => { const v = document.querySelector('.view.on').getBoundingClientRect(); return [...document.querySelectorAll('#game button, #game .bframe')].filter(e => e.offsetParent).every(e => { const b = e.getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1; }) && document.documentElement.scrollWidth <= innerWidth + 1; });
  assert.ok(fit, 'something is cut off sideways');
  await L.ctx.close();
});

await check('turning the phone with a piece picked up keeps it and resizes the board', async () => {
  const { p, ctx, errs } = await page(PHONE, store({ local: midGame(30) }));
  const m = await myMove(p); await tap(p, m[0]);
  await p.setViewportSize(LAND); await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => window.__strat.ui.sel), m[0]);
  assert.ok(await boardW(p) > 300, 'board ' + await boardW(p));
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check('a message toast does not block taps on the buttons under it', async () => {
  const { p, ctx } = await page(PHONE, store({ local: midGame(30) }));
  const sq = await p.evaluate(() => { const s = window.__strat.snap(); const b = s.mine.own.find(x => x[1] === 11 || x[1] === 0); return s.pub.cells.findIndex(c => c && c[1] === b[0]); });
  await tap(p, sq); await p.waitForTimeout(300);
  const under = await p.evaluate(() => { const t = document.querySelector('.toast'); if (!t) return 'no toast'; const b = t.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return h && h.closest('.toast') ? 'toast' : 'page'; });
  assert.equal(under, 'page');
  await ctx.close();
});

await check('picking a piece then tapping an enemy keeps the info strip readable', async () => {
  const { p, ctx } = await page(PHONE, store({ local: midGame(30) }));
  const m = await myMove(p); await tap(p, m[0]); await p.waitForTimeout(200);
  const enemy = await p.evaluate(() => window.__strat.snap().pub.cells.findIndex(c => c && c[0] === 1));
  await tap(p, enemy); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const i = document.querySelector('#info-phone'); let hi = 0; for (const c of i.querySelectorAll('*')) { if (!c.offsetParent) continue; hi = Math.max(hi, c.getBoundingClientRect().bottom); } return { content: Math.round(hi), box: Math.round(i.getBoundingClientRect().bottom) }; });
  assert.ok(r.content <= r.box + 1, JSON.stringify(r));
  await ctx.close();
});

await check('Study opens a very long finished game quickly and shows the last move', async () => {
  const last = finishedGame();
  assert.ok(last.hist.length > 1000, 'fixture is a long game: ' + last.hist.length);
  const { p, ctx, errs } = await page(PHONE, store({ last }));
  await p.click('nav.tabs [data-tab="settings"]'); await p.waitForTimeout(400); // first tap starts the sound system
  const ms = await p.evaluate(() => { const t0 = performance.now(); document.querySelector('nav.tabs [data-tab="study"]').click(); return performance.now() - t0; });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ rows: document.querySelectorAll('#st-side tbody tr').length, cur: +(document.querySelector('#st-side tr.cur') || { dataset: {} }).dataset.i }));
  assert.ok(ms < 2500, 'took ' + Math.round(ms) + ' ms (was 6,500)');
  assert.deepEqual(r, { rows: last.hist.length, cur: last.hist.length });
  assert.deepEqual(errs, []);
  await ctx.close();
});

await browser.close();
if (server) server.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
