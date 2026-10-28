/* The rules sheet and the guided first game (shared kit js/coach.js: never edit that one here).
   Rules are written in our own words from the rulebook and ISF tournament rules (the same rules js/engine.js plays). */
(function (root) {
  'use strict';
  // the guided game: you (Red) against the Easy computer, rulebook rules, a fixed enemy army
  const SEED = 20261027;

  function rules() {
    return {
      title: 'Stratego rules',
      intro: 'The rulebook game (Jumbo 2022, ISF tournament rules). The switches in Settings change these for new games.',
      foot: 'Fan-made; not affiliated with the game\'s publisher.',
      sections: [
        { id: 'goal', title: 'Goal', short: 'Goal', html: '<p>Capture the enemy <b>Flag</b>. You also win if the other side has no piece left that can move, or resigns.</p><p class="tip">Your opponent sees only the backs of your pieces. A rank shows only when it fights (or when a Scout runs).</p>' },
        { id: 'pieces', title: 'The pieces', short: 'Pieces', html: '<table><tr><th>Rank</th><th>Piece</th><th>Each side</th></tr>' +
          '<tr><td>10</td><td>Marshal</td><td>1</td></tr><tr><td>9</td><td>General</td><td>1</td></tr><tr><td>8</td><td>Colonel</td><td>2</td></tr>' +
          '<tr><td>7</td><td>Major</td><td>3</td></tr><tr><td>6</td><td>Captain</td><td>4</td></tr><tr><td>5</td><td>Lieutenant</td><td>4</td></tr>' +
          '<tr><td>4</td><td>Sergeant</td><td>4</td></tr><tr><td>3</td><td>Miner</td><td>5</td></tr><tr><td>2</td><td>Scout</td><td>8</td></tr>' +
          '<tr><td>1</td><td>Spy</td><td>1</td></tr><tr><td>B</td><td>Bomb</td><td>6</td></tr><tr><td>F</td><td>Flag</td><td>1</td></tr></table>' +
          '<p>Old US sets number them the other way round (Marshal 1); Settings can switch the numbers.</p>' },
        { id: 'setup', title: 'Setting up', short: 'Setup', html: '<ul><li>Each side places all 40 pieces in its own four back rows, hidden from the other side.</li><li>Arrange yours in the <b>Setup</b> tab: tap two squares to swap them. It checks your army and shows where real players put each piece.</li><li>Red moves first.</li></ul>' },
        { id: 'turn', title: 'Your turn', short: 'Turn', html: '<ul><li>Move one piece one square forward, back or sideways (never diagonally), or attack.</li><li><b>Bombs and the Flag never move.</b></li><li><b>Scouts</b> run any number of empty squares in a straight line, and may attack at the end of the run.</li><li>Nobody can enter the two lakes in the middle.</li><li>A piece may not go back and forth between the same two squares more than 3 times in a row, and may not chase forever (tournament rule).</li></ul>' },
        { id: 'fight', title: 'Fights', short: 'Fight', html: '<ul><li>Move onto an enemy piece to attack it. Both pieces show their rank.</li><li>The higher rank wins and the loser leaves the board. The attacker takes the square if it wins.</li><li><b>Equal ranks: both leave the board.</b></li></ul>' },
        { id: 'special', title: 'Special pieces', short: 'Special', html: '<ul><li><b>Spy</b>: beats the Marshal, but only when the Spy attacks. Anything that attacks the Spy beats it.</li><li><b>Miner</b>: the only piece that can take a Bomb.</li><li><b>Bomb</b>: any other piece that attacks it is removed; the Bomb stays.</li><li><b>Flag</b>: taking it wins the game.</li></ul><p class="tip">The % on hidden enemy pieces is the chance of their most likely rank. Tap one to see all its chances.</p>' },
        { id: 'options', title: 'Other ways to play', short: 'Options', html: '<ul><li><b>Barrage</b>: 8 pieces each (Flag, Bomb, Spy, 2 Scouts, Miner, General, Marshal) anywhere in your four rows. A quick game.</li><li><b>Scout must stop first</b>: older editions don\'t let a Scout run and attack in one turn.</li><li><b>Aggressor Advantage</b>: equal ranks, the attacker wins.</li><li><b>Silent Defense</b>: the defender never shows its rank.</li><li><b>Back-and-forth limit 5</b>: older tournament play.</li><li><b>Rescue</b> (classic rulebook option): when one of your pieces (not a Scout) moves onto the enemy\'s back row, you may bring back one of your captured pieces (not a Bomb) onto any empty square of your half. That ends your turn. 2 rescues each; the same piece can\'t make both.</li><li><b>One-time Bombs</b> (house rule): a Bomb that blows up is removed along with the piece that hit it.</li></ul>' },
        { id: 'videos', title: 'Learn from videos', short: 'Videos', html: '<p>Opens YouTube in a new tab.</p><ul class="vids"><li><a href="https://www.youtube.com/watch?v=2--eobusRwQ" target="_blank" rel="noopener">How to play (official, 1.5 min)</a> <span class="vby">Jumboplay</span></li><li><a href="https://www.youtube.com/watch?v=3R7d0A9ymwQ" target="_blank" rel="noopener">How to play Stratego (4 min)</a> <span class="vby">Triple S Games</span></li><li><a href="https://www.youtube.com/watch?v=dfpghzY4R3g" target="_blank" rel="noopener">Strategy guide (10 min)</a> <span class="vby">Legendary Tactics</span></li><li><a href="https://www.youtube.com/watch?v=RvU77UFi8Go" target="_blank" rel="noopener">Making setups (17 min)</a> <span class="vby">Fairway Stratego Videos</span></li><li><a href="https://www.youtube.com/watch?v=_Soh3ifZJbI" target="_blank" rel="noopener">Five beginner Barrage strategies (5 min)</a> <span class="vby">RTFM</span></li></ul>' },
      ],
    };
  }

  // the steps: each points at a real part of the screen and moves on when the game does
  // ctx: { snap: () => the guided game's snapshot or null, ui: () => selection state }
  function steps(ctx) {
    const S = () => ctx.snap();
    const U = () => ctx.ui();
    const vis = sel => { const el = document.querySelector(sel); return el && el.offsetParent ? el : null; };
    const pick = (a, b) => () => vis(a) || vis(b) || a;
    const playing = () => { const s = S(); return !!s && s.pub.phase === 'play'; };
    const myMoves = () => { const s = S(); return s ? s.pub.hist.filter(h => h.s === s.mySeat).length + (s.pub.histFrom ? 99 : 0) : 0; };
    return [
      { title: 'Your first battle', text: 'Your army is red, along the bottom. The computer sees only the backs of your pieces, as you see only theirs. Capture their Flag to win.', target: '.bframe' },
      { title: 'Ready', text: 'Your army comes from the Setup tab (swap pieces there any time before a game). Tap Ready to start.', target: pick('#acts-phone [data-a="ready"]', '#acts-side [data-a="ready"]'), skipIf: playing, until: playing },
      { title: 'Pick up a piece', text: 'Tap one of your pieces in the front row.', target: '.bframe', when: () => playing() && S().myTurn, until: () => U().sel >= 0 || myMoves() > 0 },
      { title: 'Move', text: 'The dots show where it can go. Tap one. (Bombs and the Flag never move; Scouts run in a straight line.)', target: '.bframe', until: () => myMoves() > 0 },
      { title: 'Their pieces', text: 'Each hidden enemy piece shows its most likely rank and how likely that is, from what it has done so far. Tap an enemy piece.', target: '.bframe', when: () => playing() && S().myTurn, until: () => U().focus >= 0 },
      { title: 'The odds', text: 'Its chance to be each rank. With one of your pieces picked up, you also see your chance to win that fight.', target: pick('#info-phone', '#info-side') },
      { title: 'Fights', text: 'Move onto an enemy piece to attack: the higher rank wins, equal ranks both go. Your Spy beats their Marshal only when the Spy attacks. Only Miners can take Bombs.', target: '.bframe' },
      { title: 'Help', text: 'Hint shows the move the Hard computer would make. Undo takes back your last move. Games with either count as "with help" in My stats.', target: pick('#acts-phone [data-a="undo"]', '#acts-side [data-a="undo"]') },
      { title: 'Removed pieces', text: 'Taken pieces lie in the margins of the board, theirs at the far end. Tap a margin to see them big.', target: '#grave-far' },
      { title: 'Good luck', text: 'Play on and find their Flag. The rules are in Settings whenever you need them.', target: pick('nav.tabs [data-tab="settings"]', 'nav.tabs [data-tab="settings"]') },
    ];
  }

  root.StrTutorial = { rules, steps, SEED };
})(typeof window !== 'undefined' ? window : globalThis);
