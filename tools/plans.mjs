// The weekly planner's tool: fills, checks and uploads FlashGames day plans. Plans are secret until their day, so
// plan files live outside git (C:\Users\<you>\.flashgames\plans\) and go straight to the server.
//
//   node tools/plans.mjs list                     what the server has planned (and how many played each day)
//   node tools/plans.mjs check  <plans.json>      fill each plan from the games' live flash.json and check it
//   node tools/plans.mjs upload <plans.json>      check, then upload
//   node tools/plans.mjs mods   [game]            the modifiers each game publishes right now
//
// Options: --local (the dev server on :3031 with key "dev-admin", flash.json from the dev mirror on :5177),
//          --server <url>, --site <url> (where flash.json is read, default https://josephjackman.com).
// The admin key comes from FG_ADMIN_TOKEN or %USERPROFILE%\.flashgames\admin-token.
//
// A plan file is a JSON array (or { "plans": [...] }) of short plans:
//   { "date": "2026-11-30", "game": "dungeonjoe", "mods": ["glass", "turbo"], "title": "…", "blurb": "…",
//     "params": { … optional … }, "seed": 123 (optional, random if left out) }
// `check` turns each into the full plan the server stores (game name, tagline, goal, scoring, path, maxScore,
// and every modifier's name and text, all taken from the game's flash.json).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
};
const local = !!flag('local');
const SERVER = String(flag('server') || (local ? 'http://localhost:3031' : 'https://shoallhell.fly.dev')).replace(/\/$/, '');
const SITE = String(flag('site') || (local ? 'http://localhost:5177' : 'https://josephjackman.com')).replace(/\/$/, '');
const [command, file] = args;

function adminKey() {
  if (local) return process.env.FG_ADMIN_TOKEN || 'dev-admin';
  if (process.env.FG_ADMIN_TOKEN) return process.env.FG_ADMIN_TOKEN;
  const f = path.join(os.homedir(), '.flashgames', 'admin-token');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  throw new Error(`No admin key: set FG_ADMIN_TOKEN or put it in ${f}`);
}

async function admin(method, p, body) {
  const r = await fetch(`${SERVER}/games/shoallhell/api${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Flash-Admin': adminKey() },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${data.error || ''}`);
  return data;
}

const rotation = JSON.parse(fs.readFileSync(path.join(here, '..', 'rotation.json'), 'utf8'));
const inRotation = (id) => rotation.games.find((g) => g.id === id);

const flashCache = new Map();
async function flashJson(id) {
  if (flashCache.has(id)) return flashCache.get(id);
  const g = inRotation(id);
  const p = g?.path || `/games/${id}/`;
  const url = `${SITE}${p}flash.json?t=${Date.now()}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${id}: no flash.json at ${url} (${r.status}). Is the game's FlashGames mode deployed?`);
  const j = await r.json();
  flashCache.set(id, { ...j, path: p });
  return flashCache.get(id);
}

function readPlans(f) {
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  return Array.isArray(raw) ? raw : raw.plans;
}

/** short plans -> full plans, with every problem found */
async function fill(short) {
  const problems = [];
  const warnings = [];
  const full = [];
  const sorted = [...short].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const [i, p] of sorted.entries()) {
    const where = p.date || `plan ${i + 1}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) problems.push(`${where}: bad date`);
    const id = typeof p.game === 'string' ? p.game : p.game?.id;
    if (!inRotation(id)) problems.push(`${where}: "${id}" is not in rotation.json`);
    let fj;
    try {
      fj = await flashJson(id);
    } catch (e) {
      problems.push(`${where}: ${e.message}`);
      continue;
    }
    const mods = (p.mods || []).map((m) => (typeof m === 'string' ? m : m.id));
    const [min, max] = fj.pick || [2, 3];
    if (mods.length < min || mods.length > max) warnings.push(`${where}: ${mods.length} modifiers (${id} suggests ${min}-${max})`);
    const byId = new Map(fj.modifiers.map((m) => [m.id, m]));
    for (const m of mods) if (!byId.has(m)) problems.push(`${where}: ${id} has no modifier "${m}" live`);
    for (const a of mods)
      for (const b of mods) {
        if (a >= b) continue;
        if (byId.get(a)?.excludes?.includes(b) || byId.get(b)?.excludes?.includes(a)) problems.push(`${where}: "${a}" and "${b}" exclude each other`);
      }
    if (new Set(mods).size !== mods.length) problems.push(`${where}: a modifier twice`);
    if (!p.title) problems.push(`${where}: no title`);
    // the day before, if this file plans it (the file can skip days, or hold days a week apart)
    const prev = sorted[i - 1];
    const dayBefore = new Date(Date.parse(`${p.date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    if (prev && prev.date === dayBefore && (typeof prev.game === 'string' ? prev.game : prev.game?.id) === id) warnings.push(`${where}: ${id} two days running`);
    full.push({
      date: p.date,
      title: p.title,
      blurb: p.blurb || '',
      game: { id, name: fj.name, tagline: fj.tagline || '', goal: fj.goal || '', scoring: fj.scoring || '', path: fj.path, maxScore: fj.maxScore || 1e9 },
      mods: mods.map((m) => ({ id: m, name: byId.get(m)?.name || m, text: byId.get(m)?.text || '' })),
      ...(p.params ? { params: p.params } : {}),
      ...(p.seed != null ? { seed: p.seed } : {}),
    });
  }
  return { full, problems, warnings };
}

async function main() {
  if (command === 'list') {
    const r = await admin('GET', '/fg/admin/plans');
    console.log(`Today (US Central): ${r.today}`);
    for (const p of r.plans) console.log(`${p.date}  ${String(p.game).padEnd(15)} ${(p.mods || []).join(', ').padEnd(36)} ${p.encore ? `(encore of ${p.encore}) ` : ''}${p.title}  · ${p.players} played, ${p.runs} runs${p.top != null ? `, top ${p.top}` : ''}`);
    return;
  }
  if (command === 'mods') {
    const ids = file ? [file] : rotation.games.map((g) => g.id);
    for (const id of ids) {
      try {
        const j = await flashJson(id);
        console.log(`\n${id} (${j.name}): pick ${JSON.stringify(j.pick)}, ${j.modifiers.length} modifiers`);
        for (const m of j.modifiers) console.log(`  ${m.id.padEnd(16)} ${m.name}: ${m.text}${m.excludes?.length ? `  [excludes ${m.excludes.join(', ')}]` : ''}`);
      } catch (e) {
        console.log(`\n${id}: ${e.message}`);
      }
    }
    return;
  }
  if (command === 'check' || command === 'upload') {
    if (!file) throw new Error(`usage: node tools/plans.mjs ${command} <plans.json>`);
    const { full, problems, warnings } = await fill(readPlans(file));
    for (const w of warnings) console.log(`warning: ${w}`);
    for (const p of problems) console.log(`PROBLEM: ${p}`);
    if (problems.length) process.exit(1);
    for (const p of full) console.log(`ok ${p.date}  ${p.game.id.padEnd(15)} ${p.mods.map((m) => m.name).join(' + ')}  "${p.title}"`);
    if (command === 'check') return;
    const r = await admin('PUT', '/fg/admin/plans', { plans: full });
    console.log(`uploaded: ${r.stored.join(', ') || 'nothing'}`);
    for (const x of r.refused) console.log(`REFUSED ${x.date}: ${x.error}`);
    if (r.refused.length) process.exit(1);
    return;
  }
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 18).join('\n'));
  process.exit(command ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
