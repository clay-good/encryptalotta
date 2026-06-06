/* eslint-disable */
// ===================================================================
// 18 — Rigorous vectors / edge cases for the tools added in drafts
// 296–301 (asn1, csr, jwk, qr-decode, strength, filetype, Base58Check,
// CIDR-IPv6). The acceptance specs that graduated those tools in
// 13-enhancements / 14-new-tools exercise a single happy path each;
// this file brings them to the same RFC-vector rigor the original
// tools get in 03-vectors.spec.js — multiple modes, round-trips,
// published vectors, and explicit error paths.
// ===================================================================
import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}
async function res(page, sel) { return (await page.locator(sel).textContent()).replace(/\s+/g, ' ').trim(); }

// Real openssl-generated CSR fixtures (each self-verifies under `openssl req -verify`).
const RSA_CSR = [
  '-----BEGIN CERTIFICATE REQUEST-----',
  'MIICjzCCAXcCAQAwSjEeMBwGA1UEAwwVZW5jcnlwdGFsb3R0YS5leGFtcGxlMRsw',
  'GQYDVQQKDBJFbmNyeXB0YWxvdHRhIFRlc3QxCzAJBgNVBAYTAlVTMIIBIjANBgkq',
  'hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtS765IIjFo3Ouub52Lz4FEsnbrsEee7L',
  '4vI2W36l4UEzI4mbJIerOzEIklzkz4619RCFUhpXYlPl7bFq88aJ9rgWE60kphld',
  'jEpNtmzCMJLrdb2mKVL966GXvoy0iU7EwfRIdj4dmnI+Z8okUKAOTfjhxxb58cWk',
  'sIjGVA83HiVwjkZ4k6wXRxgkp7pdOqXP9/jVehKat0Qp82aKWPeLjPSvEJqJgZNl',
  'vZ57UlbZ4w82PaDYCeqoO4nHyhli2q0R26IO8ao4cqOfHUclLOT2tW0ZW8F1TfsR',
  'QvkUult+VLjG6vv/u+5XyX0MOlDWgx8N2h9x+c5qBtaElUf+HmyPxQIDAQABoAAw',
  'DQYJKoZIhvcNAQELBQADggEBADsQeVnKCeOajs2p4sBPDE6NqvuDTFsj/E7p894L',
  '2x4iGvHDLqFw70OUY4n0q1O0NdFWPkgaIVjgvTrje0ZCjGuAhrOv0b/3jboEHtch',
  'XgRdwsEA7pYAcOycdG9zlWcQm3tMTIWeNYUCxyHuddmEzYPsn0eBdZ+rqsFCqfhr',
  'umuJP4W1c5OBVBzcAWF1tP4Z+1Mm8PCEMnBuR/e5jrtyKII4D+V1qeRKEZ3Xtyd2',
  'vA4Nj3TnnfjKzd8lH1YEQkPn0hfMkZJj5tEkUl36kfD+Re7vbxKC2BXb093aRN1C',
  'Jz0gFpp+ATIcee9q0os46+/E3xzsAO//GUgeOvudrrCxEqQ=',
  '-----END CERTIFICATE REQUEST-----'
].join('\n');
const EC_CSR = [
  '-----BEGIN CERTIFICATE REQUEST-----',
  'MIHeMIGGAgEAMCQxEzARBgNVBAMMCmVjLmV4YW1wbGUxDTALBgNVBAoMBFRlc3Qw',
  'WTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQ+7VcsrfeECVdZ3ed/LYvbz9weSBTi',
  'ezEFARinFeITGrJcpq/vHMCMU+xnxPn168khaQMQMNosY6PdlhnpcFOsoAAwCgYI',
  'KoZIzj0EAwIDRwAwRAIgUMTUv1xOxCVQ4na112tebcAA9nmPwt4yPM60ukIl3WIC',
  'IA4LtTMyV3xxyy4Q731krEiUU3r7VofSa7YTKr6rEjnN',
  '-----END CERTIFICATE REQUEST-----'
].join('\n');
const ED_CSR = [
  '-----BEGIN CERTIFICATE REQUEST-----',
  'MIGZME0CAQAwGjEYMBYGA1UEAwwPZWQyNTUxOS5leGFtcGxlMCowBQYDK2VwAyEA',
  'FjJ2brbDaDi2e1F6xa8JP1jKC2Z422i0FSYm8vD1PiqgADAFBgMrZXADQQBvXIgX',
  'cWVwB0Eu4qCTVbrkvbG/f2BYU0IUlYytAnHuSkp7zNJUIXiaa/nRSxTtG2Je5qN/',
  '0VSFlpkoN/UBmdsN',
  '-----END CERTIFICATE REQUEST-----'
].join('\n');

// ---------------- ASN.1 / DER ----------------
test.describe('asn1 (X.690) vectors', () => {
  test('decodes an OBJECT IDENTIFIER to its dotted form (sha256WithRSAEncryption)', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'asn1');
    await page.fill('#asn1-input', '06092a864886f70d01010b'); // OID 1.2.840.113549.1.1.11
    await page.click('#btn-asn1-decode');
    expect(await res(page, '#asn1-results')).toMatch(/1\.2\.840\.113549\.1\.1\.11/);
  });
  test('decodes the Ed25519 SPKI OID 1.3.101.112', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'asn1');
    await page.fill('#asn1-input', '302a300506032b6570032100' + '11'.repeat(32));
    await page.click('#btn-asn1-decode');
    const out = await res(page, '#asn1-results');
    expect(out).toMatch(/SEQUENCE/); expect(out).toMatch(/1\.3\.101\.112/); expect(out).toMatch(/BIT STRING/i);
  });
  test('accepts a PEM CSR and shows its nested structure (long-form length)', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'asn1');
    await page.fill('#asn1-input', RSA_CSR);
    await page.click('#btn-asn1-decode');
    const out = await res(page, '#asn1-results');
    expect(out).toMatch(/SEQUENCE/); expect(out).toMatch(/INTEGER/); expect(out).toMatch(/1\.2\.840\.113549\.1\.1\.1/);
  });
  test('reports malformed DER without throwing', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'asn1');
    await page.fill('#asn1-input', '3082'); // truncated length
    await page.click('#btn-asn1-decode');
    expect((await res(page, '#asn1-results')).toLowerCase()).toMatch(/error|truncat|invalid/);
  });
});

// ---------------- JWK ↔ PEM ----------------
test.describe('jwk ↔ PEM round-trips (RFC 7517/8037)', () => {
  test('Ed25519 OKP (RFC 8037 A.1) → PEM → JWK byte-exact', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'jwk');
    const jwk = '{"kty":"OKP","crv":"Ed25519","x":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}';
    await page.fill('#jwk-input', jwk); await page.click('#btn-jwk-to-pem');
    const pem = await page.locator('#jwk-output').inputValue();
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
    await page.fill('#jwk-input', pem); await page.click('#btn-jwk-to-jwk');
    const back = JSON.parse(await page.locator('#jwk-output').inputValue());
    expect(back).toMatchObject({ kty: 'OKP', crv: 'Ed25519', x: '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo' });
  });
  for (const alg of [
    { label: 'EC P-256', spec: { name: 'ECDSA', namedCurve: 'P-256' }, kty: 'EC' },
    { label: 'EC P-384', spec: { name: 'ECDSA', namedCurve: 'P-384' }, kty: 'EC' },
    { label: 'RSA-2048', spec: { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: [1, 0, 1], hash: 'SHA-256' }, kty: 'RSA' },
  ]) {
    test(`${alg.label} JWK → PEM → JWK round-trips`, async ({ page }) => {
      await page.goto('/index.html'); await gotoTool(page, 'jwk');
      const jwk = await page.evaluate(async (spec) => {
        if (spec.publicExponent) spec.publicExponent = new Uint8Array(spec.publicExponent);
        const k = await crypto.subtle.generateKey(spec, true, ['sign', 'verify']);
        const j = await crypto.subtle.exportKey('jwk', k.publicKey); delete j.key_ops; delete j.ext; return JSON.stringify(j);
      }, alg.spec);
      await page.fill('#jwk-input', jwk); await page.click('#btn-jwk-to-pem');
      const pem = await page.locator('#jwk-output').inputValue();
      expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
      await page.fill('#jwk-input', pem); await page.click('#btn-jwk-to-jwk');
      const back = JSON.parse(await page.locator('#jwk-output').inputValue());
      const orig = JSON.parse(jwk);
      expect(back.kty).toBe(alg.kty);
      if (alg.kty === 'EC') { expect(back.x).toBe(orig.x); expect(back.y).toBe(orig.y); expect(back.crv).toBe(orig.crv); }
      else { expect(back.n).toBe(orig.n); expect(back.e).toBe(orig.e); }
    });
  }
});

// ---------------- CSR (PKCS#10) ----------------
test.describe('csr self-signature verification across key types', () => {
  for (const [label, csr, subjectRe, algRe] of [
    ['RSA', RSA_CSR, /encryptalotta\.example/, /rsa|RSA/],
    ['ECDSA P-256', EC_CSR, /ec\.example/, /ecPublicKey|ecdsa/i],
    ['Ed25519', ED_CSR, /ed25519\.example/, /Ed25519/],
  ]) {
    test(`${label} CSR: subject + algorithm + valid self-signature`, async ({ page }) => {
      await page.goto('/index.html'); await gotoTool(page, 'csr');
      await page.fill('#csr-input', csr); await page.click('#btn-csr-parse');
      const out = await res(page, '#csr-results');
      expect(out).toMatch(subjectRe); expect(out).toMatch(algRe); expect(out).toMatch(/valid/i);
    });
  }
  test('a CSR with a corrupted signature is flagged INVALID', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'csr');
    // Flip a byte in the RSA CSR's base64 body (corrupts the signature region).
    const lines = RSA_CSR.split('\n');
    lines[lines.length - 2] = 'AAAA' + lines[lines.length - 2].slice(4);
    await page.fill('#csr-input', lines.join('\n')); await page.click('#btn-csr-parse');
    expect((await res(page, '#csr-results')).toLowerCase()).toMatch(/invalid|error|could not/);
  });
});

// ---------------- Base58Check (encode tool) ----------------
test.describe('Base58Check (encode)', () => {
  test('genesis P2PKH address decodes to version+hash160', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'encode');
    await page.selectOption('#encode-input-format', 'base58check');
    await page.selectOption('#encode-output-format', 'hex');
    await page.fill('#encode-input', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    await page.click('#btn-encode-convert');
    expect((await page.locator('#encode-output').inputValue()).toLowerCase()).toContain('62e907b15cbf27d5425399ebf6f0fb50ebb88f18');
  });
  test('hex → Base58Check → hex round-trips (checksum appended then verified)', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'encode');
    await page.selectOption('#encode-input-format', 'hex');
    await page.selectOption('#encode-output-format', 'base58check');
    await page.fill('#encode-input', '0062e907b15cbf27d5425399ebf6f0fb50ebb88f18');
    await page.click('#btn-encode-convert');
    const b58c = (await page.locator('#encode-output').inputValue()).trim();
    expect(b58c).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  });
  test('a tampered checksum is rejected', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'encode');
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.selectOption('#encode-input-format', 'base58check');
    await page.selectOption('#encode-output-format', 'hex');
    await page.fill('#encode-input', '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfra'); // last chars altered
    await page.click('#btn-encode-convert');
    expect(await page.locator('#encode-output').inputValue()).toBe('');
  });
});

// ---------------- CIDR IPv6 ----------------
test.describe('cidr IPv6 (RFC 4291/5952)', () => {
  for (const [input, re] of [
    ['::1/128', /loopback/i],
    ['fe80::/10', /link-local/i],
    ['fc00::/7', /unique-local/i],
    ['ff00::/8', /multicast/i],
    ['2000::/3', /global unicast/i],
  ]) {
    test(`${input} → tag`, async ({ page }) => {
      await page.goto('/index.html'); await gotoTool(page, 'cidr');
      await page.fill('#cidr-input', input); await page.click('#btn-cidr-decode');
      expect(await res(page, '#cidr-results')).toMatch(re);
    });
  }
  test('compresses the network and reports the host count', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'cidr');
    await page.fill('#cidr-input', '2001:0db8:0000:0000:0000:0000:0000:0000/48');
    await page.click('#btn-cidr-decode');
    const out = await res(page, '#cidr-results');
    expect(out).toMatch(/2001:db8::/); expect(out).toMatch(/2\^80/);
  });
});

// ---------------- QR decode (modes + error correction) ----------------
test.describe('qr-decode (ISO/IEC 18004)', () => {
  async function decodeViaGenerator(page, text, ecl, flip) {
    await gotoTool(page, 'qr-decode');
    const dataUrl = await page.evaluate(({ text, ecl, flip }) => {
      const qr = qrcode(0, ecl); qr.addData(text); qr.make();
      const n = qr.getModuleCount(), s = 6, q = 4, W = (n + 2 * q) * s;
      const cv = document.createElement('canvas'); cv.width = cv.height = W; const x = cv.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, W); x.fillStyle = '#000';
      const dark = (r, c) => qr.isDark(r, c);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { let d = dark(r, c); if (flip && r === 12 && c === 12) d = !d; if (d) x.fillRect((c + q) * s, (r + q) * s, s, s); }
      return cv.toDataURL('image/png');
    }, { text, ecl, flip });
    await page.setInputFiles('#qr-decode-file', { name: 'q.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') });
    await expect(page.locator('#qr-decode-output')).toHaveValue(text, { timeout: 5000 });
  }
  test('byte mode (UTF-8) round-trips', async ({ page }) => { await page.goto('/index.html'); await decodeViaGenerator(page, 'https://encryptalotta.com/#/keys/qr', 'M'); });
  test('numeric mode round-trips', async ({ page }) => { await page.goto('/index.html'); await decodeViaGenerator(page, '8675309000111222333', 'L'); });
  test('alphanumeric mode round-trips', async ({ page }) => { await page.goto('/index.html'); await decodeViaGenerator(page, 'HELLO WORLD 42 $%*+-./:', 'Q'); });
  test('recovers from a flipped module via Reed-Solomon (H level)', async ({ page }) => { await page.goto('/index.html'); await decodeViaGenerator(page, 'encryptalotta', 'H', true); });
});

// ---------------- Passphrase strength ----------------
test.describe('strength estimator bands', () => {
  async function score(page, pw) { await page.fill('#strength-input', pw); await page.click('#btn-strength-check'); return (await res(page, '#strength-results')).toLowerCase(); }
  test('common password → very weak; long passphrase → excellent; bits shown', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'strength');
    expect(await score(page, 'password')).toMatch(/very weak|0/);
    const strong = await score(page, 'Tr0ub4dour&3 correct-horse-battery-staple!');
    expect(strong).toMatch(/strong|excellent|3|4/); expect(strong).toMatch(/bits|entropy/);
  });
  test('repeated / sequential inputs are penalised', async ({ page }) => {
    await page.goto('/index.html'); await gotoTool(page, 'strength');
    expect(await score(page, 'aaaaaaaaaa')).toMatch(/very weak|weak|repeat/);
    expect(await score(page, 'abcdefghij')).toMatch(/very weak|weak|sequen/);
  });
});

// ---------------- File type identifier ----------------
test.describe('filetype magic-number signatures', () => {
  for (const [hex, re] of [
    ['ffd8ffe000104a4649460001', /JPEG/i],
    ['474946383961', /GIF/i],
    ['504b0304', /ZIP/i],
    ['1f8b08', /gzip/i],
    ['7f454c46', /ELF/i],
    ['0061736d01000000', /WebAssembly/i],
    ['25504446', /PDF/i],
    ['52494646' + '00000000' + '57454250', /WebP/i],
  ]) {
    test(`${hex.slice(0, 12)}… → ${re.source}`, async ({ page }) => {
      await page.goto('/index.html'); await gotoTool(page, 'filetype');
      await page.fill('#filetype-hex', hex); await page.click('#btn-filetype-identify');
      expect(await res(page, '#filetype-results')).toMatch(re);
    });
  }
});
