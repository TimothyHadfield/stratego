# Stratego Lab — session log

## 2026-10-20 — first build (builder agent under the games manager)
- **Asked:** Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." Brief: exact rules, odds layer, setup analyzer, measured computers, study mode, online seats via `_online`.
- **Decided:** Jumbo 2022 / ISF rules by default; classic-rules Scout and limit 5 as settings; revealed ranks stay visible.
- **Built:** engine, odds, bots, data from 42,488 Gravon games, four tabs, online seats, original SVG art, icons.
- **Verified:** engine 12 + odds 4 + online 5 tests pass; mutation runs (Spy/Marshal, Miner/Bomb, ties, lakes, army counts, two-squares, chase, public-view leak, moved-piece odds) each make a test fail; phone-view 393 px and laptop screenshots of every tab; full games to the end (classic 309 plies, Barrage); two-browser online test in WebKit.
- **Open:** see progress.md NOT verified.

## 2026-10-20 — QA fixes
- **Asked:** coordinator passed on the QA agent's list (record dedupe, partial move check, Barrage Flag exposed, damaged saves, Study overflow at 393 px, draw at start, plus 4 small ones).
- **Built:** `gid` per game; move check pauses and resumes, done only when complete; computer Barrage setups always block the Flag's column, and Setup warns "Flag open to a Scout"; save checks plus a render guard; Study side panel scrolls; `placeAll` draws when both are stuck; Test-it shows "6/24"; 500 ms tap guard; Barrage heat map and Classic win % hidden in Barrage; Study slider builds the move list once. Re-copied `_online` cf38e03.
- **Verified:** engine 12, odds 5, online 5 pass; the new engine and Barrage tests each failed first on the old code (257/900 open Flags); QA harness on port 8817: 2 resigns give 0-2, 14 damaged saves render with no errors, leaving Study at 35% resumes to 155/155 notes, double tap no longer opens Resign (old build: it does), slider median 140-175 ms to 16-17 ms (WebKit, 309-move game); Barrage re-measured 500 games per pairing; two-browser online test passes.
