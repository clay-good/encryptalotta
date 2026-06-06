/* eslint-disable */
// ===================================================================
// 15 — age file encryption (spec §2.11)
//
// The strongest correctness check is interoperability with the real
// `age` CLI. The X25519 and scrypt fixtures below were produced by
// Filippo Valsorda's age 1.3.1 (`age -a -r … ` and `age -p -a …`) and
// are decrypted here entirely in-browser by the hand-rolled
// ChaCha20-Poly1305 / scrypt / X25519 stack. Plus: in-browser
// round-trips (X25519 + scrypt), the empty-message edge case, and
// error handling for a wrong key / wrong passphrase.
// ===================================================================

import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}

// --- Fixtures produced by age 1.3.1 ---
const CLI_IDENTITY = 'AGE-SECRET-KEY-1Q7F99QCKJD40ENQX9Q3AKF0M7LJMTX5FVG0Y0UX74HUZVEE99MRS8450YL';
const CLI_MESSAGE = 'age interop fixture: hello from the age CLI 1.3.1';
const CLI_X25519 = `-----BEGIN AGE ENCRYPTED FILE-----
YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IFgyNTUxOSBCMnNlUVRSbVVIazdXS3Zi
ZUU4VGI0OGVZamNaRnFlK3dPWm0yT2Juc2dBCkVxeGJkYUpnNVEzVXlGOTZodVow
cGRLWWR3ZUs2RzNROHR0SnVQN1c4TUEKLS0tIFJvTlltSzZiOURNRTZDRy81WG1B
SG80ajNaU29za0hwT1dFa2ZZNHpIN00K8PTZu2bZI4jlxFZKg2ZxIOaqh4f7FZNF
Aa8cObWMUlAuY6YFk5tV456+CPAWfHufkRd5Qp/ULkX/Kk+jstM7AIDos3chdB/G
N9+RjsUj9AgJ
-----END AGE ENCRYPTED FILE-----`;
const CLI_PASSPHRASE = 'test-passphrase-123';
const CLI_SCRYPT = `-----BEGIN AGE ENCRYPTED FILE-----
YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IHNjcnlwdCBFU3U2MERaUi9mdWZ1NWJt
SEFodXp3IDE4ClhrQy9zcEFYSFFCLzZEd213bmN1Ykp0L0tnbk0wYkhQWDVRWVRi
S1k0VVUKLS0tIDd1em4yQWVDVFZEaVluSXJLZWdmVU1CWE0xNlRUNDM1aDk0Zjlz
ZlRWNW8KhPIv4Xxm2gYlaAqvcgWvrFbc3UWPx3HZEZfyNcCg/3t1UZS1ZtkKYD0v
rRu31ghMWx7pisoq7/7AWlQuXoRdVyDmmZOCtccyy1TxiVrNQcbe
-----END AGE ENCRYPTED FILE-----`;

test('age interop: decrypts an X25519 file produced by the age CLI', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'age');
  await page.check('input[name="age-mode"][value="decrypt"]');
  await page.check('input[name="age-dec-type"][value="key"]');
  await page.fill('#age-dec-identity', CLI_IDENTITY);
  await page.fill('#age-dec-input', CLI_X25519);
  await page.click('#btn-age-decrypt');
  await expect(page.locator('#age-dec-output')).toHaveValue(CLI_MESSAGE);
});

test('age interop: decrypts a scrypt (passphrase) file produced by the age CLI', async ({ page }) => {
  test.setTimeout(60_000); // pure-JS scrypt at the CLI's default work factor (2^18) takes a few seconds
  await page.goto('/index.html'); await gotoTool(page, 'age');
  await page.check('input[name="age-mode"][value="decrypt"]');
  await page.check('input[name="age-dec-type"][value="pass"]');
  await page.fill('#age-dec-pass', CLI_PASSPHRASE);
  await page.fill('#age-dec-input', CLI_SCRYPT);
  await page.click('#btn-age-decrypt');
  await expect(page.locator('#age-dec-output')).toHaveValue(CLI_MESSAGE, { timeout: 30_000 });
});

test('age: scrypt passphrase round-trip (encrypt then decrypt)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'age');
  // Encrypt with a passphrase at a fast work factor.
  await page.check('input[name="age-mode"][value="encrypt"]');
  await page.check('input[name="age-enc-type"][value="pass"]');
  await page.fill('#age-enc-pass', 'hunter2');
  await page.selectOption('#age-scrypt-work', '12');
  await page.fill('#age-enc-input', 'secret over a passphrase');
  await page.click('#btn-age-encrypt');
  await expect(page.locator('#age-enc-output')).toHaveValue(/-----BEGIN AGE ENCRYPTED FILE-----/);
  const ct = await page.locator('#age-enc-output').inputValue();

  await page.check('input[name="age-mode"][value="decrypt"]');
  await page.check('input[name="age-dec-type"][value="pass"]');
  await page.fill('#age-dec-pass', 'hunter2');
  await page.fill('#age-dec-input', ct);
  await page.click('#btn-age-decrypt');
  await expect(page.locator('#age-dec-output')).toHaveValue('secret over a passphrase');
});

test('age: empty message round-trips through X25519', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'age');
  await page.check('input[name="age-mode"][value="generate"]');
  await page.click('#btn-age-generate');
  const recipient = (await page.locator('#age-gen-recipient').inputValue()).trim();
  const identity = (await page.locator('#age-gen-identity').inputValue()).trim();

  await page.check('input[name="age-mode"][value="encrypt"]');
  await page.fill('#age-enc-recipients', recipient);
  await page.fill('#age-enc-input', '');
  await page.click('#btn-age-encrypt');
  await expect(page.locator('#age-enc-output')).toHaveValue(/AGE ENCRYPTED FILE/);
  const ct = await page.locator('#age-enc-output').inputValue();

  await page.check('input[name="age-mode"][value="decrypt"]');
  await page.fill('#age-dec-identity', identity);
  await page.fill('#age-dec-input', ct);
  await page.click('#btn-age-decrypt');
  // The decrypted output is empty; assert the output group became visible (decrypt succeeded).
  await expect(page.locator('#age-dec-output-group')).toBeVisible();
  await expect(page.locator('#age-dec-output')).toHaveValue('');
});

test('age: wrong passphrase is rejected', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'age');
  await page.check('input[name="age-mode"][value="encrypt"]');
  await page.check('input[name="age-enc-type"][value="pass"]');
  await page.fill('#age-enc-pass', 'right-passphrase');
  await page.selectOption('#age-scrypt-work', '12');
  await page.fill('#age-enc-input', 'top secret');
  await page.click('#btn-age-encrypt');
  await expect(page.locator('#age-enc-output')).toHaveValue(/-----BEGIN AGE ENCRYPTED FILE-----/);
  const ct = await page.locator('#age-enc-output').inputValue();

  await page.check('input[name="age-mode"][value="decrypt"]');
  await page.check('input[name="age-dec-type"][value="pass"]');
  await page.fill('#age-dec-pass', 'wrong-passphrase');
  await page.fill('#age-dec-input', ct);
  await page.click('#btn-age-decrypt');
  await expect(page.locator('#age-status')).toBeVisible();
  await expect(page.locator('#age-dec-output-group')).toBeHidden();
});

test('age: a malformed recipient is rejected with an error', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'age');
  await page.check('input[name="age-mode"][value="encrypt"]');
  await page.check('input[name="age-enc-type"][value="keys"]');
  await page.fill('#age-enc-recipients', 'age1notavalidrecipientatall');
  await page.fill('#age-enc-input', 'hi');
  await page.click('#btn-age-encrypt');
  await expect(page.locator('#age-status')).toBeVisible();
  await expect(page.locator('#age-enc-output-group')).toBeHidden();
});
