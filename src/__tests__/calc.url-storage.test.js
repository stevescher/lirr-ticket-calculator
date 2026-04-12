/**
 * OPUS-117: Unit tests for URL and localStorage encoding/decoding.
 * Covers validation of day numbers, mode suffixes, and regression for OPUS-82/91.
 */
import { describe, it, expect } from 'vitest';
import { decodeURL, encodeURL, decodeStorage, encodeStorage, dateKey, calcCosts } from '../calc.js';

const Z7 = {
  monthly: 299.75, weekly: 106.50,
  peakOw: 15.25, offpeakOw: 11.25,
  dayPassWd: 27.50, dayPassWe: 22.50,
};

// ─── decodeURL ────────────────────────────────────────────────────────────────

describe('decodeURL', () => {
  it('valid hash with in-range days parses correctly', () => {
    const result = decodeURL('202604:7,8,9');
    expect(result).not.toBeNull();
    expect(result.year).toBe(2026);
    expect(result.month).toBe(3); // 0-indexed April
    expect(result.sel.get(dateKey(2026, 3, 7))).toBe(1);
    expect(result.sel.get(dateKey(2026, 3, 8))).toBe(1);
    expect(result.sel.get(dateKey(2026, 3, 9))).toBe(1);
    expect(result.sel.size).toBe(3);
  });

  it('day 31 for April (30-day month) is silently dropped', () => {
    const result = decodeURL('202604:31');
    expect(result).not.toBeNull();
    expect(result.sel.size).toBe(0); // day 31 rejected for April
  });

  it('day 29 for February non-leap year (2026) is rejected', () => {
    const result = decodeURL('202602:29');
    expect(result.sel.size).toBe(0);
  });

  it('day 29 for February leap year (2028) is accepted', () => {
    const result = decodeURL('202802:29');
    expect(result.sel.size).toBe(1);
    expect(result.sel.get(dateKey(2028, 1, 29))).toBe(1);
  });

  it('day 0 and negative day numbers are rejected', () => {
    const result = decodeURL('202604:0');
    expect(result.sel.size).toBe(0);
  });

  it('mode 2 suffix "p" parsed correctly', () => {
    const result = decodeURL('202604:8p');
    expect(result.sel.get(dateKey(2026, 3, 8))).toBe(2);
  });

  it('mode 3 suffix "o" parsed correctly', () => {
    const result = decodeURL('202604:8o');
    expect(result.sel.get(dateKey(2026, 3, 8))).toBe(3);
  });

  it('no suffix defaults to mode 1', () => {
    const result = decodeURL('202604:8');
    expect(result.sel.get(dateKey(2026, 3, 8))).toBe(1);
  });

  it('hash with no days sets year/month but sel is empty', () => {
    const result = decodeURL('202604');
    expect(result).not.toBeNull();
    expect(result.year).toBe(2026);
    expect(result.month).toBe(3);
    expect(result.sel.size).toBe(0);
  });

  it('hash with invalid month (13) returns null', () => {
    expect(decodeURL('202613:1')).toBeNull();
  });

  it('hash with month 0 (after subtracting 1 = -1) returns null', () => {
    expect(decodeURL('202600:1')).toBeNull();
  });

  it('hash shorter than 6 characters returns null', () => {
    expect(decodeURL('20260')).toBeNull();
    expect(decodeURL('')).toBeNull();
    expect(decodeURL(null)).toBeNull();
  });

  it('non-numeric date portion returns null', () => {
    expect(decodeURL('abcdef:1')).toBeNull();
  });

  it('duplicate days are deduplicated (last mode wins via Map semantics)', () => {
    const result = decodeURL('202604:8,8p');
    expect(result.sel.size).toBe(1);
  });
});

// ─── encodeURL ────────────────────────────────────────────────────────────────

describe('encodeURL', () => {
  it('encodes month as 1-indexed with zero-padding', () => {
    const s = new Map([[dateKey(2026, 3, 7), 1]]);
    expect(encodeURL(s, 2026, 3)).toMatch(/^202604:/);
  });

  it('empty selection encodes without colon separator', () => {
    const hash = encodeURL(new Map(), 2026, 3);
    expect(hash).toBe('202604');
    expect(hash).not.toContain(':');
  });

  it('mode 1 days have no suffix', () => {
    const s = new Map([[dateKey(2026, 3, 7), 1]]);
    expect(encodeURL(s, 2026, 3)).toBe('202604:7');
  });

  it('mode 2 days get "p" suffix', () => {
    const s = new Map([[dateKey(2026, 3, 8), 2]]);
    expect(encodeURL(s, 2026, 3)).toBe('202604:8p');
  });

  it('mode 3 days get "o" suffix', () => {
    const s = new Map([[dateKey(2026, 3, 9), 3]]);
    expect(encodeURL(s, 2026, 3)).toBe('202604:9o');
  });

  it('days are sorted ascending regardless of insertion order (OPUS-91 regression)', () => {
    const s = new Map([
      [dateKey(2026, 3, 15), 1],
      [dateKey(2026, 3, 3),  1],
      [dateKey(2026, 3, 9),  1],
    ]);
    expect(encodeURL(s, 2026, 3)).toBe('202604:3,9,15');
  });

  it('mixed modes encoded and sorted correctly', () => {
    const s = new Map([
      [dateKey(2026, 3, 10), 1],
      [dateKey(2026, 3, 8),  2],
      [dateKey(2026, 3, 9),  3],
    ]);
    expect(encodeURL(s, 2026, 3)).toBe('202604:8p,9o,10');
  });

  it('encodeURL then decodeURL round-trips correctly', () => {
    const original = new Map([
      [dateKey(2026, 3, 7),  1],
      [dateKey(2026, 3, 8),  2],
      [dateKey(2026, 3, 10), 3],
    ]);
    const hash = encodeURL(original, 2026, 3);
    const decoded = decodeURL(hash);
    expect(decoded.year).toBe(2026);
    expect(decoded.month).toBe(3);
    expect(decoded.sel.size).toBe(3);
    expect(decoded.sel.get(dateKey(2026, 3, 7))).toBe(1);
    expect(decoded.sel.get(dateKey(2026, 3, 8))).toBe(2);
    expect(decoded.sel.get(dateKey(2026, 3, 10))).toBe(3);
  });
});

// ─── decodeStorage ────────────────────────────────────────────────────────────

describe('decodeStorage', () => {
  it('valid data round-trips correctly', () => {
    const raw = JSON.stringify([[7, 1], [8, 2], [9, 3]]);
    const sel = decodeStorage(raw, 2026, 3);
    expect(sel).not.toBeNull();
    expect(sel.get(dateKey(2026, 3, 7))).toBe(1);
    expect(sel.get(dateKey(2026, 3, 8))).toBe(2);
    expect(sel.get(dateKey(2026, 3, 9))).toBe(3);
  });

  it('day 31 for April is rejected (OPUS-82 regression)', () => {
    const raw = JSON.stringify([[31, 1]]);
    const sel = decodeStorage(raw, 2026, 3); // April has 30 days
    expect(sel).not.toBeNull();
    expect(sel.size).toBe(0);
  });

  it('day 31 for March (31-day month) is accepted', () => {
    const raw = JSON.stringify([[31, 1]]);
    const sel = decodeStorage(raw, 2026, 2); // March
    expect(sel.size).toBe(1);
  });

  it('day 0 is rejected', () => {
    const sel = decodeStorage(JSON.stringify([[0, 1]]), 2026, 3);
    expect(sel.size).toBe(0);
  });

  it('negative day numbers are rejected', () => {
    const sel = decodeStorage(JSON.stringify([[-1, 1]]), 2026, 3);
    expect(sel.size).toBe(0);
  });

  it('non-integer day numbers are rejected', () => {
    const sel = decodeStorage(JSON.stringify([[7.5, 1]]), 2026, 3);
    expect(sel.size).toBe(0);
  });

  it('invalid mode 4 is rejected', () => {
    const sel = decodeStorage(JSON.stringify([[7, 4]]), 2026, 3);
    expect(sel.size).toBe(0);
  });

  it('mode 0 is rejected', () => {
    const sel = decodeStorage(JSON.stringify([[7, 0]]), 2026, 3);
    expect(sel.size).toBe(0);
  });

  it('modes 1, 2, 3 all accepted', () => {
    const raw = JSON.stringify([[7, 1], [8, 2], [9, 3]]);
    const sel = decodeStorage(raw, 2026, 3);
    expect(sel.size).toBe(3);
  });

  it('non-array JSON returns null', () => {
    expect(decodeStorage(JSON.stringify({ a: 1 }), 2026, 3)).toBeNull();
  });

  it('corrupt JSON string returns null without throwing', () => {
    expect(() => decodeStorage('not-json', 2026, 3)).not.toThrow();
    expect(decodeStorage('not-json', 2026, 3)).toBeNull();
  });

  it('null/undefined raw returns null', () => {
    expect(decodeStorage(null, 2026, 3)).toBeNull();
    expect(decodeStorage(undefined, 2026, 3)).toBeNull();
  });

  it('empty array returns empty Map (not null)', () => {
    const sel = decodeStorage(JSON.stringify([]), 2026, 3);
    expect(sel).not.toBeNull();
    expect(sel.size).toBe(0);
  });
});

// ─── encodeStorage ────────────────────────────────────────────────────────────

describe('encodeStorage', () => {
  it('returns array of [day, mode] pairs', () => {
    const s = new Map([
      [dateKey(2026, 3, 7), 1],
      [dateKey(2026, 3, 8), 2],
    ]);
    const data = encodeStorage(s);
    expect(data).toContainEqual([7, 1]);
    expect(data).toContainEqual([8, 2]);
    expect(data).toHaveLength(2);
  });

  it('encodeStorage then decodeStorage round-trips correctly', () => {
    const original = new Map([
      [dateKey(2026, 3, 7), 1],
      [dateKey(2026, 3, 8), 2],
      [dateKey(2026, 3, 9), 3],
    ]);
    const raw = JSON.stringify(encodeStorage(original));
    const decoded = decodeStorage(raw, 2026, 3);
    expect(decoded.size).toBe(3);
    original.forEach((mode, key) => expect(decoded.get(key)).toBe(mode));
  });
});

// ─── OPUS-82 regression: ghost days inflate cost ──────────────────────────────

describe('OPUS-82 regression: ghost days via URL do not inflate cost', () => {
  it('day 31 from URL for April does not appear in calcCosts result', () => {
    const result = decodeURL('202604:31');
    expect(result).not.toBeNull();
    // Ghost day is dropped — calcCosts with 0 days returns null
    expect(calcCosts(result.sel, Z7)).toBeNull();
  });

  it('day 31 from storage for April does not appear in calcCosts result', () => {
    const raw = JSON.stringify([[31, 1]]);
    const sel = decodeStorage(raw, 2026, 3);
    expect(calcCosts(sel, Z7)).toBeNull();
  });
});
