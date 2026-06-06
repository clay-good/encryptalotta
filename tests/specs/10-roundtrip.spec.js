/* eslint-disable */
// ===================================================================
// 10 — Codec round-trip identity. For every reversible transform the
// app offers, encode(x) then decode() must return byte-for-byte x.
// Round-tripping is the single strongest property test for a codec:
// it catches padding bugs, charset drift, Unicode mishandling, and
// off-by-one truncation that fixed-vector tests can miss.
//
// Standards: RFC 4648 (Base16/Base32/Base64/Base64url), Base58
// (Bitcoin alphabet), RFC 7468 (PEM textual encoding), RFC 3986
// (percent-encoding), RFC 8259 (JSON), YAML 1.2.
//
// Payloads deliberately span ASCII, empty-ish, multibyte UTF-8, emoji
// (surrogate pairs), and bytes that stress padding boundaries.
// ===================================================================

import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}

const TEXTS = [
  'hello',                       // simple ASCII
  'a',                           // 1 byte → padding edge
  'ab',                          // 2 bytes → padding edge
  'abc',                         // 3 bytes → no padding
  'The quick brown fox.',        // spaces + punctuation
  'Grüße 世界 🌍🔐',              // multibyte + emoji (surrogate pairs)
  'line1\nline2\ttab',           // control whitespace
];

// ===================================================================
// Encode tool — every (text ↔ baseN) pair must round-trip.
// ===================================================================
test.describe('encode round-trip (RFC 4648 + Base58)', () => {
  const FORMATS = ['hex', 'base64', 'base64url', 'base32', 'base58'];

  for (const fmt of FORMATS) {
    for (const text of TEXTS) {
      test(`text → ${fmt} → text :: ${JSON.stringify(text).slice(0, 24)}`, async ({ page }) => {
        page.on('dialog', async d => { await d.dismiss().catch(() => {}); });
        await page.goto('/index.html');
        await gotoTool(page, 'encode');

        // Forward: text → fmt
        await page.selectOption('#encode-input-format', 'text');
        await page.selectOption('#encode-output-format', fmt);
        await page.fill('#encode-input', text);
        await page.click('#btn-encode-convert');
        const encoded = await page.locator('#encode-output').inputValue();
        expect(encoded.length, `${fmt} of ${JSON.stringify(text)} should be non-empty`).toBeGreaterThan(0);

        // Reverse: fmt → text
        await page.selectOption('#encode-input-format', fmt);
        await page.selectOption('#encode-output-format', 'text');
        await page.fill('#encode-input', encoded);
        await page.click('#btn-encode-convert');
        const decoded = await page.locator('#encode-output').inputValue();
        expect(decoded, `${fmt} round-trip lost data`).toBe(text);
      });
    }
  }

  test('hex output is lowercase and contains only [0-9a-f]', async ({ page }) => {
    await page.goto('/index.html');
    await gotoTool(page, 'encode');
    await page.selectOption('#encode-input-format', 'text');
    await page.selectOption('#encode-output-format', 'hex');
    await page.fill('#encode-input', 'Hello');
    await page.click('#btn-encode-convert');
    const hex = await page.locator('#encode-output').inputValue();
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex).toBe('48656c6c6f'); // "Hello" — fixed cross-check
  });

  test('base64url output avoids + and / (RFC 4648 §5)', async ({ page }) => {
    await page.goto('/index.html');
    await gotoTool(page, 'encode');
    await page.selectOption('#encode-input-format', 'text');
    await page.selectOption('#encode-output-format', 'base64url');
    // Bytes 0xFB 0xFF encode to "+/" in standard base64 → "-_" in base64url.
    await page.selectOption('#encode-input-format', 'hex');
    await page.fill('#encode-input', 'fbff');
    await page.click('#btn-encode-convert');
    const out = await page.locator('#encode-output').inputValue();
    expect(out).not.toMatch(/[+/]/);
    expect(out).toMatch(/[-_]/);
  });
});

// ===================================================================
// PEM ↔ DER — DER(hex) → PEM → DER(hex) must be identity (RFC 7468).
// ===================================================================
test.describe('pem-der round-trip (RFC 7468)', () => {
  const HEX = '30030101ff'; // a tiny well-formed DER blob (SEQUENCE { BOOLEAN TRUE })
  test('DER(hex) → PEM → DER(hex) is identity', async ({ page }) => {
    page.on('dialog', async d => { await d.dismiss().catch(() => {}); });
    await page.goto('/index.html');
    await gotoTool(page, 'pem-der');

    await page.fill('#pem-der-input', HEX);
    await page.fill('#pem-der-label', 'CERTIFICATE');
    await page.click('#btn-der-to-pem');
    const pem = await page.locator('#pem-der-output').inputValue();
    expect(pem).toContain('-----BEGIN CERTIFICATE-----');
    expect(pem).toContain('-----END CERTIFICATE-----');

    await page.fill('#pem-der-input', pem);
    await page.click('#btn-pem-to-der');
    const der = (await page.locator('#pem-der-output').inputValue()).replace(/[\s:]/g, '').toLowerCase();
    expect(der).toContain(HEX);
  });
});

// ===================================================================
// CSV ↔ JSON — csv → json → csv preserves the table (RFC 4180 / RFC 8259).
// ===================================================================
test.describe('csv/json round-trip (RFC 4180)', () => {
  test('CSV → JSON → CSV preserves rows and columns', async ({ page }) => {
    page.on('dialog', async d => { await d.dismiss().catch(() => {}); });
    await page.goto('/index.html');
    await gotoTool(page, 'csv');

    const csv = 'name,age\nAlice,30\nBob,25';
    await page.selectOption('#csv-from', 'csv');
    await page.selectOption('#csv-to', 'json');
    await page.fill('#csv-input', csv);
    await page.click('#btn-csv-convert');
    const json = await page.locator('#csv-output').inputValue();
    const parsed = JSON.parse(json);
    expect(parsed).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]);

    await page.selectOption('#csv-from', 'json');
    await page.selectOption('#csv-to', 'csv');
    await page.fill('#csv-input', json);
    await page.click('#btn-csv-convert');
    const csv2 = (await page.locator('#csv-output').inputValue()).trim();
    expect(csv2.split(/\r?\n/)[0]).toBe('name,age');
    expect(csv2).toContain('Alice,30');
    expect(csv2).toContain('Bob,25');
  });

  test('CSV quoting survives a comma inside a field (RFC 4180 §2.5)', async ({ page }) => {
    page.on('dialog', async d => { await d.dismiss().catch(() => {}); });
    await page.goto('/index.html');
    await gotoTool(page, 'csv');
    const csv = 'name,note\nAlice,"hello, world"';
    await page.selectOption('#csv-from', 'csv');
    await page.selectOption('#csv-to', 'json');
    await page.fill('#csv-input', csv);
    await page.click('#btn-csv-convert');
    const parsed = JSON.parse(await page.locator('#csv-output').inputValue());
    expect(parsed[0].note).toBe('hello, world');
  });
});

// ===================================================================
// JSON ↔ YAML — json → yaml → json is semantically identical (YAML 1.2).
// ===================================================================
test.describe('format json/yaml round-trip (YAML 1.2)', () => {
  test('JSON → YAML → JSON preserves the document', async ({ page }) => {
    page.on('dialog', async d => { await d.dismiss().catch(() => {}); });
    await page.goto('/index.html');
    await gotoTool(page, 'format');

    const obj = { name: 'enc', n: 42, ok: true, list: [1, 2, 3], nested: { a: 'b' } };
    const json = JSON.stringify(obj);

    await page.selectOption('#format-from', 'json');
    await page.selectOption('#format-to', 'yaml');
    await page.fill('#format-input', json);
    await page.click('#btn-format-run');
    const yaml = await page.locator('#format-output').inputValue();
    expect(yaml.length).toBeGreaterThan(0);

    await page.selectOption('#format-from', 'yaml');
    await page.selectOption('#format-to', 'json');
    await page.fill('#format-input', yaml);
    await page.click('#btn-format-run');
    const json2 = await page.locator('#format-output').inputValue();
    expect(JSON.parse(json2)).toEqual(obj);
  });
});

// ===================================================================
// URL percent-encoding — encode → decode is identity (RFC 3986).
// ===================================================================
test.describe('url percent-encoding round-trip (RFC 3986)', () => {
  for (const raw of ['a b/c?d=é&x=1', 'spaces and #hash', 'Grüße/世界', '100% sure']) {
    test(`encode → decode :: ${JSON.stringify(raw).slice(0, 24)}`, async ({ page }) => {
      page.on('dialog', async d => { await d.dismiss().catch(() => {}); });
      await page.goto('/index.html');
      await gotoTool(page, 'url');

      await page.fill('#url-input', raw);
      await page.click('#btn-url-encode');
      const enc = await page.locator('#url-codec').inputValue();
      expect(enc).not.toBe('');

      await page.fill('#url-input', enc);
      await page.click('#btn-url-decode');
      const dec = await page.locator('#url-codec').inputValue();
      expect(dec).toBe(raw);
    });
  }
});
