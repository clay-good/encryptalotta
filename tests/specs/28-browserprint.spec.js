// ===================================================================
// 28 — What Your Browser Reveals (draft 313, new tool #58). Each Playwright
// browser context stands in for a different visitor: the same context must
// yield the same ID, a different time zone / locale must change it, a
// canvas-randomizing browser must be detected, and page-controlled values
// (the user agent) must render inert.
// ===================================================================

import { test, expect } from '@playwright/test';

const SIGNALS = ['ua', 'languages', 'timezone', 'screen', 'hardware', 'touch', 'fonts', 'canvas', 'webgl', 'audio', 'prefs', 'signals', 'cookies'];

async function run(page, lang) {
  await page.goto('/index.html');
  if (lang) await page.selectOption('#lang-select', lang);
  await page.evaluate(() => { location.hash = '#browserprint'; });
  await page.waitForFunction(() => document.getElementById('browserprint-view')?.classList.contains('active'));
  await page.click('#btn-browserprint-run');
  await expect(page.locator('#browserprint-id')).toBeVisible();
  return {
    id: (await page.locator('#browserprint-id .kv-val').textContent()).trim(),
    text: (await page.locator('#browserprint-results').textContent()).replace(/\s+/g, ' '),
    signals: await page.locator('#browserprint-results [data-signal]').evaluateAll(els => els.map(e => e.dataset.signal)),
    findings: await page.locator('#browserprint-results [data-finding]').evaluateAll(els => els.map(e => e.dataset.finding)),
  };
}

test('browserprint: reports every signal, an ID, and rates identifying power', async ({ page }) => {
  const r = await run(page);
  expect(r.id).toMatch(/^[0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4}$/);
  expect(r.signals).toEqual(SIGNALS);
  expect(r.text).toContain('high identifying power');
  expect(r.text).toContain('low identifying power');
  expect(r.text).toMatch(/Installed fonts \(\d+ of 50 checked\)/);
  expect(r.text).toContain('CPU threads');
  expect(r.findings).toContain('canvasStable');     // Chromium does not randomize canvas
  expect(r.findings).toContain('gpcOff');           // nor send GPC
  expect(r.findings).toContain('webdriver');        // Playwright sets navigator.webdriver
});

test('browserprint: the same browser gets the same ID on every check', async ({ page }) => {
  const a = await run(page);
  await page.click('#btn-browserprint-run');
  await expect(page.locator('#browserprint-id')).toBeVisible();
  expect((await page.locator('#browserprint-id .kv-val').textContent()).trim()).toBe(a.id);
  expect((await run(page)).id).toBe(a.id);          // and after a reload
});

test('browserprint: a different time zone and locale change the ID', async ({ browser, page }) => {
  const base = await run(page);
  const ctx = await browser.newContext({ timezoneId: 'Asia/Tokyo', locale: 'ja-JP' });
  const other = await run(await ctx.newPage());
  await ctx.close();
  expect(other.text).toContain('Asia/Tokyo (UTC+09:00)');
  expect(other.text).toContain('ja-JP');
  expect(other.id).not.toBe(base.id);
});

test('browserprint: a canvas-randomizing browser is detected as protected', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...a) { return orig.apply(this, a) + Math.random(); };
  });
  const page = await ctx.newPage();
  const r1 = await run(page);
  expect(r1.findings).toContain('canvasRandomized');
  expect(r1.findings).not.toContain('canvasStable');
  expect(r1.text).toContain('randomized on every read (your browser is protecting this)');
  const r2 = await run(page);
  expect(r2.id).not.toBe(r1.id);                    // a tracker would see a new ID each time
  await ctx.close();
});

test('browserprint: Global Privacy Control on is recognized', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }));
  const r = await run(await ctx.newPage());
  expect(r.findings).toContain('gpcOn');
  expect(r.text).toContain('GPC: on');
  await ctx.close();
});

test('browserprint: a hostile user agent string renders as inert text', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 <img src=x onerror="window.__xss=1">' });
  const page = await ctx.newPage();
  const r = await run(page);
  expect(r.text).toContain('<img src=x onerror="window.__xss=1">');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('#browserprint-results img').count()).toBe(0);
  await ctx.close();
});

test('browserprint: French UI', async ({ page }) => {
  const r = await run(page, 'fr');
  expect(r.text).toContain('Identifiant d’empreinte');
  expect(r.text).toContain('fort pouvoir d’identification');
});

test('browserprint: palette finds it by "gpc"; no overflow at 320 px; probe span cleaned up', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'gpc');
  await expect(page.locator('#palette-results li').first()).toContainText('What Your Browser Reveals');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 800 });
  await run(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => [...document.body.querySelectorAll('span')].filter(s => s.textContent.startsWith('mmmmmmmmmmlli')).length)).toBe(0);
});
