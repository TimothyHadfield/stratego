/* Original SVG art for the pieces (no publisher art): a coloured block with the rank number in the corner
   and a simple badge — bars for Sergeant to Captain, stars for Major to Marshal, plain pictures for
   Flag, Bomb, Spy, Scout and Miner. */
(function (root) {
  'use strict';
  const E = root.StrEngine;
  const SIDE = [
    { face: '#c9473d', dark: '#8e2a23', light: '#f0a093', ink: '#fff6f2' },
    { face: '#3b6fd4', dark: '#23458f', light: '#9dbcf5', ink: '#f2f6ff' },
  ];

  function star(cx, cy, r, fill) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2);
    }
    return '<path d="' + d + 'Z" fill="' + fill + '"/>';
  }
  function bars(n, ink) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const y = 21 + i * 5 - (n - 1) * 2.5;
      s += '<path d="M12 ' + (y + 3) + ' L20 ' + (y - 1) + ' L28 ' + (y + 3) + '" fill="none" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    return s;
  }
  /** The picture in the middle of a piece (40x40 box, centre ~20,23). */
  function glyph(r, ink) {
    switch (r) {
      case E.FLAG:
        return '<path d="M14 33 V11" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/><path d="M15 12 C20 9 23 15 29 12 V22 C23 25 20 19 15 22 Z" fill="' + ink + '"/>';
      case E.BOMB:
        return '<circle cx="19" cy="25" r="8" fill="' + ink + '"/><path d="M24 18 L27 14" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/><path d="M28 10 l1.4 2.4 M31 13 l-2.4 0.4 M27.5 13.5 l-1 2" stroke="#ffd36a" stroke-width="1.6" stroke-linecap="round"/>';
      case E.SPY:
        return '<path d="M9 23 C14 16 26 16 31 23 C26 30 14 30 9 23 Z" fill="none" stroke="' + ink + '" stroke-width="2.2"/><circle cx="20" cy="23" r="3.4" fill="' + ink + '"/>';
      case E.SCOUT:
        return '<path d="M10 23 H28 M23 17 L29 23 L23 29" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
      case E.MINER:
        return '<path d="M12 18 C17 13 24 13 29 18" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/><path d="M20.5 15 L17 31" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>';
      case E.SERGEANT: return bars(1, ink);
      case E.LIEUTENANT: return bars(2, ink);
      case E.CAPTAIN: return bars(3, ink);
      case E.MAJOR: return star(20, 24, 6.5, ink);
      case E.COLONEL: return star(14, 24, 5.2, ink) + star(26, 24, 5.2, ink);
      case E.GENERAL: return star(10.5, 25, 4.6, ink) + star(20, 22, 4.6, ink) + star(29.5, 25, 4.6, ink);
      case E.MARSHAL:
        return '<path d="M10 30 L11 18 L16 23 L20 15 L24 23 L29 18 L30 30 Z" fill="' + ink + '"/>';
      default: return '';
    }
  }

  /**
   * One piece as an SVG string.
   * @param side 0 red / 1 blue
   * @param r rank, or null for a hidden piece
   * @param numbering 'modern' | 'classic'
   */
  function piece(side, r, numbering) {
    const c = SIDE[side];
    let inner;
    if (r === null || r === undefined || r < 0) {
      // the back of a piece: a plain shield
      inner = '<path d="M20 11 L28 14 V21 C28 26 24.5 29.5 20 31 C15.5 29.5 12 26 12 21 V14 Z" fill="none" stroke="' + c.light + '" stroke-width="1.8" opacity=".75"/>';
    } else {
      const lab = E.label(r, numbering);
      const small = r === E.FLAG || r === E.BOMB;
      inner = glyph(r, c.ink) + (small ? '' : '<text x="4.5" y="11.5" font-size="10.5" font-weight="800" fill="' + c.ink + '" font-family="system-ui,-apple-system,Segoe UI,sans-serif">' + lab + '</text>');
    }
    return '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1.5" y="1.5" width="37" height="37" rx="6" fill="' + c.dark + '"/>' +
      '<rect x="2.5" y="2.5" width="35" height="33" rx="5" fill="' + c.face + '"/>' + inner + '</svg>';
  }

  /** The board: grass squares and two lakes (drawn once as the background of the board). */
  function boardSvg() {
    let s = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">';
    for (let i = 0; i < 100; i++) {
      const x = (i % 10) * 10, y = Math.floor(i / 10) * 10;
      if (E.IS_LAKE[i]) continue;
      s += '<rect x="' + x + '" y="' + y + '" width="10" height="10" fill="' + ((i + Math.floor(i / 10)) % 2 ? '#2f4a33' : '#33503a') + '"/>';
    }
    for (const [x, y] of [[20, 40], [60, 40]]) {
      s += '<rect x="' + (x + 0.6) + '" y="' + (y + 0.6) + '" width="18.8" height="18.8" rx="3" fill="#1f5a7e"/>';
      for (let k = 0; k < 3; k++) {
        const yy = y + 5 + k * 5;
        s += '<path d="M' + (x + 4) + ' ' + yy + ' q2.5 -1.6 5 0 t5 0" fill="none" stroke="#5fa3c9" stroke-width=".7" stroke-linecap="round" opacity=".8"/>';
      }
    }
    // faint grid lines
    for (let k = 1; k < 10; k++) s += '<path d="M' + k * 10 + ' 0 V100 M0 ' + k * 10 + ' H100" stroke="#1d2e21" stroke-width=".25"/>';
    return s + '</svg>';
  }

  function icon() {
    return piece(0, E.MARSHAL, 'modern');
  }

  root.StrArt = { piece, boardSvg, glyph, SIDE, icon };
})(typeof self !== 'undefined' ? self : this);
