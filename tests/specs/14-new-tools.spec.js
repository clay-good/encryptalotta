/* eslint-disable */
// ===================================================================
// 14 — Specs for NEW tools (executable, test.fixme).
//
// A curated set of additions that increase the toolbox's value while
// staying true to its three constraints: 100% client-side, no network
// uploads, and standards-anchored. Each new tool gets a view id, the
// control ids an implementer should add, and a concrete acceptance
// test (with a published vector wherever one exists).
//
// Selection rationale: each fills a real gap adjacent to tools that
// already exist — the ASN.1/CSR/JWK tools complete the X.509/JOSE
// toolchain; age complements PGP; the QR decoder is the inverse of the
// QR generator; strength + filetype are offline privacy aids. Nothing
// here phones home — the "no server uploads" promise is preserved.
//
// When a tool ships: add its `<id>-view`, register it in the
// KNOWN_VIEWS set in 08-stress.spec.js, add it to 00-introspect /
// 05-a11y, and remove `.fixme` here.
// ===================================================================

import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}
async function readResult(page, sel) {
  return (await page.locator(sel).textContent()).replace(/\s+/g, ' ').trim();
}

// ===================================================================
// NEW TOOL 1 — ASN.1 / DER structure decoder (ITU-T X.690).
// A generic tag-length-value tree viewer. The app already parses X.509,
// CMS, and CBOR; a raw ASN.1 viewer lets users inspect ANY DER blob
// (keys, OCSP, timestamps) that the specialized parsers don't cover.
// view: #asn1-view  input: #asn1-input (hex/base64/PEM)  out: #asn1-results
// ===================================================================
test('NEW asn1: decodes a DER blob into a typed TLV tree (X.690)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'asn1');
  // SEQUENCE { INTEGER 1, BOOLEAN TRUE } = 30 06 02 01 01 01 01 ff
  await page.fill('#asn1-input', '30060201010101ff');
  await page.click('#btn-asn1-decode');
  const out = await readResult(page, '#asn1-results');
  expect(out).toMatch(/SEQUENCE/i);
  expect(out).toMatch(/INTEGER/i);
  expect(out).toMatch(/BOOLEAN/i);
});

// ===================================================================
// NEW TOOL 2 — CSR (PKCS#10) decoder (RFC 2986).
// Completes the certificate lifecycle: the app reads certs (tls-cert)
// but not the signing requests that produce them. Show subject DN,
// public-key algorithm, SANs, and whether the self-signature verifies.
// view: #csr-view  input: #csr-input  out: #csr-results
// ===================================================================
test('NEW csr: decodes a PKCS#10 request and checks the self-signature (RFC 2986)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'csr');
  // Real RSA-2048 CSR fixture (CN=encryptalotta.example, O=Encryptalotta Test, C=US),
  // generated with `openssl req -new -newkey rsa:2048 -nodes`; `openssl req -verify`
  // confirms the self-signature is valid.
  const csr = [
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
  await page.fill('#csr-input', csr);
  await page.click('#btn-csr-parse');
  const out = await readResult(page, '#csr-results');
  expect(out).toMatch(/Subject/i);
  expect(out).toMatch(/encryptalotta\.example/);   // subject CN decoded
  expect(out).toMatch(/Public Key|Algorithm/i);
  expect(out).toMatch(/Signature|self-sign/i);
  expect(out).toMatch(/valid/i);                   // RSA self-signature verifies
});

// ===================================================================
// NEW TOOL 3 — JWK ↔ PEM key converter (RFC 7517 / RFC 7518 / RFC 8037).
// The JWT verifier needs keys; today users must convert JWK→PEM elsewhere.
// Bridges the Ed25519/X25519/RSA tools to the JOSE world, fully offline.
// view: #jwk-view  input: #jwk-input  out: #jwk-output  btns: to-pem / to-jwk
// ===================================================================
test('NEW jwk: converts a public JWK to SPKI PEM and back (RFC 7517)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'jwk');
  // RFC 8037 Appendix A.1 public Ed25519 JWK:
  const jwk = '{"kty":"OKP","crv":"Ed25519","x":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}';
  await page.fill('#jwk-input', jwk);
  await page.click('#btn-jwk-to-pem');
  const pem = await page.locator('#jwk-output').inputValue();
  expect(pem).toContain('-----BEGIN PUBLIC KEY-----');

  await page.fill('#jwk-input', pem);
  await page.click('#btn-jwk-to-jwk');
  const back = JSON.parse(await page.locator('#jwk-output').inputValue());
  expect(back.kty).toBe('OKP');
  expect(back.crv).toBe('Ed25519');
  expect(back.x).toBe('11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo');
});

// ===================================================================
// NEW TOOL 4 — age encryption (X25519, the modern PGP alternative).
// The app already has X25519 key agreement; age packages it into a
// friendly file/text format. Round-trip a message through a known
// recipient/identity pair. 100% local — no recipients are fetched.
// view: #age-view  inputs: #age-recipient / #age-identity / #age-message
// ===================================================================
test('NEW age: generate keypair, encrypt to the recipient, decrypt with its identity', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'age');
  // Generate a fresh keypair in-browser.
  await page.check('input[name="age-mode"][value="generate"]');
  await page.click('#btn-age-generate');
  const recipient = (await page.locator('#age-gen-recipient').inputValue()).trim();
  const identity = (await page.locator('#age-gen-identity').inputValue()).trim();
  expect(recipient).toMatch(/^age1[0-9a-z]+$/);
  expect(identity).toMatch(/^AGE-SECRET-KEY-1[0-9A-Z]+$/);

  // Encrypt a message to the recipient.
  await page.check('input[name="age-mode"][value="encrypt"]');
  await page.check('input[name="age-enc-type"][value="keys"]');
  await page.fill('#age-enc-recipients', recipient);
  await page.fill('#age-enc-input', 'hello age');
  await page.click('#btn-age-encrypt');
  await expect(page.locator('#age-enc-output')).toHaveValue(/-----BEGIN AGE ENCRYPTED FILE-----/);
  const ciphertext = await page.locator('#age-enc-output').inputValue();

  // Decrypt with the identity and recover the plaintext.
  await page.check('input[name="age-mode"][value="decrypt"]');
  await page.check('input[name="age-dec-type"][value="key"]');
  await page.fill('#age-dec-identity', identity);
  await page.fill('#age-dec-input', ciphertext);
  await page.click('#btn-age-decrypt');
  await expect(page.locator('#age-dec-output')).toHaveValue('hello age');
});

// ===================================================================
// NEW TOOL 5 — QR decoder (image → text), the inverse of the QR tool.
// Upload a QR PNG/JPEG and recover the payload, entirely in-browser.
// Pairs naturally with the existing generator (and the "scan a paper
// key back in" workflow). view: #qr-decode-view  input: #qr-decode-file
// ===================================================================
test('NEW qr-decode: recovers the payload from an uploaded QR image', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'qr-decode');
  // Generate a real QR PNG for "encryptalotta" in-page via the vendored qrcode-generator,
  // then feed it to the file input — the inverse round-trip the tool exists for.
  const dataUrl = await page.evaluate(() => {
    const qr = qrcode(0, 'M'); qr.addData('encryptalotta'); qr.make();
    const n = qr.getModuleCount(), scale = 6, quiet = 4, W = (n + 2 * quiet) * scale;
    const cv = document.createElement('canvas'); cv.width = cv.height = W;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, W); ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    return cv.toDataURL('image/png');
  });
  await page.setInputFiles('#qr-decode-file', { name: 'qr.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') });
  await expect(page.locator('#qr-decode-output')).toHaveValue('encryptalotta', { timeout: 5000 });
});

// ===================================================================
// NEW TOOL 6 — Passphrase strength estimator (offline).
// Entropy + order-of-magnitude crack-time for a candidate secret, with
// NO network call (unlike HIBP-style tools, which would breach the
// "no uploads" promise). Complements the password generator.
// view: #strength-view  input: #strength-input  out: #strength-results
// ===================================================================
test('NEW strength: rates a weak vs strong passphrase offline', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'strength');
  await page.fill('#strength-input', 'password');
  await page.click('#btn-strength-check');
  expect((await readResult(page, '#strength-results')).toLowerCase()).toMatch(/very weak|weak|0|1/);

  await page.fill('#strength-input', 'correct horse battery staple printer 9!');
  await page.click('#btn-strength-check');
  const strong = (await readResult(page, '#strength-results')).toLowerCase();
  expect(strong).toMatch(/strong|excellent|4/);
  expect(strong).toMatch(/bits|entropy/);
});

// ===================================================================
// NEW TOOL 7 — File magic-number / type identifier (offline).
// "Know what you're about to share." Reads only the leading bytes and
// names the format from its signature — never uploads the file.
// view: #filetype-view  inputs: #filetype-file (file) or #filetype-hex
// ===================================================================
test('NEW filetype: identifies a format from its magic bytes', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'filetype');
  await page.fill('#filetype-hex', '89504e470d0a1a0a'); // PNG signature
  await page.click('#btn-filetype-identify');
  const out = await readResult(page, '#filetype-results');
  expect(out).toMatch(/PNG/i);
  expect(out).toMatch(/image\/png/i);

  await page.fill('#filetype-hex', '25504446'); // "%PDF"
  await page.click('#btn-filetype-identify');
  expect(await readResult(page, '#filetype-results')).toMatch(/PDF/i);
});
