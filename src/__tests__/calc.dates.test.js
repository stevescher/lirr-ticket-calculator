/**
 * OPUS-121: Unit tests for stale date handling and month boundary edge cases.
 * Covers initViewMonth(), leap year detection, and month navigation logic.
 */
import { describe, it, expect } from 'vitest';
import { initViewMonth, dateKey, isWeekend, isTWT } from '../calc.js';

// ─── initViewMonth ────────────────────────────────────────────────────────────

describe('initViewMonth', () => {
  it('1st of month → shows current month', () => {
    const result = initViewMonth(new Date(2026, 3, 1)); // Apr 1
    expect(result).toEqual({ year: 2026, month: 3 });
  });

  it('15th of month → shows current month', () => {
    const result = initViewMonth(new Date(2026, 3, 15)); // Apr 15
    expect(result).toEqual({ year: 2026, month: 3 });
  });

  it('16th of month → shows next month', () => {
    const result = initViewMonth(new Date(2026, 3, 16)); // Apr 16
    expect(result).toEqual({ year: 2026, month: 4 }); // May
  });

  it('31st of month → shows next month', () => {
    const result = initViewMonth(new Date(2026, 2, 31)); // Mar 31
    expect(result).toEqual({ year: 2026, month: 3 }); // April
  });

  it('December 20 → shows January of next year (OPUS-92 related: year wrap)', () => {
    const result = initViewMonth(new Date(2026, 11, 20)); // Dec 20
    expect(result).toEqual({ year: 2027, month: 0 }); // Jan 2027
  });

  it('December 15 → shows December (no wrap)', () => {
    const result = initViewMonth(new Date(2026, 11, 15)); // Dec 15
    expect(result).toEqual({ year: 2026, month: 11 });
  });

  it('December 1 → shows December (no wrap)', () => {
    const result = initViewMonth(new Date(2026, 11, 1)); // Dec 1
    expect(result).toEqual({ year: 2026, month: 11 });
  });

  it('January 16 → shows February (no year underflow)', () => {
    const result = initViewMonth(new Date(2026, 0, 16)); // Jan 16
    expect(result).toEqual({ year: 2026, month: 1 }); // Feb
  });
});

// ─── Month length / leap year ─────────────────────────────────────────────────

describe('month length and leap year', () => {
  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  it('April has 30 days', () => expect(daysInMonth(2026, 3)).toBe(30));
  it('March has 31 days', () => expect(daysInMonth(2026, 2)).toBe(31));
  it('February 2026 (non-leap) has 28 days', () => expect(daysInMonth(2026, 1)).toBe(28));
  it('February 2028 (leap year) has 29 days', () => expect(daysInMonth(2028, 1)).toBe(29));
  it('February 2100 (not a leap year) has 28 days', () => expect(daysInMonth(2100, 1)).toBe(28));
  it('February 2000 (divisible by 400, is a leap year) has 29 days', () => expect(daysInMonth(2000, 1)).toBe(29));
});

// ─── Day-of-week helpers ──────────────────────────────────────────────────────

describe('isWeekend', () => {
  it('Sunday (0) is weekend', () => expect(isWeekend(0)).toBe(true));
  it('Monday (1) is not weekend', () => expect(isWeekend(1)).toBe(false));
  it('Tuesday (2) is not weekend', () => expect(isWeekend(2)).toBe(false));
  it('Wednesday (3) is not weekend', () => expect(isWeekend(3)).toBe(false));
  it('Thursday (4) is not weekend', () => expect(isWeekend(4)).toBe(false));
  it('Friday (5) is not weekend', () => expect(isWeekend(5)).toBe(false));
  it('Saturday (6) is weekend', () => expect(isWeekend(6)).toBe(true));
});

describe('isTWT', () => {
  it('Tuesday (2) is TWT', () => expect(isTWT(2)).toBe(true));
  it('Wednesday (3) is TWT', () => expect(isTWT(3)).toBe(true));
  it('Thursday (4) is TWT', () => expect(isTWT(4)).toBe(true));
  it('Monday (1) is not TWT', () => expect(isTWT(1)).toBe(false));
  it('Friday (5) is not TWT', () => expect(isTWT(5)).toBe(false));
  it('Saturday (6) is not TWT', () => expect(isTWT(6)).toBe(false));
  it('Sunday (0) is not TWT', () => expect(isTWT(0)).toBe(false));
});

// ─── dateKey ──────────────────────────────────────────────────────────────────

describe('dateKey', () => {
  it('formats as y|m|d with no zero-padding', () => {
    expect(dateKey(2026, 3, 15)).toBe('2026|3|15');
    expect(dateKey(2026, 0, 1)).toBe('2026|0|1');
    expect(dateKey(2026, 11, 31)).toBe('2026|11|31');
  });

  it('round-trips through split/map', () => {
    const key = dateKey(2026, 3, 7);
    const [y, m, d] = key.split('|').map(Number);
    expect(y).toBe(2026);
    expect(m).toBe(3);
    expect(d).toBe(7);
  });
});

// ─── Calendar month structure ─────────────────────────────────────────────────

describe('calendar month structure', () => {
  function buildCalendarDays(year, month) {
    const days = [];
    const daysIn = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysIn; d++) {
      days.push({ d, dow: new Date(year, month, d).getDay() });
    }
    return days;
  }

  it('April 2026 starts on Wednesday (dow 3)', () => {
    expect(new Date(2026, 3, 1).getDay()).toBe(3);
  });

  it('April 2026 ends on Thursday (dow 4)', () => {
    expect(new Date(2026, 3, 30).getDay()).toBe(4);
  });

  it('April 2026 has exactly 22 weekdays', () => {
    const days = buildCalendarDays(2026, 3);
    const weekdays = days.filter(({ dow }) => !isWeekend(dow));
    expect(weekdays).toHaveLength(22);
  });

  it('April 2026 has 8 weekend days (4 Sat + 4 Sun)', () => {
    const days = buildCalendarDays(2026, 3);
    const weekendDays = days.filter(({ dow }) => isWeekend(dow));
    expect(weekendDays).toHaveLength(8);
  });

  it('December 2026 → January 2027 navigation: month wraps correctly', () => {
    let year = 2026, month = 11;
    month++;
    if (month > 11) { month = 0; year++; }
    expect(month).toBe(0);
    expect(year).toBe(2027);
  });

  it('January 2026 → December 2025 navigation: year decrements correctly', () => {
    let year = 2026, month = 0;
    month--;
    if (month < 0) { month = 11; year--; }
    expect(month).toBe(11);
    expect(year).toBe(2025);
  });

  it('February 2028 (leap) has 29 days, all accessible via dateKey', () => {
    const daysIn = new Date(2028, 2, 0).getDate(); // days in Feb 2028
    expect(daysIn).toBe(29);
    // Day 29 can be encoded as a dateKey
    expect(dateKey(2028, 1, 29)).toBe('2028|1|29');
  });

  it('past-day detection: Apr 7 is past when today is Apr 15 in current month', () => {
    const today = new Date(2026, 3, 15);
    const isCurMon = true; // simulating current month
    const pastDay = new Date(2026, 3, 7);
    expect(isCurMon && pastDay < today).toBe(true);
  });

  it('past-day detection: days in future month are never past', () => {
    const today = new Date(2026, 3, 15);
    const futureMonthDay = new Date(2026, 4, 1); // May 1
    const isCurMon = false; // viewing a different month
    expect(isCurMon && futureMonthDay < today).toBe(false);
  });

  it('past-day detection: Apr 15 is not past when today is Apr 15', () => {
    const today = new Date(2026, 3, 15);
    today.setHours(0, 0, 0, 0);
    const sameDay = new Date(2026, 3, 15);
    sameDay.setHours(0, 0, 0, 0);
    expect(sameDay < today).toBe(false); // today is not "past"
  });
});
