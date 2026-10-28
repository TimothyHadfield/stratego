/* Stratego Lab: game sounds and effects on top of the shared fx.js (window.FX).
   `events(prev, cur)` is pure: it compares two snapshots of the public game (same for local and online)
   and says which sounds, animations and celebrations go with what just happened. `run()` plays them.
   Every sound, animation and celebration goes through FX, so the Settings switches cover all of it. */
(function (root, factory) {
  const m = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.StrSfx = m;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const FLAG = 0, SPY = 1, MARSHAL = 10, BOMB = 11;
  const fx = () => root.FX || null;
  const TEAM = ['#c9473d', '#3b6fd4'];

  // ------------------------------------------------------------ Stratego's own sounds (synthesised, like the rest)
  let defined = false;
  function defineSounds() {
    const F = fx();
    if (defined || !F) return;
    defined = true;
    // two wooden pieces knock together, with a short metal ring (the fight)
    F.define('clash', k => {
      k.tone({ f: 430, f2: 300, dur: 0.09, vol: 0.32 }); k.noise({ f: 2400, q: 1.4, dur: 0.04, vol: 0.4 });
      k.tone({ f: 1180, dur: 0.22, vol: 0.06, type: 'triangle', at: 0.01 }); k.tone({ f: 1760, dur: 0.16, vol: 0.035, at: 0.01 });
    }, 'moves');
    // a Miner snips the wires: two small clicks, then the fuse fizzles out
    F.define('defuse', k => {
      k.tone({ f: 2600, dur: 0.02, vol: 0.12, type: 'triangle' }); k.noise({ f: 5000, filter: 'highpass', dur: 0.015, vol: 0.18 });
      k.tone({ f: 2900, dur: 0.02, vol: 0.12, type: 'triangle', at: 0.09 }); k.noise({ f: 5000, filter: 'highpass', dur: 0.015, vol: 0.18, at: 0.09 });
      k.noise({ f: 5200, f2: 900, q: 2, dur: 0.45, a: 0.02, vol: 0.18, at: 0.16 });
      k.tone({ f: 600, f2: 300, dur: 0.25, vol: 0.06, type: 'triangle', at: 0.2 });
    }, 'moves');
    // an army is set down on the board: a quick run of wooden knocks
    F.define('deploy', k => {
      for (let i = 0; i < 7; i++) {
        const at = i * 0.055 + k.rnd(0, 0.015), f = k.rnd(470, 580);
        k.tone({ f, f2: f * 0.72, dur: 0.07, vol: 0.2, at }); k.noise({ f: 2200, q: 1.5, dur: 0.02, vol: 0.12, at });
      }
    }, 'moves');
  }

  // ------------------------------------------------------------ what happened (pure)
  const histTotal = pub => (pub.histFrom || 0) + pub.hist.length;
  const dist = (a, b) => Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) + Math.abs((a % 10) - (b % 10));

  /** prev/cur: {pub, me, myTurn, mode}. Returns [{at: ms, sound, vol} | {at, anim, sq} | {at, celebrate}]. */
  function events(prev, cur) {
    const out = [];
    if (!cur || !cur.pub) return out;
    const pub = cur.pub, me = cur.me;
    // a first look at a game (page opened, game resumed) makes no noise
    if (!prev || !prev.pub || prev.pub.gid !== pub.gid) return out;
    const p0 = prev.pub;
    let t = 0;

    // your army goes in (Ready) while theirs isn't there yet
    if (pub.phase === 'setup' && me >= 0 && pub.ready[me] && !p0.ready[me]) out.push({ at: 0, sound: 'deploy' });
    // the other army arrives while you're still arranging yours
    if (pub.phase === 'setup' && me >= 0 && pub.ready[1 - me] && !p0.ready[1 - me]) out.push({ at: 0, sound: 'place', vol: 0.85 });
    // both armies go down on the board
    if (p0.phase === 'setup' && pub.phase !== 'setup') { out.push({ at: 0, sound: 'deploy' }); t = 420; }

    // a new move
    if (pub.phase !== 'setup' && histTotal(pub) > histTotal(p0) && pub.hist.length) {
      const h = pub.hist[pub.hist.length - 1];
      const mine = h.s === me, vol = mine ? 1 : 0.85; // the other side is never louder than you
      const d = dist(h.f, h.t);
      if (!h.b) out.push({ at: 0, sound: d > 1 ? 'whoosh' : 'slide', vol });
      else {
        // fight: the popup shows both pieces at once, the loser is knocked over ~0.35 s later
        let a = 0;
        if (d > 1) { out.push({ at: 0, sound: 'whoosh', vol }); a = 160; } // a Scout runs in and strikes
        out.push({ at: a, sound: 'cardFlip', vol, pitch: 0.6, reveal: true }); // both pieces turn face up
        const k = a + 330;
        const { ar, dr, out: res } = h.b;
        const winnerSeat = res === 'att' ? h.s : res === 'def' ? 1 - h.s : -1;
        if (dr === BOMB && res !== 'att') { // (One-time Bombs: both go)
          out.push({ at: k, sound: 'explosion', vol }, { at: k, anim: 'shake' }, { at: k, anim: 'flash', sq: h.t, color: '#f0b354' });
        } else if (dr === BOMB && res === 'att') {
          out.push({ at: k - 120, sound: 'defuse', vol });
        } else if (ar === SPY && dr === MARSHAL && res === 'att') {
          out.push({ at: k - 120, sound: 'clash', vol }, { at: k, sound: mine ? 'capture' : 'hit', vol });
          if (mine) out.push({ at: k + 120, celebrate: 'big', sq: h.t });
        } else if (dr === FLAG) {
          out.push({ at: k - 120, sound: 'clash', vol }, { at: k, sound: 'capture', vol });
        } else {
          out.push({ at: k - 120, sound: 'clash', vol });
          out.push({ at: k, sound: winnerSeat === me ? 'capture' : 'hit', vol });
        }
        t = k + 450;
      }
    }

    // Rescue: a lost piece comes back onto the board
    const rsum = x => (x.resc ? x.resc[0] + x.resc[1] : 0);
    if (pub.phase !== 'setup' && rsum(pub) > rsum(p0)) { out.push({ at: t, sound: 'place', vol: 1 }, { at: t, anim: 'turn' }); t += 200; }

    // game over: your own win or loss (a draw gets neither)
    if (pub.phase === 'over' && p0.phase !== 'over' && me >= 0 && pub.result) {
      const w = pub.result.winner;
      if (w === me) out.push({ at: t + 250, celebrate: 'win', colors: [TEAM[me], '#f0b354', '#e8eaf0', TEAM[me], '#6ee7a8'] });
      else if (w === 1 - me) out.push({ at: t + 250, celebrate: 'lose' });
    } else if (pub.phase === 'play' && cur.myTurn && !(prev.myTurn && p0.phase === 'play')) {
      // it just became your turn: chime at the start of a game, and online (the other player may take a while);
      // against the computer its move sound already says "your go"
      if (p0.phase === 'setup' || cur.mode === 'online') out.push({ at: t + 250, sound: 'turn' }, { at: t + 250, anim: 'turn' });
    }
    return out;
  }

  // ------------------------------------------------------------ playing it
  const S = { prev: null, timers: [], schedule: (fn, ms) => setTimeout(fn, ms) };
  function speed() {
    const F = fx(), s = F ? F.settings : null;
    if (!s || !s.animations) return 0.5; // no animation to keep pace with: sounds come close together
    return s.animSpeed === 'fast' ? 0.55 : 1;
  }
  /** Play a list of events. ctx.board() = the board element, ctx.sqEl(sq) = the square, ctx.status() = the turn line
      (asked for when each event fires, so a redraw in between doesn't matter). */
  function run(list, ctx) {
    const F = fx();
    if (!F || !list.length) return;
    defineSounds();
    ctx = ctx || {};
    const k = speed();
    for (const e of list) {
      S.schedule(() => {
        if (e.sound) F.play(e.sound, { vol: e.vol, pitch: e.pitch });
        else if (e.celebrate) F.celebrate({ kind: e.celebrate, colors: e.colors, at: e.sq != null && ctx.sqEl ? ctx.sqEl(e.sq) : undefined });
        else if (e.anim === 'shake' && ctx.board) F.shake(ctx.board());
        else if (e.anim === 'flash' && ctx.sqEl) F.flash(ctx.sqEl(e.sq), e.color);
        else if (e.anim === 'turn' && ctx.status) F.pop(ctx.status());
      }, Math.round(e.at * k));
    }
  }
  /** Called on every draw of the game screen with the current snapshot. */
  function observe(cur, ctx) {
    const list = events(S.prev, cur);
    S.prev = cur && cur.pub ? { pub: { gid: cur.pub.gid, phase: cur.pub.phase, ready: cur.pub.ready.slice(), hist: [], histFrom: (cur.pub.histFrom || 0) + cur.pub.hist.length, resc: (cur.pub.resc || [0, 0]).slice() }, myTurn: cur.myTurn, me: cur.me } : null;
    run(list, ctx);
    return list;
  }
  function forget() { S.prev = null; }

  /** One sound outside the snapshot flow (setup swaps, illegal taps). */
  function play(name, o) { const F = fx(); if (!F) return false; defineSounds(); return F.play(name, o); }

  return { events, run, observe, forget, play, defineSounds, _s: S };
});
