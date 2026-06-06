/* eslint-disable */
// ===================================================================
// 17 — BLAKE2b / BLAKE3 advanced modes (spec §2.12)
//
// Keyed MAC + variable-length BLAKE2b and BLAKE3 XOF / keyed / derive_key.
// All expected values are the audited @noble/hashes outputs (independent
// reference), several of which are themselves the official BLAKE2 / BLAKE3
// test vectors (e.g. the BLAKE2b keyed-empty KAT 10ebb677…, the BLAKE3
// keyed/derive_key context "whats the Elvish word for friend" / the test
// vectors context string).
// ===================================================================

import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}
async function openAdvanced(page) {
  await page.goto('/index.html');
  await gotoTool(page, 'hash');
  await page.locator('#hash-advanced-details > summary').click();
}

test('BLAKE2b keyed MAC: empty input, key=00..3f, 64 bytes — official BLAKE2 KAT', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', '');
  await page.fill('#hash-b2b-outlen', '64');
  const key = Array.from({ length: 64 }, (_, i) => i.toString(16).padStart(2, '0')).join('');
  await page.fill('#hash-b2b-key', key);
  await page.check('#hash-b2b-key-hex');
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(
    '10ebb67700b1868efb4417987acf4690ae9d972fb7a590c2f02871799aaa4786b5e996e8f0f4eb981fc214b005f42d2ff4233499391653df7aefcbc13fc51568');
});

test('BLAKE2b variable length: BLAKE2b-256 of "abc"', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', 'abc');
  await page.fill('#hash-b2b-outlen', '32');
  await page.fill('#hash-b2b-key', '');
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(
    'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319');
});

test('BLAKE2b keyed (text key "hello"), 32-byte output of "abc"', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', 'abc');
  await page.fill('#hash-b2b-outlen', '32');
  await page.fill('#hash-b2b-key', 'hello');   // text key, hex unchecked
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(
    '3cf2a75f2bba8ca88199dd6cbeb2ccd0abe8e20671258bb934b7a6a94838ad92');
});

test('BLAKE3 XOF: 64-byte output of "" extends the 256-bit hash', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', '');
  await page.selectOption('#hash-b3-mode', 'hash');
  await page.fill('#hash-b3-outlen', '64');
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(
    'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262e00f03e7b69af26b7faaf09fcd333050338ddfe085b8cc869ca98b206c08243a');
});

test('BLAKE3 keyed: "abc" with the official 32-byte key, 64-byte XOF', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', 'abc');
  await page.selectOption('#hash-b3-mode', 'keyed');
  await page.fill('#hash-b3-outlen', '64');
  // key = "whats the Elvish word for friend" (32 bytes) as hex
  await page.fill('#hash-b3-key', '77686174732074686520456c7669736820776f726420666f7220667269656e64');
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(
    '157f8b4b104070014ab0b3b7aff364f794e010e92b1c976318e892f380b534067477f299b2ddd5c51c2563b8ab76772b8f78ffad9d8c2513538fa83b2d9cdea8');
});

test('BLAKE3 derive_key: context + "abc" material, 32 bytes', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', 'abc');
  await page.selectOption('#hash-b3-mode', 'derive');
  await page.fill('#hash-b3-outlen', '32');
  await page.fill('#hash-b3-context', 'BLAKE3 2019-12-27 16:29:52 test vectors context');
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(
    '221c3923b5f3358d596e6cbad6c20c2c63df740e7dc46a8f9ebab07d460ba827');
});

test('BLAKE3 keyed mode rejects a non-32-byte key', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', 'abc');
  await page.selectOption('#hash-b3-mode', 'keyed');
  await page.fill('#hash-b3-key', 'abcd'); // 2 bytes — invalid
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(/32-byte key|64 hex/i);
});

test('default BLAKE3-256 row is unchanged by the new generalization (regression)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'hash');
  await page.fill('#hash-text', 'abc');
  await page.click('#btn-hash-compute');
  // The standard always-on output must still match the official BLAKE3-256("abc") vector.
  await expect(page.locator('#hash-results')).toContainText(
    '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85');
});

// --- SHAKE128 / SHAKE256 (FIPS 202 XOF) in the advanced panel ---

test('SHAKE128 XOF: 16-byte output of "" matches the FIPS 202 vector', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', '');
  await page.selectOption('#hash-shake-fn', '128');
  await page.fill('#hash-shake-outlen', '16');
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText('7f9c2ba4e88f827d616045507605853e');
});

test('SHAKE128 / SHAKE256 XOF of "abc"', async ({ page }) => {
  await openAdvanced(page);
  await page.fill('#hash-text', 'abc');
  await page.selectOption('#hash-shake-fn', '128');
  await page.fill('#hash-shake-outlen', '32');
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(
    '5881092dd818bf5cf8a3ddb793fbcba74097d5c526a6d35f97b83351940f2cc8');

  await page.selectOption('#hash-shake-fn', '256');
  await page.fill('#hash-shake-outlen', '64');
  await page.click('#btn-hash-advanced');
  await expect(page.locator('#hash-advanced-results')).toContainText(
    '483366601360a8771c6863080cc4114d8db44530f8f1e1ee4f94ea37e78b5739d5a15bef186a5386c75744c0527e1faa9f8726e462a12a4feb06bd8801e751e4');
});
