import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Served at josephjackman.com/games/flashgames/. Accounts, friends and the daily boards are Shoallhell's server
// (shared accounts). In development that server runs on port 3031 and is proxied under its own base path.
const SERVER = process.env.SHOALLHELL_SERVER || 'http://localhost:3031';

/** "1.0.12 (68c4b39)": package.json major.minor, commit count, commit. GAME_VERSION overrides it. */
function gameVersion(): string {
  if (process.env.GAME_VERSION) return process.env.GAME_VERSION;
  const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
  const [major = '1', minor = '0'] = pkg.version.split('.');
  try {
    const git = (...args: string[]): string => execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${major}.${minor}.${git('rev-list', '--count', 'HEAD')} (${git('rev-parse', '--short', 'HEAD')})`;
  } catch {
    return pkg.version;
  }
}

/**
 * Development only: serve the other games' built folders at /games/<folder>/ on this dev server, so a run can be
 * played locally exactly as on the live site (same origin). Paths are the owner's checkouts next to this repo.
 */
const LOCAL_GAMES: Record<string, string> = {
  dungeonjoe: '../DungeonJoe/dist',
  infinitehive: '../DungeonJoe/deploy/infinitehive',
  geodegobbler: '../DungeonJoe/deploy/geodegobbler',
  altwhiskerwars: '../AltWhiskerWars/public',
  smashyourbros: '../SmashYourBros/dist',
  shoallhell: '../Shoallhell/dist',
  'fg-test': 'tests/fixtures/fg-test',
};
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wasm': 'application/wasm', '.map': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
function localGames(): Plugin {
  return {
    name: 'local-games',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/games\/([^/]+)\/(.*)$/.exec((req.url || '').split('?')[0]!);
        // Shoallhell's API and socket go to the proxy, not to its built folder
        if (!m || !LOCAL_GAMES[m[1]!] || /^(api|socket\.io)(\/|$)/.test(m[2]!)) return next();
        const root = path.resolve(LOCAL_GAMES[m[1]!]!);
        let file = path.join(root, decodeURIComponent(m[2]!));
        if (!file.startsWith(root)) return next();
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        if (!fs.existsSync(file)) {
          res.statusCode = 404;
          return res.end('not found');
        }
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: '/games/flashgames/',
  define: { __GAME_VERSION__: JSON.stringify(gameVersion()) },
  plugins: [localGames()],
  build: { target: 'es2022', outDir: 'dist', sourcemap: true },
  server: {
    port: 5177,
    strictPort: true,
    proxy: {
      '/games/shoallhell/api': { target: SERVER, changeOrigin: true },
    },
  },
  preview: { port: 4177 },
});
