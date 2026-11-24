// The run controller: countdown, the server clock start, scores saved while playing, the end of time, the final save.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COUNTDOWN_MS, RunController } from '../../src/run';

function setup(limit = 60) {
  const posted: Record<string, unknown>[] = [];
  const saves: [number, string, boolean][] = [];
  const deps = {
    post: (m: Record<string, unknown>) => posted.push(m),
    go: vi.fn(async () => ({ ok: true })),
    save: vi.fn(async (s: number, d: string, f: boolean) => {
      saves.push([s, d, f]);
      return { ok: true };
    }),
    now: () => Date.now(),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (t: unknown) => clearTimeout(t as ReturnType<typeof setTimeout>),
    changed: () => undefined,
  };
  return { ctl: new RunController(deps, limit), posted, saves, deps };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RunController', () => {
  it('counts down after ready, starts the server clock, then tells the game to go', async () => {
    const { ctl, posted, deps } = setup();
    ctl.message({ flash: 1, type: 'ready' });
    expect(ctl.phase).toBe('countdown');
    await vi.advanceTimersByTimeAsync(COUNTDOWN_MS);
    expect(deps.go).toHaveBeenCalledOnce();
    expect(ctl.phase).toBe('running');
    expect(posted).toEqual([{ type: 'go' }]);
  });

  it('saves the score as it goes and once more at the end of time', async () => {
    const { ctl, posted, saves } = setup(60);
    ctl.message({ flash: 1, type: 'ready' });
    await vi.advanceTimersByTimeAsync(COUNTDOWN_MS);
    ctl.message({ flash: 1, type: 'score', score: 40, detail: '4 clicks' });
    ctl.message({ flash: 1, type: 'score', score: 30, detail: 'lower' }); // ignored: lower
    await vi.advanceTimersByTimeAsync(4100);
    expect(saves).toEqual([[40, 'lower', false]]);
    await vi.advanceTimersByTimeAsync(60_000);
    ctl.tick();
    expect(ctl.phase).toBe('ending');
    expect(posted.at(-1)).toEqual({ type: 'end' });
    ctl.message({ flash: 1, type: 'over', score: 90, detail: '9 clicks', reason: 'time' });
    await vi.advanceTimersByTimeAsync(0);
    expect(ctl.phase).toBe('done');
    expect(ctl.reason).toBe('time');
    expect(saves.at(-1)).toEqual([90, '9 clicks', true]);
    expect(ctl.saved).toBe(true);
  });

  it('finishes early when the game ends the run, and keeps the last score if the game stays quiet at the end', async () => {
    const a = setup();
    a.ctl.message({ flash: 1, type: 'ready' });
    await vi.advanceTimersByTimeAsync(COUNTDOWN_MS);
    a.ctl.message({ flash: 1, type: 'over', score: 70, detail: 'died', reason: 'dead' });
    await vi.advanceTimersByTimeAsync(0);
    expect(a.ctl.reason).toBe('dead');
    expect(a.saves.at(-1)).toEqual([70, 'died', true]);

    const b = setup();
    b.ctl.message({ flash: 1, type: 'ready' });
    await vi.advanceTimersByTimeAsync(COUNTDOWN_MS);
    b.ctl.message({ flash: 1, type: 'score', score: 20, detail: 'x' });
    b.ctl.stop('quit');
    await vi.advanceTimersByTimeAsync(3000);
    expect(b.ctl.phase).toBe('done');
    expect(b.ctl.reason).toBe('quit');
    expect(b.saves.at(-1)).toEqual([20, 'x', true]);
  });

  it('fails when the game never loads, and ignores scores before the go', async () => {
    const { ctl, saves } = setup();
    ctl.message({ flash: 1, type: 'score', score: 500 });
    expect(ctl.score).toBe(0);
    await vi.advanceTimersByTimeAsync(91_000);
    expect(ctl.phase).toBe('failed');
    expect(saves).toEqual([]);
  });
});
