# ⚡ FlashGames

**One game. One day. Fifteen minutes.** Every day FlashGames turns one of Joseph's single-player games into a
15-minute speedrun with a few crazy rules: Dungeon Joe with 1 HP and every stat maxed, the Gobble Saloon where every
card is wild, Smash Your Bros on the moon. Everyone plays the same run that day. Beat your friends, collect medals,
come back tomorrow for something new.

**Play:** https://josephjackman.com/games/flashgames/

## How a day works

- **The day's run.** A game, 2–3 modifiers, a seed. Same for everyone. It changes at **midnight US Central**, and
  old days can't be played.
- **Play as often as you like.** Each run is 15 minutes on FlashGames' clock (3-2-1, then go). Your best run of the
  day is your score. The game shows its score as you play; it's saved as you go, so closing the tab keeps it.
- **You vs your friends.** The board shows you and your friends. Same accounts and friends as Shoallhell, Smash Your
  Bros and Baker's Dozen: sign in once, add friends by their 4-digit code.
- **Medals, forever.** After midnight each day is settled: your place among you and your friends who played. 1st and
  2nd count when at least two of you played, 3rd when at least three did. Your trophy shelf counts 🥇🥈🥉 forever.
- **A year of days.** Your shelf (and your friends') shows a year of daily bests as a grid, coloured by place.

## The rotation

| Game | What a run is |
| :- | :- |
| Dungeon Joe | a fresh character, as deep as you can get |
| The Infinite Hive | a fresh hive, as much as you can grow |
| Geode Gobbler: the Gobble Saloon | one poker-roguelike run, as far as you can get |
| Alt Whisker Wars | the solo campaign from level 1 |
| Smash Your Bros | the Classic ladder |
| Shoallhell | seeded delves, one after another |

Each game's modifiers and scoring are in its `flash.json` (e.g. https://josephjackman.com/games/dungeonjoe/flash.json).
`rotation.json` lists the games in the rotation, where their source is and how they deploy, and the games that were
looked at and left out (party and social games, and Cadence by the owner's choice).

## Who plans the days

A Claude task on the owner's PC, **every Monday at 3 am** (`.claude/skills/flashgames-week/SKILL.md`, scheduled as
"FlashGames weekly planner" in the Claude desktop app). It plans the next Monday to Sunday, so there is always a week
in hand. While it's at it, it keeps every game's FlashGames mode working as the games change, writes new modifiers
each week, and brings newly finished single-player games into the rotation. Plans are uploaded with an admin key
and stay secret until their day. The server never invents a day: if one has no plan, it replays an earlier day's
game and modifiers with a new seed ("encore").

The scheduled task only runs while the Claude app is open on the PC. If it was closed at 3 am Monday, the task runs
the next time the app opens.

## Adding a game

`docs/PROTOCOL.md`: copy `sdk/flash-run.js` into the game, handle `?flash=` (no menus, seeded, no saves, report the
score), publish a `flash.json` with the modifiers, deploy, and list it in `rotation.json`. The Monday task does this
itself for new single-player games.

## Run it locally

Needs Node 22+ and the Shoallhell repo next to this one (`C:\dev\Shoallhell`).

```powershell
cd C:\dev\FlashGames; npm install
npm run dev        # Shoallhell's server on :3031 + this page on http://localhost:5177/games/flashgames/
```

The dev server also serves the other games' built folders at `/games/<id>/` (`LOCAL_GAMES` in `vite.config.ts`),
so a run plays locally just as on the site. To give the local server a day to play:

```powershell
node tools/plans.mjs upload C:\path\to\plans.json --local
```

```powershell
npm run typecheck; npm test      # SDK, run controller, formatting
npm run test:e2e                 # a whole day in a browser with the stand-in game
npm run build
```

## How it deploys

1. **The page** (static) on GitHub Pages through the `games` repo. Every push to `main` runs
   `.github/workflows/ready.yml` (type check, tests, build) and puts the built site in `site/` on the `ready`
   branch; `deploy/library.json` in the games repo has `{ "folder": "flashgames", "repo": "flashgames", "publish":
   "site" }`. The page talks to https://shoallhell.fly.dev unless the repository variable `FG_SERVER` says otherwise.
2. **The boards** are part of Shoallhell's server (`server/flashgames.js`): `fly deploy` in `C:\dev\Shoallhell`. The
   admin key is the Fly secret `FG_ADMIN_TOKEN`; the same key is in `%USERPROFILE%\.flashgames\admin-token` on the
   owner's PC.

## Code map

```
src/main.ts     sign-in, the day (board, yesterday, trophy shelf, year grid, friends), the run screen
src/run.ts      one run: iframe messages, 3-2-1, the clock, saving scores
src/api.ts      Shoallhell's server (shared accounts) and the /fg endpoints
sdk/            flash-run.js (copied into every game), its types, make-flash-url.mjs
tools/plans.mjs the weekly planner's tool: list, mods, check, upload
rotation.json   the games in the rotation and how each one deploys
tests/          unit tests, a Playwright day, and the stand-in game (fixtures/fg-test)
```
