# Stratego Lab — progress

## START HERE
Read this file, then `CLAUDE.md`, then `docs/rules-check.md`. Last updated: 2026-10-27 (follow-up: Hard's Flag spot varies, online.js cache stamp; before that, improvement pass: Hard ≥70% vs Medium, Undo, saved armies, guided game + rules, My stats/Daily, installable app, big fight moments).

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
| Real-table look (2026-10-20, c7bd335) | Done: Play tab on a wood table (shared kit `css/table.css` + `js/table.js`, byte copies of `_table`); folding board with printed end margins where each side's removed pieces lie in rank stacks (theirs far, yours near), gold rule, centre fold, meadow print, irregular ponds; pieces are standing slabs (top edge, face toward owner, shadow; red printed gold, blue silver; enemy = plain back with emblem); fight turns the enemy piece round in 3-D; laptop board tilted back 11° (perspective); new phone-landscape layout (board left, panels right) for Play and Setup |
| Visual design pass (2026-10-20) | Done: bevelled pieces, board frame glows on your turn, readable odds badges (scale with the board), tapped enemy piece ringed, odds bars scaled to the top value with % labels, fight popup knocks the loser over, lakes without grid lines, laptop duplicate army panel removed, 40px tap targets, Study phone board 240→263 px |

| Improvement pass (2026-10-27) | Done: Hard re-tuned (see Measured strength); Undo vs the computer (30 steps, not in the Daily; using it or Hint makes the game "with help", unrated); Setup "Saved" armies (6 per variant); guided first game (`js/tutorial.js` + shared `_coach`) and a Rules sheet; My stats / 10 achievements / Daily game (shared `_profile` 1.1.0 + `js/profile-str.js`); installable app (`_pwa` 1.2.0, `manifest.webmanifest`, `icons/`); key fights (Spy takes Marshal, a Marshal falls, Bomb cleared / Boom) get a bigger popup with a headline, ring and board shake; `tests/profile-str.test.js` 4 tests; `tests/pwa-check.json` 18/18 |

## Edge pass (2026-10-20)
61 weird scenarios tested for real (rules in node; taps, devices and screens in headless WebKit + Chrome; online rooms on real Firebase): 41 passed as found, 16 failed and are fixed, 1 N/A (no spectators), 3 NOT verified. Regression test: `node tests/edge.test.mjs` (12 checks, WebKit, own server; `BASE=<url>` checks the live site).
| Fixed | Was |
|---|---|
| Board size | phone 330→342 px, iPhone SE 247→259, phone sideways 231→334 (Study 296); rotating mid-game resized to 240, now 334 |
| Phone sideways layout | tabs become a left rail; status, info strip, odds/hint and actions sit right of the board; new-game, setup, settings and Study fit |
| Double-tap Ready | opened the Resign box |
| Hint | second tap cut it short; tapping a piece while it showed selected the hinted piece instead |
| Back | left the Resign question open on another tab |
| Edit setup | opened the variant last viewed in Setup, not the game's |
| Before Ready | no way out; now Quit (local) / Leave (online) |
| Two tabs of one game | overwrote each other; now the stale tab reloads the newer game ("This game moved on in another tab.") |
| Online | double-tap Create/Join made 2 rooms; guest wasn't told when the host closed the room |
| Toast | blocked taps on the buttons under it |
| Phone info strip | fight line clipped when an enemy was tapped with a piece picked up |
| Study | 6.5 s to open a 1,345-move game (WebKit); now ~0.2–0.6 s, move list fills just after |
| 200% browser zoom | Study cut off |
Laptop tilt (11°): taps land on the right square in Chrome and WebKit at 1280 and 1920 (92 cells each) — no fix needed.

## Visibility pass (2026-10-27)
Regression test: `node tests/visibility.test.mjs` (10 checks, WebKit + Chrome, own server; 9 fail on the old build).
| Fixed | Before → after (measured) |
|---|---|
| Rank number on pieces (now printed big across the top, emblem small below) | phone 7.4 → 13.5 px, 320 5.4 → 10.0, sideways 7.2 → 12.8, Setup tab 8.0 → 14.2, Study 5.5 → 10.9 |
| Board size | phone 342 → 352 px, 320 259 → 269, Study phone 263 → 291, laptop 1280 602 → 657 on screen, 1440 701 → 757 |
| Board jumped 342→340→338 on taps (status row shrank) | fixed height; odds/hint buttons moved into the button row on an upright phone |
| Odds badges | 9 → 12 px, inside their square |
| Removed-piece margins (14 px slabs) | tap a margin: both sides at 36 px (52 px on laptop) |
| Their-army pieces | sideways 14 → 30 px, laptop 26 → 40 px (two rows of 6) |
| Laptop | board takes the full left height; status line heads the side column |
| Setup tab | "Test it" no longer cut off sideways; "Where players put" chips all fit at 320 |

## Measured strength (2026-10-27)
Classic, 1,000 games each: Hard beats Medium 73.1% (±2.7; was 60.2), Hard beats Easy 98.1% (was 96.4), Medium beats Easy 89.3%, Easy beats random 85.4% (2026-10-20, unchanged code).
Barrage, 500 each: Hard–Medium 73.7% (±3.9; was 53.2), Hard–Easy 95.5% (was 88.0), Medium–Easy 85.7%, Easy–random 68.2%.
What moved Hard (300-game Classic runs, ±5.5): Flag walled by Bombs on the back row 60.7→69; + Flag-race terms (defW 4, offW 1.5) 75; + guard 3 76. Barrage: decoys (don't move unmoved pieces, still 8) + baseW 0.2 + defW 10 → 67; Flag in a back corner behind the Bomb → 74. Tried and no help: more worlds (K 16), 3-ply follow-up, "they can't see my rank" discount, look-ahead weight changes. Flag variety (2026-10-27, so a repeat player can't learn one spot): Classic Hard adds a second (decoy) Bomb wall round another back-row piece in half its games (`T.flagMix [0.5,0.5]`; 60% of setups now have two walls); Barrage Hard puts the Flag in a corner 60% and otherwise on another back-row square with nothing beside it (`T.barrage.flagMix [0.6,0.4]`, `sideEmpty 2`). Before → after, same seeds: Classic 1,000 games 73.1% → 73.6% (±2.7); Barrage 1,000 games 74.1% (2,000) → 73.6% (±2.7). Off-corner alone: 70.7%; with pieces beside the Flag 60–64% (rejected). Test: `node tests/setup-variety.test.js` (fails on the old bots: decoy 14%, corner 100%). Knobs: `Bots.T` (Classic) and `Bots.T.barrage`; `TUNE='{"…"}' node tools/measure.js N variant hard-medium` overrides them, `WORKERS=n` caps threads.

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, ... to the list of games." (2026-10-20)
- "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." (2026-10-20)
- "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life ... It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)." (2026-10-20)
- "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." (2026-10-20)
- "for a lot of the games the cards or board layout is too small to easily see what's going on. ... Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it." (2026-10-21)
- Global rules apply: $0, no permission prompts, background-only testing, design-taste (no page scroll on main screens, phone bottom tabs, short labels, "?" explains why, choices in Settings).

## Traps
- **Kits re-copied 2026-10-27 (kitfix):** game-coach 1.1.0 (rules tabs wrap instead of scrolling sideways; a note beside a tall target keeps title + 2 lines + buttons) and game-pwa 1.3.0 (`data-extra` on the pwa.js tag caches files loaded later by script). Copies stay byte-identical to `../_coach` / `../_pwa`.
- Gravon writes row 10 as `:`; `tools/gravon.js` handles it. Player 1 = Red; square = 99 − Gravon index.
- Gravon enforced a two-squares limit of 5 and no chase rule; replays use those settings.
- Headless WebKit on Windows is slow at layout (300–1000 ms per tap when the CPU is busy); Chrome is 20–90 ms. Not a phone measurement.
- The board size is computed in JS (`sizeBoard`) from what the other parts leave free; parts marked `data-min` count as that height.
- Port 8765 is often taken by other agents' servers; use another port for local serving.
- Two-browser test creates a real room in `th-board-games` and closes it at the end.
- Finished games are told apart by `gid` (made in `E.newGame`, shown in `publicView`); never key on layouts or move count again (back-to-back resigns collided).
- `render()` catches a failed draw and drops only the saved part that tab was showing (local game, last game, or one setup). Keep new tabs inside it.
- Game buttons ignore a tap on a *different* button within 500 ms (Ready turns into Resign under the finger). Test scripts must wait >500 ms between them.
- Bump every changed file's `?v=` on each push. index.html: engine/data/odds/online-game/fx/table/sfx v=6, art v=7, profile/coach/tutorial/pwa v=8, bots/strength-data/app v=9 (pwa.js `data-version="9"` is the build number); worker.js imports bots v=9 and the Worker URL is v=9; online import `?v=a3d0418b` (the `_online` content stamp, see below).
- Kits copied byte-for-byte (never edit here): `js/profile.js`+`css/profile.css` (_profile 1.1.0), `js/coach.js`+`css/coach.css` (_coach), `js/pwa.js`, `sw.js`, `tools/make-icons.mjs`, `tools/pwa-check.mjs` (_pwa 1.2.0). `.gitattributes` marks them `-text`.
- Stats rules: Hint or Undo sets `local.helped` → "with help", unrated. The Daily has no Undo. Leaving a game in play (New game, Daily, Guided game, Settings Reset) resigns it = one loss; a Daily left at any phase is a loss; the guided game never counts and leaves silently. The computer waits while that question box is open.
- The coach offer ("New to Stratego?") covers the bottom of the new-game screen and the tab bar on a first visit. Test scripts: set localStorage `coach-offer:stratego-first` = `true` first.
- Phone-view screenshots of the fight popup: WebKit screenshots take ~2 s when the CPU is busy, so the popup is gone. `window.__strat.fight(h)` + `clearTimeout(__strat.ui.fight)` holds it (scratchpad script `bigshot.mjs` did this).
- `tools/measure.js` workers use ~1.3 GB each; a 1000-game Classic run takes ~25 min with 6 workers.
- Phone sideways (`LANDSCAPE`, max-height 540): `#app` is a row with a 64 px tab rail on the left; `#game` is a grid and `.gstatus` is `display: contents`. Test sideways screens with the rail in mind (nothing sits under a bottom bar).
- Two tabs: `syncFromStorage()` runs before every local move, on the `storage` event and before the computer moves; it reloads the game when storage holds a newer ply/phase of the same `gid`. It is skipped when saving failed (`saveOk`), so blocked storage still plays.
- Online: `roomJob()` runs Create/Join one at a time (`net.busy`); `net.sentAt/sentPly` ignores board taps for up to 5 s after sending a move; `net.leaving` stops the "room was closed" toast on your own Leave.
- Study: games over 300 moves build the move list one frame after the board (`studyRows` in a rAF+timeout). Kept positions are shallow copies without `hist`.
- `js/fx.js`, `js/table.js`, `css/table.css` are byte copies of `_fx` / `_table`; `.gitattributes` marks them `-text`. After a merge on Windows the main checkout of fx.js can still be CRLF: `cmp` against the source and re-copy (git sees no change).
- The game board sits in `.bframe` (printed margins `--fe` ends / `--fs` sides, read by `sizeBoard`); on laptop the frame is tilted and pulled up by a negative margin that `sizeBoard` adds back as height. Phone landscape (`LANDSCAPE` media query, max-height 540) has its own sizeBoard branch.
- Headless WebKit on Windows draws the laptop tilt flat (no foreshortening); Chrome draws it right. Screenshot the tilt with `--engine chrome`.
- Fight popup screenshots: WebKit is too slow to catch it; use `--engine chrome` and shoot ~110–330 ms after the attacking tap.
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
- Hard = 6 sampled worlds × 2-ply look-ahead blended with 1-ply, plus the race for both Flags, a Flag guard, Hard-only setups (Classic: Flag walled by Bombs on the back row, half the time with a decoy wall; Barrage: Flag behind the Bomb, in a back corner 60%) and, in Barrage, keeping unmoved pieces as decoys. Easy and Medium are unchanged.
- Study keeps only the last finished game.

## NOT verified
- Real iPhone feel (speed of taps, safe areas) — only WebKit headless at 393 px.
- Duel / Quick Battle, Ultimate Lightning, Rescue — skipped.
- ISF 11.2 exception has no real-game test data.
- Hard's 6-world look-ahead speed on an old phone.
- The Study board is ~263 px wide on a phone (was 240); the move list shows 2 rows. A full-width board would leave no list.
- Design-pass choices Tim didn't make: Resign is now a quiet ghost button; the laptop side panel shows a dashed "Tap a piece" slot when nothing is tapped; laptop new-game form is centred vertically.
- Fight popup motion and the turn glow checked only in WebKit headless screenshots, not on a real iPhone.
- Hard's Flag spots (varied 2026-10-27, see Measured strength): still always on the back row behind Bombs; whether a human learns the decoy/off-corner shapes is untested (measured only against Medium).
- Improvement-pass choices Tim didn't make: wording "Took back your last move", "Saved" button and pop, achievement names (First win, Field officer, Field marshal, Eight against eight, Silent knife, Sapper, Untouchable, Lightning raid, Hat trick, Daily soldier), big-fight headlines ("The Spy takes the Marshal!", "A Marshal falls!", "Bomb cleared!", "Boom!"), the Daily = Classic vs Hard with rulebook rules, the My stats / Daily game / Rules row on the new-game screen (hint line hidden on iPhone SE height), app name "Stratego Lab" on the home screen. The tutorial and rules text are our own words.
- Not built: campaign (needs Tim's call on its shape) and an end-of-game replay beyond what Study already does (Study replays the last game move by move). Ranked ladder skipped (online with strangers).
- Big fight moments seen only in WebKit headless screenshots (393 px and 1440 px), with and without Animations; the shake and ring motion not watched live.
- Sound & effects: nothing was heard (headless WebKit on Windows has no Web Audio); checked by spying on `FX.play` in node and in WebKit. How the custom `clash`/`defuse`/`deploy` sounds actually sound, and the iPhone silent switch, need Tim's ears. Online sounds checked only through the shared snapshot path in node, not in two live browsers.
- Real-table look: laptop tilt checked only in Chrome headless (WebKit headless renders it flat; real Safari not seen). Phone board shrank 367→330 px at 393 px (the board margins hold the removed pieces); edge pass brought it back to 342, and 334 sideways. Removed-piece stacks are small on phone (~14 px). Choices Tim didn't make: dark wood table; removed pieces in the board's end margins (not on the table beside it); no seat name on the board; no tilt on phone (tap size); new-game/lobby screens stay plain dark; fight popup kept as a card.
- Edge pass: iPhone notch in sideways (safe-area insets added, no device), page in the background 10 min, two fights within 1.25 s (timer now reset per fight), sound/effect switches flipped mid-game. A host who drops out takes ~75 s before the guest gets the room (shared `_online` STALE_MS; not changed). The "fails on old code" run for the Back/Resign and Study checks crashed node on the old build, so those two rely on the harness before-results (box stayed open; 6.5 s).
- Edge-pass choices Tim didn't make: left tab rail when the phone is sideways; status/odds/hint/actions to the right of the board sideways; Quit/Leave ghost button before Ready; tighter phone spacing (5 px); shorter odds bars while the fight line shows; toasts let taps through; new messages "The room was closed.", "You are no longer in the room.", "This game moved on in another tab.", "Could not reach the game server. Check your connection and try again."
- Choices Tim didn't make: no turn chime vs the computer; "big" moment only for your own Spy-takes-Marshal; draw gets no celebration; Settings panel placed after Display.

## Rejected / parked
- ~~Opening book, bluff detector, learning computer, win-probability bar~~ — see `docs/ideas.md` (no honest data behind them).
