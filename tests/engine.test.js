// Engine rules tests. Run: node tests/engine.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');
const G = require('../tools/gravon.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };
const { FLAG, SPY, SCOUT, MINER, SERGEANT, LIEUTENANT, CAPTAIN, MAJOR, COLONEL, GENERAL, MARSHAL, BOMB } = E;

// A tiny board builder: put pieces where we like, skipping the setup phase.
function board(list, opts) {
  const g = E.newGame(opts);
  g.phase = 'play';
  g.pieces = new Array(100).fill(null);
  g.board = new Array(100).fill(-1);
  for (const [o, r, sq] of list) { g.pieces[sq] = { o, r, pos: sq, mv: 0, sc: 0, rv: 0 }; g.board[sq] = sq; }
  return g;
}
// Blue marks time without tripping its own two-square limit: two pieces take turns stepping
function blueWaits(g) {
  g._bw = (g._bw || 0) + 1;
  const pairs = [[9, 19], [5, 15]];
  const [a, b] = pairs[g._bw % 2];
  const from = g.board[a] >= 0 && g.pieces[g.board[a]].o === 1 ? a : b;
  E.apply(g, 1, { type: 'move', from, to: from === a ? b : a });
}
const moves = (g, seat, from) => E.legalMoves(g, seat).filter(m => m[0] === from).map(m => m[1]).sort((a, b) => a - b);

// 1. Armies: exact counts from the rulebook
{
  const c = E.ARMIES.classic;
  assert.deepEqual([c[MARSHAL], c[GENERAL], c[COLONEL], c[MAJOR], c[CAPTAIN], c[LIEUTENANT], c[SERGEANT], c[MINER], c[SCOUT], c[SPY], c[BOMB], c[FLAG]],
    [1, 1, 2, 3, 4, 4, 4, 5, 8, 1, 6, 1]);
  assert.equal(E.armySize('classic'), 40);
  const b = E.ARMIES.barrage;
  assert.deepEqual([b[MARSHAL], b[GENERAL], b[MINER], b[SCOUT], b[SPY], b[BOMB], b[FLAG]], [1, 1, 1, 2, 1, 1, 1]);
  assert.equal(E.armySize('barrage'), 8);
  assert.deepEqual(E.LAKES, [42, 43, 46, 47, 52, 53, 56, 57]);
  ok('armies: 40 pieces (1,1,2,3,4,4,4,5,8,1,6,1), Barrage 8; lakes at c5-d6 and g5-h6');
}

// 2. Fights
{
  const r = (a, d, o) => E.resolve(a, d, o);
  assert.equal(r(MARSHAL, GENERAL), 'att');
  assert.equal(r(SERGEANT, CAPTAIN), 'def');
  assert.equal(r(MAJOR, MAJOR), 'both');
  assert.equal(r(MAJOR, MAJOR, { aggressor: true }), 'att');
  assert.equal(r(SPY, MARSHAL), 'att', 'Spy attacking the Marshal wins');
  assert.equal(r(MARSHAL, SPY), 'att', 'Marshal attacking the Spy wins');
  assert.equal(r(SPY, SCOUT), 'def', 'Spy loses any other attack');
  assert.equal(r(SCOUT, SPY), 'att');
  assert.equal(r(MINER, BOMB), 'att');
  assert.equal(r(MARSHAL, BOMB), 'def');
  assert.equal(r(SCOUT, FLAG), 'att');
  assert.equal(r(SPY, SPY), 'both');
  for (let a = 1; a <= 10; a++) for (let d = 1; d <= 10; d++) {
    if (a === SPY && d === MARSHAL) continue;
    assert.equal(r(a, d), a > d ? 'att' : a < d ? 'def' : 'both');
  }
  ok('fights: higher wins, ties remove both (or attacker wins with Aggressor Advantage), Spy only beats an attacked Marshal, Miner defuses Bombs');
}

// 3. Movement: one square, no diagonals, lakes, Scouts slide but never jump
{
  const g = board([[0, CAPTAIN, 62], [0, SCOUT, 61], [1, SERGEANT, 31], [0, BOMB, 99], [0, FLAG, 98], [1, FLAG, 0]]);
  assert.deepEqual(moves(g, 0, 62), [63, 72], 'up is a lake (52), left is own piece');
  assert.deepEqual(moves(g, 0, 61), [31, 41, 51, 60, 71, 81, 91], 'Scout slides up to the enemy and may strike it');
  assert.deepEqual(moves(g, 0, 99), [], 'Bombs never move');
  assert.deepEqual(moves(g, 0, 98), [], 'Flags never move');
  const g2 = board([[0, SCOUT, 61], [1, SERGEANT, 31], [0, FLAG, 98], [1, FLAG, 0]], { scoutStrike: false });
  assert.deepEqual(moves(g2, 0, 61), [41, 51, 60, 62, 63, 64, 65, 66, 67, 68, 69, 71, 81, 91], "Classic rules: no strike from a distance");
  const g3 = board([[0, SCOUT, 40], [0, FLAG, 98], [1, FLAG, 0]]);
  assert.deepEqual(moves(g3, 0, 40), [0, 30, 20, 10, 41, 50, 60, 70, 80, 90].sort((a, b) => a - b), 'Scout stops at the lake (42) and may hit the Flag on 0');
  ok('movement: lakes, own pieces, immovable Bomb/Flag, Scout slides and strikes (switchable)');
}

// 4. Two-square rule: the 4th move between the same two squares is refused (or the 6th with limit 5)
{
  for (const lim of [3, 5]) {
    const g = board([[0, CAPTAIN, 70], [0, SERGEANT, 95], [1, CAPTAIN, 9], [1, SERGEANT, 5], [0, FLAG, 99], [1, FLAG, 0]], { twoSq: lim });
    let at = 70;
    for (let i = 0; i < lim; i++) {
      const to = at === 70 ? 71 : 70;
      assert.ok(E.isLegal(g, 0, at, to), 'shuttle move ' + (i + 1) + ' allowed');
      E.apply(g, 0, { type: 'move', from: at, to });
      at = to;
      blueWaits(g);
    }
    const to = at === 70 ? 71 : 70;
    assert.ok(!E.isLegal(g, 0, at, to), 'move ' + (lim + 1) + ' between the same squares refused');
    assert.ok(E.isLegal(g, 0, at, at - 10), 'another square is fine');
    // another piece moving resets it
    E.apply(g, 0, { type: 'move', from: 95, to: 85 });
    blueWaits(g);
    assert.ok(E.isLegal(g, 0, at, to), 'after another piece moves the count restarts');
  }
  // Scout: the squares it passes over count too (ISF 10.2)
  const g = board([[0, SCOUT, 90], [0, SERGEANT, 99], [1, CAPTAIN, 9], [1, SERGEANT, 5], [1, FLAG, 0], [0, FLAG, 98]]);
  const dance = [[90, 60], [60, 80], [80, 70]];
  for (const [f, t] of dance) {
    E.apply(g, 0, { type: 'move', from: f, to: t });
    blueWaits(g);
  }
  assert.ok(!E.isLegal(g, 0, 70, 90), 'Scout back and forth inside the same stretch: 4th move refused');
  assert.ok(E.isLegal(g, 0, 70, 50), 'leaving the stretch is fine');
  ok('two-square rule: limit 3 (box) and 5 (older ISF), reset by another piece, Scout stretches count');
}

// 5. More-squares (chase) rule: the chaser may not repeat a position of the chase
{
  // Red Captain chases a Blue Sergeant along the top rows; Blue runs back and forth
  const g = board([[0, CAPTAIN, 32], [1, SERGEANT, 12], [0, FLAG, 99], [0, BOMB, 98], [1, FLAG, 0], [1, BOMB, 1], [1, BOMB, 10]]);
  const play = (s, f, t) => E.apply(g, s, { type: 'move', from: f, to: t });
  play(0, 32, 22);            // steps next to the Sergeant
  play(1, 12, 13);            // runs
  play(0, 22, 23);            // follows: next to it again (chase)
  play(1, 13, 14);
  play(0, 23, 24);
  play(1, 14, 13);
  play(0, 24, 23);            // back to the square it just came from: always allowed
  play(1, 13, 12);
  // (22,12) was the starting position of the chase: moving there would repeat it
  assert.ok(!E.isLegal(g, 0, 23, 22), 'chaser may not repeat a position of the chase');
  const g2 = board([[0, CAPTAIN, 32], [1, SERGEANT, 12], [0, FLAG, 99], [0, BOMB, 98], [1, FLAG, 0], [1, BOMB, 1], [1, BOMB, 10]], { chase: false });
  for (const [s, f, t] of [[0, 32, 22], [1, 12, 13], [0, 22, 23], [1, 13, 14], [0, 23, 24], [1, 14, 13], [0, 24, 23], [1, 13, 12]]) E.apply(g2, s, { type: 'move', from: f, to: t });
  assert.ok(E.isLegal(g2, 0, 23, 22), 'with the chase rule off it is allowed');
  ok('more-squares rule: a continuous chase may not repeat a position (switchable)');
}

// 6. Setup checks
{
  const g = E.newGame({});
  assert.throws(() => E.apply(g, 0, { type: 'setup', layout: new Array(40).fill(SCOUT) }), /exactly/);
  assert.throws(() => E.apply(g, 0, { type: 'setup', layout: [1, 2] }), /four rows/);
  assert.throws(() => E.apply(g, 0, { type: 'move', from: 60, to: 50 }), /Not playing/);
  const army = [];
  E.ARMIES.classic.forEach((n, r) => { for (let i = 0; i < n; i++) army.push(r); });
  E.apply(g, 0, { type: 'setup', layout: army });
  assert.deepEqual(E.toAct(g), [1], 'Blue still to set up');
  assert.throws(() => E.apply(g, 0, { type: 'setup', layout: army }), /already/);
  E.apply(g, 1, { type: 'setup', layout: army });
  assert.equal(g.phase, 'play');
  assert.deepEqual(E.toAct(g), [0], 'Red moves first');
  const bg = E.newGame({ variant: 'barrage' });
  const bl = new Array(40).fill(-1);
  [FLAG, BOMB, SPY, SCOUT, SCOUT, MINER, GENERAL, MARSHAL].forEach((r, i) => { bl[i * 5] = r; });
  E.apply(bg, 0, { type: 'setup', layout: bl });
  assert.throws(() => E.apply(bg, 1, { type: 'setup', layout: army }), /exactly/);
  ok('setup: exact army required, 4 rows, both sides then Red first; Barrage may leave squares empty');
}

// 7. Ends: Flag capture, no moves, resign, both stuck = draw
{
  const g = board([[0, SCOUT, 70], [1, FLAG, 10], [0, FLAG, 99], [1, MAJOR, 0]]);
  E.apply(g, 0, { type: 'move', from: 70, to: 10 });
  assert.equal(g.phase, 'over');
  assert.deepEqual(g.result, { winner: 0, why: 'flag' });
  const g2 = board([[0, CAPTAIN, 70], [1, FLAG, 10], [1, BOMB, 0], [0, FLAG, 99]]);
  E.apply(g2, 0, { type: 'move', from: 70, to: 71 });
  assert.deepEqual(g2.result, { winner: 0, why: 'nomoves' }, 'Blue has nothing that can move: Blue loses');
  const g3 = board([[0, CAPTAIN, 70], [1, CAPTAIN, 10], [1, FLAG, 0], [0, FLAG, 99]]);
  E.apply(g3, 0, { type: 'resign' });
  assert.deepEqual(g3.result, { winner: 1, why: 'resign' });
  const g4 = board([[0, CAPTAIN, 70], [1, CAPTAIN, 71], [1, FLAG, 0], [0, FLAG, 99]]);
  E.apply(g4, 0, { type: 'move', from: 70, to: 71 });
  assert.deepEqual(g4.result, { winner: -1, why: 'nomoves' }, 'equal Captains both go; only Flags left: draw');
  // Walled-in setups: Bombs and Flag on front columns 0,1,4,5,8,9, the rest face lakes or own pieces
  const walled = new Array(40).fill(-1);
  [0, 1, 4, 5, 8].forEach(k => { walled[k] = BOMB; });
  walled[9] = FLAG; walled[39] = BOMB;
  const restW = [];
  E.ARMIES.classic.forEach((n, r) => { for (let i = 0; i < n; i++) if (r !== BOMB && r !== FLAG) restW.push(r); });
  for (let k = 0, j = 0; k < 40; k++) if (walled[k] < 0) walled[k] = restW[j++];
  const g5 = E.newGame({});
  E.apply(g5, 0, { type: 'setup', layout: E.layoutFromOwn(walled, 0) });
  E.apply(g5, 1, { type: 'setup', layout: E.layoutFromOwn(walled, 1) });
  assert.deepEqual(g5.result, { winner: -1, why: 'nomoves' }, 'neither side can move at the start: draw');
  const army = [];
  E.ARMIES.classic.forEach((n, r) => { for (let i = 0; i < n; i++) army.push(r); });
  const g6 = E.newGame({});
  E.apply(g6, 0, { type: 'setup', layout: E.layoutFromOwn(walled, 0) });
  E.apply(g6, 1, { type: 'setup', layout: army });
  assert.deepEqual(g6.result, { winner: 1, why: 'nomoves' }, 'only Red is walled in: Blue wins');
  const g7 = E.newGame({});
  E.apply(g7, 0, { type: 'setup', layout: army });
  E.apply(g7, 1, { type: 'setup', layout: E.layoutFromOwn(walled, 1) });
  assert.equal(g7.phase, 'play', 'only Blue walled in: Red moves first, Blue loses after');
  ok('game end: Flag taken, opponent cannot move, resign, neither side can move = draw');
}

// 8. Fights on the board: winner moves in, Bomb stays, ties clear both
{
  const g = board([[0, MAJOR, 70], [1, BOMB, 60], [0, MINER, 71], [1, CAPTAIN, 61], [1, FLAG, 0], [0, FLAG, 99], [1, SCOUT, 5]]);
  E.apply(g, 0, { type: 'move', from: 70, to: 60 });
  assert.equal(g.board[60], 60, 'Bomb stays');
  assert.equal(g.board[70], -1, 'Major gone');
  assert.ok(g.pieces[60].rv, 'the Bomb is revealed');
  E.apply(g, 1, { type: 'move', from: 5, to: 6 });
  E.apply(g, 0, { type: 'move', from: 71, to: 61 });
  assert.equal(g.board[61], 61, 'Captain beat the Miner and stays');
  const g2 = board([[0, MAJOR, 70], [1, MAJOR, 60], [1, FLAG, 0], [0, FLAG, 99], [1, SCOUT, 5], [0, SCOUT, 90]]);
  E.apply(g2, 0, { type: 'move', from: 70, to: 60 });
  assert.equal(g2.board[60], -1); assert.equal(g2.board[70], -1);
  ok('board fights: a defending Bomb stays put, the loser is removed, equal ranks both go');
}

// 9. Silent Defense: the defender's rank stays hidden but what it could be is recorded
{
  const g = board([[0, CAPTAIN, 70], [1, MAJOR, 60], [1, FLAG, 0], [0, FLAG, 99], [1, SCOUT, 5], [0, SCOUT, 90]], { silent: true });
  E.apply(g, 0, { type: 'move', from: 70, to: 60 });
  const pub = E.publicView(g);
  assert.equal(pub.cells[60][2], null, 'defender still unknown');
  const mask = pub.cons[60];
  const allowed = []; for (let r = 0; r < 12; r++) if (mask & (1 << r)) allowed.push(r);
  assert.deepEqual(allowed, [MAJOR, COLONEL, GENERAL, MARSHAL, BOMB], 'it beat a Captain: higher rank or a Bomb');
  ok('Silent Defense: defender rank hidden; the odds get "beat a Captain" as a fact');
}

// 10. Real games: every move of 260 human games from gravon.de replays as legal, results agree
{
  const lines = fs.readFileSync(path.join(__dirname, 'fixtures', 'gravon-sample.jsonl'), 'utf8').split('\n').filter(Boolean);
  let games = 0, mv = 0, flags = 0;
  for (const line of lines) {
    const rec = JSON.parse(line);
    const L = G.layouts(rec.f);
    const variant = rec.t === 'barrage' ? 'barrage' : 'classic';
    const g = E.newGame({ variant, twoSq: 5, chase: false });
    E.apply(g, 0, { type: 'setup', layout: L[0] });
    E.apply(g, 1, { type: 'setup', layout: L[1] });
    const list = G.moves(rec.m);
    for (let i = 0; i < list.length; i++) {
      const [f, t] = list[i];
      if (g.phase === 'over') break;
      // the archive has a rare doubled move; skip exact repeats of the previous move
      if (i && list[i - 1][0] === f && list[i - 1][1] === t && g.board[f] < 0) continue;
      assert.ok(E.isLegal(g, g.turn, f, t), 'game ' + games + ' move ' + i + ' illegal');
      E.apply(g, g.turn, { type: 'move', from: f, to: t });
      mv++;
    }
    if (rec.rt === 1) { assert.equal(g.phase, 'over'); assert.equal(g.result.winner, rec.w - 1); flags++; }
    games++;
  }
  assert.ok(games >= 250);
  ok(games + ' real games (' + mv + ' moves) replay with every move legal; all ' + flags + ' flag captures agree');
}

// 11. Display numbering
{
  assert.equal(E.label(MARSHAL, 'modern'), '10');
  assert.equal(E.label(SPY, 'modern'), '1');
  assert.equal(E.label(MARSHAL, 'classic'), '1');
  assert.equal(E.label(SCOUT, 'classic'), '9');
  assert.equal(E.label(SPY, 'classic'), 'S');
  assert.equal(E.label(BOMB, 'classic'), 'B');
  ok('numbering: modern Marshal 10 / Spy 1; classic Marshal 1 / Scout 9 / Spy S');
}

// 12. Own-view mapping round trip
{
  for (const s of [0, 1]) {
    const own = Array.from({ length: 40 }, (_, k) => k % 12);
    assert.deepEqual(E.ownFromLayout(E.layoutFromOwn(own, s), s), own);
    assert.equal(Math.floor(E.ownK(E.sqOfK(5, s), s)), 5);
  }
  assert.equal(E.sqOfK(0, 0), 60, 'Red front-left is a7 (square 60)');
  assert.equal(E.sqOfK(0, 1), 39, "Blue front-left (Blue's view) is square 39");
  ok('own-view setup squares map both ways for both colours');
}

console.log(pass + ' passed');
