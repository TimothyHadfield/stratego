/* Measured computer strength: `node tools/measure.js 1000 classic` and `node tools/measure.js 500 barrage`
   (2026-10-27 after Hard's Flag-defence update, colours swapped every game, each level using its own setups;
   easy-random kept from 2026-10-20, neither level changed; hard-medium re-measured after the Flag-variety
   setups, 1000 games each; hard-easy not re-run). firstScore = wins + half draws, %. */
(function (root) {
  root.StrStrength = {
    measured: '2026-10-27',
    classic: { results: {
      'hard-medium': { games: 1000, firstScore: 73.6, ci95: 2.7 },
      'hard-easy': { games: 1000, firstScore: 98.1, ci95: 0.8 },
      'medium-easy': { games: 1000, firstScore: 89.3, ci95: 1.9 },
      'easy-random': { games: 1000, firstScore: 85.4, ci95: 2.2 },
    } },
    barrage: { results: {
      'hard-medium': { games: 1000, firstScore: 73.6, ci95: 2.7 },
      'hard-easy': { games: 500, firstScore: 95.5, ci95: 1.8 },
      'medium-easy': { games: 500, firstScore: 85.7, ci95: 3.1 },
      'easy-random': { games: 500, firstScore: 68.2, ci95: 4.1 },
    } },
  };
})(typeof self !== 'undefined' ? self : this);
