# Stratego Lab — project rules

Static GitHub Pages site (repo `TimothyHadfield/stratego`, live https://timothyhadfield.github.io/stratego/). No build step. Online play uses the shared `_online` layer (Firebase project `th-board-games`, $0, no billing).

- Read `progress.md` first.
- `js/online.js` is a copy of `Board and Card Games/_online/online.js` and must stay **unchanged**. To update it, copy the newer file in and rerun the tests.
- Rules live only in `js/engine.js` (no screen code there). Every rule has a row in `docs/rules-check.md` and a test.
- Hidden ranks must never leave the engine: `publicView` shows a rank only once it was shown in a fight (or a Scout ran). `tests/online.test.mjs` checks this; keep it passing.
- Don't change bot move logic (`js/bots.js`) without re-measuring: `node tools/measure.js 1000 classic` and `node tools/measure.js 500 barrage`, then update `js/strength-data.js`.
- Tests: `node tests/engine.test.js`, `node tests/odds.test.js`, `node tests/online.test.mjs` (~2 min). Online two-browser check: `node tools/two-browsers.mjs [url]` (uses the real Firebase project; the host closes the room at the end).
- No publisher art or rulebook text. Art is original SVG in `js/art.js`.
- localStorage key `stratego:v1`; every read/write in try/catch.
- Bump `?v=N` on script tags in `index.html` when JS changes.
