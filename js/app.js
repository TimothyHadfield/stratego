/* Stratego Lab: screen code. One saved store (localStorage 'stratego:v1'); every game screen draws from
   the same snapshot shape {pub, mine, mySeat, ...} whether the game is local or online, so the board never
   sees an enemy rank it shouldn't. */
/* global StrEngine, StrOdds, StrBots, StrOnlineGame, StrArt, StrData, StrStrength */
(function () {
  'use strict';
  const E = StrEngine, Odds = StrOdds, Bots = StrBots, Art = StrArt, D = StrData;
  const KEY = 'stratego:v1';
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['Red', 'Blue'];
  const LEVELS = ['easy', 'medium', 'hard'];
  const LEVEL_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  // ------------------------------------------------------------------ sound & effects (js/fx.js + js/sfx.js)
  const hasFX = typeof FX !== 'undefined' && typeof StrSfx !== 'undefined';
  if (hasFX) {
    FX.init({ game: 'stratego', accent: '#6ea8fe' });
    // the board's own motion (sliding pieces, fight popup) follows the Animations switch and speed too
    const motion = () => {
      const s = FX.settings, h = document.documentElement;
      h.classList.toggle('fx-still', !s.animations);
      h.classList.toggle('fx-fast', s.animations && s.animSpeed === 'fast');
    };
    motion(); FX.onChange(motion);
  }
  const sfx = (name, o) => hasFX && StrSfx.play(name, o);

  // ------------------------------------------------------------------ saved store
  const DEFAULTS = {
    settings: { numbering: 'modern', prior: 'real', showOdds: true, scoutStrike: true, twoSq: 3, chase: true, aggressor: false, silent: false, name: '' },
    newGame: { mode: 'computer', level: 'medium', variant: 'classic', color: 0 },
    setups: { classic: null, barrage: null },
    local: null,
    last: null,
    record: { easy: [0, 0], medium: [0, 0], hard: [0, 0] },
    inRoom: false,
  };
  function validOwn(own, variant) {
    return Array.isArray(own) && own.length === 40 && !E.checkLayout(own, variant);
  }
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    const st = JSON.parse(JSON.stringify(DEFAULTS));
    if (!s || typeof s !== 'object') return st;
    const set = s.settings || {};
    st.settings.numbering = set.numbering === 'classic' ? 'classic' : 'modern';
    st.settings.prior = set.prior === 'flat' ? 'flat' : 'real';
    st.settings.showOdds = set.showOdds !== false;
    st.settings.scoutStrike = set.scoutStrike !== false;
    st.settings.twoSq = set.twoSq === 5 ? 5 : 3;
    st.settings.chase = set.chase !== false;
    st.settings.aggressor = !!set.aggressor;
    st.settings.silent = !!set.silent;
    st.settings.name = typeof set.name === 'string' ? set.name.slice(0, 20) : '';
    const ng = s.newGame || {};
    st.newGame.mode = ng.mode === 'online' ? 'online' : 'computer';
    st.newGame.level = LEVELS.includes(ng.level) ? ng.level : 'medium';
    st.newGame.variant = ng.variant === 'barrage' ? 'barrage' : 'classic';
    st.newGame.color = ng.color === 1 ? 1 : 0;
    if (s.setups) for (const v of ['classic', 'barrage']) if (validOwn(s.setups[v], v)) st.setups[v] = s.setups[v];
    if (s.local && s.local.state && s.local.state.v === 1 && (s.local.me === 0 || s.local.me === 1) && LEVELS.includes(s.local.level)) st.local = s.local;
    const L = s.last;
    if (L && typeof L === 'object' && Array.isArray(L.hist) && Array.isArray(L.layouts) && L.layouts.length === 2 &&
      L.layouts.every(x => Array.isArray(x) && x.length === 40) && L.opts && typeof L.opts === 'object' &&
      (L.me === 0 || L.me === 1) && L.result && typeof L.result === 'object' && typeof L.key === 'string') st.last = L;
    if (s.record) for (const l of LEVELS) if (Array.isArray(s.record[l])) st.record[l] = [s.record[l][0] | 0, s.record[l][1] | 0];
    st.inRoom = !!s.inRoom;
    return st;
  }
  let store = load();
  let saveOk = true; // false while saving fails (private mode, full storage): then no other tab can be trusted either
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); saveOk = true; } catch (e) { saveOk = false; /* private mode: fine */ }
  }
  function mySetup(variant) {
    if (!store.setups[variant]) store.setups[variant] = Bots.chooseSetup(variant, 'medium', Math.random);
    return store.setups[variant];
  }

  // ------------------------------------------------------------------ small ui helpers
  let toastTimer = null;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2600);
  }
  function closePop() { const p = $('.pop'); if (p) p.remove(); }
  function pop(btn, html) {
    closePop();
    const p = document.createElement('div');
    p.className = 'pop';
    p.innerHTML = html;
    document.body.appendChild(p);
    const r = btn.getBoundingClientRect();
    const w = p.offsetWidth, h = p.offsetHeight;
    let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
    p.style.left = x + 'px'; p.style.top = y + 'px';
  }
  document.addEventListener('click', e => {
    const q = e.target.closest('.q');
    // the Sound & effects block opens its own "?"
    if (q && !q.closest('.fx-set')) { e.stopPropagation(); pop(q, HELP[q.dataset.help] || ''); return; }
    if (!e.target.closest('.pop')) closePop();
  }, true);
  function confirmBox(text, yes, onYes) {
    const back = document.createElement('div');
    back.className = 'confirm-back';
    back.innerHTML = '<div class="panel"><div>' + esc(text) + '</div><div class="row"><button class="btn grow" data-a="no">Cancel</button><button class="btn warm grow" data-a="yes">' + esc(yes) + '</button></div></div>';
    back.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if (e.target === back || (a && a.dataset.a === 'no')) back.remove();
      else if (a && a.dataset.a === 'yes') { back.remove(); onYes(); }
    });
    document.body.appendChild(back);
  }
  const q = key => '<button class="q" data-help="' + key + '" aria-label="Why?">?</button>';
  const pctColor = p => { // red -> amber -> green
    const h = Math.round(Math.max(0, Math.min(1, p)) * 120);
    return 'hsl(' + h + ',70%,55%)';
  };
  const pct = p => Math.round(p * 100) + '%';
  function setHTML(el, html) { if (el && el._html !== html) { el.innerHTML = html; el._html = html; } }
  const rankName = r => E.NAMES[r];
  const lab = r => E.label(r, store.settings.numbering);

  function strengthHelp() {
    const S = typeof StrStrength !== 'undefined' ? StrStrength : null;
    if (!S) return 'Strength not measured yet.';
    const c = S.classic && S.classic.results;
    const row = (k, a, b) => c && c[k] ? '<li>' + a + ' beats ' + b + ' <b>' + c[k].firstScore + '%</b> (' + c[k].games + ' games)</li>' : '';
    return '<b>How strong?</b> Measured by playing the levels against each other, colours swapped every game:<ul style="margin:6px 0 4px;padding-left:18px">' +
      row('hard-medium', 'Hard', 'Medium') + row('hard-easy', 'Hard', 'Easy') + row('medium-easy', 'Medium', 'Easy') + row('easy-random', 'Easy', 'a random mover') +
      '</ul>' + (S.barrage ? 'In Barrage Hard beats Medium ' + S.barrage.results['hard-medium'].firstScore + '%. ' : '') +
      'The computer only sees what you would see: its own pieces, what moved and what fights showed.';
  }
  const HELP = {
    odds: 'The chance each hidden enemy piece is each rank. It counts what is left of their army, which pieces have moved (those can\'t be Bombs or the Flag), Scout-length moves, and fights. <b>Real players</b> also weighs each square by where 42,000 real players put each rank.',
    level: '', // filled at render (strength)
    prior: '<b>Real players</b>: weighs squares by where people really put each rank (42,488 games from the gravon.de archive). <b>Flat</b>: every arrangement that fits the facts is equally likely.',
    twoSq: 'A piece may not move back and forth between the same two squares more than 3 times in a row (the rulebook). Older tournament play allowed 5.',
    chase: 'Tournament rule: a piece chasing another may not keep repeating the same positions. Without it a chase can go on forever.',
    scout: 'Current rules let a Scout run several squares and strike in the same turn. Some classic editions say a Scout must stop first.',
    aggressor: 'Optional old rule: when equal ranks fight, the attacker wins instead of both being removed.',
    silent: 'Optional old rule: the defender never shows its rank. You only learn whether you won or lost.',
    numbering: 'Current sets number the Marshal 10 (highest) down to Spy 1. Old US sets number the Marshal 1 down to Scout 9, Spy S.',
    guess: 'How quickly someone who knows where people usually hide the Flag would find yours: your Flag\'s place in their list of most likely squares.',
    test: 'Plays quick games with the Medium computer using your setup against Medium with real winning setups. 50% means as good as a typical winner\'s setup.',
    heat: 'Where 42,488 real players put each piece. Brighter = more often.',
    lost: 'Rough points lost: how much better the best move scored than yours by the Medium computer\'s one-move judge (in piece values: Scout 1.6 … Marshal 16).',
    barrage: 'Barrage: 8 pieces each (Flag, Bomb, Spy, 2 Scouts, Miner, General, Marshal) placed anywhere in your four rows. Same rules.',
  };

  // ------------------------------------------------------------------ tabs
  let tab = 'play';
  const tabHistory = [];
  function setTab(t, noPush) {
    if (t === tab) return;
    // a question box belongs to the screen it was asked on (Back must not leave "Resign?" over another tab)
    document.querySelectorAll('.confirm-back').forEach(b => b.remove());
    if (!noPush) { tabHistory.push(tab); try { history.pushState({ tab: t }, '', '#' + t); } catch (e) { /* ignore */ } }
    tab = t;
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + t));
    render();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
  window.addEventListener('popstate', ev => {
    const t = (ev.state && ev.state.tab) || (location.hash || '#play').slice(1);
    if (['play', 'setup', 'study', 'settings'].includes(t)) setTab(t, true);
  });

  // ================================================================== the current game
  // local: {g, me, level}; online: {room, snap}
  let local = null;
  const net = { room: null, snap: null, mod: null };
  let botTimer = null;
  const ui = { sel: -1, focus: -1, hint: null, fight: null, lastHistLen: 0, lastKey: '', tapAt: 0, tapA: '' };

  function rulesFromSettings() {
    const s = store.settings;
    return { scoutStrike: s.scoutStrike, twoSq: s.twoSq, chase: s.chase, aggressor: s.aggressor, silent: s.silent };
  }

  function snapNow() {
    if (net.room && net.snap && net.snap.status !== 'none' && net.snap.status !== 'closed' && net.snap.status !== 'left') return net.snap;
    if (!local) return null;
    const g = local.g;
    const toAct = E.toAct(g);
    return {
      mode: 'local', status: g.phase === 'over' ? 'finished' : 'playing', mySeat: local.me,
      pub: E.publicView(g), mine: E.privateView(g, local.me), toAct, myTurn: toAct.includes(local.me),
      seats: [{ name: g.names[0] }, { name: g.names[1] }], level: local.level,
    };
  }

  function startLocal() {
    const ng = store.newGame;
    const me = ng.color;
    const names = me === 0 ? ['You', 'Computer'] : ['Computer', 'You'];
    const g = E.newGame(Object.assign({ variant: ng.variant }, rulesFromSettings()), names);
    // the computer sends its army straight away
    const rng = Math.random;
    E.apply(g, 1 - me, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup(ng.variant, ng.level, rng), 1 - me) });
    local = { g, me, level: ng.level };
    ui.sel = -1; ui.focus = -1; ui.hint = null; ui.lastHistLen = 0;
    resetBoard();
    persistLocal();
    render();
  }
  function persistLocal() {
    store.local = local ? { state: local.g, me: local.me, level: local.level } : null;
    save();
  }
  /** Bring back the saved game; a save that doesn't hold a whole game is dropped (and only that). */
  function resumeLocal() {
    if (!store.local) return;
    try {
      const g = store.local.state, me = store.local.me;
      if (g.phase !== 'setup' && g.phase !== 'play') throw new Error('not a game in progress');
      if (!Array.isArray(g.board) || g.board.length !== 100 || !Array.isArray(g.pieces) || !Array.isArray(g.hist) ||
        !Array.isArray(g.layouts) || g.layouts.length !== 2 || !g.opts || !Array.isArray(g.names) || !Array.isArray(g.streak) || !Array.isArray(g.last)) throw new Error('bad save');
      if (g.phase === 'play' && (g.pieces.length !== 100 || !g.layouts[0] || !g.layouts[1])) throw new Error('bad save');
      E.toAct(g); E.publicView(g); E.privateView(g, me);
      if (g.phase === 'play') E.legalMoves(g, g.turn);
      if (!g.gid) g.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      local = { g, me, level: store.local.level }; ui.lastHistLen = g.hist.length;
    } catch (e) { local = null; store.local = null; save(); }
  }

  /** The same game open in another tab may have moved on: take its newer save (true if it did). */
  function syncFromStorage() {
    if (!local || local.g.phase === 'over' || !saveOk) return false;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return false; }
    if (!s || typeof s !== 'object') return false; // storage blocked or cleared: keep what is on screen
    const mine = local.g, g = s.local && s.local.state;
    if (g && g.gid === mine.gid) {
      const sent = x => (x.layouts && x.layouts[0] ? 1 : 0) + (x.layouts && x.layouts[1] ? 1 : 0);
      if (g.ply === mine.ply && g.phase === mine.phase && sent(g) === sent(mine)) return false;
    }
    // it moved on, finished, was quit, or another game was started there: show what the other tab saved
    clearTimeout(botTimer);
    store = load(); local = null; resetBoard(); resumeLocal();
    ui.sel = -1; ui.hint = null; ui.focus = -1;
    return true;
  }
  window.addEventListener('storage', e => {
    if (e.key !== KEY && e.key !== null) return;
    if (local && syncFromStorage()) { render(); scheduleComputer(); return; }
    if (!local && !net.room) { // nothing running here: pick up a game started in the other tab
      store = load(); resumeLocal();
      if (local) { resetBoard(); render(); scheduleComputer(); } else if (tab === 'play') render();
    }
  });

  function localAct(action) {
    if (syncFromStorage()) { render(); scheduleComputer(); toast('This game moved on in another tab.'); return false; }
    try { E.apply(local.g, local.me, action); }
    catch (e) { sfx('error'); toast(e.message); return false; }
    afterLocalChange();
    return true;
  }
  function afterLocalChange() {
    persistLocal();
    if (local.g.phase === 'over') finishGame(local.g.result, E.publicView(local.g), local.me, 'computer', local.level);
    render();
    scheduleComputer();
  }
  function scheduleComputer() {
    clearTimeout(botTimer);
    if (!local || local.g.phase !== 'play' || local.g.turn === local.me) return;
    botTimer = setTimeout(() => {
      // another tab of this game may already have made the computer's move
      if (syncFromStorage()) { render(); scheduleComputer(); return; }
      if (!local || local.g.phase !== 'play' || local.g.turn === local.me) return;
      const bot = 1 - local.me;
      const m = Bots.chooseMove(E.publicView(local.g), E.privateView(local.g, bot), bot, local.level, Math.random);
      if (!m) E.apply(local.g, bot, { type: 'resign' });
      else E.apply(local.g, bot, { type: 'move', from: m.from, to: m.to });
      afterLocalChange();
    }, ui.fight ? 1300 : 650);
  }

  function finishGame(result, pub, me, mode, level) {
    // remember the finished game for Study (once)
    // every game carries its own id, so two games in a row with the same length and result both count
    const key = mode + ':' + (pub.gid || JSON.stringify([pub.layouts, pub.hist.length, result]));
    if (store.last && store.last.key === key) return;
    store.last = { key, opts: pub.opts, layouts: pub.layouts, hist: pub.hist, me, names: pub.names, result, mode, level: level || null };
    if (mode === 'computer' && level && result.winner !== -1) store.record[level][result.winner === me ? 0 : 1]++;
    store.local = null;
    save();
  }

  // ------------------------------------------------------------------ online
  let onlineP = null;
  /** Load the online module once (two quick taps must not make two connections). */
  function loadOnline() {
    if (!onlineP) onlineP = import(new URL('js/online.js?v=6', location.href).href).then(mod => {
      net.mod = mod;
      net.room = mod.createOnline({ game: StrOnlineGame.game, gameId: 'stratego', botDelayMs: 700 });
      net.room.on('change', snap => {
        const was = net.snap;
        net.snap = snap;
        if (snap.status === 'finished' && snap.pub && snap.pub.result) finishGame(snap.pub.result, snap.pub, snap.mySeat, 'online', null);
        if (snap.status === 'closed' || snap.status === 'left') {
          // the room went away under us (host closed it, or we were taken out): say so instead of silently dropping to the menu
          if (!net.leaving && store.inRoom && was && was.status !== 'closed' && was.status !== 'left') toast(snap.status === 'closed' ? 'The room was closed.' : 'You are no longer in the room.');
          store.inRoom = false; save(); resetBoard();
        }
        if (!snap.pub || snap.pub.ply !== net.sentPly) net.sentAt = 0; // our move arrived (or the game changed)
        render();
      });
      net.room.on('error', msg => toast(String(msg && msg.message ? msg.message : msg)));
      return mod;
    }).catch(err => { onlineP = null; throw err; });
    return onlineP;
  }
  function onlineCall(p, okMsg) {
    return p.then(r => { if (!r || !r.ok) toast((r && r.message) || 'Something went wrong.'); else if (okMsg) toast(okMsg); return r; });
  }
  /** At most 20 characters, never cutting an emoji in half. */
  const cut20 = str => { let out = ''; for (const ch of str) { if (out.length + ch.length > 20) break; out += ch; } return out; };
  /** Create / join run one at a time; a network failure says so instead of doing nothing. */
  async function roomJob(job) {
    if (net.busy) return;
    net.busy = true;
    try { await job(); }
    catch (e) { toast('Could not reach the game server. Check your connection and try again.'); }
    finally { net.busy = false; render(); }
  }
  function createRoom() {
    return roomJob(async () => {
      const name = cut20(($('#on-name') && $('#on-name').value.trim()) || store.settings.name || 'Player');
      store.settings.name = name; save();
      await loadOnline();
      const ng = store.newGame;
      const r = await onlineCall(net.room.createRoom({ name, seats: ['human', 'empty'], options: Object.assign({ variant: ng.variant, level: ng.level }, rulesFromSettings()) }));
      if (r && r.ok) { store.inRoom = true; save(); }
    });
  }
  function joinRoom() {
    const name = cut20(($('#on-name') && $('#on-name').value.trim()) || store.settings.name || 'Player');
    const code = ($('#on-code') && $('#on-code').value.trim().toUpperCase()) || '';
    if (code.length < 5) { toast('Type the 5-letter room code.'); return; }
    return roomJob(async () => {
      store.settings.name = name; save();
      await loadOnline();
      const r = await onlineCall(net.room.joinRoom(code, name));
      if (r && r.ok) { store.inRoom = true; save(); }
    });
  }
  async function leaveRoom() {
    net.leaving = true;
    try { if (net.room) await net.room.leave(); } finally { net.leaving = false; }
    store.inRoom = false; save();
    net.snap = null;
    resetBoard();
    render();
  }
  function act(action) {
    const s = snapNow();
    if (!s) return;
    if (s.mode === 'local') return localAct(action);
    // until the room shows our move, more taps on the board would only send moves it will refuse
    if (action.type === 'move') { net.sentAt = Date.now(); net.sentPly = s.pub.ply; }
    net.room.act(action).then(r => { if (!r || !r.ok) { net.sentAt = 0; sfx('error'); toast((r && r.message) || 'Move not sent.'); render(); } });
    return true;
  }

  // ================================================================== odds (cached per position)
  let oddsCache = { key: '', res: null };
  function oddsFor(pub, seat) {
    if (!pub || pub.phase === 'setup' || seat < 0) return null;
    const prior = pub.opts.variant === 'barrage' ? 'flat' : store.settings.prior;
    const key = seat + ':' + pub.ply + ':' + prior + ':' + pub.dead.length + ':' + JSON.stringify(pub.cons) + ':' + pub.phase;
    if (oddsCache.key !== key) oddsCache = { key, res: Odds.analyze(pub, seat, { prior, steps: 30000 }) };
    return oddsCache.res;
  }

  // ================================================================== board drawing
  let boardEl = null, boardSeat = -1;
  const pcEls = new Map();
  function resetBoard() { boardEl = null; pcEls.clear(); boardSeat = -1; }
  const dispOf = (sq, me) => (me === 1 ? 99 - sq : sq);
  function placeStyle(el, sq, me) {
    const d = dispOf(sq, me);
    el.style.left = (d % 10) * 10 + '%';
    el.style.top = Math.floor(d / 10) * 10 + '%';
  }
  function ensureBoard(host, me) {
    if (boardEl && boardSeat === me && host.contains(boardEl)) return boardEl;
    boardEl = document.createElement('div');
    boardEl.className = 'bwrap';
    boardEl.innerHTML = Art.boardSvg().replace('<svg', '<svg class="bg"') + '<div class="cells"></div><div class="pcs"></div><div class="fx"></div>';
    const cells = boardEl.querySelector('.cells');
    for (let sq = 0; sq < 100; sq++) {
      if (E.IS_LAKE[sq]) continue;
      const c = document.createElement('div');
      c.className = 'cell';
      c.dataset.sq = sq;
      placeStyle(c, sq, me);
      cells.appendChild(c);
    }
    pcEls.clear();
    boardSeat = me;
    host.innerHTML = '';
    // the folding board lying on the table: printed margins at both players' ends, where each
    // side's removed pieces are laid out (theirs on the far end, yours on the near end)
    const frame = document.createElement('div');
    frame.className = 'bframe';
    frame.innerHTML = '<div class="grave far" id="grave-far"></div>';
    frame.appendChild(boardEl);
    frame.insertAdjacentHTML('beforeend', '<div class="grave near" id="grave-near"></div>');
    host.appendChild(frame);
    boardEl.addEventListener('click', onBoardClick);
    sizeBoard();
    return boardEl;
  }
  const LANDSCAPE = window.matchMedia('(max-width: 899px) and (orientation: landscape) and (max-height: 540px)');
  function sizeBoard() {
    // the board is as big as the space allows (square)
    document.querySelectorAll('.boardcol').forEach(col => {
      const b = col.querySelector('.bwrap');
      if (!b) return;
      const wide = window.innerWidth >= 900;
      // the game board sits in a frame: printed margins at both ends (--fe) and the sides (--fs)
      const fr = b.parentElement.classList.contains('bframe') ? getComputedStyle(b.parentElement) : null;
      const ex = fr ? 2 * (parseFloat(fr.getPropertyValue('--fe')) || 0) : 0;
      const sx = fr ? 2 * (parseFloat(fr.getPropertyValue('--fs')) || 0) : 0;
      let size;
      if (wide) {
        const top = col.getBoundingClientRect().top;
        // a tilted board (laptop) is pulled up by a negative margin: its far end looks further away, so it can be taller
        const lift = fr ? -(parseFloat(fr.marginTop) || 0) : 0;
        size = Math.min(window.innerHeight - top - 20 - ex + lift, window.innerWidth - 400 - 80 - sx);
      } else if (LANDSCAPE.matches) {
        // a phone on its side: the board takes the whole height on the left, everything else sits on the right
        const parent = col.parentElement;
        const top = col.getBoundingClientRect().top - parent.getBoundingClientRect().top;
        size = Math.min(parent.clientHeight - top - 2 - ex, parent.clientWidth * (col.id === 'st-board' ? 0.52 : 0.6) - sx);
      } else {
        // the board gets the height its column-mates leave free (a part marked data-min counts as that height)
        const parent = col.parentElement;
        let used = 0, n = 0;
        for (const el of parent.children) {
          if (el === col || getComputedStyle(el).display === 'none') continue;
          used += el.dataset.min ? +el.dataset.min : el.offsetHeight;
          n++;
        }
        const avail = parent.clientHeight - used - (parseFloat(getComputedStyle(parent).rowGap) || 0) * n - 2;
        size = Math.min((col.clientWidth || window.innerWidth - 24) - sx, avail - ex);
      }
      size = Math.max(LANDSCAPE.matches && !wide ? 160 : 240, Math.floor(size));
      b.style.width = size + 'px';
      b.style.height = size + 'px';
    });
  }
  let wasWide = window.innerWidth >= 900;
  window.addEventListener('resize', () => {
    const wide = window.innerWidth >= 900;
    if (wide !== wasWide) { wasWide = wide; render(); } else sizeBoard();
    // turning a phone: some browsers update the layout queries only after this event
    requestAnimationFrame(sizeBoard);
  });
  try { LANDSCAPE.addEventListener('change', () => sizeBoard()); } catch (e) { /* very old Safari: the resize above still runs */ }

  /** Draw pieces for a snapshot. `reveal` = show every rank (study / game over). */
  function drawPieces(bw, pub, mine, me, opts) {
    opts = opts || {};
    const pcs = bw.querySelector('.pcs');
    const own = {};
    for (const [id, r] of (mine && mine.own) || []) own[id] = r;
    const layouts = opts.layouts || null;
    const seen = new Set();
    const odds = opts.odds;
    pub.cells.forEach((c, sq) => {
      if (!c) return;
      const [o, id, r, fl] = c;
      seen.add(id);
      let el = pcEls.get(id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'pc';
        placeStyle(el, sq, me);
        pcs.appendChild(el);
        pcEls.set(id, el);
      }
      let rank = own[id] !== undefined ? own[id] : r;
      if (rank === null && opts.reveal && opts.truth) rank = opts.truth[id];
      const key = o + ':' + rank + ':' + store.settings.numbering;
      let extra = '';
      // a dot on my pieces the enemy already knows (shown in a fight, or a Scout that ran)
      if (o === me && own[id] !== undefined && r !== null && pub.phase !== 'over') extra += '<i class="seen"></i>';
      if (o !== me && rank === null && (fl & 1)) extra += '<i class="moved"></i>';
      let badge = '';
      if (o !== me && rank === null && odds && odds.byId[id] && opts.showOdds) {
        const p = odds.byId[id];
        let best = 0; for (let k = 1; k < 12; k++) if (p[k] > p[best]) best = k;
        badge = '<span class="badge"><b>' + lab(best) + '</b>' + Math.round(p[best] * 100) + '</span>';
      }
      if (opts.badges && opts.badges[sq] !== undefined) {
        const b = opts.badges[sq];
        badge = '<span class="badge top" style="background:' + pctColor(b) + ';color:#10131a">' + Math.round(b * 100) + '%</span>';
      }
      const html = Art.piece(o, rank, store.settings.numbering) + extra + badge;
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
      el.dataset.key = key;
      el.classList.remove('gone');
      placeStyle(el, sq, me);
      el.classList.toggle('sel', sq === opts.sel);
      el.classList.toggle('focus', id === opts.focus);
    });
    for (const [id, el] of pcEls) {
      if (!seen.has(id)) {
        el.classList.add('gone');
        el.classList.remove('sel');
        setTimeout(() => { if (el.classList.contains('gone')) { el.remove(); pcEls.delete(id); } }, 350);
      }
    }
    // cell marks
    bw.querySelectorAll('.cell').forEach(c => {
      const sq = +c.dataset.sq;
      c.classList.toggle('dest', !!(opts.dests && opts.dests.has(sq)));
      c.classList.toggle('last', !!(opts.last && opts.last.includes(sq)));
      c.classList.toggle('hit', !!opts.clickable);
    });
    void layouts;
  }

  function showFight(bw, me, h, pub, own) {
    // h: {s, b:{ar, dr, out}}: who attacked whom and what happened
    const fx = bw.querySelector('.fx');
    clearTimeout(ui.fight); // a second fight right after the first gets its full time on screen
    const attMine = h.s === me;
    const ar = h.b.ar;
    const dr = h.b.dr !== null ? h.b.dr : (!attMine && own[h.b.d] !== undefined ? own[h.b.d] : null);
    const out = h.b.out;
    const word = out === 'both' ? 'Both lost' : (out === 'att') === attMine ? 'You win' : 'You lose';
    const cls = out === 'both' ? '' : (out === 'att') === attMine ? 'ok' : 'no';
    // the losing piece gets knocked over, the winner swells a little (both lose when equal)
    const attCls = out === 'att' ? 'win' : 'lose', defCls = out === 'def' ? 'win' : 'lose';
    // the enemy piece is turned round to show its rank (a 3-D turn from its plain back), like at the table
    const fp = (side, r, c) => side === me ? '<div class="fp ' + c + '">' + Art.piece(side, r, store.settings.numbering) + '</div>'
      : '<div class="fp turn ' + c + '"><div class="fl"><div class="ff">' + Art.piece(side, r, store.settings.numbering) + '</div><div class="fb">' + Art.piece(side, null) + '</div></div></div>';
    fx.innerHTML = '<div class="fight">' + fp(h.s, ar, attCls) + '<div class="vs"><div class="' + cls + '">' + word + '</div><div class="muted" style="font-size:11px;font-weight:600">' +
      esc(rankName(ar)) + ' hit ' + esc(dr === null ? 'a hidden piece' : rankName(dr)) + '</div></div>' + fp(1 - h.s, dr, defCls) + '</div>';
    ui.fight = setTimeout(() => { fx.innerHTML = ''; ui.fight = null; }, 1250);
  }

  // ------------------------------------------------------------------ clicks on the board
  function legalFor(snap) {
    if (!snap || !snap.pub || snap.pub.phase !== 'play' || !snap.myTurn) return [];
    const g = E.fromView(snap.pub, snap.mine);
    return E.legalMoves(g, snap.mySeat);
  }
  function onBoardClick(e) {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const sq = +cell.dataset.sq;
    const snap = snapNow();
    if (!snap || !snap.pub || snap.pub.phase !== 'play') return;
    // online: our move is on its way; the board stays put until it arrives
    if (snap.mode === 'online' && net.sentAt && Date.now() - net.sentAt < 5000 && snap.pub.ply === net.sentPly) return;
    // a tap means the player is choosing for themselves: the hint gives way at once
    if (ui.hint) { ui.hint = null; clearTimeout(ui.hintTimer); }
    const c = snap.pub.cells[sq];
    const me = snap.mySeat;
    if (ui.sel >= 0 && snap.myTurn) {
      const legal = legalFor(snap);
      if (legal.some(m => m[0] === ui.sel && m[1] === sq)) {
        const from = ui.sel;
        ui.sel = -1; ui.hint = null; ui.focus = -1;
        act({ type: 'move', from, to: sq });
        return;
      }
    }
    if (c && c[0] === me) {
      const legal = legalFor(snap);
      ui.sel = ui.sel === sq || !legal.some(m => m[0] === sq) ? -1 : sq;
      if (ui.sel === sq) sfx('click'); // piece picked up
      if (c && !legal.some(m => m[0] === sq) && snap.myTurn) {
        const r = (snap.mine.own.find(x => x[0] === c[1]) || [])[1];
        if (r === E.BOMB || r === E.FLAG) { sfx('error'); toast(rankName(r) + 's never move.'); }
        else if (r !== undefined) { sfx('error'); toast('That piece has no legal move (blocked, or the back-and-forth limit).'); }
      }
      ui.focus = -1;
    } else if (c) {
      ui.focus = ui.focus === c[1] ? -1 : c[1];
    } else {
      ui.sel = -1; ui.focus = -1;
    }
    render();
  }

  // ================================================================== PLAY TAB
  function renderPlay() {
    const v = $('#v-play');
    const snap = snapNow();
    if (net.snap && net.room && (net.snap.status === 'lobby' || net.snap.status === 'joining')) { resetBoard(); return renderLobby(v, net.snap); }
    if (!snap) { resetBoard(); return renderNewGame(v); }
    renderGame(v, snap);
  }

  function seg(name, options, value) {
    return '<div class="seg" data-seg="' + name + '">' + options.map(([val, text, sub]) =>
      '<button aria-pressed="' + (String(val) === String(value)) + '" data-val="' + val + '">' + text + (sub ? '<small>' + sub + '</small>' : '') + '</button>').join('') + '</div>';
  }

  function renderNewGame(v) {
    const ng = store.newGame;
    const rec = store.record;
    HELP.level = strengthHelp();
    const levelSub = l => (rec[l][0] + rec[l][1] ? rec[l][0] + '–' + rec[l][1] : '');
    v.innerHTML = '<div class="setup">' +
      '<div class="hero"><img src="icon.svg" alt=""><div><h1>Stratego Lab</h1><p>Hidden armies, live odds, real-player data.</p></div></div>' +
      '<div class="panel">' + seg('mode', [['computer', 'Vs computer'], ['online', 'Online']], ng.mode) +
      (ng.mode === 'computer'
        ? '<div class="row"><span class="label grow">Computer</span>' + q('level') + '</div>' +
          seg('level', LEVELS.map(l => [l, LEVEL_NAME[l], levelSub(l)]), ng.level)
        : '<div class="row"><input class="txt" id="on-name" maxlength="20" placeholder="Your name" value="' + esc(store.settings.name) + '"></div>' +
          '<div class="row"><button class="btn primary grow" data-a="create">Create room</button></div>' +
          '<div class="row"><input class="txt code" id="on-code" maxlength="5" placeholder="CODE" autocapitalize="characters" autocomplete="off"><button class="btn" data-a="join">Join</button></div>' +
          '<div class="muted small" style="font-size:12.5px">Your friend types the code on their phone. An empty seat is played by the computer.</div>') +
      '<div class="row"><span class="label grow">Game</span>' + q('barrage') + '</div>' +
      seg('variant', [['classic', 'Classic', '40 pieces'], ['barrage', 'Barrage', '8 pieces']], ng.variant) +
      (ng.mode === 'computer' ? '<div class="label">You play</div>' + seg('color', [[0, 'Red', 'moves first'], [1, 'Blue', '']], ng.color) +
        '<button class="btn primary" data-a="start">Start game</button>' : '') +
      '</div>' +
      '<div class="muted" style="font-size:12.5px;text-align:center">Your army comes from the <b>Setup</b> tab. Rules switches are in Settings.</div>' +
      '</div>';
    v.onclick = e => {
      const b = e.target.closest('[data-seg] button');
      if (b) {
        const name = b.parentElement.dataset.seg;
        const val = b.dataset.val;
        store.newGame[name] = name === 'color' ? +val : val;
        save(); render(); return;
      }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'start') startLocal();
      if (a.dataset.a === 'create') createRoom();
      if (a.dataset.a === 'join') joinRoom();
    };
  }

  function renderLobby(v, s) {
    const host = s.isHost;
    v.innerHTML = '<div class="setup"><div class="panel" style="align-items:center;text-align:center">' +
      '<div class="label">Room code</div><div class="code-big">' + esc(s.code || '…') + '</div>' +
      '<div class="muted" style="font-size:13px">Friends open this page, pick Online and type the code.</div></div>' +
      '<div class="panel"><div class="label">Seats</div><div class="seats">' +
      (s.seats || []).map((st, i) => '<div class="seatrow"><span class="dot" style="background:' + (i ? 'var(--blue)' : 'var(--red)') + '"></span><span class="grow">' +
        COLORS[i] + ': ' + (st.kind === 'empty' ? '<span class="muted">open (computer if nobody joins)</span>' : esc(st.name || (st.kind === 'computer' ? 'Computer' : 'Player'))) +
        (i === s.mySeat ? ' <span class="muted">(you)</span>' : '') + (st.kind === 'human' && !st.online && i !== s.mySeat ?' <span class="muted">offline</span>' : '') + '</span>' +
        (host && i !== s.mySeat ? '<button class="btn small" data-a="seat" data-i="' + i + '">' + (st.kind === 'computer' ? 'Open' : 'Computer') + '</button>' : '') + '</div>').join('') +
      '</div>' +
      '<div class="muted" style="font-size:12.5px">' + esc(s.options && s.options.variant === 'barrage' ? 'Barrage' : 'Classic') + ' · computer level ' + esc(LEVEL_NAME[(s.options && s.options.level) || 'medium']) + '</div>' +
      '<div class="row">' + (host ? '<button class="btn primary grow" data-a="startroom">Start</button>' : '<div class="grow muted">Waiting for the host to start…</div>') +
      '<button class="btn" data-a="leave">Leave</button></div></div></div>';
    v.onclick = e => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'startroom') onlineCall(net.room.start());
      if (a.dataset.a === 'leave') leaveRoom();
      if (a.dataset.a === 'seat') {
        const i = +a.dataset.i;
        const st = s.seats[i];
        onlineCall(net.room.setSeat(i, st.kind === 'computer' ? 'empty' : 'computer'));
      }
    };
  }

  function lastMoveText(pub, me) {
    const h = pub.hist[pub.hist.length - 1];
    if (!h) return '';
    const who = h.s === me ? 'You' : 'They';
    const from = E.sqName(h.f, me), to = E.sqName(h.t, me);
    if (!h.b) return who + ' moved ' + from + '→' + to;
    const ar = rankName(h.b.ar);
    const dr = h.b.dr === null ? 'a hidden piece' : rankName(h.b.dr);
    const res = h.b.out === 'both' ? 'both lost' : h.b.out === 'att' ? ar + ' won' : ar + ' lost';
    return who + ': ' + ar + ' hit ' + dr + ' — ' + res;
  }

  function resultText(res, me) {
    if (res.winner === -1) return 'Draw — neither side can move';
    const won = res.winner === me;
    const why = res.why === 'flag' ? (won ? 'you took the Flag' : 'your Flag was taken') : res.why === 'resign' ? (won ? 'they resigned' : 'you resigned') : (won ? 'they can\'t move' : 'you can\'t move');
    return (won ? 'You won — ' : 'You lost — ') + why;
  }

  function renderGame(v, snap) {
    const pub = snap.pub;
    const me = snap.mySeat;
    if (!pub) { v.innerHTML = '<div class="setup"><div class="panel">Connecting…</div></div>'; resetBoard(); return; }
    if (!v.querySelector('#game')) {
      v.innerHTML = '<div id="game"><div class="gstatus" id="g-status"></div><div class="boardcol" id="g-board"></div>' +
        '<div class="side" id="g-side"><div class="panel" id="info-side"></div><div class="panel" id="army-side"></div><div class="panel logbox"><div class="label">Moves</div><div class="scroll fade" id="log-side" style="margin-top:6px"></div></div><div class="gacts" id="acts-side"></div></div>' +
        '<div class="info" id="info-phone"></div><div class="gacts" id="acts-phone"></div></div>';
      resetBoard();
      v.onclick = onGameButtons;
    }
    const bw = ensureBoard($('#g-board'), me < 0 ? 0 : me);
    const odds = oddsFor(pub, me);
    // status line
    const myTurn = snap.myTurn;
    let status, sub = '';
    if (pub.phase === 'setup') {
      const sent = snap.mine && snap.mine.layout;
      status = sent ? 'Waiting for the other army…' : 'Place your army';
      sub = sent ? '' : (pub.opts.variant === 'barrage' ? 'Barrage' : 'Classic');
    } else if (pub.phase === 'over') {
      status = resultText(pub.result, me);
    } else {
      status = myTurn ? 'Your move' : (snap.mode === 'local' ? 'Computer is thinking…' : esc((snap.seats[pub.turn] || {}).name || COLORS[pub.turn]) + ' to move');
      sub = lastMoveText(pub, me);
    }
    const color = me >= 0 ? (me ? 'var(--blue)' : 'var(--red)') : 'var(--muted)';
    const waiting = pub.phase === 'play' && !myTurn;
    bw.classList.toggle('turn-0', pub.phase === 'play' && myTurn && me === 0);
    bw.classList.toggle('turn-1', pub.phase === 'play' && myTurn && me === 1);
    setHTML($('#g-status'), '<div class="turnchip' + (pub.phase === 'play' && myTurn ? ' mine' : '') + '"><span class="dot' + (waiting ? ' pulse' : '') + '" style="background:' + (pub.phase === 'play' ? (pub.turn ? 'var(--blue)' : 'var(--red)') : color) + '"></span><span class="st">' + status + '</span><span class="sub">' + esc(sub) + '</span></div>' +
      (snap.mode === 'online' && snap.code ? '<span class="muted" style="font-size:12px">' + esc(snap.code) + '</span>' : '') +
      (pub.phase === 'play' ? '<button class="icon-btn" data-a="odds" aria-pressed="' + store.settings.showOdds + '" title="Odds on pieces"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></button>' +
        '<button class="icon-btn" data-a="hint" title="Hint"' + (myTurn ? '' : ' disabled') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg></button>' : ''));

    // board contents
    let dests = null, badges = null;
    const legal = legalFor(snap);
    if (pub.phase === 'setup') {
      // show my army on my side (sent or not yet sent)
      const layout = (snap.mine && snap.mine.layout) || E.layoutFromOwn(mySetup(pub.opts.variant), me);
      const fake = { cells: new Array(100).fill(null) };
      layout.forEach((r, k) => { if (r >= 0) fake.cells[E.zoneOf(me) + k] = [me, E.zoneOf(me) + k, null, 0]; });
      // a classic army fills all 40 squares, so its backs can be shown once it is in (Barrage squares stay secret)
      if (pub.ready[1 - me] && pub.opts.variant === 'classic') for (let k = 0; k < 40; k++) fake.cells[E.zoneOf(1 - me) + k] = [1 - me, E.zoneOf(1 - me) + k, null, 0];
      const own = layout.map((r, k) => [E.zoneOf(me) + k, r]).filter(x => x[1] >= 0);
      drawPieces(bw, fake, { own }, me, {});
    } else {
      if (ui.sel >= 0 && !legal.some(m => m[0] === ui.sel)) ui.sel = -1;
      if (ui.sel >= 0) {
        dests = new Set(legal.filter(m => m[0] === ui.sel).map(m => m[1]));
        // win chances right where the decision is made
        const myR = (snap.mine.own.find(x => x[0] === pub.cells[ui.sel][1]) || [])[1];
        badges = {};
        for (const t of dests) {
          const c = pub.cells[t];
          if (!c) continue;
          const p = c[2] !== null ? oneHot(c[2]) : odds && odds.byId[c[1]];
          if (!p) continue;
          const f = Odds.fightOdds(myR, p, pub.opts);
          badges[t] = f.win + f.tie * 0.5;
        }
      }
      if (ui.hint && pub.phase === 'play') dests = new Set([ui.hint.to]);
      const lastH = pub.hist[pub.hist.length - 1];
      const truth = pub.phase === 'over' && pub.layouts ? truthFromLayouts(pub.layouts) : null;
      drawPieces(bw, pub, snap.mine, me, { odds, showOdds: store.settings.showOdds, sel: ui.hint ? ui.hint.from : ui.sel, dests, badges, focus: ui.focus,
        last: lastH ? [lastH.f, lastH.t] : null, clickable: pub.phase === 'play', reveal: pub.phase === 'over', truth });
      // fight popup for a new fight
      const total = (pub.histFrom || 0) + pub.hist.length;
      if (total > ui.lastHistLen && lastH && lastH.b && ui.lastHistLen > 0) {
        const own = {};
        for (const [id, r] of snap.mine.own) own[id] = r;
        showFight(bw, me, lastH, pub, own);
      }
      ui.lastHistLen = total;
    }
    // removed pieces lie face up in each player's margin of the board, sorted by rank
    const far = 1 - (me < 0 ? 0 : me), near = me < 0 ? 0 : me;
    setHTML($('#grave-far'), graveHtml(pub, far, ''));
    setHTML($('#grave-near'), graveHtml(pub, near, ''));
    // sounds, shakes and celebrations for whatever changed since the last draw (local and online alike)
    if (hasFX) StrSfx.observe({ pub, me, myTurn, mode: snap.mode }, {
      board: () => boardEl,
      sqEl: sq => boardEl && boardEl.querySelector('.cell[data-sq="' + sq + '"]'),
      status: () => $('#g-status .turnchip'),
    });
    // info + actions
    const info = infoHtml(snap, odds);
    const acts = actsHtml(snap);
    // only touch what changed, and only the layout on screen (phone strip or laptop side)
    const wide = window.innerWidth >= 900;
    setHTML($('#info-phone'), wide ? '' : info);
    setHTML($('#acts-phone'), wide ? '' : acts);
    setHTML($('#info-side'), wide ? info : '');
    setHTML($('#acts-side'), wide ? acts : '');
    setHTML($('#army-side'), wide ? armyHtml(snap, odds) : '');
    setHTML($('#log-side'), wide ? logHtml(pub, me) : '');
    sizeBoard();
  }
  /** Late in a game every rank can be in the margin: when the stacks don't fit, they close up and the
      count sits on the stack, so none is cut off. */
  /** One side's removed pieces as small stacks lying beside the board (highest rank first). */
  function graveHtml(pub, side, name) {
    const order = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 0];
    const n = {};
    let hidden = 0;
    for (const [o, , r] of pub.dead || []) if (o === side) { if (r === null) hidden++; else n[r] = (n[r] || 0) + 1; }
    const stack = (r, k) => '<span class="gs" title="' + (r === null ? 'hidden' : esc(rankName(r))) + ' ×' + k + '">' +
      Array.from({ length: Math.min(k, 3) }, (_, i) => '<i style="--i:' + i + '">' + Art.flat(side, r, store.settings.numbering) + '</i>').join('') +
      (k > 1 ? '<b>' + k + '</b>' : '') + '</span>';
    const html = order.filter(r => n[r]).map(r => stack(r, n[r])).join('') + (hidden ? stack(null, hidden) : '');
    return (name ? '<span class="seat"><i style="background:' + (side ? 'var(--blue)' : 'var(--red)') + '"></i>' + esc(name) + '</span>' : '') + '<span class="gl">' + html + '</span>';
  }
  const oneHot = r => { const a = new Float64Array(12); a[r] = 1; return a; };
  function truthFromLayouts(layouts) {
    const t = {};
    for (const s of [0, 1]) layouts[s].forEach((r, k) => { if (r >= 0) t[E.zoneOf(s) + k] = r; });
    return t;
  }

  /** What's left of the enemy army: per rank, how many are still out there (known + hidden). */
  function armyCounts(pub, me) {
    const enemy = 1 - me;
    const total = E.ARMIES[pub.opts.variant];
    const lost = new Array(12).fill(0);
    for (const [o, , r] of pub.dead) if (o === enemy && r !== null) lost[r]++;
    const hiddenDead = pub.dead.filter(d => d[0] === enemy && d[2] === null).length;
    return { total, lost, hiddenDead };
  }

  function armyHtml(snap, odds) {
    const pub = snap.pub;
    if (!pub || pub.phase === 'setup') return '<div class="label">Their army</div><div class="muted" style="font-size:13px;margin-top:6px">Hidden until the game starts.</div>';
    const me = snap.mySeat;
    const { total, lost, hiddenDead } = armyCounts(pub, me);
    const order = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 0];
    return '<div class="row"><span class="label grow">Their army left</span>' + q('odds') + '</div><div class="ranks" style="margin-top:6px">' +
      order.filter(r => total[r]).map(r => {
        const left = total[r] - lost[r];
        return '<div class="rk' + (left ? '' : ' zero') + '"><div class="mini">' + Art.piece(1 - me, r, store.settings.numbering) + '</div><b>' + left + '</b><span>/' + total[r] + '</span></div>';
      }).join('') + '</div>' + (hiddenDead ? '<div class="muted" style="font-size:12px;margin-top:4px">' + hiddenDead + ' taken without being shown (Silent Defense).</div>' : '');
  }

  function infoHtml(snap, odds) {
    const pub = snap.pub;
    const me = snap.mySeat;
    if (pub.phase === 'setup') {
      if (snap.mine && snap.mine.layout) return '<div class="infohead"><b>Army sent.</b></div><div class="muted" style="font-size:13px">The game starts when both armies are in. Red moves first.</div>';
      return '<div class="infohead"><b>Your army</b></div><div class="muted" style="font-size:13px">' + (pub.ready[1 - me] ? 'Their army is in. ' : '') + 'Arrange yours in the Setup tab (swap pieces, see the analysis), then press Ready.</div>';
    }
    if (pub.phase === 'over') {
      return '<div class="infohead"><b>' + esc(resultText(pub.result, me)) + '</b></div><div class="muted" style="font-size:13px">Both armies are shown. Study replays the game with the odds you had at each fight.</div>';
    }
    // a focused enemy piece: its rank chances
    if (ui.focus >= 0) {
      const sq = pub.cells.findIndex(c => c && c[1] === ui.focus);
      if (sq >= 0) {
        const c = pub.cells[sq];
        const p = c[2] !== null ? oneHot(c[2]) : odds && odds.byId[c[1]];
        if (p) {
          let best = 0; for (let k = 0; k < 12; k++) if (p[k] > p[best]) best = k;
          const order = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 0];
          let fightLine = '';
          if (ui.sel >= 0) {
            const myR = (snap.mine.own.find(x => x[0] === pub.cells[ui.sel][1]) || [])[1];
            const f = Odds.fightOdds(myR, p, pub.opts);
            fightLine = '<div class="fightline">Your ' + esc(rankName(myR)) + ': <span class="ok">win ' + pct(f.win) + '</span><span class="no">lose ' + pct(f.lose) + '</span>' + (f.tie ? '<span>both ' + pct(f.tie) + '</span>' : '') + '</div>';
          }
          return '<div class="infohead"><b>' + (c[2] !== null ? rankName(c[2]) + ' (shown)' : 'Hidden piece at ' + E.sqName(sq, me)) + '</b><span class="muted grow">' + (c[2] === null ? 'most likely ' + rankName(best) + ' ' + pct(p[best]) : '') + '</span>' + q('odds') + '</div>' +
            '<div class="ranks">' + order.map(r => '<div class="rk"><span class="pv">' + (p[r] >= 0.005 ? Math.round(p[r] * 100) : '') + '</span><div class="pbar' + (r === best ? ' hi' : '') + '"><i style="height:' + Math.round(p[r] / Math.max(p[best], 1e-9) * 100) + '%"></i></div><b>' + lab(r) + '</b></div>').join('') + '</div>' + fightLine;
        }
      }
    }
    if (ui.sel >= 0) {
      const myR = (snap.mine.own.find(x => x[0] === pub.cells[ui.sel][1]) || [])[1];
      return '<div class="infohead"><b>' + esc(rankName(myR)) + '</b><span class="muted">' + E.sqName(ui.sel, me) + '</span></div><div class="muted" style="font-size:13px">Tap a dot to move. A % on an enemy piece is your chance to win that fight (ties count half). Tap an enemy piece for its full odds.</div>';
    }
    // on a laptop the army has its own panel just below, so this one only says what a tap does
    if (window.innerWidth >= 900) return '<div class="infohead muted ph">Tap a piece</div>';
    return armyHtml(snap, odds).replace('Their army left', 'Their army left · tap a piece');
  }

  function actsHtml(snap) {
    const pub = snap.pub;
    if (pub.phase === 'setup') {
      if (snap.mine && snap.mine.layout) return snap.mode === 'online' ? '<button class="btn" data-a="leave">Leave room</button>' : '<button class="btn" data-a="quit">Quit</button>';
      // a way out before the army goes in (started the wrong game, changed one's mind)
      return (snap.mode === 'online' ? '<button class="btn ghost out" data-a="leave">Leave</button>' : '<button class="btn ghost out" data-a="quit">Quit</button>') +
        '<button class="btn" data-a="editsetup">Edit setup</button><button class="btn primary" data-a="ready">Ready</button>';
    }
    if (pub.phase === 'over') {
      return '<button class="btn" data-a="study">Study game</button>' + (snap.mode === 'online' ? '<button class="btn" data-a="leave">Leave room</button>' : '<button class="btn primary" data-a="newgame">New game</button>');
    }
    return '<button class="btn ghost" data-a="resign"' + (snap.myTurn ? '' : ' disabled') + '>Resign</button>' + (snap.mode === 'online' ? '<button class="btn" data-a="leave">Leave</button>' : '');
  }

  function logHtml(pub, me) {
    if (!pub.hist.length) return '<div class="muted" style="font-size:13px">No moves yet.</div>';
    const base = pub.histFrom || 0;
    const rows = pub.hist.slice(-40).map((h, i, arr) => {
      const n = base + pub.hist.length - arr.length + i + 1;
      const who = h.s === me ? 'You' : 'They';
      let t = who + ' ' + E.sqName(h.f, me) + '→' + E.sqName(h.t, me);
      if (h.b) t += ': ' + rankName(h.b.ar) + ' vs ' + (h.b.dr === null ? '?' : rankName(h.b.dr)) + ' — ' + (h.b.out === 'both' ? 'both out' : h.b.out === 'att' ? 'attacker won' : 'defender won');
      return '<li class="' + (h.s === me ? 'me' : '') + '"><span class="n">' + n + '</span>' + esc(t) + '</li>';
    }).reverse();
    return '<ul class="log">' + rows.join('') + '</ul>';
  }

  function onGameButtons(e) {
    const a = e.target.closest('[data-a]');
    if (!a || a.disabled) return;
    // a quick second tap must not land on the button that took the first one's place (Ready -> Resign)
    const now = Date.now();
    if (now - ui.tapAt < 500 && a.dataset.a !== ui.tapA) return;
    ui.tapAt = now; ui.tapA = a.dataset.a;
    const snap = snapNow();
    switch (a.dataset.a) {
      case 'odds': store.settings.showOdds = !store.settings.showOdds; save(); render(); break;
      case 'hint': {
        if (!snap || !snap.myTurn) return;
        const m = Bots.hint(snap.pub, snap.mine, snap.mySeat, Math.random);
        if (m) {
          ui.hint = m; ui.sel = -1; toast('Hint: ' + E.sqName(m.from, snap.mySeat) + ' → ' + E.sqName(m.to, snap.mySeat)); render();
          // one timer: a second Hint restarts the full time instead of being cut short by the first
          clearTimeout(ui.hintTimer);
          ui.hintTimer = setTimeout(() => { if (ui.hint === m) { ui.hint = null; render(); } }, 2600);
        }
        break;
      }
      case 'resign': confirmBox('Resign this game?', 'Resign', () => act({ type: 'resign' })); break;
      case 'editsetup': su.variant = snap.pub.opts.variant; su.sel = -1; setTab('setup'); break; // the army for this game's variant
      case 'ready': {
        const variant = snap.pub.opts.variant;
        act({ type: 'setup', layout: E.layoutFromOwn(mySetup(variant), snap.mySeat) });
        break;
      }
      case 'study': setTab('study'); break;
      case 'newgame': local = null; store.local = null; save(); resetBoard(); render(); break;
      case 'quit': confirmBox('Quit this game?', 'Quit', () => { local = null; store.local = null; save(); resetBoard(); render(); }); break;
      case 'leave': confirmBox('Leave the room? A computer takes your seat.', 'Leave', leaveRoom); break;
    }
    // slow work above (odds at the start of a game) must not let a double tap's second half through
    ui.tapAt = Date.now();
  }

  // ================================================================== SETUP TAB
  const su = { variant: null, sel: -1, heat: -1, tokens: null, test: null, worker: null };
  function suVariant() { return su.variant || (snapNow() && snapNow().pub && snapNow().pub.phase === 'setup' ? snapNow().pub.opts.variant : store.newGame.variant); }

  function analyzeSetup(own, variant) {
    const out = [];
    const fk = own.indexOf(E.FLAG);
    const depth = Math.floor(fk / 10);
    const S = variant === 'classic' && D && D.stats; // the real-game numbers are from Classic games only
    if (depth === 3) out.push(['good', 'Flag on the back row', S ? 'Players who do this win ' + pct(S.flagDepthWins[3] / S.flagDepthGames[3]) : '']);
    else out.push([depth === 2 ? 'warn' : 'bad', 'Flag is ' + ['on the front row', 'on row 2', 'on row 3'][depth], S ? 'Real players win ' + pct(S.flagDepthWins[depth] / Math.max(1, S.flagDepthGames[depth])) + ' like this (back row: ' + pct(S.flagDepthWins[3] / S.flagDepthGames[3]) + ')' : '']);
    const nb = [];
    if (depth > 0) nb.push(fk - 10);
    if (depth < 3) nb.push(fk + 10);
    if (fk % 10 > 0) nb.push(fk - 1);
    if (fk % 10 < 9) nb.push(fk + 1);
    const bombed = nb.filter(k => own[k] === E.BOMB).length;
    if (variant === 'classic') {
      if (bombed === nb.length) out.push(['good', 'Flag fully bombed in', S ? 'Wins ' + pct(S.flagBombed.wins / S.flagBombed.games) + ' vs ' + pct(S.flagOpen.wins / S.flagOpen.games) + ' when open' : '']);
      else out.push([bombed ? 'warn' : 'bad', 'Flag has ' + (nb.length - bombed) + ' open side' + (nb.length - bombed > 1 ? 's' : ''), 'Any piece can walk in there']);
      const frontBombs = own.slice(0, 10).filter(r => r === E.BOMB).length;
      if (frontBombs > 1) out.push(['warn', frontBombs + ' Bombs on the front row', 'They block your own lanes']);
      const lanes = [[0, 1], [4, 5], [8, 9]];
      const blocked = lanes.filter(l => l.every(c => own[c] === E.BOMB)).length;
      if (blocked) out.push(['warn', blocked + ' lane' + (blocked > 1 ? 's' : '') + ' shut by Bombs', 'Your own pieces can\'t get out']);
      const scoutsFront = own.slice(0, 20).filter(r => r === E.SCOUT).length;
      out.push([scoutsFront >= 2 ? 'good' : 'warn', scoutsFront + ' Scouts in the front two rows', 'Cheap pieces to find out what they have']);
      const minersBack = own.slice(20).filter(r => r === E.MINER).length;
      out.push([minersBack >= 2 ? 'good' : 'warn', minersBack + ' Miners in the back two rows', 'You need Miners late to open Bombs']);
    } else {
      if (Bots.flagLaneOpen(own)) out.push(['bad', 'Flag open to a Scout', 'Nothing stands in front of it: a Scout can run straight down that column']);
      out.push([bombed ? 'good' : 'warn', bombed ? 'Bomb next to the Flag' : 'Flag has no Bomb beside it', 'With one Bomb the Flag can\'t be closed in']);
    }
    const gk = own.indexOf(E.GENERAL), sk = own.indexOf(E.SPY);
    const d2 = (a, b) => Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) + Math.abs((a % 10) - (b % 10));
    out.push([d2(gk, sk) <= 2 ? 'good' : 'warn', d2(gk, sk) <= 2 ? 'Spy close to the General' : 'Spy far from the General', 'The Spy can hit their Marshal when it attacks your General']);
    return out;
  }

  /** Where the Flag is in an opponent's "most likely Flag" list (real-player odds at the start). */
  function flagGuess(own, variant) {
    if (variant === 'barrage') return null;
    const g = E.newGame({ variant });
    E.apply(g, 0, { type: 'setup', layout: E.layoutFromOwn(own, 0) });
    E.apply(g, 1, { type: 'setup', layout: E.layoutFromOwn(Bots.chooseSetup(variant, 'medium', Odds.mulberry(4)), 1) });
    const res = Odds.analyze(E.publicView(g), 1, { prior: 'real', steps: 40000, seed: 11 });
    const list = Object.entries(res.byId).map(([id, p]) => [+id, p[E.FLAG]]).sort((a, b) => b[1] - a[1]);
    const flagId = E.sqOfK(own.indexOf(E.FLAG), 0);
    const i = list.findIndex(x => x[0] === flagId);
    return { place: i + 1, p: list[i][1] };
  }

  function renderSetup() {
    const v = $('#v-setup');
    const variant = suVariant();
    const own = mySetup(variant).slice();
    if (!su.tokens || su.tokens.variant !== variant) su.tokens = { variant, pos: own.map((r, k) => k) };
    const lockedGame = (() => { const s = snapNow(); return s && s.pub && s.pub.phase === 'setup' && !(s.mine && s.mine.layout) && s.pub.opts.variant === variant; })();
    const checks = analyzeSetup(own, variant);
    const guess = flagGuess(own, variant);
    const heatRank = su.heat;
    v.innerHTML = '<div class="su">' +
      '<div class="su-head row">' + seg('suvariant', [['classic', 'Classic'], ['barrage', 'Barrage']], variant).replace('class="seg"', 'class="seg grow"') +
      (lockedGame ? '<button class="btn primary small" data-a="back">Back to game</button>' : '') + '</div>' +
      '<div class="su-grid"><div class="muted" style="font-size:12px;margin-bottom:4px">Front row (toward the enemy) on top · tap two squares to swap</div><div class="sugrid" id="sugrid"></div></div>' +
      '<div class="su-tools"><div class="sutools"><button class="btn small" data-a="real">Real setup</button><button class="btn small" data-a="shuffle">Shuffle</button><button class="btn small" data-a="mirror">Mirror</button></div>' +
      (variant === 'classic' ? '<div class="row" style="margin-top:8px"><span class="label">Where players put</span>' + q('heat') + '</div>' +
      '<div class="heatpick" style="margin-top:4px">' + [-1, 0, 11, 1, 2, 3, 10, 9].map(r => '<button data-heat="' + r + '" aria-pressed="' + (heatRank === r) + '">' + (r < 0 ? 'Off' : lab(r)) + '</button>').join('') + '</div>' : '') + '</div>' +
      '<div class="su-side panel scroll fade" style="display:flex;flex-direction:column;gap:10px">' +
      '<div class="sumrow">' + (guess ? '<div><div class="row"><span class="label">Flag found on guess</span>' + q('guess') + '</div><div class="big" style="color:' + pctColor(Math.min(1, guess.place / 12)) + '">#' + guess.place + '</div></div>' : '') +
      '<div class="grow"><div class="row"><span class="label">Test games</span>' + q('test') + '</div><div class="row"><div class="big" id="su-test">' + (su.test && su.test.variant === variant && su.test.key === own.join('') ? testText(su.test) : '—') + '</div>' +
      '<button class="btn small" data-a="test"' + (su.worker ? ' disabled' : '') + '>' + (su.worker ? 'Testing…' : 'Test it') + '</button></div></div></div>' +
      '<div class="checks">' + checks.map(([cls, t, why]) => '<div class="chk ' + cls + '"><span class="mk">' + (cls === 'good' ? '✓' : '!') + '</span><div><div>' + esc(t) + '</div>' + (why ? '<div class="muted" style="font-size:12px">' + esc(why) + '</div>' : '') + '</div></div>').join('') + '</div>' +
      '</div></div>';
    drawSetupGrid(own, variant);
    v.onclick = onSetupClick;
  }
  function testText(t) {
    if (!t.finished) return !t.done ? '…' : Math.round((t.wins + t.draws / 2) / t.done * 100) + '% <span class="muted" style="font-size:12px">' + t.done + '/' + t.n + '</span>';
    return Math.round((t.wins + t.draws / 2) / t.done * 100) + '% <span class="muted" style="font-size:12px">±' + Math.round(100 / Math.sqrt(t.done)) + ' · ' + t.done + ' games</span>';
  }
  function drawSetupGrid(own, variant) {
    const grid = $('#sugrid');
    if (!grid) return;
    const me = 0;
    let html = '';
    if (su.heat >= 0 && D && variant === 'classic') {
      const h = D.heat[su.heat];
      const mx = Math.max.apply(null, h);
      html += '<div class="ghost">' + h.map((x, k) => '<div style="position:absolute;left:' + (k % 10) * 10 + '%;top:' + Math.floor(k / 10) * 25 + '%;width:10%;height:25%;background:rgba(240,179,84,' + (0.85 * x / mx).toFixed(3) + ')"></div>').join('') + '</div>';
    }
    own.forEach((r, k) => {
      html += '<div class="sucell' + (r < 0 ? ' empty' : '') + (su.sel === k ? ' sel' : '') + '" data-k="' + k + '" style="left:' + (k % 10) * 10 + '%;top:' + Math.floor(k / 10) * 25 + '%">' +
        (r >= 0 ? Art.piece(me, r, store.settings.numbering) : '') + '</div>';
    });
    grid.classList.toggle('heaton', su.heat >= 0 && variant === 'classic');
    grid.innerHTML = html;
  }
  function onSetupClick(e) {
    const variant = suVariant();
    const segb = e.target.closest('[data-seg] button');
    if (segb) { su.variant = segb.dataset.val; su.sel = -1; render(); return; }
    const hb = e.target.closest('[data-heat]');
    if (hb) { su.heat = +hb.dataset.heat; render(); return; }
    const cell = e.target.closest('.sucell');
    if (cell) {
      const k = +cell.dataset.k;
      const own = mySetup(variant);
      let swapped = null;
      if (su.sel < 0) { if (own[k] >= 0 || variant === 'barrage') { su.sel = k; sfx('click'); } }
      else if (su.sel === k) su.sel = -1;
      else {
        [own[su.sel], own[k]] = [own[k], own[su.sel]];
        swapped = [su.sel, k];
        su.sel = -1;
        save();
      }
      render();
      if (swapped) { // both pieces set down on wood
        sfx('place');
        if (hasFX) swapped.forEach(j => { const el = $('#sugrid .sucell[data-k="' + j + '"]'); if (el && own[j] >= 0) FX.pop(el); });
      }
      return;
    }
    const a = e.target.closest('[data-a]');
    if (!a || a.disabled) return;
    const rng = Math.random;
    if (['real', 'shuffle', 'mirror'].includes(a.dataset.a)) sfx('slide'); // the whole army rearranged
    if (a.dataset.a === 'real') { store.setups[variant] = Bots.chooseSetup(variant, 'medium', rng); su.sel = -1; save(); render(); }
    if (a.dataset.a === 'shuffle') { store.setups[variant] = variant === 'barrage' ? Bots.barrageSetup(rng, false) : Bots.randomSetup('classic', rng); su.sel = -1; save(); render(); }
    if (a.dataset.a === 'mirror') { const o = mySetup(variant); store.setups[variant] = o.map((r, k) => o[Math.floor(k / 10) * 10 + 9 - (k % 10)]); save(); render(); }
    if (a.dataset.a === 'back') setTab('play');
    if (a.dataset.a === 'test') runTest(variant);
  }
  function runTest(variant) {
    const own = mySetup(variant).slice();
    let w;
    try { w = new Worker('js/worker.js?v=5'); } catch (e) { toast('Testing needs a newer browser.'); return; }
    su.worker = w;
    su.test = { variant, key: own.join(''), wins: 0, losses: 0, draws: 0, done: 0, n: 24 };
    w.onmessage = ev => {
      const m = ev.data;
      Object.assign(su.test, { wins: m.wins, losses: m.losses, draws: m.draws, done: m.type === 'done' ? m.n : m.done });
      if (m.type === 'done') { su.test.done = m.n; su.test.finished = true; w.terminate(); su.worker = null; if (tab === 'setup') render(); return; }
      const el = $('#su-test'); if (el) el.innerHTML = testText(su.test);
    };
    w.onerror = () => { su.worker = null; toast('Test stopped.'); render(); };
    w.postMessage({ type: 'test', own, variant, n: 24, seed: (Date.now() % 100000) + 1 });
    render();
  }

  // ================================================================== STUDY TAB
  const st = { idx: -1, view: 'game', analysis: null, running: false, job: null };
  function replayStates(last) {
    // rebuild every position of the finished game from the two setups and the move list
    const g = E.newGame(last.opts, last.names);
    E.apply(g, 0, { type: 'setup', layout: last.layouts[0] });
    E.apply(g, 1, { type: 'setup', layout: last.layouts[1] });
    // each kept position leaves out the move list (nothing here reads it), so a 1,000-move game
    // copies 1,000 boards instead of half a million moves
    const J = x => x === null || x === undefined ? x : JSON.parse(JSON.stringify(x));
    const copy = () => Object.assign({}, g, { hist: [], pieces: g.pieces.map(p => p && Object.assign({}, p)), board: g.board.slice(),
      streak: J(g.streak), last: J(g.last), chase: J(g.chase), cons: Object.assign({}, g.cons), result: J(g.result) });
    const states = [copy()];
    for (const h of last.hist) {
      if (g.phase !== 'play') break;
      g.turn = h.s;
      E.doMove(g, h.s, h.f, h.t);
      states.push(copy());
    }
    return states;
  }
  let stCache = { key: null, states: null };
  function studyStates() {
    const last = store.last;
    if (!last) return null;
    if (stCache.key !== last.key) {
      const states = replayStates(last);
      stCache = { key: last.key, states, mat: [states.map(s => material(s, last.me)), states.map(s => material(s, 1 - last.me))] };
      st.idx = states.length - 1; st.analysis = null;
    }
    return stCache.states;
  }
  function material(g, seat) {
    const v = Bots.values();
    let s = 0;
    for (const p of g.pieces) if (p && p.o === seat && p.pos >= 0 && p.r !== E.FLAG) s += v[p.r];
    return s;
  }

  function renderStudy() {
    const v = $('#v-study');
    const states = studyStates();
    const S = D && D.stats;
    const factsHtml = S ? '<div class="facts">' +
      '<div class="fact"><div class="big">' + pct(S.redWins / S.games) + '</div><span>First mover wins (Blue ' + pct(S.blueWins / S.games) + ')</span></div>' +
      '<div class="fact"><div class="big">' + S.avgMoves + '</div><span>Moves in an average game</span></div>' +
      '<div class="fact"><div class="big">' + pct(S.flagDepth[3] / (S.games * 2)) + '</div><span>Flags hidden on the back row</span></div>' +
      '<div class="fact"><div class="big">' + pct(S.flagCorner / (S.games * 2)) + '</div><span>Flags in a back corner</span></div>' +
      '<div class="fact"><div class="big">' + pct(S.ends.flag / S.games) + '</div><span>Games ended by taking the Flag (' + pct(S.ends.resign / S.games) + ' resigned)</span></div>' +
      '<div class="fact"><div class="big">' + pct(S.flagBombed.games / (S.flagBombed.games + S.flagOpen.games)) + '</div><span>Flags fully bombed in</span></div>' +
      '</div><div class="muted" style="font-size:12px">' + esc(D.source) + '. More in the Setup tab heat map.</div>' : '';
    if (!states) {
      v.innerHTML = '<div class="study"><div class="st-top panel"><b>No finished game yet.</b><div class="muted" style="font-size:13px">Finish a game and it shows up here with every hidden piece revealed.</div></div><div class="st-side"><div class="label">From 42,488 real games</div>' + factsHtml + '</div></div>';
      resetStudyBoard();
      return;
    }
    const last = store.last;
    const me = last.me;
    if (st.idx > states.length - 1 || st.idx < 0) st.idx = states.length - 1;
    const g = states[st.idx];
    if (!v.querySelector('.study.has')) {
      v.innerHTML = '<div class="study has"><div class="st-top"><div class="tabs2" id="st-tabs"></div><div class="stepper" style="margin-top:6px"><button class="icon-btn" data-a="prev" aria-label="Back one move"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 6l-6 6 6 6"/></svg></button><input type="range" id="st-range" min="0"><button class="icon-btn" data-a="next" aria-label="Forward one move"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg></button><span class="muted" id="st-n" style="font-size:12.5px;min-width:64px;text-align:right"></span></div></div>' +
        '<div class="st-board boardcol" id="st-board"></div><div class="st-side panel" id="st-side" data-min="218" style="min-height:0;flex:1;display:flex;flex-direction:column;gap:6px"></div></div>';
      v.onclick = onStudyClick;
      v.oninput = e => { if (e.target.id === 'st-range') { st.idx = +e.target.value; renderStudy(); } };
      resetStudyBoard();
    }
    $('#st-tabs').innerHTML = '<button data-v="game" aria-pressed="' + (st.view === 'game') + '">This game</button><button data-v="facts" aria-pressed="' + (st.view === 'facts') + '">Real games</button>';
    const r = $('#st-range'); r.max = states.length - 1; r.value = st.idx;
    $('#st-n').textContent = 'move ' + st.idx + '/' + (states.length - 1);
    // board: everything revealed
    const host = $('#st-board');
    const bw = ensureStudyBoard(host, me);
    const pub = E.publicView(g);
    const truth = truthFromLayouts(last.layouts);
    const h = st.idx > 0 ? last.hist[st.idx - 1] : null;
    drawStudyPieces(bw, pub, truth, me, h ? [h.f, h.t] : null, g);
    // side
    const side = $('#st-side');
    if (st.view === 'facts') { side.innerHTML = '<div class="label">From 42,488 real games</div>' + factsHtml; side._key = null; sizeBoard(); return; }
    const res = last.result;
    // a check left half-done (the player went to another tab) carries on where it stopped
    if (st.job && st.job.key === last.key && !st.running) startAnalysis();
    const [myMat, theirMat] = stCache.mat;
    const sideKey = last.key + '|' + (st.analysis ? 1 : 0) + '|' + st.running;
    if (side._key !== sideKey) {
      // the move list is long: build it once, then only move the highlight
      side.innerHTML = '<div class="row"><b class="grow">' + esc(resultText(res, me)) + '</b><span class="muted" style="font-size:12px">' + esc(last.mode === 'computer' ? 'vs ' + LEVEL_NAME[last.level] : 'online') + '</span></div>' +
        '<div class="chart">' + chartSvg(myMat, theirMat, st.idx) + '</div>' +
        '<div class="row"><span class="label grow">Your moves</span>' + q('lost') + (st.analysis ? '' : '<button class="btn small" data-a="analyze"' + (st.running ? ' disabled' : '') + '>' + (st.running ? analysisLabel() : 'Check my moves') + '</button>') + '</div>' +
        '<div class="scroll" style="flex:1"><table class="turns"><thead><tr><th>#</th><th>Move</th><th>Note</th></tr></thead><tbody>' + (last.hist.length > 300 ? '' : studyRows(last, me)) + '</tbody></table></div>';
      side._key = sideKey;
      // a very long game: show the board first and fill the move list just after, so the tab opens at once
      if (last.hist.length > 300) requestAnimationFrame(() => setTimeout(() => {
        if (side._key !== sideKey || !side.isConnected) return;
        const tb = side.querySelector('tbody'); if (!tb || tb.firstChild) return;
        tb.innerHTML = studyRows(last, me);
        const c = side.querySelector('tr[data-i="' + st.idx + '"]');
        if (c) { c.classList.add('cur'); c.scrollIntoView({ block: 'nearest' }); }
      }, 0));
    } else {
      const x = (st.idx / Math.max(1, myMat.length - 1) * 100).toFixed(3);
      const ln = side.querySelector('.chart line');
      if (ln) { ln.setAttribute('x1', x); ln.setAttribute('x2', x); }
      const old = side.querySelector('tr.cur');
      if (old) old.classList.remove('cur');
    }
    const cur = side.querySelector('tr[data-i="' + st.idx + '"]');
    if (cur) { cur.classList.add('cur'); cur.scrollIntoView({ block: 'nearest' }); }
    sizeBoard();
  }
  function analysisLabel() {
    const j = st.job, n = store.last ? store.last.hist.length : 0;
    return 'Checking… ' + (j && n ? Math.floor(j.i / n * 100) : 0) + '%';
  }
  function chartSvg(a, b, idx) {
    const n = Math.max(1, a.length - 1);
    // the y-axis spans only the values that occur, so the two lines use the whole height
    const all = a.concat(b);
    const mx = Math.max.apply(null, all), mn = Math.min.apply(null, all);
    const span = mx - mn || 1;
    const pts = arr => arr.map((v, i) => (i / n * 100).toFixed(2) + ',' + (37 - (v - mn) / span * 34).toFixed(2)).join(' ');
    return '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="' + pts(b) + '" fill="none" stroke="#969db4" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
      '<polyline points="' + pts(a) + '" fill="none" stroke="#6ea8fe" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
      '<line x1="' + (idx / n * 100) + '" x2="' + (idx / n * 100) + '" y1="0" y2="40" stroke="#f0b354" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>' +
      '<div class="muted" style="font-size:11.5px"><span style="color:#6ea8fe">■</span> your army value · <span>■</span> theirs</div>';
  }
  function studyRows(last, me) {
    const rows = [];
    last.hist.forEach((h, i) => {
      const mine = h.s === me;
      let note = '';
      const an = st.analysis && st.analysis[i];
      if (an) {
        if (an.win !== undefined) note += 'Win chance ' + pct(an.win) + ' ';
        if (an.lost !== undefined && an.lost > 0.5) note += '<span class="' + (an.lost > 3 ? 'no' : '') + '">−' + an.lost.toFixed(1) + '</span>';
        else if (an.lost !== undefined) note += '<span class="ok">✓</span>';
      }
      let t = (mine ? 'You ' : 'They ') + rankName(h.b ? h.b.ar : (truthOf(last, h.id))) + ' ' + E.sqName(h.f, me) + '→' + E.sqName(h.t, me);
      if (h.b) t += ' hit ' + rankName(h.b.dr === null ? truthOf(last, h.b.d) : h.b.dr) + (h.b.out === 'both' ? ' (both out)' : (h.b.out === 'att' ? ' (won)' : ' (lost)'));
      if (!mine && !h.b && !an) return rows.push('<tr data-i="' + (i + 1) + '" class="' + (st.idx === i + 1 ? 'cur' : '') + '"><td class="n muted">' + (i + 1) + '</td><td class="muted">' + esc(t) + '</td><td></td></tr>');
      rows.push('<tr data-i="' + (i + 1) + '" class="' + (st.idx === i + 1 ? 'cur' : '') + '"><td class="n muted">' + (i + 1) + '</td><td>' + esc(t) + '</td><td>' + note + '</td></tr>');
    });
    return rows.join('');
  }
  function truthOf(last, id) {
    const s = id >= 60 ? 0 : 1;
    return last.layouts[s][id - E.zoneOf(s)];
  }
  function runAnalysis() {
    if (!st.job || st.job.key !== store.last.key) st.job = { key: store.last.key, out: [], i: 0 };
    startAnalysis();
    render();
  }
  /** Check the moves a slice at a time. Leaving Study pauses it; it only counts as done when every move is checked. */
  function startAnalysis() {
    const last = store.last, job = st.job;
    const states = studyStates();
    const me = last.me;
    st.running = true;
    const out = job.out;
    function chunk() {
      if (st.job !== job || !store.last || store.last.key !== job.key) { st.running = false; return; }
      let i = job.i;
      const t0 = Date.now();
      while (i < last.hist.length && Date.now() - t0 < 40) {
        const h = last.hist[i];
        if (h.s === me && states[i]) {
          const g = states[i];
          const pub = E.publicView(Object.assign({}, g, { phase: 'play' }));
          const mine = E.privateView(g, me);
          const r = Bots.rate(pub, mine, me);
          const k = r.legal.findIndex(m => m[0] === h.f && m[1] === h.t);
          const best = Math.max.apply(null, r.scores);
          const a = {};
          if (k >= 0) a.lost = Math.max(0, best - r.scores[k]);
          if (h.b) {
            const odds = Odds.analyze(pub, me, { prior: pub.opts.variant === 'barrage' ? 'flat' : 'real', steps: 20000 });
            const c = pub.cells[h.t];
            const p = c && c[2] !== null ? oneHot(c[2]) : odds.byId[h.b.d];
            if (p) { const f = Odds.fightOdds(h.b.ar, p, pub.opts); a.win = f.win + f.tie / 2; }
          }
          out[i] = a;
        }
        i++;
        job.i = i;
      }
      if (i >= last.hist.length) { st.analysis = out; st.job = null; st.running = false; if (tab === 'study') render(); return; }
      if (tab !== 'study') { st.running = false; return; } // paused; carries on when Study opens again
      const b = $('#st-side [data-a="analyze"]'); if (b) b.textContent = analysisLabel();
      setTimeout(chunk, 0);
    }
    setTimeout(chunk, 0);
  }
  function onStudyClick(e) {
    const t = e.target.closest('[data-v]');
    if (t) { st.view = t.dataset.v; render(); return; }
    const row = e.target.closest('tr[data-i]');
    if (row) { st.idx = +row.dataset.i; render(); return; }
    const a = e.target.closest('[data-a]');
    if (!a || a.disabled) return;
    const states = studyStates();
    if (a.dataset.a === 'prev') st.idx = Math.max(0, st.idx - 1);
    if (a.dataset.a === 'next') st.idx = Math.min(states.length - 1, st.idx + 1);
    if (a.dataset.a === 'analyze') { if (!st.running) runAnalysis(); return; }
    render();
  }
  // the study board is its own board (so the play board keeps its state)
  let sBoard = null, sSeat = -1;
  const sPcs = new Map();
  function resetStudyBoard() { sBoard = null; sPcs.clear(); }
  function ensureStudyBoard(host, me) {
    if (sBoard && sSeat === me && host.contains(sBoard)) return sBoard;
    sBoard = document.createElement('div');
    sBoard.className = 'bwrap';
    sBoard.innerHTML = Art.boardSvg().replace('<svg', '<svg class="bg"') + '<div class="cells"></div><div class="pcs"></div>';
    const cells = sBoard.querySelector('.cells');
    for (let sq = 0; sq < 100; sq++) { if (E.IS_LAKE[sq]) continue; const c = document.createElement('div'); c.className = 'cell'; c.dataset.sq = sq; placeStyle(c, sq, me); cells.appendChild(c); }
    sPcs.clear(); sSeat = me;
    host.innerHTML = ''; host.appendChild(sBoard);
    return sBoard;
  }
  function drawStudyPieces(bw, pub, truth, me, last, g) {
    const pcs = bw.querySelector('.pcs');
    const seen = new Set();
    pub.cells.forEach((c, sq) => {
      if (!c) return;
      const [o, id, r] = c;
      seen.add(id);
      let el = sPcs.get(id);
      if (!el) { el = document.createElement('div'); el.className = 'pc'; placeStyle(el, sq, me); pcs.appendChild(el); sPcs.set(id, el); }
      const rank = truth[id];
      const known = g && g.pieces[id] ? (g.pieces[id].rv || g.pieces[id].sc) : r !== null;
      const html = Art.piece(o, rank, store.settings.numbering) + (known ? '<i class="seen"></i>' : '');
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
      el.classList.remove('gone');
      placeStyle(el, sq, me);
    });
    for (const [id, el] of sPcs) if (!seen.has(id)) { el.remove(); sPcs.delete(id); }
    bw.querySelectorAll('.cell').forEach(c => c.classList.toggle('last', !!(last && last.includes(+c.dataset.sq))));
  }

  // ================================================================== SETTINGS TAB
  function sw(name, on) { return '<label class="switch"><input type="checkbox" data-sw="' + name + '"' + (on ? ' checked' : '') + '><span></span></label>'; }
  function renderSettings() {
    const v = $('#v-settings');
    const s = store.settings;
    HELP.level = strengthHelp();
    v.innerHTML = '<div class="set scroll">' +
      '<div class="panel"><div class="label">Display</div>' +
      '<div class="setrow"><div class="grow"><b>Numbering</b><span>' + (s.numbering === 'classic' ? 'Marshal 1 … Scout 9, Spy S' : 'Marshal 10 … Spy 1') + '</span></div>' + q('numbering') + '</div>' +
      seg('numbering', [['modern', 'Marshal = 10'], ['classic', 'Marshal = 1']], s.numbering) +
      '<div class="setrow"><div class="grow"><b>Odds on enemy pieces</b><span>Most likely rank and its % on each hidden piece</span></div>' + sw('showOdds', s.showOdds) + '</div>' +
      '<div class="setrow"><div class="grow"><b>Odds model</b><span>' + (s.prior === 'real' ? 'Real players' : 'Flat') + '</span></div>' + q('prior') + '</div>' +
      seg('prior', [['real', 'Real players'], ['flat', 'Flat']], s.prior) + '</div>' +
      (hasFX ? '<div class="panel"><div class="label">Sound &amp; effects</div><div id="fx-box"></div></div>' : '') +
      '<div class="panel"><div class="label">Rules (new games)</div>' +
      '<div class="setrow"><div class="grow"><b>Scout moves and strikes</b><span>' + (s.scoutStrike ? 'Current rules' : 'Classic rules: stop first') + '</span></div>' + q('scout') + sw('scoutStrike', s.scoutStrike) + '</div>' +
      '<div class="setrow"><div class="grow"><b>Back-and-forth limit</b><span>Same two squares, moves in a row</span></div>' + q('twoSq') + '</div>' +
      seg('twoSq', [[3, '3 (rulebook)'], [5, '5 (older ISF)']], s.twoSq) +
      '<div class="setrow"><div class="grow"><b>No endless chasing</b><span>Tournament more-squares rule</span></div>' + q('chase') + sw('chase', s.chase) + '</div>' +
      '<div class="setrow"><div class="grow"><b>Aggressor Advantage</b><span>Ties go to the attacker</span></div>' + q('aggressor') + sw('aggressor', s.aggressor) + '</div>' +
      '<div class="setrow"><div class="grow"><b>Silent Defense</b><span>Defender never shows its rank</span></div>' + q('silent') + sw('silent', s.silent) + '</div></div>' +
      '<div class="panel"><div class="setrow"><div class="grow"><b>Computer strength</b><span>Measured, not guessed</span></div>' + q('level') + '</div>' +
      '<div class="setrow"><div class="grow"><b>Your record</b><span>' + LEVELS.map(l => LEVEL_NAME[l] + ' ' + store.record[l][0] + '–' + store.record[l][1]).join(' · ') + '</span></div><button class="btn small" data-a="reset">Reset all</button></div></div>' +
      '<div class="ver">Stratego Lab · original art · rules from the Jumbo rulebook and ISF tournament rules · data: gravon.de archive · <a href="../">all games</a></div></div>';
    if (hasFX) FX.renderSettings($('#fx-box'));
    v.onclick = e => {
      const b = e.target.closest('[data-seg] button');
      if (b) {
        const name = b.parentElement.dataset.seg;
        s[name] = name === 'twoSq' ? +b.dataset.val : b.dataset.val;
        save(); oddsCache.key = ''; resetBoard(); resetStudyBoard(); render(); return;
      }
      const a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'reset') confirmBox('Clear your setups, record, saved game and settings?', 'Reset', () => { try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } store = load(); local = null; resetBoard(); render(); });
    };
    v.onchange = e => {
      const i = e.target.closest('[data-sw]');
      if (!i) return;
      s[i.dataset.sw] = i.checked;
      save(); render();
    };
  }

  // ================================================================== render
  function renderTab() {
    if (tab === 'play') renderPlay();
    else if (tab === 'setup') renderSetup();
    else if (tab === 'study') renderStudy();
    else renderSettings();
  }
  function render() {
    closePop();
    try { renderTab(); }
    catch (err) {
      // a damaged save must never blank the page: drop only the part this tab was showing, then draw again
      console.warn('render failed', err);
      if (tab === 'play' && local) { clearTimeout(botTimer); local = null; store.local = null; resetBoard(); toast('The saved game could not be opened, so it was cleared.'); }
      else if (tab === 'study' && store.last) { store.last = null; stCache = { key: null, states: null }; st.analysis = null; resetStudyBoard(); toast('The saved game could not be replayed, so it was cleared.'); }
      else if (tab === 'setup') { const v = suVariant(); store.setups[v] = null; su.tokens = null; }
      else throw err;
      save();
      renderTab();
    }
  }

  // start
  resumeLocal();
  const startTab = (location.hash || '').slice(1);
  if (['setup', 'study', 'settings'].includes(startTab)) { tab = startTab; document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab)); }
  try { history.replaceState({ tab }, '', '#' + tab); } catch (e) { /* ignore */ }
  render();
  scheduleComputer();
  if (store.inRoom) loadOnline().then(() => net.room.resume()).then(ok => { if (!ok) { store.inRoom = false; save(); } render(); }).catch(() => { store.inRoom = false; save(); });
  window.__strat = { snap: snapNow, store: () => store, ui };
})();
