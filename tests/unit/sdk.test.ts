// sdk/flash-run.js in a fake window: reading ?flash=, scores, the end of time, and the parent messages.
import fs from 'node:fs';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SDK = fs.readFileSync(new URL('../../sdk/flash-run.js', import.meta.url), 'utf8');
const code = (cfg: unknown): string => Buffer.from(JSON.stringify(cfg), 'utf8').toString('base64url');

interface Fake {
  win: Record<string, any>;
  sent: Record<string, any>[];
  fire(msg: unknown): void;
}
function load(search: string, withParent = true): Fake {
  const sent: Record<string, any>[] = [];
  const listeners: ((ev: { source: unknown; data: unknown }) => void)[] = [];
  const parent = { postMessage: (m: Record<string, any>) => sent.push(m) };
  const win: Record<string, any> = {
    location: { search },
    addEventListener: (t: string, fn: (ev: { source: unknown; data: unknown }) => void) => t === 'message' && listeners.push(fn),
  };
  win.parent = withParent ? parent : win;
  const ctx = vm.createContext({ window: win, URLSearchParams, atob, TextDecoder, setTimeout, clearTimeout, Date, console, Math, JSON, Number, String, Promise, Uint8Array, Array });
  vm.runInContext(SDK, ctx);
  return { win, sent, fire: (data) => listeners.forEach((fn) => fn({ source: parent, data })) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('flash-run.js', () => {
  it('is inactive without ?flash=', () => {
    const { win } = load('');
    expect(win.FlashRun.active).toBe(false);
    expect(win.FlashRun.has('x')).toBe(false);
  });

  it('reads the day, seed and modifiers', () => {
    const { win } = load(`?flash=${code({ v: 1, date: '2026-11-24', seed: 77, mods: ['glass', 'turbo'], limit: 900, run: 'r1' })}`);
    const F = win.FlashRun;
    expect(F.active).toBe(true);
    expect(F.date).toBe('2026-11-24');
    expect(F.seed).toBe(77);
    expect(F.has('glass')).toBe(true);
    expect(F.has('nope')).toBe(false);
    const a = F.rng('map');
    const b = F.rng('map');
    expect([a(), a()]).toEqual([b(), b()]);
    expect(F.rng('loot')()).not.toBe(F.rng('map')());
  });

  it('runs: ready, go, scores that only go up, then time', async () => {
    const f = load(`?flash=${code({ v: 1, date: 'd', seed: 1, mods: [], limit: 60 })}`);
    const F = f.win.FlashRun;
    let ended = 0;
    F.onEnd(() => ended++);
    const ready = F.ready();
    expect(f.sent).toEqual([{ type: 'ready', flash: 1 }]);
    expect(F.running()).toBe(false);
    f.fire({ flash: 1, type: 'go' });
    await ready;
    expect(F.running()).toBe(true);
    F.score(100, 'a');
    F.score(50, 'b'); // never goes down
    vi.advanceTimersByTime(300);
    F.score(200, 'c');
    vi.advanceTimersByTime(300);
    const scores = f.sent.filter((m) => m.type === 'score');
    expect(scores.map((m) => [m.score, m.detail])).toEqual([
      [100, 'a'],
      [100, 'b'],
      [200, 'c'],
    ]);
    expect(F.best()).toBe(200);
    f.fire({ flash: 1, type: 'end' });
    expect(ended).toBe(1);
    expect(f.sent.at(-1)).toEqual({ type: 'over', score: 200, detail: 'c', reason: 'time', flash: 1 });
    F.score(999);
    F.over(999, 'late', 'won');
    expect(f.sent.filter((m) => m.type === 'over')).toHaveLength(1);
    expect(F.best()).toBe(200);
  });

  it('ignores messages from anything but the parent', () => {
    const f = load(`?flash=${code({ v: 1, date: 'd', seed: 1, mods: [], limit: 60 })}`);
    void f.win.FlashRun.ready();
    // the fake only delivers the parent's messages; one without flash: 1 does nothing
    f.fire({ type: 'go' });
    expect(f.win.FlashRun.running()).toBe(false);
  });

  it('starts by itself and ends at the limit when opened on its own', async () => {
    const f = load(`?flash=${code({ v: 1, date: 'd', seed: 1, mods: [], limit: 30 })}`, false);
    const F = f.win.FlashRun;
    const p = F.ready();
    vi.advanceTimersByTime(1000);
    await p;
    expect(F.running()).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(F.isOver()).toBe(true);
  });

  it('the test game uses the same SDK as sdk/', () => {
    expect(fs.readFileSync(new URL('../fixtures/fg-test/flash-run.js', import.meta.url), 'utf8')).toBe(SDK);
  });
});
