// Odds layer tests: sampled chances must match brute-force counting. Run: node tests/odds.test.js
'use strict';
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const Odds = require('../js/odds.js');
const Bots = require('../js/bots.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };

/** Brute force: every way to hand the leftover ranks to the unknown pieces, weighted. */
function brute(unknown, left, weights) {
  const n = unknown.length;
  const acc = unknown.map(() => new Float64Array(12));
  let total = 0;
  const cnt = left.slice();
  const cur = new Array(n);
  (function rec(i, w) {
    if (i === n) { total += w; for (let k = 0; k < n; k++) acc[k][cur[k]] += w; return; }
    for (let r = 0; r < 12; r++) {
      if (!cnt[r] || !(unknown[i].mask & (1 << r))) continue;
      cnt[r]--; cur[i] = r;
      rec(i + 1, w * (weights ? weights[i][r] : 1));
      cnt[r]++;
    }
  })(0, 1);
  return acc.map(a => a.map(x => x / total));
}
const maxDiff = (a, b) => { let m = 0; a.forEach((row, i) => row.forEach((x, r) => { m = Math.max(m, Math.abs(x - b[i][r])); })); return m; };

// 1. A Barrage game part-way through: sampled chances = brute force (both seats' views)
{
  let worst = 0, checked = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rng = Odds.mulberry(seed);
    const g = E.newGame({ variant: 'barrage', silent: seed % 3 === 0 });
    for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup('barrage', 'easy', rng), s) });
    for (let i = 0; i < 6 + seed * 3 && g.phase === 'play'; i++) {
      const m = Bots.chooseMove(E.publicView(g), E.privateView(g, g.turn), g.turn, 'random', rng);
      E.apply(g, g.turn, { type: 'move', from: m.from, to: m.to });
    }
    if (g.phase !== 'play') continue;
    for (const seat of [0, 1]) {
      const pub = E.publicView(g);
      const f = Odds.facts(pub, seat);
      if (!f.unknown.length) continue;
      const exact = brute(f.unknown, f.left);
      const res = Odds.analyze(pub, seat, { prior: 'flat', forceSample: true, steps: 120000, seed });
      const got = f.unknown.map(u => res.byId[u.id]);
      worst = Math.max(worst, maxDiff(got, exact));
      // the truth always has a chance above zero
      for (const u of f.unknown) assert.ok(res.byId[u.id][g.pieces[u.id].r] > 0, 'true rank ruled out');
      checked++;
    }
  }
  assert.ok(checked >= 10, 'enough positions');
  assert.ok(worst < 0.02, 'sampled vs brute force differ by ' + worst);
  ok(checked + ' Barrage positions (some with Silent Defense): sampled chances within ' + worst.toFixed(4) + ' of brute force');
}

// 2. Classic: the exact flat formula = brute force on a cut-down army, and = sampling on the full army
{
  const unknown = [{ mask: Odds.ALL }, { mask: Odds.ALL }, { mask: Odds.NOT_STILL }, { mask: Odds.ALL }, { mask: Odds.NOT_STILL }, { mask: Odds.ALL }];
  const left = new Array(12).fill(0); left[E.FLAG] = 1; left[E.BOMB] = 2; left[E.SCOUT] = 2; left[E.MARSHAL] = 1;
  const ex = Odds.exactFlat(unknown, left);
  const br = brute(unknown, left);
  assert.ok(maxDiff(ex, br) < 1e-12, 'formula = brute force');
  // full classic game after some moves
  const rng = Odds.mulberry(99);
  const g = E.newGame({});
  for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup('classic', 'medium', rng), s) });
  for (let i = 0; i < 60 && g.phase === 'play'; i++) {
    const m = Bots.chooseMove(E.publicView(g), E.privateView(g, g.turn), g.turn, 'easy', rng);
    E.apply(g, g.turn, { type: 'move', from: m.from, to: m.to });
  }
  const pub = E.publicView(g);
  const a = Odds.analyze(pub, 0, { prior: 'flat' });
  assert.ok(a.exact, 'used the exact formula');
  const b = Odds.analyze(pub, 0, { prior: 'flat', forceSample: true, steps: 200000 });
  const ids = Object.keys(a.byId);
  const d = maxDiff(ids.map(i => a.byId[i]), ids.map(i => b.byId[i]));
  assert.ok(d < 0.02, 'sampling vs exact ' + d);
  for (const i of ids) assert.ok(Math.abs(a.byId[i].reduce((x, y) => x + y, 0) - 1) < 1e-9, 'sums to 1');
  ok('exact flat formula = brute force (1e-12) and = sampling on a full army after 60 moves (' + d.toFixed(4) + ')');
}

// 3. Weighted prior with odd constraints: sampler = brute force
{
  const rng = Odds.mulberry(5);
  let worst = 0;
  for (let t = 0; t < 8; t++) {
    const left = new Array(12).fill(0);
    const ranks = [0, 11, 11, 2, 2, 3, 10, 1];
    ranks.forEach(r => left[r]++);
    const unknown = ranks.map(() => ({ mask: Odds.ALL }));
    unknown[0].mask = Odds.NOT_STILL; unknown[1].mask = Odds.NOT_STILL;
    unknown[2].mask = (1 << 10) | (1 << 11) | (1 << 3);
    const weights = unknown.map(() => Float64Array.from({ length: 12 }, () => 0.05 + rng()));
    const s = Odds.sampler(unknown, left, weights, Odds.mulberry(t + 1));
    const acc = unknown.map(() => new Float64Array(12));
    for (let i = 0; i < 4000; i++) s.step();
    let kept = 0;
    for (let i = 0; i < 400000; i++) { s.step(); if (i % 4 === 0) { s.cur.forEach((r, k) => { acc[k][r]++; }); kept++; } }
    const got = acc.map(a => a.map(x => x / kept));
    worst = Math.max(worst, maxDiff(got, brute(unknown, left, weights)));
  }
  assert.ok(worst < 0.02, 'weighted sampler off by ' + worst);
  ok('weighted prior + mixed constraints: sampler within ' + worst.toFixed(4) + ' of brute force (8 random cases)');
}

// 4. The real-setup prior puts the Flag on the back row, and facts always win over the prior
{
  const rng = Odds.mulberry(3);
  const g = E.newGame({});
  for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup('classic', 'medium', rng), s) });
  const pub = E.publicView(g);
  const a = Odds.analyze(pub, 0, { prior: 'real' });
  let back = 0, front = 0;
  for (const [id, p] of Object.entries(a.byId)) { const k = E.ownK(+id, 1); if (k >= 30) back += p[E.FLAG]; if (k < 10) front += p[E.FLAG]; }
  assert.ok(back > 0.8, 'Flag on the back row with ' + back.toFixed(2));
  assert.ok(front < 0.05);
  // after a piece moves it can't be the Flag or a Bomb
  const m = Bots.chooseMove(pub, E.privateView(g, 0), 0, 'easy', rng);
  E.apply(g, 0, { type: 'move', from: m.from, to: m.to });
  // Blue makes a quiet one-square step (no fight), so the moved piece stays hidden
  const quiet = E.legalMoves(g, 1).find(([f, t]) => g.board[t] < 0 && Math.abs(f - t) === 10 && g.pieces[g.board[f]].r !== E.SCOUT);
  assert.ok(quiet, 'Blue has a quiet step');
  E.apply(g, 1, { type: 'move', from: quiet[0], to: quiet[1] });
  const moved = g.board[quiet[1]];
  const b = Odds.analyze(E.publicView(g), 0, { prior: 'real' });
  assert.ok(b.byId[moved], 'the moved piece is still unknown');
  assert.equal(b.byId[moved][E.FLAG], 0, 'moved piece cannot be the Flag');
  assert.equal(b.byId[moved][E.BOMB], 0, 'moved piece cannot be a Bomb');
  ok('real-setup prior: Flag on the back row ' + (back * 100).toFixed(0) + '%, front row ' + (front * 100).toFixed(1) + '%; a moved piece is never Flag/Bomb');
}

// 5. The computer's Barrage setups never leave the Flag open to one Scout run down its column
{
  const rng = Odds.mulberry(11);
  let open = 0, n = 0;
  for (const level of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 300; i++) {
      const own = Bots.chooseSetup('barrage', level, rng);
      assert.equal(E.checkLayout(E.layoutFromOwn(own, 0), 'barrage'), null, 'a legal Barrage army');
      const f = own.indexOf(E.FLAG), col = f % 10;
      let lane = ![2, 3, 6, 7].includes(col);
      for (let k = f - 10; k >= 0; k -= 10) if (own[k] >= 0) lane = false;
      if (lane) open++;
      n++;
    }
  }
  assert.equal(open, 0, open + ' of ' + n + ' Barrage setups leave the Flag open to a Scout');
  ok('Barrage computer setups: 0 of ' + n + ' leave the Flag open to a Scout run');
}

console.log(pass + ' passed');
