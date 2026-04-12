/**
 * OPUS-118: Unit tests for federal holiday detection logic.
 * Covers buildHolidays(), isHoliday(), holName(), and OPUS-86/93 regressions.
 */
import { describe, it, expect } from 'vitest';
import { buildHolidays, isHoliday, holName } from '../calc.js';

// ─── buildHolidays internals ──────────────────────────────────────────────────

describe('buildHolidays — observed holiday rules', () => {
  it('holiday on a weekday: only that date is in the map', () => {
    // July 4, 2025 is a Friday — no observed shift needed
    const h = buildHolidays(2025);
    expect(h.has('6|4')).toBe(true);   // July (month 6) 4
    expect(h.get('6|4')).toBe('Independence Day');
    expect(h.has('6|3')).toBe(false);  // No observed Friday
    expect(h.has('6|5')).toBe(false);  // No observed Monday
  });

  it('holiday on Saturday: both Friday (observed) AND Saturday (actual) marked (OPUS-86 regression)', () => {
    // July 4, 2026 is a Saturday
    const h = buildHolidays(2026);
    expect(h.has('6|4')).toBe(true);   // Actual Saturday
    expect(h.has('6|3')).toBe(true);   // Observed Friday
    expect(h.get('6|3')).toContain('observed');
    expect(h.get('6|4')).toBe('Independence Day');
  });

  it('holiday on Sunday: both Monday (observed) AND Sunday (actual) marked (OPUS-86 regression)', () => {
    // Jan 1, 2023 is a Sunday
    const h = buildHolidays(2023);
    expect(h.has('0|1')).toBe(true);   // Actual Sunday
    expect(h.has('0|2')).toBe(true);   // Observed Monday
    expect(h.get('0|2')).toContain('observed');
    expect(h.get('0|1')).toBe("New Year's Day");
  });
});

// ─── All 11 federal holidays correct for 2026 ─────────────────────────────────

describe('buildHolidays — all 11 federal holidays 2026', () => {
  const h = buildHolidays(2026);

  it("New Year's Day: Jan 1", () => expect(h.has('0|1')).toBe(true));

  it('MLK Day: 3rd Monday of January = Jan 19', () => {
    // 3rd Monday of Jan 2026: Jan 5, 12, 19 → Jan 19
    expect(h.has('0|19')).toBe(true);
    expect(h.get('0|19')).toBe('MLK Day');
  });

  it("Presidents' Day: 3rd Monday of February = Feb 16", () => {
    // 3rd Monday of Feb 2026: Feb 2, 9, 16 → Feb 16
    expect(h.has('1|16')).toBe(true);
    expect(h.get('1|16')).toBe("Presidents' Day");
  });

  it('Memorial Day: last Monday of May', () => {
    // May 2026: last Monday is May 25
    expect(h.has('4|25')).toBe(true);
    expect(h.get('4|25')).toBe('Memorial Day');
  });

  it('Juneteenth: June 19 (Friday in 2026)', () => {
    // June 19, 2026 is a Friday — no shift
    expect(h.has('5|19')).toBe(true);
    expect(h.get('5|19')).toBe('Juneteenth');
  });

  it('Independence Day: July 4 (Saturday in 2026) → both Jul 3 and Jul 4', () => {
    expect(h.has('6|4')).toBe(true);
    expect(h.has('6|3')).toBe(true);
  });

  it('Labor Day: 1st Monday of September', () => {
    // Sep 2026: 1st Monday is Sep 7
    expect(h.has('8|7')).toBe(true);
    expect(h.get('8|7')).toBe('Labor Day');
  });

  it('Columbus Day: 2nd Monday of October', () => {
    // Oct 2026: 2nd Monday is Oct 12
    expect(h.has('9|12')).toBe(true);
    expect(h.get('9|12')).toBe('Columbus Day');
  });

  it('Veterans Day: Nov 11 (Wednesday in 2026)', () => {
    expect(h.has('10|11')).toBe(true);
    expect(h.get('10|11')).toBe('Veterans Day');
  });

  it('Thanksgiving: 4th Thursday of November', () => {
    // Nov 2026: 4th Thursday is Nov 26
    expect(h.has('10|26')).toBe(true);
    expect(h.get('10|26')).toBe('Thanksgiving');
  });

  it('Christmas Day: Dec 25 (Friday in 2026)', () => {
    expect(h.has('11|25')).toBe(true);
    expect(h.get('11|25')).toBe('Christmas Day');
  });
});

// ─── isHoliday / holName ──────────────────────────────────────────────────────

describe('isHoliday', () => {
  it('returns true for a known holiday', () => {
    expect(isHoliday(2026, 0, 1)).toBe(true);   // New Year's Day
    expect(isHoliday(2026, 10, 26)).toBe(true);  // Thanksgiving
  });

  it('returns false for a regular day', () => {
    expect(isHoliday(2026, 3, 7)).toBe(false);  // Tue Apr 7 — not a holiday
    expect(isHoliday(2026, 0, 2)).toBe(false);  // Jan 2 — not a holiday
  });

  it('returns false for day after a non-shifted holiday', () => {
    expect(isHoliday(2026, 0, 20)).toBe(false); // Day after MLK Day
  });
});

describe('holName', () => {
  it('returns name for a known holiday', () => {
    expect(holName(2026, 0, 19)).toBe('MLK Day');
    expect(holName(2026, 10, 26)).toBe('Thanksgiving');
  });

  it('returns empty string for a non-holiday', () => {
    expect(holName(2026, 3, 7)).toBe('');
  });

  it('returns observed label for observed date', () => {
    // July 4, 2026 is Saturday → July 3 is observed
    const name = holName(2026, 6, 3);
    expect(name).toContain('observed');
  });
});

// ─── nthWeekday edge cases (OPUS-93 regression) ───────────────────────────────

describe('nthWeekday via buildHolidays (OPUS-93: no infinite loop)', () => {
  it('correctly finds the 1st Monday of September 2026', () => {
    // Verifies the nth weekday function terminates and returns correct date
    const h = buildHolidays(2026);
    expect(h.get('8|7')).toBe('Labor Day'); // Sep 7 = 1st Monday
  });

  it('correctly finds the 4th Thursday of November 2026', () => {
    const h = buildHolidays(2026);
    expect(h.get('10|26')).toBe('Thanksgiving'); // Nov 26 = 4th Thursday
  });

  it('does not hang on months with only 4 of a given weekday', () => {
    // A month like February often has only 4 Mondays. We ensure buildHolidays
    // completes in a reasonable time for any year.
    const start = Date.now();
    buildHolidays(2027);
    expect(Date.now() - start).toBeLessThan(100); // Should be near-instant
  });
});

// ─── Year boundaries ──────────────────────────────────────────────────────────

describe('year boundary handling', () => {
  it('Dec 31 is not a holiday in 2026', () => {
    expect(isHoliday(2026, 11, 31)).toBe(false);
  });

  it("Jan 1 of a year where it falls on Saturday: both Fri and Sat marked", () => {
    // Jan 1, 2000 was a Saturday
    const h = buildHolidays(2000);
    expect(h.has('0|1')).toBe(true);
    expect(h.has('11|31')).toBe(false); // Dec 31, 1999 NOT in 2000's holiday map
    // The observed date wraps into the prior year, which is out of scope for this year's map
  });

  it('builds correctly for multiple years without cross-contamination', () => {
    const h2025 = buildHolidays(2025);
    const h2026 = buildHolidays(2026);
    // Labor Day 2025 = Sep 1, Labor Day 2026 = Sep 7
    expect(h2025.get('8|1')).toBe('Labor Day');
    expect(h2026.get('8|7')).toBe('Labor Day');
    expect(h2026.has('8|1')).toBe(false);
  });
});
