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
  const EXPECTED_ZONES = [1, 3, 4, 7, 9, 10, 12, 14];
  const REQUIRED_KEYS = ['monthly', 'weekly', 'peakOw', 'offpeakOw', 'dayPassWd', 'dayPassWe'];

  it('contains all 8 LIRR fare zones', () => {
    const zones = Object.keys(ZONE_FARES).map(Number).sort((a, b) => a - b);
    expect(zones).toEqual(EXPECTED_ZONES);
  });

  EXPECTED_ZONES.forEach(zone => {
    describe(`Zone ${zone}`, () => {
      it('has all required fare fields', () => {
        REQUIRED_KEYS.forEach(key => {
          expect(ZONE_FARES[zone]).toHaveProperty(key);
        });
      });

      it('all fares are positive numbers', () => {
        REQUIRED_KEYS.forEach(key => {
          expect(typeof ZONE_FARES[zone][key]).toBe('number');
          expect(ZONE_FARES[zone][key]).toBeGreaterThan(0);
        });
      });

      it('peak > off-peak for one-way fares', () => {
        expect(ZONE_FARES[zone].peakOw).toBeGreaterThanOrEqual(ZONE_FARES[zone].offpeakOw);
      });

      it('monthly > weekly (monthly covers more rides)', () => {
        expect(ZONE_FARES[zone].monthly).toBeGreaterThan(ZONE_FARES[zone].weekly);
      });

      it('weekday day pass >= weekend day pass', () => {
        expect(ZONE_FARES[zone].dayPassWd).toBeGreaterThanOrEqual(ZONE_FARES[zone].dayPassWe);
      });
    });
  });

  it('fares increase with zone number (higher zones = farther = more expensive)', () => {
    for (let i = 1; i < EXPECTED_ZONES.length; i++) {
      const prev = ZONE_FARES[EXPECTED_ZONES[i - 1]];
      const curr = ZONE_FARES[EXPECTED_ZONES[i]];
      expect(curr.monthly).toBeGreaterThanOrEqual(prev.monthly);
      expect(curr.peakOw).toBeGreaterThanOrEqual(prev.peakOw);
    }
  });
});

// ─── Inline fares match Zone 7 defaults ──────────────────────────────────────

describe('default fares match Zone 7 (Hicksville default)', () => {
  const Z7 = ZONE_FARES[7];
  const KEYS = ['monthly', 'weekly', 'peakOw', 'offpeakOw', 'dayPassWd', 'dayPassWe'];

  KEYS.forEach(key => {
    it(`${key}: inline ${INLINE_FARES[key]} === Zone 7 ${Z7[key]}`, () => {
      expect(INLINE_FARES[key]).toBeCloseTo(Z7[key]);
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
