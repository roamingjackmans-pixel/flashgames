// FlashGames end to end with the stand-in game (tests/fixtures/fg-test): plan today, sign up, play, end the run,
// see the score on the board; a friend plays and dies; both see each other.
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SERVER_PORT } from '../../playwright.config';

const API = `http://localhost:${SERVER_PORT}/games/shoallhell/api`;

async function admin(method: string, p: string, body?: unknown): Promise<Record<string, any>> {
  const r = await fetch(`${API}${p}`, { method, headers: { 'Content-Type': 'application/json', 'X-Flash-Admin': ADMIN }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return r.json();
}

async function signUp(page: Page, name: string): Promise<void> {
  await page.goto('/games/flashgames/');
  await page.getByRole('button', { name: 'New here? Make an account' }).click();
  await page.getByPlaceholder('Email').fill(`${name.toLowerCase()}@e2e.test`);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByPlaceholder('Name on the board').fill(name);
  await page.getByRole('button', { name: 'Make my account' }).click();
  await expect(page.locator('.game-name')).toHaveText('Test Game');
}

async function play(page: Page, clicks: number, finish: 'end' | 'die'): Promise<void> {
  await page.locator('.btn.play').click();
  const game = page.frameLocator('iframe.game');
  await expect(game.locator('#state')).toHaveText('waiting');
  await expect(page.locator('.ov-num')).toBeVisible();
  await expect(game.locator('#state')).toHaveText('running', { timeout: 10_000 });
  await expect(game.locator('#mods')).toContainText('big, wobble');
  for (let i = 0; i < clicks; i++) await game.locator('#add').click();
  await expect(page.locator('.run-score')).toHaveText(String(clicks * 100).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  if (finish === 'end') {
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'End run' }).click();
    await expect(page.locator('.ov-big')).toHaveText('Run ended');
  } else {
    await game.locator('#die').click();
    await expect(page.locator('.ov-big')).toHaveText('RUN OVER');
  }
  await expect(page.locator('.final')).toHaveText(String(clicks * 100));
  await expect(page.locator('.saving')).toHaveText('Saved to today’s board.');
  await page.getByRole('button', { name: 'Back to the board' }).click();
}

test('plan, play, board, friends', async ({ browser }) => {
  const today = (await (await fetch(`${API}/fg/today`)).json()).date as string;
  const up = await admin('PUT', '/fg/admin/plans', {
    plans: [
      {
        date: today,
        title: 'Test Tuesday',
        blurb: 'Clicking, but louder.',
        game: { id: 'fg-test', name: 'Test Game', tagline: 'A stand-in', goal: 'Click.', scoring: '100 a click with Big.', path: '/games/fg-test/', maxScore: 100000 },
        mods: [
          { id: 'big', name: 'Big Clicks', text: 'Every click is 100.' },
          { id: 'wobble', name: 'Wobble', text: 'Does nothing.' },
        ],
      },
    ],
  });
  expect(up.stored).toEqual([today]);

  const a = await (await browser.newContext()).newPage();
  await signUp(a, 'Ann');
  await expect(a.locator('.mod-name')).toHaveText(['Big Clicks', 'Wobble']);
  await play(a, 3, 'end');
  await expect(a.locator('.today-board .row.me .score')).toHaveText('300');
  await expect(a.locator('.mine .best')).toHaveText('300');
  await expect(a.locator('.year i.today')).toHaveClass(/live/);
  const annCode = (await a.locator('.friends .code').textContent())!.trim();

  const b = await (await browser.newContext()).newPage();
  await signUp(b, 'Bob');
  await b.getByPlaceholder('Friend code').fill(annCode);
  await b.getByRole('button', { name: 'Add', exact: true }).click();
  await a.reload();
  await a.getByRole('button', { name: 'Accept' }).click();
  await expect(a.locator('.flist')).toContainText('Bob');
  await b.reload();
  await expect(b.locator('.today-board .row')).toHaveCount(1);
  await play(b, 5, 'die');
  await expect(b.locator('.today-board .row .name')).toHaveText(['Bob', 'Ann']);
  await expect(b.locator('.today-board .row.me .place')).toHaveText('1st');
  await a.reload();
  await expect(a.locator('.today-board .row .name')).toHaveText(['Bob', 'Ann']);
  // a friend's year
  await a.locator('.today-board .row', { hasText: 'Bob' }).click();
  await expect(a.locator('.modal-card h2')).toHaveText('Bob');
  await expect(a.locator('.modal .recent li')).toContainText(['Test Tuesday']);
  await a.screenshot({ path: 'test-results/e2e-home.png', fullPage: true });
  await a.locator('.modal .x').click();

  // the next two days: Ann plays the second alone (Bob is her friend but doesn't play), which is 1st and a gold
  const day = async (): Promise<Record<string, any>> => (await fetch(`${API}/fg/today`)).json();
  const nextDayAt1am = async (): Promise<void> => {
    await admin('POST', '/fg/admin/clock', { now: (await day()).endsAt + 60 * 60_000 });
  };
  const second = (await day()).date as string;
  const plan2 = (date: string, title: string) => ({ date, title, game: { id: 'fg-test', name: 'Test Game', goal: 'Click.', scoring: '100 a click with Big.', path: '/games/fg-test/', maxScore: 100000 }, mods: [{ id: 'big', name: 'Big Clicks', text: 'Every click is 100.' }, { id: 'wobble', name: 'Wobble', text: 'Does nothing.' }] });
  await nextDayAt1am();
  const d2 = (await day()).date as string;
  expect(d2 > second).toBe(true);
  expect((await admin('PUT', '/fg/admin/plans', { plans: [plan2(d2, 'Solo Wednesday')] })).stored).toEqual([d2]);
  await a.reload();
  await expect(a.locator('.past .past-when')).toContainText('Yesterday');
  await expect(a.locator('.past .y-title')).toContainText('Test Tuesday');
  await expect(a.locator('.past .row .name')).toHaveText(['Bob', 'Ann']);
  await expect(a.locator('.past .row .place')).toHaveText(['🥇', '🥈']);
  await play(a, 2, 'end');
  await nextDayAt1am();
  await a.reload();
  await expect(a.locator('.past .y-title')).toContainText('Solo Wednesday');
  await expect(a.locator('.past .row .name')).toHaveText(['Ann']);
  await expect(a.locator('.past .row .place')).toHaveText(['🥇']);
  await expect(a.locator('.trophy.gold b')).toHaveText('1');
  await expect(a.locator('.trophy.silver b')).toHaveText('1');
  // step back through the days played, and open one from the year
  await a.getByRole('button', { name: 'An earlier day' }).click();
  await expect(a.locator('.past .y-title')).toContainText('Test Tuesday');
  await expect(a.getByRole('button', { name: 'An earlier day' })).toBeDisabled();
  await a.getByRole('button', { name: 'A later day' }).click();
  await expect(a.locator('.past .y-title')).toContainText('Solo Wednesday');
  await expect(a.locator('.year i.go')).toHaveCount(2);
  await expect(a.locator('.year i.go').first()).toHaveClass(/silver/);
  await expect(a.locator('.year i.go').last()).toHaveClass(/gold/);
  await a.locator('.year i.go').first().click();
  await expect(a.locator('.past .y-title')).toContainText('Test Tuesday');
  await a.screenshot({ path: 'test-results/e2e-past.png', fullPage: true });
});
