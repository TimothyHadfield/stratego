// Rescue (classic Hasbro/Milton Bradley variation) and One-time Bombs (house rule). Run: node tests/variants.test.js
// Rescue, as the rulebook variation reads: a piece that moves onto the enemy's back row may rescue one of its
// own captured pieces (never a Bomb) and put it on any empty square of its own half; that ends the turn.
// Up to 2 rescues per player, Scouts can't rescue, the same piece can't make both.
'use strict';
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const Bots = require('../js/bots.js');
const Odds = require('../js/odds.js');
const OG = require('../js/online-game.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };
const { FLAG, SCOUT, MINER, SERGEANT, CAPTAIN, MAJOR, GENERAL, MARSHAL, BOMB } = E;

function board(list, opts, dead) {
  const g = E.newGame(opts);
  g.phase = 'play';
  g.pieces = new Array(100).fill(null);
  g.board = new Array(100).fill(-1);
  for (const [o, r, sq] of list) { g.pieces[sq] = { o, r, pos: sq, mv: 0, sc: 0, rv: 0 }; g.board[sq] = sq; }
  // captured pieces: [owner, rank, id] (id = an unused square number)
  for (const [o, r, id] of dead || []) g.pieces[id] = { o, r, pos: -1, mv: 1, sc: 0, rv: 1 };
  return g;
}
const R = { rescue: true };

// 1. Options: off by default, kept when on
{
  assert.equal(E.cleanOpts({}).rescue, false);
  assert.equal(E.cleanOpts({}).bombOnce, false);
  assert.equal(E.cleanOpts({ rescue: 1, bombOnce: 1 }).rescue, true);
  assert.equal(E.cleanOpts({ rescue: 1, bombOnce: 1 }).bombOnce, true);
  ok('options: Rescue and One-time Bombs are off unless asked for');
}

// 2. Red reaches Blue's back row (row 0) and may rescue its Marshal onto its own half
{
  const g = board([[0, CAPTAIN, 11], [0, FLAG, 99], [1, FLAG, 9], [1, SERGEANT, 30]], R, [[0, MARSHAL, 70], [0, BOMB, 71], [0, SCOUT, 72]]);
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  assert.ok(g.pend, 'a rescue is waiting');
  assert.equal(g.turn, 0, 'still Red\'s turn until the rescue is made or skipped');
  assert.deepEqual(E.toAct(g), [0]);
  assert.deepEqual(E.legalMoves(g, 0), [], 'no ordinary move while the rescue waits');
  const opt = E.rescueOptions(g);
  assert.deepEqual(opt.ranks.sort((a, b) => a - b), [SCOUT, MARSHAL], 'any captured piece but a Bomb');
  assert.ok(opt.squares.includes(50) && opt.squares.includes(98) && !opt.squares.includes(49) && !opt.squares.includes(52) && !opt.squares.includes(99),
    'own half (rows 6-10 for Red), no lakes, no occupied squares');
  assert.throws(() => E.apply(g, 0, { type: 'rescue', r: BOMB, to: 60 }), /Bomb/);
  assert.throws(() => E.apply(g, 0, { type: 'rescue', r: MARSHAL, to: 40 }), /half/);
  assert.throws(() => E.apply(g, 1, { type: 'move', from: 30, to: 31 }), /turn/);
  E.apply(g, 0, { type: 'rescue', r: MARSHAL, to: 60 });
  assert.equal(g.pend, null);
  assert.equal(g.turn, 1, 'the rescue ends the turn');
  assert.equal(g.pieces[70].pos, 60);
  assert.equal(g.board[60], 70);
  assert.equal(g.resc[0], 1);
  assert.equal(g.pieces[11].rs, 1, 'the rescuer is marked');
  const pub = E.publicView(g);
  assert.deepEqual(pub.cells[60].slice(0, 3), [0, 70, MARSHAL], 'a rescued piece is known to both players (it came back from their pile)');
  assert.ok(!pub.dead.some(d => d[1] === 70), 'no longer among the removed pieces');
  assert.deepEqual(pub.hist[pub.hist.length - 1].rs, { r: MARSHAL, to: 60, id: 70 });
  assert.deepEqual(pub.resc, [1, 0]);
  ok('Red on Blue\'s back row rescues its Marshal onto its own half; the turn passes; the piece is shown');
}

// 3. Skip, Scouts, Bombs only, the same piece twice, at most 2
{
  // Scout can't rescue
  let g = board([[0, SCOUT, 51], [0, FLAG, 99], [1, FLAG, 9], [1, SERGEANT, 30]], R, [[0, MARSHAL, 70]]);
  E.apply(g, 0, { type: 'move', from: 51, to: 1 });
  assert.equal(g.pend, null); assert.equal(g.turn, 1);
  // only Bombs captured: nothing to rescue
  g = board([[0, CAPTAIN, 11], [0, FLAG, 99], [1, FLAG, 9], [1, SERGEANT, 30]], R, [[0, BOMB, 70]]);
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  assert.equal(g.pend, null);
  // rule off: nothing
  g = board([[0, CAPTAIN, 11], [0, FLAG, 99], [1, FLAG, 9], [1, SERGEANT, 30]], {}, [[0, MARSHAL, 70]]);
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  assert.equal(g.pend, null);
  // skip
  g = board([[0, CAPTAIN, 11], [0, FLAG, 99], [1, FLAG, 9], [1, SERGEANT, 30]], R, [[0, MARSHAL, 70]]);
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  E.apply(g, 0, { type: 'rescue', skip: true });
  assert.equal(g.pend, null); assert.equal(g.turn, 1); assert.equal(g.resc[0], 0);
  assert.equal(g.pieces[70].pos, -1);
  // same piece can't rescue twice; a second piece can; never a third
  g = board([[0, CAPTAIN, 11], [0, MAJOR, 18], [0, GENERAL, 15], [0, FLAG, 99], [1, FLAG, 9], [1, SERGEANT, 30], [1, SERGEANT, 39]], R,
    [[0, MARSHAL, 70], [0, MINER, 71], [0, MINER, 72], [0, MINER, 73]]);
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  E.apply(g, 0, { type: 'rescue', r: MARSHAL, to: 60 });
  E.apply(g, 1, { type: 'move', from: 30, to: 31 });
  E.apply(g, 0, { type: 'move', from: 1, to: 2 }); // same Captain along the back row: already rescued once
  assert.equal(g.pend, null, 'the same piece can\'t make both rescues');
  E.apply(g, 1, { type: 'move', from: 31, to: 30 });
  E.apply(g, 0, { type: 'move', from: 18, to: 8 }); // the Major can
  assert.ok(g.pend);
  E.apply(g, 0, { type: 'rescue', r: MINER, to: 61 });
  E.apply(g, 1, { type: 'move', from: 30, to: 31 });
  E.apply(g, 0, { type: 'move', from: 15, to: 5 }); // a third piece: both rescues used
  assert.equal(g.pend, null, 'at most 2 rescues');
  ok('no rescue by a Scout, of a Bomb, with the rule off, or a third time; the same piece rescues once; skipping is allowed');
}

// 4. Winning a fight on the back row rescues too; Blue's back row is row 0, Red's is row 9 (Blue rescues there)
{
  let g = board([[0, MARSHAL, 11], [1, CAPTAIN, 1], [0, FLAG, 99], [1, FLAG, 9]], R, [[0, GENERAL, 70]]);
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  assert.ok(g.pend, 'won the fight, stands on the back row');
  g = board([[1, MAJOR, 88], [0, FLAG, 99], [0, SERGEANT, 60], [1, FLAG, 9]], R, [[1, GENERAL, 20]]);
  g.turn = 1;
  E.apply(g, 1, { type: 'move', from: 88, to: 98 });
  assert.ok(g.pend);
  assert.ok(E.rescueOptions(g).squares.every(s => s < 50), 'Blue puts it on rows 1-5');
  E.apply(g, 1, { type: 'rescue', r: GENERAL, to: 40 });
  assert.equal(g.turn, 0);
  // an attacker that loses on the back row rescues nothing
  g = board([[0, CAPTAIN, 11], [1, MARSHAL, 1], [0, FLAG, 99], [1, FLAG, 9], [0, SERGEANT, 60]], R, [[0, GENERAL, 70]]);
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  assert.equal(g.pend, null);
  ok('a fight won on the back row allows a rescue; Blue rescues on Red\'s back row onto rows 1-5; a lost fight doesn\'t');
}

// 5. Game end waits for the rescue: the other side stuck now, but a rescue doesn't free them -> still ends after it
{
  const g = board([[0, CAPTAIN, 11], [0, FLAG, 99], [1, FLAG, 9]], R, [[0, GENERAL, 70]]);
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  assert.equal(g.phase, 'play');
  E.apply(g, 0, { type: 'rescue', skip: true });
  assert.equal(g.phase, 'over');
  assert.equal(g.result.winner, 0, 'Blue has no movable piece: Red wins');
  ok('the stuck-side check runs after the rescue choice');
}

// 6. One-time Bombs: a Bomb that blows up is removed with the attacker; a Miner still defuses it
{
  assert.equal(E.resolve(MARSHAL, BOMB, { bombOnce: true }), 'both');
  assert.equal(E.resolve(MINER, BOMB, { bombOnce: true }), 'att');
  assert.equal(E.resolve(MARSHAL, BOMB, {}), 'def');
  const g = board([[0, MARSHAL, 51], [1, BOMB, 41], [0, FLAG, 99], [1, FLAG, 9], [1, SERGEANT, 30]], { bombOnce: true });
  E.apply(g, 0, { type: 'move', from: 51, to: 41 });
  assert.equal(g.board[41], -1, 'the Bomb is gone');
  assert.equal(g.pieces[51].pos, -1, 'and so is the attacker');
  assert.equal(E.publicView(g).hist[0].b.out, 'both');
  const f = Odds.fightOdds(MARSHAL, (() => { const a = new Float64Array(12); a[BOMB] = 1; return a; })(), { bombOnce: true });
  assert.equal(f.tie, 1, 'the odds layer counts it as both out');
  ok('One-time Bombs: the Bomb goes with the piece that set it off; Miners still clear it');
}

// 7. Computers handle a waiting rescue (every level) and the online game hands it to them
{
  for (const level of ['easy', 'medium', 'hard']) {
    const g = board([[0, CAPTAIN, 11], [0, FLAG, 99], [0, SERGEANT, 98], [1, FLAG, 9], [1, SERGEANT, 30]], R, [[0, MARSHAL, 70], [0, SCOUT, 71]]);
    E.apply(g, 0, { type: 'move', from: 11, to: 1 });
    const a = Bots.chooseRescue(E.publicView(g), E.privateView(g, 0), 0, level, Odds.mulberry(3));
    assert.equal(a.type, 'rescue');
    E.apply(g, 0, a);
    assert.equal(g.turn, 1);
    if (level !== 'easy') assert.equal(g.pieces[70].pos >= 50, true, level + ' brings back its Marshal');
  }
  const g = OG.game.setup(2, { rescue: true, level: 'medium' });
  Object.assign(g, board([[0, CAPTAIN, 11], [0, FLAG, 99], [1, FLAG, 9], [1, SERGEANT, 30]], R, [[0, MARSHAL, 70]]), { level: 'medium' });
  E.apply(g, 0, { type: 'move', from: 11, to: 1 });
  const act = OG.game.bot({ state: g, pub: E.publicView(g), mine: E.privateView(g, 0) }, 0, Odds.mulberry(5));
  assert.equal(act.type, 'rescue');
  OG.game.apply(g, 0, act);
  assert.equal(g.turn, 1);
  ok('Easy, Medium and Hard each make a waiting rescue (Medium/Hard take the Marshal); the online bot does too');
}

// 8. Whole games: every level vs every level with Rescue + One-time Bombs, Classic and Barrage, end legally;
//    a replay of the move list (Study) rebuilds the same final board
{
  let rescues = 0, games = 0;
  for (const variant of ['classic', 'barrage']) for (const [a, b] of [['easy', 'hard'], ['medium', 'easy'], ['hard', 'medium']]) {
    const rng = Odds.mulberry(11 + games);
    const g = E.newGame({ variant, rescue: true, bombOnce: games % 2 === 1 });
    const lv = [a, b];
    for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup(variant, lv[s], rng), s) });
    let n = 0;
    while (g.phase === 'play' && n < 1200) {
      const s = g.turn;
      const pub = E.publicView(g), mine = E.privateView(g, s);
      if (g.pend) { E.apply(g, s, Bots.chooseRescue(pub, mine, s, lv[s], rng)); continue; }
      const m = Bots.chooseMove(pub, mine, s, lv[s], rng);
      if (!m) { E.apply(g, s, { type: 'resign' }); break; }
      E.apply(g, s, { type: 'move', from: m.from, to: m.to });
      n++;
    }
    rescues += g.resc[0] + g.resc[1];
    // replay like the Study tab does
    const r = E.newGame(g.opts);
    E.apply(r, 0, { type: 'setup', layout: g.layouts[0] });
    E.apply(r, 1, { type: 'setup', layout: g.layouts[1] });
    for (const h of g.hist) { if (r.phase !== 'play') break; E.replayStep(r, h); }
    assert.deepEqual(r.board, g.board, 'replay rebuilds the board (' + variant + ' ' + a + '-' + b + ')');
    games++;
  }
  assert.ok(rescues > 0, 'some rescues happened in ' + games + ' games');
  ok(games + ' computer games with the new rules end legally; ' + rescues + ' rescues; replays match');
}

console.log(pass + ' passed');
