---
name: flashgames-week
description: Plan next week's FlashGames daily challenges (Monday to Sunday), keep the rotation games' FlashGames modes working, add fresh modifiers, bring newly finished single-player games into the rotation, and upload the plans. Runs every Monday at 3 am from the "FlashGames weekly planner" scheduled task; the owner can also run it by hand.
---

# FlashGames weekly planner

FlashGames (josephjackman.com/games/flashgames/, repo `C:\dev\FlashGames`) is a daily 15-minute speedrun of one of
the owner's single-player games with 2–3 crazy modifiers. Everyone plays the same run that day; friends compete;
medals are counted forever. The server (Shoallhell's, `C:\dev\Shoallhell\server\flashgames.js`, on Fly.io as app
`shoallhell`) only stores the plans you upload and keeps score. **You decide what every day is.** That is the point
of this task: it runs on the owner's PC so each week can use what the games have become, with new modifiers and new
games, instead of a server picking at random.

## Rules

- The owner isn't watching. Don't ask questions: decide, and say what you decided in the report.
- **Plans are secret until their day.** Every repo here is public. Never commit a plan, or put next week's games or
  modifiers in a commit message, README, issue or PR. Plan files live in `C:\Users\jjack\.flashgames\plans\`.
- **The admin key** is in `C:\Users\jjack\.flashgames\admin-token`. `tools/plans.mjs` reads it. Never print it,
  commit it, or put it in a URL.
- Follow each game's own CLAUDE.md (commit style, rules that are easy to break). Commands for the owner are
  PowerShell 5.1 (chain with `;`).
- **Planning the week is the must-do.** Code changes are best-effort and must never leave a game broken: if a change
  can't be tested and checked in a browser, revert it and leave it for next week (and say so).
- A modifier can only go in a plan once it is in the game's **live** `flash.json`: `plans.mjs check` reads the live
  site. Deploys take 5–15 minutes; plan around that (or plan new modifiers for a later week).
- Keep modifier ids stable once they are live: old days refer to them.

## 1. Where things stand

```powershell
cd C:\dev\FlashGames; git pull
node tools/plans.mjs list     # planned days from two weeks ago on, with players, runs and top score per day
node tools/plans.mjs mods     # every rotation game's live modifiers
```

Read `C:\Users\jjack\.flashgames\log.md` (what earlier weeks planned and changed). The **target week** is the next
Monday after today through its Sunday (run on a Monday, that's next Monday, a week ahead). Also plan any day from
tomorrow up to then that has no plan yet. Days with no plan get an "encore" of an earlier day, so a gap never
breaks the site, but it shouldn't happen.

## 2. Keep the rotation working

For each game in `rotation.json`: pull it (git sources), look at what changed since last week (`git log
--since="8 days ago"`, or file dates for the two non-git sources), and run its `check` command. If the game changed,
check a FlashGames run still works (see "Checking a run"). Fix anything that broke; a game you can't fix this week
stays out of this week's plans (say so).

## 3. Bring in a new game (at most one a week)

Candidates are in `C:\dev\*` and `C:\dev\DungeonJoe\deploy\library.json`. A game qualifies when it is on
josephjackman.com/games, fully built, and has a **standard single-player campaign** (no party, social or
multiplayer-only games). Skip anything in `rotation.json`'s `notInRotation`, unless its reason says when to add it
and that has come true (e.g. JoeBrawla once it's deployed). If one qualifies:

1. Add its FlashGames mode as `docs/PROTOCOL.md` says: copy `sdk/flash-run.js` (and the `.d.ts` for TypeScript),
   skip menus, use the seed, touch no saves, `ready()`, `score()`, `over()`, `onEnd()`. Write 12–16 crazy modifiers
   and a scoring rule in its `flash.json`.
2. Add tests in the game where it has a test setup, run its checks, check a run in a browser, and commit and push the
   way that game deploys (`rotation.json` shows how the others do it).
3. Add it to `rotation.json` (and remove it from `notInRotation`), and commit and push FlashGames.
4. Don't plan it until its `flash.json` is live.

## 4. Fresh modifiers (2–4 a week)

Keep the days surprising. Pick the games whose modifiers are fewest or oldest, or that gained something new to play
with (a new zone, enemy, card, fighter or map), and add 2–4 new modifiers in total. They should be big and quirky
(they change how a run plays, not a 10% nudge). Each must work alone and with every modifier it doesn't `exclude`.
Implement them in the game, add them to its `flash.json`, test them, check a run with each, and deploy. If they're
live before you upload, feature them this week; if not, next week.

## 5. Plan the week

A good week:

- Seven days, Monday to Sunday. Never the same game two days running. Each game about once a week; every game at
  least once every two weeks. Lean toward what friends actually play (players and runs from step 1).
- 2–3 modifiers a day, inside the game's `pick` range, never a pair that `excludes` each other, never the exact combo
  of the last 60 days (`log.md`). Feature the new modifiers. Weekends get the wildest combos.
- `title`: short and funny, in the Dungeon Joe world's voice (e.g. "Glass Joe's Turbo Tuesday"). `blurb`: one or two
  sentences of flavour. The modifier cards already state the rules, so don't repeat them. Leave out `seed` (the
  server picks one).

Write `C:\Users\jjack\.flashgames\plans\<Monday's date>.json`, an array of short plans:

```json
[{ "date": "2026-11-30", "game": "dungeonjoe", "mods": ["glass", "turbo"], "title": "…", "blurb": "…" }]
```

```powershell
node tools/plans.mjs check  C:\Users\jjack\.flashgames\plans\2026-11-30.json   # fix every PROBLEM it prints
node tools/plans.mjs upload C:\Users\jjack\.flashgames\plans\2026-11-30.json
node tools/plans.mjs list
```

If the upload fails, retry a few times, a minute apart. If it still fails, keep the file and say so in the report.

## 6. Log and report

Append to `C:\Users\jjack\.flashgames\log.md`: today's date; each planned day (date, game, modifier ids, title); code
changes (repo and commit); games added; anything that failed. End with a short report for the owner: the week
planned (it's his PC, so he may see it), what changed in the games, and anything that failed or needs him.

## Checking a run

- Make a test URL: `node C:\dev\FlashGames\sdk\make-flash-url.mjs mod1,mod2 12345 60` prints `?flash=…`.
- Open the game with it (the live site, or the game's own dev server). Opened on its own, a run starts a second after
  the game calls `ready()` and ends after the limit.
- Or run FlashGames locally: `npm run dev` in `C:\dev\FlashGames` starts the Shoallhell server and the page on
  http://localhost:5177/games/flashgames/, and mirrors the built games at `/games/<id>/` (see `LOCAL_GAMES` in
  `vite.config.ts`). Upload a test plan with `node tools/plans.mjs upload <file> --local`.
- Playwright is installed in `C:\dev\FlashGames` and `C:\dev\DungeonJoe`; keep throwaway scripts in the session's
  scratch folder. Check that the run boots straight into play, that score messages arrive (iframe it in a parent
  page that logs `message` events), that it freezes at the limit, and that the game's normal saves in localStorage
  are unchanged.
