/**
 * Accessibility tests using axe-core.
 * Runs WCAG 2.1 AA audits on all public-facing pages.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function scan(page) {
  return new AxeBuilder({ page }).analyze();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#calGrid button', { timeout: 5000 });
});

// ─── Main page ───────────────────────────────────────────────────────────────

test('main page has no accessibility violations', async ({ page }) => {
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test('main page with days selected has no accessibility violations', async ({ page }) => {
  await page.locator('.chip[data-pattern="twt"]').click();
  await expect(page.locator('#panelContent .empty')).toHaveCount(0);
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test('main page with fare editor open has no accessibility violations', async ({ page }) => {
  await page.locator('#fareToggleBtn').click();
  await expect(page.locator('#fareEditor')).toBeVisible();
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

// ─── Privacy page ────────────────────────────────────────────────────────────

test('privacy page has no accessibility violations', async ({ page }) => {
  await page.goto('/privacy.html');
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

// ─── Terms page ──────────────────────────────────────────────────────────────

test('terms page has no accessibility violations', async ({ page }) => {
  await page.goto('/terms.html');
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

// ─── 404 page ────────────────────────────────────────────────────────────────

test('404 page has no accessibility violations', async ({ page }) => {
  await page.goto('/404.html');
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

// ─── Mobile viewport ─────────────────────────────────────────────────────────

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 664 } });

  test('main page on mobile has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#calGrid button', { timeout: 5000 });
    const results = await scan(page);
    expect(results.violations).toEqual([]);
  });
});
