# CLAUDE.md — FlashGames

FlashGames is a daily 15-minute speedrun of one of the owner's single-player games, with 2–3 crazy modifiers. One
run a day (as many tries as you like, best counts), the same run for everyone, a board of you and your friends, a
year of daily bests and medals forever. Hosted at `https://josephjackman.com/games/flashgames/`; accounts, friends
and the boards are **Shoallhell's server** (`C:\dev\Shoallhell\server\flashgames.js`, Fly.io app `shoallhell`).

## Read first
1. `README.md` — what it is, how a day works, how it deploys
2. `docs/PROTOCOL.md` — how a game runs as a FlashGames run (`sdk/flash-run.js`, `flash.json`)
3. `.claude/skills/flashgames-week/SKILL.md` — the Monday task that plans each week and keeps the games fresh
4. `docs/DECISIONS.md` — why things are the way they are

## How we work
- Windows 11 + PowerShell 5.1 for anything given to the owner (chain with `;`).
- Commit/push only when asked, except the weekly planner, which commits and deploys game changes as its skill says.
- **Plans are secret until their day.** This repo is public: never commit a plan or next week's games and modifiers.
  Plans go to the server with `tools/plans.mjs` and the admin key in `%USERPROFILE%\.flashgames\admin-token`
  (never print or commit it).

## Rules that are easy to break
- `sdk/flash-run.js` is copied into every game unchanged; change it here first, keep it backward compatible, and
  keep `tests/fixtures/fg-test/flash-run.js` identical (a test checks).
- A plan can only use modifiers that are in the game's live `flash.json` (`tools/plans.mjs check` reads the site).
- The page has no framework: `src/main.ts` draws with `h()` from `src/util.ts`; the run logic is `src/run.ts`.

## Commands
```powershell
npm run dev                      # Shoallhell server :3031 (from ..\Shoallhell, admin key "dev-admin") + Vite :5177
npm run typecheck; npm test      # unit tests (SDK, run controller, formatting)
npm run test:e2e                 # Playwright: a whole day with the stand-in game (needs ..\Shoallhell)
npm run build
node tools/plans.mjs list|mods|check|upload   # the planner's tool (--local for the dev server)
node sdk/make-flash-url.mjs glass,turbo 12345 60   # a ?flash= value for testing a game on its own
```
