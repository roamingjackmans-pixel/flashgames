// The page asks the server three things at once when it opens: all three must wait for config.json (the server's
// address). Before the fix the second and third went to the page's own site and got a 404.
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('api', () => {
  it('sends the first calls to the server from config.json, even when they go at once', async () => {
    vi.stubGlobal('location', { search: '' });
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        if (url.endsWith('/config.json')) {
          await new Promise((r) => setTimeout(r, 20));
          return new Response(JSON.stringify({ server: 'https://srv.test/' }), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      }),
    );
    const { api } = await import('../../src/api');
    await Promise.all([api.today(), api.profile(), api.friends()]);
    await api.today();
    expect(urls.filter((u) => u.endsWith('/config.json'))).toHaveLength(1);
    expect(urls.filter((u) => !u.endsWith('/config.json'))).toEqual([
      'https://srv.test/games/shoallhell/api/fg/today',
      'https://srv.test/games/shoallhell/api/fg/profile',
      'https://srv.test/games/shoallhell/api/friends',
      'https://srv.test/games/shoallhell/api/fg/today',
    ]);
  });
});
