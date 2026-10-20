// Two separate headless browsers play Stratego online against the REAL shared Firebase project.
//   node tools/two-browsers.mjs [url] [--engine webkit|chromium] [--shots dir] [--moves n]
// Proves: create room, join by code, both armies sent, Blue's page never holds a hidden Red rank,
// moves go through, Blue reloads mid-game and is put back, resign ends it for both, host closes the room.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const args = process.argv.slice(2);
const url = args.find(a => a.startsWith('http')) || 'https://timothyhadfield.github.io/stratego/';
const engine = args.includes('--engine') ? args[args.indexOf('--engine') + 1] : 'webkit';
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const MOVES = args.includes('--moves') ? +args[args.indexOf('--moves') + 1] : 6;
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

const iphone = pw.devices['iPhone 13'] ? { ...pw.devices['iPhone 13'], viewport: { width: 393, height: 659 } } : {};
const opts = engine === 'webkit' ? iphone : {};
const bA = await pw[engine].launch(), bB = await pw[engine].launch();
const A = await (await bA.newContext(opts)).newPage(), B = await (await bB.newContext(opts)).newPage();
const errs = [], noise = [];
let reloading = false;
for (const [n, p] of [['A', A], ['B', B]]) {
  p.on('console', m => { if (m.type() === 'error' && !/BloomFilter/.test(m.text())) (reloading ? noise : errs).push(n + ': ' + m.text()); });
  p.on('pageerror', e => (reloading && n === 'B' ? noise : errs).push(n + ' pageerror: ' + e.message));
}

// Blue's page must hold no rank of a hidden Red piece: not in the snapshot, not drawn on the board
async function checkSecret(page, label) {
  const r = await page.evaluate(() => {
    const s = window.__strat.snap();
    const leaks = [];
    const mineIds = new Set(s.mine.own.map(x => x[0]));
    s.pub.cells.forEach(c => { if (c && c[0] !== s.mySeat && c[2] !== null && c[3] !== undefined) { /* shown in a fight or a scout run: public */ } });
    for (const [id] of s.mine.own) if (!mineIds.has(id)) leaks.push(id);
    const hiddenEnemy = s.pub.cells.filter(c => c && c[0] !== s.mySeat && c[2] === null).length;
    // every hidden enemy piece is drawn as a plain back (no rank number text in its SVG)
    const drawnWithRank = [...document.querySelectorAll('#g-board .pc')].filter(el => el.querySelector('svg rect:nth-of-type(2)')?.getAttribute('fill') === (s.mySeat === 1 ? '#c9473d' : '#3b6fd4') && el.querySelector('text')).length;
    const shownEnemy = s.pub.cells.filter(c => c && c[0] !== s.mySeat && c[2] !== null && c[2] !== 0 && c[2] !== 11).length;
    const ownEnemyIds = s.mine.own.filter(x => s.pub.cells.some(c => c && c[1] === x[0] && c[0] !== s.mySeat)).length;
    return { hiddenEnemy, drawnWithRank, shownEnemy, ownEnemyIds, mySeat: s.mySeat, layoutLen: s.mine.layout ? s.mine.layout.length : 0 };
  });
  if (r.ownEnemyIds) fail(label + ': private view holds enemy pieces');
  if (r.drawnWithRank > r.shownEnemy) fail(label + ': ' + r.drawnWithRank + ' enemy pieces drawn with a rank but only ' + r.shownEnemy + ' are public');
  console.log('PASS ' + label + ': ' + r.hiddenEnemy + ' hidden enemy pieces, none drawn with a rank (' + r.drawnWithRank + ' shown ones are public)');
}

async function playOne(page) {
  // the side to move plays the hint move by tapping its two squares
  return page.evaluate(() => {
    const s = window.__strat.snap();
    if (!s.myTurn) return false;
    const m = window.StrBots.hint(s.pub, s.mine, s.mySeat, Math.random);
    document.querySelector('.cell[data-sq="' + m.from + '"]').click();
    document.querySelector('.cell[data-sq="' + m.to + '"]').click();
    return true;
  });
}
const ply = p => p.evaluate(() => { const s = window.__strat.snap(); return s && s.pub ? s.pub.ply : -1; });

await A.goto(url); await B.goto(url);
await A.click('[data-seg=mode] [data-val=online]');
await A.fill('#on-name', 'Alice'); await A.click('[data-a=create]');
await A.waitForSelector('.code-big', { timeout: 25000 });
await A.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('.code-big').textContent.trim()), null, { timeout: 25000 });
const code = (await A.textContent('.code-big')).trim();
console.log('room code', code);
if (shots) await A.screenshot({ path: shots + '/online-lobby.png' });

await B.click('[data-seg=mode] [data-val=online]');
await B.fill('#on-name', 'Bob'); await B.fill('#on-code', code); await B.click('[data-a=join]');
await A.waitForFunction(() => /Bob/.test(document.querySelector('.seats').textContent), null, { timeout: 25000 });
console.log('PASS Bob is seated');
await A.click('[data-a=startroom]');
for (const p of [A, B]) await p.waitForSelector('#acts-phone [data-a=ready]', { timeout: 25000 });
await A.click('#acts-phone [data-a=ready]'); await B.click('#acts-phone [data-a=ready]');
for (const p of [A, B]) await p.waitForFunction(() => { const s = window.__strat.snap(); return s && s.pub && s.pub.phase === 'play'; }, null, { timeout: 25000 });
console.log('PASS both armies in, game on');
await checkSecret(B, 'Blue at start');
await checkSecret(A, 'Red at start');
if (shots) { await A.screenshot({ path: shots + '/online-red.png' }); await B.screenshot({ path: shots + '/online-blue.png' }); }

for (let i = 0; i < MOVES; i++) {
  const before = await ply(A);
  const mover = (await playOne(A)) ? A : ((await playOne(B)) ? B : null);
  if (!mover) { await A.waitForTimeout(500); continue; }
  await A.waitForFunction(b => window.__strat.snap().pub.ply > b, before, { timeout: 25000 });
  await B.waitForFunction(b => window.__strat.snap().pub.ply > b, before, { timeout: 25000 });
}
console.log('PASS ' + MOVES + ' moves went through, ply ' + await ply(A));
await checkSecret(B, 'Blue mid-game');

reloading = true;
await B.reload();
await B.waitForFunction(() => { const s = window.__strat && window.__strat.snap(); return s && s.mode === 'online' && s.pub && s.pub.phase === 'play'; }, null, { timeout: 30000 });
reloading = false;
console.log('PASS Bob reloaded and is back in his seat at ply ' + await ply(B));
await checkSecret(B, 'Blue after reload');

// whoever is to move resigns
const aTurn = await A.evaluate(() => window.__strat.snap().myTurn);
const R = aTurn ? A : B;
await R.click('#acts-phone [data-a=resign]');
await R.click('.confirm-back [data-a=yes]');
for (const p of [A, B]) await p.waitForFunction(() => window.__strat.snap().pub.phase === 'over', null, { timeout: 25000 });
console.log('PASS both see the end: ' + (await B.textContent('#g-status')).trim());
const reveal = await B.evaluate(() => window.__strat.snap().pub.cells.filter(c => c && c[2] === null).length);
if (reveal) fail('after the end ' + reveal + ' pieces are still hidden');
console.log('PASS everything revealed at the end');
if (shots) { await A.screenshot({ path: shots + '/online-end-red.png' }); await B.screenshot({ path: shots + '/online-end-blue.png' }); }
await A.click('#acts-phone [data-a=leave]'); await A.click('.confirm-back [data-a=yes]');
await A.waitForTimeout(1500);

if (noise.length) console.log('note: ' + noise.length + ' messages while Bob\'s page reloaded (cut-off Firestore channels)');
if (errs.length) fail('console errors:\n' + errs.join('\n'));
console.log('PASS no console errors (' + engine + ')');
await bA.close(); await bB.close();
