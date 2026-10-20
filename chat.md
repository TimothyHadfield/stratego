# Stratego Lab — session log

## 2026-10-20 — first build (builder agent under the games manager)
- **Asked:** Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." Brief: exact rules, odds layer, setup analyzer, measured computers, study mode, online seats via `_online`.
- **Decided:** Jumbo 2022 / ISF rules by default; classic-rules Scout and limit 5 as settings; revealed ranks stay visible.
- **Built:** engine, odds, bots, data from 42,488 Gravon games, four tabs, online seats, original SVG art, icons.
- **Verified:** engine 12 + odds 4 + online 5 tests pass; mutation runs (Spy/Marshal, Miner/Bomb, ties, lakes, army counts, two-squares, chase, public-view leak, moved-piece odds) each make a test fail; phone-view 393 px and laptop screenshots of every tab; full games to the end (classic 309 plies, Barrage); two-browser online test in WebKit.
- **Open:** see progress.md NOT verified.

## 2026-10-20 — sound & effects (builder under the games manager)
- **Asked:** Tim: "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."
- **Built:** `js/fx.js` (copy of `_fx` 1.0.3), `js/sfx.js` (snapshot diff → sounds/animations/celebrations, plus custom `clash`, `defuse`, `deploy` sounds), hooks in `app.js` (observe in renderGame, error/click on board taps, setup swaps, Sound & effects panel in Settings), CSS in index.html matching the Settings look and making the board's own motion obey Animations/Fast; `?v=4`. Event → sound map in progress.md.
- **Verified:** `tests/sfx.test.js` 7 pass (failed first on the old tree: no fx.js; and on the wiring check before app.js was hooked); engine 12, odds 5, online 5 pass. WebKit spy run: winning Flag capture logs click, cardFlip, clash, capture, celebrate win; Bomb tap logs error; setup swap logs click, place, 2 pops; 0 page errors. phone-view 393 px + 1440 px of Settings, mid-game, win with confetti: no console errors, no overflow, no page scroll.
- **Open:** see progress.md NOT verified (nothing actually heard).

## 2026-10-20 — visual design pass (builder under the games manager)
- **Asked:** Tim: "once you're finished with all the games, review them again for design improvements especially visually." Polish only, no rules or behaviour changes, `js/online.js` untouched.
- **Built:** piece bevel/shine and embossed shield backs (`js/art.js`), lakes drawn over the grid; board frame glows in your colour on your turn, pulsing dot while the other side thinks, bigger status line; odds badges two-tone and sized to the board; ring on the tapped enemy piece; odds bars scaled to the top value with % above; fight popup: loser knocked over, winner swells; laptop: duplicate "Their army left" removed (fixed-height info slot), bigger side text, new-game form centred; heat map now tints the board under grey see-through pieces; 40 px tap targets (heat chips, small buttons, Study tabs, icon buttons, ? hit area); Study chart y-axis fits the data and the phone board grew; log fade; sticky table header fixed; `?v=3`.
- **Verified:** engine 12, odds 5, online 5 pass; phone-view WebKit 393 px and 1440 px before/after of 12 states (new game, online, setup phase, setup tab, heat map, mid-game, piece selected, enemy tapped, game over, study, study facts, settings) plus the fight popup: 0 console errors, no horizontal overflow, no page scroll. Screenshots in the manager's scratchpad `design/stratego/{before,after}`.
- **Open:** two-browser online test not rerun (no online code changed).

## 2026-10-20 — QA fixes
- **Asked:** coordinator passed on the QA agent's list (record dedupe, partial move check, Barrage Flag exposed, damaged saves, Study overflow at 393 px, draw at start, plus 4 small ones).
- **Built:** `gid` per game; move check pauses and resumes, done only when complete; computer Barrage setups always block the Flag's column, and Setup warns "Flag open to a Scout"; save checks plus a render guard; Study side panel scrolls; `placeAll` draws when both are stuck; Test-it shows "6/24"; 500 ms tap guard; Barrage heat map and Classic win % hidden in Barrage; Study slider builds the move list once. Re-copied `_online` cf38e03.
- **Verified:** engine 12, odds 5, online 5 pass; the new engine and Barrage tests each failed first on the old code (257/900 open Flags); QA harness on port 8817: 2 resigns give 0-2, 14 damaged saves render with no errors, leaving Study at 35% resumes to 155/155 notes, double tap no longer opens Resign (old build: it does), slider median 140-175 ms to 16-17 ms (WebKit, 309-move game); Barrage re-measured 500 games per pairing; two-browser online test passes.
