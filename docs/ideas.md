# Data and theory ideas — Stratego Lab

Built from the gravon.de StraDoS2 archive (42,488 classic + 2,922 Barrage human games, replayed through the engine) and from the engine itself.

| # | Idea | Verdict | Where / why |
|---|---|---|---|
| 1 | **Live rank odds for every hidden enemy piece** (what is left, what moved, Scout runs, fights) | **Build** | Play: badge on each piece, full bars when tapped. `js/odds.js` — exact formula when only "moved/not moved" is known, sampling otherwise; tested against brute force. |
| 2 | **Real-player prior**: weigh each square by where 42,488 real players put each rank | **Build** | Settings → Odds model. Moves the Flag guess from a flat 1/40 to 86% "back row" before a single move. |
| 3 | **Win chance on the attack target** before you commit | **Build** | Play: % badge on every enemy piece you could hit with the selected piece (red→green). |
| 4 | **Setup heat map** per rank from the archive | **Build** | Setup tab → "Where players put". |
| 5 | **Flag "guessability"**: where your Flag lands in an opponent's most-likely list | **Build** | Setup tab → "Flag found on guess #N". |
| 6 | **Setup checks backed by win rates** (Flag depth, bombed-in Flag, lanes, Scouts forward, Miners back, Spy near General) | **Build** | Setup tab. Flag on back row wins 51% vs 31% on the front row; bombed-in Flag 52.6% vs 48.0% open. |
| 7 | **Test your setup** with quick computer games in the background | **Build** | Setup tab → "Test it" (24 Medium-vs-Medium games in a Web Worker, both colours). |
| 8 | **Study replay with everything revealed**, material chart, and "points lost" per move | **Build** | Study tab. |
| 9 | **Fight odds at the time of each of your attacks** in the replay | **Build** | Study → "Check my moves". |
| 10 | **Archive facts** (first-mover edge, game length, how games end, Flag placement) | **Build** | Study → "Real games". Second mover wins slightly more (50% vs 47%). |
| 11 | **Measured computer strength** instead of guessed labels | **Build** | Settings → "Computer strength ?". 1,000 games per pairing. |
| 12 | Computer that learns your setups across games | Skip | Needs stored history per player; small gain for a lot of state. |
| 13 | Bluff detector (pieces that charge like a Marshal but aren't) | Skip | The archive has no reliable labels for bluffs; would be guesswork dressed as data. |
| 14 | Opening book from the archive's first 10 moves | Skip | Openings depend on the exact setup; too sparse to be useful. |
| 15 | Win-probability bar during play | Skip | Needs a trained evaluator; the material chart in Study covers the honest part. |
| 16 | Barrage real-player prior | Skip | Only 2,922 Barrage games; 8 pieces anywhere in 40 squares is too sparse. Barrage odds use the flat model. |
| 17 | Endgame tablebase for small piece counts | Skip | Hidden information makes exact endgames ill-defined. |
