/**
 * Pure calculation functions for LIRR Ticket Calculator.
 *
 * These are extracted from index.html for unit testing. The production app
 * uses these same algorithms inline. When updating logic in index.html,
 * keep this file in sync.
 *
 * Key design decisions for testability:
 *  - dayCost / calcCosts take fares as an explicit parameter (not a global)
 *  - encodeURL / decodeURL return/accept plain strings (no location references)
 *  - decodeStorage takes raw JSON string + year/month (no localStorage access)
 *  - initViewMonth takes a Date parameter (no new Date() internally)
 */

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function dateKey(y, m, d) { return `${y}|${m}|${d}`; }
export function isWeekend(dow)   { return dow === 0 || dow === 6; }
export function isTWT(dow)       { return dow === 2 || dow === 3 || dow === 4; }

// ─── Federal holidays ─────────────────────────────────────────────────────────

/**
 * Builds a Map of federal holiday dates for the given year.
 * Keys are "month|day" strings using 0-indexed months.
 * When a holiday falls on Saturday, the Friday observed date is also added.
 * When it falls on Sunday, the Monday observed date is also added.
 */
export function buildHolidays(year) {
  const h = new Map();

  function observed(mo, day, name) {
    const dow = new Date(year, mo, day).getDay();
    if (dow === 0) {
      h.set(`${mo}|${day + 1}`, name + ' (observed)');
      h.set(`${mo}|${day}`,     name);
    } else if (dow === 6) {
      h.set(`${mo}|${day - 1}`, name + ' (observed)');
      h.set(`${mo}|${day}`,     name);
    } else {
      h.set(`${mo}|${day}`, name);
    }
  }

  function nthWeekday(mo, wd, n) {
    let d = 1, cnt = 0;
    while (d <= 31) {
      if (new Date(year, mo, d).getDay() === wd && ++cnt === n) return d;
      d++;
    }
    throw new Error(`No ${n}th weekday ${wd} in month ${mo}`);
  }

  function lastMonday(mo) {
    const d = new Date(year, mo + 1, 0);
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    return d.getDate();
  }

  observed(0,  1,  "New Year's Day");
  h.set(`0|${nthWeekday(0, 1, 3)}`,   'MLK Day');
  h.set(`1|${nthWeekday(1, 1, 3)}`,   "Presidents' Day");
  h.set(`4|${lastMonday(4)}`,          'Memorial Day');
  observed(5,  19, 'Juneteenth');
  observed(6,  4,  'Independence Day');
  h.set(`8|${nthWeekday(8, 1, 1)}`,   'Labor Day');
  h.set(`9|${nthWeekday(9, 1, 2)}`,   'Columbus Day');
  observed(10, 11, 'Veterans Day');
  h.set(`10|${nthWeekday(10, 4, 4)}`, 'Thanksgiving');
  observed(11, 25, 'Christmas Day');
  return h;
}

export function isHoliday(year, m, d) { return buildHolidays(year).has(`${m}|${d}`); }
export function holName(year, m, d)   { return buildHolidays(year).get(`${m}|${d}`) || ''; }

// ─── Cost calculation ─────────────────────────────────────────────────────────

/**
 * Cost of a single commute day.
 * @param {object} fares  - fare object from ZONE_FARES (peakOw, offpeakOw, etc.)
 * @param {number} mode   - 1=peak-in/off-peak-out, 2=peak-both, 3=off-peak-both
 * @param {boolean} we    - true if weekend (weekends always use off-peak both ways)
 */
export function dayCost(fares, mode, we) {
  if (we)         return fares.offpeakOw * 2;
  if (mode === 2) return fares.peakOw * 2;
  if (mode === 3) return fares.offpeakOw * 2;
  return fares.peakOw + fares.offpeakOw;
}

/**
 * Calculates all fare option costs for the current selection.
 * @param {Map<string, number>} sel   - Map of dateKey → mode
 * @param {object}              fares - fare object from ZONE_FARES
 * @returns Cost breakdown object, or null if nothing is selected.
 */
export function calcCosts(sel, fares) {
  let wdDays = 0, weDays = 0, peakBothDays = 0, offpeakBothDays = 0;
  let indTotal = 0, dpTotal = 0;

  sel.forEach((mode, k) => {
    const [y, m, d] = k.split('|').map(Number);
    const we = isWeekend(new Date(y, m, d).getDay());
    we ? weDays++ : wdDays++;
    if (mode === 2) peakBothDays++;
    if (mode === 3) offpeakBothDays++;
    indTotal += dayCost(fares, mode, we);
    dpTotal  += we ? fares.dayPassWe : fares.dayPassWd;
  });

  const total = wdDays + weDays;
  if (!total) return null;

  const weekMap = {};
  sel.forEach((mode, k) => {
    const [y, m, d] = k.split('|').map(Number);
    const date = new Date(y, m, d);
    const dow  = date.getDay();
    const mon  = new Date(date);
    mon.setDate(mon.getDate() - (dow + 6) % 7);
    const wk = `${mon.getFullYear()}|${mon.getMonth()}|${mon.getDate()}`;
    if (!weekMap[wk]) weekMap[wk] = { cost: 0, count: 0 };
    weekMap[wk].cost  += dayCost(fares, mode, isWeekend(dow));
    weekMap[wk].count++;
  });

  let weeklyCombo = 0, passesUsed = 0;
  Object.values(weekMap).forEach(({ cost, count }) => {
    if (count >= 5 && fares.weekly < cost) { weeklyCombo += fares.weekly; passesUsed++; }
    else weeklyCombo += cost;
  });

  return {
    total, wdDays, weDays, peakBothDays, offpeakBothDays,
    defaultTrip: fares.peakOw + fares.offpeakOw,
    monthly:    fares.monthly,
    individual: indTotal,
    dayPasses:  dpTotal,
    weeklyCombo, passesUsed,
  };
}

// ─── URL encoding/decoding ────────────────────────────────────────────────────

/**
 * Encodes the current selection to a URL hash string (without leading #).
 * Format: YYYYmm or YYYYmm:d,dp,do  (plain = mode 1, p suffix = mode 2, o = mode 3)
 * Days are sorted ascending.
 */
export function encodeURL(sel, year, month) {
  const days = [];
  sel.forEach((mode, key) => {
    const d = key.split('|')[2];
    days.push(mode === 2 ? `${d}p` : mode === 3 ? `${d}o` : d);
  });
  days.sort((a, b) => parseInt(a) - parseInt(b));
  return `${year}${String(month + 1).padStart(2, '0')}${days.length ? ':' + days.join(',') : ''}`;
}

/**
 * Decodes a URL hash string. Returns { year, month, sel } or null if invalid.
 * Out-of-range day numbers are silently dropped.
 */
export function decodeURL(hash) {
  if (!hash || hash.length < 6) return null;
  const ci   = hash.indexOf(':');
  const dp   = ci === -1 ? hash : hash.slice(0, ci);
  const rest = ci === -1 ? ''   : hash.slice(ci + 1);
  const y = parseInt(dp.slice(0, 4));
  const m = parseInt(dp.slice(4, 6)) - 1;
  if (isNaN(y) || isNaN(m) || m < 0 || m > 11) return null;
  const sel = new Map();
  if (rest) rest.split(',').forEach(p => {
    const pb = p.endsWith('p');
    const ob = p.endsWith('o');
    const d  = parseInt((pb || ob) ? p.slice(0, -1) : p);
    const maxDay = new Date(y, m + 1, 0).getDate();
    if (!isNaN(d) && d >= 1 && d <= maxDay) sel.set(dateKey(y, m, d), pb ? 2 : ob ? 3 : 1);
  });
  return { year: y, month: m, sel };
}

// ─── localStorage encoding/decoding ──────────────────────────────────────────

const VALID_MODES = new Set([1, 2, 3]);

/**
 * Decodes a raw localStorage JSON string into a selection Map.
 * Out-of-range days and invalid modes are silently dropped.
 * Returns null if the string is absent, malformed, or not an array.
 */
export function decodeStorage(raw, year, month) {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const sel = new Map();
    const maxDay = new Date(year, month + 1, 0).getDate();
    parsed.forEach(([d, mode]) => {
      const day = +d;
      if (!Number.isInteger(day) || day < 1 || day > maxDay) return;
      if (!VALID_MODES.has(mode)) return;
      sel.set(dateKey(year, month, day), mode);
    });
    return sel;
  } catch {
    return null;
  }
}

/**
 * Encodes a selection Map to the localStorage array format [[day, mode], ...].
 */
export function encodeStorage(sel) {
  const data = [];
  sel.forEach((mode, key) => data.push([+key.split('|')[2], mode]));
  return data;
}

// ─── Initial view month ───────────────────────────────────────────────────────

/**
 * Determines the initial calendar month to show based on today's date.
 * If today is the 1st–15th, shows the current month.
 * If today is the 16th–31st, shows next month.
 * Handles December → January year wrap.
 *
 * @param {Date} today - the current date (time components ignored)
 * @returns {{ year: number, month: number }}
 */
export function initViewMonth(today) {
  let year  = today.getFullYear();
  let month = today.getDate() <= 15 ? today.getMonth() : today.getMonth() + 1;
  if (month > 11) { month = 0; year++; }
  return { year, month };
}
