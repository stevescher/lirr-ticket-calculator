/**
 * Data integrity tests for LIRR fare and station data.
 * Verifies consistency between inline defaults, ZONE_FARES, and station data.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse lirr-data.js to extract ZONE_FARES
const dataFile = readFileSync(resolve(process.cwd(), 'lirr-data.js'), 'utf-8');

function extractZoneFares() {
  const match = dataFile.match(/const ZONE_FARES\s*=\s*\{([\s\S]*?)\};/);
  if (!match) throw new Error('Could not parse ZONE_FARES');
  // Use Function constructor to safely evaluate the object literal
  return new Function(`return {${match[1]}}`)();
}

function extractStations() {
  const match = dataFile.match(/const LIRR_BRANCHES\s*=\s*\{([\s\S]*?)\n\};/);
  if (!match) throw new Error('Could not parse LIRR_BRANCHES');
  return new Function(`return {${match[1]}}`)();
}

const ZONE_FARES = extractZoneFares();
const LIRR_BRANCHES = extractStations();

// Parse default fares from app.js
const appFile = readFileSync(resolve(process.cwd(), 'app.js'), 'utf-8');
function extractDefaultFares() {
  const match = appFile.match(/const fares\s*=\s*\{([\s\S]*?)\};/);
  if (!match) throw new Error('Could not parse default fares from app.js');
  return new Function(`return {${match[1]}}`)();
}
const INLINE_FARES = extractDefaultFares();

// ─── ZONE_FARES structure ────────────────────────────────────────────────────

describe('ZONE_FARES structure', () => {
  const ZONES = [1, 3, 4, 7, 9, 10, 12, 14];
  const REQUIRED_KEYS = ['monthly', 'weekly', 'peakOw', 'offpeakOw', 'dayPassWd', 'dayPassWe'];

  // 8 zones → 8 same-zone + 28 cross-zone pairs = 36 total
  it('contains all 36 zone pair entries', () => {
    expect(Object.keys(ZONE_FARES).length).toBe(36);
  });

  it('contains all expected zone pairs', () => {
    for (let i = 0; i < ZONES.length; i++) {
      for (let j = i; j < ZONES.length; j++) {
        const key = `${ZONES[i]},${ZONES[j]}`;
        expect(ZONE_FARES, `missing pair ${key}`).toHaveProperty(key);
      }
    }
  });

  it('every entry has all required fare fields as positive numbers', () => {
    for (const [pair, fares] of Object.entries(ZONE_FARES)) {
      REQUIRED_KEYS.forEach(key => {
        expect(typeof fares[key], `${pair}.${key} type`).toBe('number');
        expect(fares[key], `${pair}.${key} positive`).toBeGreaterThan(0);
      });
    }
  });

  it('peak >= off-peak for every pair', () => {
    for (const [pair, fares] of Object.entries(ZONE_FARES)) {
      expect(fares.peakOw, `${pair} peak >= off-peak`).toBeGreaterThanOrEqual(fares.offpeakOw);
    }
  });

  it('monthly > weekly for every pair', () => {
    for (const [pair, fares] of Object.entries(ZONE_FARES)) {
      expect(fares.monthly, `${pair} monthly > weekly`).toBeGreaterThan(fares.weekly);
    }
  });

  it('weekday day pass >= weekend day pass for every pair', () => {
    for (const [pair, fares] of Object.entries(ZONE_FARES)) {
      expect(fares.dayPassWd, `${pair} weekday >= weekend pass`).toBeGreaterThanOrEqual(fares.dayPassWe);
    }
  });

  it('Zone 1 fares increase with zone number (farther = more expensive)', () => {
    for (let i = 1; i < ZONES.length; i++) {
      const prev = ZONE_FARES[`1,${ZONES[i - 1]}`];
      const curr = ZONE_FARES[`1,${ZONES[i]}`];
      expect(curr.monthly, `Zone 1→${ZONES[i]} monthly >= Zone 1→${ZONES[i-1]}`).toBeGreaterThanOrEqual(prev.monthly);
      expect(curr.peakOw, `Zone 1→${ZONES[i]} peak >= Zone 1→${ZONES[i-1]}`).toBeGreaterThanOrEqual(prev.peakOw);
    }
  });

  it('trips between zones 4–14 have equal peak and off-peak one-way fares', () => {
    const outerZones = [4, 7, 9, 10, 12, 14];
    for (let i = 0; i < outerZones.length; i++) {
      for (let j = i; j < outerZones.length; j++) {
        const key = `${outerZones[i]},${outerZones[j]}`;
        expect(ZONE_FARES[key].peakOw, `${key} peak === off-peak`).toBe(ZONE_FARES[key].offpeakOw);
      }
    }
  });
});

// ─── Inline fares match Zone 1→7 defaults ────────────────────────────────────

describe('default fares match Zone 1→7 (Hicksville↔Penn default)', () => {
  const Z17 = ZONE_FARES['1,7'];
  const KEYS = ['monthly', 'weekly', 'peakOw', 'offpeakOw', 'dayPassWd', 'dayPassWe'];

  KEYS.forEach(key => {
    it(`${key}: inline ${INLINE_FARES[key]} === Zone 1→7 ${Z17[key]}`, () => {
      expect(INLINE_FARES[key]).toBeCloseTo(Z17[key]);
    });
  });
});

// ─── Station data ────────────────────────────────────────────────────────────

describe('LIRR_BRANCHES station data', () => {
  const VALID_ZONES = new Set([1, 3, 4, 7, 9, 10, 12, 14]);

  it('has at least 10 branches', () => {
    expect(Object.keys(LIRR_BRANCHES).length).toBeGreaterThanOrEqual(10);
  });

  it('every station has a name and valid zone', () => {
    for (const [branch, stations] of Object.entries(LIRR_BRANCHES)) {
      for (const s of stations) {
        expect(s.name, `station in ${branch}`).toBeTruthy();
        expect(VALID_ZONES.has(s.zone), `${s.name} zone ${s.zone} is valid`).toBe(true);
      }
    }
  });

  it('no duplicate station names across branches', () => {
    const names = new Set();
    for (const [, stations] of Object.entries(LIRR_BRANCHES)) {
      for (const s of stations) {
        expect(names.has(s.name), `duplicate: ${s.name}`).toBe(false);
        names.add(s.name);
      }
    }
  });

  it('City Terminal Zone stations are all Zone 1', () => {
    const cityStations = LIRR_BRANCHES['City Terminal Zone'];
    expect(cityStations).toBeDefined();
    for (const s of cityStations) {
      expect(s.zone, `${s.name} should be zone 1`).toBe(1);
    }
  });

  it('Penn Station and Grand Central Madison exist in City Terminal Zone', () => {
    const names = LIRR_BRANCHES['City Terminal Zone'].map(s => s.name);
    expect(names).toContain('Penn Station');
    expect(names).toContain('Grand Central Madison');
  });

  it('total station count is reasonable (100+)', () => {
    let count = 0;
    for (const [, stations] of Object.entries(LIRR_BRANCHES)) {
      count += stations.length;
    }
    expect(count).toBeGreaterThan(100);
  });
});
