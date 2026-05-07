# LIRR Ticket Calculator

Compare the cost of a monthly LIRR pass vs. individual tickets, day passes, and weekly passes for any station pair and commute pattern.

**Live:** https://lirr-ticket-calculator.vercel.app

---

## What it does

Select your origin and destination stations, pick your commute days, and the app calculates and ranks four ticket options for the month:

1. **Individual tickets** — peak and/or off-peak one-ways per your trip mode
2. **Weekly pass + individual** — optimal number of weekly passes plus individual tickets for remaining days
3. **Day passes** — weekday or weekend day passes per commute day
4. **Monthly pass** — unlimited rides for the calendar month

The cheapest option is highlighted. The app also shows how many more weekday trips it would take to flip the result, the monthly breakeven point, and a **3-month projection** based on your current commute pattern.

---

## Fare coverage

Supports all LIRR zone pairs across the full MTA fare matrix:

- Zones 1, 3, 4, 7, 9, 10, 12, 14
- All 36 zone pair combinations
- Source: MTA document 194866, effective January 4, 2026

Fares are editable in the app via **Edit fare prices** at the bottom of the page. The `FARE_METADATA.lastVerified` field in `lirr-data.js` reflects when fares were last cross-checked against the MTA's published schedule.

### Automated fare verification

A local scheduled task (`lirr-fare-check`) runs on the 1st of each month. It reads `lirr-data.js`, checks each zone's fares against MTA's published schedule, and either updates `lastVerified` (if unchanged) or opens a Linear issue listing discrepancies (if fares have changed).

---

## Features

- **Station selector** — choose any origin and destination; fares are looked up by zone pair automatically
- **Commute pattern presets** — one-click presets for Tue–Thu, Mon/Wed/Fri, and Mon–Fri
- **Three trip modes** — Peak in / Off-peak out, Peak both ways, Off-peak both ways; set a default and right-click (or long-press on mobile) any selected day to cycle through modes
- **Holiday exclusion** — federal holidays are automatically skipped in presets and marked with a red dot on the calendar
- **3-month projection** — estimates costs for the current and next two months based on your commute pattern; click any month to jump to it
- **Insights** — contextual callouts explaining the result, breakeven math, and whether buying via the TrainTime app avoids the on-board surcharge
- **Persistence** — selections are saved per month in `localStorage`
- **Shareable links** — the URL hash updates on every change; Copy Link in the header restores the exact month, stations, and day selections
- **PWA / installable** — add to home screen for a native app feel; works fully offline via service worker
- **Security hardened** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers set via `vercel.json`
- **Accessible** — passes axe-core WCAG checks with zero exclusions

---

## Running the app

**Online:** https://lirr-ticket-calculator.vercel.app

**Locally:** No build step required.

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

The service worker skips caching on localhost so changes are always reflected immediately on hard refresh (`Cmd+Shift+R`).

---

## Tests

```bash
npm test           # Vitest unit tests (fare logic, date helpers, cost calculations)
npm run test:e2e   # Playwright E2E tests (calendar, UI, PWA, accessibility)
npm run test:a11y  # axe-core accessibility checks only
```

Unit tests live in `src/__tests__/`. E2E tests live in `e2e/`.

---

## Project structure

```
index.html       # App shell, all CSS
app.js           # UI logic, calendar rendering, cost calculations
lirr-data.js     # Fare table, station list, zone mappings, fare metadata
sw.js            # Service worker (cache-first in production, bypass on localhost)
src/
  calc.js        # Pure calculation functions (extracted for unit testing)
  __tests__/     # Vitest unit tests
e2e/             # Playwright E2E and accessibility tests
vercel.json      # Deployment config and security headers
```
