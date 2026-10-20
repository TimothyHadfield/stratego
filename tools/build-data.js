/* Build js/data.js from the Gravon human game archive (games.jsonl from the parse step).
   Run: node tools/build-data.js <games.jsonl>
   Writes:
   - HEAT: for each rank, how often real players put it on each of the 40 setup squares (own view)
   - SETUPS: 400 real setups from games their owner won (for the computer and the "real setups" browser)
   - STATS: a few measured facts (Red's win rate, flag placement and its win rates, game length)
   - tests/fixtures/gravon-sample.jsonl: 200 classic + 60 Barrage games for the replay test
   Own view: square k = depth*10 + col, depth 0 = front row, col 0 = the owner's left. */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');
const G = require('./gravon.js');

const file = process.argv[2];
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);

// engine layout (absolute squares) -> own view (k = depth*10 + col)
function ownView(layout, seat) {
  const out = new Array(40).fill(-1);
  for (let k = 0; k < 40; k++) {
    const sq = E.zoneOf(seat) + k;
    const row = Math.floor(sq / 10), col = sq % 10;
    const depth = seat === 0 ? row - 6 : 3 - row;
    const c = seat === 0 ? col : 9 - col;
    out[depth * 10 + c] = layout[k];
  }
  return out;
}
const counts = Array.from({ length: 12 }, () => new Array(40).fill(0));
let nSetups = 0;
const stats = { games: 0, red: 0, blue: 0, none: 0, moves: 0, ends: {}, flagDepth: [0, 0, 0, 0], flagDepthWins: [0, 0, 0, 0], flagDepthGames: [0, 0, 0, 0],
  bombed: { games: 0, wins: 0 }, open: { games: 0, wins: 0 }, corner: 0 };
const winners = [];
const sample = { classic: [], barrage: [] };
const END = { 0: 'no moves', 1: 'flag', 3: 'resign', 4: 'time' };

function flagBombed(own) {
  const f = own.indexOf(E.FLAG);
  const d = Math.floor(f / 10), c = f % 10;
  const nb = [];
  if (d > 0) nb.push(f - 10);
  if (d < 3) nb.push(f + 10);
  if (c > 0) nb.push(f - 1);
  if (c < 9) nb.push(f + 1);
  return nb.every(k => own[k] === E.BOMB);
}

let i = 0;
for (const line of lines) {
  const rec = JSON.parse(line);
  i++;
  const L = G.layouts(rec.f);
  if (!L) continue;
  if (rec.t === 'barrage') {
    if (sample.barrage.length < 60 && i % 7 === 0 && !E.checkLayout(L[0], 'barrage') && !E.checkLayout(L[1], 'barrage')) sample.barrage.push(line);
    continue;
  }
  if (E.checkLayout(L[0], 'classic') || E.checkLayout(L[1], 'classic')) continue;
  if (sample.classic.length < 200 && i % 97 === 0) sample.classic.push(line);
  stats.games++;
  stats.moves += rec.n;
  stats.ends[END[rec.rt] || 'other'] = (stats.ends[END[rec.rt] || 'other'] || 0) + 1;
  if (rec.w === 1) stats.red++; else if (rec.w === 2) stats.blue++; else stats.none++;
  for (const seat of [0, 1]) {
    const own = ownView(L[seat], seat);
    nSetups++;
    own.forEach((r, k) => { if (r >= 0) counts[r][k]++; });
    const won = rec.w === seat + 1;
    const fd = Math.floor(own.indexOf(E.FLAG) / 10);
    stats.flagDepth[fd]++;
    if (rec.w === 1 || rec.w === 2) { stats.flagDepthGames[fd]++; if (won) stats.flagDepthWins[fd]++; }
    const fk = own.indexOf(E.FLAG);
    if (fk === 30 || fk === 39) stats.corner++;
    if (rec.w === 1 || rec.w === 2) {
      const b = flagBombed(own) ? stats.bombed : stats.open;
      b.games++;
      if (won) b.wins++;
    }
    if (won && rec.n >= 150 && rec.rt === 1) winners.push(own);
  }
}
// pick 400 winning setups spread through the archive
const step = Math.max(1, Math.floor(winners.length / 400));
const setups = [];
for (let k = 0; k < winners.length && setups.length < 400; k += step) setups.push(winners[k]);
const enc = own => own.map(r => (r < 0 ? '.' : 'FS23456789MB'[r])).join('');

const heat = counts.map(row => row.map(n => Math.round((n / nSetups) * 1000) / 1000));
const out = {
  source: 'gravon.de StraDoS2 archive (' + stats.games + ' classic games, 2003-2015)',
  setupsCount: nSetups,
  heat,
  setups: setups.map(enc),
  stats: {
    games: stats.games, redWins: stats.red, blueWins: stats.blue, noWinner: stats.none,
    avgMoves: Math.round(stats.moves / stats.games), ends: stats.ends,
    flagDepth: stats.flagDepth, flagDepthWins: stats.flagDepthWins, flagDepthGames: stats.flagDepthGames,
    flagBombed: stats.bombed, flagOpen: stats.open, flagCorner: stats.corner,
  },
};
const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'js', 'data.js'),
  '/* Built by tools/build-data.js from the gravon.de human game archive. Do not edit by hand. */\n' +
  '(function (root) { const D = ' + JSON.stringify(out) + ';\n' +
  "  if (typeof module === 'object' && module.exports) module.exports = D; else root.StrData = D;\n" +
  "})(typeof self !== 'undefined' ? self : this);\n");
fs.mkdirSync(path.join(root, 'tests', 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(root, 'tests', 'fixtures', 'gravon-sample.jsonl'), sample.classic.concat(sample.barrage).join('\n') + '\n');
console.log(JSON.stringify(out.stats, null, 1), 'setups', setups.length, 'winners', winners.length, 'sample', sample.classic.length, sample.barrage.length);
