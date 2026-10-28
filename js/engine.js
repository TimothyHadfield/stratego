/* Stratego engine: rules only, no screen code. Works in the browser (window.StrEngine) and node.
   Squares are 0..99, row = floor(i / 10) from the top, col = i % 10. Red (seat 0) sets up on rows 6-9
   and moves first; Blue (seat 1) sets up on rows 0-3. Lakes: rows 4-5, cols 2-3 and 6-7.
   Ranks are stored as strength: Flag 0, Spy 1, Scout 2, Miner 3 ... Marshal 10, Bomb 11.
   A piece's id is the square it started on, so ids never hint at ranks. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StrEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FLAG = 0, SPY = 1, SCOUT = 2, MINER = 3, SERGEANT = 4, LIEUTENANT = 5, CAPTAIN = 6,
    MAJOR = 7, COLONEL = 8, GENERAL = 9, MARSHAL = 10, BOMB = 11;
  const NAMES = ['Flag', 'Spy', 'Scout', 'Miner', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel', 'General', 'Marshal', 'Bomb'];
  // pieces per side, indexed by rank
  const ARMIES = {
    classic: [1, 1, 8, 5, 4, 4, 4, 3, 2, 1, 1, 6], // 40
    barrage: [1, 1, 2, 1, 0, 0, 0, 0, 0, 1, 1, 1], // 8
  };
  const LAKES = [42, 43, 46, 47, 52, 53, 56, 57];
  const IS_LAKE = Array.from({ length: 100 }, (_, i) => LAKES.includes(i));
  const DIRS = [-10, 10, -1, 1];

  const zoneOf = seat => (seat === 0 ? 60 : 0); // first square of a seat's four setup rows
  const inZone = (seat, sq) => sq >= zoneOf(seat) && sq < zoneOf(seat) + 40;
  const movable = r => r !== FLAG && r !== BOMB;
  /** A setup square seen from its owner's side: k = depth*10 + col, depth 0 = front row, col 0 = owner's left. */
  function ownK(sq, seat) {
    const row = Math.floor(sq / 10), col = sq % 10;
    return seat === 0 ? (row - 6) * 10 + col : (3 - row) * 10 + (9 - col);
  }
  function sqOfK(k, seat) {
    const d = Math.floor(k / 10), c = k % 10;
    return seat === 0 ? (6 + d) * 10 + c : (3 - d) * 10 + (9 - c);
  }
  /** Turn an own-view setup (40 ranks by k) into the engine's layout (40 ranks by square order). */
  function layoutFromOwn(own, seat) {
    const out = new Array(40).fill(-1);
    for (let k = 0; k < 40; k++) out[sqOfK(k, seat) - zoneOf(seat)] = own[k];
    return out;
  }
  function ownFromLayout(layout, seat) {
    const out = new Array(40).fill(-1);
    for (let i = 0; i < 40; i++) out[ownK(zoneOf(seat) + i, seat)] = layout[i];
    return out;
  }
  const armySize = v => ARMIES[v].reduce((a, b) => a + b, 0);

  function cleanOpts(o) {
    o = o || {};
    return {
      variant: o.variant === 'barrage' ? 'barrage' : 'classic',
      aggressor: !!o.aggressor,          // ties go to the attacker
      silent: !!o.silent,                // the defender's rank is never shown
      scoutStrike: o.scoutStrike !== false, // a Scout may move several squares and strike in one turn
      twoSq: o.twoSq === 5 ? 5 : 3,      // most moves in a row between the same two squares
      chase: o.chase !== false,          // ISF more-squares rule against endless chasing
      rescue: !!o.rescue,                // Rescue variation: reaching the enemy back row brings back a lost piece (2 per player)
      bombOnce: !!o.bombOnce,            // house rule: a Bomb that goes off is removed too
    };
  }

  /** Who wins a fight: 'att', 'def' or 'both' (both removed). Flag fights are 'att' (game won). */
  function resolve(ar, dr, opts) {
    if (dr === FLAG) return 'att';
    if (dr === BOMB) return ar === MINER ? 'att' : opts && opts.bombOnce ? 'both' : 'def';
    if (ar === SPY && dr === MARSHAL) return 'att';
    if (ar === dr) return opts && opts.aggressor ? 'att' : 'both';
    return ar > dr ? 'att' : 'def';
  }

  /** Check a layout: an array of 40 ranks for this seat's four rows (-1 = empty; only Barrage may have empties). */
  function checkLayout(layout, variant) {
    if (!Array.isArray(layout) || layout.length !== 40) return 'Setup must cover your four rows.';
    const want = ARMIES[variant];
    const got = new Array(12).fill(0);
    for (const r of layout) {
      if (r === -1) continue;
      if (!Number.isInteger(r) || r < 0 || r > 11) return 'Unknown piece in setup.';
      got[r]++;
    }
    for (let r = 0; r < 12; r++) if (got[r] !== want[r]) return 'Setup needs exactly ' + want[r] + ' ' + NAMES[r] + (want[r] === 1 ? '' : 's') + '.';
    return null;
  }

  function newGame(options, names) {
    const opts = cleanOpts(options);
    return {
      v: 1, opts, names: [String((names && names[0]) || 'Red').slice(0, 24), String((names && names[1]) || 'Blue').slice(0, 24)],
      phase: 'setup', turn: 0, ply: 0,
      layouts: [null, null],
      pieces: [],        // id -> {o, r, pos, mv, sc, rv} (null where no piece started)
      board: new Array(100).fill(-1),
      streak: [null, null],
      last: [null, null], // each seat's last move, for the chase rule
      chase: null,
      hist: [],         // every move: {s, f, t, id, b?: {d, ar, dr, out}}
      cons: {},          // id -> bitmask of ranks still possible, from fights where a rank stayed hidden
      pend: null,        // Rescue: {s, id} while a piece on the enemy back row may bring back a lost piece
      resc: [0, 0],      // rescues made by each seat (at most 2)
      result: null,
      gid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), // tells one game from the next
    };
  }

  function placeAll(g) {
    g.pieces = new Array(100).fill(null);
    g.board = new Array(100).fill(-1);
    for (const seat of [0, 1]) {
      const base = zoneOf(seat);
      g.layouts[seat].forEach((r, k) => {
        if (r === -1) return;
        const id = base + k;
        g.pieces[id] = { o: seat, r, pos: id, mv: 0, sc: 0, rv: 0 };
        g.board[id] = id;
      });
    }
    g.phase = 'play';
    g.turn = 0;
    if (!hasMove(g, 0)) finish(g, hasMove(g, 1) ? 1 : -1, 'nomoves'); // both stuck from the start: draw
  }

  /** Does this move carry on the seat's back-and-forth streak? For one-square moves that means "between the
      same two squares". A Scout's squares include the ones it passes over (ISF 10.2): a move counts if it
      reverses the last move along the same line and stays inside the stretch the streak started on. */
  function continuesStreak(s, id, from, to) {
    if (!s || s.id !== id || from !== s.to) return false;
    const vert = Math.abs(to - from) >= 10;
    if (vert !== s.vert) return false;
    if (!vert && Math.floor(to / 10) !== Math.floor(s.lo / 10)) return false;
    if (to < s.lo || to > s.hi) return false;
    return (to - from > 0) !== (s.to - s.from > 0);
  }
  function breaksTwoSq(g, seat, id, from, to) {
    const s = g.streak[seat];
    return continuesStreak(s, id, from, to) && s.n >= g.opts.twoSq;
  }
  function adjacent(a, b) {
    const d = Math.abs(a - b);
    return d === 10 || (d === 1 && Math.floor(a / 10) === Math.floor(b / 10));
  }
  /** More-squares rule (ISF 11): during a continuous chase the chasing piece may not move so that the
      position repeats one already seen in this chase, except straight back to the square it just came from. */
  function breaksChase(g, seat, id, from, to) {
    const c = g.chase;
    if (!c || c.x !== seat || c.c !== id) return false;
    const t = g.pieces[c.t];
    if (!t || t.pos < 0 || to === t.pos || !adjacent(to, t.pos)) return false; // not a chasing move
    if (to === c.back) return false;
    return c.seen.includes(to * 100 + t.pos);
  }

  // Called before the board changes. A chase starts when a piece steps away from an enemy piece that has
  // just moved next to it, and goes on while the chaser keeps following and the target keeps running.
  function trackChase(g, seat, id, from, to) {
    const c = g.chase;
    const other = 1 - seat;
    if (c && c.x === seat) {
      const t = g.pieces[c.t];
      if (id === c.c && t && t.pos >= 0 && to !== t.pos && adjacent(to, t.pos)) {
        c.seen.push(to * 100 + t.pos);
        c.back = from;
      } else g.chase = null;
    } else if (c && c.t === id) {
      // the target runs again: the chase goes on
    } else {
      g.chase = null;
      const lm = g.last[other];
      if (lm && lm.id >= 0) {
        const chaser = g.pieces[lm.id];
        if (chaser && chaser.pos === lm.to && adjacent(chaser.pos, from) && to !== chaser.pos) {
          g.chase = { x: other, c: lm.id, t: id, seen: [chaser.pos * 100 + from], back: lm.from };
        }
      }
    }
    g.last[seat] = { id, from, to };
  }

  /** All legal moves for a seat: [[from, to], ...]. */
  function legalMoves(g, seat) {
    const out = [];
    if (g.phase !== 'play' || g.pend) return out;
    for (let sq = 0; sq < 100; sq++) pieceMoves(g, seat, sq, out);
    return out;
  }
  /** Legal moves of the piece on one square (appended to out). */
  function pieceMoves(g, seat, sq, out) {
    const { board, pieces } = g;
    const strike = g.opts.scoutStrike;
    {
      const id = board[sq];
      if (id < 0) return out;
      const p = pieces[id];
      if (p.o !== seat || !movable(p.r)) return out;
      for (const d of DIRS) {
        let t = sq, dist = 0;
        while (true) {
          const col = t % 10;
          if ((d === -1 && col === 0) || (d === 1 && col === 9)) break;
          t += d;
          if (t < 0 || t > 99 || IS_LAKE[t]) break;
          dist++;
          const occ = board[t];
          if (occ >= 0) {
            if (pieces[occ].o !== seat && (dist === 1 || strike) && !breaksTwoSq(g, seat, id, sq, t)) out.push([sq, t]);
            break;
          }
          if (!breaksTwoSq(g, seat, id, sq, t) && !(g.chase && g.opts.chase && breaksChase(g, seat, id, sq, t))) out.push([sq, t]);
          if (p.r !== SCOUT) break;
        }
      }
    }
    return out;
  }

  function hasMove(g, seat) {
    if (g.phase !== 'play') return false;
    const tmp = [];
    for (let sq = 0; sq < 100; sq++) if (pieceMoves(g, seat, sq, tmp).length) return true;
    return false;
  }

  function finish(g, winner, why) {
    g.phase = 'over';
    g.result = { winner, why };
  }

  function isLegal(g, seat, from, to) {
    if (g.phase !== 'play' || g.pend || from < 0 || from > 99) return false;
    return pieceMoves(g, seat, from, []).some(m => m[1] === to);
  }

  /** Make one move (already known to be legal). Mutates g. Returns the history record. */
  function doMove(g, seat, from, to) {
    const id = g.board[from];
    const p = g.pieces[id];
    const dist = Math.abs(to - from) >= 10 ? Math.abs(to - from) / 10 : Math.abs(to - from);
    const rec = { s: seat, f: from, t: to, id };
    // two-square streak
    const s = g.streak[seat];
    if (continuesStreak(s, id, from, to)) { s.n++; s.from = from; s.to = to; }
    else g.streak[seat] = { id, from, to, lo: Math.min(from, to), hi: Math.max(from, to), vert: dist > 0 && Math.abs(to - from) >= 10, n: 1 };
    // more-squares (chase) bookkeeping: positions are just (chaser square, target square) since nothing else moves
    trackChase(g, seat, id, from, to);
    p.mv = 1;
    if (dist > 1) p.sc = 1; // only a Scout can move more than one square
    const did = g.board[to];
    if (did < 0) {
      g.board[from] = -1;
      g.board[to] = id;
      p.pos = to;
    } else {
      const d = g.pieces[did];
      const out = resolve(p.r, d.r, g.opts);
      rec.b = { d: did, ar: p.r, dr: g.opts.silent ? null : d.r, out };
      p.rv = 1;
      if (!g.opts.silent) d.rv = 1;
      else {
        // remember what the attacker learned about the hidden defender
        let mask = 0;
        for (let r = 0; r < 12; r++) if (resolve(p.r, r, g.opts) === out) mask |= 1 << r;
        g.cons[did] = (g.cons[did] === undefined ? 0xfff : g.cons[did]) & mask;
      }
      if (out === 'att') {
        d.pos = -1;
        g.board[from] = -1;
        g.board[to] = id;
        p.pos = to;
      } else if (out === 'def') {
        p.pos = -1;
        g.board[from] = -1;
      } else {
        p.pos = -1;
        d.pos = -1;
        g.board[from] = -1;
        g.board[to] = -1;
      }
      if (d.r === FLAG && out === 'att') {
        d.rv = 1;
        rec.b.dr = FLAG;
        g.hist.push(rec);
        g.ply++;
        finish(g, seat, 'flag');
        return rec;
      }
    }
    g.hist.push(rec);
    g.ply++;
    // Rescue: a piece (not a Scout) standing on the enemy back row after its move may bring one back
    if (g.opts.rescue && p.pos === to && Math.floor(to / 10) === (seat === 0 ? 0 : 9)) {
      g.pend = { s: seat, id };
      if (rescueOptions(g)) return rec;
      g.pend = null;
    }
    endTurn(g, seat);
    return rec;
  }
  function endTurn(g, seat) {
    g.turn = 1 - seat;
    if (!hasMove(g, g.turn)) {
      // the side to move is stuck: it loses (if neither side can move, it is a draw)
      if (!hasMove(g, seat)) finish(g, -1, 'nomoves');
      else finish(g, seat, 'nomoves');
    }
  }
  const ownHalf = (seat, sq) => (seat === 0 ? sq >= 50 : sq < 50);
  /** While a rescue waits: the ranks that can come back and the squares they can go to (null if none). */
  function rescueOptions(g) {
    const pd = g.pend;
    if (!pd) return null;
    const p = g.pieces[pd.id];
    if (!p || p.r === SCOUT || p.rs || (g.resc || [0, 0])[pd.s] >= 2) return null;
    const ranks = [];
    for (const q of g.pieces) if (q && q.o === pd.s && q.pos < 0 && q.r !== BOMB && q.r !== FLAG && !ranks.includes(q.r)) ranks.push(q.r);
    const squares = [];
    for (let sq = 0; sq < 100; sq++) if (ownHalf(pd.s, sq) && !IS_LAKE[sq] && g.board[sq] < 0) squares.push(sq);
    return ranks.length && squares.length ? { ranks, squares } : null;
  }
  /** Make (or skip) the waiting rescue. a: {r, to} or {skip: true}. */
  function doRescue(g, seat, a) {
    const pd = g.pend;
    if (!a.skip) {
      const r = a.r, to = a.to;
      if (r === BOMB) throw new Error('A Bomb can\'t be rescued.');
      if (!Number.isInteger(to) || to < 0 || to > 99 || !ownHalf(seat, to) || IS_LAKE[to]) throw new Error('Put it on an empty square on your half.');
      if (g.board[to] >= 0) throw new Error('Put it on an empty square on your half.');
      let id = -1;
      for (let i = 0; i < 100; i++) { const q = g.pieces[i]; if (q && q.o === seat && q.pos < 0 && q.r === r && r !== FLAG) { id = i; break; } }
      if (id < 0) throw new Error('No such piece to rescue.');
      const q = g.pieces[id];
      q.pos = to; q.rv = 1;
      g.board[to] = id;
      delete g.cons[id];
      g.pieces[pd.id].rs = 1;
      g.resc = g.resc || [0, 0];
      g.resc[seat]++;
      const last = g.hist[g.hist.length - 1];
      if (last) last.rs = { r, to, id };
    }
    g.pend = null;
    endTurn(g, seat);
  }
  /** Replay one recorded move (with its rescue, if any): the Study tab and tests rebuild games this way. */
  function replayStep(g, h) {
    g.turn = h.s;
    doMove(g, h.s, h.f, h.t);
    if (g.pend) doRescue(g, h.s, h.rs ? { r: h.rs.r, to: h.rs.to } : { skip: true });
  }

  /** The one entry point for every action. Mutates and returns g; throws on anything illegal.
      action: {type:'setup', layout:[40 ranks]} | {type:'move', from, to} | {type:'resign'} */
  function apply(g, seat, action) {
    if (!action || typeof action !== 'object') throw new Error('Bad move');
    if (seat !== 0 && seat !== 1) throw new Error('Bad seat');
    if (g.phase === 'over') throw new Error('Game over');
    if (action.type === 'setup') {
      if (g.phase !== 'setup') throw new Error('Setup is finished');
      if (g.layouts[seat]) throw new Error('Setup already sent');
      const err = checkLayout(action.layout, g.opts.variant);
      if (err) throw new Error(err);
      g.layouts[seat] = action.layout.slice();
      if (g.layouts[0] && g.layouts[1]) placeAll(g);
      return g;
    }
    if (action.type === 'resign') {
      if (g.phase !== 'play') throw new Error('Not playing');
      finish(g, 1 - seat, 'resign');
      return g;
    }
    if (action.type === 'move') {
      if (g.phase !== 'play') throw new Error('Not playing');
      if (g.turn !== seat) throw new Error('Not your turn');
      if (g.pend) throw new Error('Choose a piece to rescue first.');
      const { from, to } = action;
      if (!Number.isInteger(from) || !Number.isInteger(to) || !isLegal(g, seat, from, to)) throw new Error('Illegal move');
      doMove(g, seat, from, to);
      return g;
    }
    if (action.type === 'rescue') {
      if (g.phase !== 'play' || !g.pend) throw new Error('No rescue to make');
      if (g.pend.s !== seat) throw new Error('Not your turn');
      doRescue(g, seat, action);
      return g;
    }
    throw new Error('Bad move');
  }

  function toAct(g) {
    if (g.phase === 'setup') return [0, 1].filter(s => !g.layouts[s]);
    if (g.phase === 'play') return [g.turn];
    return [];
  }

  /** What everyone may see. Hidden ranks are null. After the game ends, everything is shown. */
  function publicView(g) {
    const over = g.phase === 'over';
    const cells = new Array(100).fill(null);
    if (g.phase !== 'setup') {
      for (let sq = 0; sq < 100; sq++) {
        const id = g.board[sq];
        if (id < 0) continue;
        const p = g.pieces[id];
        cells[sq] = [p.o, id, p.rv || over ? p.r : (p.sc ? SCOUT : null), (p.mv ? 1 : 0) | (p.sc ? 2 : 0)];
      }
    }
    const dead = [];
    if (g.phase !== 'setup') {
      for (const p of g.pieces) if (p && p.pos < 0) dead.push([p.o, idOf(g, p), p.rv || over ? p.r : null]);
    }
    // during play only the recent moves travel (keeps each online update small); the whole game once it is over
    const from = over ? 0 : Math.max(0, g.hist.length - HIST_KEEP);
    const hist = g.hist.slice(from).map(h => {
      const o = { s: h.s, f: h.f, t: h.t, id: h.id };
      if (h.b) o.b = { d: h.b.d, ar: h.b.ar, dr: over ? g.pieces[h.b.d].r : h.b.dr, out: h.b.out };
      if (h.rs) o.rs = { r: h.rs.r, to: h.rs.to, id: h.rs.id };
      return o;
    });
    return {
      phase: g.phase, turn: g.turn, ply: g.ply, opts: g.opts, names: g.names, gid: g.gid || null,
      ready: [!!g.layouts[0], !!g.layouts[1]],
      cells, dead, hist, histFrom: from, streak: g.streak, last: g.last, chase: g.chase, cons: over ? {} : g.cons, result: g.result,
      pend: g.pend || null, resc: g.resc || [0, 0],
      layouts: over ? g.layouts : null,
    };
  }
  const HIST_KEEP = 40;

  function idOf(g, p) {
    return g.pieces.indexOf(p);
  }

  /** A game object built from what one seat can see: enemy ranks it does not know are -1.
      Good enough for legal moves (they never depend on hidden enemy ranks). */
  function fromView(pub, mine) {
    const g = { opts: pub.opts, phase: pub.phase, turn: pub.turn, streak: pub.streak || [null, null],
      last: pub.last || [null, null], chase: pub.chase || null, pend: pub.pend || null, resc: pub.resc || [0, 0],
      board: new Array(100).fill(-1), pieces: new Array(100).fill(null) };
    const ranks = {};
    for (const [id, r] of (mine && mine.own) || []) ranks[id] = r;
    pub.cells.forEach((c, sq) => {
      if (!c) return;
      const [o, id, r, fl] = c;
      g.board[sq] = id;
      g.pieces[id] = { o, r: ranks[id] !== undefined ? ranks[id] : (r === null ? -1 : r), pos: sq, mv: fl & 1, sc: (fl >> 1) & 1, rv: r === null ? 0 : 1 };
    });
    return g;
  }

  /** Only this seat's secrets: its own ranks (or its sent setup). */
  function privateView(g, seat) {
    const own = [];
    if (g.phase === 'setup') return { seat, layout: g.layouts[seat] ? g.layouts[seat].slice() : null, own };
    for (let id = 0; id < 100; id++) { const p = g.pieces[id]; if (p && p.o === seat) own.push([id, p.r]); }
    return { seat, layout: g.layouts[seat] ? g.layouts[seat].slice() : null, own };
  }

  // ---------------------------------------------------------------- display helpers
  /** Number shown on a piece: modern = Marshal 10 ... Spy 1; classic = Marshal 1 ... Scout 9, Spy S. */
  function label(r, numbering) {
    if (r === FLAG) return 'F';
    if (r === BOMB) return 'B';
    if (numbering === 'classic') return r === SPY ? 'S' : String(11 - r);
    return String(r);
  }

  function sqName(sq, seat) {
    // file letters a-j left to right and ranks 1-10 from the viewer's own side
    const row = Math.floor(sq / 10), col = sq % 10;
    if (seat === 1) return 'abcdefghij'[9 - col] + (row + 1);
    return 'abcdefghij'[col] + (10 - row);
  }

  return {
    FLAG, SPY, SCOUT, MINER, SERGEANT, LIEUTENANT, CAPTAIN, MAJOR, COLONEL, GENERAL, MARSHAL, BOMB,
    NAMES, ARMIES, LAKES, IS_LAKE, DIRS, zoneOf, inZone, movable, armySize, ownK, sqOfK, layoutFromOwn, ownFromLayout, adjacent,
    cleanOpts, resolve, checkLayout, newGame, apply, toAct, legalMoves, hasMove, doMove, isLegal,
    publicView, privateView, fromView, label, sqName, rescueOptions, replayStep,
  };
});
