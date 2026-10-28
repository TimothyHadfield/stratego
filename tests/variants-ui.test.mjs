// Wave 3 (2026-10-28) in a real browser (WebKit, Safari's engine): Rescue and One-time Bombs switches, the rescue
// chooser on the board, Computer speed, and the Videos list in the Rules sheet.
// Run: node tests/variants-ui.test.mjs   (serves this folder on a random port; BASE=<url> checks a live site)
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
const Odds = require('../js/odds.js');
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

// A real game (both armies from the game's own setups, 40 pieces each) played a while by two Easy computers with
// Rescue on, then arranged so Red's Captain stands one step from Blue's back row with Red's Marshal and a
// Sergeant among its captured pieces and Red to move.
function rescueGame() {
  const rng = Odds.mulberry(42);
  const g = E.newGame({ variant: 'classic', rescue: true }, ['You', 'Computer']);
  for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup('classic', 'easy', rng), s) });
  for (let i = 0; i < 60 && g.phase === 'play'; i++) {
    const s = g.turn;
    if (g.pend) { E.apply(g, s, { type: 'rescue', skip: true }); continue; }
    const m = Bots.chooseMove(E.publicView(g), E.privateView(g, s), s, 'easy', rng);
    E.apply(g, s, { type: 'move', from: m.from, to: m.to });
  }
  const red = id => g.pieces[id] && g.pieces[id].o === 0;
  const take = (r) => { const id = g.pieces.findIndex((p, i) => p && red(i) && p.r === r && p.pos >= 0); const p = g.pieces[id]; g.board[p.pos] = -1; p.pos = -1; p.rv = 1; return id; };
  take(E.MARSHAL); take(E.SERGEANT);
  // clear a lane: square 13 (b9 for Red) holds our Captain, square 3 (Blue back row) is empty
  // pick a column whose two top squares hold no Blue Flag; empty them
  let c = 0;
  while ([c, 10 + c].some(sq => g.board[sq] >= 0 && g.pieces[g.board[sq]].r === E.FLAG)) c++;
  for (const sq of [c, 10 + c]) { const id = g.board[sq]; if (id >= 0) { g.pieces[id].pos = -1; g.board[sq] = -1; } }
  const cap = g.pieces.findIndex((p, i) => p && red(i) && p.r === E.CAPTAIN && p.pos >= 0);
  g.board[g.pieces[cap].pos] = -1; g.pieces[cap].pos = 10 + c; g.board[10 + c] = cap;
  g.turn = 0; g.pend = null; g.streak = [null, null]; g.last = [null, null]; g.chase = null;
  return { state: JSON.parse(JSON.stringify(g)), me: 0, level: 'medium', from: 10 + c, to: c };
}
const store = extra => Object.assign({
  settings: { numbering: 'modern', prior: 'real', showOdds: true, scoutStrike: true, twoSq: 3, chase: true, aggressor: false, silent: false, name: '' },
  newGame: { mode: 'computer', level: 'medium', variant: 'classic', color: 0 },
  setups: { classic: null, barrage: null }, local: null, last: null,
  record: { easy: [0, 0], medium: [0, 0], hard: [0, 0] }, inRoom: false,
}, extra || {});

const browser = await webkit.launch({ headless: true });
const PHONE = { width: 393, height: 659 }, SMALL = { width: 320, height: 568 };
async function page(vp, saved) {
  const ctx = await browser.newContext({ viewport: vp || PHONE, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(400);
  await p.evaluate(s => { localStorage.setItem('coach-offer:stratego-first', 'true'); if (s) localStorage.setItem('stratego:v1', JSON.stringify(s)); }, saved || null);
  await p.reload(); await p.waitForTimeout(500);
  return { p, ctx, errs };
}
const tap = (p, sq) => p.click('#g-board .cell[data-sq="' + sq + '"]', { force: true });

let pass = 0, fail = 0;
async function check(label, fn) {
  try { await fn(); pass++; console.log('  PASS  ' + label); }
  catch (e) { fail++; console.log('  FAIL  ' + label + '\n        ' + e.message.split('\n')[0]); }
}

await check('Settings has Rescue, One-time Bombs (off) and Computer speed; switching Rescue on reaches the new-game line', async () => {
  const { p, ctx, errs } = await page(PHONE, store());
  await p.click('nav.tabs [data-tab="settings"]'); await p.waitForTimeout(300);
  for (const k of ['rescue', 'bombOnce']) assert.equal(await p.$eval('[data-sw="' + k + '"]', i => i.checked), false, k + ' off by default');
  assert.ok(await p.$('[data-seg="botSpeed"] [data-val="fast"]'), 'speed buttons');
  await p.click('[data-seg="botSpeed"] [data-val="fast"]');
  await p.$eval('[data-sw="rescue"]', i => { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  const s = await p.evaluate(() => JSON.parse(localStorage.getItem('stratego:v1')).settings);
  assert.equal(s.rescue, true); assert.equal(s.botSpeed, 'fast');
  await p.click('nav.tabs [data-tab="play"]'); await p.waitForTimeout(300);
  assert.match(await p.textContent('.ngnote'), /Rules on: Rescue/);
  await p.click('[data-a="start"]'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__strat.snap().pub.opts.rescue), true, 'the new game plays with Rescue');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check('reaching their back row: choose a lost piece, tap a square, it stands there and the computer moves', async () => {
  const L = rescueGame();
  const { p, ctx, errs } = await page(PHONE, store({ settings: Object.assign(store().settings, { rescue: true }), local: { state: L.state, me: 0, level: 'medium' } }));
  await tap(p, L.from); await p.waitForTimeout(200);
  await tap(p, L.to); await p.waitForTimeout(500);
  assert.match(await p.textContent('#g-status'), /Rescue a piece\?/);
  const ranks = await p.$$eval('#info-phone [data-a="rsr"]', bs => bs.map(b => +b.dataset.r));
  assert.ok(ranks[0] === 10 && ranks.includes(4) && !ranks.includes(11) && ranks.every((r, i) => !i || ranks[i - 1] > r), 'Marshal first, Sergeant too, no Bomb, highest first: ' + ranks);
  assert.ok(await p.$('#acts-phone [data-a="rskip"]'), 'No rescue button');
  // the chooser is on screen without scrolling
  const box = await p.$eval('#info-phone [data-a="rsr"]', b => { const r = b.getBoundingClientRect(); return [r.top, r.bottom]; });
  assert.ok(box[0] >= 0 && box[1] <= 659, 'chooser visible: ' + box);
  await p.click('#info-phone [data-a="rsr"][data-r="10"]'); await p.waitForTimeout(250);
  assert.ok(await p.evaluate(() => document.querySelectorAll('#g-board .cell.dest').length > 5), 'free squares on my half are marked');
  const freeSq = await p.evaluate(() => { const s = window.__strat.snap(); for (let q = 50; q < 100; q++) if (!s.pub.cells[q] && !window.StrEngine.IS_LAKE[q]) return q; });
  await tap(p, freeSq); await p.waitForTimeout(400);
  const after = await p.evaluate(sq => { const s = window.__strat.snap(); return { cell: s.pub.cells[sq], pend: s.pub.pend, resc: s.pub.resc }; }, freeSq);
  assert.equal(after.cell[2], 10, 'Marshal stands on the chosen square');
  assert.equal(after.pend, null);
  assert.deepEqual(after.resc, [1, 0]);
  await p.waitForTimeout(1500); // the computer answers
  assert.equal(await p.evaluate(() => window.__strat.snap().myTurn), true, 'the computer moved and it is our turn again');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check('No rescue skips it; the turn passes', async () => {
  const L = rescueGame();
  const { p, ctx, errs } = await page(PHONE, store({ local: { state: L.state, me: 0, level: 'medium' } }));
  await tap(p, L.from); await p.waitForTimeout(200);
  await tap(p, L.to); await p.waitForTimeout(700);
  await p.click('#acts-phone [data-a="rskip"]'); await p.waitForTimeout(300);
  const s = await p.evaluate(() => { const s = window.__strat.snap(); return { pend: s.pub.pend, resc: s.pub.resc, turn: s.pub.turn, ply: s.pub.ply }; });
  assert.equal(s.pend, null); assert.deepEqual(s.resc, [0, 0]);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check('320 px: the rescue chooser and Settings fit with no sideways scroll', async () => {
  const L = rescueGame();
  const { p, ctx, errs } = await page(SMALL, store({ local: { state: L.state, me: 0, level: 'medium' } }));
  await tap(p, L.from); await p.waitForTimeout(200);
  await tap(p, L.to); await p.waitForTimeout(600);
  const fit = await p.$$eval('#info-phone [data-a="rsr"]', bs => bs.every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
  assert.ok(fit, 'chooser buttons inside the screen');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on Play');
  await p.click('#acts-phone [data-a="rskip"]'); await p.waitForTimeout(700);
  await p.click('nav.tabs [data-tab="settings"]'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on Settings');
  assert.ok(await p.evaluate(() => { const v = document.querySelector('#v-settings .set'); return v.scrollWidth <= v.clientWidth; }), 'Settings panel not wider than its scroller');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check('Rules sheet: Videos section with real YouTube links that open in a new tab', async () => {
  const { p, ctx, errs } = await page(PHONE, store());
  await p.click('[data-a="rules"]'); await p.waitForTimeout(500);
  const links = await p.$$eval('.coach-rules a[href*="youtube.com/watch"]', as => as.map(a => [a.href, a.target, a.rel, getComputedStyle(a).color]));
  assert.ok(links.length >= 2 && links.length <= 5, links.length + ' video links');
  for (const [, t, r] of links) { assert.equal(t, '_blank'); assert.match(r, /noopener/); }
  assert.notEqual(links[0][3], 'rgb(169, 157, 255)', 'link colour readable on the cream sheet');
  assert.match(await p.textContent('.coach-rules'), /Rescue/);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await browser.close();
if (server) server.close();
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
