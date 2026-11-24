// Small helpers: an element builder and the formatting the page uses (pure functions, unit tested).

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, string | number | boolean | ((ev: Event) => void) | undefined | null>;
type Tag<T extends string> = T extends `${infer N}.${string}` ? N : T;
type El<T extends string> = Tag<T> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[Tag<T>] : HTMLElement;

/** h('div.card.big', { onclick }, 'text', child) */
export function h<T extends string>(tag: T, attrs?: Attrs | Child, ...kids: Child[]): El<T> {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name!) as El<T>;
  if (classes.length) el.className = classes.join(' ');
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs) && !(attrs instanceof Node)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className += (el.className ? ' ' : '') + String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  } else if (attrs !== undefined) kids.unshift(attrs as Child);
  const add = (k: Child): void => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k instanceof Node ? k : String(k));
  };
  kids.forEach(add);
  return el;
}

export const fmtScore = (n: number): string => Math.floor(n).toLocaleString('en-US');

/** 14:59 (or 1:02:03 for an hour or more) */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
}

/** "5 h 12 min", "12 min", "under a minute" */
export function fmtUntil(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'under a minute';
  const hh = Math.floor(m / 60);
  return hh ? `${hh} h ${m % 60} min` : `${m} min`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const parse = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};
/** "Tuesday, Nov 24" */
export const fmtDay = (date: string): string => {
  const d = parse(date);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
/** "Nov 24" */
export const fmtShort = (date: string): string => {
  const d = parse(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
export const shiftDay = (date: string, days: number): string => {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export const weekday = (date: string): number => parse(date).getUTCDay();

export const ordinal = (n: number): string => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

export const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' } as const;

export interface GridCell {
  date: string;
  /** 0 Sunday .. 6 Saturday (the row) */
  row: number;
  /** week column, 0 = the oldest */
  col: number;
  future: boolean;
}

/**
 * The year grid: 53 week columns of 7 days ending with the week that holds `today` (Sunday-first rows), like a
 * contributions calendar.
 */
export function yearGrid(today: string, weeks = 53): GridCell[] {
  const lastSunday = shiftDay(today, -weekday(today));
  const first = shiftDay(lastSunday, -7 * (weeks - 1));
  const cells: GridCell[] = [];
  for (let c = 0; c < weeks; c++)
    for (let r = 0; r < 7; r++) {
      const date = shiftDay(first, c * 7 + r);
      cells.push({ date, row: r, col: c, future: date > today });
    }
  return cells;
}

/** encode the ?flash= value the same way the server does (base64url of UTF-8 JSON) */
export function encodeFlash(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
