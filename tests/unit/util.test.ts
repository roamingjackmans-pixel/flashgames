import { describe, expect, it } from 'vitest';
import { encodeFlash, fmtClock, fmtDay, fmtUntil, ordinal, shiftDay, yearGrid } from '../../src/util';

describe('formatting', () => {
  it('clock, places, days', () => {
    expect(fmtClock(900_000)).toBe('15:00');
    expect(fmtClock(59_001)).toBe('1:00');
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(3_723_000)).toBe('1:02:03');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 112].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '112th']);
    expect(fmtDay('2026-11-24')).toBe('Tuesday, Nov 24');
    expect(fmtUntil(5 * 3600_000 + 12 * 60_000 + 5000)).toBe('5 h 12 min');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('the year grid ends with the week of today, Sunday first', () => {
    const cells = yearGrid('2026-11-24');
    expect(cells).toHaveLength(53 * 7);
    const today = cells.find((c) => c.date === '2026-11-24')!;
    expect(today.col).toBe(52);
    expect(today.row).toBe(2); // Tuesday
    expect(cells.filter((c) => c.future).map((c) => c.date)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']);
    expect(cells[0]!.date).toBe('2025-11-23');
  });

  it('encodes ?flash= like the server (base64url JSON)', () => {
    const obj = { v: 1, mods: ['glass'], title: 'Joe’s day' };
    expect(JSON.parse(Buffer.from(encodeFlash(obj), 'base64url').toString('utf8'))).toEqual(obj);
  });
});
