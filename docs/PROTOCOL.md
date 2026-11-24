# The FlashRun protocol (v1): how a game joins the FlashGames rotation

FlashGames (`josephjackman.com/games/flashgames/`) is a daily 15-minute speedrun of one of the owner's games, with
a few crazy modifiers. The day changes at midnight US Central; everyone plays the same run (same seed, same
modifiers) and friends compare scores.

The days are planned a week ahead by a Claude task on the owner's PC every Monday
(`.claude/skills/flashgames-week/SKILL.md`): it picks each day's game and modifiers from the games' live
`flash.json`, writes new modifiers as the games change, brings newly finished games into the rotation, and uploads
the plans to the server with the admin key. The server never invents a day (a day with no plan replays an earlier
one as an "encore").

A game is in the rotation when:

1. it has a **standard single-player campaign** and is **fully built** (no party games, no social games);
2. it publishes **`flash.json`** next to its `index.html` (e.g. `/games/dungeonjoe/flash.json`);
3. it plays a run when opened with **`?flash=…`**, using **`sdk/flash-run.js`** (this repo) copied into the game;
4. it is listed in **`rotation.json`** in this repo (with where its source is and how it deploys).

## flash.json

```json
{
  "v": 1,
  "id": "dungeonjoe",
  "name": "Dungeon Joe",
  "tagline": "A souls-like dungeon crawl",
  "goal": "Get as deep as you can in 15 minutes.",
  "scoring": "100 per room cleared, 10 per kill, 2,000 per boss, 1,000 per new zone.",
  "maxScore": 1000000,
  "pick": [2, 3],
  "modifiers": [
    { "id": "glass", "name": "Glass Joe", "text": "1 max HP, every stat maxed.", "excludes": ["tank"] },
    { "id": "turbo", "name": "Turbo Tuesday", "text": "Everything moves twice as fast.", "weight": 2 }
  ]
}
```

- `id`: the game's folder under `/games/`. `name`, `tagline`, `goal`, `scoring`: shown on the FlashGames page.
- `maxScore`: the server refuses scores above it (a sanity cap, not a target).
- `pick`: how many modifiers a day should get, `[min, max]`. The planner never puts two together when either lists
  the other in `excludes` (`tools/plans.mjs check` enforces it). `weight` is an optional hint (default 1).
- `modifiers`: 8 or more. Make them quirky and big: they should change how the run plays, not nudge a number by
  10%. Every id in this file must work in the game, alone and with any modifier it doesn't exclude.
- Keep ids stable once live: old days' plans refer to them.

## What the game does with `?flash=…`

The URL carries `{ v: 1, date, seed, mods, limit, run }` (base64url JSON), plus `params` when the day's plan sets
any (free-form values a game may read from `FlashRun.config.params`, e.g. a gravity number for a modifier that
takes one). `flash-run.js` reads it into `window.FlashRun`; with no `?flash` everything behaves as before
(`FlashRun.active` is false).

In a run the game must:

1. **Skip every menu.** No title screen, sign-in, character creation or save picker: boot straight into a fresh run
   set up by the modifiers. Choices a menu would normally make (class, fighter, deck, level) come from the seed
   (`FlashRun.rng('class')`) or a modifier, so everyone plays the same run.
2. **Use the seed** wherever the game has seeded randomness (map, deck, waves), so everyone gets the same run.
3. **Touch no saves.** Never read or write the player's normal saves, progress, unlocks, achievements, stats,
   cloud profile or leaderboards. A run is a throwaway in-memory game. Never ask for sign-in.
4. **Call `await FlashRun.ready()`** once the run is built and playable, and keep it paused until that resolves.
   FlashGames shows 3-2-1 and starts the 15-minute clock as it resolves.
5. **Report the score** with `FlashRun.score(n, detail)` whenever it changes: a whole number that never goes
   down, and a short line that explains it ("Zone 2 · 14 rooms · 112 kills"). FlashGames shows both and saves
   them to the server as you play, so a closed tab keeps its score.
6. **End the run** with `FlashRun.over(n, detail, reason)` if the game itself ends it: `'won'` (beat everything;
   add a time bonus from `FlashRun.timeLeft()` if you like) or `'dead'` (the game's own rules, or a modifier, end
   the run). Death in a game whose normal rules continue after dying (respawn at a bonfire) should keep going.
7. **Stop at the end of time:** `FlashRun.onEnd(fn)` is called when the 15 minutes are up. Freeze the game (stop
   the simulation, ignore input) and show the final score. Calling `over()` from it is optional.
8. **Fit the frame.** The game runs in an iframe below a 44 px FlashGames bar; it must fill whatever size it gets.
   Don't show your own 15-minute timer (FlashGames shows it); showing the day's modifiers in a corner is welcome.

`FlashRun.has(id)`, `FlashRun.mods`, `FlashRun.seed`, `FlashRun.rng(salt)`, `FlashRun.timeLeft()`,
`FlashRun.elapsed()`, `FlashRun.running()` and `FlashRun.isOver()` are there to help (types in
`sdk/flash-run.d.ts`).

**Testing on its own:** open `http://localhost:<port>/games/<id>/?flash=<code>` with no FlashGames around it; the
run starts a second after `ready()` and ends after `limit` seconds. Make a code with
`node sdk/make-flash-url.mjs <mods,comma,separated> [seed] [limit]` (prints the `?flash=` value).

## Messages (for reference; flash-run.js does this)

Game → FlashGames (`parent.postMessage`, all with `flash: 1`): `{type:'ready'}`, `{type:'score', score, detail}`,
`{type:'over', score, detail, reason}`.
FlashGames → game: `{type:'go'}` (clock starts), `{type:'end'}` (time is up).
Each side only accepts messages from the other window (`event.source`), so it works across origins in development.
