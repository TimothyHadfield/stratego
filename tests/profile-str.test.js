// My stats glue + Hard's setups. Run: node tests/profile-str.test.js
'use strict';
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const Odds = require('../js/odds.js');
const Bots = require('../js/bots.js');
const P = require('../js/profile-str.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };

// a real full game between two computers (Easy vs Easy is quick and has plenty of fights)
function playGame(seed, variant) {
  const rng = Odds.mulberry(seed);
  const g = E.newGame({ variant });
  for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup(variant, 'easy', rng), s) });
  while (g.phase === 'play' && g.ply < 3000) {
    const s = g.turn;
    const m = Bots.chooseMove(E.publicView(g), E.privateView(g, s), s, 'easy', rng);
    if (!m) { E.apply(g, s, { type: 'resign' }); break; }
    E.apply(g, s, { type: 'move', from: m.from, to: m.to });
  }
  return g;
}

// 1. result(): Hint/Undo makes a game "with help" (unrated), a plain one counts at its level
{
  const g = playGame(7, 'classic');
  const pub = E.publicView(g);
  const plain = P.result(pub, 0, 'hard', {});
  assert.equal(plain.mode, 'computer'); assert.equal(plain.level, 'hard');
  assert.equal(plain.won, g.result.winner === 0);
  const helped = P.result(pub, 0, 'hard', { helped: true });
  assert.equal(helped.mode, 'help'); assert.equal(helped.level, null);
  assert.equal(P.result(pub, 1, 'easy', { daily: true }).daily, true);
  ok('result: plain game is rated at its level, a helped one is "with help" and unrated');
}

// 2. extra(): counts match a hand recount over several real games, for both sides
{
  let fights = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = playGame(seed, 'classic');
    const pub = E.publicView(g);
    for (const me of [0, 1]) {
      const x = P.extra(pub, me);
      let moves = 0, spy = 0, def = 0, lost = false;
      for (const h of g.hist) {
        if (h.s === me) moves++;
        if (!h.b) continue;
        fights++;
        const mine = h.s === me;
        if (mine && h.b.ar === E.SPY && h.b.dr === E.MARSHAL && h.b.out === 'att') spy++;
        if (mine && h.b.ar === E.MINER && h.b.dr === E.BOMB && h.b.out === 'att') def++;
        if ((mine && h.b.ar === E.MARSHAL && h.b.out !== 'att') || (!mine && h.b.dr === E.MARSHAL && h.b.out !== 'def')) lost = true;
      }
      assert.deepEqual([x.myMoves, x.spyKill, x.defused, x.marshalLost, x.variant], [moves, spy, def, lost, 'classic']);
    }
  }
  assert.ok(fights > 100, 'the games had real fights: ' + fights);
  ok('extra: moves, Spy kills, Bombs cleared and Marshal lost match a recount (5 real games)');
}

// 3. the Daily: same army for everyone on a day, rulebook rules, vs Hard
{
  const a = P.dailyGame(Odds.mulberry(20261027), Bots), b = P.dailyGame(Odds.mulberry(20261027), Bots);
  assert.deepEqual(a.enemy, b.enemy);
  assert.equal(a.level, 'hard'); assert.equal(a.variant, 'classic');
  assert.equal(a.enemy.filter(r => r === E.FLAG).length, 1);
  assert.equal(a.enemy.filter(r => r === E.BOMB).length, 6);
  ok('Daily: one army per day seed, full Classic army, vs Hard');
}

// 4. Hard's setups: Classic Flag walled in by Bombs on the back row; Barrage Flag on the back row behind the Bomb
{
  const rng = Odds.mulberry(99);
  for (let i = 0; i < 40; i++) {
    const s = Bots.chooseSetup('classic', 'hard', rng), f = s.indexOf(E.FLAG);
    assert.ok(f >= 30, 'back row');
    const nb = [f - 10]; if (f % 10 > 0) nb.push(f - 1); if (f % 10 < 9) nb.push(f + 1);
    assert.ok(nb.every(k => s[k] === E.BOMB), 'walled in');
    const b = Bots.chooseSetup('barrage', 'hard', rng), bf = b.indexOf(E.FLAG);
    // Barrage: back row behind the Bomb (a corner most games; see tests/setup-variety.test.js)
    assert.ok(bf >= 30, 'back row'); assert.equal(b[bf - 10], E.BOMB);
    assert.equal(b.filter(r => r >= 0).length, 8);
  }
  ok('Hard setups: walled Classic Flag, Barrage Flag behind the Bomb (40 each)');
}

console.log(pass + ' passed');
