// Hard's Flag placement must vary across games, so a repeat player can't learn one spot.
// Run: node tests/setup-variety.test.js
'use strict';
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const Odds = require('../js/odds.js');
const Bots = require('../js/bots.js');
const { FLAG, BOMB } = E;

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };
const SEEDS = 300;
const backNb = c => [c - 10].concat(c % 10 > 0 ? [c - 1] : [], c % 10 < 9 ? [c + 1] : []);
const walled = (own, c) => c >= 30 && own[c] !== BOMB && backNb(c).every(k => own[k] === BOMB);
function armyOk(own, variant) {
  const n = new Array(12).fill(0);
  own.forEach(r => { if (r >= 0) n[r]++; });
  return E.ARMIES[variant].every((want, r) => n[r] === want);
}

// 1. Classic: always a legal army with the Flag walled in on the back row, but the Flag has a twin wall
//    (a decoy) in a good share of games, and its column is spread out
{
  const cols = new Array(10).fill(0);
  let decoy = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const own = Bots.chooseSetup('classic', 'hard', Odds.mulberry(seed * 101));
    assert.ok(armyOk(own, 'classic'), 'legal army, seed ' + seed);
    const f = own.indexOf(FLAG);
    assert.ok(walled(own, f), 'Flag walled in, seed ' + seed);
    cols[f % 10]++;
    let walls = 0;
    for (let c = 30; c < 40; c++) if (walled(own, c)) walls++;
    if (walls >= 2) decoy++;
  }
  const share = decoy / SEEDS;
  assert.ok(share >= 0.3 && share <= 0.7, 'decoy wall in 30-70% of games, got ' + (share * 100).toFixed(0) + '%');
  assert.ok(cols.filter(n => n > 0).length >= 8, 'Flag in at least 8 columns: ' + cols.join(','));
  assert.ok(Math.max(...cols) / SEEDS <= 0.25, 'no column holds the Flag over 25%: ' + cols.join(','));
  ok(`Classic Hard: decoy wall ${(share * 100).toFixed(0)}%, Flag columns ${cols.join(',')}`);
}

// 2. Barrage: the Flag is always on the back row behind the Bomb, but not always in a corner
{
  const cols = new Array(10).fill(0);
  for (let seed = 1; seed <= SEEDS; seed++) {
    const own = Bots.chooseSetup('barrage', 'hard', Odds.mulberry(seed * 101));
    assert.ok(armyOk(own, 'barrage'), 'legal army, seed ' + seed);
    const f = own.indexOf(FLAG);
    assert.ok(f >= 30 && own[f - 10] === BOMB, 'Flag on the back row behind the Bomb, seed ' + seed);
    assert.ok(!Bots.flagLaneOpen(own), 'no open Scout lane, seed ' + seed);
    cols[f % 10]++;
  }
  const corner = (cols[0] + cols[9]) / SEEDS;
  assert.ok(corner >= 0.4 && corner <= 0.8, 'corner Flag in 40-80% of games, got ' + (corner * 100).toFixed(0) + '%');
  assert.ok(cols.filter(n => n > 0).length >= 6, 'Flag in at least 6 columns: ' + cols.join(','));
  ok(`Barrage Hard: corner ${(corner * 100).toFixed(0)}%, Flag columns ${cols.join(',')}`);
}

// 3. Same seed, same setup (games and tests stay reproducible)
{
  const a = Bots.chooseSetup('classic', 'hard', Odds.mulberry(7)), b = Bots.chooseSetup('classic', 'hard', Odds.mulberry(7));
  assert.deepEqual(a, b);
  ok('same seed gives the same setup');
}
console.log(`setup-variety: ${pass} passed`);
