/* Measured computer strength: `node tools/measure.js 1000 classic` and `node tools/measure.js 500 barrage`
   (2026-10-20, colours swapped every game, each level using its own setups). firstScore = wins + half draws, %. */
(function (root) {
  root.StrStrength = {
    measured: '2026-10-20',
    classic: { results: {
      'hard-medium': { games: 1000, firstScore: 60.2, ci95: 3.0 },
      'hard-easy': { games: 1000, firstScore: 96.4, ci95: 1.2 },
      'medium-easy': { games: 1000, firstScore: 89.3, ci95: 1.9 },
      'easy-random': { games: 1000, firstScore: 85.4, ci95: 2.2 },
    } },
    barrage: { results: {
      'hard-medium': { games: 500, firstScore: 53.2, ci95: 4.4 },
      'hard-easy': { games: 500, firstScore: 88.0, ci95: 2.8 },
      'medium-easy': { games: 500, firstScore: 85.7, ci95: 3.1 },
      'easy-random': { games: 500, firstScore: 68.2, ci95: 4.1 },
    } },
  };
})(typeof self !== 'undefined' ? self : this);
