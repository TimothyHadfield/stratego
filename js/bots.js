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
  /** Own view: can an enemy Scout reach the Flag in one run straight down its column? (lake columns are shielded) */
  function flagLaneOpen(own) {
    const f = own.indexOf(FLAG);
    if (f < 0) return false;
    const col = f % 10;
    if (col === 2 || col === 3 || col === 6 || col === 7) return false;
    for (let k = f - 10; k >= 0; k -= 10) if (own[k] >= 0) return false;
    return true;
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
    // never leave the Flag open to one Scout run down its column: put a piece (usually the Bomb) in front
    if (flagLaneOpen(own)) {
      const movers = [];
      for (let k = 0; k < 40; k++) if (own[k] >= 0 && k !== f) movers.push(k);
      const bomb = movers.find(k => own[k] === BOMB);
      const from = bomb !== undefined && rng() < 0.7 ? bomb : movers[(rng() * movers.length) | 0];
      own[f - 10] = own[from];
      own[from] = -1;
    }
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
  /** Own view: Flag on the back row and every square next to it (inside the setup) a Bomb. */
  function flagWalled(own) {
    const f = own.indexOf(FLAG);
    if (f < 30) return false;
    const nb = [f - 10];
    if (f % 10 > 0) nb.push(f - 1);
    if (f % 10 < 9) nb.push(f + 1);
    return nb.every(k => own[k] === BOMB);
  }
  /** Own view: the squares next to back-row square c that lie inside the setup (front, left, right). */
  function backNb(c) { const nb = [c - 10]; if (c % 10 > 0) nb.push(c - 1); if (c % 10 < 9) nb.push(c + 1); return nb; }
  /** Own view: wall a second back-row piece in with spare Bombs, so the real Flag has a twin (a decoy).
      Bombs next to the Flag stay put; returns null when no decoy square fits. */
  function addDecoyWall(own, rng) {
    const f = own.indexOf(FLAG);
    const keep = new Set([f].concat(backNb(f)));
    const spare = [];
    for (let k = 0; k < 40; k++) if (own[k] === BOMB && !keep.has(k)) spare.push(k);
    const spots = [];
    for (let c = 30; c < 40; c++) {
      if (Math.abs((c % 10) - (f % 10)) < 3 || own[c] === BOMB) continue;
      const need = backNb(c).filter(k => own[k] !== BOMB);
      if (backNb(c).some(k => keep.has(k)) || need.length > spare.filter(k => !backNb(c).includes(k) && k !== c).length) continue;
      spots.push(c);
    }
    if (!spots.length) return null;
    const c = spots[(rng() * spots.length) | 0];
    const out = own.slice();
    const pool = shuffle(spare.filter(k => !backNb(c).includes(k) && k !== c), rng);
    for (const k of backNb(c)) if (out[k] !== BOMB) { const b = pool.pop(); out[b] = out[k]; out[k] = BOMB; }
    return out;
  }
  /** Hard's Classic setup: a real setup with the Flag walled in by Bombs on the back row, picked among
      several shapes so a repeat player can't learn one spot: plain, or with a second (decoy) wall of
      Bombs around another back-row piece, so cracking one wall finds the Flag only half the time. */
  function hardClassicSetup(rng) {
    let s = null;
    for (let t = 0; t < 400 && !s; t++) { const r = realSetup(rng); if (r && flagWalled(r)) s = r; }
    if (!s) return null;
    const mix = T.flagMix || [1, 0];
    const roll = rng() * (mix[0] + mix[1]);
    if (roll < mix[0]) return s;
    return addDecoyWall(s, rng) || s;
  }
  /** Hard's Barrage setup: the Flag on the back row behind the Bomb, in a corner (one open side) most
      of the time, otherwise on another back-row square, so its spot isn't always the same. Off the
      corner it stands alone (sideEmpty 2: nothing beside it; measured 70.7% vs Medium alone, while
      pieces beside it gave the Flag away: 60-64%). */
  function hardBarrageSetup(rng) {
    const mix = T.barrage.flagMix || [1, 0];
    const corner = rng() * (mix[0] + mix[1]) < mix[0];
    for (let t = 0; t < 400; t++) {
      const s = barrageSetup(rng, true), f = s.indexOf(FLAG);
      if (s[f - 10] !== BOMB) continue;
      if (corner ? (f === 30 || f === 39) && (T.barrage.cornerFlag < 2 || s[f === 30 ? 31 : 38] >= 0)
        : f !== 30 && f !== 39 && (!T.barrage.sideEmpty || (s[f - 1] < 0) + (s[f + 1] < 0) >= T.barrage.sideEmpty)) return s;
    }
    return null;
  }
  /** A setup in own view for this level. */
  function chooseSetup(variant, level, rng) {
    if (variant === 'barrage') {
      if (level === 'hard' && T.barrage.cornerFlag) { const s = hardBarrageSetup(rng); if (s) return s; }
      return barrageSetup(rng, level !== 'easy');
    }
    if (level === 'easy') return randomSetup('classic', rng);
    if (level === 'hard' && T.safeSetup) { const s = hardClassicSetup(rng); if (s) return s; }
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

  // Hard's search settings (node tools may override them to measure)
  // flagMix: Hard's setup shapes, as weights [plain walled Flag, + decoy wall] (Classic) and
  // [back corner, other back-row square] (Barrage)
  const T = { K: 6, lookW: 0.7, baseW: 0.6, replyW: 0.85, blind: 0, ply3: 0, defW: 4, offW: 1.5, safeSetup: 1, guard: 3, gR: 4, still: 0,
    flagMix: [0.5, 0.5], barrage: { baseW: 0.2, defW: 10, still: 8, cornerFlag: 1, flagMix: [0.6, 0.4], sideEmpty: 2 } };

  // ------------------------------------------------------------------ the race for the Flag
  const RACE = [1.6, 1, 0.55, 0.3, 0.16, 0.08, 0.03];
  /** Moves-to-reach costs from every square to `target` (a Flag of `owner`) for the other side's pieces:
      an empty square or one of their own costs 1, a defender costs 3 (a fight), a Bomb only a Miner can
      pass (cost 2). Two maps: for Miners (cm) and for everyone else (cn). */
  function raceMaps(w, target, owner, cm, cn) {
    for (const [map, miner] of [[cm, true], [cn, false]]) {
      map.fill(99);
      map[target] = 0;
      const q = [target];
      while (q.length) {
        const y = q.shift();
        const r = w.own[y] === owner ? w.rk[y] : -1;
        const enter = y === target ? 1 : r === BOMB ? (miner ? 2 : 0) : r >= 0 ? 3 : 1;
        if (!enter) continue;
        const dy = map[y] + enter;
        for (const d of E.DIRS) {
          const x = y + d;
          if (x < 0 || x > 99 || (d === -1 && y % 10 === 0) || (d === 1 && y % 10 === 9) || E.IS_LAKE[x]) continue;
          if (dy < map[x]) { map[x] = dy; q.push(x); }
        }
      }
    }
  }
  /** How close the attackers (not `owner`) stand to `target`, summed over their movable pieces. */
  function flagRace(w, target, owner, cm, cn) {
    raceMaps(w, target, owner, cm, cn);
    let s = 0;
    for (let sq = 0; sq < 100; sq++) {
      if (w.own[sq] < 0 || w.own[sq] === owner) continue;
      const r = w.rk[sq];
      if (r === FLAG || r === BOMB) continue;
      const d = Math.ceil((r === MINER ? cm : cn)[sq]) - 1;
      if (d < RACE.length) s += RACE[d < 0 ? 0 : d] * (T.rw ? (r >= 8 ? 1.6 : r === MINER ? 1.2 : r >= 6 ? 1 : 0.6) : 1);
    }
    return s;
  }
  function findFlag(w, side) {
    for (let sq = 0; sq < 100; sq++) if (w.own[sq] === side && w.rk[sq] === FLAG) return sq;
    return -1;
  }
  function me0(g, f) { return g.board[f] >= 0 ? g.pieces[g.board[f]] : null; }
  /** In the look-ahead: does the enemy know the rank of my piece now on square b (after my move f->t)? */
  function shown(g, b, f, t, mover) {
    if (b === t) return !!(mover && (mover.rv || g.board[t] >= 0 || dist(f, t) > 1));
    const id = g.board[b];
    return id >= 0 && !!g.pieces[id].rv;
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
    // Barrage plays differently (8 pieces, short games): its own weights
    const P = pub.opts.variant === 'barrage' ? Object.assign({}, T, T.barrage) : T;
    const K = P.K;
    const worlds = Odds.guesses(pub, seat, K, { prior: pub.opts.variant === 'barrage' ? 'flat' : 'real', rng, burn: 800, gap: 200 });
    const look = new Float64Array(legal.length);
    const val = ctx.val;
    const strike = ctx.g.opts.scoutStrike;
    const buf = [];
    const cm = new Float32Array(100), cn = new Float32Array(100);
    let myFlag = -1;
    for (const [fid, fr] of mine.own) if (fr === FLAG && ctx.g.pieces[fid] && ctx.g.pieces[fid].pos >= 0) myFlag = ctx.g.pieces[fid].pos;
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
          let delta = out === 'att' ? -val[dr] : out === 'def' ? val[ar] : val[ar] - val[dr];
          if (P.blind && delta < 0 && !shown(ctx.g, b, f, t, me0(ctx.g, f))) delta *= P.blind;
          if (delta < worst) worst = delta;
        }
        let again = 0;
        if (P.ply3 && w.own[t] === seat) {
          // my follow-up: the best capture my moved piece could then make (a threat they must answer)
          genMoves(w, seat, strike, buf);
          for (const m of buf) {
            const a = (m / 100) | 0, b = m % 100;
            if (a !== t || w.own[b] !== 1 - seat) continue;
            const out = E.resolve(w.rk[a], w.rk[b], ctx.g.opts);
            const d = out === 'att' ? val[w.rk[b]] : out === 'def' ? -val[w.rk[a]] : val[w.rk[b]] - val[w.rk[a]];
            if (d > again) again = d;
          }
        }
        let plan = 0;
        if (P.defW || P.offW) {
          // the race for the Flags: how close enemy pieces stand to my Flag, and mine to theirs (in this guess)
          if (P.defW && myFlag >= 0) plan -= P.defW * flagRace(w, myFlag, seat, cm, cn);
          if (P.offW) { const ef = findFlag(w, 1 - seat); if (ef >= 0) plan += P.offW * flagRace(w, ef, 1 - seat, cm, cn); }
        }
        look[i] += gain + P.replyW * worst + P.ply3 * again + plan;
        w.own[f] = sv[0]; w.rk[f] = sv[1]; w.own[t] = sv[2]; w.rk[t] = sv[3];
      });
    }
    // guard the Flag: enemy pieces near it pull my pieces that can beat them toward them
    const guard = new Float64Array(legal.length);
    if (P.guard && myFlag >= 0) {
      const g = ctx.g, threats = [];
      for (let sq = 0; sq < 100; sq++) {
        const id = g.board[sq];
        if (id < 0 || g.pieces[id].o === seat) continue;
        const p = dist12(ctx, id);
        const mob = 1 - p[FLAG] - p[BOMB];
        const d = dist(sq, myFlag);
        if (mob > 0.05 && d <= P.gR) threats.push([sq, p, mob * (1 + (p[MINER] || 0) * 2) / d]);
      }
      if (threats.length) legal.forEach(([f, t], i) => {
        const r = g.pieces[g.board[f]].r;
        let s = 0;
        for (const [sq, p, wt] of threats) {
          let win = 0;
          for (let x = 0; x < 12; x++) if (p[x]) { const o = E.resolve(r, x, g.opts); if (o === 'att') win += p[x]; else if (o === 'both') win += p[x] * 0.4; }
          if (win < 0.35) continue;
          s += wt * win * (1 / (1 + dist(t, sq)) - 1 / (1 + dist(f, sq)));
        }
        guard[i] = s;
      });
    }
    // keep decoys: every piece that has never moved could still be the Flag to the enemy
    const still = P.still ? (() => {
      let n = 0;
      for (const p of ctx.g.pieces) if (p && p.o === seat && p.pos >= 0 && !p.mv) n++;
      return P.still / Math.max(1, n - 1);
    })() : 0;
    let best = -Infinity, pick = 0;
    legal.forEach((m, i) => {
      const v = (worlds.length ? look[i] / worlds.length : 0) * P.lookW + base[i] * P.baseW + P.guard * guard[i] + rng() * 0.1 -
        (still && !ctx.g.pieces[ctx.g.board[m[0]]].mv ? still : 0);
      if (v > best) { best = v; pick = i; }
    });
    return { from: legal[pick][0], to: legal[pick][1] };
  }

  /** Rescue variation: a piece of mine stands on the enemy back row and may bring back a lost piece.
      Easy takes any lost piece to any free square; Medium and Hard take the most valuable one to a square no
      enemy piece touches (Hard: next to the enemy piece deepest in my half, to deal with it; else near my Flag). */
  function chooseRescue(pub, mine, seat, level, rng) {
    const g = E.fromView(pub, mine);
    const own = {};
    for (const [id, r] of mine.own) own[id] = r;
    const ranks = [];
    for (const [o, id] of pub.dead) { const r = own[id]; if (o === seat && r !== undefined && r !== BOMB && r !== FLAG && !ranks.includes(r)) ranks.push(r); }
    const squares = [];
    for (let sq = 0; sq < 100; sq++) if ((seat === 0 ? sq >= 50 : sq < 50) && !E.IS_LAKE[sq] && !pub.cells[sq]) squares.push(sq);
    if (!ranks.length || !squares.length) return { type: 'rescue', skip: true };
    if (level === 'easy' || level === 'random') {
      return { type: 'rescue', r: ranks[(rng() * ranks.length) | 0], to: squares[(rng() * squares.length) | 0] };
    }
    const myCount = new Array(12).fill(0);
    for (const [id, r] of mine.own) if (g.pieces[id] && g.pieces[id].pos >= 0) myCount[r]++;
    const theirLeft = new Array(12).fill(1);
    if (pub.dead.some(d => d[0] !== seat && d[2] === MARSHAL)) theirLeft[MARSHAL] = 0;
    const val = values(myCount, theirLeft);
    let r = ranks[0];
    for (const x of ranks) if (val[x] > val[r]) r = x;
    const touched = sq => E.DIRS.some(d => {
      const t = sq + d;
      if (t < 0 || t > 99 || (d === -1 && sq % 10 === 0) || (d === 1 && sq % 10 === 9)) return false;
      const c = pub.cells[t];
      return c && c[0] !== seat;
    });
    const safe = squares.filter(sq => !touched(sq));
    const pool = safe.length ? safe : squares;
    if (level === 'medium') return { type: 'rescue', r, to: pool[(rng() * pool.length) | 0] };
    // hard: the deepest intruder in my half, otherwise my Flag
    const depth = sq => (seat === 0 ? Math.floor(sq / 10) : 9 - Math.floor(sq / 10)); // 5..9 = my half
    let aim = -1, deep = -1;
    pub.cells.forEach((c, sq) => { if (c && c[0] !== seat && depth(sq) >= 5 && depth(sq) > deep) { deep = depth(sq); aim = sq; } });
    if (aim < 0) for (const [id, x] of mine.own) if (x === FLAG && g.pieces[id] && g.pieces[id].pos >= 0) aim = g.pieces[id].pos;
    let best = pool[0], bs = Infinity;
    for (const sq of pool) { const s = (aim >= 0 ? dist(sq, aim) : 0) + rng() * 0.5; if (s < bs) { bs = s; best = sq; } }
    return { type: 'rescue', r, to: best };
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

  return { T, chooseSetup, chooseMove, chooseRescue, hint, rate, randomSetup, realSetup, barrageSetup, flagLaneOpen, values, myRank };
});
