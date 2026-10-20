# Stratego Lab — progress

## START HERE
Read this file, then `CLAUDE.md`, then `docs/rules-check.md`. Last updated: 2026-10-20 (sound & effects).

## Goal right now
Tim's words (2026-10-20): "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." This is the Stratego one: exact rules, odds for hidden pieces, setup analyzer, measured computers, study mode, online seats.

## Status
| Part | State |
|---|---|
| Engine (Jumbo 2022 / ISF rules, Barrage, Aggressor, Silent Defense, Scout-strike switch, two-squares 3/5, chase rule) | Done, 12 tests, 260 real games replay legal |
| Odds (`js/odds.js`) | Done, 4 tests vs brute force, plus 1 test that computer Barrage setups never leave the Flag open to a Scout |
| QA pass (2026-10-20) | All 6 items + 4 small ones fixed: unique game id (`gid`), resumable "Check my moves", Barrage Flag lane, damaged saves, Study facts scroll, draw when both stuck at the start, Test-it progress, Ready/Resign double tap, Barrage heat map hidden, Study slider ~9x faster |
| Computers Easy / Medium / Hard | Done, measured (see `js/strength-data.js`) |
| Play tab (vs computer, online room) | Done |
| Setup tab (swap, real setup, heat map, checks, Flag guess, Test it) | Done |
| Study tab (replay, material chart, Check my moves, real-game facts) | Done |
| Settings | Done |
| Online (shared `_online`) | Done; two-browser test passes locally (WebKit) |
| Sound & effects (2026-10-20) | Done: shared `js/fx.js` 1.0.3 (copy, never edit) + game-local `js/sfx.js`; "Sound & effects" panel in Settings; `tests/sfx.test.js` 7 tests |
| Visual design pass (2026-10-20) | Done: bevelled pieces, board frame glows on your turn, readable odds badges (scale with the board), tapped enemy piece ringed, odds bars scaled to the top value with % labels, fight popup knocks the loser over, lakes without grid lines, laptop duplicate army panel removed, 40px tap targets, Study phone board 240→263 px |

## Measured strength (2026-10-20)
Classic, 1,000 games each: Hard beats Medium 60.2% (±3.0), Hard beats Easy 96.4%, Medium beats Easy 89.3%, Easy beats random 85.4%.
Barrage, 500 each (re-measured after the Flag-lane setup fix): Hard–Medium 53.2% (±4.4, not clearly above 50), Hard–Easy 88.0%, Medium–Easy 85.7%, Easy–random 68.2%.

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, ... to the list of games." (2026-10-20)
- "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." (2026-10-20)
- Global rules apply: $0, no permission prompts, background-only testing, design-taste (no page scroll on main screens, phone bottom tabs, short labels, "?" explains why, choices in Settings).

## Traps
- Gravon writes row 10 as `:`; `tools/gravon.js` handles it. Player 1 = Red; square = 99 − Gravon index.
- Gravon enforced a two-squares limit of 5 and no chase rule; replays use those settings.
- Headless WebKit on Windows is slow at layout (300–1000 ms per tap when the CPU is busy); Chrome is 20–90 ms. Not a phone measurement.
- The board size is computed in JS (`sizeBoard`) from what the other parts leave free; parts marked `data-min` count as that height.
- Port 8765 is often taken by other agents' servers; use another port for local serving.
- Two-browser test creates a real room in `th-board-games` and closes it at the end.
- Finished games are told apart by `gid` (made in `E.newGame`, shown in `publicView`); never key on layouts or move count again (back-to-back resigns collided).
- `render()` catches a failed draw and drops only the saved part that tab was showing (local game, last game, or one setup). Keep new tabs inside it.
- Game buttons ignore a tap on a *different* button within 500 ms (Ready turns into Resign under the finger). Test scripts must wait >500 ms between them.
- Bump every `?v=` (index.html, worker.js, the Worker URL and the online import) on each push. Now at v=4 (online import v=5).
- Odds badges size with `cqw` units: `.bwrap` is a size container. Keep its width/height set by `sizeBoard`.
- Laptop `#info-side` has a fixed height (132 px) so tapping a piece never moves the army/moves panels; its idle state is the dashed "Tap a piece" slot.

- Sounds come from `StrSfx.observe()` in `renderGame`, which diffs the public snapshot (same path for local and online, so the other player's moves sound too). A first look at a game (page load, resume, new gid) is silent on purpose. `js/fx.js` is a byte copy of `_fx/fx.js`; re-copy, never edit.
- The app's document-level `.q` handler skips `.fx-set` (fx.js opens its own "?"). The Settings switch/seg/Test look is matched by `.fx-set …` rules in index.html (fx.js's own CSS otherwise wins on equal specificity).
- Animations off adds `html.fx-still` (piece slides, fight popup, toasts become instant); Fast adds `html.fx-fast`.

## Event → sound map (js/sfx.js)
| Event | Sound / effect |
|---|---|
| Setup tab: pick a piece / swap two | `click` / `place` (wood) + both pieces pop |
| Setup tab: Real setup, Shuffle, Mirror | `slide` |
| Ready (your army in, theirs not yet) / their army arrives | `deploy` (run of wood knocks) / `place` |
| Both armies placed, game starts | `deploy`, then `turn` chime + status pops |
| Pick up a piece / tap a Bomb, Flag or stuck piece / move refused | `click` / `error` |
| One-square move / Scout run (2+ squares) | `slide` / `whoosh` |
| Any attack | (`whoosh` if a Scout ran in) `cardFlip` low = both pieces turn face up, then at the knock-over (~0.33 s): |
| … normal fight | `clash`, then `capture` if your side won, `hit` if you lost a piece or both fell |
| … hits a Bomb (attacker dies) | `explosion` + board shakes + amber flash on the square |
| … Miner on a Bomb | `defuse` (snip, fizzle) |
| … your Spy takes their Marshal | `clash` + `capture` + "big" star burst on the square (theirs on yours: `hit`) |
| … Flag taken | `clash` + `capture`, then win/lose |
| It becomes your turn | `turn` chime only online and at game start (vs the computer its move sound is the cue) |
| You win (Flag, they resign, they can't move) / you lose / draw | `celebrate win` (your colour + gold confetti) / `celebrate lose` / nothing |
Opponent sounds play at 0.85 volume. Fast = 0.55× delays; Animations off = sounds bunched at 0.5×.

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
- The Study board is ~263 px wide on a phone (was 240); the move list shows 2 rows. A full-width board would leave no list.
- Design-pass choices Tim didn't make: Resign is now a quiet ghost button; the laptop side panel shows a dashed "Tap a piece" slot when nothing is tapped; laptop new-game form is centred vertically.
- Fight popup motion and the turn glow checked only in WebKit headless screenshots, not on a real iPhone.
- In Barrage, Hard is not clearly stronger than Medium (53.2% ±4.4).
- Sound & effects: nothing was heard (headless WebKit on Windows has no Web Audio); checked by spying on `FX.play` in node and in WebKit. How the custom `clash`/`defuse`/`deploy` sounds actually sound, and the iPhone silent switch, need Tim's ears. Online sounds checked only through the shared snapshot path in node, not in two live browsers.
- Choices Tim didn't make: no turn chime vs the computer; "big" moment only for your own Spy-takes-Marshal; draw gets no celebration; Settings panel placed after Display.

## Rejected / parked
- ~~Opening book, bluff detector, learning computer, win-probability bar~~ — see `docs/ideas.md` (no honest data behind them).
