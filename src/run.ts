// One run: the game in an iframe, FlashGames' clock, and the score going to the server as it changes.
// The controller is plain logic (no DOM) so it can be tested; the run screen in main.ts draws its state.
//
//   starting -> loading (iframe, waiting for the game's 'ready') -> countdown (3-2-1) -> running (clock, scores)
//   -> ending (told the game time is up, waiting for its final score) -> done
export type Phase = 'loading' | 'countdown' | 'running' | 'ending' | 'done' | 'failed';
export type EndReason = 'time' | 'won' | 'dead' | 'quit';

export interface RunDeps {
  /** send a message to the game window */
  post(msg: Record<string, unknown>): void;
  /** the server: start the clock, save the score */
  go(): Promise<unknown>;
  save(score: number, detail: string, final: boolean): Promise<unknown>;
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(t: unknown): void;
  /** the state changed (draw it) */
  changed(): void;
}

export const COUNTDOWN_MS = 3000;
export const LOAD_TIMEOUT_MS = 90_000;
const SYNC_MS = 4000;
const END_WAIT_MS = 2500;

export class RunController {
  phase: Phase = 'loading';
  score = 0;
  detail = '';
  reason: EndReason | null = null;
  error = '';
  /** when the countdown ends (countdown) or the clock ends (running) */
  countdownEnds = 0;
  endsAt = 0;
  saved = false;
  /** the clock when the run stopped (the timer freezes there) */
  private leftAtStop = 0;
  private synced = -1;
  private syncTimer: unknown = null;
  private endTimer: unknown = null;
  private loadTimer: unknown;

  constructor(
    private deps: RunDeps,
    public limitS: number,
  ) {
    this.loadTimer = deps.setTimeout(() => {
      if (this.phase === 'loading') this.fail('The game didn’t load. Check your connection and try again.');
    }, LOAD_TIMEOUT_MS);
  }

  /** a message from the game window (already checked to be from it) */
  message(m: unknown): void {
    if (!m || typeof m !== 'object' || (m as { flash?: number }).flash !== 1) return;
    const msg = m as { type?: string; score?: unknown; detail?: unknown; reason?: unknown };
    if (msg.type === 'ready' && this.phase === 'loading') {
      this.deps.clearTimeout(this.loadTimer);
      this.phase = 'countdown';
      this.countdownEnds = this.deps.now() + COUNTDOWN_MS;
      this.deps.changed();
      this.deps.setTimeout(() => void this.start(), COUNTDOWN_MS);
    } else if (msg.type === 'score' && (this.phase === 'running' || this.phase === 'ending')) {
      this.take(msg.score, msg.detail);
      this.deps.changed();
    } else if (msg.type === 'over' && (this.phase === 'running' || this.phase === 'ending')) {
      this.take(msg.score, msg.detail);
      const r = msg.reason;
      void this.finish(this.phase === 'ending' ? (this.reason ?? 'time') : r === 'won' || r === 'dead' ? r : 'time');
    }
  }

  private take(score: unknown, detail: unknown): void {
    const s = Math.floor(Number(score));
    if (Number.isFinite(s) && s > this.score) this.score = s;
    if (typeof detail === 'string' && detail) this.detail = detail.slice(0, 120);
  }

  private async start(): Promise<void> {
    if (this.phase !== 'countdown') return;
    try {
      await this.deps.go();
    } catch (e) {
      return this.fail(e instanceof Error ? e.message : 'The server didn’t start the run.');
    }
    this.phase = 'running';
    this.endsAt = this.deps.now() + this.limitS * 1000;
    this.deps.post({ type: 'go' });
    this.deps.changed();
    this.loopSync();
  }

  /** ms left on the clock */
  timeLeft(): number {
    if (this.phase === 'running') return Math.max(0, this.endsAt - this.deps.now());
    if (this.phase === 'loading' || this.phase === 'countdown') return this.limitS * 1000;
    return this.leftAtStop;
  }

  /** call often (every animation frame or 250 ms): ends the run when the clock runs out */
  tick(): void {
    if (this.phase === 'running' && this.deps.now() >= this.endsAt) this.stop('time');
  }

  /** time is up, or the player ended the run: tell the game and wait a moment for its final score */
  stop(reason: EndReason): void {
    if (this.phase === 'loading' || this.phase === 'countdown') {
      this.deps.post({ type: 'end' });
      this.reason = reason;
      this.phase = 'done';
      this.deps.changed();
      return;
    }
    if (this.phase !== 'running') return;
    this.leftAtStop = Math.max(0, this.endsAt - this.deps.now());
    this.phase = 'ending';
    this.reason = reason;
    this.deps.post({ type: 'end' });
    this.deps.changed();
    this.endTimer = this.deps.setTimeout(() => void this.finish(reason), END_WAIT_MS);
  }

  private loopSync(): void {
    this.syncTimer = this.deps.setTimeout(() => {
      if (this.phase !== 'running') return;
      if (this.score !== this.synced) {
        const s = this.score;
        this.deps.save(s, this.detail, false).then(
          () => (this.synced = Math.max(this.synced, s)),
          () => undefined,
        );
      }
      this.loopSync();
    }, SYNC_MS);
  }

  private async finish(reason: EndReason): Promise<void> {
    if (this.phase === 'done' || this.phase === 'failed') return;
    if (this.phase === 'running') this.leftAtStop = Math.max(0, this.endsAt - this.deps.now());
    if (this.endTimer) this.deps.clearTimeout(this.endTimer);
    if (this.syncTimer) this.deps.clearTimeout(this.syncTimer);
    this.phase = 'done';
    this.reason = reason;
    this.deps.changed();
    for (let i = 0; i < 4; i++) {
      try {
        await this.deps.save(this.score, this.detail, true);
        this.saved = true;
        break;
      } catch (e) {
        // the clock ran out on the server (only happens on a very slow connection): the last saved score counts
        if ((e as { status?: number }).status === 410 || (e as { status?: number }).status === 404) break;
        await new Promise((r) => this.deps.setTimeout(() => r(null), 1500 * (i + 1)));
      }
    }
    this.deps.changed();
  }

  private fail(message: string): void {
    this.phase = 'failed';
    this.error = message;
    this.deps.changed();
  }
}
