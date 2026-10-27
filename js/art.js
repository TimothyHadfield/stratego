/* Original SVG art for the pieces (no publisher art): a standing coloured block with the rank number in the corner
   and a simple badge — bars for Sergeant to Captain, stars for Major to Marshal, plain pictures for
   Flag, Bomb, Spy, Scout and Miner. */
(function (root) {
  'use strict';
  const E = root.StrEngine;
  // face, its darker sides, the lit top edge, and the print: gold on red, silver on blue (like the real set)
  const SIDE = [
    { face: '#c23b31', dark: '#7f221c', top: '#de6a5e', light: '#f0a093', ink: '#fff6f2', print: '#f6d77e' },
    { face: '#2f62c4', dark: '#1d3f86', top: '#5f8ee6', light: '#9dbcf5', ink: '#f2f6ff', print: '#e9eef6' },
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
   * One piece as an SVG string: a standing block seen from the player's chair. You look down on its
   * top edge and the face turned toward you; it throws a soft shadow on the board. Your own pieces
   * show their rank face; enemy pieces show their plain back with the side's emblem (the real set
   * prints red in gold and blue in silver).
   * @param side 0 red / 1 blue
   * @param r rank, or null for a hidden piece
   * @param numbering 'modern' | 'classic'
   */
  function piece(side, r, numbering) {
    const c = SIDE[side];
    let inner;
    if (r === null || r === undefined || r < 0) {
      // the back of a piece: the side's embossed shield, printed in gold (red) or silver (blue)
      inner = '<path d="M20 15 L27 17.6 V23.4 C27 27.6 24 30.4 20 31.8 C16 30.4 13 27.6 13 23.4 V17.6 Z" fill="' + c.dark + '" opacity=".45"/>' +
        '<path d="M20 15 L27 17.6 V23.4 C27 27.6 24 30.4 20 31.8 C16 30.4 13 27.6 13 23.4 V17.6 Z" fill="none" stroke="' + c.print + '" stroke-width="1.5" stroke-linejoin="round" opacity=".9"/>' +
        '<path d="M20 18.6 V28.4 M16.2 21.6 H23.8" stroke="' + c.print + '" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>';
    } else {
      const lab = E.label(r, numbering);
      const small = r === E.FLAG || r === E.BOMB;
      // the rank is printed big across the top of the face (readable on a phone), its badge small below;
      // Flag and Bomb have no number, so their picture fills the face
      inner = small ? '<g transform="translate(20 25.5) scale(.72) translate(-20 -23)">' + glyph(r, c.print) + '</g>'
        : '<text x="20" y="24.3" text-anchor="middle" font-size="17" font-weight="850" letter-spacing="-.4" fill="' + c.print + '" font-family="system-ui,-apple-system,Segoe UI,sans-serif">' + lab + '</text>' +
          '<g transform="translate(20 30.6) scale(.42) translate(-20 -23)">' + glyph(r, c.print) + '</g>';
    }
    // no gradients or ids (hundreds of copies on a page stay safe): shadow on the board, the block's
    // dark sides, its top edge (lit from above), the face toward you, a shine line and a crease
    return '<svg viewBox="0 0 40 40" aria-hidden="true">' +
      '<rect x="8" y="5.5" width="29.5" height="34" rx="4.5" fill="#000" opacity=".26"/>' +
      '<rect x="9.5" y="7.5" width="28.5" height="32" rx="4.5" fill="#000" opacity=".14"/>' +
      '<rect x="5.5" y="1.5" width="29" height="36" rx="4.5" fill="' + c.dark + '"/>' +
      '<rect x="6.5" y="2.3" width="27" height="9" rx="3.2" fill="' + c.top + '"/>' +
      '<rect x="6.5" y="10.4" width="27" height="25.4" rx="3" fill="' + c.face + '"/>' +
      '<rect x="6.5" y="10.4" width="27" height="1.4" fill="#000" opacity=".18"/>' +
      '<rect x="6.5" y="11.8" width="2.2" height="23" rx="1.1" fill="#fff" opacity=".12"/>' +
      '<rect x="9" y="3.1" width="22" height="1.2" rx=".6" fill="#fff" opacity=".35"/>' + inner + '</svg>';
  }

  /** A removed piece lying face up beside the board (seen from above): a flat slab with its rank. */
  function flat(side, r, numbering) {
    const c = SIDE[side];
    const known = !(r === null || r === undefined || r < 0);
    const lab = known ? E.label(r, numbering) : '';
    const small = known && (r === E.FLAG || r === E.BOMB);
    return '<svg viewBox="0 0 30 40" aria-hidden="true"><rect x="2.5" y="3" width="27" height="37" rx="4" fill="#000" opacity=".32"/>' +
      '<rect x="1" y="1" width="27" height="37" rx="4" fill="' + c.dark + '"/><rect x="2" y="2" width="25" height="34" rx="3.2" fill="' + c.face + '"/>' +
      (known ? (small ? '<g transform="translate(14.5 21) scale(.66) translate(-20 -23)">' + glyph(r, c.print) + '</g>'
        : '<text x="14.5" y="19.5" text-anchor="middle" font-size="16" font-weight="850" letter-spacing="-.6" fill="' + c.print + '" font-family="system-ui,-apple-system,Segoe UI,sans-serif">' + lab + '</text>' +
          '<g transform="translate(14.5 28.5) scale(.42) translate(-20 -23)">' + glyph(r, c.print) + '</g>')
        : '<path d="M14.5 11 L21 13.5 V19 C21 23 18.4 25.6 14.5 27 C10.6 25.6 8 23 8 19 V13.5 Z" fill="none" stroke="' + c.print + '" stroke-width="1.5" opacity=".85"/>') + '</svg>';
  }

  /** The printed board: a meadow battlefield, thin printed grid lines, two lakes with sandy banks,
      small grass tufts (seeded, so the print never changes) and the fold across the middle. */
  function boardSvg() {
    let s = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="100" fill="#4c7a3a"/>';
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 100; i++) {
      const x = (i % 10) * 10, y = Math.floor(i / 10) * 10;
      const t = rnd();
      // each printed square a slightly different meadow tone, a little lighter toward the middle rows
      const g = Math.round(112 + t * 14 + (4.5 - Math.abs(4.5 - Math.floor(i / 10))) * 1.6);
      s += '<rect x="' + x + '" y="' + y + '" width="10" height="10" fill="rgb(' + Math.round(g * 0.58) + ',' + g + ',' + Math.round(g * 0.42) + ')"/>';
      if (E.IS_LAKE[i]) continue;
      for (let k = 0; k < 2; k++) {
        const tx = x + 1.6 + rnd() * 6.4, ty = y + 2.2 + rnd() * 6.2;
        s += '<path d="M' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ' l-.7 -1.3 M' + (tx + 0.5).toFixed(1) + ' ' + ty.toFixed(1) + ' l.1 -1.6 M' + (tx + 1).toFixed(1) + ' ' + ty.toFixed(1) + ' l.8 -1.2" stroke="#2f5a26" stroke-width=".28" stroke-linecap="round" opacity=".3"/>';
      }
    }
    // printed grid lines, then the lakes on top so no line cuts through the water
    for (let k = 1; k < 10; k++) s += '<path d="M' + k * 10 + ' 0 V100 M0 ' + k * 10 + ' H100" stroke="#24401d" stroke-width=".32" opacity=".8"/>';
    // the two lakes: rounded, slightly irregular ponds with a sandy bank, deeper water in the middle
    const pond = (cx, cy, R, wob, k0) => {
      const pts = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const sq = R / Math.pow(Math.pow(Math.abs(ca), 3.2) + Math.pow(Math.abs(sa), 3.2), 1 / 3.2);
        const rr = sq * (1 + wob * Math.sin(k * 2.3 + k0) * 0.5 + wob * Math.cos(k * 1.7 + k0 * 2) * 0.5);
        pts.push([cx + rr * ca, cy + rr * sa]);
      }
      let d = '';
      for (let k = 0; k < 16; k++) {
        const p = pts[k], q = pts[(k + 1) % 16];
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        d += (k ? '' : 'M' + ((pts[15][0] + p[0]) / 2).toFixed(2) + ' ' + ((pts[15][1] + p[1]) / 2).toFixed(2)) + 'Q' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ' ' + m[0].toFixed(2) + ' ' + m[1].toFixed(2);
      }
      return d + 'Z';
    };
    [[30, 50, 1], [70, 50, 4]].forEach(([cx, cy, k0]) => {
      s += '<path d="' + pond(cx, cy, 9.9, 0.05, k0) + '" fill="#9c8f5c"/>';
      s += '<path d="' + pond(cx, cy, 9.1, 0.045, k0) + '" fill="#c2ad72"/>';
      s += '<path d="' + pond(cx, cy, 8.1, 0.05, k0 + 1) + '" fill="#2f7396"/>';
      s += '<path d="' + pond(cx + 0.3, cy + 0.4, 5.6, 0.07, k0 + 2) + '" fill="#245d7c"/>';
      s += '<path d="M' + (cx - 5.5) + ' ' + (cy - 4) + ' q2 -1 4 0 M' + (cx + 1) + ' ' + (cy + 2.5) + ' q2 -1 4 0 M' + (cx - 3) + ' ' + (cy + 5) + ' q1.6 -.8 3.2 0" fill="none" stroke="#9fd0ea" stroke-width=".4" stroke-linecap="round" opacity=".55"/>';
    });
    // the fold across the middle of the folding board
    s += '<path d="M0 50 H100" stroke="#000" stroke-width=".4" opacity=".4"/><path d="M0 50.4 H100" stroke="#fff" stroke-width=".25" opacity=".12"/>';
    return s + '</svg>';
  }

  function icon() {
    return piece(0, E.MARSHAL, 'modern');
  }

  root.StrArt = { piece, flat, boardSvg, glyph, SIDE, icon };
})(typeof self !== 'undefined' ? self : this);
