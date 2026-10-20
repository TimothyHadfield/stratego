# Stratego Lab — progress

## START HERE
Read this file, then `CLAUDE.md`, then `docs/rules-check.md`. Last updated: 2026-10-20 (first build).

## Goal right now
Tim's words (2026-10-20): "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." This is the Stratego one: exact rules, odds for hidden pieces, setup analyzer, measured computers, study mode, online seats.

## Status
| Part | State |
|---|---|
| Engine (Jumbo 2022 / ISF rules, Barrage, Aggressor, Silent Defense, Scout-strike switch, two-squares 3/5, chase rule) | Done, 12 tests, 260 real games replay legal |
| Odds (`js/odds.js`) | Done, 4 tests vs brute force |
| Computers Easy / Medium / Hard | Done, measured (see `js/strength-data.js`) |
| Play tab (vs computer, online room) | Done |
| Setup tab (swap, real setup, heat map, checks, Flag guess, Test it) | Done |
| Study tab (replay, material chart, Check my moves, real-game facts) | Done |
| Settings | Done |
| Online (shared `_online`) | Done; two-browser test passes locally (WebKit) |

## Measured strength (2026-10-20)
Classic, 1,000 games each: Hard beats Medium 60.2% (±3.0), Hard beats Easy 96.4%, Medium beats Easy 89.3%, Easy beats random 85.4%.
Barrage, 500 each: Hard–Medium 55.2%, Hard–Easy 89.0%, Medium–Easy 84.4%, Easy–random 67.9%.

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, ... to the list of games." (2026-10-20)
- Global rules apply: $0, no permission prompts, background-only testing, design-taste (no page scroll on main screens, phone bottom tabs, short labels, "?" explains why, choices in Settings).

## Traps
- Gravon writes row 10 as `:`; `tools/gravon.js` handles it. Player 1 = Red; square = 99 − Gravon index.
- Gravon enforced a two-squares limit of 5 and no chase rule; replays use those settings.
- Headless WebKit on Windows is slow at layout (300–1000 ms per tap when the CPU is busy); Chrome is 20–90 ms. Not a phone measurement.
- The board size is computed in JS (`sizeBoard`) from what the other parts leave free; parts marked `data-min` count as that height.
- Port 8765 is often taken by other agents' servers; use another port for local serving.
- Two-browser test creates a real room in `th-board-games` and closes it at the end.

## Decisions
- Default rules = Jumbo 2022 / ISF: Red first, Scout may move and strike, two-squares limit 3, chase rule on.
- Revealed ranks stay visible in the app (tournament players must remember) — app choice.
- Odds model default "Real players" (archive heat map + small floor); Barrage always flat.
- Hard = 6 sampled worlds × 2-ply look-ahead blended with 1-ply.
- Study keeps only the last finished game.

## NOT verified
- Real iPhone feel (speed of taps, safe areas) — only WebKit headless at 393 px.
- Duel / Quick Battle, Ultimate Lightning, Rescue — skipped.
- ISF 11.2 exception has no real-game test data.
- Hard's 6-world look-ahead speed on an old phone.

## Rejected / parked
- ~~Opening book, bluff detector, learning computer, win-probability bar~~ — see `docs/ideas.md` (no honest data behind them).
