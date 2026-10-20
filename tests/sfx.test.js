// Sounds, animations and celebrations: which ones a real game triggers. Run: node tests/sfx.test.js
'use strict';
const assert = require('node:assert/strict');

// ---- a fake browser: Web Audio that counts nodes, a document whose elements count animations, storage blocked
let animCount = 0;
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = extra => Object.assign({ connect() {}, start() {}, stop() {} }, extra);
class FakeAC {
  constructor() { this.state = 'running'; this._t = 0; this.sampleRate = 8000; this.destination = node(); }
  get currentTime() { return (this._t += 1); } // time moves on, so the same-sound throttle never kicks in here
  resume() { return Promise.resolve(); }
  createGain() { return node({ gain: param() }); }
  createDynamicsCompressor() { return node(); }
  createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  createBufferSource() { return node({ loop: false }); }
  createOscillator() { return node({ frequency: param(), type: 'sine' }); }
  createBiquadFilter() { return node({ frequency: param(), Q: param(), type: 'lowpass' }); }
  createStereoPanner() { return node({ pan: param() }); }
}
function fakeEl() {
  return {
    style: { cssText: '' }, isConnected: true,
    animate() { animCount++; const a = { onfinish: null, oncancel: null }; setTimeout(() => a.onfinish && a.onfinish(), 0); return a; },
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 40, height: 40 }),
    remove() {}, setAttribute() {}, removeAttribute() {}, cloneNode() { return fakeEl(); }, appendChild() {},
  };
}
globalThis.AudioContext = FakeAC;
globalThis.document = { createElement: fakeEl, body: fakeEl(), head: fakeEl(), addEventListener() {}, removeEventListener() {}, getElementById: () => null };
globalThis.getComputedStyle = () => ({ borderRadius: '0' });
globalThis.innerWidth = 393; globalThis.innerHeight = 659;
globalThis.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 0);
Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('storage blocked'); }, configurable: true });

require('../js/fx.js');
const FX = globalThis.FX;
const E = require('../js/engine.js');
const Sfx = require('../js/sfx.js');
const { FLAG, SPY, SCOUT, MINER, SERGEANT, LIEUTENANT, CAPTAIN, MAJOR, MARSHAL, BOMB } = E;

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };

FX.init({ game: 'stratego-test' });
FX.unlock(); // as if the player had tapped (no sound before the first tap)
Sfx._s.schedule = fn => fn(); // play events at once (the real page spaces them out to match the animations)

// spy on what the game asks for
let played = [], celebrated = [];
const realPlay = FX.play, realCelebrate = FX.celebrate;
FX.play = (name, o) => { played.push(name); return realPlay(name, o); };
FX.celebrate = o => { celebrated.push(o.kind); return realCelebrate(o); };
const reset = () => { played = []; celebrated = []; };

// A short scripted game, set up straight on the board. Red (seat 0) is at the bottom.
function scripted() {
  const g = E.newGame({ variant: 'classic' });
  g.phase = 'play';
  g.pieces = new Array(100).fill(null);
  g.board = new Array(100).fill(-1);
  const put = (o, r, sq) => { g.pieces[sq] = { o, r, pos: sq, mv: 0, sc: 0, rv: 0 }; g.board[sq] = sq; };
  // red
  put(0, SCOUT, 90); put(0, MINER, 71); put(0, SPY, 74); put(0, LIEUTENANT, 75); put(0, BOMB, 25); put(0, MARSHAL, 99); put(0, FLAG, 98);
  // blue
  put(1, FLAG, 0); put(1, MAJOR, 9); put(1, BOMB, 61); put(1, CAPTAIN, 15); put(1, SERGEANT, 65); put(1, MARSHAL, 64);
  g.layouts = [[], []];
  return g;
}
const MOVES = [
  [0, 90, 30, 'Scout runs'], [1, 9, 19, 'Blue steps'], [0, 71, 61, 'Miner on Bomb'], [1, 15, 25, 'Captain on Bomb'],
  [0, 75, 65, 'Lieutenant beats Sergeant'], [1, 19, 9, 'Blue steps'], [0, 74, 64, 'Spy on Marshal'], [1, 9, 19, 'Blue steps'], [0, 30, 0, 'Scout takes the Flag'],
];
/** Play the script, showing the game to seat `me` after each move; returns the sounds per move. */
function playScript(me, mode) {
  const g = scripted();
  Sfx.forget();
  const ctx = { board: fakeEl, sqEl: () => fakeEl(), status: fakeEl };
  const snap = () => ({ pub: E.publicView(g), me, myTurn: g.phase === 'play' && g.turn === me, mode: mode || 'local' });
  Sfx.observe(snap(), ctx); // first look: silent
  const per = [];
  for (const [s, f, t] of MOVES) {
    reset();
    E.apply(g, s, { type: 'move', from: f, to: t });
    Sfx.observe(snap(), ctx);
    per.push({ sounds: played.slice(), cel: celebrated.slice() });
  }
  return { g, per };
}

// (a) every event gets its own sound, for the player who sees it
{
  reset();
  const { g, per } = playScript(0);
  assert.equal(g.phase, 'over');
  assert.equal(g.result.winner, 0);
  const s = per.map(p => p.sounds.join(' '));
  assert.equal(s[0], 'whoosh', 'Scout run = whoosh');
  assert.equal(s[1], 'slide', 'one-square step = slide');
  assert.equal(s[2], 'cardFlip defuse', 'Miner on a Bomb = pieces flip + defuse');
  assert.equal(s[3], 'cardFlip explosion', 'piece hits a Bomb = explosion');
  assert.equal(s[4], 'cardFlip clash capture', 'your piece wins a fight = clash + capture');
  assert.equal(s[6], 'cardFlip clash capture', 'your Spy takes the Marshal = clash + capture');
  assert.deepEqual(per[6].cel, ['big'], '... and the big sparkle');
  assert.equal(s[8], 'whoosh cardFlip clash capture', 'Scout runs into the Flag');
  assert.deepEqual(per[8].cel, ['win']);
  ok('Red\'s view: whoosh, slide, defuse, explosion, clash + capture, Spy-Marshal big moment, Flag = win');
}
{
  const { per } = playScript(1);
  const s = per.map(p => p.sounds.join(' '));
  assert.equal(s[4], 'cardFlip clash hit', 'losing your piece = clash + hit');
  assert.equal(s[6], 'cardFlip clash hit', 'their Spy takes your Marshal = no celebration for you');
  assert.deepEqual(per[6].cel, []);
  assert.deepEqual(per[8].cel, ['lose']);
  assert.ok(!per.some(p => p.sounds.includes('turn')), 'vs the computer: no chime every turn');
  ok('Blue\'s view of the same game: hits instead of captures, no big moment, lose at the end');
}
{
  const { per } = playScript(1, 'online');
  assert.equal(per[0].sounds.slice(-1)[0], 'turn', 'online: chime when it becomes your turn');
  assert.ok(!per[1].sounds.includes('turn'), 'no chime after your own move');
  ok('online: your-turn chime only when the turn comes to you');
}
// both armies placed (Barrage), then resign
{
  const g = E.newGame({ variant: 'barrage' });
  const lay = () => { const l = new Array(40).fill(-1); [FLAG, BOMB, SPY, SCOUT, SCOUT, MINER, 9, MARSHAL].forEach((r, i) => { l[30 + i] = r; }); return l; };
  Sfx.forget(); reset();
  const snap = me => ({ pub: E.publicView(g), me, myTurn: E.toAct(g).includes(me), mode: 'local' });
  Sfx.observe(snap(0), {});
  E.apply(g, 1, { type: 'setup', layout: lay() }); Sfx.observe(snap(0), {});
  assert.deepEqual(played, ['place'], 'their army arrives = one piece set down');
  reset(); E.apply(g, 0, { type: 'setup', layout: lay() }); Sfx.observe(snap(0), {});
  assert.deepEqual(played, ['deploy', 'turn'], 'game starts = army set down, then your-turn chime');
  reset(); E.apply(g, 0, { type: 'resign' }); Sfx.observe(snap(0), {});
  assert.deepEqual(celebrated, ['lose']);
  ok('setup: their army arrives, both deploy + your turn; resign = lose');
}
// a fresh page on a game already in progress is silent
{
  Sfx.forget(); reset();
  const g = scripted();
  Sfx.observe({ pub: E.publicView(g), me: 0, myTurn: true, mode: 'local' }, {});
  assert.deepEqual(played, []);
  ok('opening a saved game makes no sound');
}

// (b) the Settings switches: Sound off = no audio at all; Animations off = nothing animates
{
  FX.set('sound', true); FX.set('animations', true);
  let n0 = FX.stats.plays; animCount = 0;
  playScript(0);
  const loud = FX.stats.plays - n0;
  assert.ok(loud >= 20, 'sound on: the script played ' + loud + ' sounds');
  assert.ok(animCount > 0, 'animations on: something animated');

  FX.set('sound', false);
  n0 = FX.stats.plays;
  playScript(0);
  assert.equal(FX.stats.plays - n0, 0, 'Sound off: no sound plays');

  FX.set('sound', true); FX.set('moves', false);
  n0 = FX.stats.plays;
  const r = playScript(1, 'online');
  const heard = FX.stats.plays - n0;
  assert.equal(heard, 5, 'Game sounds off: only the 4 your-turn chimes and the lose tune remain');
  void r;
  FX.set('moves', true);

  FX.set('animations', false); animCount = 0;
  playScript(0);
  assert.equal(animCount, 0, 'Animations off: nothing animates');
  FX.set('animations', true);

  FX.set('celebrations', false); n0 = FX.stats.plays; animCount = 0;
  const c = playScript(0);
  assert.deepEqual(c.per[8].cel, ['win'], 'the game still asks');
  FX.set('celebrations', true);
  ok('Sound off = 0 sounds, Game sounds off = alerts only, Animations off = 0 animations (storage blocked throughout)');
}

// (c) the page wires it in: fx.js loads first, the Settings tab shows the Sound & effects block
{
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const i = html.indexOf('js/fx.js'), j = html.indexOf('js/sfx.js'), k = html.indexOf('js/app.js');
  assert.ok(i > 0 && j > i && k > j, 'fx.js, then sfx.js, then app.js');
  assert.match(app, /FX\.renderSettings\(/);
  assert.match(app, /StrSfx\.observe\(/);
  ok('index.html loads fx.js and sfx.js before app.js; app.js draws the settings and observes the game');
}

console.log(pass + ' sfx tests passed');
setTimeout(() => process.exit(0), 50);
