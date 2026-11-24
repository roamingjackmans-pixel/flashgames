# Decisions

**D1 (2026-11-23) The games run in an iframe, unchanged except for a `?flash=` mode.** Each game stays in its own repo
and deploys as before; FlashGames opens `/games/<id>/?flash=<code>` and talks to it with `postMessage`
(`sdk/flash-run.js`, `docs/PROTOCOL.md`). Copying games into this repo would fork them; a server-side game runner
would need every game rewritten. Same origin on josephjackman.com; works across origins in development because both
sides check `event.source`, not origins.

**D2 (2026-11-23) Only games with a standard single-player campaign** (owner). At launch: Dungeon Joe, The Infinite
Hive, the Gobble Saloon, Alt Whisker Wars, Smash Your Bros (Classic ladder), Shoallhell. Out: party and social games
(Roleplay20, Lieage, Don't Wake Gerald, Horse Race, The Deck, Baker's Dozen), Battle Cards (two players only),
Cadence (owner's choice), JoeBrawla (not deployed yet).

**D3 (2026-11-23) Unlimited tries, best counts** (owner). The board shows each player's best run of the day.

**D4 (2026-11-23) Places among you and your friends** (owner). A day is settled 30 minutes after midnight (late
scores can still arrive): each player's place among themselves and their friends who played, with friends as they
are at settling. 1st and 2nd count with at least two players in that circle, 3rd with at least three, so a player
with no friends can't collect medals alone. Equal scores share a place.

**D5 (2026-11-23) Days change at midnight US Central** (owner), the same for everyone.

**D6 (2026-11-23) The owner's PC plans the days, not the server** (owner). A scheduled Claude task every Monday at
3 am plans the following Monday to Sunday, adds modifiers as the games change, and brings new games in; the server
only stores uploaded plans (`PUT /fg/admin/plans` with the `FG_ADMIN_TOKEN` key) and keeps score. Planning a full
week ahead means one missed Monday (PC off, app closed) still leaves the coming week planned. A day with no plan
replays an earlier day as an encore rather than showing nothing.

**D7 (2026-11-23) Plans are secret until their day.** The repos are public, so plans live in
`%USERPROFILE%\.flashgames\plans\` and go straight to the server. `/fg/today` shows only today's plan (and
yesterday's, to signed-in players), and never the seed.

**D8 (2026-11-23) The server's clock decides the 15 minutes.** A run is made on the server (`POST /fg/runs`), its
clock starts when the game is loaded and the 3-2-1 is done (`/go`, which must come within 5 minutes), and scores are
taken until 15 minutes plus 60 seconds of grace after that. Scores are saved every 4 seconds while playing, so a
closed tab keeps its score. Reloading the game mid-run isn't supported (no game can resume a run); start a new one.
This is friendly-competition security, not anti-cheat: a determined player could send a fake score.

**D9 (2026-11-23) Scores never go down within a run, and only the game knows its scoring.** Each game reports a whole
number and a one-line explanation; scores are only compared within a day (one game), so games pick their own scale.
`maxScore` in `flash.json` is a sanity cap the server enforces.

**D10 (2026-11-23) Hosted on Shoallhell's server**, like Smash Your Bros and Baker's Dozen: shared accounts and
friends were the requirement, and that server already has them. FlashGames doesn't open a socket (no presence
needed); the page refreshes the board every 30 seconds.
