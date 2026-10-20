/* Replay every human game in the Gravon archive through our engine.
   Run: node tools/replay-gravon.js <games.jsonl> [limit]
   Reports how many games replay with every move legal, under each two-square limit and scout rule,
   and whether "flag captured" results match. This is the strongest rules check we have:
   tens of thousands of real games played under ISF rules on gravon.de. */
'use strict';
const fs = require('fs');
const readline = require('readline');
const E = require('../js/engine.js');
const G = require('./gravon.js');

const file = process.argv[2];
const limit = +process.argv[3] || Infinity;

function replay(rec, opts) {
  const L = G.layouts(rec.f);
  if (!L) return { bad: 'field' };
  const variant = rec.t === 'barrage' ? 'barrage' : 'classic';
  if (E.checkLayout(L[0], variant) || E.checkLayout(L[1], variant)) return { bad: 'army' };
  const g = E.newGame(Object.assign({ variant }, opts));
  E.apply(g, 0, { type: 'setup', layout: L[0] });
  E.apply(g, 1, { type: 'setup', layout: L[1] });
  const mv = G.moves(rec.m);
  let maxStreak = 0, passes = 0;
  for (let i = 0; i < mv.length; i++) {
    if (g.phase === 'over') return { bad: 'moves after end', at: i, g, maxStreak };
    const [f, t] = mv[i];
    // Gravon records a lost turn (time ran out) by simply skipping it: follow the piece's owner
    if (g.board[f] >= 0 && g.pieces[g.board[f]].o !== g.turn) { g.turn = 1 - g.turn; passes++; }
    const seat = g.turn;
    if (!E.isLegal(g, seat, f, t)) {
      const id = g.board[f];
      return { bad: 'illegal', at: i, why: id < 0 ? 'empty' : g.pieces[id].o !== seat ? 'not own' : 'rule', g, maxStreak };
    }
    E.doMove(g, seat, f, t);
    const s = g.streak[seat]; if (s && s.n > maxStreak) maxStreak = s.n;
  }
  return { g, maxStreak, passes };
}

(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(file) });
  const tally = {};
  const add = (k) => { tally[k] = (tally[k] || 0) + 1; };
  const streaks = {};
  let n = 0;
  for await (const line of rl) {
    if (n >= limit) break;
    const rec = JSON.parse(line);
    if (rec.t !== 'classic' && rec.t !== 'barrage') continue;
    n++;
    const a = replay(rec, { twoSq: 5, scoutStrike: true, chase: false });
    add(rec.t + ' ISF(5): ' + (a.bad ? a.bad + (a.why ? '/' + a.why : '') : 'all legal'));
    if (!a.bad && a.passes) add(rec.t + ' had skipped turns (time)');
    if (!a.bad) {
      streaks[a.maxStreak] = (streaks[a.maxStreak] || 0) + 1;
      const b = replay(rec, { twoSq: 3, scoutStrike: true, chase: false });
      add(rec.t + ' box(3): ' + (b.bad ? b.bad : 'all legal'));
      const c = replay(rec, { twoSq: 5, scoutStrike: true, chase: true });
      add(rec.t + ' ISF(5)+chase rule: ' + (c.bad ? c.bad : 'all legal'));
      const g = a.g;
      if (rec.rt === 1) add(rec.t + ' result=flag: ' + (g.phase === 'over' && g.result.why === 'flag' && g.result.winner === rec.w - 1 ? 'engine agrees' : 'engine disagrees'));
      if (g.phase === 'over' && g.result.why === 'nomoves') add(rec.t + ' engine says stuck; gravon type ' + rec.rt + ' winner ' + rec.w + ' engine winner ' + (g.result.winner + 1));
    }
  }
  console.log('games', n);
  for (const k of Object.keys(tally).sort()) console.log(String(tally[k]).padStart(7), k);
  console.log('longest same-two-squares streak per legal game:', JSON.stringify(streaks));
})();
