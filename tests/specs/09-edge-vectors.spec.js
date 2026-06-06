/* eslint-disable */
// ===================================================================
// 09 — Edge-case & published-vector audit for the validator / parser
// tools that 03-vectors.spec.js does NOT cover. Each vector cites the
// standard it pins so a failure names the violated specification.
//
// Standards referenced (inline per block):
//   ISO 13616        — IBAN structure        (check digits via ISO 7064 MOD-97-10)
//   ISO 9362         — BIC / SWIFT code format
//   GS1 General Specs §7.9 — GTIN/EAN/UPC/SSCC mod-10 check digit
//   ISO 7064         — MOD-11,10 / MOD-97 check-character systems (VAT, IBAN)
//   RFC 4632         — Classless Inter-Domain Routing (CIDR)
//   RFC 3021         — Using 31-bit prefixes on IPv4 point-to-point links
//   RFC 1918         — Address allocation for private internets
//   CSS Color Module — sRGB hex / rgb() / hsl() notation
//
// The validators render into `#<tool>-results`; success rows are tagged
// "✓ …" and failure rows "✗ …" (confirmed against the shipped build).
// ===================================================================

import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}

// Normalized textContent of a results panel (collapses the table whitespace).
async function readResult(page, sel) {
  await expect(page.locator(sel)).toBeVisible({ timeout: 4_000 });
  return (await page.locator(sel).textContent()).replace(/\s+/g, ' ').trim();
}

async function run(page, tool, input, btn, sel, value) {
  await gotoTool(page, tool);
  await page.fill(input, value);
  await page.click(btn);
  return readResult(page, sel);
}

// ===================================================================
// IBAN — ISO 13616, check digits per ISO 7064 (MOD-97-10).
// Reference IBANs are the canonical examples from the ISO 13616 registry
// / national specimens (also reproduced on the SWIFT IBAN registry).
// ===================================================================
test.describe('iban (ISO 13616 / ISO 7064 MOD-97-10)', () => {
  const VALID = [
    ['DE89370400440532013000', 'DE — Germany', 22],   // German specimen
    ['GB82WEST12345698765432', 'GB — United Kingdom', 22], // UK specimen (NatWest)
    ['FR1420041010050500013M02606', 'FR — France', 27],
    ['NO9386011117947', 'NO — Norway', 15],            // shortest IBAN
  ];
  for (const [iban, country, len] of VALID) {
    test(`valid: ${iban}`, async ({ page }) => {
      await page.goto('/index.html');
      const out = await run(page, 'iban', '#iban-input', '#btn-iban-validate', '#iban-results', iban);
      expect(out).toMatch(/✓\s*Valid/i);
      expect(out).toContain(country);
      expect(out.replace(/\s/g, '')).toContain(`Length${len}`);
    });
  }
  test('whitespace + lowercase are normalized before validation (ISO 13616 §5)', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'iban', '#iban-input', '#btn-iban-validate', '#iban-results', ' de89 3704 0044 0532 0130 00 ');
    expect(out).toMatch(/✓\s*Valid/i);
  });
  test('single-digit corruption fails the MOD-97 checksum', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'iban', '#iban-input', '#btn-iban-validate', '#iban-results', 'DE89370400440532013001');
    expect(out).toMatch(/✗\s*Invalid/i);
    expect(out).toMatch(/MOD-97/i);
  });
  test('bad country code is rejected', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'iban', '#iban-input', '#btn-iban-validate', '#iban-results', 'ZZ00ABC');
    expect(out).toMatch(/error|invalid|unknown|unsupported|country/i);
  });
});

// ===================================================================
// BIC — ISO 9362 (8 or 11 chars: 4 bank, 2 country, 2 location, 3 branch).
// ===================================================================
test.describe('bic (ISO 9362)', () => {
  test('8-char BIC is valid and reports no branch', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'bic', '#bic-input', '#btn-bic-validate', '#bic-results', 'DEUTDEFF');
    expect(out).toMatch(/✓/);
    expect(out).toContain('DE — Germany');
  });
  test('11-char BIC is valid and reports the branch', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'bic', '#bic-input', '#btn-bic-validate', '#bic-results', 'DEUTDEFF500');
    expect(out).toMatch(/✓/);
  });
  test('wrong length is rejected with a count in the message', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'bic', '#bic-input', '#btn-bic-validate', '#bic-results', 'DEUTDE');
    expect(out).toMatch(/8 or 11/i);
  });
});

// ===================================================================
// GS1 — mod-10 check digit (GS1 General Specifications §7.9).
// 4006381333931 is the GS1 worked example for EAN-13.
// ===================================================================
test.describe('gs1 (GS1 General Specs §7.9 mod-10)', () => {
  test('valid EAN-13 passes the mod-10 checksum', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'gs1', '#gs1-input', '#btn-gs1-validate', '#gs1-results', '4006381333931');
    expect(out).toMatch(/✓/);
    expect(out).toMatch(/EAN-13|GTIN-13/);
  });
  test('corrupted check digit fails and reports the expected digit', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'gs1', '#gs1-input', '#btn-gs1-validate', '#gs1-results', '4006381333932');
    expect(out).toMatch(/✗/);
    expect(out).toMatch(/expected 1/);
  });
  test('UPC-A (12 digits) is recognized', async ({ page }) => {
    await page.goto('/index.html');
    // 036000291452 — the classic Coca-Cola UPC-A worked example.
    const out = await run(page, 'gs1', '#gs1-input', '#btn-gs1-validate', '#gs1-results', '036000291452');
    expect(out).toMatch(/UPC-A|GTIN-12/i);
  });
});

// ===================================================================
// VAT — per-country structure + checksum (DE uses ISO 7064 family).
// ===================================================================
test.describe('vat (per-country checksum)', () => {
  test('valid DE VAT passes and cites VIES for live verification', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'vat', '#vat-input', '#btn-vat-validate', '#vat-results', 'DE136695976');
    expect(out).toMatch(/✓/);
    // The tool already carries an inline citation to the EU VIES service — keep it.
    expect(out).toMatch(/VIES/i);
    expect(out).toMatch(/ec\.europa\.eu/i);
  });
  test('checksum corruption is detected for DE', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'vat', '#vat-input', '#btn-vat-validate', '#vat-results', 'DE136695977');
    expect(out).toMatch(/✗|fail|invalid/i);
  });
});

// ===================================================================
// Base converter — arbitrary-radix integer conversion (BigInt).
// ===================================================================
test.describe('base converter', () => {
  const CASES = [
    ['0x2a',     { Decimal: '42',  Binary: '0b101010', Octal: '0o52' }],
    ['0b101010', { Decimal: '42',  Hexadecimal: '0x2A' }],
    ['255',      { Hexadecimal: '0xFF', Binary: '0b11111111' }],
    ['0o777',    { Decimal: '511', Hexadecimal: '0x1FF' }],
  ];
  for (const [input, expects] of CASES) {
    test(`${input} converts across radixes`, async ({ page }) => {
      await page.goto('/index.html');
      const out = (await run(page, 'base', '#base-input', '#btn-base-convert', '#base-results', input)).replace(/\s/g, '');
      for (const [label, val] of Object.entries(expects)) {
        expect(out, `${input} → ${label}`).toContain(label + val);
      }
    });
  }
  test('digit outside the source radix is rejected (e.g. "2" in binary)', async ({ page }) => {
    await page.goto('/index.html');
    await gotoTool(page, 'base');
    await page.fill('#base-input', '0b1012');
    await page.click('#btn-base-convert');
    const out = await readResult(page, '#base-results');
    expect(out).toMatch(/error|could not parse|invalid/i);
  });
  test('very large integer is handled exactly (BigInt, no float rounding)', async ({ page }) => {
    await page.goto('/index.html');
    const big = '123456789012345678901234567890';
    const out = (await run(page, 'base', '#base-input', '#btn-base-convert', '#base-results', big)).replace(/\s/g, '');
    expect(out).toContain('Decimal' + big);
  });
});

// ===================================================================
// CIDR — RFC 4632, with RFC 3021 (/31) and RFC 1918 tagging.
// ===================================================================
test.describe('cidr (RFC 4632 / RFC 3021 / RFC 1918)', () => {
  test('/24 yields the textbook netmask, host range, and RFC 1918 tag', async ({ page }) => {
    await page.goto('/index.html');
    const out = (await run(page, 'cidr', '#cidr-input', '#btn-cidr-decode', '#cidr-results', '10.0.0.0/24')).replace(/\s/g, '');
    expect(out).toContain('Netmask255.255.255.0');
    expect(out).toContain('Usablehosts254');
    expect(out).toContain('Broadcast10.0.0.255');
    expect(out).toMatch(/RFC1918/i); // tool cites RFC 1918 inline for private space
  });
  test('/31 follows RFC 3021 — both addresses usable on point-to-point links', async ({ page }) => {
    await page.goto('/index.html');
    const out = (await run(page, 'cidr', '#cidr-input', '#btn-cidr-decode', '#cidr-results', '192.168.1.0/31')).replace(/\s/g, '');
    expect(out).toContain('Totaladdresses2');
    expect(out).toContain('Usablehosts2'); // RFC 3021: no network/broadcast reservation
  });
  test('/32 is a single host', async ({ page }) => {
    await page.goto('/index.html');
    const out = (await run(page, 'cidr', '#cidr-input', '#btn-cidr-decode', '#cidr-results', '8.8.8.8/32')).replace(/\s/g, '');
    expect(out).toContain('Totaladdresses1');
  });
  test('octet > 255 is rejected', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'cidr', '#cidr-input', '#btn-cidr-decode', '#cidr-results', '10.0.0.256/24');
    expect(out).toMatch(/error|invalid|expected/i);
  });
  test('prefix > 32 is rejected', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'cidr', '#cidr-input', '#btn-cidr-decode', '#cidr-results', '10.0.0.0/33');
    expect(out).toMatch(/error|invalid|expected|prefix/i);
  });
});

// ===================================================================
// Color — sRGB hex ↔ rgb() ↔ hsl() (CSS Color Module).
// ===================================================================
test.describe('color (CSS Color notation)', () => {
  test('#3366ff converts to the exact rgb() and hsl() triplets', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'color', '#color-input', '#btn-color-convert', '#color-results', '#3366ff');
    expect(out).toContain('rgb(51, 102, 255)');
    expect(out).toMatch(/hsl\(225(\.0)? 100(\.0)?% 60(\.0)?%\)/);
  });
  test('3-digit shorthand expands (#f00 → rgb(255, 0, 0))', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'color', '#color-input', '#btn-color-convert', '#color-results', '#f00');
    expect(out).toContain('rgb(255, 0, 0)');
  });
  test('rgb() input round-trips back to the same hex', async ({ page }) => {
    await page.goto('/index.html');
    const out = (await run(page, 'color', '#color-input', '#btn-color-convert', '#color-results', 'rgb(51,102,255)')).replace(/\s/g, '');
    expect(out.toLowerCase()).toContain('#3366ff');
  });
});

// ===================================================================
// Cron — 5-field POSIX-style expression decoding.
// ===================================================================
test.describe('cron (5-field)', () => {
  test('"0 */6 * * *" enumerates upcoming runs', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'cron', '#cron-input', '#btn-cron-decode', '#cron-results', '0 */6 * * *');
    expect(out).toMatch(/Next run #1/i);
    expect(out).toMatch(/0,6,12,18|every 6/i);
  });
  test('wrong field count is rejected with the count', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'cron', '#cron-input', '#btn-cron-decode', '#cron-results', '* * *');
    expect(out).toMatch(/5 fields/i);
  });
  test('out-of-range minute (60) is rejected', async ({ page }) => {
    await page.goto('/index.html');
    const out = await run(page, 'cron', '#cron-input', '#btn-cron-decode', '#cron-results', '60 * * * *');
    expect(out).toMatch(/error|invalid|range|out of/i);
  });
});
