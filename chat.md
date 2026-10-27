# Stratego Lab — session log

## 2026-10-27 — improvement pass (builder under the games manager)
- **Asked:** manager's per-game improvement brief: Hard must beat Medium ≥70% (was 53–60%), stronger computer, Undo, saved setups, guided game + rules, My stats/achievements/Daily, installable app, richer key moments, no empty bands. `js/online.js` untouched.
- **Built:** `js/bots.js` (tuning object `T`, Flag race + guard, Hard-only setups, Barrage decoys and own weights), `js/app.js` (Undo, saved armies, Daily, tutorial, rules, stats recording, leave = loss, big fight popup), new `js/profile-str.js`, `js/tutorial.js`, kits copied (_profile 1.1.0, _coach, _pwa 1.2.0), `manifest.webmanifest`, `icons/`, `tests/profile-str.test.js`, `tests/pwa-check.json`.
- **Verified:** `node tools/measure.js 1000 classic` Hard–Medium 73.1% ±2.7, `500 barrage` 73.7% ±3.9 (ladder Hard>Medium>Easy>random holds); engine 12, odds 5, sfx 7, profile-str 4 (setup test fails with the new setups switched off), online 5, edge 12, visibility 10; pwa-check 18/18 WebKit; WebKit scripts: computer waits while the leave box is open (ply 1→1, then 2 after Cancel), leaving records exactly one loss, Undo returns ply to 0 and marks the game helped; screenshots 393, 320×568 and 1440 of new-game, saved armies, big fight. One read-only review: 4 findings, all fixed.
- **Open:** campaign not built (Tim's call); see progress.md NOT verified.

## 2026-10-21 → 10-27 — visibility pass (builder under the games manager; paused, resumed)
- **Asked:** Tim: "for a lot of the games the cards or board layout is too small to easily see what's going on ... Fix this so the view of what's happening and where everything is is very clear."
- **Built:** `js/art.js` (rank printed big on piece faces), `js/app.js` (odds/hint into the phone button row, tap-a-margin removed-pieces popup, Study min tweak), `index.html` (fixed status height, laptop grid, two-row army, badge size, Setup sideways/320 fixes); `?v=7`. See progress.md "Visibility pass".
- **Verified:** visibility 10/10 (9 fail on main), engine 12, odds 5, sfx 7, edge 12, online 5. Audit shots at 393, 320, 659×393 (WebKit), 1280, 1440 (Chrome) in the manager scratchpad `vis/stratego/{before,after}`; one read-only reviewer pass, its real findings fixed (its "laptop board overlaps the panels" was a stale mid-resize shot: measured 18 px gap).
- **Open:** 320 px odds badges touch each other on full rows; margins still small until tapped.

## 2026-10-20 — edge pass (builder under the games manager)
- **Asked:** Tim: "Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." Brief: 40+ weird scenarios, test each for real, fix failures with a failing test first; make the phone board as big as it can be; confirm taps on the tilted laptop board.
- **Built:** `js/app.js` + `index.html` fixes (see progress.md "Edge pass"); `tests/edge.test.mjs` (12 WebKit checks, own server); `?v=6`. Shared `js/online.js` / `js/fx.js` untouched.
- **Verified:** 61 scenarios (harness in the manager scratchpad `edge/stratego/`): 41 pass, 16 fixed, 1 N/A, 3 NOT verified. Edge test 12/12 on the fix, 10 checks fail on the old build (2 crashed node there). engine 12, odds 5, sfx 7, online 5, two-browsers (local) pass. Layout sweep 70/70 in WebKit and Chrome at 320, 393, 659×393, 1280, 1920. Online double-tap/host-close on real Firebase.
- **Open:** see progress.md NOT verified.

## 2026-10-20 — real-table look (builder under the games manager)
- **Asked:** Tim: "make sure that each of the games also have a look to them so that the game ... looks almost identical to how the board or card layout looks like in real life ... like you're looking through a camera that is connected to a user's glasses". No rules changes; `js/online.js` untouched.
- **Built:** shared `_table` kit copied in (`css/table.css`, `js/table.js`), fx.js re-copied, `.gitattributes`; wood table under Play; `.bframe` folding board with printed end margins holding each side's removed pieces (`graveHtml`, `Art.flat`); standing-slab pieces (gold/silver print), meadow board with ponds and centre fold (`js/art.js`); 3-D turn of the enemy piece in the fight popup; laptop tilt; phone-landscape layouts for Play and Setup; `?v=5`.
- **Verified:** engine 12, odds 5, sfx 7, online 5 pass; two-browser online test passes (WebKit); WebKit 393 px + 1440 px before/after of setup, mid, selected, late, over, setup tab, study (0 console errors, no overflow); widths 320×568, 393×659, 659×393, 1280×800 no overflow (659×393 overflowed before); fight turn measured (rotateY 180→0); Effects speed Fast changes only fx speed; two read-only review rounds. Live c7bd335 checked at 393 px. Screenshots: manager scratchpad `table/stratego/{before,after}`.
- **Open:** see progress.md NOT verified.

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
