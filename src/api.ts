// Accounts, friends and the daily boards on Shoallhell's server (shared accounts: the same email and password work
// in every game, and signing in to one signs you in to the others on josephjackman.com). The server address comes
// from config.json next to the page ("" = same site, i.e. the Vite proxy in development).
export interface User {
  id: string;
  email?: string;
  name: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
let server = '';
let serverP: Promise<string> | null = null;

/**
 * Where the server is. Every call shares one look at config.json: the page asks the server several things at once
 * when it opens, and a call that went ahead before the address arrived would ask josephjackman.com itself (a 404).
 */
export function serverBase(): Promise<string> {
  serverP ??= (async () => {
    try {
      const r = await fetch(`${BASE}/config.json`, { cache: 'no-store' });
      if (r.ok) server = String((await r.json()).server || '').replace(/\/$/, '');
    } catch {
      /* same origin */
    }
    return server;
  })();
  return serverP;
}

/** the same key Shoallhell uses, so one sign-in covers every game (?slot=N keeps a separate sign-in, for testing) */
const SLOT = new URLSearchParams(location.search).get('slot');
const TOKEN_KEY = SLOT ? `shoallhell.token.slot${SLOT}` : 'shoallhell.token';

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
export function setToken(t: string): void {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private window */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = await serverBase();
  const headers: Record<string, string> = {};
  const tok = getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${base}/games/shoallhell/api${path}`, { method, headers, cache: 'no-store', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  } catch {
    throw new ApiError('Can’t reach the server. Check your connection.', 0);
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) throw new ApiError(String(data.error || `Server error (${res.status}).`), res.status, data);
  return data as T;
}

export interface Mod {
  id: string;
  name: string;
  text: string;
}
export interface Plan {
  date: string;
  title: string;
  blurb: string;
  game: { id: string; name: string; tagline: string; goal: string; scoring: string; path: string };
  mods: Mod[];
  encore: string | null;
}
export interface Row {
  userId: string;
  name: string;
  score: number;
  detail: string;
  runs: number;
  place: number;
  me: boolean;
  medal?: Medal | null;
}
export type Medal = 'gold' | 'silver' | 'bronze';
export interface Stats {
  medals: Record<Medal, number>;
  played: number;
  streak: number;
}
export interface Today {
  date: string;
  serverNow: number;
  endsAt: number;
  limit: number;
  plan: Plan | null;
  players: number;
  board?: Row[];
  me?: { id: string; name: string; best: number | null; detail: string; runs: number };
  yesterday?: { date: string; plan: Plan; players: number; board: Row[] };
  stats?: Stats;
}
export interface DayRecord {
  date: string;
  score: number;
  detail: string;
  game: string;
  name: string;
  title: string;
  place?: number;
  of?: number;
  medal?: Medal | null;
}
export interface Profile {
  user: { id: string; name: string };
  stats: Stats;
  days: DayRecord[];
  today: string;
}
export interface FriendInfo {
  id: string;
  name: string;
  code: string;
  online?: boolean;
}
export interface FriendsView {
  code: string;
  friends: FriendInfo[];
  incoming: FriendInfo[];
  outgoing: FriendInfo[];
}
export interface RunStart {
  run: string;
  date: string;
  limit: number;
  path: string;
  flash: string;
}

export const api = {
  signup: (email: string, password: string, name: string) => call<{ token: string; user: User }>('POST', '/signup', { email, password, name }),
  login: (email: string, password: string) => call<{ token: string; user: User }>('POST', '/login', { email, password }),
  logout: () => call<{ ok: boolean }>('POST', '/logout', {}),
  rename: (name: string) => call<{ ok: boolean; user: User }>('POST', '/name', { name }),
  today: () => call<Today>('GET', '/fg/today'),
  profile: (userId?: string) => call<Profile>('GET', `/fg/profile${userId ? `?user=${encodeURIComponent(userId)}` : ''}`),
  startRun: (date: string) => call<RunStart>('POST', '/fg/runs', { date }),
  go: (run: string) => call<{ ok: boolean; startedAt: number; endsAt: number }>('POST', `/fg/runs/${run}/go`, {}),
  score: (run: string, score: number, detail: string, final: boolean) => call<{ ok: boolean; best: number }>('POST', `/fg/runs/${run}/score`, { score, detail, final }),
  friends: () => call<FriendsView>('GET', '/friends'),
  addFriend: (code: string) => call<{ ok: boolean; friends: boolean; view: FriendsView }>('POST', '/friends/add', { code }),
  acceptFriend: (id: string) => call<{ ok: boolean; view: FriendsView }>('POST', '/friends/accept', { id }),
  removeFriend: (id: string) => call<{ ok: boolean; view: FriendsView }>('POST', '/friends/remove', { id }),
};
