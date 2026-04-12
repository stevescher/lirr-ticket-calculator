/**
 * E2E tests for 3-month projection panel and preset URL parameters.
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#calGrid button', { timeout: 5000 });
});

// ─── 3-Month Projection ─────────────────────────────────────────────────────

test('projection card is hidden when no pattern is active', async ({ page }) => {
  await page.locator('.chip[data-pattern="clear"]').click();
  await expect(page.locator('#projectionCard')).toBeHidden();
});

test('projection card appears when a pattern preset is selected', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  await expect(page.locator('#projectionCard')).toBeVisible();
});

test('projection shows 3 months', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  const rows = page.locator('#projectionContent .proj-row');
  await expect(rows).toHaveCount(3);
});

test('first projection row is highlighted as current', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  const first = page.locator('#projectionContent .proj-row').first();
  await expect(first).toHaveClass(/proj-current/);
});

test('projection rows show month name and cost', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  const rows = page.locator('#projectionContent .proj-row');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const monthText = await row.locator('.proj-month').textContent();
    expect(monthText).toMatch(/\w+ \d{4}/); // e.g. "May 2026"
    const costText = await row.locator('.proj-cost').textContent();
    expect(costText).toMatch(/\$[\d.]+/);
  }
});

test('clicking a projection row navigates to that month', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  const secondRow = page.locator('#projectionContent .proj-row').nth(1);
  const targetMonth = await secondRow.locator('.proj-month').textContent();
  await secondRow.click();

  const monthLabel = await page.locator('#monthLabel').textContent();
  expect(monthLabel).toBe(targetMonth);
});

test('projection updates when switching patterns', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  const twtDays = await page.locator('#projectionContent .proj-row').first().locator('.proj-days').textContent();

  await page.locator('.chip[data-pattern="mtwtf"]').click();
  const mtwtfDays = await page.locator('#projectionContent .proj-row').first().locator('.proj-days').textContent();

  // Mon-Fri has more days than Tue-Thu
  expect(mtwtfDays).not.toBe(twtDays);
});

test('projection hides when clear is clicked', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  await expect(page.locator('#projectionCard')).toBeVisible();

  await page.locator('.chip[data-pattern="clear"]').click();
  await expect(page.locator('#projectionCard')).toBeHidden();
});

// ─── Preset URL parameter ────────────────────────────────────────────────────

test('?preset=daniela loads Hicksville→Penn Station with Tue-Thu', async ({ page }) => {
  await page.goto('/?preset=daniela');
  await page.waitForSelector('#calGrid button', { timeout: 5000 });

  await expect(page.locator('#fromStation')).toHaveValue('Hicksville');
  await expect(page.locator('#toStation')).toHaveValue('Penn Station');

  // Tue-Thu preset should be active
  await expect(page.locator('.chip[data-pattern="twt"]')).toHaveClass(/active/);

  // Days should be selected
  const selected = await page.locator('#calGrid button.on').count();
  expect(selected).toBeGreaterThan(0);
});

test('?preset=unknown falls back to defaults', async ({ page }) => {
  await page.goto('/?preset=nonexistent');
  await page.waitForSelector('#calGrid button', { timeout: 5000 });

  // Should still load without errors
  await expect(page.locator('#calGrid')).toBeVisible();
  await expect(page.locator('#panelContent')).toBeVisible();
});

// ─── Default mode chips ──────────────────────────────────────────────────────

test('default mode chip changes newly selected days', async ({ page }) => {
  await page.locator('.chip[data-pattern="clear"]').click();

  // Switch to off-peak both mode
  await page.locator('[data-mode="3"]').click();
  await expect(page.locator('[data-mode="3"]')).toHaveClass(/active/);

  // Select Tue-Thu — new days should use mode 3
  await page.locator('.chip[data-pattern="twt"]').click();
  const selected = page.locator('#calGrid button.on');
  const count = await selected.count();
  expect(count).toBeGreaterThan(0);

  // At least one should have offpeak-both class
  const offpeakCount = await page.locator('#calGrid button.on.offpeak-both').count();
  expect(offpeakCount).toBe(count);
});
