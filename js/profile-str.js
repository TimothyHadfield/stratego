/* Stratego's part of the player profile (shared kit js/profile.js: never edit that one here).
   The computer levels' ratings, the achievement list, today's Daily game, and turning a finished
   game into a Profile.recordResult input. Works in the browser (window.StrProfile) and node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.StrProfile = factory(root.StrEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  // Elo of each level from the measured games between them (js/strength-data.js, Classic):
  // Medium beats Easy ~89% (+360), Hard beats Medium ~72% (+165). Easy anchored at 1000.
  const LEVELS = [
    { id: 'easy', name: 'Easy', rating: 1000 },
    { id: 'medium', name: 'Medium', rating: 1360 },
    { id: 'hard', name: 'Hard', rating: 1525 },
  ];
  const RANK = { easy: 0, medium: 1, hard: 2 };
  const won = c => !!(c.last && c.last.won);
  const ex = c => (c.last && c.last.extra) || {};
  const achievements = () => [
    { id: 'first', title: 'First win', desc: 'Win a game', test: c => c.stats.wins >= 1 },
    { id: 'medium', title: 'Field officer', desc: 'Beat Medium', test: c => won(c) && RANK[c.last.level] >= 1 },
    { id: 'hard', title: 'Field marshal', desc: 'Beat Hard', test: c => won(c) && c.last.level === 'hard' },
    { id: 'barrage', title: 'Eight against eight', desc: 'Win a Barrage game', test: c => won(c) && ex(c).variant === 'barrage' },
    { id: 'spy', title: 'Silent knife', desc: 'Your Spy takes their Marshal', test: c => ex(c).spyKill >= 1 },
    { id: 'defuse', title: 'Sapper', desc: 'Your Miners clear 3 Bombs in one game', test: c => ex(c).defused >= 3 },
    { id: 'intact', title: 'Untouchable', desc: 'Win with your Marshal never taken', test: c => won(c) && ex(c).variant === 'classic' && !ex(c).marshalLost },
    { id: 'quick', title: 'Lightning raid', desc: 'Take the Flag within 60 of your moves', test: c => won(c) && ex(c).why === 'flag' && ex(c).myMoves <= 60 },
    { id: 'streak', title: 'Hat trick', desc: 'Win 3 in a row', test: c => c.stats.bestStreak >= 3 },
    { id: 'daily', title: 'Daily soldier', desc: '3-day Daily streak', test: c => c.daily.streak >= 3 },
  ];

  /** Facts about one side's game, from the public move list (what the achievements need). */
  function extra(pub, me) {
    const out = { variant: pub.opts.variant, why: (pub.result && pub.result.why) || '', myMoves: 0, spyKill: 0, defused: 0, marshalLost: false };
    for (const h of pub.hist || []) {
      if (h.s === me) out.myMoves++;
      const b = h.b;
      if (!b) continue;
      if (h.s === me) {
        if (b.ar === E.SPY && b.dr === E.MARSHAL && b.out === 'att') out.spyKill++;
        if (b.ar === E.MINER && b.dr === E.BOMB && b.out === 'att') out.defused++;
        if (b.ar === E.MARSHAL && b.out !== 'att') out.marshalLost = true;
      } else if (b.dr === E.MARSHAL && b.out !== 'def') out.marshalLost = true;
    }
    return out;
  }

  /** A finished game vs the computer -> Profile.recordResult input. helped: Hint or Undo was used ->
      "with help", not rated. */
  function result(pub, me, level, opts) {
    opts = opts || {};
    const w = pub.result ? pub.result.winner : -1;
    const mode = opts.helped ? 'help' : 'computer';
    return { mode, level: mode === 'computer' && RANK[level] != null ? level : null, won: w === me, draw: w === -1, daily: !!opts.daily, extra: extra(pub, me) };
  }

  /** Today's Daily game: Classic with the rulebook's rules, you (Red) against Hard. The computer's army
      comes from the day's seed, so everyone faces the same army that day. */
  function dailyGame(rng, Bots) {
    return { variant: 'classic', level: 'hard', color: 0, rules: { scoutStrike: true, twoSq: 3, chase: true, aggressor: false, silent: false },
      enemy: Bots.chooseSetup('classic', 'hard', rng) };
  }

  return { LEVELS, achievements, extra, result, dailyGame };
});
