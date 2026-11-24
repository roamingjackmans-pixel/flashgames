import './style.css';
import { ApiError, api, getToken, setToken, type DayRecord, type FriendsView, type Plan, type Profile, type Row, type Today } from './api';
import { RunController } from './run';
import { fmtClock, fmtDay, fmtScore, fmtShort, fmtUntil, h, MEDAL_ICON, ordinal, yearGrid } from './util';

declare const __GAME_VERSION__: string;

const app = document.getElementById('app')!;
let today: Today | null = null;
let clockSkew = 0; // server time minus this computer's time
let friends: FriendsView | null = null;
let homeTimers: number[] = [];
const serverNow = (): number => Date.now() + clockSkew;

function clearHomeTimers(): void {
  for (const t of homeTimers) clearInterval(t);
  homeTimers = [];
}

function toast(text: string, bad = false): void {
  const t = h('div.toast', { class: bad ? 'bad' : '' }, text);
  document.body.append(t);
  setTimeout(() => t.classList.add('gone'), 3200);
  setTimeout(() => t.remove(), 3800);
}

async function loadToday(): Promise<Today> {
  const t = await api.today();
  clockSkew = t.serverNow - Date.now();
  today = t;
  return t;
}

// ------------------------------------------------------------------ sign in

function logo(): HTMLElement {
  return h('div.logo', h('span.bolt', '⚡'), h('span.word', 'FLASH'), h('span.word.two', 'GAMES'));
}

function modStickers(plan: Plan, small = false): HTMLElement {
  return h(
    'div.mods',
    { class: small ? 'small' : '' },
    ...plan.mods.map((m, i) => h('div.mod', { class: `c${i % 4}` }, h('div.mod-name', m.name), small ? null : h('div.mod-text', m.text))),
  );
}

function signIn(): void {
  clearHomeTimers();
  let mode: 'in' | 'up' = 'in';
  const err = h('div.err');
  const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'email', required: true });
  const pass = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', required: true, minlength: 8 });
  const name = h('input', { type: 'text', placeholder: 'Name on the board', maxlength: 24, autocomplete: 'nickname' });
  const nameRow = h('label.field.name-row', 'Name', name);
  const submit = h('button.btn.big', { type: 'submit' }, 'Sign in');
  const swap = h('button.link', { type: 'button' }, 'New here? Make an account');
  const setMode = (m: 'in' | 'up'): void => {
    mode = m;
    nameRow.hidden = m === 'in';
    submit.textContent = m === 'in' ? 'Sign in' : 'Make my account';
    swap.textContent = m === 'in' ? 'New here? Make an account' : 'Have an account? Sign in';
    pass.setAttribute('autocomplete', m === 'in' ? 'current-password' : 'new-password');
    err.textContent = '';
  };
  swap.addEventListener('click', () => setMode(mode === 'in' ? 'up' : 'in'));
  const form = h(
    'form.signin',
    {
      onsubmit: async (ev: Event) => {
        ev.preventDefault();
        err.textContent = '';
        submit.disabled = true;
        try {
          const r = mode === 'in' ? await api.login(email.value, pass.value) : await api.signup(email.value, pass.value, name.value);
          setToken(r.token);
          await home();
        } catch (e) {
          err.textContent = e instanceof Error ? e.message : 'Something went wrong.';
        } finally {
          submit.disabled = false;
        }
      },
    },
    h('h2', 'Sign in to play'),
    h('p.muted', 'The same account as Shoallhell, Smash Your Bros and Baker’s Dozen, with the same friends.'),
    h('label.field', 'Email', email),
    h('label.field', 'Password', pass),
    nameRow,
    err,
    submit,
    swap,
  );
  setMode('in');
  const preview = h('div.preview');
  app.replaceChildren(h('div.page.signin-page', h('header.top', logo()), h('main.signin-wrap', h('section.pitch', h('h1', 'One game. One day. Fifteen minutes.'), h('p', 'Every day FlashGames turns one of Joseph’s games into a 15-minute speedrun with a few crazy rules. Everyone plays the same run. Beat your friends for the day, collect medals, and come back tomorrow for something new.'), preview), form)));
  void api
    .today()
    .then((t) => {
      if (!t.plan) return;
      preview.append(h('div.label', `Today · ${fmtDay(t.date)}`), h('div.preview-game', t.plan.game.name), h('div.preview-title', t.plan.title), modStickers(t.plan, true));
    })
    .catch(() => undefined);
}

// ------------------------------------------------------------------ home

function boardTable(rows: Row[], opts: { medals?: boolean; empty: string; onPick?: (r: Row) => void }): HTMLElement {
  if (!rows.length) return h('div.empty', opts.empty);
  return h(
    'ol.board',
    ...rows.map((r) =>
      h(
        'li.row',
        { class: `${r.me ? 'me' : ''} p${Math.min(r.place, 4)}`, onclick: opts.onPick && !r.me ? () => opts.onPick!(r) : undefined, title: r.me ? undefined : `See ${r.name}’s year` },
        h('span.place', opts.medals && r.medal ? MEDAL_ICON[r.medal] : ordinal(r.place)),
        h('span.who', h('span.name', r.name), h('span.detail', r.detail || '')),
        h('span.score', fmtScore(r.score)),
      ),
    ),
  );
}

function yearView(p: Profile): HTMLElement {
  const byDate = new Map<string, DayRecord>(p.days.map((d) => [d.date, d]));
  const cells = yearGrid(p.today);
  const grid = h('div.year');
  for (const c of cells) {
    const d = byDate.get(c.date);
    const cls = c.future ? 'future' : d ? (d.medal ?? (d.place == null && c.date === p.today ? 'live' : 'played')) : 'none';
    const day = c.date.slice(0, 4) === p.today.slice(0, 4) ? fmtDay(c.date) : `${fmtDay(c.date)}, ${c.date.slice(0, 4)}`;
    const tip = d ? `${day} · ${d.name || d.game} · ${fmtScore(d.score)}${d.place ? ` · ${ordinal(d.place)} of ${d.of}` : c.date === p.today ? ' · today' : ''}` : day;
    grid.append(h('i', { class: `${cls}${c.date === p.today ? ' today' : ''}`, title: tip, style: `grid-column:${c.col + 1};grid-row:${c.row + 1}` }));
  }
  const wrap = h('div.year-wrap', grid);
  // newest week in view on narrow screens
  requestAnimationFrame(() => (wrap.scrollLeft = wrap.scrollWidth));
  return h('div', wrap, h('div.legend', h('i.none'), 'no run', h('i.played'), 'played', h('i.bronze'), '3rd', h('i.silver'), '2nd', h('i.gold'), '1st'));
}

function shelf(p: Profile): HTMLElement {
  const m = p.stats.medals;
  return h(
    'div.shelf',
    h('div.trophies', h('div.trophy.gold', h('b', String(m.gold)), h('span', '🥇 1st')), h('div.trophy.silver', h('b', String(m.silver)), h('span', '🥈 2nd')), h('div.trophy.bronze', h('b', String(m.bronze)), h('span', '🥉 3rd'))),
    h('div.counts', h('span', h('b', String(p.stats.played)), ' days played'), h('span', h('b', String(p.stats.streak)), ' day streak')),
    yearView(p),
  );
}

async function showProfile(userId: string, name: string): Promise<void> {
  const body = h('div.modal-body', h('div.muted', 'Loading…'));
  const close = (): void => modal.remove();
  const modal: HTMLDivElement = h('div.modal', { onclick: (e: Event) => e.target === modal && close() }, h('div.modal-card', h('button.x', { onclick: close, 'aria-label': 'Close' }, '✕'), h('h2', name), body));
  document.body.append(modal);
  try {
    const p = await api.profile(userId);
    body.replaceChildren(
      shelf(p),
      h('h3', 'Recent days'),
      p.days.length
        ? h('ol.recent', ...p.days.slice(0, 14).map((d) => h('li', h('span.when', fmtShort(d.date)), h('span.what', d.title || d.name), h('span.score', fmtScore(d.score)), h('span.place', d.medal ? MEDAL_ICON[d.medal] : d.place ? ordinal(d.place) : ''))))
        : h('div.empty', 'No runs yet.'),
    );
  } catch (e) {
    body.replaceChildren(h('div.err', e instanceof Error ? e.message : 'Could not load.'));
  }
}

function friendsPanel(view: FriendsView, rerender: () => void): HTMLElement {
  const code = h('input', { inputmode: 'numeric', placeholder: 'Friend code', maxlength: 6, 'aria-label': 'Friend code' });
  const add = async (ev: Event): Promise<void> => {
    ev.preventDefault();
    try {
      const r = await api.addFriend(code.value);
      friends = r.view;
      toast(r.friends ? 'You’re friends now.' : 'Request sent. It shows up for them next time they look.');
      rerender();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add.', true);
    }
  };
  const act = (fn: () => Promise<{ view: FriendsView }>) => async () => {
    try {
      friends = (await fn()).view;
      rerender();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not do that.', true);
    }
  };
  return h(
    'section.panel.friends',
    h('h2', 'Friends'),
    h('p.muted', 'Your friend code is ', h('b.code', view.code), '. Same friends as Shoallhell, Smash Your Bros and Baker’s Dozen.'),
    h('form.add', { onsubmit: add }, code, h('button.btn.small', { type: 'submit' }, 'Add')),
    view.incoming.length
      ? h('div.reqs', h('h3', 'Asking to be friends'), ...view.incoming.map((f) => h('div.req', h('span', f.name), h('button.btn.small', { onclick: act(() => api.acceptFriend(f.id)) }, 'Accept'), h('button.link', { onclick: act(() => api.removeFriend(f.id)) }, 'No thanks'))))
      : null,
    view.outgoing.length ? h('p.muted.small', `Waiting on: ${view.outgoing.map((f) => f.name).join(', ')}`) : null,
    view.friends.length
      ? h('ul.flist', ...view.friends.map((f) => h('li', h('button.link', { onclick: () => void showProfile(f.id, f.name) }, f.name), h('span.muted.small', `#${f.code}`))))
      : h('div.empty', 'No friends yet. Swap codes to compete for the day.'),
  );
}

async function home(): Promise<void> {
  clearHomeTimers();
  if (!getToken()) return signIn();
  app.replaceChildren(h('div.page', h('header.top', logo()), h('main.loading', 'Loading today’s run…')));
  let t: Today;
  let me: Profile | null = null;
  try {
    [t, me, friends] = await Promise.all([loadToday(), api.profile(), api.friends()]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setToken('');
      return signIn();
    }
    app.replaceChildren(h('div.page', h('header.top', logo()), h('main.loading', h('div.err', e instanceof Error ? e.message : 'Could not load.'), h('button.btn', { onclick: () => void home() }, 'Try again'))));
    return;
  }
  renderHome(t, me);
  // the board changes as friends play; the day changes at midnight
  homeTimers.push(
    window.setInterval(async () => {
      try {
        const before = today?.date;
        const next = await loadToday();
        if (next.date !== before) return void home();
        const fresh = await api.profile();
        renderHome(next, fresh);
      } catch {
        /* keep what is on screen */
      }
    }, 30_000),
  );
}

function renderHome(t: Today, me: Profile): void {
  const plan = t.plan;
  const countdown = h('span.count', '');
  const tickCountdown = (): void => {
    const left = t.endsAt - serverNow();
    countdown.textContent = left > 0 ? `New run in ${fmtUntil(left)}` : 'New run now';
    if (left <= 0) void home();
  };
  clearHomeTimers();
  homeTimers.push(window.setInterval(tickCountdown, 1000));
  tickCountdown();

  const rerender = (): void => renderHome(today ?? t, me);
  const mine = t.me;
  const hero = plan
    ? h(
        'section.hero',
        h('div.ribbon', h('span', `Today · ${fmtDay(t.date)}`), countdown),
        h('div.game-name', plan.game.name),
        h('div.tagline', plan.game.tagline),
        h('h1.day-title', plan.title),
        plan.encore ? h('p.encore', `Encore of ${fmtDay(plan.encore)}: same game and rules, new seed.`) : null,
        plan.blurb ? h('p.blurb', plan.blurb) : null,
        modStickers(plan),
        h('div.rules', h('div', h('b', 'Goal: '), plan.game.goal), h('div', h('b', 'Scoring: '), plan.game.scoring)),
        h(
          'div.play-row',
          h('button.btn.play', { onclick: () => void startRun(plan) }, h('span', 'PLAY'), h('small', '15:00')),
          h('div.mine', mine?.best != null ? [h('div.label', 'Your best today'), h('div.best', fmtScore(mine.best)), h('div.muted.small', `${mine.detail ? `${mine.detail} · ` : ''}${mine.runs} run${mine.runs === 1 ? '' : 's'}`)] : h('div.muted', 'No run yet today. Play as often as you like: your best counts.')),
        ),
      )
    : h('section.hero.none', h('div.ribbon', h('span', `Today · ${fmtDay(t.date)}`), countdown), h('h1.day-title', 'No run today'), h('p', 'Today’s run hasn’t been set up. Check back after midnight (US Central).'));

  const boardPanel = h(
    'section.panel.today-board',
    h('h2', 'Today vs your friends'),
    h('div.muted.small', `${t.players} ${t.players === 1 ? 'player' : 'players'} on the server today`),
    boardTable(t.board ?? [], { empty: 'Nobody here has played yet. Be first.', onPick: (r) => void showProfile(r.userId, r.name) }),
  );
  const y = t.yesterday;
  const yPanel = y
    ? h(
        'section.panel.yesterday',
        h('h2', `Yesterday · ${fmtShort(y.date)}`),
        h('div.y-title', h('b', y.plan.game.name), ` · ${y.plan.title}`),
        modStickers(y.plan, true),
        boardTable(y.board, { medals: true, empty: 'Nobody here played yesterday.', onPick: (r) => void showProfile(r.userId, r.name) }),
      )
    : null;

  const nameBtn = h('button.link.me-name', { title: 'Change your name', onclick: async () => {
    const n = prompt('Your name on the boards', me.user.name);
    if (!n || !n.trim()) return;
    try {
      await api.rename(n.trim());
      me = { ...me, user: { ...me.user, name: n.trim() } };
      rerender();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not rename.', true);
    }
  } }, me.user.name);

  app.replaceChildren(
    h(
      'div.page',
      h('header.top', logo(), h('div.who-am-i', nameBtn, h('button.link', { onclick: async () => {
        try {
          await api.logout();
        } catch {
          /* signed out here anyway */
        }
        setToken('');
        signIn();
      } }, 'Sign out'))),
      h('main.home', h('div.col.main-col', hero, h('section.panel.mine-panel', h('h2', 'Your trophy shelf'), shelf(me))), h('div.col.side-col', boardPanel, yPanel, friends ? friendsPanel(friends, rerender) : null)),
      h('footer.foot', `FlashGames ${__GAME_VERSION__} · One run a day, as many tries as you like, best score counts. Days change at midnight US Central.`),
    ),
  );
}

// ------------------------------------------------------------------ the run

async function startRun(plan: Plan): Promise<void> {
  if (!today) return;
  let start;
  try {
    start = await api.startRun(today.date);
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      toast('A new day started. Here’s today’s run.');
      return void home();
    }
    return toast(e instanceof Error ? e.message : 'Could not start a run.', true);
  }
  clearHomeTimers();
  const frame = h('iframe.game', { src: `${start.path}?flash=${start.flash}`, allow: 'autoplay; fullscreen; gamepad; clipboard-write', title: plan.game.name });
  const timer = h('div.timer', fmtClock(start.limit * 1000));
  const score = h('div.run-score', '0');
  const detail = h('div.run-detail', '');
  const overlay = h('div.overlay', h('div.ov-card', h('div.ov-big', 'Loading…'), h('div.muted', plan.game.name)));
  const endBtn = h('button.btn.small.ghost', { onclick: () => {
    if (ctl.phase === 'running' && !confirm('End this run now? Your score so far counts.')) return;
    if (ctl.phase === 'loading' || ctl.phase === 'countdown' || ctl.phase === 'failed') return leave();
    ctl.stop('quit');
  } }, 'End run');
  let raf = 0;
  const leave = (): void => {
    cancelAnimationFrame(raf);
    window.removeEventListener('message', onMsg);
    window.removeEventListener('beforeunload', guard);
    void home();
  };
  const guard = (e: BeforeUnloadEvent): void => {
    if (ctl.phase === 'running' || ctl.phase === 'ending') e.preventDefault();
  };
  const draw = (): void => {
    score.textContent = fmtScore(ctl.score);
    detail.textContent = ctl.detail;
    if (ctl.phase === 'countdown') {
      const n = Math.max(1, Math.ceil((ctl.countdownEnds - Date.now()) / 1000));
      overlay.hidden = false;
      overlay.replaceChildren(h('div.ov-card.count', h('div.ov-num', String(n)), modStickers(plan, true)));
    } else if (ctl.phase === 'running') {
      overlay.hidden = true;
    } else if (ctl.phase === 'ending') {
      overlay.hidden = false;
      overlay.replaceChildren(h('div.ov-card', h('div.ov-big', ctl.reason === 'quit' ? 'Run ended' : 'TIME!')));
    } else if (ctl.phase === 'done') {
      overlay.hidden = false;
      const word = ctl.reason === 'won' ? 'YOU BEAT IT!' : ctl.reason === 'dead' ? 'RUN OVER' : ctl.reason === 'quit' ? 'Run ended' : 'TIME!';
      const card = h('div.ov-card.result', h('div.ov-big', word), h('div.label', 'Final score'), h('div.final', fmtScore(ctl.score)), h('div.muted', ctl.detail), h('div.saving.muted.small', ctl.saved ? 'Saved to today’s board.' : 'Saving…'), h('div.ov-btns', h('button.btn.big', { onclick: () => {
        leave();
        void startAgain(plan);
      } }, 'Run it again'), h('button.btn.ghost', { onclick: leave }, 'Back to the board')));
      overlay.replaceChildren(card);
      void api
        .today()
        .then((t2) => {
          const mine = t2.board?.find((r) => r.me);
          if (mine) card.insertBefore(h('div.placing', `Today’s best ${fmtScore(mine.score)} · ${ordinal(mine.place)} of ${t2.board!.length} among your friends`), card.querySelector('.ov-btns'));
        })
        .catch(() => undefined);
    } else if (ctl.phase === 'failed') {
      overlay.hidden = false;
      overlay.replaceChildren(h('div.ov-card', h('div.ov-big', 'Oops'), h('div.err', ctl.error), h('div.ov-btns', h('button.btn', { onclick: leave }, 'Back to the board'))));
    }
  };
  const ctl = new RunController(
    {
      post: (m) => frame.contentWindow?.postMessage({ ...m, flash: 1 }, '*'),
      go: async () => {
        await api.go(start.run);
        frame.focus();
        frame.contentWindow?.focus();
      },
      save: (s, d, final) => api.score(start.run, s, d, final),
      now: () => Date.now(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeout: (t) => window.clearTimeout(t as number),
      changed: draw,
    },
    start.limit,
  );
  const onMsg = (ev: MessageEvent): void => {
    if (ev.source === frame.contentWindow) ctl.message(ev.data);
  };
  window.addEventListener('message', onMsg);
  window.addEventListener('beforeunload', guard);
  const loop = (): void => {
    ctl.tick();
    const left = ctl.timeLeft();
    timer.textContent = fmtClock(left);
    timer.classList.toggle('hurry', ctl.phase === 'running' && left < 60_000);
    if (ctl.phase === 'countdown') draw();
    raf = requestAnimationFrame(loop);
  };
  app.replaceChildren(
    h(
      'div.run',
      h('header.run-bar', h('div.run-game', h('span.bolt', '⚡'), h('b', plan.game.name), modStickers(plan, true)), timer, h('div.run-right', h('div.run-scores', score, detail), endBtn)),
      h('div.stage', frame, overlay),
    ),
  );
  raf = requestAnimationFrame(loop);
}

async function startAgain(plan: Plan): Promise<void> {
  try {
    await loadToday();
  } catch {
    /* try with what we have */
  }
  if (today?.plan && today.plan.date === plan.date) void startRun(today.plan);
}

void home();
