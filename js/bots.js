/* Computer players. They only use what a real player at the table could know: their own pieces plus the
   public view (what moved, what fights showed). Levels:
   - easy:   random setup with the Flag on the back row; moves mostly at random, takes sure wins
   - medium: a real human setup; picks the move with the best expected result using the flat odds
   - hard:   a real human setup; samples several guesses of the enemy army from the real-setup odds and
             looks two moves ahead in each (its move, the opponent's best answer), plus a hunting plan */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./odds.js'), require('./data.js'));
  else root.StrBots = factory(root.StrEngine, root.StrOdds, root.StrData);
})(typeof self !== 'undefined' ? self : this, function (E, Odds, D) {
  'use strict';
  const { FLAG, SPY, SCOUT, MINER, MARSHAL, BOMB } = E;
  const CODE = 'FS23456789MB';
  const FLAG_VALUE = 150; // about the whole enemy army: taking the Flag wins

  // ------------------------------------------------------------------ setups (own view: k = depth*10 + col)
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function armyList(variant) { const out = []; E.ARMIES[variant].forEach((n, r) => { for (let k = 0; k < n; k++) out.push(r); }); return out; }

  function randomSetup(variant, rng) {
    if (variant === 'barrage') return barrageSetup(rng, false);
    const own = new Array(40).fill(-1);
    const flagK = 30 + ((rng() * 10) | 0);
    own[flagK] = FLAG;
    const rest = shuffle(armyList('classic').filter(r => r !== FLAG), rng);
    let j = 0;
    for (let k = 0; k < 40; k++) if (own[k] < 0) own[k] = rest[j++];
    return own;
  }
  function barrageSetup(rng, careful) {
    const own = new Array(40).fill(-1);
    const free = k => own[k] < 0;
    const pick = ks => { const c = ks.filter(free); return c[(rng() * c.length) | 0]; };
    const range = (d0, d1) => { const o = []; for (let d = d0; d <= d1; d++) for (let c = 0; c < 10; c++) o.push(d * 10 + c); return o; };
    const f = pick(careful ? range(3, 3) : range(2, 3));
    own[f] = FLAG;
    const nb = [f - 10, f % 10 > 0 ? f - 1 : -1, f % 10 < 9 ? f + 1 : -1].filter(k => k >= 0 && free(k));
    own[careful && nb.length && rng() < 0.6 ? nb[(rng() * nb.length) | 0] : pick(range(1, 3))] = BOMB;
    own[pick(range(1, 2))] = MARSHAL;
    own[pick(range(1, 2))] = E.GENERAL;
    own[pick(range(1, 3))] = SPY;
    own[pick(range(1, 3))] = MINER;
    own[pick(range(0, 1))] = SCOUT;
    own[pick(range(0, 1))] = SCOUT;
    return own;
  }
  function realSetup(rng) {
    if (!D || !D.setups || !D.setups.length) return null;
    const s = D.setups[(rng() * D.setups.length) | 0];
    const own = s.split('').map(ch => CODE.indexOf(ch));
    if (rng() < 0.5) { // mirror left-right for variety
      const m = own.slice();
      for (let k = 0; k < 40; k++) m[Math.floor(k / 10) * 10 + (9 - (k % 10))] = own[k];
      return m;
    }
    return own;
  }
  /** A setup in own view for this level. */
  function chooseSetup(variant, level, rng) {
    if (variant === 'barrage') return barrageSetup(rng, level !== 'easy');
    if (level === 'easy') return randomSetup('classic', rng);
    return realSetup(rng) || randomSetup('classic', rng);
  }

  // ------------------------------------------------------------------ values
  function values(myRanks, theirLeft) {
    // what each rank is worth to its owner; the Spy matters while the enemy Marshal lives,
    // Miners matter more when few are left
    const v = [FLAG_VALUE, 2, 1.6, 3.5, 2.2, 2.8, 4, 5.5, 7.5, 11, 16, 2.5];
    if (theirLeft && !theirLeft[MARSHAL]) v[SPY] = 0.8;
    if (myRanks && myRanks[MINER] !== undefined && myRanks[MINER] <= 2) v[MINER] = 6;
    return v;
  }

  // ------------------------------------------------------------------ a light board for look-ahead
  // own[sq]: -1 empty, 0/1 owner; rk[sq]: rank (exact in a guessed world)
  function worldFrom(g, seat, guess) {
    const own = new Int8Array(100).fill(-1), rk = new Int8Array(100).fill(-1);
    for (let sq = 0; sq < 100; sq++) {
      const id = g.board[sq];
      if (id < 0) continue;
      const p = g.pieces[id];
      own[sq] = p.o;
      rk[sq] = p.r >= 0 ? p.r : (guess && guess[id] !== undefined ? guess[id] : 4);
    }
    return { own, rk };
  }
  function genMoves(w, side, strike, out) {
    out.length = 0;
    for (let sq = 0; sq < 100; sq++) {
      if (w.own[sq] !== side) continue;
      const r = w.rk[sq];
      if (r === FLAG || r === BOMB) continue;
      for (const d of E.DIRS) {
        let t = sq, dist = 0;
        while (true) {
          const col = t % 10;
          if ((d === -1 && col === 0) || (d === 1 && col === 9)) break;
          t += d;
          if (t < 0 || t > 99 || E.IS_LAKE[t]) break;
          dist++;
          if (w.own[t] >= 0) { if (w.own[t] !== side && (dist === 1 || strike)) out.push(sq * 100 + t); break; }
          out.push(sq * 100 + t);
          if (r !== SCOUT) break;
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ move choice
  function dist(a, b) { return Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) + Math.abs((a % 10) - (b % 10)); }

  function context(pub, mine, seat, prior) {
    const g = E.fromView(pub, mine);
    const legal = E.legalMoves(g, seat);
    const odds = Odds.analyze(pub, seat, { prior: pub.opts.variant === 'barrage' ? 'flat' : prior, steps: prior === 'real' ? 12000 : 8000 });
    const myCount = new Array(12).fill(0);
    for (const [id, r] of mine.own) if (g.pieces[id] && g.pieces[id].pos >= 0) myCount[r]++;
    return { g, legal, odds, val: values(myCount, odds.left), myCount };
  }

  /** Probability an enemy piece is each rank (known pieces are certain). */
  function dist12(ctx, id) {
    const p = ctx.g.pieces[id];
    if (p.r >= 0) { const a = new Float64Array(12); a[p.r] = 1; return a; }
    return ctx.odds.byId[id] || new Float64Array(12).fill(1 / 12);
  }

  /** Expected gain of attacking `def` with my piece of rank r (in my piece-value units). */
  function attackEV(ctx, r, defId, myRevealed) {
    const p = dist12(ctx, defId);
    const { val } = ctx;
    const o = ctx.g.opts;
    let ev = 0;
    for (let x = 0; x < 12; x++) {
      if (!p[x]) continue;
      const out = E.resolve(r, x, o);
      const theirs = val[x];
      if (out === 'att') ev += p[x] * theirs;
      else if (out === 'def') ev -= p[x] * val[r];
      else ev += p[x] * (theirs - val[r]);
    }
    if (!ctx.g.pieces[defId].rv) ev += 0.5;          // learning what it is is worth something
    if (!myRevealed) ev -= 0.06 * val[r];           // showing my own rank costs a little
    return ev;
  }

  /** How threatened my piece of rank r would be on square sq (expected loss), from enemy pieces next to it. */
  function danger(ctx, seat, r, sq, revealed, ignoreId) {
    const g = ctx.g;
    let worst = 0;
    for (const d of E.DIRS) {
      const t = sq + d;
      if (t < 0 || t > 99 || (d === -1 && sq % 10 === 0) || (d === 1 && sq % 10 === 9)) continue;
      const id = g.board[t];
      if (id < 0 || id === ignoreId) continue;
      const e = g.pieces[id];
      if (e.o === seat || !E.movable(e.r < 0 ? 4 : e.r)) continue;
      const p = dist12(ctx, id);
      let lose = 0;
      for (let x = 0; x < 12; x++) if (p[x] && x !== FLAG && x !== BOMB) {
        const out = E.resolve(x, r, g.opts);
        if (out === 'att') lose += p[x]; else if (out === 'both') lose += p[x] * 0.5;
      }
      // an enemy that can't see my rank attacks less often
      const willing = revealed ? 0.9 : 0.45;
      worst = Math.max(worst, lose * willing * ctx.val[r]);
    }
    return worst;
  }

  /** Pull toward good targets: best (attack value / distance) from square sq for my rank r. */
  function pull(ctx, seat, r, sq) {
    const g = ctx.g;
    let best = 0;
    for (let t = 0; t < 100; t++) {
      const id = g.board[t];
      if (id < 0) continue;
      const e = g.pieces[id];
      if (e.o === seat) continue;
      const ev = attackEV(ctx, r, id, true) - 0.5;
      if (ev <= 0) continue;
      const s = ev / (1 + dist(sq, t));
      if (s > best) best = s;
    }
    return best;
  }

  function myRank(mine, id) {
    for (const [i, r] of mine.own) if (i === id) return r;
    return -1;
  }

  function scoreMove(ctx, seat, mine, from, to, level) {
    const g = ctx.g;
    const id = g.board[from];
    const me = g.pieces[id];
    const r = me.r;
    const tid = g.board[to];
    let s = 0;
    if (tid >= 0) {
      s += attackEV(ctx, r, tid, me.rv);
      // if I win, my piece stands revealed on the target square
      const p = dist12(ctx, tid);
      let winP = 0;
      for (let x = 0; x < 12; x++) if (p[x] && E.resolve(r, x, g.opts) === 'att') winP += p[x];
      if (p[FLAG] > 0.999) return 1e6;
      s -= winP * danger(ctx, seat, r, to, true, tid) * 0.8;
    } else {
      const dNow = danger(ctx, seat, r, from, me.rv, -1);
      const dNew = danger(ctx, seat, r, to, me.rv || Math.abs(to - from) > 10 || (Math.abs(to - from) > 1 && Math.abs(to - from) < 10), -1);
      s += dNow - dNew;
      if (level !== 'easy') s += 1.2 * (pull(ctx, seat, r, to) - pull(ctx, seat, r, from));
      const fwd = seat === 0 ? Math.floor(from / 10) - Math.floor(to / 10) : Math.floor(to / 10) - Math.floor(from / 10);
      s += 0.04 * fwd * (r === SCOUT || r === MINER ? 0.5 : 1);
      if (r === SCOUT && dist(from, to) > 1) s -= 0.15; // moving far shows it's a Scout
      // a piece that leaves a square next to my own Flag opens it up
      for (const [fid, fr] of mine.own) if (fr === FLAG && g.pieces[fid] && g.pieces[fid].pos >= 0 && E.adjacent(from, g.pieces[fid].pos) && r !== SCOUT) s -= 0.3;
    }
    return s;
  }

  function chooseMove(pub, mine, seat, level, rng) {
    level = level || 'medium';
    const ctx = context(pub, mine, seat, level === 'hard' ? 'real' : 'flat');
    const legal = ctx.legal;
    if (!legal.length) return null;
    if (level === 'random') { const m = legal[(rng() * legal.length) | 0]; return { from: m[0], to: m[1] }; }
    if (level === 'easy') {
      // take a sure capture, avoid a sure loss, otherwise random
      const scored = legal.map(([f, t]) => {
        const tid = ctx.g.board[t];
        let s = rng();
        if (tid >= 0) {
          const o = Odds.fightOdds(ctx.g.pieces[ctx.g.board[f]].r, dist12(ctx, tid), ctx.g.opts);
          s += o.win > 0.99 ? 3 : o.lose > 0.99 ? -3 : 0.3;
        }
        return [s, f, t];
      });
      scored.sort((a, b) => b[0] - a[0]);
      return { from: scored[0][1], to: scored[0][2] };
    }
    const base = legal.map(([f, t]) => scoreMove(ctx, seat, mine, f, t, level));
    if (level === 'medium') {
      let best = -Infinity, pick = 0;
      base.forEach((s, i) => { const v = s + rng() * 0.25; if (v > best) { best = v; pick = i; } });
      return { from: legal[pick][0], to: legal[pick][1] };
    }
    // hard: two-move look-ahead in sampled worlds, blended with the one-move score
    const K = 6;
    const worlds = Odds.guesses(pub, seat, K, { prior: pub.opts.variant === 'barrage' ? 'flat' : 'real', rng, burn: 800, gap: 200 });
    const look = new Float64Array(legal.length);
    const val = ctx.val;
    const strike = ctx.g.opts.scoutStrike;
    const buf = [];
    for (const guess of worlds) {
      const w = worldFrom(ctx.g, seat, guess);
      legal.forEach(([f, t], i) => {
        // my move
        const sv = [w.own[f], w.rk[f], w.own[t], w.rk[t]];
        let gain = 0;
        if (w.own[t] >= 0) {
          const out = E.resolve(w.rk[f], w.rk[t], ctx.g.opts);
          if (w.rk[t] === FLAG) { look[i] += FLAG_VALUE * 4; return; }
          if (out === 'att') { gain += val[w.rk[t]]; w.own[t] = seat; w.rk[t] = w.rk[f]; w.own[f] = -1; }
          else if (out === 'def') { gain -= val[w.rk[f]]; w.own[f] = -1; }
          else { gain += val[w.rk[t]] - val[w.rk[f]]; w.own[f] = -1; w.own[t] = -1; }
        } else { w.own[t] = seat; w.rk[t] = w.rk[f]; w.own[f] = -1; }
        // their best answer (they are assumed to know my ranks: careful play)
        genMoves(w, 1 - seat, strike, buf);
        let worst = 0;
        for (const m of buf) {
          const a = (m / 100) | 0, b = m % 100;
          if (w.own[b] !== seat) continue;
          const ar = w.rk[a], dr = w.rk[b];
          if (dr === FLAG) { worst = -FLAG_VALUE * 4; break; }
          const out = E.resolve(ar, dr, ctx.g.opts);
          const delta = out === 'att' ? -val[dr] : out === 'def' ? val[ar] : val[ar] - val[dr];
          if (delta < worst) worst = delta;
        }
        look[i] += gain + 0.85 * worst;
        w.own[f] = sv[0]; w.rk[f] = sv[1]; w.own[t] = sv[2]; w.rk[t] = sv[3];
      });
    }
    let best = -Infinity, pick = 0;
    legal.forEach((m, i) => {
      const v = (worlds.length ? look[i] / worlds.length : 0) * 0.7 + base[i] * 0.6 + rng() * 0.1;
      if (v > best) { best = v; pick = i; }
    });
    return { from: legal[pick][0], to: legal[pick][1] };
  }

  /** Best move for a hint (hard-level choice) plus its one-move score for each legal move. */
  function hint(pub, mine, seat, rng) {
    return chooseMove(pub, mine, seat, 'hard', rng || Math.random);
  }

  /** One-move scores (piece-value units) for every legal move: used by Study to show "points lost". */
  function rate(pub, mine, seat) {
    const ctx = context(pub, mine, seat, pub.opts.variant === 'barrage' ? 'flat' : 'real');
    return { legal: ctx.legal, scores: ctx.legal.map(([f, t]) => scoreMove(ctx, seat, mine, f, t, 'medium')) };
  }

  return { chooseSetup, chooseMove, hint, rate, randomSetup, realSetup, barrageSetup, values, myRank };
});
