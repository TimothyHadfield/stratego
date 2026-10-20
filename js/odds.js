/* Odds layer: for each enemy piece you can't see, the chance it is each rank, using only what you could
   know at the table: which pieces have moved, which moved like Scouts, what fights showed, and what is
   left of the enemy army. Two kinds of prior:
   - 'flat': every setup that fits the facts is equally likely (exact counting where the facts are simple)
   - 'real': setups weighted by where 42,000 real players put each rank (gravon.de archive, js/data.js)
   Method: Markov-chain sampling over rank assignments (swaps and 3-cycles that respect each piece's
   possible ranks), checked in tests against brute force and the exact flat formula. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./data.js'));
  else root.StrOdds = factory(root.StrEngine, root.StrData);
})(typeof self !== 'undefined' ? self : this, function (E, D) {
  'use strict';
  const ALL = 0xfff;
  const NOT_STILL = ALL & ~(1 << E.FLAG) & ~(1 << E.BOMB);

  function mulberry(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /** The facts about the enemy of `seat` from a public view: unknown pieces with their possible ranks,
      and how many of each rank are still unaccounted for. */
  function facts(pub, seat) {
    const enemy = 1 - seat;
    const left = E.ARMIES[pub.opts.variant].slice();
    const unknown = []; // {id, sq (-1 if captured), mask}
    pub.cells.forEach((c, sq) => {
      if (!c || c[0] !== enemy) return;
      const [, id, r, fl] = c;
      if (r !== null) { left[r]--; return; }
      let mask = ALL;
      if (fl & 1) mask &= NOT_STILL;
      if (pub.cons && pub.cons[id] !== undefined) mask &= pub.cons[id];
      unknown.push({ id, sq, mask });
    });
    for (const [o, id, r] of pub.dead) {
      if (o !== enemy) continue;
      if (r !== null) { left[r]--; continue; }
      let mask = ALL & ~(1 << E.FLAG); // a captured Flag would have ended the game
      if (pub.cons && pub.cons[id] !== undefined) mask &= pub.cons[id];
      unknown.push({ id, sq: -1, mask });
    }
    return { enemy, left, unknown };
  }

  function priorWeights(unknown, enemy, prior) {
    // w[i][r]: how typical rank r is on piece i's starting square
    return unknown.map(u => {
      const w = new Float64Array(12);
      const k = E.ownK(u.id, enemy);
      for (let r = 0; r < 12; r++) w[r] = prior === 'real' && D ? D.heat[r][k] + 0.002 : 1;
      return w;
    });
  }

  /** Find any assignment of the leftover ranks to the unknown pieces that fits every mask (bipartite matching). */
  function firstAssignment(unknown, left) {
    const slots = [];
    left.forEach((n, r) => { for (let k = 0; k < n; k++) slots.push(r); });
    const n = unknown.length;
    if (slots.length !== n) return null;
    const slotOf = new Array(n).fill(-1), pieceOf = new Array(n).fill(-1);
    function aug(i, seen) {
      for (let s = 0; s < n; s++) {
        if (seen[s] || !(unknown[i].mask & (1 << slots[s]))) continue;
        seen[s] = 1;
        if (pieceOf[s] < 0 || aug(pieceOf[s], seen)) { pieceOf[s] = i; slotOf[i] = s; return true; }
      }
      return false;
    }
    for (let i = 0; i < n; i++) if (!aug(i, new Uint8Array(n))) return null;
    return slotOf.map(s => slots[s]);
  }

  /** Sample rank assignments. Returns {probs: [Float64Array(12) per unknown], draw()}. */
  function sampler(unknown, left, weights, rng) {
    const n = unknown.length;
    let cur = firstAssignment(unknown, left);
    if (!cur) return null;
    const ok = (i, r) => (unknown[i].mask >> r) & 1;
    function step() {
      if (n < 2) return;
      const i = (rng() * n) | 0;
      let j = (rng() * (n - 1)) | 0; if (j >= i) j++;
      const a = cur[i], b = cur[j];
      if (rng() < 0.8 || n < 3) {
        if (a === b || !ok(i, b) || !ok(j, a)) return;
        const ratio = (weights[i][b] * weights[j][a]) / (weights[i][a] * weights[j][b]);
        if (ratio >= 1 || rng() < ratio) { cur[i] = b; cur[j] = a; }
      } else {
        let k = (rng() * (n - 2)) | 0; if (k >= Math.min(i, j)) k++; if (k >= Math.max(i, j)) k++;
        const c = cur[k];
        // i<-b, j<-c, k<-a
        if (!ok(i, b) || !ok(j, c) || !ok(k, a)) return;
        const ratio = (weights[i][b] * weights[j][c] * weights[k][a]) / (weights[i][a] * weights[j][b] * weights[k][c]);
        if (ratio >= 1 || rng() < ratio) { cur[i] = b; cur[j] = c; cur[k] = a; }
      }
    }
    return { step, get cur() { return cur; } };
  }

  /** Exact answer when every unknown piece is either "anything" or "moved" and the prior is flat. */
  function exactFlat(unknown, left) {
    if (unknown.some(u => u.mask !== ALL && u.mask !== NOT_STILL)) return null;
    const still = left[E.FLAG] + left[E.BOMB];
    const mov = left.reduce((a, b) => a + b, 0) - still;
    const U = unknown.filter(u => u.mask === ALL).length;
    if (U < still) return null;
    return unknown.map(u => {
      const p = new Float64Array(12);
      for (let r = 0; r < 12; r++) {
        const stillRank = r === E.FLAG || r === E.BOMB;
        if (u.mask === NOT_STILL) p[r] = stillRank || !mov ? 0 : left[r] / mov;
        else p[r] = stillRank ? left[r] / U : (mov ? ((U - still) / U) * (left[r] / mov) : 0);
      }
      return p;
    });
  }

  /**
   * Chances for every enemy piece `seat` can't see.
   * @returns {byId: {id: Float64Array(12)}, left: counts, unknown: [...], sampler?}
   */
  function analyze(pub, seat, o) {
    o = o || {};
    const prior = o.prior === 'flat' ? 'flat' : 'real';
    const f = facts(pub, seat);
    const res = { byId: {}, left: f.left, unknown: f.unknown, exact: false, ok: true };
    if (!f.unknown.length) return res;
    if (prior === 'flat' && !o.forceSample) {
      const ex = exactFlat(f.unknown, f.left);
      if (ex) { f.unknown.forEach((u, i) => { res.byId[u.id] = ex[i]; }); res.exact = true; return res; }
    }
    const weights = priorWeights(f.unknown, f.enemy, prior);
    const rng = mulberry(o.seed == null ? (pub.ply || 0) * 7919 + 17 : o.seed);
    const s = sampler(f.unknown, f.left, weights, rng);
    if (!s) { res.ok = false; return res; } // facts contradict each other (should not happen)
    const n = f.unknown.length;
    const steps = o.steps || 40000;
    const burn = Math.min(4000, steps / 4);
    const acc = f.unknown.map(() => new Float64Array(12));
    for (let t = 0; t < burn; t++) s.step();
    let kept = 0;
    for (let t = 0; t < steps; t++) {
      s.step();
      if (t % 4 === 0) { const cur = s.cur; for (let i = 0; i < n; i++) acc[i][cur[i]]++; kept++; }
    }
    f.unknown.forEach((u, i) => { for (let r = 0; r < 12; r++) acc[i][r] /= kept; res.byId[u.id] = acc[i]; });
    res.sampler = s;
    return res;
  }

  /** Draw k full guesses of the enemy army (id -> rank) from the same model, for the computer's look-ahead. */
  function guesses(pub, seat, k, o) {
    o = o || {};
    const f = facts(pub, seat);
    const weights = priorWeights(f.unknown, f.enemy, o.prior === 'flat' ? 'flat' : 'real');
    const rng = o.rng || mulberry(o.seed || 1);
    const s = sampler(f.unknown, f.left, weights, rng);
    if (!s) return [];
    const out = [];
    for (let t = 0; t < (o.burn || 1500); t++) s.step();
    for (let j = 0; j < k; j++) {
      for (let t = 0; t < (o.gap || 300); t++) s.step();
      const m = {};
      f.unknown.forEach((u, i) => { m[u.id] = s.cur[i]; });
      out.push(m);
    }
    return out;
  }

  /** Expected result of attacking an enemy piece with rank distribution p using my rank `mine`. */
  function fightOdds(mine, p, opts) {
    const o = { win: 0, lose: 0, tie: 0 };
    for (let r = 0; r < 12; r++) {
      if (!p[r]) continue;
      const out = E.resolve(mine, r, opts);
      if (out === 'att') o.win += p[r]; else if (out === 'def') o.lose += p[r]; else o.tie += p[r];
    }
    return o;
  }

  return { analyze, guesses, facts, fightOdds, exactFlat, firstAssignment, sampler, mulberry, ALL, NOT_STILL };
});
