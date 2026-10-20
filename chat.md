# Stratego Lab — session log

## 2026-10-20 — first build (builder agent under the games manager)
- **Asked:** Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." Brief: exact rules, odds layer, setup analyzer, measured computers, study mode, online seats via `_online`.
- **Decided:** Jumbo 2022 / ISF rules by default; classic-rules Scout and limit 5 as settings; revealed ranks stay visible.
- **Built:** engine, odds, bots, data from 42,488 Gravon games, four tabs, online seats, original SVG art, icons.
- **Verified:** engine 12 + odds 4 + online 5 tests pass; mutation runs (Spy/Marshal, Miner/Bomb, ties, lakes, army counts, two-squares, chase, public-view leak, moved-piece odds) each make a test fail; phone-view 393 px and laptop screenshots of every tab; full games to the end (classic 309 plies, Barrage); two-browser online test in WebKit.
- **Open:** see progress.md NOT verified.
