# Rules check — Stratego Lab

Every rule the engine (`js/engine.js`) enforces, where it comes from, and the test that pins it.
Rulebook wording is paraphrased (no rulebook text is copied).

**Sources**
- **J** = Jumbo Stratego Original instructions, 2022 (media.jumboplay.com/19945_instructions_LR.pdf) — current official rules.
- **ISF** = International Stratego Federation game rules (isfstratego.kleier.net/docs/rulreg/isfgamerules.pdf) — tournament rules.
- **H** = Hasbro/Milton Bradley Stratego rules, 2002 (hasbro.com/common/instruct/stratego.pdf) and Hasbro instructions 40836.
- **EC** = Ed Collins' Stratego pages (edcollins.com/stratego) — Barrage and variant notes.
- **W** = Wikipedia, "Stratego" (rules, pieces, variants).
- **G** = 42,488 real games from the gravon.de StraDoS2 archive, replayed through the engine (`tools/replay-gravon.js`).

| # | Rule | Engine | Sources | Test |
|---|---|---|---|---|
| 1 | 10×10 board, two 2×2 lakes in the middle (C5–D6, G5–H6) | `LAKES = [42,43,46,47,52,53,56,57]` | J, ISF, W | engine test 1 (lake squares counted) |
| 2 | Each side 40 pieces: Marshal 1, General 1, Colonel 2, Major 3, Captain 4, Lieutenant 4, Sergeant 4, Miner 5, Scout 8, Spy 1, Bomb 6, Flag 1 | `ARMIES.classic` | J, H, W | engine test 1 asserts every count and the total 40 |
| 3 | Pieces go in your own 4 back rows; Red moves first | `checkLayout`, `zoneOf`, `turn: 0` | J, ISF (H says Red first too) | engine tests 1, 6 |
| 4 | One piece moves one square up/down/left/right per turn; never diagonally, never into a lake, never onto your own piece | `pieceMoves` | J, H, ISF | engine test 3 |
| 5 | Bombs and the Flag never move | `movable` | J, H, ISF | engine test 3 |
| 6 | Scout moves any number of empty squares in a straight line | `pieceMoves` (Scout) | J, H, ISF, W | engine test 3 |
| 7 | Scout may move several squares and strike in the same turn (default); "classic rules" setting: must stop first | `opts.scoutStrike` | J and ISF allow; H 2002 forbids — both offered | engine test 3 (both settings) |
| 8 | A Scout that moves more than one square shows it is a Scout | `p.sc` → public rank Scout | ISF (moving more than one square reveals a Scout), W | engine test 3, odds tests |
| 9 | Higher rank wins; loser is removed | `resolve` | J, H, ISF | engine test 2 |
| 10 | Equal ranks: both removed | `resolve` → `'both'` | J, H, ISF | engine test 2 |
| 11 | Spy beats the Marshal only when the Spy attacks; any piece that attacks the Spy wins | `resolve` | J, H, ISF | engine test 2 |
| 12 | Any piece attacking a Bomb is removed (Bomb stays); a Miner removes the Bomb and moves in | `resolve` | J, ISF (H 2002: same) | engine test 2 |
| 13 | Both pieces in a fight are shown; the winner moves in only if it was the attacker | `doMove` | J, ISF | engine test 8 (board fights) |
| 14 | Capturing the Flag wins | `doMove` | J, H, ISF | engine test 7, engine test 10 Gravon replay (107/107 flag captures agree) |
| 15 | A player who cannot move or attack loses; if neither side can move, the game is a draw | `doMove` end check, and `placeAll` for setups that are stuck from the start | J (no move = loss), ISF (both stuck = draw) | engine test 7 (loss and draw, also walled-in setups at the start) |
| 16 | Two-squares rule: a piece may not move back and forth between the same two squares more than 3 times in a row (the 4th is refused); Scout runs across those squares count | `breaksTwoSq` | ISF 10.1–10.2, J | engine test 4 (limit 3 and 5, Scout stretches) |
| 17 | Option: limit 5 (older ISF / Gravon) | `opts.twoSq` | ISF older versions, G (longest streak in 42,488 games is exactly 5) | engine test 4 |
| 18 | More-squares rule: a chasing piece may not keep threatening the same piece over a repeating set of squares; only the chaser is limited, with the 11.2 exception | `breaksChase` (default on, Settings switch) | ISF 11 | engine test 5 |
| 19 | Aggressor Advantage (option): equal ranks — attacker wins | `opts.aggressor` | J variant, W | engine test 2 |
| 20 | Silent Defense (option): only the attacker's rank is shown | `opts.silent`, `cons` masks | J variant, W | engine test 9 |
| 21 | Barrage: 8 pieces each — Flag, Bomb, Spy, 2 Scouts, Miner, General, Marshal — placed anywhere in your 4 rows; same rules | `ARMIES.barrage`, `checkLayout` | EC, W, ISF Barrage, J | engine test 1 (counts, total 8), online test (Barrage games) |
| 22 | Numbering: modern Marshal 10 … Spy 1 (default); classic Marshal 1 … Scout 9, Spy S | `label` | J (modern), H (classic) | engine test 11 |
| 24 | Rescue (option, off by default): a piece other than a Scout that ends its move (or a won attack) on the enemy back row may bring back one of its side's captured pieces, never a Bomb, onto any empty square of its own half (5 rows, no lakes); that ends the turn. At most 2 rescues per player; the same piece can't make both; skipping is allowed. The rescued piece is shown to both sides (it came back from the opponent's pile). The stuck-side check runs after the choice | `opts.rescue`, `g.pend`, `rescueOptions`, `doRescue`, `{type:'rescue', r, to}` / `{skip:true}`; Study replays with `replayStep` | H (Hasbro/MB "Rescue" variation, as summarised by rulespal.com/stratego/rulebook: "two rescues", "Scouts cannot make a rescue", "Bombs cannot be rescued", "This ends your turn") | `tests/variants.test.js` 2–5, 7–8; `tests/variants-ui.test.mjs` |
| 25 | One-time Bombs (house rule, off by default): a Bomb that blows up is removed along with the attacker; a Miner still defuses it | `opts.bombOnce` → `resolve` gives `'both'` | ultraboardgames.com/stratego/alternative-rules.php ("Bombs blow up for good after the initial explosion") | `tests/variants.test.js` 6 |
| 23 | Pieces you have seen stay marked in the app | app choice (shown ranks stay visible) | — | NOT a rule; tournament players must remember. Noted as an app choice. |

**Replay evidence (G).** `tools/replay-gravon.js` on 5,000 archive games: 4,809 classic games replay with every move legal under ISF two-squares limit 5 and no chase rule; 1 game has a doubled move in the file; all flag results agree. With the chase rule on, 38–40 games break it (Gravon never enforced it). `tests/engine.test.js` replays a fixed 260-game sample (67,608 moves) on every run.

## NOT verified / skipped
- **Duel / Quick Battle** (8×8 board, 10 pieces) — skipped: sources disagree on board and pieces.
- **Ultimate Lightning**, **Stratego 4-player** — skipped (Ultimate Lightning needs an 8×10 board and the Infiltrator; sources differ on its piece list). **Rescue** built 2026-10-28 (row 24).
- Rescue: the rulebook doesn't say whether a piece moving *along* the enemy back row counts as "moving onto" it; the engine lets any move that ends there count. The rescued piece is shown to both sides (an app reading: physically the opponent hands it back).
- ISF 11.2's exception is built as read from the PDF, but no tournament game record was available to test it against.
- Hasbro 2002 says the Scout must stop before attacking; the Jumbo 2022 book lets it strike. Default follows Jumbo/ISF; the Settings switch gives the other.
