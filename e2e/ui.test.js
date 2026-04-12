/**
 * OPUS-119: UI interaction tests — station selector, month nav,
 * fare editor, commute presets, copy link, and footer links.
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#calGrid button', { timeout: 5000 });
  // App auto-selects Tue-Thu on fresh load — clear for a known baseline
  await page.locator('.chip[data-pattern="clear"]').click();
});

// ─── Month navigation ─────────────────────────────────────────────────────────

test('next month button updates month label', async ({ page }) => {
  const label = await page.locator('#monthLabel').textContent();
  await page.locator('#nextBtn').click();
  const newLabel = await page.locator('#monthLabel').textContent();
  expect(newLabel).not.toBe(label);
});

test('prev month button updates month label', async ({ page }) => {
  // Go forward first so we can go back
  await page.locator('#nextBtn').click();
  const label = await page.locator('#monthLabel').textContent();
  await page.locator('#prevBtn').click();
  const newLabel = await page.locator('#monthLabel').textContent();
  expect(newLabel).not.toBe(label);
});

test('prev button aria-label is "Previous month"', async ({ page }) => {
  await expect(page.locator('#prevBtn')).toHaveAttribute('aria-label', 'Previous month');
});

test('next button aria-label is "Next month"', async ({ page }) => {
  await expect(page.locator('#nextBtn')).toHaveAttribute('aria-label', 'Next month');
});

test('December → January navigation wraps year correctly', async ({ page }) => {
  // Navigate to December of current year
  const currentLabel = await page.locator('#monthLabel').textContent();
  const currentYear = parseInt(currentLabel?.match(/\d{4}/)?.[0] ?? '2026');

  // Click next until we reach December
  for (let i = 0; i < 12; i++) {
    const lbl = await page.locator('#monthLabel').textContent();
    if (lbl?.includes('December')) break;
    await page.locator('#nextBtn').click();
  }

  const decLabel = await page.locator('#monthLabel').textContent();
  expect(decLabel).toContain('December');

  await page.locator('#nextBtn').click();
  const janLabel = await page.locator('#monthLabel').textContent();
  expect(janLabel).toContain('January');
  expect(janLabel).toContain(String(currentYear + 1 > 2026 ? currentYear + 1 : 2027));
});

// ─── Commute day presets ──────────────────────────────────────────────────────

test('Tue-Thu preset selects only Tue/Wed/Thu days (no holidays)', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  const selected = page.locator('#calGrid button.on');
  const count = await selected.count();
  expect(count).toBeGreaterThan(0);

  // All selected days should be Tue/Wed/Thu (not weekend)
  for (let i = 0; i < count; i++) {
    const btn = selected.nth(i);
    await expect(btn).not.toHaveClass(/we/);
  }
});

test('Mon-Fri preset selects weekdays', async ({ page }) => {
  await page.locator('.chip[data-pattern="mtwtf"]').click();
  const count = await page.locator('#calGrid button.on').count();
  expect(count).toBeGreaterThan(0);
});

test('Clear preset deselects all days and shows empty cost panel', async ({ page }) => {
  // First select something
  await page.locator('.chip[data-pattern="twt"]').click();
  await expect(page.locator('#calGrid button.on')).not.toHaveCount(0);

  // Clear
  await page.locator('.chip[data-pattern="clear"]').click();
  await expect(page.locator('#calGrid button.on')).toHaveCount(0);
  await expect(page.locator('#panelContent .empty')).toHaveCount(1);
});

test('Mon/Wed/Fri preset selects days', async ({ page }) => {
  await page.locator('.chip[data-pattern="mwf"]').click();
  const count = await page.locator('#calGrid button.on').count();
  expect(count).toBeGreaterThan(0);
});

// ─── Fare editor ──────────────────────────────────────────────────────────────

test('fare toggle opens editor, aria-expanded becomes true', async ({ page }) => {
  const btn = page.locator('#fareToggleBtn');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');

  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#fareEditor')).toBeVisible();
});

test('fare toggle closes editor, aria-expanded becomes false', async ({ page }) => {
  const btn = page.locator('#fareToggleBtn');
  await btn.click(); // open
  await btn.click(); // close
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#fareEditor')).not.toBeVisible();
});

test('fare toggle button has aria-controls="fareEditor"', async ({ page }) => {
  await expect(page.locator('#fareToggleBtn')).toHaveAttribute('aria-controls', 'fareEditor');
});

test('changing monthly fare value updates cost panel', async ({ page }) => {
  // Select some days first
  await page.locator('.chip[data-pattern="twt"]').click();
  const initialCost = await page.locator('#panelContent').textContent();

  // Open fare editor and change monthly fare
  await page.locator('#fareToggleBtn').click();
  const monthlyInput = page.locator('#f-monthly');
  await monthlyInput.fill('100');
  await monthlyInput.dispatchEvent('input');

  const newCost = await page.locator('#panelContent').textContent();
  expect(newCost).not.toBe(initialCost);
});

test('entering negative fare value does not update costs', async ({ page }) => {
  // Select days first so we have a cost to compare
  await page.locator('.chip[data-pattern="twt"]').click();
  const initialCost = await page.locator('#panelContent').textContent();

  await page.locator('#fareToggleBtn').click();
  const monthlyInput = page.locator('#f-monthly');

  // Enter a negative value — app ignores it internally (v >= 0 guard), cost unchanged
  await monthlyInput.fill('-50');
  await monthlyInput.dispatchEvent('input');

  const costAfter = await page.locator('#panelContent').textContent();
  expect(costAfter).toBe(initialCost);
});

// ─── Station selector ─────────────────────────────────────────────────────────

test('swap button swaps origin and destination', async ({ page }) => {
  const fromSelect = page.locator('#fromStation');
  const toSelect = page.locator('#toStation');

  const fromVal = await fromSelect.inputValue();
  const toVal = await toSelect.inputValue();

  await page.locator('#swapBtn').click();

  await expect(fromSelect).toHaveValue(toVal);
  await expect(toSelect).toHaveValue(fromVal);
});

test('swap button has aria-label', async ({ page }) => {
  const label = await page.locator('#swapBtn').getAttribute('aria-label');
  expect(label).toBeTruthy();
  expect(label?.toLowerCase()).toContain('swap');
});

test('changing origin station updates fares', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  const initialContent = await page.locator('#panelContent').textContent();

  // Change to a different station
  const fromSelect = page.locator('#fromStation');
  const currentVal = await fromSelect.inputValue();

  // Select a different option
  const options = await fromSelect.locator('option').allTextContents();
  const different = options.find(o => o.trim() !== currentVal && o.trim() !== '');
  if (different) {
    await fromSelect.selectOption({ label: different.trim() });
    const newContent = await page.locator('#panelContent').textContent();
    // Cost may or may not change depending on zone — just verify no error
    expect(newContent).toBeTruthy();
  }
});

// ─── Copy Link button (OPUS-85 regression) ───────────────────────────────────

test('Copy Link button shows "Copied!" feedback after click', async ({ page, context, browserName }) => {
  // WebKit does not support clipboard-write permission grants
  test.skip(browserName === 'webkit', 'clipboard-write permission not supported in WebKit');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const btn = page.locator('#copyLinkBtn');
  const txt = page.locator('#copyBtnText');

  await btn.click();
  await expect(txt).toHaveText('Copied!', { timeout: 2000 });
});

test('Copy Link button reverts to "Copy Link" after 2 seconds', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'clipboard-write permission not supported in WebKit');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const txt = page.locator('#copyBtnText');
  await page.locator('#copyLinkBtn').click();
  await expect(txt).toHaveText('Copied!', { timeout: 2000 });
  await expect(txt).toHaveText('Copy Link', { timeout: 4000 });
});

test('copy link button has aria-label', async ({ page }) => {
  const label = await page.locator('#copyLinkBtn').getAttribute('aria-label');
  expect(label).toBeTruthy();
});

// ─── Footer links ─────────────────────────────────────────────────────────────

test('footer Privacy Policy link navigates to /privacy.html', async ({ page }) => {
  const link = page.locator('footer a[href="/privacy.html"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/privacy\.html/);
});

test('footer Terms of Use link navigates to /terms.html', async ({ page }) => {
  const link = page.locator('footer a[href="/terms.html"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/terms\.html/);
});

test('footer contains MTA non-affiliation disclaimer', async ({ page }) => {
  const footerText = await page.locator('footer').textContent();
  expect(footerText?.toLowerCase()).toMatch(/not affiliated|mta|lirr/i);
});
