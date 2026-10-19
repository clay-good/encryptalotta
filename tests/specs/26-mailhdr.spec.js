// ===================================================================
// 26 — Email Header Analyzer (draft 311, new tool #56). Offline sender-
// authentication check. Fixtures in tests/fixtures/mail/: a GitHub-style
// message that passes SPF/DKIM/DMARC with aligned DKIM, and a phish with a
// display-name spoof, Reply-To diversion, DMARC fail and date skew.
// ===================================================================

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/mail');
const LEGIT = fs.readFileSync(path.join(FX, 'legit.txt'), 'utf8');
const PHISH = fs.readFileSync(path.join(FX, 'phish.txt'), 'utf8');

async function open(page, lang) {
  await page.goto('/index.html');
  if (lang) await page.selectOption('#lang-select', lang);
  await page.evaluate(() => { location.hash = '#mailhdr'; });
  await page.waitForFunction(() => document.getElementById('mailhdr-view')?.classList.contains('active'));
}

async function analyze(page, headers) {
  await page.fill('#mailhdr-input', headers);
  await page.click('#btn-mailhdr-run');
  await expect(page.locator('#mailhdr-results')).toBeVisible();
  // Error results render no verdict; don't wait out the action timeout looking for one.
  const v = page.locator('#mailhdr-verdict');
  const level = (await v.count()) ? await v.getAttribute('data-level') : null;
  return { level, text: (await page.locator('#mailhdr-results').textContent()).replace(/\s+/g, ' ') };
}

test('mailhdr: an authenticated, aligned message gets the pass verdict', async ({ page }) => {
  await open(page);
  const r = await analyze(page, LEGIT);
  expect(r.level).toBe('ok');
  expect(r.text).toContain('GitHub <noreply@github.com>');
  expect(r.text).toContain('[GitHub] 🎉 Welcome');            // RFC 2047 B-word decoded
  expect(r.text).toMatch(/SPF\s*pass/);
  expect(r.text).toMatch(/DMARC\s*pass/);
  expect(r.text).toContain('mx.google.com');                   // checked by
  expect(r.text).toContain('out-21.smtp.github.com [192.30.252.201] → mx.google.com');
  expect(r.text).toContain('+1 sec');                          // hop delay, Intl unit format
  expect(r.text).toContain("not that the content is safe");
  expect(r.text).not.toContain('Hello body');                  // parsing stops at the body
});

test('mailhdr: a spoofed phish is flagged on every axis', async ({ page }) => {
  await open(page);
  const r = await analyze(page, PHISH);
  expect(r.level).toBe('danger');
  expect(r.text).toContain("Votre compte est suspendu à cause d'une activité");  // folded Q-words joined
  expect(r.text).toContain('The display name “service@paypal.com” imitates another address — the real sender is evil.example');
  expect(r.text).toContain('Replies go to billing@collect.example');
  expect(r.text).toContain('DMARC failed');
  expect(r.text).toContain('SPF soft-failed');
  expect(r.text).toContain('more than a day away');
});

test('mailhdr: headers without authentication results are not verifiable', async ({ page }) => {
  await open(page);
  const r = await analyze(page, 'From: Someone <a@b.example>\nSubject: hi\nDate: Mon, 19 Oct 2026 10:00:00 +0000');
  expect(r.level).toBe('warn');
  expect(r.text).toContain("the sender can't be verified");
});

test('mailhdr: SPF pass alone does not earn the pass verdict', async ({ page }) => {
  await open(page);
  const r = await analyze(page, 'Authentication-Results: mx.example; spf=pass smtp.mailfrom=x.example; dkim=none; dmarc=none\nFrom: X <a@x.example>');
  expect(r.level).toBe('warn');
  expect(r.text).toContain("didn't confirm the From domain");
});

test('mailhdr: a second, injected Authentication-Results is ignored and reported', async ({ page }) => {
  await open(page);
  const r = await analyze(page, 'Authentication-Results: mx.real.example; spf=fail; dkim=none; dmarc=fail header.from=bank.example\nAuthentication-Results: mx.real.example; spf=pass; dkim=pass; dmarc=pass\nFrom: Bank <alerts@bank.example>');
  expect(r.level).toBe('danger');                               // the topmost (real) verdict wins
  expect(r.text).toContain('2 Authentication-Results headers found');
});

test('mailhdr: slow relay steps use the plural form', async ({ page }) => {
  await open(page);
  const h = [
    'Received: from c by d; Mon, 19 Oct 2026 14:00:00 +0000',
    'Received: from b by c; Mon, 19 Oct 2026 12:00:00 +0000',
    'Received: from a by b; Mon, 19 Oct 2026 10:00:00 +0000',
    'From: A <a@x.example>',
  ].join('\n');
  const r = await analyze(page, h);
  expect(r.text).toContain('2 relay steps took over an hour.');
  expect(r.text).toContain('+2 hr');
});

test('mailhdr: empty and non-header input show errors', async ({ page }) => {
  await open(page);
  expect((await analyze(page, '   ')).text).toContain('Paste the message headers');
  expect((await analyze(page, 'just a sentence\nand another')).text).toContain('No email headers found');
});

test('mailhdr: French UI localizes labels and findings', async ({ page }) => {
  await open(page, 'fr');
  const r = await analyze(page, PHISH);
  expect(r.text).toContain('Expéditeur');
  expect(r.text).toContain('Les réponses partent vers billing@collect.example');
  expect(r.text).toContain('Échec DMARC');
});

test('mailhdr: palette finds it by "dmarc"; no overflow at 320 px', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'dmarc');
  await expect(page.locator('#palette-results li').first()).toContainText('Email Header Analyzer');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page);
  await analyze(page, PHISH + '\nX-Long: ' + 'x'.repeat(500) + '\nMessage-ID: <' + 'y'.repeat(300) + '@evil.example>');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
