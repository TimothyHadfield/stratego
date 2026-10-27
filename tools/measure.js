/* Measure the computer levels against each other. Colours alternate; a game with no capture for
   600 moves, or 3000 moves in all, counts as a draw (real players would agree one).
   Run: node tools/measure.js <games per pairing> [variant] [pairings e.g. hard-medium,medium-easy]
   Uses all CPU cores (worker_threads). Prints win rates with 95% intervals as JSON at the end. */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const E = require('../js/engine.js');
const Bots = require('../js/bots.js');
const Odds = require('../js/odds.js');
if (process.env.TUNE) Object.assign(Bots.T, JSON.parse(process.env.TUNE)); // e.g. TUNE='{"K":12}' to try Hard settings

function playOne(levels, variant, seed) {
  const rng = Odds.mulberry(seed);
  const g = E.newGame({ variant });
  for (const s of [0, 1]) E.apply(g, s, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup(variant, levels[s], rng), s) });
  let quiet = 0;
  while (g.phase === 'play') {
    const s = g.turn;
    const pub = E.publicView(g);
    const m = Bots.chooseMove(pub, E.privateView(g, s), s, levels[s], rng);
    if (!m) { E.apply(g, s, { type: 'resign' }); break; }
    const rec = E.doMove(g, s, m.from, m.to);
    quiet = rec.b ? 0 : quiet + 1;
    if (quiet >= 600 || g.ply >= 3000) return { winner: -1, plies: g.ply, why: 'cap' };
  }
  return { winner: g.result.winner, plies: g.ply, why: g.result.why };
}

if (!isMainThread) {
  const { jobs } = workerData;
  for (const j of jobs) {
    const r = playOne(j.levels, j.variant, j.seed);
    parentPort.postMessage(Object.assign({ key: j.key, aSeat: j.aSeat }, r));
  }
  parentPort.postMessage({ done: true });
} else {
  const n = +process.argv[2] || 50;
  const variant = process.argv[3] || 'classic';
  const pairs = (process.argv[4] || 'hard-medium,hard-easy,medium-easy').split(',');
  const jobs = [];
  let seed = 1;
  for (const p of pairs) {
    const [a, b] = p.split('-');
    for (let i = 0; i < n; i++) {
      const aSeat = i % 2;
      const levels = aSeat === 0 ? [a, b] : [b, a];
      jobs.push({ key: p, aSeat, levels, variant, seed: seed++ * 7777 });
    }
  }
  const cores = Math.max(1, +process.env.WORKERS || os.cpus().length - 1); // WORKERS=n caps threads (memory)
  const per = Array.from({ length: cores }, () => []);
  jobs.forEach((j, i) => per[i % cores].push(j));
  const tally = {};
  let left = cores;
  const t0 = Date.now();
  for (const js of per) {
    const w = new Worker(__filename, { workerData: { jobs: js } });
    w.on('message', m => {
      if (m.done) { if (--left === 0) report(); return; }
      const t = tally[m.key] || (tally[m.key] = { games: 0, aWins: 0, bWins: 0, draws: 0, plies: 0, ends: {} });
      t.games++; t.plies += m.plies; t.ends[m.why] = (t.ends[m.why] || 0) + 1;
      if (m.winner === -1) t.draws++; else if (m.winner === m.aSeat) t.aWins++; else t.bWins++;
    });
    w.on('error', e => { console.error(e); process.exit(1); });
  }
  function report() {
    const out = {};
    for (const [k, t] of Object.entries(tally)) {
      const score = (t.aWins + 0.5 * t.draws) / t.games;
      const se = Math.sqrt(score * (1 - score) / t.games);
      out[k] = { games: t.games, firstWins: t.aWins, secondWins: t.bWins, draws: t.draws, firstScore: +(score * 100).toFixed(1),
        ci95: '+/-' + (1.96 * se * 100).toFixed(1), avgMoves: Math.round(t.plies / t.games), ends: t.ends };
    }
    console.log(JSON.stringify({ variant, seconds: Math.round((Date.now() - t0) / 1000), results: out }, null, 1));
  }
}
