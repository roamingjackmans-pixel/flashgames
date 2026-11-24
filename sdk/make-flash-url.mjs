// Prints a ?flash= value for testing a game's FlashGames mode on its own.
//   node sdk/make-flash-url.mjs glass,turbo 12345 120
// gives  ?flash=eyJ2Ijox...  (modifiers glass and turbo, seed 12345, a 120-second run)
const [mods = '', seed = String(Date.now() % 1e9), limit = '900'] = process.argv.slice(2);
const cfg = {
  v: 1,
  date: new Date().toISOString().slice(0, 10),
  seed: Number(seed) >>> 0,
  mods: mods.split(',').map((s) => s.trim()).filter(Boolean),
  limit: Number(limit),
  run: 'test',
};
console.log('?flash=' + Buffer.from(JSON.stringify(cfg), 'utf8').toString('base64url'));
