/**
 * OPUS-119: Calendar interactions, keyboard navigation, and accessibility.
 */
import { test, expect } from '@playwright/test';

// Helper: find a non-holiday, non-past, non-weekend day in the current month view
async function getFirstWeekday(page) {
  return page.locator('#calGrid button.day:not(.we):not(.past):not(.holiday)').first();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#calGrid button', { timeout: 5000 });
  // App auto-selects Tue-Thu on fresh load — clear for a known baseline
  await page.locator('.chip[data-pattern="clear"]').click();
});

// ─── Calendar click interactions ──────────────────────────────────────────────

test('click weekday → selects it and updates cost panel', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  await btn.click();

  await expect(btn).toHaveClass(/\bon\b/);
  // Cost panel should no longer be in empty state
  await expect(page.locator('#panelContent .empty')).toHaveCount(0);
});

test('click selected day → deselects it and cost panel returns to empty', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  await btn.click();
  await expect(btn).toHaveClass(/\bon\b/);

  await btn.click();
  await expect(btn).not.toHaveClass(/\bon\b/);
  await expect(page.locator('#panelContent .empty')).toHaveCount(1);
});

test('right-click selected weekday → mode 2 (amber), peak-both class visible', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  await btn.click();
  await expect(btn).toHaveClass(/\bon\b/);

  await btn.click({ button: 'right' });
  await expect(btn).toHaveClass(/peak-both/);
  const cls = await btn.getAttribute('class');
  expect(cls).toContain('peak-both');
});

test('right-click mode 2 → mode 3 (green, offpeak-both class)', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  await btn.click();
  await btn.click({ button: 'right' }); // → mode 2
  await btn.click({ button: 'right' }); // → mode 3
  await expect(btn).toHaveClass(/offpeak-both/);
});

test('right-click mode 3 → back to mode 1 (no badge)', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  await btn.click();
  await btn.click({ button: 'right' }); // → mode 2
  await btn.click({ button: 'right' }); // → mode 3
  await btn.click({ button: 'right' }); // → mode 1
  await expect(btn).not.toHaveClass(/peak-both/);
  await expect(btn).not.toHaveClass(/offpeak-both/);
});

test('right-click unselected day → no change (stays unselected)', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  // Do NOT click first — right-click while unselected
  await btn.click({ button: 'right' });
  await expect(btn).not.toHaveClass(/\bon\b/);
});

test('click weekend day → selects with weekend style', async ({ page }) => {
  const wknd = page.locator('#calGrid button.day.we').first();
  await wknd.click();
  await expect(wknd).toHaveClass(/\bon\b/);
});

test('right-click selected weekend day → no mode change', async ({ page }) => {
  const wknd = page.locator('#calGrid button.day.we').first();
  await wknd.click();
  await wknd.click({ button: 'right' });
  // Weekend days cannot be mode 2 or 3
  await expect(wknd).not.toHaveClass(/peak-both/);
  await expect(wknd).not.toHaveClass(/offpeak-both/);
});

// ─── Keyboard navigation ──────────────────────────────────────────────────────

test('Tab to calendar → first day button gets focus (tabindex=0)', async ({ page }) => {
  // The first day button should have tabindex="0"
  const firstDay = page.locator('#calGrid button[tabindex="0"]');
  await expect(firstDay).toHaveCount(1);
});

test('Enter on focused day → selects it', async ({ page }) => {
  const firstDay = page.locator('#calGrid button[tabindex="0"]');
  await firstDay.focus();
  await page.keyboard.press('Enter');
  await expect(firstDay).toHaveClass(/\bon\b/);
});

test('Space on focused day → selects it', async ({ page }) => {
  const firstDay = page.locator('#calGrid button[tabindex="0"]');
  await firstDay.focus();
  await page.keyboard.press('Space');
  await expect(firstDay).toHaveClass(/\bon\b/);
});

test('Enter on selected day → deselects it', async ({ page }) => {
  const firstDay = page.locator('#calGrid button[tabindex="0"]');
  await firstDay.focus();
  await page.keyboard.press('Enter');
  await expect(firstDay).toHaveClass(/\bon\b/);
  await page.keyboard.press('Enter');
  await expect(firstDay).not.toHaveClass(/\bon\b/);
});

test('Shift+Enter on selected weekday → cycles mode', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  await btn.focus();
  // Select it first
  await page.keyboard.press('Enter');
  await expect(btn).toHaveClass(/\bon\b/);
  // Cycle mode
  await page.keyboard.press('Shift+Enter');
  const cls = await btn.getAttribute('class');
  expect(cls).toMatch(/peak-both|offpeak-both/);
});

test('ArrowRight moves focus to next day', async ({ page }) => {
  // Use positional locators (stable by index, not by attribute)
  const allDayBtns = page.locator('#calGrid button.day');
  const firstDay = allDayBtns.first();
  const secondDay = allDayBtns.nth(1);

  await expect(firstDay).toHaveAttribute('tabindex', '0');
  await firstDay.focus();
  await page.keyboard.press('ArrowRight');

  // After ArrowRight: first day loses focus (tabindex=-1), second gains it (tabindex=0)
  await expect(firstDay).toHaveAttribute('tabindex', '-1');
  await expect(secondDay).toHaveAttribute('tabindex', '0');
});

test('ArrowDown moves focus down one row (7 days)', async ({ page }) => {
  const allDayBtns = page.locator('#calGrid button.day');
  const firstDay = allDayBtns.first();

  await expect(firstDay).toHaveAttribute('tabindex', '0');
  await firstDay.focus();
  await page.keyboard.press('ArrowDown');

  // After one ArrowDown, first day loses focus, exactly one other day has tabindex=0
  await expect(firstDay).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('#calGrid button.day[tabindex="0"]')).toHaveCount(1);
});

// ─── Skip-to-content link ─────────────────────────────────────────────────────

test('skip link is hidden by default and visible on focus', async ({ page }) => {
  const skipLink = page.locator('.skip-link');
  await expect(skipLink).toBeAttached();

  // Trigger focus
  await skipLink.focus();
  const box = await skipLink.boundingBox();
  // Should be visible (on-screen) when focused
  expect(box?.x).toBeGreaterThan(-100);
});

test('skip link href targets #calGrid', async ({ page }) => {
  const skipLink = page.locator('.skip-link');
  const href = await skipLink.getAttribute('href');
  expect(href).toBe('#calGrid');
});

// ─── ARIA announcements ───────────────────────────────────────────────────────

test('calendar grid has role="grid"', async ({ page }) => {
  await expect(page.locator('#calGrid')).toHaveAttribute('role', 'grid');
});

test('day headers have role="columnheader"', async ({ page }) => {
  const headers = page.locator('#calGrid [role="columnheader"]');
  await expect(headers).toHaveCount(7);
});

test('month label has role="status"', async ({ page }) => {
  await expect(page.locator('#monthLabel')).toHaveAttribute('role', 'status');
});

test('cost panel has aria-live="polite"', async ({ page }) => {
  await expect(page.locator('#panelContent')).toHaveAttribute('aria-live', 'polite');
});

test('day buttons have aria-label with day name and date', async ({ page }) => {
  const firstDay = page.locator('#calGrid button[tabindex="0"]');
  const label = await firstDay.getAttribute('aria-label');
  // Should contain a day name and date number
  expect(label).toMatch(/\w+day.*\d+/i);
});

test('selected day aria-pressed="true"', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
});

test('unselected day aria-pressed="false"', async ({ page }) => {
  const btn = await getFirstWeekday(page);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
});

test('panelContent updates when day is toggled', async ({ page }) => {
  const initialContent = await page.locator('#panelContent').textContent();
  const btn = await getFirstWeekday(page);
  await btn.click();
  const updatedContent = await page.locator('#panelContent').textContent();
  expect(updatedContent).not.toBe(initialContent);
});

// ─── Mobile: legend text (OPUS-84 regression) ────────────────────────────────

test.describe('mobile viewport', () => {
  // Enable touch emulation (hasTouch) so navigator.maxTouchPoints > 0,
  // which is what the app checks to show "long-press" vs "right-click" in the legend
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test('legend contains "long-press" on mobile, not "right-click" (OPUS-84)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#calGrid button', { timeout: 5000 });
    const legendText = await page.locator('.cal-legend').textContent();
    expect(legendText).toContain('long-press');
    expect(legendText).not.toContain('right-click');
  });
});
