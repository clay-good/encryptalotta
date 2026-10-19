// ===================================================================
// 25 — Link Safety Inspector (draft 310, new tool #55). Offline phishing-
// trick detector. Pins RFC 3492 punycode decoding, UTS #39-style mixed-
// script / lookalike detection, and that legitimate IDNs are NOT flagged.
// ===================================================================

import { test, expect } from '@playwright/test';

async function inspect(page, link, lang) {
  if (lang !== undefined || !page.url().includes('index.html')) {
    await page.goto('/index.html');
    if (lang) await page.selectOption('#lang-select', lang);
    await page.evaluate(() => { location.hash = '#linkcheck'; });
    await page.waitForFunction(() => document.getElementById('linkcheck-view')?.classList.contains('active'));
  }
  await page.fill('#linkcheck-input', link);
  await page.click('#btn-linkcheck-run');
  await expect(page.locator('#linkcheck-results')).toBeVisible();
  // Error results render no verdict; don't wait out the action timeout looking for one.
  const v = page.locator('#linkcheck-verdict');
  const level = (await v.count()) ? await v.getAttribute('data-level') : null;
  return { level, text: (await page.locator('#linkcheck-results').textContent()).replace(/\s+/g, ' ') };
}

test('linkcheck: the classic Cyrillic "apple" spoof is decoded and flagged', async ({ page }) => {
  const r = await inspect(page, 'https://xn--80ak6aa92e.com/login', '');
  expect(r.level).toBe('danger');
  expect(r.text).toContain('аррӏе.com');          // decoded, shown as the real destination
  expect(r.text).toContain('xn--80ak6aa92e.com');  // and its encoded form
  expect(r.text).toContain('imitates “apple”');
});

test('linkcheck: a single swapped Cyrillic letter is flagged as mixed-script', async ({ page }) => {
  const r = await inspect(page, 'https://xn--pple-43d.com', '');
  expect(r.level).toBe('danger');
  expect(r.text).toMatch(/mixes writing systems \((Latin and Cyrillic|Cyrillic and Latin)\)/);
});

test('linkcheck: legitimate internationalized domains are not flagged', async ({ page }) => {
  for (const link of ['https://münchen.de/', 'https://日本語.jp/', 'https://example.com/']) {
    const r = await inspect(page, link, '');
    expect(r.level, link).toBe('ok');
  }
  expect((await inspect(page, 'https://münchen.de/', '')).text).toContain('münchen.de');
});

test('linkcheck: user@host, raw IP, plain http, shortener, disguised download', async ({ page }) => {
  let r = await inspect(page, 'https://paypal.com@evil.example/login', '');
  expect(r.level).toBe('danger');
  expect(r.text).toContain('the link actually goes to evil.example');
  r = await inspect(page, 'http://3232235521/');
  expect(r.level).toBe('warn');
  expect(r.text).toContain('192.168.0.1');
  expect(r.text).toContain('Not encrypted');
  r = await inspect(page, 'bit.ly/abc');
  expect(r.level).toBe('warn');
  expect(r.text).toContain('link shortener');
  r = await inspect(page, 'https://example.com/invoice.pdf.exe');
  expect(r.level).toBe('danger');
  expect(r.text).toContain('double extension');
  r = await inspect(page, 'javascript:alert(1)');
  expect(r.level).toBe('danger');
});

test('linkcheck: a redirect wrapper hiding a spoof is unwrapped and flagged', async ({ page }) => {
  const r = await inspect(page, 'https://www.google.com/url?q=https%3A%2F%2Fxn--80ak6aa92e.com%2Flogin', '');
  expect(r.level).toBe('danger');
  expect(r.text).toContain('Passes through www.google.com');
  expect(r.text).toContain('https://xn--80ak6aa92e.com/login');
});

test('linkcheck: clean verdict never claims the site is safe', async ({ page }) => {
  const r = await inspect(page, 'https://example.com/', '');
  expect(r.level).toBe('ok');
  expect(r.text).toContain("doesn't prove the site is safe");
});

test('linkcheck: empty and unparseable input show errors', async ({ page }) => {
  let r = await inspect(page, '   ', '');
  expect(r.text).toContain('Paste a link to inspect');
  r = await inspect(page, 'https://exa mple.com');
  expect(r.text).toContain("doesn't look like a valid link");
});

test('linkcheck: French UI localizes findings and script names', async ({ page }) => {
  const r = await inspect(page, 'https://xn--pple-43d.com', 'fr');
  expect(r.text).toContain('mélange des écritures');
  expect(r.text.toLowerCase()).toContain('cyrillique');
});

test('linkcheck: Enter key runs the inspection; palette finds it by "phishing"', async ({ page }) => {
  await inspect(page, 'https://example.com/', '');
  await page.fill('#linkcheck-input', 'http://192.168.0.1/');
  await page.press('#linkcheck-input', 'Enter');
  await expect(page.locator('#linkcheck-results')).toContainText('192.168.0.1');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'phishing');
  await expect(page.locator('#palette-results li').first()).toContainText('Link Safety Inspector');
});

test('linkcheck: no horizontal overflow at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await inspect(page, 'https://paypal.com.secure-login.' + 'x'.repeat(120) + '.example/' + 'y'.repeat(300) + '/invoice.pdf.exe', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
