/* Background worker: plays quick test games for the setup analyzer without freezing the page. */
/* global importScripts, StrEngine, StrBots, StrOdds */
importScripts('engine.js?v=3', 'data.js?v=3', 'odds.js?v=3', 'bots.js?v=3');
self.onmessage = function (ev) {
  const m = ev.data || {};
  if (m.type !== 'test') return;
  const E = StrEngine, Bots = StrBots;
  const rng = StrOdds.mulberry(m.seed || 1);
  let wins = 0, losses = 0, draws = 0;
  for (let i = 0; i < m.n; i++) {
    const me = i % 2; // play both colours
    const g = E.newGame({ variant: m.variant });
    E.apply(g, me, { type: 'setup', layout: E.layoutFromOwn(m.own, me) });
    E.apply(g, 1 - me, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup(m.variant, 'medium', rng), 1 - me) });
    let quiet = 0;
    while (g.phase === 'play') {
      const s = g.turn;
      const mv = Bots.chooseMove(E.publicView(g), E.privateView(g, s), s, 'medium', rng);
      if (!mv) { E.apply(g, s, { type: 'resign' }); break; }
      const rec = E.doMove(g, s, mv.from, mv.to);
      quiet = rec.b ? 0 : quiet + 1;
      if (quiet >= 600 || g.ply >= 3000) break;
    }
    if (g.phase !== 'over' || g.result.winner === -1) draws++;
    else if (g.result.winner === me) wins++; else losses++;
    self.postMessage({ type: 'progress', done: i + 1, n: m.n, wins, losses, draws });
  }
  self.postMessage({ type: 'done', wins, losses, draws, n: m.n });
};
