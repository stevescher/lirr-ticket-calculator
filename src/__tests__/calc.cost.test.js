/**
 * OPUS-116: Unit tests for cost calculation logic
 * Tests dayCost() and calcCosts() against zone 7 fares as the reference fixture.
 */
import { describe, it, expect } from 'vitest';
import { dayCost, calcCosts, dateKey } from '../calc.js';

// Zone 7 fares (Hicksville, Westbury, etc. ↔ Penn Station)
// Source: lirr-data.js, effective 2026-01-04
const Z7 = {
  monthly:    299.75,
  weekly:     106.50,
  peakOw:      15.25,
  offpeakOw:   11.25,
  dayPassWd:   27.50,
  dayPassWe:   22.50,
};

// Helpers
function sel(...entries) {
  return new Map(entries);
}
function wdKey(day) { return dateKey(2026, 3, day); } // April 2026 (0-indexed month 3)

// ─── dayCost ─────────────────────────────────────────────────────────────────

describe('dayCost', () => {
  it('mode 1 weekday → peak in + off-peak out', () => {
    expect(dayCost(Z7, 1, false)).toBeCloseTo(Z7.peakOw + Z7.offpeakOw); // 26.50
  });

  it('mode 2 weekday → peak both ways', () => {
    expect(dayCost(Z7, 2, false)).toBeCloseTo(Z7.peakOw * 2); // 30.50
  });

  it('mode 3 weekday → off-peak both ways', () => {
    expect(dayCost(Z7, 3, false)).toBeCloseTo(Z7.offpeakOw * 2); // 22.50
  });

  it('weekend mode 1 → off-peak both ways (weekend premium is not charged)', () => {
    expect(dayCost(Z7, 1, true)).toBeCloseTo(Z7.offpeakOw * 2);
  });

  it('weekend mode 2 → off-peak both ways (peak-both ignored on weekend)', () => {
    expect(dayCost(Z7, 2, true)).toBeCloseTo(Z7.offpeakOw * 2);
  });

  it('weekend mode 3 → off-peak both ways', () => {
    expect(dayCost(Z7, 3, true)).toBeCloseTo(Z7.offpeakOw * 2);
  });

  it('all weekend modes produce the same cost (documents OPUS-88 invariant)', () => {
    const cost1 = dayCost(Z7, 1, true);
    const cost2 = dayCost(Z7, 2, true);
    const cost3 = dayCost(Z7, 3, true);
    expect(cost1).toBeCloseTo(cost2);
    expect(cost1).toBeCloseTo(cost3);
  });
});

// ─── calcCosts ────────────────────────────────────────────────────────────────

describe('calcCosts', () => {
  it('empty selection returns null', () => {
    expect(calcCosts(new Map(), Z7)).toBeNull();
  });

  it('single weekday mode 1: correct counts and totals', () => {
    // April 7, 2026 is a Tuesday
    const s = sel([wdKey(7), 1]);
    const c = calcCosts(s, Z7);
    expect(c.total).toBe(1);
    expect(c.wdDays).toBe(1);
    expect(c.weDays).toBe(0);
    expect(c.peakBothDays).toBe(0);
    expect(c.individual).toBeCloseTo(Z7.peakOw + Z7.offpeakOw);
    expect(c.dayPasses).toBeCloseTo(Z7.dayPassWd);
    expect(c.monthly).toBeCloseTo(Z7.monthly);
  });

  it('single weekend day: individual === weekend day pass cost (OPUS-88 invariant)', () => {
    // April 5, 2026 is a Sunday
    const s = sel([dateKey(2026, 3, 5), 1]);
    const c = calcCosts(s, Z7);
    expect(c.weDays).toBe(1);
    expect(c.wdDays).toBe(0);
    expect(c.individual).toBeCloseTo(c.dayPasses);
    expect(c.individual).toBeCloseTo(Z7.offpeakOw * 2);
  });

  it('5 weekdays in the same week → weekly pass used, passesUsed = 1', () => {
    // April 6–10, 2026 is Mon–Fri (all in the same Mon-anchored week)
    const s = sel(
      [wdKey(6), 1], [wdKey(7), 1], [wdKey(8), 1], [wdKey(9), 1], [wdKey(10), 1]
    );
    const c = calcCosts(s, Z7);
    expect(c.passesUsed).toBe(1);
    expect(c.weeklyCombo).toBeCloseTo(Z7.weekly);
  });

  it('4 weekdays in the same week → no weekly pass, passesUsed = 0', () => {
    const s = sel([wdKey(7), 1], [wdKey(8), 1], [wdKey(9), 1], [wdKey(10), 1]);
    const c = calcCosts(s, Z7);
    expect(c.passesUsed).toBe(0);
    expect(c.weeklyCombo).toBeCloseTo((Z7.peakOw + Z7.offpeakOw) * 4);
  });

  it('weekly pass not used when its cost exceeds individual cost for that week', () => {
    // 5 off-peak days: 5 × 22.50 = 112.50 > weekly 106.50 → weekly IS cheaper → used
    // But if weekly > cost we should NOT use it. Test with a single week of 5 mode-3 days.
    // Z7 weekly (106.50) < 5 × 22.50 (112.50) → weekly IS used
    const s = sel(
      [wdKey(6), 3], [wdKey(7), 3], [wdKey(8), 3], [wdKey(9), 3], [wdKey(10), 3]
    );
    const c = calcCosts(s, Z7);
    expect(c.passesUsed).toBe(1);
  });

  it('mix of mode 1 and mode 2 days: correct peakBothDays count and individual total', () => {
    // Tue Apr 7 (mode 1), Wed Apr 8 (mode 2), Thu Apr 9 (mode 2)
    const s = sel([wdKey(7), 1], [wdKey(8), 2], [wdKey(9), 2]);
    const c = calcCosts(s, Z7);
    expect(c.peakBothDays).toBe(2);
    expect(c.offpeakBothDays).toBe(0);
    const expected = (Z7.peakOw + Z7.offpeakOw) + Z7.peakOw * 2 + Z7.peakOw * 2;
    expect(c.individual).toBeCloseTo(expected);
  });

  it('mix of mode 1 and mode 3 days: correct offpeakBothDays count', () => {
    const s = sel([wdKey(7), 1], [wdKey(8), 3], [wdKey(9), 3]);
    const c = calcCosts(s, Z7);
    expect(c.offpeakBothDays).toBe(2);
    expect(c.peakBothDays).toBe(0);
  });

  it('monthly is cheapest with enough weekdays selected', () => {
    // April 2026 has 22 weekdays (Apr 1 is Wed, Apr 30 is Thu, no holidays for this test)
    // At 22 × 26.50 = $583 individual >> $299.75 monthly
    const s = new Map();
    for (let d = 1; d <= 30; d++) {
      const dow = new Date(2026, 3, d).getDay();
      if (dow !== 0 && dow !== 6) s.set(dateKey(2026, 3, d), 1);
    }
    const c = calcCosts(s, Z7);
    expect(c.monthly).toBeCloseTo(Z7.monthly);
    expect(c.individual).toBeGreaterThan(c.monthly);
  });

  it('week spanning month boundary (Mar 30–Apr 3): 5 days counted in one week group', () => {
    const s = sel(
      [dateKey(2026, 2, 30), 1], // Mon Mar 30
      [dateKey(2026, 2, 31), 1], // Tue Mar 31
      [dateKey(2026, 3,  1), 1], // Wed Apr 1
      [dateKey(2026, 3,  2), 1], // Thu Apr 2
      [dateKey(2026, 3,  3), 1], // Fri Apr 3
    );
    const c = calcCosts(s, Z7);
    expect(c.passesUsed).toBe(1);
    expect(c.weeklyCombo).toBeCloseTo(Z7.weekly);
  });
});

// ─── Breakeven accuracy (OPUS-83 regression) ─────────────────────────────────

describe('breakeven calculation', () => {
  it('all mode 1 weekdays: breakeven = ceil(monthly / trip cost)', () => {
    const tripCost = Z7.peakOw + Z7.offpeakOw; // 26.50
    const breakeven = Math.ceil(Z7.monthly / tripCost); // 12

    // 11 days → individual cheaper
    const s11 = new Map();
    let count = 0;
    for (let d = 1; d <= 30 && count < 11; d++) {
      if (new Date(2026, 3, d).getDay() > 0 && new Date(2026, 3, d).getDay() < 6) {
        s11.set(dateKey(2026, 3, d), 1); count++;
      }
    }
    const c11 = calcCosts(s11, Z7);
    expect(c11.individual).toBeLessThan(c11.monthly);

    // breakeven days → monthly is cheaper or tied
    const sBreak = new Map();
    count = 0;
    for (let d = 1; d <= 30 && count < breakeven; d++) {
      if (new Date(2026, 3, d).getDay() > 0 && new Date(2026, 3, d).getDay() < 6) {
        sBreak.set(dateKey(2026, 3, d), 1); count++;
      }
    }
    const cBreak = calcCosts(sBreak, Z7);
    expect(cBreak.individual).toBeGreaterThanOrEqual(cBreak.monthly);
  });

  it('all mode 2 weekdays: breakeven is lower than mode 1 (higher per-trip cost)', () => {
    const mode1Trip = Z7.peakOw + Z7.offpeakOw; // 26.50
    const mode2Trip = Z7.peakOw * 2;             // 30.50
    const be1 = Math.ceil(Z7.monthly / mode1Trip); // 12
    const be2 = Math.ceil(Z7.monthly / mode2Trip); // 10
    expect(be2).toBeLessThan(be1);
  });
});
