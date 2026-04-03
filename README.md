# LIRR Ticket Calculator

A personal commute cost calculator for deciding whether a monthly LIRR pass or individual tickets is the better deal in a given month.

**Live:** https://lirr-ticket-calculator.vercel.app

---

## ⚠️ Built for a specific use case

This tool is **not a general-purpose LIRR calculator**. It was built around one commuter's exact conditions. All fare logic, defaults, and comparisons are hardcoded to those conditions. See below.

---

## Hardcoded conditions

| Parameter | Value |
|---|---|
| Origin | Hicksville |
| Destination | Penn Station (New York) |
| Fare zone | Zone 7 |
| Default commute days | Tuesday, Wednesday, Thursday |
| Inbound fare type | **Peak** (arrives NYC 6–10am) |
| Outbound fare type | **Off-peak** (departs NYC after 8pm) |
| Per-day default cost | $26.50 (peak in + off-peak out) |

### Fare prices (effective January 4, 2026)

| Ticket type | Price |
|---|---|
| Monthly pass | $299.75 |
| Weekly pass | $106.50 |
| Peak one-way | $15.25 |
| Off-peak one-way | $11.25 |
| Weekday Day Pass | $27.45 |
| Weekend Day Pass | $22.50 |
| On-board surcharge | +$6.50 |

Fares are editable in the app via the "Edit fare prices" section at the bottom of the page, in case the MTA updates them.

---

## What it does

1. Displays a monthly calendar defaulting to the current or upcoming month
2. Pre-selects all Tuesdays, Wednesdays, and Thursdays (skipping federal holidays)
3. Lets you click any day to toggle it on or off
4. Calculates the total cost of four options for the selected days:
   - Monthly pass
   - Individual one-way tickets (peak in + off-peak out)
   - Day passes
   - Optimal weekly pass combination + individual for remaining days
5. Ranks all options cheapest to most expensive and highlights the best value
6. Shows how far the current selection is from the monthly breakeven point (12 weekday trips)

### Breakeven
Monthly becomes cheaper than individual one-ways at **12 or more weekday trips** in a month ($299.75 ÷ $26.50/day).

---

## Features

- **Holiday exclusion** — federal holidays are automatically skipped during T/W/T pre-selection and marked with a red dot on the calendar (hover for the holiday name)
- **Peak-out override** — right-click (or long-press on mobile) a selected weekday to mark it as peak both ways ($30.50 instead of $26.50). Right-click again to revert
- **Persistence** — selections are saved per month in `localStorage`, so closing and reopening the tab restores your work
- **Shareable links** — the URL hash updates on every change; the "Copy Link" button in the header copies a link that restores the exact month and day selections

---

## Future plans

A public version of this tool is planned that will support any LIRR zone, route, and commute pattern — not just this specific setup. This repo serves as the foundation for that work.

---

## Running the app

**Online (no setup):** https://lirr-ticket-calculator.vercel.app

**Offline / locally:** No build step required. Open `index.html` directly in a browser, or serve it with:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Both options are fully functional. The app has no server-side dependencies — everything runs in the browser.
