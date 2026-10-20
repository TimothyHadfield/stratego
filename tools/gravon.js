/* Shared helpers for the Gravon (gravon.de StraDoS2) human game archive.
   A game record: {t:'classic'|'barrage', f: 100-char field, w: winner 1|2 (3 = none), rt: result type, m: "B4-B5 ..."}.
   Field letters: B..M = player 1 (Bomb, Spy, Scout, Miner, Sergeant, Lieutenant, Captain, Major, Colonel,
   General, Marshal, Flag), N..Y = player 2 in the same order, A = empty, _ = lake. Player 1 sets up on the
   first 40 squares and moves first, so player 1 = our Red (seat 0) and the board is turned 180 degrees. */
'use strict';
const E = require('../js/engine.js');
const ORDER = [E.BOMB, E.SPY, E.SCOUT, E.MINER, E.SERGEANT, E.LIEUTENANT, E.CAPTAIN, E.MAJOR, E.COLONEL, E.GENERAL, E.MARSHAL, E.FLAG];
const COLS = 'ABCDEFGHIK'; // Gravon skips J

const toSq = g => 99 - g;
function coord(s) {
  const col = COLS.indexOf(s[0]);
  const row = s.charCodeAt(1) - 49; // '1'..'9', and ':' for row 10
  return toSq(row * 10 + col);
}
/** -> [layoutRed, layoutBlue] in engine order (40 ranks for squares 60..99 and 0..39), or null if malformed. */
function layouts(field) {
  if (!field || field.length !== 100) return null;
  const red = new Array(40).fill(-1), blue = new Array(40).fill(-1);
  for (let g = 0; g < 100; g++) {
    const ch = field[g];
    if (ch === 'A' || ch === '_') continue;
    const code = ch.charCodeAt(0);
    let seat, r;
    if (code >= 66 && code <= 77) { seat = 0; r = ORDER[code - 66]; }
    else if (code >= 78 && code <= 89) { seat = 1; r = ORDER[code - 78]; }
    else return null;
    const sq = toSq(g);
    if (seat === 0) { if (sq < 60) return null; red[sq - 60] = r; }
    else { if (sq >= 40) return null; blue[sq] = r; }
  }
  return [red, blue];
}
function moves(m) {
  if (!m) return [];
  return m.split(' ').map(x => { const [a, b] = x.split('-'); return [coord(a), coord(b)]; });
}
module.exports = { layouts, moves, coord, ORDER };
