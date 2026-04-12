/**
 * OPUS-120: PWA and service worker tests.
 * Verifies SW registration, cache completeness, offline functionality, and manifest.
 *
 * Cache version: lirr-calc-v6 (update when sw.js bumps the version)
 */
import { test, expect } from '@playwright/test';

const CACHE_NAME = 'lirr-calc-v7';

const EXPECTED_ASSETS = [
  '/',
  '/index.html',
  '/lirr-data.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/favicon.svg',
  '/privacy.html',
  '/terms.html',
  '/404.html',
  '/og-image.svg',
];

// ─── Service worker registration ──────────────────────────────────────────────

test('service worker registers and becomes active', async ({ page }) => {
  await page.goto('/');

  // navigator.serviceWorker.ready resolves when the SW enters 'activating', not 'activated'.
  // Wait until controller state is fully 'activated'.
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    const sw = reg.active;
    if (!sw) return null;
    if (sw.state === 'activated') return sw.state;
    return new Promise((resolve) => {
      sw.addEventListener('statechange', function handler() {
        if (sw.state === 'activated') {
          sw.removeEventListener('statechange', handler);
          resolve(sw.state);
        }
      });
    });
  });

  expect(swState).toBe('activated');
});

test('service worker scope is /', async ({ page }) => {
  await page.goto('/');

  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return new URL(reg.scope).pathname;
  });

  expect(scope).toBe('/');
});

// ─── Cache completeness ───────────────────────────────────────────────────────

test(`cache "${CACHE_NAME}" contains all expected assets`, async ({ page }) => {
  await page.goto('/');

  // Wait for SW to activate and cache to be populated
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1000); // allow install/activate to complete

  const cachedUrls = await page.evaluate(async (cacheName) => {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    return keys.map(req => new URL(req.url).pathname);
  }, CACHE_NAME);

  for (const asset of EXPECTED_ASSETS) {
    expect(cachedUrls, `Expected ${asset} to be cached`).toContain(asset);
  }
});

test('no stale caches from previous versions remain after activation', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);

  const cacheNames = await page.evaluate(async () => caches.keys());

  // Should only have the current cache version, not old ones
  const stale = cacheNames.filter((n) => n.startsWith('lirr-calc-') && n !== CACHE_NAME);
  expect(stale).toHaveLength(0);
});

// ─── Offline functionality ────────────────────────────────────────────────────

test('app loads from cache when offline', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit offline reload is unreliable in Playwright');
  // Load once to populate cache
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForSelector('#calGrid button', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Go offline
  await page.context().setOffline(true);

  // Reload
  await page.reload();

  // App should still load from SW cache
  await expect(page.locator('#calGrid')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#panelContent')).toBeVisible();
});

test('privacy.html loads from cache when offline', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit offline reload is unreliable in Playwright');
  // Seed the SW by visiting / first (privacy.html doesn't register SW itself)
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1000);

  await page.goto('/privacy.html');
  await page.context().setOffline(true);
  await page.reload();

  await expect(page.locator('h2')).toContainText('Privacy Policy');
});

test('terms.html loads from cache when offline', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit offline reload is unreliable in Playwright');
  // Seed the SW by visiting / first (terms.html doesn't register SW itself)
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1000);

  await page.goto('/terms.html');
  await page.context().setOffline(true);
  await page.reload();

  await expect(page.locator('h2')).toContainText('Terms of Use');
});

test('no network-error console messages when offline', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit offline reload is unreliable in Playwright');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1000);

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.context().setOffline(true);
  await page.reload();
  await page.waitForSelector('#calGrid', { timeout: 10000 });

  // Filter for network-related errors
  const netErrors = errors.filter((e) =>
    /fetch|network|failed to load/i.test(e)
  );
  expect(netErrors).toHaveLength(0);
});

// ─── Manifest validation ──────────────────────────────────────────────────────

test('manifest.json is served and parseable', async ({ page }) => {
  const response = await page.request.get('/manifest.json');
  expect(response.ok()).toBe(true);

  const ct = response.headers()['content-type'] ?? '';
  expect(ct).toMatch(/json/);

  const manifest = await response.json();
  expect(manifest).toBeTruthy();
});

test('manifest has required PWA fields', async ({ page }) => {
  const response = await page.request.get('/manifest.json');
  const manifest = await response.json();

  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toBeTruthy();
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test('each manifest icon has src, sizes, and type', async ({ page }) => {
  const response = await page.request.get('/manifest.json');
  const manifest = await response.json();

  for (const icon of manifest.icons) {
    expect(icon.src, 'icon missing src').toBeTruthy();
    expect(icon.sizes, 'icon missing sizes').toBeTruthy();
    expect(icon.type, 'icon missing type').toBeTruthy();
  }
});

test('manifest icon purpose values are not combined "any maskable"', async ({ page }) => {
  const response = await page.request.get('/manifest.json');
  const manifest = await response.json();

  for (const icon of manifest.icons) {
    if (icon.purpose) {
      // Should be "any" OR "maskable", never both in one string
      expect(icon.purpose.trim(), 'purpose should not combine any and maskable').not.toBe(
        'any maskable'
      );
    }
  }
});

test('declared PNG icon files actually exist', async ({ page }) => {
  const response = await page.request.get('/manifest.json');
  const manifest = await response.json();

  const pngIcons = manifest.icons.filter((i) => i.type === 'image/png');
  for (const icon of pngIcons) {
    const iconRes = await page.request.get(icon.src);
    expect(iconRes.ok(), `PNG icon ${icon.src} should exist`).toBe(true);
  }
});

// ─── 404 page ────────────────────────────────────────────────────────────────

test('404.html is accessible and contains expected content', async ({ page }) => {
  // Test the 404 page directly — Vercel routing to 404.html for unknown paths
  // is a deployment-time behavior not testable via local static server
  const response = await page.goto('/404.html');
  expect(response?.ok()).toBe(true);
  const content = await page.textContent('h2');
  expect(content).toContain('Page not found');
});
