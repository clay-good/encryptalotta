// ===================================================================
// 21 — Service worker (SPEC §4.5, draft 305). The SW is network-first:
// online visitors always get the current files (so a vendored-library
// security patch reaches them), and the precached copy is the offline
// fallback. The previous cache-first SW pinned returning visitors to the
// install-time snapshot until sw.js itself changed.
//
// The page only registers the SW over https:, so these tests register it
// directly — 127.0.0.1 is a secure context, so registration is allowed.
// ===================================================================

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(HERE, '..', 'reports', 'sw-probe.txt');
const PROBE_URL = '/tests/reports/sw-probe.txt';

async function installSw(page) {
  await page.goto('/index.html');
  await page.evaluate(async () => {
    // A leftover cache from the old SW version must be dropped on activate.
    await (await caches.open('encryptalotta-shell-v1')).put('/stale', new Response('stale'));
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  });
  // clients.claim() makes the already-open page controlled without a reload.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 });
}

test.afterEach(() => { try { fs.unlinkSync(PROBE); } catch (e) { /* not created */ } });

test('sw: installs the v3 shell cache and drops obsolete caches', async ({ page }) => {
  await installSw(page);
  const r = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open('encryptalotta-shell-v3');
    const urls = (await cache.keys()).map(q => new URL(q.url).pathname);
    return { keys, hasPgp: urls.includes('/openpgp.min.js'), hasIndex: urls.includes('/index.html'), count: urls.length };
  });
  expect(r.keys).toEqual(['encryptalotta-shell-v3']);
  expect(r.hasPgp).toBe(true);
  expect(r.hasIndex).toBe(true);
  expect(r.count).toBeGreaterThanOrEqual(20);
});

test('sw: online requests are network-first (a changed file is served fresh)', async ({ page }) => {
  await installSw(page);
  fs.writeFileSync(PROBE, 'version-one');
  await page.goto(PROBE_URL);
  expect(await page.textContent('body')).toContain('version-one');
  fs.writeFileSync(PROBE, 'version-two');
  // Move mtime forward so the server's 1-second Last-Modified can't answer 304 to the
  // browser's conditional request (that would test the HTTP cache, not the SW).
  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(PROBE, later, later);
  await page.goto(PROBE_URL);
  // A cache-first SW would still answer "version-one" here.
  expect(await page.textContent('body')).toContain('version-two');
});

test('sw: offline requests fall back to the cached copy', async ({ page, context }) => {
  await installSw(page);
  fs.writeFileSync(PROBE, 'cached-copy');
  await page.goto(PROBE_URL);
  expect(await page.textContent('body')).toContain('cached-copy');
  await context.setOffline(true);
  try {
    await page.goto(PROBE_URL);
    expect(await page.textContent('body')).toContain('cached-copy');
    // The precached shell itself loads offline, vendored OpenPGP.js included.
    await page.goto('/index.html');
    await expect(page.locator('#lang-select')).toBeVisible();
    expect(await page.evaluate(() => typeof openpgp !== 'undefined' && typeof openpgp.encrypt)).toBe('function');
  } finally {
    await context.setOffline(false);
  }
});

test('pwa: Chromium reports the site installable (no installability errors)', async ({ page }) => {
  // SPEC §8 Phase 5: "PWA install prompt fires on Chrome". Ask Chromium directly via
  // DevTools: with the SW controlling the page, Page.getInstallabilityErrors must be
  // empty and the manifest must parse cleanly. (Chromium 147 no longer needs 192/512
  // px icons to install; audit gate 20 enforces those sizes separately.)
  await installSw(page);
  await page.reload();
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors.map(e => e.errorId)).toEqual([]);
  const { url, errors } = await cdp.send('Page.getAppManifest');
  expect(url).toMatch(/\/site\.webmanifest$/);
  expect(errors).toEqual([]);
});
