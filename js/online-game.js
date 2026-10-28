/* The Stratego engine as the shared online module's `game` object (see _online/README.md).
   Seat 0 = Red (moves first), seat 1 = Blue. Setup is simultaneous: both seats are in toAct until each
   has sent its army. publicView never holds an unrevealed rank; privateView is one seat's own ranks. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./bots.js'));
  else root.StrOnlineGame = factory(root.StrEngine, root.StrBots);
})(typeof self !== 'undefined' ? self : this, function (E, Bots) {
  'use strict';
  const LEVELS = ['easy', 'medium', 'hard'];

  const game = {
    id: 'stratego',
    minSeats: 2,
    maxSeats: 2,
    // options: {variant, aggressor, silent, scoutStrike, twoSq, chase, rescue, bombOnce, level}
    setup(nSeats, options, rng, seats) {
      const g = E.newGame(options, (seats || []).map((s, i) => (s && s.name) || (i ? 'Blue' : 'Red')));
      g.level = LEVELS.includes(options && options.level) ? options.level : 'medium';
      return g;
    },
    toAct(state) { return E.toAct(state); },
    apply(state, seat, action) {
      if (!action || typeof action !== 'object') throw new Error('Bad move');
      return E.apply(state, seat, action);
    },
    publicView(state) { return E.publicView(state); },
    privateView(state, seat) { return E.privateView(state, seat); },
    bot(ctx, seat, rng) {
      const level = (ctx.state && ctx.state.level) || 'medium';
      const pub = ctx.pub;
      if (pub.phase === 'setup') {
        const own = Bots.chooseSetup(pub.opts.variant, level, rng);
        return { type: 'setup', layout: E.layoutFromOwn(own, seat) };
      }
      if (pub.pend && pub.pend.s === seat) return Bots.chooseRescue(pub, ctx.mine, seat, level, rng);
      const m = Bots.chooseMove(pub, ctx.mine, seat, level, rng);
      return m ? { type: 'move', from: m.from, to: m.to } : { type: 'resign' };
    },
    isOver(state) { return state.phase === 'over'; },
  };
  return { game, LEVELS };
});
