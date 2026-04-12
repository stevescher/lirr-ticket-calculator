/**
 * LIRR Station, Zone, and Fare Data
 *
 * Source: MTA / Long Island Rail Road Station Fares
 * Effective: January 4, 2026
 * Reference: https://www.mta.info/document/194866
 * Last verified: 2026-04-12
 *
 * LIRR uses 8 fare zones: 1, 3, 4, 7, 9, 10, 12, 14
 * Fares are determined by zone pair (origin zone + destination zone).
 * This file covers all Zone 1 (City Terminal) to/from other zone fares,
 * which handles the vast majority of commuters (Penn Station / Grand Central).
 *
 * Day Pass: valid from purchase until 4am next day.
 *   - Weekday: 10% less than two peak one-way tickets
 *   - Weekend: same as two off-peak one-way tickets
 *
 * CityTicket: $7.25 peak / $5.25 off-peak for travel within Zone 1 only.
 *   Valid on weekends and holidays.
 *
 * Note: For trips within Zones 4-14 (not involving Zone 1 or 3),
 * peak and off-peak fares are the same.
 */

// ─── Fare Table (Zone 1 ↔ destination zone) ────────────────────────────────
// Each key is the non-Zone-1 zone number.
// All fares are in USD, effective 2026-01-04.
const ZONE_FARES = {
  1:  { monthly: 172.50, weekly:  67.75, peakOw:  7.25, offpeakOw:  5.25, dayPassWd: 14.50, dayPassWe: 10.50 },
  3:  { monthly: 207.00, weekly:  81.50, peakOw:  7.25, offpeakOw:  5.25, dayPassWd: 14.50, dayPassWe: 10.50 },
  4:  { monthly: 264.25, weekly:  94.00, peakOw: 13.50, offpeakOw: 10.00, dayPassWd: 24.25, dayPassWe: 20.00 },
  7:  { monthly: 299.75, weekly: 106.50, peakOw: 15.25, offpeakOw: 11.25, dayPassWd: 27.50, dayPassWe: 22.50 },
  9:  { monthly: 356.50, weekly: 126.75, peakOw: 18.25, offpeakOw: 13.50, dayPassWd: 32.75, dayPassWe: 27.00 },
  10: { monthly: 394.50, weekly: 140.25, peakOw: 21.50, offpeakOw: 16.00, dayPassWd: 38.75, dayPassWe: 32.00 },
  12: { monthly: 452.00, weekly: 160.75, peakOw: 25.50, offpeakOw: 18.75, dayPassWd: 46.00, dayPassWe: 37.50 },
  14: { monthly: 487.75, weekly: 173.50, peakOw: 33.00, offpeakOw: 24.50, dayPassWd: 59.50, dayPassWe: 49.00 },
};

// ─── Stations by Branch ─────────────────────────────────────────────────────
// Each station: { name, zone, aliases (optional) }
// Sorted alphabetically within each branch.
const LIRR_BRANCHES = {
  'City Terminal Zone': [
    { name: 'Penn Station',          zone: 1, aliases: ['Penn', 'New York Penn', 'NYP'] },
    { name: 'Grand Central Madison', zone: 1, aliases: ['Grand Central', 'GCT', 'GCM'] },
    { name: 'Atlantic Terminal',     zone: 1, aliases: ['Atlantic'] },
    { name: 'East New York',         zone: 1 },
    { name: 'Nostrand Avenue',       zone: 1 },
    { name: 'Long Island City',      zone: 1, aliases: ['LIC'] },
    { name: 'Hunterspoint Avenue',   zone: 1 },
    { name: 'Woodside',              zone: 1 },
    { name: 'Forest Hills',          zone: 1 },
    { name: 'Kew Gardens',           zone: 1 },
    { name: 'Mets-Willets Point',    zone: 1 },
  ],
  'Port Washington': [
    { name: 'Flushing-Main Street',  zone: 3 },
    { name: 'Murray Hill',           zone: 3 },
    { name: 'Broadway',              zone: 3 },
    { name: 'Auburndale',            zone: 3 },
    { name: 'Bayside',               zone: 3 },
    { name: 'Douglaston',            zone: 3 },
    { name: 'Little Neck',           zone: 3 },
    { name: 'Great Neck',            zone: 4 },
    { name: 'Manhasset',             zone: 4 },
    { name: 'Plandome',              zone: 4 },
    { name: 'Port Washington',       zone: 4 },
  ],
  'Ronkonkoma / Main Line': [
    { name: 'Jamaica',               zone: 3, aliases: ['JAM'] },
    { name: 'Hollis',                zone: 3 },
    { name: 'Queens Village',        zone: 3 },
    { name: 'Floral Park',           zone: 4 },
    { name: 'New Hyde Park',         zone: 4 },
    { name: 'Merillon Avenue',       zone: 4 },
    { name: 'Mineola',               zone: 4 },
    { name: 'Carle Place',           zone: 7 },
    { name: 'Westbury',              zone: 7 },
    { name: 'Hicksville',            zone: 7 },
    { name: 'Bethpage',              zone: 7 },
    { name: 'Farmingdale',           zone: 7 },
    { name: 'Pinelawn',              zone: 9 },
    { name: 'Wyandanch',             zone: 9 },
    { name: 'Deer Park',             zone: 9 },
    { name: 'Brentwood',             zone: 10 },
    { name: 'Central Islip',         zone: 10 },
    { name: 'Ronkonkoma',            zone: 10 },
    { name: 'Medford',               zone: 10 },
    { name: 'Yaphank',               zone: 12 },
    { name: 'Riverhead',             zone: 14 },
    { name: 'Mattituck',             zone: 14 },
    { name: 'Southold',              zone: 14 },
    { name: 'Greenport',             zone: 14 },
  ],
  'Babylon': [
    { name: 'Rockville Centre',      zone: 7 },
    { name: 'Baldwin',               zone: 7 },
    { name: 'Freeport',              zone: 7 },
    { name: 'Merrick',               zone: 7 },
    { name: 'Bellmore',              zone: 7 },
    { name: 'Wantagh',               zone: 7 },
    { name: 'Seaford',               zone: 7 },
    { name: 'Massapequa',            zone: 7 },
    { name: 'Massapequa Park',       zone: 7 },
    { name: 'Amityville',            zone: 9 },
    { name: 'Copiague',              zone: 9 },
    { name: 'Lindenhurst',           zone: 9 },
    { name: 'Babylon',               zone: 9 },
  ],
  'Montauk': [
    { name: 'Bay Shore',             zone: 10 },
    { name: 'Islip',                 zone: 10 },
    { name: 'Great River',           zone: 10 },
    { name: 'Oakdale',               zone: 10 },
    { name: 'Sayville',              zone: 10 },
    { name: 'Patchogue',             zone: 10 },
    { name: 'Bellport',              zone: 12 },
    { name: 'Mastic-Shirley',        zone: 12 },
    { name: 'Speonk',                zone: 12 },
    { name: 'Westhampton',           zone: 14 },
    { name: 'Hampton Bays',          zone: 14 },
    { name: 'Southampton',           zone: 14 },
    { name: 'Bridgehampton',         zone: 14 },
    { name: 'East Hampton',          zone: 14 },
    { name: 'Amagansett',            zone: 14 },
    { name: 'Montauk',               zone: 14 },
  ],
  'Port Jefferson': [
    { name: 'Syosset',               zone: 7 },
    { name: 'Cold Spring Harbor',    zone: 9 },
    { name: 'Huntington',            zone: 9 },
    { name: 'Greenlawn',             zone: 9 },
    { name: 'Northport',             zone: 9 },
    { name: 'Kings Park',            zone: 10 },
    { name: 'Smithtown',             zone: 10 },
    { name: 'St. James',             zone: 10 },
    { name: 'Stony Brook',           zone: 10 },
    { name: 'Port Jefferson',        zone: 10 },
  ],
  'Oyster Bay': [
    { name: 'East Williston',        zone: 4 },
    { name: 'Albertson',             zone: 7 },
    { name: 'Roslyn',                zone: 7 },
    { name: 'Greenvale',             zone: 7 },
    { name: 'Glen Head',             zone: 7 },
    { name: 'Sea Cliff',             zone: 7 },
    { name: 'Glen Street',           zone: 7 },
    { name: 'Glen Cove',             zone: 7 },
    { name: 'Locust Valley',         zone: 7 },
    { name: 'Oyster Bay',            zone: 7 },
  ],
  'Long Beach': [
    { name: 'Lynbrook',              zone: 4 },
    { name: 'East Rockaway',         zone: 7 },
    { name: 'Centre Avenue',         zone: 7 },
    { name: 'Oceanside',             zone: 7 },
    { name: 'Island Park',           zone: 7 },
    { name: 'Long Beach',            zone: 7 },
  ],
  'Far Rockaway': [
    { name: 'Laurelton',             zone: 3 },
    { name: 'Locust Manor',          zone: 3 },
    { name: 'Rosedale',              zone: 3 },
    { name: 'Valley Stream',         zone: 4 },
    { name: 'Gibson',                zone: 4 },
    { name: 'Hewlett',               zone: 4 },
    { name: 'Woodmere',              zone: 4 },
    { name: 'Cedarhurst',            zone: 4 },
    { name: 'Lawrence',              zone: 4 },
    { name: 'Inwood',                zone: 4 },
    { name: 'Far Rockaway',          zone: 4 },
  ],
  'Hempstead': [
    { name: 'Bellerose',             zone: 4 },
    { name: 'Elmont',                zone: 4 },
    { name: 'Stewart Manor',         zone: 4 },
    { name: 'Nassau Boulevard',      zone: 4 },
    { name: 'Garden City',           zone: 4 },
    { name: 'Country Life Press',    zone: 4 },
    { name: 'Hempstead',             zone: 4 },
  ],
  'West Hempstead': [
    { name: 'St. Albans',            zone: 3 },
    { name: 'Lakeview',              zone: 4 },
    { name: 'Hempstead Gardens',     zone: 4 },
    { name: 'West Hempstead',        zone: 4 },
    { name: 'Westwood',              zone: 4 },
    { name: 'Malverne',              zone: 4 },
  ],
  'Belmont Park': [
    { name: 'Belmont Park',          zone: 4 },
  ],
};

// ─── Flat station list (built from branches) ────────────────────────────────
// Each entry: { name, zone, branch, aliases }
const LIRR_STATIONS = [];
for (const [branch, stations] of Object.entries(LIRR_BRANCHES)) {
  for (const s of stations) {
    LIRR_STATIONS.push({
      name: s.name,
      zone: s.zone,
      branch,
      aliases: s.aliases || [],
    });
  }
}

// ─── City Terminal Zone stations (for CityTicket eligibility) ───────────────
const CITY_ZONE_STATIONS = LIRR_BRANCHES['City Terminal Zone'].map(s => s.name);

// ─── Lookup helpers ─────────────────────────────────────────────────────────

/** Get fares for a zone pair involving Zone 1. Returns fare object or null. */
function getFaresForZone(zone) {
  return ZONE_FARES[zone] || null;
}

/** Find a station by name (case-insensitive, checks aliases). */
function findStation(query) {
  const q = query.trim().toLowerCase();
  return LIRR_STATIONS.find(s =>
    s.name.toLowerCase() === q ||
    s.aliases.some(a => a.toLowerCase() === q)
  ) || null;
}

/** Search stations by partial name match. Returns up to `limit` results. */
function searchStations(query, limit = 10) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return LIRR_STATIONS.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.aliases.some(a => a.toLowerCase().includes(q))
  ).slice(0, limit);
}

/** Check if both stations are in the City Terminal Zone (CityTicket eligible). */
function isCityTicketEligible(stationA, stationB) {
  return stationA.zone === 1 && stationB.zone === 1;
}
