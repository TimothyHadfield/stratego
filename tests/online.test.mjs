// The Stratego engine behind the shared online module's game interface (_online/README.md §2, §6).
// Run: node tests/online.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createLocal } from '../js/online.js';
const require = createRequire(import.meta.url);
const { game } = require('../js/online-game.js');
const E = require('../js/engine.js');
const Odds = require('../js/odds.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };
const clone = x => JSON.parse(JSON.stringify(x));
const humans = [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }];

// 1. Every seat "human", every move made by game.bot through JSON copies (the online path)
{
  let games = 0, moves = 0;
  const variants = [{}, { variant: 'barrage' }, { silent: true, aggressor: true }, { scoutStrike: false, twoSq: 5 }];
  for (let k = 0; k < 16; k++) {
    const rng = Odds.mulberry(k + 1);
    const opts = Object.assign({ level: ['easy', 'medium'][k % 2] }, variants[k % 4]);
    let s = game.setup(2, opts, rng, humans);
    while (!game.isOver(s)) {
      const toAct = game.toAct(s);
      assert.ok(toAct.length >= 1, 'someone must act before the end');
      const seat = toAct[0];
      const ctx = { pub: game.publicView(s), mine: game.privateView(s, seat), state: s };
      s = game.apply(clone(s), seat, clone(game.bot(ctx, seat, rng)));
      assert.equal(JSON.stringify(clone(s)), JSON.stringify(s), 'state survives JSON');
      moves++;
      if (s.ply > 2500) { s = game.apply(clone(s), s.turn, { type: 'resign' }); }
    }
    assert.deepEqual(game.toAct(s), []);
    assert.ok(s.result);
    games++;
  }
  ok(games + ' online-path games (classic, Barrage, Silent+Aggressor, Classic scouts) end cleanly; ' + moves + ' moves, never an illegal bot move');
}

// 2. Setup is simultaneous; illegal and out-of-turn moves throw
{
  const s = game.setup(2, {}, Odds.mulberry(2), humans);
  assert.deepEqual(game.toAct(s), [0, 1], 'both set up at once');
  assert.throws(() => game.apply(clone(s), 0, { type: 'move', from: 60, to: 50 }), /Not playing/);
  assert.throws(() => game.apply(clone(s), 0, null), /Bad move/);
  assert.throws(() => game.apply(clone(s), 0, { type: 'setup', layout: 'x' }), /four rows/);
  let t = s;
  for (const seat of [1, 0]) t = game.apply(clone(t), seat, game.bot({ pub: game.publicView(t), mine: game.privateView(t, seat), state: t }, seat, Odds.mulberry(seat + 5)));
  assert.deepEqual(game.toAct(t), [0]);
  assert.throws(() => game.apply(clone(t), 1, { type: 'move', from: 30, to: 40 }), /Not your turn/);
  assert.throws(() => game.apply(clone(t), 0, { type: 'move', from: 60, to: 40 }), /Illegal/);
  ok('setup is simultaneous; moves out of turn, illegal moves and junk throw');
}

// 3. Secrecy, the strong way: swap the ranks of two of Red's hidden pieces. Blue's views and the public
//    view must be byte-for-byte identical before and after the swap (so nothing in them can tell them apart).
{
  let checks = 0;
  for (let k = 0; k < 10; k++) {
    const rng = Odds.mulberry(50 + k);
    const opts = k % 2 ? { silent: true } : {};
    let s = game.setup(2, opts, rng, humans);
    // during setup: Red has sent its army, Blue has not
    s = game.apply(clone(s), 0, game.bot({ pub: game.publicView(s), mine: game.privateView(s, 0), state: s }, 0, rng));
    const swapLayout = clone(s);
    const L = swapLayout.layouts[0];
    const i = L.findIndex(r => r === E.FLAG), j = L.findIndex(r => r === E.MARSHAL);
    [L[i], L[j]] = [L[j], L[i]];
    assert.equal(JSON.stringify(game.publicView(s)), JSON.stringify(game.publicView(swapLayout)), 'setup: public view hides Red army');
    assert.equal(JSON.stringify(game.privateView(s, 1)), JSON.stringify(game.privateView(swapLayout, 1)), 'setup: Blue view hides Red army');
    s = game.apply(clone(s), 1, game.bot({ pub: game.publicView(s), mine: game.privateView(s, 1), state: s }, 1, rng));
    for (let step = 0; step < 30 + k * 25 && !game.isOver(s); step++) {
      const seat = game.toAct(s)[0];
      s = game.apply(clone(s), seat, game.bot({ pub: game.publicView(s), mine: game.privateView(s, seat), state: s }, seat, rng));
    }
    if (game.isOver(s)) continue;
    // two hidden Red pieces of different rank (on the board or captured unseen)
    const hidden = s.pieces.map((p, id) => (p && p.o === 0 && !p.rv && !p.sc && !p.mv ? id : -1)).filter(id => id >= 0);
    const a = hidden.find(id => s.pieces[id].r === E.FLAG) ?? hidden[0];
    const b = hidden.find(id => s.pieces[id].r !== s.pieces[a].r && s.pieces[id].r !== E.FLAG);
    if (a === undefined || b === undefined) continue;
    const t = clone(s);
    [t.pieces[a].r, t.pieces[b].r] = [t.pieces[b].r, t.pieces[a].r];
    assert.equal(JSON.stringify(game.publicView(s)), JSON.stringify(game.publicView(t)), 'public view leaks a hidden rank');
    assert.equal(JSON.stringify(game.privateView(s, 1)), JSON.stringify(game.privateView(t, 1)), "Blue's private view leaks a Red rank");
    assert.notEqual(JSON.stringify(game.privateView(s, 0)), JSON.stringify(game.privateView(t, 0)), 'sanity: Red sees its own change');
    // and Blue's private view only ever lists Blue pieces
    for (const [id] of game.privateView(s, 1).own) assert.equal(s.pieces[id].o, 1);
    checks++;
  }
  assert.ok(checks >= 6, 'enough positions checked: ' + checks);
  ok(checks + ' mid-game positions + setup phase: swapping two hidden Red ranks changes nothing Blue or the public can see');
}

// 4. After the game, everything is shown (for the replay)
{
  const rng = Odds.mulberry(77);
  let s = game.setup(2, { variant: 'barrage', level: 'easy' }, rng, humans);
  while (!game.isOver(s)) { const seat = game.toAct(s)[0]; s = game.apply(clone(s), seat, game.bot({ pub: game.publicView(s), mine: game.privateView(s, seat), state: s }, seat, rng)); }
  const pub = game.publicView(s);
  assert.ok(pub.layouts && pub.layouts[0] && pub.layouts[1], 'both armies shown at the end');
  assert.equal(pub.histFrom, 0);
  assert.equal(pub.hist.length, s.hist.length, 'whole game in the public record');
  ok('finished game: both setups and every move are public for the replay');
}

// 5. A local room (createLocal) plays human + computer to "finished"
{
  const room = createLocal({ game, seats: ['human', 'computer'], options: { level: 'easy', variant: 'barrage' }, botDelayMs: 0, rng: Odds.mulberry(21) });
  let last = null;
  room.on('change', snap => { last = snap; });
  room.on('error', e => { throw e; });
  room.start();
  await new Promise(r => setTimeout(r, 5));
  let guard = 0;
  while (last.status !== 'finished') {
    if (last.myTurn) {
      const r = room.act(game.bot({ pub: last.pub, mine: last.mine, state: room.state }, last.mySeat, Math.random));
      assert.ok(r.ok, r.message);
    }
    await new Promise(r => setTimeout(r, 1));
    assert.ok(++guard < 20000);
  }
  assert.ok(last.pub.result);
  ok('createLocal room (you + computer) plays to finished');
}

console.log(pass + ' passed');
