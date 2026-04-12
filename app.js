// ─── Fares ──────────────────────────────────────────────────────────────────
const fares = {
  monthly:    299.75,
  weekly:     106.50,
  peakOw:      15.25,
  offpeakOw:   11.25,
  dayPassWd:   27.50,
  dayPassWe:   22.50,
};
const fmt = n => '$' + n.toFixed(2);
// All valid day modes: 1=peak-in/off-peak-out, 2=peak-both, 3=off-peak-both
const VALID_MODES = new Set([1, 2, 3]);

// ─── Presets ────────────────────────────────────────────────────────────────
// ?preset=<name> loads a named configuration for bookmarking
const PRESETS = {
  daniela: { from: 'Hicksville', to: 'Penn Station', mode: 1, pattern: 'twt' },
};

function getPreset() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('preset');
  return name ? PRESETS[name.toLowerCase()] || null : null;
}

// ─── Date helpers ────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
function getToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

function dateKey(y, m, d) { return `${y}|${m}|${d}`; }
function isWeekend(dow) { return dow === 0 || dow === 6; }
function isTWT(dow)     { return dow === 2 || dow === 3 || dow === 4; }

// ─── Federal Holidays ────────────────────────────────────────────────────────
function buildHolidays(year) {
  const h = new Map(); // "month|day" (0-indexed) → name

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
    while (d <= 31) { if (new Date(year, mo, d).getDay() === wd && ++cnt === n) return d; d++; }
    throw new Error(`No ${n}th weekday ${wd} in month ${mo}`);
  }
  function lastMonday(mo) {
    const d = new Date(year, mo + 1, 0);
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    return d.getDate();
  }

  observed(0,  1,  "New Year's Day");
  h.set(`0|${nthWeekday(0,1,3)}`,   'MLK Day');
  h.set(`1|${nthWeekday(1,1,3)}`,   "Presidents' Day");
  h.set(`4|${lastMonday(4)}`,        'Memorial Day');
  observed(5,  19, 'Juneteenth');
  observed(6,  4,  'Independence Day');
  h.set(`8|${nthWeekday(8,1,1)}`,   'Labor Day');
  h.set(`9|${nthWeekday(9,1,2)}`,   'Columbus Day');
  observed(10, 11, 'Veterans Day');
  h.set(`10|${nthWeekday(10,4,4)}`, 'Thanksgiving');
  observed(11, 25, 'Christmas Day');
  return h;
}

const _holCache = {};
function getHols(year) { return _holCache[year] || (_holCache[year] = buildHolidays(year)); }
function isHoliday(y, m, d)  { return getHols(y).has(`${m}|${d}`); }
function holName(y, m, d)    { return getHols(y).get(`${m}|${d}`) || ''; }

// ─── State ───────────────────────────────────────────────────────────────────
// sel: Map<dateKey, mode>  1 = peak in / off-peak out  |  2 = peak in / peak out
let vYear, vMonth;
const sel = new Map();

function initView() {
  const today = getToday();
  const d = today.getDate();
  vYear  = today.getFullYear();
  vMonth = d <= 15 ? today.getMonth() : today.getMonth() + 1;
  if (vMonth > 11) { vMonth = 0; vYear++; }
}

// ─── localStorage ────────────────────────────────────────────────────────────
// ─── Settings persistence (station, mode, pattern) ──────────────────────
const SETTINGS_KEY = 'lirr-settings';

function saveSettings() {
  const fromSel = document.getElementById('fromStation');
  const toSel   = document.getElementById('toStation');
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      from:    fromSel ? fromSel.value : null,
      to:      toSel   ? toSel.value   : null,
      mode:    defaultMode,
      pattern: activePattern,
    }));
  } catch {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    if (s.from && !findStation(s.from)) s.from = null;
    if (s.to   && !findStation(s.to))   s.to   = null;
    if (!VALID_MODES.has(s.mode)) s.mode = 1;
    if (s.pattern && !DAY_PATTERNS[s.pattern]) s.pattern = null;
    return s;
  } catch { return null; }
}

function lsKey() { return `lirr-${vYear}-${vMonth}`; }

function saveToStorage() {
  const data = [];
  sel.forEach((mode, key) => data.push([+key.split('|')[2], mode]));
  try { localStorage.setItem(lsKey(), JSON.stringify(data)); } catch {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(lsKey());
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    sel.clear();
    parsed.forEach(([d, mode]) => {
      const day = +d;
      const maxDay = new Date(vYear, vMonth + 1, 0).getDate();
      if (!Number.isInteger(day) || day < 1 || day > maxDay) return;
      if (!VALID_MODES.has(mode)) return;
      sel.set(dateKey(vYear, vMonth, day), mode);
    });
    return true;
  } catch { return false; }
}

// ─── URL sharing ─────────────────────────────────────────────────────────────
function updateURL() {
  const days = [];
  sel.forEach((mode, key) => {
    const d = key.split('|')[2];
    days.push(mode === 2 ? `${d}p` : mode === 3 ? `${d}o` : d);
  });
  days.sort((a, b) => parseInt(a) - parseInt(b));
  const hash = `${vYear}${String(vMonth+1).padStart(2,'0')}${days.length ? ':'+days.join(',') : ''}`;
  history.replaceState(null, '', '#' + hash);
}

function loadFromURL() {
  const hash = location.hash.slice(1);
  if (hash.length < 6) return false;
  const ci   = hash.indexOf(':');
  const dp   = ci === -1 ? hash : hash.slice(0, ci);
  const rest = ci === -1 ? '' : hash.slice(ci+1);
  const y = parseInt(dp.slice(0,4)), m = parseInt(dp.slice(4,6)) - 1;
  if (isNaN(y) || isNaN(m) || m < 0 || m > 11) return false;
  vYear = y; vMonth = m;
  sel.clear();
  if (rest) rest.split(',').forEach(p => {
    const pb = p.endsWith('p');
    const ob = p.endsWith('o');
    const d  = parseInt((pb || ob) ? p.slice(0,-1) : p);
    const maxDay = new Date(y, m + 1, 0).getDate();
    if (!isNaN(d) && d >= 1 && d <= maxDay) sel.set(dateKey(y, m, d), pb ? 2 : ob ? 3 : 1);
  });
  return true;
}

function copyLink() {
  function showCopied() {
    const btn  = document.getElementById('copyLinkBtn');
    const icon = document.getElementById('copyIcon');
    const txt  = document.getElementById('copyBtnText');
    btn.classList.add('copied');
    icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
    txt.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      icon.innerHTML = '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>';
      txt.textContent = 'Copy Link';
    }, 2000);
  }
  function fallbackCopy() {
    const tmp = document.createElement('input');
    tmp.value = location.href;
    document.body.appendChild(tmp);
    tmp.select();
    try { document.execCommand('copy'); showCopied(); } catch {}
    document.body.removeChild(tmp);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(location.href).then(showCopied).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

// ─── Calendar ────────────────────────────────────────────────────────────────
const DAY_FULL_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MODE_LABELS = { 1: 'peak in, off-peak out', 2: 'peak both ways', 3: 'off-peak both ways' };

function renderCalendar() {
  const today = getToday();
  document.getElementById('monthLabel').textContent = `${MONTHS[vMonth]} ${vYear}`;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', `${MONTHS[vMonth]} ${vYear}`);

  const hdrRow = document.createElement('div');
  hdrRow.className = 'cal-row';
  hdrRow.setAttribute('role', 'row');
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((lbl, i) => {
    const el = document.createElement('div');
    el.className = 'day-hdr' + (i >= 5 ? ' we' : '');
    el.textContent = lbl;
    el.setAttribute('role', 'columnheader');
    hdrRow.appendChild(el);
  });
  grid.appendChild(hdrRow);

  const firstDow = new Date(vYear, vMonth, 1).getDay();
  const blanks   = (firstDow + 6) % 7;
  const daysIn   = new Date(vYear, vMonth + 1, 0).getDate();
  const isCurMon = vYear === today.getFullYear() && vMonth === today.getMonth();

  let weekRow = document.createElement('div');
  weekRow.className = 'cal-row';
  weekRow.setAttribute('role', 'row');
  let cellsInRow = 0;

  for (let i = 0; i < blanks; i++) {
    const b = document.createElement('div');
    b.className = 'day blank';
    b.setAttribute('role', 'gridcell');
    b.setAttribute('aria-hidden', 'true');
    weekRow.appendChild(b);
    cellsInRow++;
  }

  const dayEls = [];

  for (let d = 1; d <= daysIn; d++) {
    const date    = new Date(vYear, vMonth, d);
    const dow     = date.getDay();
    const key     = dateKey(vYear, vMonth, d);
    const we      = isWeekend(dow);
    const past    = isCurMon && date < today;
    const isToday = date.getTime() === today.getTime();
    const hol     = isHoliday(vYear, vMonth, d);
    const dayName = DAY_FULL_NAMES[dow];

    const el = document.createElement('button');
    el.type = 'button';

    function refreshCell() {
      const m = sel.get(key) || 0;
      el.className = ['day',
        we      ? 'we'        : '',
        past    ? 'past'      : '',
        hol     ? 'holiday'   : '',
        m       ? 'on'           : '',
        m === 2 ? 'peak-both'   : '',
        m === 3 ? 'offpeak-both': '',
        isToday ? 'today'       : '',
      ].filter(Boolean).join(' ');
      el.setAttribute('aria-selected', m ? 'true' : 'false');
      let label = `${dayName}, ${MONTHS[vMonth]} ${d}`;
      if (hol) label += `, ${holName(vYear, vMonth, d)}`;
      if (m) label += `, selected: ${MODE_LABELS[m]}`;
      el.setAttribute('aria-label', label);
    }
    refreshCell();
    el.textContent = d;
    if (hol) el.title = holName(vYear, vMonth, d);

    el.setAttribute('tabindex', dayEls.length === 0 ? '0' : '-1');

    el.addEventListener('click', () => {
      sel.has(key) ? sel.delete(key) : sel.set(key, defaultMode);
      refreshCell(); persist();
    });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (!sel.has(key) || we) return;
      const cur = sel.get(key);
      sel.set(key, cur === 1 ? 2 : cur === 2 ? 3 : 1);
      refreshCell(); persist();
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (e.shiftKey && sel.has(key) && !we) {
          const cur = sel.get(key);
          sel.set(key, cur === 1 ? 2 : cur === 2 ? 3 : 1);
        } else {
          sel.has(key) ? sel.delete(key) : sel.set(key, defaultMode);
        }
        refreshCell(); persist();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = dayEls.indexOf(el);
        const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
        const nextIdx = idx + delta;
        if (nextIdx >= 0 && nextIdx < dayEls.length) {
          dayEls[idx].setAttribute('tabindex', '-1');
          dayEls[nextIdx].setAttribute('tabindex', '0');
          dayEls[nextIdx].focus();
        }
      }
    });
    let pt;
    el.addEventListener('touchstart', () => {
      if (!sel.has(key) || we) return;
      pt = setTimeout(() => {
        const cur = sel.get(key);
        sel.set(key, cur === 1 ? 2 : cur === 2 ? 3 : 1);
        refreshCell(); persist();
      }, 500);
    }, { passive: true });
    el.addEventListener('touchend',  () => clearTimeout(pt), { passive: true });
    el.addEventListener('touchmove', () => clearTimeout(pt), { passive: true });

    el.setAttribute('role', 'gridcell');
    dayEls.push(el);
    weekRow.appendChild(el);
    cellsInRow++;
    if (cellsInRow === 7) {
      grid.appendChild(weekRow);
      weekRow = document.createElement('div');
      weekRow.className = 'cal-row';
      weekRow.setAttribute('role', 'row');
      cellsInRow = 0;
    }
  }
  // Pad the last row and append it
  if (cellsInRow > 0) {
    while (cellsInRow < 7) {
      const pad = document.createElement('div');
      pad.className = 'day blank';
      pad.setAttribute('role', 'gridcell');
      pad.setAttribute('aria-hidden', 'true');
      weekRow.appendChild(pad);
      cellsInRow++;
    }
    grid.appendChild(weekRow);
  }
}

function persist() { saveToStorage(); updateURL(); updateCosts(); }

// ─── Auto-select Tue/Wed/Thu (skipping holidays) ─────────────────────────────
// Day patterns: key → set of JS day-of-week numbers (0=Sun, 6=Sat)
const DAY_PATTERNS = {
  twt:   new Set([2, 3, 4]),       // Tue, Wed, Thu
  mwf:   new Set([1, 3, 5]),       // Mon, Wed, Fri
  mtwtf: new Set([1, 2, 3, 4, 5]), // Mon–Fri
};
let activePattern = null;

function selectPattern(patternKey) {
  if (patternKey === 'clear') {
    sel.clear();
    activePattern = null;
    updatePatternButtons();
    renderCalendar(); persist();
    saveSettings();
    return;
  }
  const days = DAY_PATTERNS[patternKey];
  if (!days) return;
  activePattern = patternKey;
  sel.clear();
  const today    = getToday();
  const daysIn   = new Date(vYear, vMonth + 1, 0).getDate();
  const isCurMon = vYear === today.getFullYear() && vMonth === today.getMonth();
  for (let d = 1; d <= daysIn; d++) {
    const date = new Date(vYear, vMonth, d);
    if (!days.has(date.getDay())) continue;
    if (isCurMon && date < today) continue;
    if (isHoliday(vYear, vMonth, d)) continue;
    sel.set(dateKey(vYear, vMonth, d), defaultMode);
  }
  updatePatternButtons();
  renderCalendar(); persist();
  saveSettings();
}

function updatePatternButtons() {
  document.querySelectorAll('.cal-actions .chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pattern === activePattern);
  });
}

// ─── Default trip mode ──────────────────────────────────────────────────────
let defaultMode = 1;

function setDefaultMode(mode) {
  defaultMode = mode;
  updateModeButtons();
  saveSettings();
}

function updateModeButtons() {
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.mode === defaultMode);
  });
}

// Backwards compat alias
function selectTWT() { selectPattern('twt'); }
function clearAll() { selectPattern('clear'); }

// ─── Month navigation ────────────────────────────────────────────────────────
function changeMonth(delta) {
  vMonth += delta;
  if (vMonth < 0)  { vMonth = 11; vYear--; }
  if (vMonth > 11) { vMonth = 0;  vYear++; }
  sel.clear();
  if (!loadFromStorage()) selectTWT();
  else { renderCalendar(); updateURL(); updateCosts(); }
}

// ─── Cost calculation ────────────────────────────────────────────────────────
function dayCost(mode, we) {
  if (we)         return fares.offpeakOw * 2;
  if (mode === 2) return fares.peakOw * 2;
  if (mode === 3) return fares.offpeakOw * 2;
  return fares.peakOw + fares.offpeakOw;
}

function calcCosts() {
  let wdDays = 0, weDays = 0, peakBothDays = 0, offpeakBothDays = 0, indTotal = 0, dpTotal = 0;
  sel.forEach((mode, k) => {
    const [y,m,d] = k.split('|').map(Number);
    const we = isWeekend(new Date(y,m,d).getDay());
    we ? weDays++ : wdDays++;
    if (mode === 2) peakBothDays++;
    if (mode === 3) offpeakBothDays++;
    indTotal += dayCost(mode, we);
    dpTotal  += we ? fares.dayPassWe : fares.dayPassWd;
  });
  const total = wdDays + weDays;
  if (!total) return null;

  const defaultTrip = fares.peakOw + fares.offpeakOw;

  const weekMap = {};
  sel.forEach((mode, k) => {
    const [y,m,d] = k.split('|').map(Number);
    const date = new Date(y,m,d), dow = date.getDay();
    const mon = new Date(date);
    mon.setDate(mon.getDate() - (dow+6)%7);
    const wk = `${mon.getFullYear()}|${mon.getMonth()}|${mon.getDate()}`;
    if (!weekMap[wk]) weekMap[wk] = { cost:0, count:0 };
    weekMap[wk].cost  += dayCost(mode, isWeekend(dow));
    weekMap[wk].count++;
  });

  let weeklyCombo = 0, passesUsed = 0;
  Object.values(weekMap).forEach(({ cost, count }) => {
    if (count >= 5 && fares.weekly < cost) { weeklyCombo += fares.weekly; passesUsed++; }
    else weeklyCombo += cost;
  });

  return { total, wdDays, weDays, peakBothDays, offpeakBothDays, defaultTrip,
           monthly: fares.monthly, individual: indTotal, dayPasses: dpTotal,
           weeklyCombo, passesUsed };
}

// ─── Render cost panel ───────────────────────────────────────────────────────
function updateCosts() {
  const c = calcCosts();
  const panel = document.getElementById('panelContent');
  panel.textContent = '';

  if (!c) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = '🗓';
    const p = document.createElement('p');
    p.textContent = 'Click days on the calendar to see your ticket cost comparison';
    empty.append(icon, p);
    panel.append(empty);
    updateProjection();
    return;
  }

  const { total, wdDays, weDays, peakBothDays, offpeakBothDays, defaultTrip,
          monthly, individual, dayPasses, weeklyCombo, passesUsed } = c;
  const normalDays = wdDays - peakBothDays - offpeakBothDays;

  const noteParts = [];
  if (normalDays > 0)      noteParts.push(`${normalDays} × ${fmt(fares.peakOw+fares.offpeakOw)} (peak in/off-peak out)`);
  if (peakBothDays > 0)    noteParts.push(`${peakBothDays} × ${fmt(fares.peakOw*2)} (peak both)`);
  if (offpeakBothDays > 0) noteParts.push(`${offpeakBothDays} × ${fmt(fares.offpeakOw*2)} (off-peak both)`);
  if (weDays > 0)          noteParts.push(`${weDays} weekend × ${fmt(fares.offpeakOw*2)}`);
  let indNote = noteParts.join(', ');
  indNote += ' — buy via TrainTime app to skip $6.50 on-board fee';

  const weeklyLabel = passesUsed > 0
    ? `${passesUsed} Weekly Pass${passesUsed>1?'es':''} + Individual` : 'Weekly + Individual';
  const weeklyNote  = passesUsed > 0
    ? `${passesUsed} weekly pass${passesUsed>1?'es':''} cover weeks with 5+ days; individual for the rest`
    : `No single week has 5+ days — weekly pass (${fmt(fares.weekly)}) doesn't help at this usage`;

  const allOpts = [
    { id:'monthly',    name:'Monthly Pass',        cost:monthly,     note:'Unlimited rides all month' },
    { id:'individual', name:'Individual One-Ways',  cost:individual,  note:indNote },
    { id:'daypass',    name:'Day Passes',            cost:dayPasses,   note:`Unlimited same-day travel — ${fmt(fares.dayPassWd)}/weekday${weDays>0?`, ${fmt(fares.dayPassWe)}/weekend (same as RT — saves only on 3+ trips/day)`:''}` },
    { id:'weekly',     name:weeklyLabel,             cost:weeklyCombo, note:weeklyNote },
  ];

  const order = ['monthly','individual','weekly','daypass'];
  allOpts.sort((a,b) => Math.abs(a.cost-b.cost)<0.005
    ? order.indexOf(a.id)-order.indexOf(b.id) : a.cost-b.cost);

  const best = allOpts[0].cost;
  let sub = wdDays > 0 ? `${wdDays} weekday` : '';
  if (peakBothDays > 0) sub += ` (${peakBothDays} peak out)`;
  if (weDays > 0) sub += `${sub?' + ':''}${weDays} weekend`;

  const tally = document.createElement('div');
  tally.className = 'tally';
  tally.append(document.createTextNode(String(total)));
  const tallySpan = document.createElement('span');
  tallySpan.textContent = `day${total!==1?'s':''} selected`;
  tally.append(tallySpan);

  const tallySub = document.createElement('div');
  tallySub.className = 'tally-sub';
  tallySub.textContent = sub;

  const divider = document.createElement('div');
  divider.className = 'divider';

  const options = document.createElement('div');
  options.className = 'options';

  allOpts.forEach((opt, i) => {
    const isBest = i === 0;
    const delta = opt.cost - best;
    const isWorst = i === allOpts.length - 1 && delta > 5;

    const optDiv = document.createElement('div');
    optDiv.className = 'opt' + (isBest ? ' best' : '') + (isWorst ? ' worst' : '');

    if (isBest) {
      const badge = document.createElement('div');
      badge.className = 'opt-badge';
      badge.textContent = 'Best Value';
      optDiv.append(badge);
    }

    const row = document.createElement('div');
    row.className = 'opt-row';
    const num = document.createElement('div');
    num.className = 'opt-num';
    num.textContent = `#${i+1}`;
    const name = document.createElement('div');
    name.className = 'opt-name';
    name.textContent = opt.name;
    const price = document.createElement('div');
    price.className = 'opt-price';
    price.textContent = fmt(opt.cost);
    row.append(num, name, price);

    const note = document.createElement('div');
    note.className = 'opt-note';
    note.textContent = opt.note;

    optDiv.append(row, note);

    if (!isBest && delta > 0.005) {
      const deltaDiv = document.createElement('div');
      deltaDiv.className = 'opt-delta';
      deltaDiv.textContent = `+${fmt(delta)} vs best option`;
      optDiv.append(deltaDiv);
    } else if (!isBest && delta <= 0.005) {
      const deltaDiv = document.createElement('div');
      deltaDiv.className = 'opt-delta';
      deltaDiv.style.color = 'var(--accent)';
      deltaDiv.textContent = 'Tied for best value';
      optDiv.append(deltaDiv);
    }

    options.append(optDiv);
  });

  const avgTripCost = wdDays > 0 ? (individual - weDays * dayCost(1, true)) / wdDays : defaultTrip;
  const breakeven = Math.ceil(fares.monthly / avgTripCost);
  const toBreak   = breakeven - wdDays;

  const insightBox = document.createElement('div');
  insightBox.className = 'insight-box';

  const ICONS = {
    tip:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
    calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    chart:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    phone:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r=".5" fill="currentColor"/></svg>`,
    check:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    info:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    tag:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" stroke-width="3"/></svg>`,
  };

  function makeInsightRow(iconKey, ...parts) {
    const row = document.createElement('div');
    row.className = 'insight-row';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'insight-icon';
    iconSpan.innerHTML = ICONS[iconKey] ?? '';
    const textSpan = document.createElement('span');
    parts.forEach(part => {
      if (typeof part === 'string') {
        textSpan.append(document.createTextNode(part));
      } else {
        const el = document.createElement(part[0]);
        el.textContent = part[1];
        textSpan.append(el);
      }
    });
    row.append(iconSpan, textSpan);
    return row;
  }

  const bestOpt = allOpts[0];
  const runnerUp = allOpts.length > 1 ? allOpts[1] : null;
  const nearTie = runnerUp && (runnerUp.cost - bestOpt.cost) <= 5 && (runnerUp.cost - bestOpt.cost) > 0.005;

  if (wdDays === 0) {
    insightBox.append(makeInsightRow('tip', 'Only weekend days — off-peak fares both ways.'));
  } else if (bestOpt.id === 'individual') {
    insightBox.append(makeInsightRow('tip', 'Individual tickets save ', ['strong', fmt(monthly - individual)], ' vs monthly for this selection.'));
    if (toBreak > 0 && toBreak <= 6)
      insightBox.append(makeInsightRow('calendar', 'Add ', ['strong', `${toBreak} more weekday${toBreak!==1?'s':''}`], ' and the monthly pass becomes cheapest.'));
  } else if (bestOpt.id === 'monthly') {
    insightBox.append(makeInsightRow('check', 'Monthly pass saves ', ['strong', fmt(individual - monthly)], ' vs individual tickets.'));
  } else if (bestOpt.id === 'weekly') {
    insightBox.append(makeInsightRow('check', `${weeklyLabel} saves `, ['strong', fmt(individual - weeklyCombo)], ' vs individual tickets.'));
    if (passesUsed > 0)
      insightBox.append(makeInsightRow('tip', `${passesUsed} week${passesUsed>1?'s':''} with 5+ days get a weekly pass (${fmt(fares.weekly)}); remaining days bought individually.`));
  } else if (bestOpt.id === 'daypass') {
    insightBox.append(makeInsightRow('check', 'Day passes save ', ['strong', fmt(individual - dayPasses)], ' vs individual tickets.'));
    insightBox.append(makeInsightRow('tip', `Day passes (${fmt(fares.dayPassWd)}/weekday) beat round-trip tickets — useful if you make 3+ trips in a day.`));
  }

  if (nearTie) {
    const diff = fmt(runnerUp.cost - bestOpt.cost);
    const names = { monthly: 'Monthly pass', individual: 'Individual tickets', weekly: weeklyLabel, daypass: 'Day passes' };
    insightBox.append(makeInsightRow('info', `${names[runnerUp.id]} is only `, ['strong', diff], ' more — consider convenience.'));
  }

  // CityTicket awareness
  const fromSt = findStation(document.getElementById('fromStation')?.value || '');
  const toSt   = findStation(document.getElementById('toStation')?.value || '');
  if (weDays > 0 && fromSt && toSt && isCityTicketEligible(fromSt, toSt)) {
    insightBox.append(makeInsightRow('tag',
      'Weekend rides between City Zone stations qualify for ', ['strong', 'CityTicket'],
      ` (${fmt(7.25)} peak / ${fmt(5.25)} off-peak one-way) — buy at the station or via the MTA app.`));
  }

  insightBox.append(
    makeInsightRow('chart', 'Monthly breakeven: ', ['strong', `${breakeven} weekday trips`], ` (${fmt(fares.monthly)} ÷ ${fmt(avgTripCost)}/day).`),
    makeInsightRow('phone', 'Buy via ', ['strong', 'TrainTime app'], ' to avoid the $6.50 on-board surcharge.')
  );

  panel.append(tally, tallySub, divider, options, insightBox);
  updateProjection();
}

// ─── Multi-month projection ────────────────────────────────────────────────
function projectMonth(y, m, pattern, mode) {
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days = DAY_PATTERNS[pattern];
  if (!days) return null;
  let wdDays = 0, weDays = 0, indTotal = 0, dpTotal = 0;
  const weekMap = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    if (!days.has(date.getDay())) continue;
    if (isHoliday(y, m, d)) continue;
    const we = isWeekend(date.getDay());
    we ? weDays++ : wdDays++;
    indTotal += dayCost(mode, we);
    dpTotal  += we ? fares.dayPassWe : fares.dayPassWd;
    const dow = date.getDay();
    const mon = new Date(date);
    mon.setDate(mon.getDate() - (dow + 6) % 7);
    const wk = `${mon.getFullYear()}|${mon.getMonth()}|${mon.getDate()}`;
    if (!weekMap[wk]) weekMap[wk] = { cost: 0, count: 0 };
    weekMap[wk].cost += dayCost(mode, we);
    weekMap[wk].count++;
  }
  let weeklyCombo = 0;
  Object.values(weekMap).forEach(({ cost, count }) => {
    weeklyCombo += (count >= 5 && fares.weekly < cost) ? fares.weekly : cost;
  });
  const total = wdDays + weDays;
  if (!total) return null;
  const opts = [
    { id: 'monthly',    name: 'Monthly',    cost: fares.monthly },
    { id: 'individual', name: 'Individual', cost: indTotal },
    { id: 'daypass',    name: 'Day Passes', cost: dpTotal },
    { id: 'weekly',     name: 'Weekly Mix', cost: weeklyCombo },
  ];
  opts.sort((a, b) => a.cost - b.cost);
  return { total, wdDays, weDays, best: opts[0] };
}

function updateProjection() {
  const card = document.getElementById('projectionCard');
  const content = document.getElementById('projectionContent');
  if (!activePattern) { card.style.display = 'none'; return; }
  card.style.display = '';
  content.textContent = '';
  for (let offset = 0; offset < 3; offset++) {
    let py = vYear, pm = vMonth + offset;
    if (pm > 11) { pm -= 12; py++; }
    const proj = projectMonth(py, pm, activePattern, defaultMode);
    if (!proj) continue;
    const row = document.createElement('div');
    row.className = 'proj-row' + (offset === 0 ? ' proj-current' : '');
    row.addEventListener('click', () => {
      vYear = py; vMonth = pm;
      sel.clear();
      if (!loadFromStorage()) selectPattern(activePattern);
      else { renderCalendar(); updateURL(); updateCosts(); updatePatternButtons(); }
      document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
    });
    const left = document.createElement('div');
    const monthName = document.createElement('div');
    monthName.className = 'proj-month';
    monthName.textContent = `${MONTHS[pm]} ${py}`;
    const dayInfo = document.createElement('div');
    dayInfo.className = 'proj-days';
    dayInfo.textContent = `${proj.total} days (${proj.wdDays} weekday${proj.weDays ? `, ${proj.weDays} weekend` : ''})`;
    left.append(monthName, dayInfo);
    const right = document.createElement('div');
    right.className = 'proj-right';
    const cost = document.createElement('div');
    cost.className = 'proj-cost';
    cost.textContent = fmt(proj.best.cost);
    const bestLabel = document.createElement('div');
    bestLabel.className = 'proj-best';
    bestLabel.textContent = proj.best.name;
    right.append(cost, bestLabel);
    row.append(left, right);
    content.append(row);
  }
}

// ─── Fare editor ─────────────────────────────────────────────────────────────
function initFareEditor() {
  [['f-monthly','monthly'],['f-weekly','weekly'],['f-peak','peakOw'],
   ['f-offpeak','offpeakOw'],['f-dp-wd','dayPassWd'],['f-dp-we','dayPassWe']
  ].forEach(([id,key]) => {
    const inp = document.getElementById(id);
    inp.value = fares[key];
    inp.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v >= 0) { fares[key] = v; updatePerDayLabel(); updateCosts(); }
    });
  });
  const SVG_GEAR = `<svg id="fareToggleIcon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  const SVG_X_SM = `<svg id="fareToggleIcon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  document.getElementById('fareToggleBtn').addEventListener('click', () => {
    const ed = document.getElementById('fareEditor'), btn = document.getElementById('fareToggleBtn');
    const open = ed.classList.toggle('open');
    btn.innerHTML = open
      ? `${SVG_X_SM} <span id="fareToggleTxt">Close fare editor</span>`
      : `${SVG_GEAR} <span id="fareToggleTxt">Edit fare prices</span>`;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  updatePerDayLabel();
}

function updatePerDayLabel() {
  document.getElementById('perDayLabel').textContent = (fares.peakOw+fares.offpeakOw).toFixed(2);
}

// ─── Station selector ────────────────────────────────────────────────────────
function initStationSelector(savedFrom, savedTo) {
  const fromSel = document.getElementById('fromStation');
  const toSel   = document.getElementById('toStation');

  // Build optgroups by branch
  function populateSelect(sel, defaultStation) {
    sel.innerHTML = '';
    for (const [branch, stations] of Object.entries(LIRR_BRANCHES)) {
      const group = document.createElement('optgroup');
      group.label = branch;
      for (const s of stations) {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = `${s.name} (Zone ${s.zone})`;
        if (s.name === defaultStation) opt.selected = true;
        group.append(opt);
      }
      sel.append(group);
    }
  }

  populateSelect(fromSel, savedFrom || 'Hicksville');
  populateSelect(toSel, savedTo || 'Penn Station');

  function onStationChange() {
    const from = findStation(fromSel.value);
    const to   = findStation(toSel.value);
    if (!from || !to) return;

    // Update zone tags
    document.getElementById('fromZoneTag').textContent = `Zone ${from.zone} · ${from.branch}`;
    document.getElementById('toZoneTag').textContent   = `Zone ${to.zone} · ${to.branch}`;

    // Update header subtitle
    document.getElementById('headerSub').textContent =
      `${from.name} \u2192 ${to.name}  \u00b7  Zone ${from.zone} \u2192 ${to.zone}`;

    // Determine which zone to look up fares for.
    // Current fare table covers Zone 1 <-> other zone.
    let fareZone = null;
    if (from.zone === 1) fareZone = to.zone;
    else if (to.zone === 1) fareZone = from.zone;
    else {
      // Inter-zone trip not involving Zone 1
      document.getElementById('fromZoneTag').textContent += ' (inter-zone fares: use fare editor)';
      return;
    }

    const zoneFares = getFaresForZone(fareZone);
    if (!zoneFares) return;

    // Apply fares
    fares.monthly   = zoneFares.monthly;
    fares.weekly    = zoneFares.weekly;
    fares.peakOw    = zoneFares.peakOw;
    fares.offpeakOw = zoneFares.offpeakOw;
    fares.dayPassWd = zoneFares.dayPassWd;
    fares.dayPassWe = zoneFares.dayPassWe;

    // Sync fare editor inputs
    document.getElementById('f-monthly').value = fares.monthly;
    document.getElementById('f-weekly').value  = fares.weekly;
    document.getElementById('f-peak').value    = fares.peakOw;
    document.getElementById('f-offpeak').value = fares.offpeakOw;
    document.getElementById('f-dp-wd').value   = fares.dayPassWd;
    document.getElementById('f-dp-we').value   = fares.dayPassWe;

    updatePerDayLabel();
    updateCosts();
    saveSettings();
  }

  fromSel.addEventListener('change', onStationChange);
  toSel.addEventListener('change', onStationChange);

  // Swap button
  document.getElementById('swapBtn').addEventListener('click', () => {
    const tmp = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value = tmp;
    onStationChange();
  });

  // Initial load
  onStationChange();
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// Priority: URL hash > localStorage > ?preset= > generic defaults
const preset = getPreset();
const savedSettings = loadSettings();
// Merge: localStorage wins over preset, preset wins over defaults
const boot = {
  from:    savedSettings?.from    || preset?.from    || 'Hicksville',
  to:      savedSettings?.to      || preset?.to      || 'Penn Station',
  mode:    savedSettings?.mode    || preset?.mode    || 1,
  pattern: savedSettings?.pattern ?? preset?.pattern ?? null,
};
defaultMode = boot.mode;
activePattern = boot.pattern;
initStationSelector(boot.from, boot.to);
if (!loadFromURL()) {
  initView();
  if (!loadFromStorage()) {
    if (activePattern) selectPattern(activePattern);
    else if (preset) selectPattern(preset.pattern || 'twt');
    else selectTWT();
  }
  else { renderCalendar(); updateURL(); updateCosts(); updatePatternButtons(); }
} else {
  renderCalendar(); updateURL(); updateCosts(); updatePatternButtons();
}
initFareEditor();

(function() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const gesture = isTouch ? 'long-press' : 'right-click';
  document.getElementById('peakBothLegend').lastChild.textContent    = `Peak in, peak out (${gesture} to cycle)`;
  document.getElementById('offpeakBothLegend').lastChild.textContent = `Off-peak both ways (${gesture} to cycle)`;
})();

document.getElementById('prevBtn').addEventListener('click', () => changeMonth(-1));
document.getElementById('nextBtn').addEventListener('click', () => changeMonth(1));
document.querySelectorAll('[data-pattern]').forEach(btn => {
  btn.addEventListener('click', () => selectPattern(btn.dataset.pattern));
});
document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => setDefaultMode(+btn.dataset.mode));
});
updateModeButtons();
document.getElementById('copyLinkBtn').addEventListener('click', copyLink);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
