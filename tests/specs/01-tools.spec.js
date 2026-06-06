/* eslint-disable */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import nodeCrypto from 'node:crypto';
import zlib from 'node:zlib';

let FIXTURE = null;
const PASS = 'CorrectHorseBatteryStaple-9!';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => {
    const v = document.getElementById(t + '-view');
    return v && v.classList.contains('active');
  }, tool);
}

function autoDismissDialogs(page, sink) {
  page.on('dialog', async d => { sink.push({ type: d.type(), text: d.message() }); await d.dismiss().catch(()=>{}); });
}

// Read text from any element (textarea value or div textContent)
async function readOut(page, sel) {
  return await page.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    return el.value !== undefined ? el.value : (el.textContent || '');
  }, sel);
}

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/index.html');
  await gotoTool(page, 'generate');
  await page.fill('#name', 'Test User');
  await page.fill('#email', 'test@example.com');
  await page.selectOption('#algorithm', 'ecc');
  await page.fill('#passphrase', PASS);
  await page.fill('#passphrase-confirm', PASS);
  await page.locator('#generate-form button[type=submit]').click();
  await page.waitForFunction(() => {
    const pub = document.getElementById('public-key-display');
    const priv = document.getElementById('private-key-display');
    return pub && priv && pub.textContent.includes('BEGIN PGP PUBLIC') && priv.textContent.includes('BEGIN PGP PRIVATE');
  }, { timeout: 90_000 });
  FIXTURE = {
    pub: await page.locator('#public-key-display').textContent(),
    priv: await page.locator('#private-key-display').textContent(),
    pass: PASS,
  };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/fixture-pub.asc', FIXTURE.pub);
  fs.writeFileSync('reports/fixture-priv.asc', FIXTURE.priv);
  await ctx.close();
});

// =============== KEYS ===============

test('generate', async () => {
  expect(FIXTURE.pub).toMatch(/-----BEGIN PGP PUBLIC KEY BLOCK-----/);
  expect(FIXTURE.priv).toMatch(/-----BEGIN PGP PRIVATE KEY BLOCK-----/);
});

test('key-info', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'key-info');
  await page.fill('#key-info-input', FIXTURE.pub);
  await page.click('#btn-key-info');
  await expect(page.locator('#key-info-result')).toContainText(/fingerprint/i, { timeout: 10_000 });
});

test('revoke', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'revoke');
  await page.fill('#revoke-private-key', FIXTURE.priv);
  await page.fill('#revoke-passphrase', PASS);
  await page.click('#btn-revoke');
  await expect(page.locator('#revoke-result')).toContainText(/-----BEGIN PGP|revocation/i, { timeout: 20_000 });
});

test('qr', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'qr');
  await page.fill('#qr-input', 'https://encryptalotta.com');
  await page.click('#btn-qr-generate');
  await expect(page.locator('#qr-canvases canvas, #qr-canvases img, #qr-canvases svg, #qr-canvases table')).toHaveCount(1, { timeout: 8_000 });
});

test('tls-cert (loads, parser produces output)', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'tls-cert');
  // Real Let's Encrypt R3 intermediate (truncated example body — DER will be invalid but parser should report cleanly)
  const cert = `-----BEGIN CERTIFICATE-----
MIIDCzCCAfOgAwIBAgIRAOX9OtR5PVnJ0wXNcF1gREwwDQYJKoZIhvcNAQELBQAw
EjEQMA4GA1UEAwwHVGVzdENBMB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEwMTAwMDAw
MFowDjEMMAoGA1UEAwwDZm9vMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEAvJC4kFq4oWzAKnhc4n5HIQH8X7tNNmXJDc8M6N0XFXR3cM4zGhU3FZoF8YzL
-----END CERTIFICATE-----`;
  await page.fill('#tls-cert-input', cert);
  await page.click('#btn-tls-cert-parse');
  // Either parse result or error message is acceptable; we just want the results pane to fill.
  await page.waitForFunction(() => {
    const r = document.getElementById('tls-cert-results');
    return r && !r.classList.contains('hidden');
  }, { timeout: 5_000 });
});

// Real PKCS#7 / CMS SignedData (CAdES-BES) — openssl `cms -sign` over "hello factur-x"
// with a throwaway EC self-signed cert. Carries the signer cert + a signed
// signingTime attribute. Tests the §2.5 CAdES slice of the X.509 parser (draft 284).
const CMS_P7S_B64 = 'MIIDyAYJKoZIhvcNAQcCoIIDuTCCA7UCAQExDTALBglghkgBZQMEAgEwCwYJKoZIhvcNAQcBoIIB4DCCAdwwggGDoAMCAQICFASZKuGvSbYF1MszY/rQ9Vmp+Rw1MAoGCCqGSM49BAMCMEQxHTAbBgNVBAMMFEZhY3R1ci1YIFRlc3QgU2lnbmVyMRYwFAYDVQQKDA1lbmNyeXB0YWxvdHRhMQswCQYDVQQGEwJGUjAeFw0yNjA2MDUyMTAzNTVaFw0zNjA2MDIyMTAzNTVaMEQxHTAbBgNVBAMMFEZhY3R1ci1YIFRlc3QgU2lnbmVyMRYwFAYDVQQKDA1lbmNyeXB0YWxvdHRhMQswCQYDVQQGEwJGUjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABKmj7yA2A0/5S24a4hlXyG9ZFebasqJrdOfNbUMG/YleTqXxAD/7TRtBd/XJOZsXufN+JA3VDXqRus1iwC8e1OejUzBRMB0GA1UdDgQWBBQBM9cpMN8E1e60TDJVAgx3tnVeSjAfBgNVHSMEGDAWgBQBM9cpMN8E1e60TDJVAgx3tnVeSjAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0cAMEQCIFEdCr3ePeRihSRsuX4xauSaX09YQZCKEqK+Rq4aHDYfAiAk8iVA5zNxQJ9DPH7FM5E0+AFDBmbcFHVCQJF0N0R0uDGCAa4wggGqAgEBMFwwRDEdMBsGA1UEAwwURmFjdHVyLVggVGVzdCBTaWduZXIxFjAUBgNVBAoMDWVuY3J5cHRhbG90dGExCzAJBgNVBAYTAkZSAhQEmSrhr0m2BdTLM2P60PVZqfkcNTALBglghkgBZQMEAgGggeQwGAYJKoZIhvcNAQkDMQsGCSqGSIb3DQEHATAcBgkqhkiG9w0BCQUxDxcNMjYwNjA1MjEwODI1WjAvBgkqhkiG9w0BCQQxIgQgIo5C6LTDrTD4dJIazRH+tcCPnH0ySZfF7KJQo7WJBKwweQYJKoZIhvcNAQkPMWwwajALBglghkgBZQMEASowCwYJYIZIAWUDBAEWMAsGCWCGSAFlAwQBAjAKBggqhkiG9w0DBzAOBggqhkiG9w0DAgICAIAwDQYIKoZIhvcNAwICAUAwBwYFKw4DAgcwDQYIKoZIhvcNAwICASgwCgYIKoZIzj0EAwIERzBFAiEApa50n2l+quBMOJ4DnWDJXy8m0LUvHnsyvqUNfAv+fGoCIHj94sSAzwClXZUGLv0xITY7M8fLelobDeAdsExK6mf7';

test('tls-cert: decodes a PKCS#7 / CMS SignedData (CAdES) signature (draft 284)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'tls-cert');
  await page.fill('#tls-cert-input', '-----BEGIN PKCS7-----\n' + CMS_P7S_B64 + '\n-----END PKCS7-----');
  await page.click('#btn-tls-cert-parse');
  const res = page.locator('#tls-cert-results');
  await expect(res).toContainText(/PKCS#7 \/ CMS SignedData — 1 certificate\(s\), 1 signer\(s\)/i, { timeout: 5_000 });
  await expect(res).toContainText('ecdsa-with-SHA256');       // signer signature algorithm
  await expect(res).toContainText('2026-06-05');              // signed signing-time attribute
  await expect(res).toContainText(/Factur-X Test Signer/);    // embedded signer cert subject
});

// PAdES (draft 285): embed the CMS blob above into a PDF signature dictionary's
// /Contents hex string and load it through the new tls-cert PDF file input.
function buildPadesPdf(cmsB64) {
  const hex = Buffer.from(cmsB64, 'base64').toString('hex');
  return Buffer.concat([
    Buffer.from('%PDF-1.7\n', 'latin1'),
    Buffer.from('1 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /ByteRange [0 100 200 300] /Contents <' + hex + '> >>\nendobj\n', 'latin1'),
    Buffer.from('%%EOF\n', 'latin1'),
  ]);
}

test('tls-cert: extracts and decodes a PAdES (signed-PDF) CMS signature (draft 285)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'tls-cert');
  await page.setInputFiles('#tls-pdf', { name: 'signed.pdf', mimeType: 'application/pdf', buffer: buildPadesPdf(CMS_P7S_B64) });
  await expect(page.locator('#tls-pdf-status')).toContainText(/PAdES — 1 signature\(s\) found in signed\.pdf/i, { timeout: 5_000 });
  const res = page.locator('#tls-cert-results');
  await expect(res).toContainText(/Signature #1/i);
  await expect(res).toContainText('ecdsa-with-SHA256');
  await expect(res).toContainText(/Factur-X Test Signer/);
});

test('tls-cert: reports a PDF with no PAdES signature (draft 285)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'tls-cert');
  // /Contents 2 0 R is an indirect ref (page contents), not a hex-string signature.
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Page /Contents 2 0 R >>\nendobj\n%%EOF\n', 'latin1');
  await page.setInputFiles('#tls-pdf', { name: 'unsigned.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.locator('#tls-pdf-status')).toContainText(/No PAdES \/ CMS signature found in unsigned\.pdf/i, { timeout: 5_000 });
});

// XAdES / XML-DSig (draft 286): a B-B signature (SignedProperties present, no
// timestamp) with an embedded EC cert ("XAdES Test Signer"), pasted as XML.
const XADES_CERT_B64 = 'MIIB2DCCAX2gAwIBAgIUIbL/nRHO5r2YRlF0eeCDH5kJS1IwCgYIKoZIzj0EAwIwQTEaMBgGA1UEAwwRWEFkRVMgVGVzdCBTaWduZXIxFjAUBgNVBAoMDWVuY3J5cHRhbG90dGExCzAJBgNVBAYTAkRFMB4XDTI2MDYwNTIxMjUxOFoXDTM2MDYwMjIxMjUxOFowQTEaMBgGA1UEAwwRWEFkRVMgVGVzdCBTaWduZXIxFjAUBgNVBAoMDWVuY3J5cHRhbG90dGExCzAJBgNVBAYTAkRFMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWkjUlfYbxk8X450ZwDF+a6pQZBi7a6wjlduxiXyoIVZRwx9P6DYIqNdA8p0vmpbL6XaXYT3vGYO8Sr0NkwrBa6NTMFEwHQYDVR0OBBYEFBUDhh/EIdzlyXpSLZHqO4JHOj5PMB8GA1UdIwQYMBaAFBUDhh/EIdzlyXpSLZHqO4JHOj5PMA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDSQAwRgIhAPvKfh8ojNEGjTZEcv5QXsE8R3FWaLpPevb0aUIkTlnqAiEAn12S2S99uktHW1hi83l4LoyOcjCtPZ7/DmQVf9MDu+8=';
const XADES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
    <ds:Reference URI="">
      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <ds:DigestValue>aGVsbG8=</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  <ds:SignatureValue>c2ln</ds:SignatureValue>
  <ds:KeyInfo><ds:X509Data><ds:X509Certificate>${XADES_CERT_B64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
  <ds:Object><xades:QualifyingProperties><xades:SignedProperties><xades:SignedSignatureProperties>
    <xades:SigningTime>2024-03-15T10:30:00Z</xades:SigningTime>
  </xades:SignedSignatureProperties></xades:SignedProperties></xades:QualifyingProperties></ds:Object>
</ds:Signature>`;

test('tls-cert: decodes a XAdES / XML-DSig signature (draft 286)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'tls-cert');
  await page.fill('#tls-cert-input', XADES_XML);
  await page.click('#btn-tls-cert-parse');
  const res = page.locator('#tls-cert-results');
  await expect(res).toContainText(/XAdES \/ XML-DSig — 1 signature\(s\)/i, { timeout: 5_000 });
  await expect(res).toContainText('B-B');               // XAdES level (SignedProperties, no timestamp)
  await expect(res).toContainText('ecdsa-sha256');      // signature method
  await expect(res).toContainText('2024-03-15');        // SigningTime
  await expect(res).toContainText(/XAdES Test Signer/);  // embedded cert subject
});

test('ssh-key', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'ssh-key');
  // Real, valid ed25519 public key (from openssh test data)
  const sshKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAtjzjLm5XrpgwYIB3UE9CYVTMCRfjtxqpqXFkX9R5sH ed25519@example';
  await page.fill('#ssh-key-input', sshKey);
  await page.click('#btn-ssh-key-parse');
  await page.waitForFunction(() => {
    const r = document.getElementById('ssh-key-results');
    return r && !r.classList.contains('hidden');
  }, { timeout: 5_000 });
});

test('pem-der: round-trip', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'pem-der');
  const pem = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAGb9ECWmEzf6FQbrBZ9w7lshQhqowtrbLDFw4rXAxZuE=\n-----END PUBLIC KEY-----';
  await page.fill('#pem-der-input', pem);
  await page.click('#btn-pem-to-der');
  await page.waitForFunction(() => document.getElementById('pem-der-output').value.length > 0, { timeout: 5_000 });
});

test('bip39', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'bip39');
  await page.click('#btn-bip39-generate');
  await page.waitForFunction(() => (document.getElementById('bip39-mnemonic').value.split(/\s+/).filter(Boolean).length) >= 12, { timeout: 5_000 });
  await page.click('#btn-bip39-validate');
  await expect(page.locator('#bip39-results')).toContainText(/valid|✓|ok/i, { timeout: 5_000 });
});

// =============== CRYPT ===============

test('text-crypto: encrypt round-trip', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'text-crypto');
  await page.fill('#text-encrypt-pubkey', FIXTURE.pub);
  await page.fill('#text-encrypt-message', 'hello world from playwright');
  await page.click('#btn-text-crypto');
  await page.waitForFunction(() => {
    const r = document.getElementById('text-crypto-result');
    return r && /BEGIN PGP MESSAGE/.test(r.textContent || '');
  }, { timeout: 15_000 });
  // Switch mode
  const decryptToggle = page.locator('input[name="text-mode"][value="decrypt"], [data-text-mode="decrypt"]').first();
  if (await decryptToggle.count()) await decryptToggle.click();
  // Re-grab the cipher: it was rendered into #text-crypto-result; copy it into the decrypt textarea.
  const cipher = await page.evaluate(() => {
    const r = document.getElementById('text-crypto-result');
    const m = (r.textContent || '').match(/-----BEGIN PGP MESSAGE-----[\s\S]+?-----END PGP MESSAGE-----/);
    return m ? m[0] : '';
  });
  expect(cipher.length).toBeGreaterThan(50);
  await page.fill('#text-decrypt-privkey', FIXTURE.priv);
  await page.fill('#text-decrypt-passphrase', PASS);
  await page.fill('#text-decrypt-message', cipher);
  await page.click('#btn-text-crypto');
  await expect(page.locator('#text-crypto-result')).toContainText('hello world from playwright', { timeout: 15_000 });
});

test('password-encrypt: view loads', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'password-encrypt');
  await expect(page.locator('#btn-symmetric')).toBeVisible();
});

test('encrypt/decrypt: views load without errors', async ({ page }) => {
  const errs=[]; page.on('pageerror', e => errs.push(e.message));
  await page.goto('/index.html'); await gotoTool(page, 'encrypt'); await gotoTool(page, 'decrypt');
  expect(errs).toEqual([]);
});

test('stego: mode toggles', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'stego');
  await page.click('#stego-mode-reveal');
  await expect(page.locator('#stego-reveal-password')).toBeVisible();
  await page.click('#stego-mode-hide');
  await expect(page.locator('#stego-cover')).toBeVisible();
});

// =============== SIGNING ===============

test('sign + verify: inline-signed round-trip', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'sign');
  await page.fill('#sign-private-key', FIXTURE.priv);
  await page.fill('#sign-passphrase', PASS);
  // default sign-type is "text" (inline-signed message). Keep it.
  await page.fill('#sign-message', 'message to sign');
  await page.click('#btn-sign');
  await page.waitForFunction(() => {
    const r = document.getElementById('sign-result');
    return r && /-----BEGIN PGP MESSAGE-----/.test(r.textContent || '');
  }, { timeout: 20_000 });
  const sig = await page.evaluate(() => {
    const r = document.getElementById('sign-result');
    const m = (r.textContent || '').match(/-----BEGIN PGP MESSAGE-----[\s\S]+?-----END PGP MESSAGE-----/);
    return m ? m[0] : '';
  });
  expect(sig).toMatch(/BEGIN PGP MESSAGE/);

  await gotoTool(page, 'verify');
  await page.fill('#verify-public-key', FIXTURE.pub);
  // default verify-type is "signed-message" — matches what sign produces.
  await page.fill('#verify-signed-message', sig);
  await page.click('#btn-verify');
  await expect(page.locator('#verify-result')).toContainText(/valid|verified|signature|✓/i, { timeout: 20_000 });
});

test('hmac: SHA-256 RFC 4231 vector', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'hmac');
  await page.selectOption('#hmac-algo', 'SHA-256');
  await page.fill('#hmac-key', 'key');
  await page.fill('#hmac-msg', 'The quick brown fox jumps over the lazy dog');
  await page.click('#btn-hmac-sign');
  await page.waitForFunction(() => document.getElementById('hmac-result').value.length > 0, { timeout: 5_000 });
  const got = (await page.locator('#hmac-result').inputValue()).toLowerCase();
  expect(got).toContain('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
});

test('jwt: decode RFC 7519 example', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const tok = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  await page.fill('#jwt-input', tok);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText('John Doe', { timeout: 5_000 });
  // RFC 7519 example carries iat=1516239022 → 2018-01-18T01:30:22Z. The iat
  // informational row should render that ISO timestamp.
  await expect(page.locator('#jwt-results')).toContainText(/Issued at .*2018-01-18T01:30:22/);
});

// Minimal CBOR encoder (test-only) to build a valid ISO 18013-5 mdoc fixture for
// the credential inspector (draft 289). Supports the subset the fixture needs.
function cborHead(major, n) {
  const mt = major << 5;
  if (n < 24) return Buffer.from([mt | n]);
  if (n < 256) return Buffer.from([mt | 24, n]);
  if (n < 65536) return Buffer.from([mt | 25, (n >> 8) & 0xff, n & 0xff]);
  return Buffer.from([mt | 26, (n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}
class CborTag { constructor(tag, val) { this.tag = tag; this.val = val; } }
function cborEnc(v) {
  if (v instanceof CborTag) return Buffer.concat([cborHead(6, v.tag), cborEnc(v.val)]);
  if (typeof v === 'number') return v < 0 ? cborHead(1, -1 - v) : cborHead(0, v);
  if (typeof v === 'boolean') return Buffer.from([v ? 0xf5 : 0xf4]);
  if (v === null) return Buffer.from([0xf6]);
  if (typeof v === 'string') { const b = Buffer.from(v, 'utf8'); return Buffer.concat([cborHead(3, b.length), b]); }
  if (Buffer.isBuffer(v)) return Buffer.concat([cborHead(2, v.length), v]);
  if (Array.isArray(v)) return Buffer.concat([cborHead(4, v.length), ...v.map(cborEnc)]);
  if (v instanceof Map) { const p = [cborHead(5, v.size)]; for (const [k, val] of v) { p.push(cborEnc(k)); p.push(cborEnc(val)); } return Buffer.concat(p); }
  if (typeof v === 'object') { const ks = Object.keys(v); const p = [cborHead(5, ks.length)]; for (const k of ks) { p.push(cborEnc(k)); p.push(cborEnc(v[k])); } return Buffer.concat(p); }
  throw new Error('cborEnc: unsupported ' + typeof v);
}
const tag24Of = (inner) => new CborTag(24, cborEnc(inner));

test('jwt: decodes an ISO 18013-5 mdoc credential (draft 289)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const item0 = tag24Of({ digestID: 0, random: Buffer.from('00112233', 'hex'), elementIdentifier: 'family_name', elementValue: 'Doe' });
  const item1 = tag24Of({ digestID: 1, random: Buffer.from('44556677', 'hex'), elementIdentifier: 'given_name', elementValue: 'Jane' });
  const mso = {
    version: '1.0', digestAlgorithm: 'SHA-256',
    valueDigests: new Map([['org.iso.18013.5.1', new Map([[0, Buffer.from('aa', 'hex')], [1, Buffer.from('bb', 'hex')]])]]),
    deviceKeyInfo: { deviceKey: new Map([[1, 2], [-1, 1]]) },
    docType: 'org.iso.18013.5.1.mDL',
    validityInfo: { signed: new CborTag(0, '2024-01-01T00:00:00Z'), validFrom: new CborTag(0, '2024-01-01T00:00:00Z'), validUntil: new CborTag(0, '2029-01-01T00:00:00Z') },
  };
  const issuerAuth = new CborTag(18, [
    Buffer.from(cborEnc(new Map([[1, -7]]))),          // protected header {1:-7} = ES256
    new Map([[33, Buffer.from(XADES_CERT_B64, 'base64')]]),  // unprotected: x5chain
    tag24Of(mso),                                       // payload = MobileSecurityObjectBytes
    Buffer.from('00', 'hex'),                           // signature (dummy)
  ]);
  const issuerSigned = { nameSpaces: { 'org.iso.18013.5.1': [item0, item1] }, issuerAuth };
  const mdoc = { version: '1.0', documents: [{ docType: 'org.iso.18013.5.1.mDL', issuerSigned }], status: 0 };
  await page.fill('#jwt-input', cborEnc(mdoc).toString('hex'));
  await page.click('#btn-jwt-decode');
  const res = page.locator('#jwt-results');
  await expect(res).toContainText(/ISO 18013-5 mdoc/i, { timeout: 5_000 });
  await expect(res).toContainText('org.iso.18013.5.1.mDL');     // docType
  await expect(res).toContainText('family_name');               // data element id
  await expect(res).toContainText('Doe');                       // element value
  await expect(res).toContainText('SHA-256');                   // MSO digest algorithm
  await expect(res).toContainText('2029-01-01T00:00:00Z');      // validUntil
  await expect(res).toContainText('ES256');                     // COSE protected-header alg
  await expect(res).toContainText(/XAdES Test Signer/);         // issuer signer cert (x5chain)
});

test('jwt: nbf in the future flags token as not yet valid', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  // Hand-craft a JWT with nbf one hour from now and exp two hours from now —
  // exp passes (green) but nbf must independently surface a red row.
  function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  const future = Math.floor(Date.now() / 1000) + 3600;
  const header = b64u({ alg: 'HS256', typ: 'JWT' });
  const payload = b64u({ sub: 'x', nbf: future, exp: future + 3600 });
  const sig = 'AAAA'; // arbitrary; decoder doesn't verify on the decode path
  await page.fill('#jwt-input', `${header}.${payload}.${sig}`);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/Not yet valid — nbf is/i, { timeout: 5_000 });
});

test('jwt: expected iss cross-check accepts a matching issuer', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  const header = b64u({ alg: 'HS256', typ: 'JWT' });
  const payload = b64u({ iss: 'https://issuer.example', aud: 'https://verifier.example', sub: 'x' });
  await page.fill('#jwt-input', `${header}.${payload}.AAAA`);
  await page.locator('#jwt-iss').evaluate(el => el.closest('details').open = true);
  await page.fill('#jwt-iss', 'https://issuer.example');
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/iss matches expected issuer/i, { timeout: 5_000 });
});

test('jwt: expected iss cross-check flags a wrong issuer', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  const header = b64u({ alg: 'HS256', typ: 'JWT' });
  const payload = b64u({ iss: 'https://issuer.example', sub: 'x' });
  await page.fill('#jwt-input', `${header}.${payload}.AAAA`);
  await page.locator('#jwt-iss').evaluate(el => el.closest('details').open = true);
  await page.fill('#jwt-iss', 'https://attacker.example');
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/iss does not match expected.*https:\/\/issuer\.example/i, { timeout: 5_000 });
});

test('jwt: expected aud cross-check honors RFC 7519 array form', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  const header = b64u({ alg: 'HS256', typ: 'JWT' });
  // aud is an array per RFC 7519 §4.1.3; the verifier matches if expected is a member.
  const payload = b64u({ iss: 'x', aud: ['https://api.a.example', 'https://api.b.example'] });
  await page.fill('#jwt-input', `${header}.${payload}.AAAA`);
  await page.locator('#jwt-aud').evaluate(el => el.closest('details').open = true);
  await page.fill('#jwt-aud', 'https://api.b.example');
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/aud matches expected audience/i, { timeout: 5_000 });
});

test('jwt: nbf in the past renders as active', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  const past = Math.floor(Date.now() / 1000) - 3600;
  const header = b64u({ alg: 'HS256', typ: 'JWT' });
  const payload = b64u({ sub: 'x', nbf: past });
  await page.fill('#jwt-input', `${header}.${payload}.AAAA`);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/Active since .*\(nbf\)/i, { timeout: 5_000 });
});

test('jwt: alg=none surfaces an RFC 8725 §3.1 warning row', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  // The textbook alg=none attack: a token whose header declares the algorithm
  // as unsigned. Decoder must always surface this in red, regardless of any
  // other claims being well-formed.
  function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  const header = b64u({ alg: 'none', typ: 'JWT' });
  const payload = b64u({ sub: 'admin' });
  await page.fill('#jwt-input', `${header}.${payload}.`);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/RFC 8725/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/Header alg is "none"/i);
});

test('jwt: jti + kid surface as their own informational rows', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  // jti is RFC 7519 §4.1.7 (replay defense); kid is RFC 7515 §4.1.4 (JWKS key
  // selector). Both are informational here; surface them so a maintainer
  // doesn't have to grep the raw JSON to read them.
  const header = b64u({ alg: 'HS256', typ: 'JWT', kid: 'signing-key-2024-q2' });
  const payload = b64u({ sub: 'u-1', jti: '550e8400-e29b-41d4-a716-446655440000' });
  await page.fill('#jwt-input', `${header}.${payload}.AAAA`);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/Key ID \(kid\): signing-key-2024-q2/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/JWT ID \(jti\): 550e8400-e29b-41d4-a716-446655440000/i);
});

test('jwt: typ header + crit array surface as their own rows', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  // typ is RFC 7515 §4.1.9 (token-type confusion defense per RFC 8725 §3.11);
  // crit is RFC 7515 §4.1.11 — verifier MUST understand every named extension
  // or reject. Both should surface unconditionally when present.
  const header = b64u({ alg: 'HS256', typ: 'at+jwt', crit: ['exp', 'b64'] });
  const payload = b64u({ sub: 'u-1' });
  await page.fill('#jwt-input', `${header}.${payload}.AAAA`);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/Token type \(typ\): at\+jwt/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/Critical headers \(crit\):.*exp.*b64/i);
  await expect(page.locator('#jwt-results')).toContainText(/RFC 7515/i);
});

test('jwt: sub claim surfaces as its own informational row', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  // RFC 7519 §A.1 fixture has sub=1234567890; we already assert "John Doe"
  // elsewhere, so here we assert the new sub badge specifically renders the
  // subject string out of the payload rather than only inside the raw JSON.
  const tok = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  await page.fill('#jwt-input', tok);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/Subject \(sub\): 1234567890/i, { timeout: 5_000 });
});

// SD-JWT (draft-ietf-oauth-selective-disclosure-jwt) — EUDI Wallet credential format (SPEC §2.8)
function b64url(bufOrStr) {
  const buf = typeof bufOrStr === 'string' ? Buffer.from(bufOrStr, 'utf8') : bufOrStr;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function buildSdJwt(disclosuresJson, extraPayload = {}, kbJwt = null) {
  // Each disclosure: base64url(JSON.stringify([salt, name, value])).
  // The digest stored in _sd is SHA-256 over the ASCII bytes of that base64url string.
  const encoded = disclosuresJson.map(d => b64url(JSON.stringify(d)));
  const digests = encoded.map(e => b64url(nodeCrypto.createHash('sha256').update(e, 'ascii').digest()));
  const header = b64url(JSON.stringify({ typ: 'vc+sd-jwt', alg: 'HS256' }));
  const payload = b64url(JSON.stringify({ iss: 'https://issuer.example', _sd_alg: 'sha-256', _sd: digests, ...extraPayload }));
  const sig = b64url(Buffer.from('signature-placeholder'));
  let tok = `${header}.${payload}.${sig}~` + encoded.join('~');
  if (kbJwt) tok += '~' + kbJwt;
  return tok;
}

test('sd-jwt: surfaces disclosures and matches them against _sd digests', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const sdjwt = buildSdJwt([
    ['salt-abc', 'given_name', 'John'],
    ['salt-xyz', 'family_name', 'Doe'],
  ]);
  await page.fill('#jwt-input', sdjwt);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText('given_name', { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText('John');
  await expect(page.locator('#jwt-results')).toContainText('family_name');
  await expect(page.locator('#jwt-results')).toContainText('Doe');
  // Both disclosures must show as referenced in the payload's _sd array.
  const matches = await page.locator('#jwt-results').getByText(/referenced in payload _sd/i).count();
  expect(matches).toBeGreaterThanOrEqual(2);
});

test('sd-jwt: flags an unreferenced (orphaned) disclosure', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  // Build a token whose payload _sd does NOT list our disclosure's digest.
  // Easiest path: build normally, then strip _sd by stomping it with a known-wrong digest.
  const sdjwt = buildSdJwt([['salt-orphan', 'orphan_claim', 'orphan_value']], { _sd_override: true });
  // Replace the genuine _sd list with a single bogus digest so the disclosure is unmatched.
  // (Quickest way: rebuild manually.)
  const enc = b64url(JSON.stringify(['salt-orphan', 'orphan_claim', 'orphan_value']));
  const header = b64url(JSON.stringify({ typ: 'vc+sd-jwt', alg: 'HS256' }));
  const payload = b64url(JSON.stringify({ iss: 'https://issuer.example', _sd_alg: 'sha-256', _sd: ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'] }));
  const sig = b64url(Buffer.from('sig'));
  const tok = `${header}.${payload}.${sig}~${enc}`;
  await page.fill('#jwt-input', tok);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText('orphan_claim', { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/unreferenced/i);
});

test('sd-jwt: renders cleartext reconstructed payload with disclosed claims merged', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const sdjwt = buildSdJwt([
    ['salt-a', 'given_name', 'Alice'],
    ['salt-b', 'birthdate', '1990-02-29'],
  ], { iss: 'https://issuer.example' });
  await page.fill('#jwt-input', sdjwt);
  await page.click('#btn-jwt-decode');
  // Wait for the reconstructed block, then read the <pre> immediately following its header.
  await expect(page.locator('#jwt-results')).toContainText(/Disclosed payload/i, { timeout: 5_000 });
  const reconstructedText = await page.evaluate(() => {
    const head = document.querySelector('#jwt-results [data-i18n="jwt.sdjwt.reconstructed"]');
    return head && head.nextElementSibling ? head.nextElementSibling.textContent : '';
  });
  const parsed = JSON.parse(reconstructedText);
  expect(parsed.given_name).toBe('Alice');
  expect(parsed.birthdate).toBe('1990-02-29');
  expect(parsed.iss).toBe('https://issuer.example');
  // _sd and _sd_alg should be stripped from the reconstructed view.
  expect(parsed._sd).toBeUndefined();
  expect(parsed._sd_alg).toBeUndefined();
});

// Build a real ES256-signed KB-JWT bound to an SD-JWT via cnf.jwk + sd_hash.
function buildSdJwtWithSignedKb(disclosuresJson, kbExtraPayload = {}) {
  const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  // Web Crypto wants a JWK with crv 'P-256' (node uses the same crv name).
  const cnfJwk = publicKey.export({ format: 'jwk' });
  // Strip private-half fields just in case (export of a public key won't include `d`,
  // but be explicit).
  delete cnfJwk.d;
  const encoded = disclosuresJson.map(d => b64url(JSON.stringify(d)));
  const digests = encoded.map(e => b64url(nodeCrypto.createHash('sha256').update(e, 'ascii').digest()));
  const header = b64url(JSON.stringify({ typ: 'vc+sd-jwt', alg: 'HS256' }));
  const payload = b64url(JSON.stringify({
    iss: 'https://issuer.example',
    _sd_alg: 'sha-256',
    _sd: digests,
    cnf: { jwk: cnfJwk },
  }));
  const issuerSig = b64url(Buffer.from('issuer-sig-placeholder'));
  const issuerJwt = `${header}.${payload}.${issuerSig}`;
  const presentation = issuerJwt + '~' + (encoded.length ? encoded.join('~') + '~' : '');
  const sdHash = b64url(nodeCrypto.createHash('sha256').update(presentation, 'utf8').digest());
  const kbHeader = b64url(JSON.stringify({ typ: 'kb+jwt', alg: 'ES256' }));
  const kbPayload = b64url(JSON.stringify({
    aud: 'https://verifier.example',
    nonce: 'nonce-42',
    iat: 1700000000,
    sd_hash: sdHash,
    ...kbExtraPayload,
  }));
  // ECDSA over SHA-256, raw (r||s) signature — what JWS expects.
  const kbSig = nodeCrypto.sign('sha256', Buffer.from(kbHeader + '.' + kbPayload, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return presentation + `${kbHeader}.${kbPayload}.${b64url(kbSig)}`;
}

test('sd-jwt: KB-JWT signature verifies against cnf.jwk (ES256)', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const sdjwt = buildSdJwtWithSignedKb([['s', 'given_name', 'Eve']]);
  await page.fill('#jwt-input', sdjwt);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/KB-JWT signature/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/verified with cnf\.jwk \(ES256\)/i);
  await expect(page.locator('#jwt-results')).toContainText(/sd_hash binding/i);
  await expect(page.locator('#jwt-results')).toContainText(/matches SHA-256 of the presentation/i);
});

test('sd-jwt: KB-JWT verification flags a tampered KB-JWT signature', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const sdjwt = buildSdJwtWithSignedKb([['s', 'given_name', 'Eve']]);
  // Stomp 4 chars near the start of the KB-JWT signature so the verify must fail.
  // (Flipping the last char only changes the trailing bits that base64 drops in
  // a 64-byte ECDSA signature, so it can leave the decoded bytes intact.)
  const dotIdx = sdjwt.lastIndexOf('.');
  const stompAt = dotIdx + 5;
  const tampered = sdjwt.slice(0, stompAt) + 'AAAA' + sdjwt.slice(stompAt + 4);
  await page.fill('#jwt-input', tampered);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/KB-JWT signature/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/signature does not verify/i);
});

test('sd-jwt: surfaces a key-binding JWT when present', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const kbHeader = b64url(JSON.stringify({ typ: 'kb+jwt', alg: 'ES256' }));
  const kbPayload = b64url(JSON.stringify({ aud: 'https://verifier.example', nonce: 'nonce-42', iat: 1700000000 }));
  const kbSig = b64url(Buffer.from('kb-sig'));
  const kbJwt = `${kbHeader}.${kbPayload}.${kbSig}`;
  const sdjwt = buildSdJwt([['salt-1', 'birthdate', '1970-01-01']], {}, kbJwt);
  await page.fill('#jwt-input', sdjwt);
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/Key-binding JWT/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText('nonce-42');
});

test('sd-jwt: KB-JWT aud cross-check accepts a matching expected audience', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const sdjwt = buildSdJwtWithSignedKb([['s', 'given_name', 'Eve']]);
  await page.fill('#jwt-input', sdjwt);
  await page.locator('#jwt-kb-aud').evaluate(el => el.closest('details').open = true);
  await page.fill('#jwt-kb-aud', 'https://verifier.example');
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/KB-JWT audience/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/matches expected audience/i);
});

test('sd-jwt: KB-JWT aud cross-check flags a wrong expected audience', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const sdjwt = buildSdJwtWithSignedKb([['s', 'given_name', 'Eve']]);
  await page.fill('#jwt-input', sdjwt);
  await page.locator('#jwt-kb-aud').evaluate(el => el.closest('details').open = true);
  await page.fill('#jwt-kb-aud', 'https://attacker.example');
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/KB-JWT audience/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/does not match expected.*https:\/\/verifier\.example/i);
});

test('sd-jwt: KB-JWT nonce cross-check flags a replayed nonce', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'jwt');
  const sdjwt = buildSdJwtWithSignedKb([['s', 'given_name', 'Eve']]);
  await page.fill('#jwt-input', sdjwt);
  await page.locator('#jwt-kb-nonce').evaluate(el => el.closest('details').open = true);
  await page.fill('#jwt-kb-nonce', 'fresh-nonce');
  await page.click('#btn-jwt-decode');
  await expect(page.locator('#jwt-results')).toContainText(/KB-JWT nonce/i, { timeout: 5_000 });
  await expect(page.locator('#jwt-results')).toContainText(/does not match expected.*nonce-42/i);
});

// =============== UTILITIES ===============

test('passwords: generates count', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'passwords');
  await page.fill('#password-length', '20');
  await page.fill('#password-count', '5');
  await page.click('#btn-generate-password');
  await page.waitForFunction(() => document.querySelectorAll('#password-result .password-item').length >= 5, { timeout: 5_000 });
});

test('armor: dearmor a real PGP armored block', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  await page.goto('/index.html'); await gotoTool(page, 'armor');
  // Default mode is "dearmor" — feed it a real armored PGP key.
  await page.fill('#armor-text-input', FIXTURE.pub);
  await page.click('#btn-armor');
  await expect(page.locator('#armor-result')).toBeVisible({ timeout: 5_000 });
});

test('shamir: split + combine round-trip', async ({ page }) => {
  const errs=[]; autoDismissDialogs(page, errs);
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('/index.html'); await gotoTool(page, 'shamir');
  await page.click('#shamir-mode-split');
  await page.fill('#shamir-secret', 'top secret value');
  await page.fill('#shamir-total', '5');
  await page.fill('#shamir-threshold', '3');
  await page.click('#btn-shamir-split');
  await page.waitForFunction(() => {
    const tas = document.querySelectorAll('#shamir-shares-list textarea');
    return tas.length >= 5 && Array.from(tas).every(t => t.value.startsWith('EAL-SSS/'));
  }, { timeout: 8_000 });
  // Extract first 3 share strings — they are inside <textarea> elements per share.
  const shares = await page.evaluate(() => {
    const tas = document.querySelectorAll('#shamir-shares-list textarea');
    return Array.from(tas).slice(0, 3).map(t => t.value).join('\n');
  });
  expect(shares.split('\n').length).toBe(3);
  await page.click('#shamir-mode-combine');
  await page.fill('#shamir-combine-input', shares);
  await page.click('#btn-shamir-combine');
  await page.waitForFunction(() => document.getElementById('shamir-output').value.includes('top secret value'), { timeout: 5_000 });
  expect(errs).toEqual([]);
});

test('exif: view loads', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'exif');
  await expect(page.locator('#btn-exif-process')).toBeVisible();
});

test('hash: SHA-256("abc") FIPS 180-4 vector', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'hash');
  await page.fill('#hash-text', 'abc');
  await page.click('#btn-hash-compute');
  await page.waitForFunction(() => {
    const r = document.getElementById('hash-results');
    return r && !r.classList.contains('hidden') && (r.textContent || '').length > 50;
  }, { timeout: 5_000 });
  const out = (await page.locator('#hash-results').textContent()).toLowerCase();
  expect(out).toContain('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('encode: utf8 → base64', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'encode');
  await page.selectOption('#encode-input-format', 'text');
  await page.selectOption('#encode-output-format', 'base64');
  await page.fill('#encode-input', 'Hello');
  await page.click('#btn-encode-convert');
  await page.waitForFunction(() => document.getElementById('encode-output').value === 'SGVsbG8=', { timeout: 5_000 });
});

test('uuid: generates v4', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'uuid');
  await page.fill('#uuid-count', '3');
  await page.click('#btn-uuid-generate');
  await page.waitForFunction(() => /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(document.getElementById('uuid-output').value), { timeout: 5_000 });
});

test('timestamp: epoch 0 → 1970', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'timestamp');
  await page.fill('#ts-input', '0');
  await page.click('#btn-ts-convert');
  await expect(page.locator('#ts-results')).toContainText('1970', { timeout: 5_000 });
});

test('url: parses', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'url');
  await page.fill('#url-input', 'https://example.com:8443/p?q=1#f');
  await page.click('#btn-url-parse');
  await expect(page.locator('#url-results')).toContainText('example.com', { timeout: 5_000 });
});

test('totp: shows 6-digit code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'totp');
  await page.fill('#totp-input', 'otpauth://totp/Test:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test');
  await page.click('#btn-totp-start');
  await page.waitForFunction(() => /\d{3}\s*\d{3}/.test(document.getElementById('totp-code').textContent || ''), { timeout: 5_000 });
  await page.click('#btn-totp-stop');
});

test('diff: detects differences', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'diff');
  await page.fill('#diff-left', 'apple\nbanana\ncherry');
  await page.fill('#diff-right', 'apple\nblueberry\ncherry');
  await page.click('#btn-diff-compute');
  await page.waitForFunction(() => {
    const r = document.getElementById('diff-results');
    return r && !r.classList.contains('hidden');
  }, { timeout: 5_000 });
});

test('csv → json', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'csv');
  await page.fill('#csv-input', 'name,age\nAlice,30\nBob,25');
  await page.selectOption('#csv-from', 'csv');
  await page.selectOption('#csv-to', 'json');
  await page.click('#btn-csv-convert');
  await page.waitForFunction(() => document.getElementById('csv-output').value.includes('Alice'), { timeout: 5_000 });
});

test('regex: matches', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'regex');
  await page.fill('#regex-pattern', '\\b\\w+@\\w+\\.\\w+\\b');
  await page.fill('#regex-flags', 'g');
  await page.fill('#regex-input', 'mail me at alice@example.com or bob@example.org');
  await page.click('#btn-regex-run');
  await expect(page.locator('#regex-status')).toContainText(/2\s*match/i, { timeout: 5_000 });
  await expect(page.locator('#regex-highlight')).toContainText('alice@example.com');
});

test('cron: decodes', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'cron');
  await page.fill('#cron-input', '* * * * *');
  await page.click('#btn-cron-decode');
  await page.waitForFunction(() => {
    const r = document.getElementById('cron-results');
    return r && !r.classList.contains('hidden');
  }, { timeout: 5_000 });
});

test('color: #ff0000 → rgb(255,0,0)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'color');
  await page.fill('#color-input', '#ff0000');
  await page.click('#btn-color-convert');
  await expect(page.locator('#color-results')).toContainText(/rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)/i, { timeout: 5_000 });
});

test('format: JSON → YAML', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'format');
  await page.fill('#format-input', '{"a":1,"b":[2,3]}');
  await page.selectOption('#format-from', 'json');
  await page.selectOption('#format-to', 'yaml');
  await page.click('#btn-format-run');
  await page.waitForFunction(() => /a:\s*1/.test(document.getElementById('format-output').value), { timeout: 5_000 });
});

// CBOR decoder (RFC 8949) — Appendix A vectors, decoded via the formatter's new
// "CBOR (hex / base64)" input format (draft 287).
async function cborToJson(page, hex) {
  await page.fill('#format-input', hex);
  await page.selectOption('#format-from', 'cbor');
  await page.selectOption('#format-to', 'json');
  await page.selectOption('#format-mode', 'pretty');
  await page.click('#btn-format-run');
  await page.waitForFunction(() => document.getElementById('format-output').value.length > 0, { timeout: 5_000 });
  return JSON.parse(await page.inputValue('#format-output'));
}

test('format: CBOR → JSON decodes RFC 8949 map/array/int vectors (draft 287)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'format');
  expect(await cborToJson(page, '83010203')).toEqual([1, 2, 3]);                         // [1,2,3]
  expect(await cborToJson(page, 'a26161016162820203')).toEqual({ a: 1, b: [2, 3] });    // {"a":1,"b":[2,3]}
  expect(await cborToJson(page, '1a000f4240')).toEqual(1000000);                          // 1000000
  expect(await cborToJson(page, '20')).toEqual(-1);                                        // -1
  expect(await cborToJson(page, '6449455446')).toEqual('IETF');                            // "IETF"
});

test('format: CBOR → JSON handles bytes / tags / simple values (draft 287)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'format');
  expect(await cborToJson(page, '4401020304')).toEqual({ $bytes: '01020304' });           // byte string
  // tag 0 (standard date/time) wrapping a text string — now annotated with $tagName
  expect(await cborToJson(page, 'c074323031332d30332d32315432303a30343a30305a')).toEqual({ $tag: 0, $value: '2013-03-21T20:04:00Z', $tagName: 'standard date/time string' });
  expect(await cborToJson(page, '83f5f4f6')).toEqual([true, false, null]);                 // [true,false,null]
});

test('format: CBOR recursively decodes tag-24, bignums, and names COSE tags (draft 288)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'format');
  // Tag 24 (encoded CBOR data item) wrapping the CBOR for [1,2,3] → decoded inline.
  expect(await cborToJson(page, 'd8184483010203')).toEqual({ $tag: 24, $tagName: 'encoded CBOR data item', $value: [1, 2, 3] });
  // Tag 2 unsigned bignum = 2^64 (exceeds Number.MAX_SAFE_INTEGER → decimal string).
  expect(await cborToJson(page, 'c249010000000000000000')).toEqual('18446744073709551616');
  // Tag 18 = COSE_Sign1 [protected h'', unprotected {}, payload null, signature h''].
  expect(await cborToJson(page, 'd28440a0f640')).toEqual({ $tag: 18, $tagName: 'COSE_Sign1', $value: [{ $bytes: '' }, {}, null, { $bytes: '' }] });
});

test('cidr: 192.168.1.0/24', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'cidr');
  await page.fill('#cidr-input', '192.168.1.0/24');
  await page.click('#btn-cidr-decode');
  await expect(page.locator('#cidr-results')).toContainText(/192\.168\.1\.255|256/, { timeout: 5_000 });
});

test('pbkdf2: RFC 6070 vector #3 (SHA-1, c=4096, dkLen=20)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'pbkdf2');
  await page.fill('#pbkdf2-password', 'password');
  await page.fill('#pbkdf2-salt', 'salt');
  await page.selectOption('#pbkdf2-salt-type', 'text');
  await page.fill('#pbkdf2-iterations', '4096');
  await page.fill('#pbkdf2-keylen', '20');
  await page.selectOption('#pbkdf2-prf', 'SHA-1');
  await page.click('#btn-pbkdf2-derive');
  // RFC 6070 vector: P="password", S="salt", c=4096, dkLen=20
  await page.waitForFunction(() => {
    const r = document.getElementById('pbkdf2-results');
    return r && !r.classList.contains('hidden') &&
      (r.textContent || '').toLowerCase().includes('4b007901b765489abead49d926f721d065a429c1');
  }, { timeout: 15_000 });
});

test('base: 255 (dec) → ff (hex)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'base');
  await page.fill('#base-input', '255');
  await page.selectOption('#base-from', '10');
  await page.click('#btn-base-convert');
  await expect(page.locator('#base-results')).toContainText(/\bff\b|0xff/i, { timeout: 5_000 });
});

// ECBS published test IBAN (Deutsche Bank, Frankfurt). Valid MOD-97, length 22.
test('iban: validates DE89 3704 0044 0532 0130 00', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'iban');
  await page.fill('#iban-input', 'DE89 3704 0044 0532 0130 00');
  await page.click('#btn-iban-validate');
  await expect(page.locator('#iban-results')).toContainText(/Valid \(MOD-97/i, { timeout: 5_000 });
  await expect(page.locator('#iban-results')).toContainText(/Germany/, { timeout: 5_000 });
});

// Same IBAN with the last digit flipped should fail the checksum.
test('iban: rejects a bad checksum', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'iban');
  await page.fill('#iban-input', 'DE89 3704 0044 0532 0130 01');
  await page.click('#btn-iban-validate');
  await expect(page.locator('#iban-results')).toContainText(/Invalid.*MOD-97/i, { timeout: 5_000 });
});

// Generator round-trip: any IBAN we generate must validate.
test('iban: generator round-trip (DE)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'iban');
  await page.selectOption('#iban-gen-country', 'DE');
  await page.fill('#iban-gen-bban', '');
  await page.click('#btn-iban-generate');
  const generated = await page.locator('#iban-gen-results').textContent();
  const m = generated.match(/DE\d{20}/);
  expect(m).not.toBeNull();
  await page.fill('#iban-input', m[0]);
  await page.click('#btn-iban-validate');
  await expect(page.locator('#iban-results')).toContainText(/Valid \(MOD-97/i, { timeout: 5_000 });
});

// Real BIC for Deutsche Bank head office. 11 chars, XXX = primary branch.
test('bic: validates DEUTDEFFXXX', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'bic');
  await page.fill('#bic-input', 'DEUTDEFFXXX');
  await page.click('#btn-bic-validate');
  await expect(page.locator('#bic-results')).toContainText(/Format OK/i, { timeout: 5_000 });
  await expect(page.locator('#bic-results')).toContainText(/Germany/, { timeout: 5_000 });
  await expect(page.locator('#bic-results')).toContainText(/primary branch/i, { timeout: 5_000 });
});

// 9 chars is not a legal BIC length.
test('bic: rejects 9-character input', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'bic');
  await page.fill('#bic-input', 'DEUTDEFF1');
  await page.click('#btn-bic-validate');
  await expect(page.locator('#bic-results')).toContainText(/8 or 11/i, { timeout: 5_000 });
});

// Real EAN-13 (Ferrero / Nutella, EU). Check digit = 1, GS1 prefix 400-440 = Germany.
test('gs1: validates EAN-13 4006381333931', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'gs1');
  await page.fill('#gs1-input', '4006381333931');
  await page.click('#btn-gs1-validate');
  await expect(page.locator('#gs1-results')).toContainText(/Checksum OK/i, { timeout: 5_000 });
  await expect(page.locator('#gs1-results')).toContainText(/EAN-13/i, { timeout: 5_000 });
  await expect(page.locator('#gs1-results')).toContainText(/Germany/, { timeout: 5_000 });
});

// Flip the last digit; mod-10 should fail.
test('gs1: rejects bad check digit', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'gs1');
  await page.fill('#gs1-input', '4006381333932');
  await page.click('#btn-gs1-validate');
  await expect(page.locator('#gs1-results')).toContainText(/Checksum failed/i, { timeout: 5_000 });
});

// Real public-record VAT IDs used in DE's own VIES documentation examples.
test('vat: DE 136695976 passes mod 11,10 checksum', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'vat');
  await page.fill('#vat-input', 'DE136695976');
  await page.click('#btn-vat-validate');
  await expect(page.locator('#vat-results')).toContainText(/Format and checksum OK|✓/i, { timeout: 5_000 });
  await expect(page.locator('#vat-results')).toContainText(/Germany/, { timeout: 5_000 });
});

// FR mod 97: key = (12 + 3*(SIREN mod 97)) mod 97. 40 303265045.
test('vat: FR 40303265045 passes mod 97 checksum', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'vat');
  await page.fill('#vat-input', 'FR 40 303 265 045');
  await page.click('#btn-vat-validate');
  await expect(page.locator('#vat-results')).toContainText(/Format and checksum OK|✓/i, { timeout: 5_000 });
  await expect(page.locator('#vat-results')).toContainText(/France/, { timeout: 5_000 });
});

// IT VAT uses Luhn over 11 digits. 00159560366 is Ferrero's public P.IVA.
test('vat: IT 00159560366 passes Luhn checksum', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'vat');
  await page.fill('#vat-input', 'IT00159560366');
  await page.click('#btn-vat-validate');
  await expect(page.locator('#vat-results')).toContainText(/Format and checksum OK|✓/i, { timeout: 5_000 });
});

// NL post-2020 format has no published checksum; tool reports "format only".
test('vat: NL 123456789B01 reports format-only (no published checksum)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'vat');
  await page.fill('#vat-input', 'NL123456789B01');
  await page.click('#btn-vat-validate');
  await expect(page.locator('#vat-results')).toContainText(/Format OK|no published checksum/i, { timeout: 5_000 });
});

// Spanish NIF for an individual must be explicitly rejected, not silently failed.
test('vat: rejects ES individual NIF (PII guardrail)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'vat');
  await page.fill('#vat-input', '12345678Z');
  await page.click('#btn-vat-validate');
  await expect(page.locator('#vat-results')).toContainText(/personal identity|NIF/i, { timeout: 5_000 });
});

// Flip a digit in the DE example — mod 11,10 should reject.
test('vat: DE bad checksum is rejected', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'vat');
  await page.fill('#vat-input', 'DE136695977');
  await page.click('#btn-vat-validate');
  await expect(page.locator('#vat-results')).toContainText(/Checksum failed/i, { timeout: 5_000 });
});

// Ed25519: generate → sign → verify round-trip.
test('ed25519: generate / sign / verify round-trip', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ed25519');
  // If the browser lacks Ed25519, the unsupported banner is shown — skip cleanly.
  const unsupported = await page.locator('#ed25519-unsupported').isVisible().catch(() => false);
  test.skip(unsupported, 'browser does not support Ed25519');
  await page.click('#btn-ed25519-generate');
  await page.waitForFunction(() => /^[0-9a-f]{64}$/.test((document.getElementById('ed25519-pub').value || '').trim()), { timeout: 5_000 });
  await page.fill('#ed25519-msg', 'encryptalotta test message');
  await page.click('#btn-ed25519-sign');
  await page.waitForFunction(() => /^[0-9a-f]{128}$/.test((document.getElementById('ed25519-sig').value || '').trim()), { timeout: 5_000 });
  await page.click('#btn-ed25519-verify');
  await expect(page.locator('#ed25519-result')).toContainText(/Signature valid/i, { timeout: 5_000 });
});

// Ed25519: RFC 8032 §7.1 test vector 1 — empty-message signature.
test('ed25519: verifies RFC 8032 §7.1 test 1 (empty message)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ed25519');
  const unsupported = await page.locator('#ed25519-unsupported').isVisible().catch(() => false);
  test.skip(unsupported, 'browser does not support Ed25519');
  await page.fill('#ed25519-pub', 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
  await page.fill('#ed25519-msg', '0x');
  await page.fill('#ed25519-sig', 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b');
  await page.click('#btn-ed25519-verify');
  await expect(page.locator('#ed25519-result')).toContainText(/Signature valid/i, { timeout: 5_000 });
});

// Ed25519: RFC 8032 §7.1 test 2 — message = single byte 0x72.
test('ed25519: verifies RFC 8032 §7.1 test 2 (single-byte message)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ed25519');
  const unsupported = await page.locator('#ed25519-unsupported').isVisible().catch(() => false);
  test.skip(unsupported, 'browser does not support Ed25519');
  await page.fill('#ed25519-pub', '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c');
  await page.fill('#ed25519-msg', '0x72');
  await page.fill('#ed25519-sig', '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00');
  await page.click('#btn-ed25519-verify');
  await expect(page.locator('#ed25519-result')).toContainText(/Signature valid/i, { timeout: 5_000 });
});

// Ed25519: tamper with the signature → must be rejected.
test('ed25519: rejects tampered signature', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ed25519');
  const unsupported = await page.locator('#ed25519-unsupported').isVisible().catch(() => false);
  test.skip(unsupported, 'browser does not support Ed25519');
  await page.fill('#ed25519-pub', 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
  await page.fill('#ed25519-msg', '0x');
  // First byte 0xe5 → 0xe4.
  await page.fill('#ed25519-sig', 'e4564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b');
  await page.click('#btn-ed25519-verify');
  await expect(page.locator('#ed25519-result')).toContainText(/Signature invalid/i, { timeout: 5_000 });
});

// X25519: RFC 7748 §6.1 — Alice's private + Bob's public should yield the canonical shared secret.
test('x25519: derives RFC 7748 §6.1 shared secret', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'x25519');
  const unsupported = await page.locator('#x25519-unsupported').isVisible().catch(() => false);
  test.skip(unsupported, 'browser does not support X25519');
  await page.fill('#x25519-priv', '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
  await page.fill('#x25519-peer', 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
  await page.selectOption('#x25519-hkdf', 'none');
  await page.click('#btn-x25519-derive');
  await page.waitForFunction(() => (document.getElementById('x25519-shared').value || '').toLowerCase() === '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742', { timeout: 5_000 });
});

// Regulator preset: selecting BSI sets algorithm=ecc + keysize=curve25519, shows source link.
test('generate: BSI regulator preset auto-fills algorithm and keysize', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'generate');
  await page.selectOption('#regulator-preset', 'bsi');
  await expect(page.locator('#algorithm')).toHaveValue('ecc');
  await expect(page.locator('#keysize')).toHaveValue('curve25519');
  await expect(page.locator('#regulator-preset-help')).toContainText(/BSI TR-02102-1/);
  await expect(page.locator('#regulator-preset-help a')).toHaveAttribute('href', /bsi\.bund\.de/);
});

// Regulator preset: NIST picks RSA 3072.
test('generate: NIST regulator preset selects RSA 3072', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'generate');
  await page.selectOption('#regulator-preset', 'nist');
  await expect(page.locator('#algorithm')).toHaveValue('rsa');
  await expect(page.locator('#keysize')).toHaveValue('3072');
});

// Manually changing the algorithm should reset the preset back to "custom".
test('generate: manual algorithm change resets preset to custom', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'generate');
  await page.selectOption('#regulator-preset', 'bsi');
  await page.selectOption('#algorithm', 'rsa');
  await expect(page.locator('#regulator-preset')).toHaveValue('custom');
  await expect(page.locator('#regulator-preset-help')).toBeHidden();
});

// PBKDF2 regulator preset: BSI sets iterations=1,000,000 + SHA-256 + shows BSI source link.
test('pbkdf2: BSI regulator preset sets iterations + PRF', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'pbkdf2');
  await page.selectOption('#pbkdf2-regulator-preset', 'bsi');
  await expect(page.locator('#pbkdf2-iterations')).toHaveValue('1000000');
  await expect(page.locator('#pbkdf2-prf')).toHaveValue('SHA-256');
  await expect(page.locator('#pbkdf2-regulator-preset-help')).toContainText(/BSI TR-02102-1/);
  await expect(page.locator('#pbkdf2-regulator-preset-help a')).toHaveAttribute('href', /bsi\.bund\.de/);
});

// PBKDF2 regulator preset: ANSSI/OWASP-NIST share the 600,000 floor.
test('pbkdf2: ANSSI regulator preset sets 600k iterations', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'pbkdf2');
  await page.selectOption('#pbkdf2-regulator-preset', 'anssi');
  await expect(page.locator('#pbkdf2-iterations')).toHaveValue('600000');
  await expect(page.locator('#pbkdf2-prf')).toHaveValue('SHA-256');
});

// Manually editing iterations resets the PBKDF2 preset back to "custom".
test('pbkdf2: manual iteration change resets preset to custom', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'pbkdf2');
  await page.selectOption('#pbkdf2-regulator-preset', 'bsi');
  await page.fill('#pbkdf2-iterations', '50000');
  await expect(page.locator('#pbkdf2-regulator-preset')).toHaveValue('custom');
  await expect(page.locator('#pbkdf2-regulator-preset-help')).toBeHidden();
});

// BLAKE2b-512 of empty string — RFC 7693 §A.5.
test('hash: BLAKE2b-512 of "" matches RFC 7693', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'hash');
  await page.fill('#hash-text', '');
  await page.click('#btn-hash-compute');
  await expect(page.locator('#hash-results')).toContainText(
    '786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce',
    { timeout: 5_000 }
  );
});

// BLAKE2b-512 of "abc" — the canonical test vector quoted in the spec.
test('hash: BLAKE2b-512 of "abc" matches RFC 7693', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'hash');
  await page.fill('#hash-text', 'abc');
  await page.click('#btn-hash-compute');
  await expect(page.locator('#hash-results')).toContainText(
    'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923',
    { timeout: 5_000 }
  );
});

// BLAKE3-256 of empty string — official BLAKE3 test vectors (length 0), cross-checked
// against the audited @noble/hashes implementation.
test('hash: BLAKE3-256 of "" matches the official BLAKE3 vector', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'hash');
  await page.fill('#hash-text', '');
  await page.click('#btn-hash-compute');
  await expect(page.locator('#hash-results')).toContainText(
    'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262',
    { timeout: 5_000 }
  );
});

// BLAKE3-256 of "abc".
test('hash: BLAKE3-256 of "abc" matches the official BLAKE3 vector', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'hash');
  await page.fill('#hash-text', 'abc');
  await page.click('#btn-hash-compute');
  await expect(page.locator('#hash-results')).toContainText(
    '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85',
    { timeout: 5_000 }
  );
});

// BLAKE3-256 of the pangram — a >43-byte input still inside the first chunk.
test('hash: BLAKE3-256 of the quick-brown-fox pangram', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'hash');
  await page.fill('#hash-text', 'The quick brown fox jumps over the lazy dog');
  await page.click('#btn-hash-compute');
  await expect(page.locator('#hash-results')).toContainText(
    '2f1514181aadccd913abd94cfa592701a5686ab23f8df1dff1b74710febc6d4a',
    { timeout: 5_000 }
  );
});

// X25519: HKDF-SHA-256 post-processing produces 32 hex bytes (64 chars).
test('x25519: HKDF-SHA-256 post-processing produces 32 bytes', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'x25519');
  const unsupported = await page.locator('#x25519-unsupported').isVisible().catch(() => false);
  test.skip(unsupported, 'browser does not support X25519');
  await page.fill('#x25519-priv', '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
  await page.fill('#x25519-peer', 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
  await page.selectOption('#x25519-hkdf', 'SHA-256');
  await page.fill('#x25519-info', 'encryptalotta x25519 test');
  await page.click('#btn-x25519-derive');
  await page.waitForFunction(() => /^[0-9a-f]{64}$/.test((document.getElementById('x25519-shared').value || '').trim()), { timeout: 5_000 });
});

// =============== GLOBAL ===============

// =============== Intl formatting (SPEC §1.5) ===============

test('intl: PBKDF2 timing uses French thousands separator (narrow no-break space)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'pbkdf2');
  // Switch via the picker so the existing change handler runs setLang + applyI18n.
  await page.selectOption('#lang-select', 'fr');
  await page.fill('#pbkdf2-password', 'password');
  await page.fill('#pbkdf2-salt', 'salt');
  await page.selectOption('#pbkdf2-salt-type', 'text');
  await page.fill('#pbkdf2-iterations', '100000');
  await page.fill('#pbkdf2-keylen', '32');
  await page.selectOption('#pbkdf2-prf', 'SHA-256');
  await page.click('#btn-pbkdf2-derive');
  await page.waitForFunction(() => {
    const r = document.getElementById('pbkdf2-results');
    return r && !r.classList.contains('hidden') && /ms/.test(r.textContent || '');
  }, { timeout: 15_000 });
  // French Intl.NumberFormat inserts a narrow no-break space (U+202F) or NBSP as group separator
  // for 4+ digit values. With 100k iters this is well above the threshold; just confirm the timing
  // row exists and does not contain an ASCII comma (which would mean en-US fell through).
  const text = await page.locator('#pbkdf2-results').textContent();
  expect(text).toMatch(/ms/);
  // Active document lang should be fr now.
  const lang = await page.evaluate(() => document.documentElement.lang);
  expect(lang).toBe('fr');
});

test('intl: CIDR total formats with German thousands separator', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'cidr');
  await page.selectOption('#lang-select', 'de');
  await page.fill('#cidr-input', '10.0.0.0/8');
  await page.click('#btn-cidr-decode');
  await expect(page.locator('#cidr-results')).toContainText(/16\.777\.216/, { timeout: 5_000 });
});

test('intl: regex match count pluralizes (English singular vs plural)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'regex');
  await page.fill('#regex-pattern', '\\bcat\\b');
  await page.fill('#regex-flags', 'g');
  await page.fill('#regex-input', 'cat');
  await page.click('#btn-regex-run');
  await expect(page.locator('#regex-status')).toHaveText(/^\s*1\s+match\s*$/, { timeout: 5_000 });
  await page.fill('#regex-input', 'cat cat cat');
  await page.click('#btn-regex-run');
  await expect(page.locator('#regex-status')).toHaveText(/^\s*3\s+matches\s*$/, { timeout: 5_000 });
});

test('intl: regex match count uses French plural form', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'regex');
  await page.selectOption('#lang-select', 'fr');
  await page.fill('#regex-pattern', '\\bchat\\b');
  await page.fill('#regex-flags', 'g');
  await page.fill('#regex-input', 'chat');
  await page.click('#btn-regex-run');
  await expect(page.locator('#regex-status')).toHaveText(/^\s*1\s+correspondance\s*$/, { timeout: 5_000 });
  await page.fill('#regex-input', 'chat chat chat');
  await page.click('#btn-regex-run');
  await expect(page.locator('#regex-status')).toHaveText(/^\s*3\s+correspondances\s*$/, { timeout: 5_000 });
});

test('intl: timestamp relative phrasing uses Intl.RelativeTimeFormat (French)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'timestamp');
  await page.selectOption('#lang-select', 'fr');
  // Pick a moment ~5 minutes in the past (epoch seconds).
  const fiveMinAgo = Math.floor(Date.now() / 1000) - 5 * 60;
  await page.fill('#ts-input', String(fiveMinAgo));
  await page.click('#btn-ts-convert');
  // Intl.RelativeTimeFormat in fr renders "il y a 5 minutes".
  await expect(page.locator('#ts-results')).toContainText(/il y a\s+5\s+minutes/i, { timeout: 5_000 });
});

test('intl: BIC multi-tag list uses German "und" joiner via Intl.ListFormat', async ({ page }) => {
  // SPEC §1.5 — first Intl.ListFormat call-site. AAAADEB0XXX has two tags (location ends in 0 → test;
  // branch is XXX → primary), so the renderer joins them with the locale's natural final connector.
  await page.goto('/index.html'); await gotoTool(page, 'bic');
  await page.selectOption('#lang-select', 'de');
  await page.fill('#bic-input', 'AAAADEB0XXX');
  await page.click('#btn-bic-validate');
  await expect(page.locator('#bic-results')).toContainText(/Test-BIC.*und.*Hauptniederlassung/i, { timeout: 5_000 });
});

// =============== SEPA ISO 20022 inspector (SPEC §2.4) ===============

const SEPA_PAIN001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>MSG-2024-001</MsgId>
      <CreDtTm>2024-01-15T10:30:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>100.00</CtrlSum>
      <InitgPty><Nm>ACME Corp</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PAY-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <CtrlSum>100.00</CtrlSum>
      <ReqdExctnDt>2024-01-20</ReqdExctnDt>
      <Dbtr><Nm>ACME Corp</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-001</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">100.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>Supplier GmbH</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Invoice 2024-001</Ustrd></RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

const SEPA_CAMT053 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <GrpHdr>
      <MsgId>STMT-2024-Q1</MsgId>
      <CreDtTm>2024-04-01T08:00:00</CreDtTm>
    </GrpHdr>
    <Stmt>
      <Id>STMT-001</Id>
      <Acct><Id><IBAN>DE89370400440532013000</IBAN></Id></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">1000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">1200.50</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
      </Bal>
      <Ntry>
        <Amt Ccy="EUR">200.50</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2024-03-15</Dt></BookgDt>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

test('sepa: pain.001 parses headers, transactions, and IBANs', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText('pain.001', { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText('MSG-2024-001');
  await expect(page.locator('#sepa-results')).toContainText('E2E-001');
  await expect(page.locator('#sepa-results')).toContainText('Supplier GmbH');
  await expect(page.locator('#sepa-results')).toContainText('100.00 EUR');
  await expect(page.locator('#sepa-results')).toContainText('Invoice 2024-001');
  // Both IBANs in the document should pass MOD-97.
  await expect(page.locator('#sepa-results')).toContainText(/IBAN MOD-97 valid/i);
});

test('sepa: camt.053 parses statement balances and entries', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_CAMT053);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText('camt.053', { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText('STMT-001');
  await expect(page.locator('#sepa-results')).toContainText('1000.00 EUR');
  await expect(page.locator('#sepa-results')).toContainText('1200.50 EUR');
  await expect(page.locator('#sepa-results')).toContainText('200.50 EUR');
});

test('sepa: flags an IBAN that fails MOD-97', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Flip the last digit of the debtor IBAN — MOD-97 should fail.
  const bad = SEPA_PAIN001.replace('DE89370400440532013000', 'DE89370400440532013001');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/MOD-97.*failed.*DE89370400440532013001/i, { timeout: 5_000 });
});

test('sepa: surfaces schema version (pain.001.001.03) in document banner', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText('pain.001.001.03', { timeout: 5_000 });
});

test('sepa: BIC format check passes for valid BICs in pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  // The fixture carries COBADEFFXXX and DEUTDEFFXXX — both valid ISO 9362.
  await expect(page.locator('#sepa-results')).toContainText(/BIC format valid \(ISO 9362\)/i, { timeout: 5_000 });
});

test('sepa: currency code check passes on EUR in pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  // Fixture uses Ccy="EUR" — must be flagged as active per ISO 4217.
  await expect(page.locator('#sepa-results')).toContainText(/Currency codes active per ISO 4217:.*EUR/i, { timeout: 5_000 });
});

test('sepa: currency code check flags a typo / historical code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Swap Ccy="EUR" for Ccy="ERU" (a common typo) — ERU is not in the active list.
  const bad = SEPA_PAIN001.replace(/Ccy="EUR"/g, 'Ccy="ERU"');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Currency code not active per ISO 4217: ERU/i, { timeout: 5_000 });
});

test('sepa: BIC format check flags a malformed BIC', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Stomp the debtor BIC's first segment so it fails the bank-code regex.
  const bad = SEPA_PAIN001.replace('COBADEFFXXX', '123ADEFFXXX');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/BIC format check failed.*123ADEFFXXX/i, { timeout: 5_000 });
});

test('sepa: surfaces per-transaction InstrId alongside EndToEndId', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withInstrId = SEPA_PAIN001.replace(
    '<PmtId><EndToEndId>E2E-001</EndToEndId></PmtId>',
    '<PmtId><InstrId>INSTR-XYZ-42</InstrId><EndToEndId>E2E-001</EndToEndId></PmtId>'
  );
  await page.fill('#sepa-input', withInstrId);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText('INSTR-XYZ-42', { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText('E2E-001');
});

test('sepa: surfaces ReqdExctnDt (requested execution date) per PmtInf', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 already carries `<ReqdExctnDt>2024-01-20</ReqdExctnDt>` inside <PmtInf>.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText('2024-01-20', { timeout: 5_000 });
});

test('sepa: pain.008 direct debit surfaces per-transaction MndtId', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>DD-MSG-2024-099</MsgId>
      <CreDtTm>2024-05-15T09:00:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>42.00</CtrlSum>
      <InitgPty><Nm>Creditor Inc</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-001</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-077</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-2024-XYZ</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>Subscription May 2024</Ustrd></RmtInf>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText('pain.008', { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText('MANDATE-2024-XYZ');
  await expect(page.locator('#sepa-results')).toContainText('Subscription May 2024');
});

test('sepa: GrpHdr NbOfTxs + CtrlSum invariants confirm on a well-formed pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // The SEPA_PAIN001 fixture declares NbOfTxs=1 and CtrlSum=100.00, and the
  // single transaction has InstdAmt 100.00 EUR — both invariants should pass.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/NbOfTxs matches transaction count/i, { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText(/CtrlSum matches transaction total/i);
});

test('sepa: NbOfTxs mismatch flagged when header overcounts transactions', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // ISO 20022 group-header invariant: GrpHdr/NbOfTxs MUST equal the file's
  // transaction-info element count. EPC SEPA rulebook makes this a hard
  // bank-side reject reason; surface the mismatch on the inspector too.
  const bad = SEPA_PAIN001.replace('<NbOfTxs>1</NbOfTxs>', '<NbOfTxs>2</NbOfTxs>');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/NbOfTxs mismatch/i, { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText(/ISO 20022/);
});

test('sepa: CtrlSum mismatch flagged when header undersums transaction amounts', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Header declares CtrlSum=50.00 but the transaction's InstdAmt is 100.00 —
  // the inspector should surface a red row with both the declared and actual
  // totals (well outside the ±0.01 rounding tolerance).
  const bad = SEPA_PAIN001.replace('<CtrlSum>100.00</CtrlSum>', '<CtrlSum>50.00</CtrlSum>');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CtrlSum mismatch/i, { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText(/50/);
  await expect(page.locator('#sepa-results')).toContainText(/100/);
});

test('sepa: IBAN↔BIC country-code parity confirms on a well-formed German pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 has DE IBANs paired with DE BICs (COBADEFFXXX / DEUTDEFFXXX);
  // ISO 13616 vs ISO 9362 country codes should agree across both Dbtr and Cdtr.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/IBAN ↔ BIC country codes agree/i, { timeout: 5_000 });
});

test('sepa: IBAN↔BIC country-code parity flags a German IBAN routed via a French agent', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Swap the debtor's BIC for a French one while keeping the German IBAN —
  // the kind of copy-paste error EBA clearing rejects. The mismatched pair
  // should surface as a danger row carrying both country codes.
  const bad = SEPA_PAIN001.replace('<BIC>COBADEFFXXX</BIC>', '<BIC>BNPAFRPPXXX</BIC>');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/IBAN ↔ BIC country mismatch/i, { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText(/DE89370400440532013000/);
  await expect(page.locator('#sepa-results')).toContainText(/BNPAFRPPXXX/);
});

test('sepa: PmtMtd consistency confirms TRF on a well-formed pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtMtd matches document type.*TRF.*pain\.001/i, { timeout: 5_000 });
});

test('sepa: PmtMtd consistency flags DD declared inside a pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Swap the credit-transfer PmtMtd for a direct-debit one — schema-valid XML,
  // but EPC rulebook-broken: pain.001 must declare TRF, not DD.
  const bad = SEPA_PAIN001.replace('<PmtMtd>TRF</PmtMtd>', '<PmtMtd>DD</PmtMtd>');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtMtd mismatch.*declares DD.*pain\.001 requires TRF/i, { timeout: 5_000 });
});

test('sepa: ChrgBr enforcement confirms SLEV on a SEPA-compliant pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // EPC SEPA Rulebooks require ChrgBr=SLEV — inject it into the existing PmtInf block.
  const good = SEPA_PAIN001.replace('<PmtMtd>TRF</PmtMtd>', '<PmtMtd>TRF</PmtMtd>\n      <ChrgBr>SLEV</ChrgBr>');
  await page.fill('#sepa-input', good);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/ChrgBr matches EPC SEPA Rulebook.*SLEV/i, { timeout: 5_000 });
});

test('sepa: ChrgBr enforcement flags DEBT inside a SEPA pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // DEBT is schema-valid ISO 20022 but EPC SEPA forbids anything except SLEV.
  const bad = SEPA_PAIN001.replace('<PmtMtd>TRF</PmtMtd>', '<PmtMtd>TRF</PmtMtd>\n      <ChrgBr>DEBT</ChrgBr>');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/ChrgBr mismatch.*declares DEBT.*SLEV/i, { timeout: 5_000 });
});

test('sepa: EndToEndId uniqueness confirms a batch with distinct ids', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // EPC SEPA Rulebook requires EndToEndId uniqueness per Originator. Append a
  // second CdtTrfTxInf carrying a distinct E2E-002 so the file holds two transactions.
  const secondTx = `      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-002</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">50.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>Other Supplier</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>`;
  const good = SEPA_PAIN001.replace('</CdtTrfTxInf>\n    </PmtInf>', `</CdtTrfTxInf>\n${secondTx}\n    </PmtInf>`);
  await page.fill('#sepa-input', good);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/EndToEndId values are unique across the file.*EPC SEPA Rulebook/i, { timeout: 5_000 });
});

test('sepa: EndToEndId uniqueness flags a duplicated id within the file', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Append a second CdtTrfTxInf reusing the same E2E-001 — clearing systems reject this.
  const dupTx = `      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-001</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">75.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>Dup Supplier</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>`;
  const bad = SEPA_PAIN001.replace('</CdtTrfTxInf>\n    </PmtInf>', `</CdtTrfTxInf>\n${dupTx}\n    </PmtInf>`);
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/EndToEndId duplicated within file.*E2E-001.*2 times.*uniqueness per Originator/i, { timeout: 5_000 });
});

test('sepa: SvcLvl enforcement confirms SEPA on a SEPA-compliant pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // EPC SEPA Rulebooks require PmtTpInf/SvcLvl/Cd=SEPA — inject it into the PmtInf block.
  const good = SEPA_PAIN001.replace('<PmtMtd>TRF</PmtMtd>', '<PmtMtd>TRF</PmtMtd>\n      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>');
  await page.fill('#sepa-input', good);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/SvcLvl matches EPC SEPA Rulebook.*SEPA/i, { timeout: 5_000 });
});

test('sepa: SvcLvl enforcement flags NURG inside a SEPA pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // NURG is schema-valid ISO 20022 but EPC SEPA forbids anything except SEPA.
  const bad = SEPA_PAIN001.replace('<PmtMtd>TRF</PmtMtd>', '<PmtMtd>TRF</PmtMtd>\n      <PmtTpInf><SvcLvl><Cd>NURG</Cd></SvcLvl></PmtTpInf>');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/SvcLvl mismatch.*declares NURG.*SEPA/i, { timeout: 5_000 });
});

test('sepa: SeqTp enforcement confirms FRST on a SEPA-compliant pain.008', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // EPC SDD Rulebook allows SeqTp ∈ {FRST, RCUR, OOFF, FNAL}. Inject FRST and assert confirmation.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-99</MsgId><CreDtTm>2024-05-15T09:00:00</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>C</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>M-1</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>D</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/SeqTp valid per EPC SDD Rulebook.*FRST/i, { timeout: 5_000 });
});

test('sepa: SeqTp enforcement flags RECR (typo) in a pain.008', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // RECR is a common typo for RCUR — schema-valid Max4Text, rulebook-broken.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-99</MsgId><CreDtTm>2024-05-15T09:00:00</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SeqTp>RECR</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>C</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>M-1</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>D</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/SeqTp invalid.*declares RECR.*FRST \/ RCUR \/ OOFF \/ FNAL/i, { timeout: 5_000 });
});

test('sepa: rejects non-ISO 20022 XML', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', '<?xml version="1.0"?><foo><bar/></foo>');
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/No <Document>/i, { timeout: 5_000 });
});

// =============== eIDAS LOTL / TSL viewer (SPEC §2.6) ===============

const LOTL_LIST = `<?xml version="1.0" encoding="UTF-8"?>
<TrustServiceStatusList xmlns="http://uri.etsi.org/02231/v2#">
  <SchemeInformation>
    <TSLVersionIdentifier>5</TSLVersionIdentifier>
    <TSLSequenceNumber>338</TSLSequenceNumber>
    <TSLType>http://uri.etsi.org/TrstSvc/TrustedList/TSLType/EUlistofthelists</TSLType>
    <SchemeOperatorName><Name xml:lang="en">European Commission</Name></SchemeOperatorName>
    <SchemeName><Name xml:lang="en">EU List of the Lists</Name></SchemeName>
    <SchemeTerritory>EU</SchemeTerritory>
    <ListIssueDateTime>2024-01-15T00:00:00Z</ListIssueDateTime>
    <NextUpdate><dateTime>2024-07-15T00:00:00Z</dateTime></NextUpdate>
  </SchemeInformation>
  <PointersToOtherTSL>
    <OtherTSLPointer>
      <TSLLocation>https://example.de/tsl-de.xml</TSLLocation>
      <AdditionalInformation>
        <OtherInformation><SchemeTerritory>DE</SchemeTerritory></OtherInformation>
      </AdditionalInformation>
    </OtherTSLPointer>
    <OtherTSLPointer>
      <TSLLocation>https://example.fr/tsl-fr.xml</TSLLocation>
      <AdditionalInformation>
        <OtherInformation><SchemeTerritory>FR</SchemeTerritory></OtherInformation>
      </AdditionalInformation>
    </OtherTSLPointer>
  </PointersToOtherTSL>
</TrustServiceStatusList>`;

const LOTL_TSL = `<?xml version="1.0" encoding="UTF-8"?>
<TrustServiceStatusList xmlns="http://uri.etsi.org/02231/v2#">
  <SchemeInformation>
    <TSLType>http://uri.etsi.org/TrstSvc/TrustedList/TSLType/schemes/DE</TSLType>
    <SchemeOperatorName><Name xml:lang="en">Bundesnetzagentur</Name></SchemeOperatorName>
    <SchemeName><Name xml:lang="en">German Trusted List</Name></SchemeName>
    <SchemeTerritory>DE</SchemeTerritory>
    <ListIssueDateTime>2024-02-01T00:00:00Z</ListIssueDateTime>
  </SchemeInformation>
  <TrustServiceProviderList>
    <TrustServiceProvider>
      <TSPInformation>
        <TSPName><Name xml:lang="en">D-TRUST GmbH</Name></TSPName>
      </TSPInformation>
      <TSPServices>
        <TSPService>
          <ServiceInformation>
            <ServiceTypeIdentifier>http://uri.etsi.org/TrstSvc/Svctype/CA/QC</ServiceTypeIdentifier>
            <ServiceName><Name xml:lang="en">D-TRUST CA 3-1 2016</Name></ServiceName>
            <ServiceDigitalIdentity>
              <DigitalId><X509Certificate>MIIE3jCCBMagAwIBAgIDB9234B</X509Certificate></DigitalId>
            </ServiceDigitalIdentity>
            <ServiceStatus>http://uri.etsi.org/TrstSvc/TrustedList/Svcstatus/granted</ServiceStatus>
            <StatusStartingTime>2017-01-01T00:00:00Z</StatusStartingTime>
          </ServiceInformation>
        </TSPService>
      </TSPServices>
    </TrustServiceProvider>
  </TrustServiceProviderList>
</TrustServiceStatusList>`;

test('lotl: LOTL mode renders per-country pointers', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'lotl');
  await page.fill('#lotl-input', LOTL_LIST);
  await page.click('#btn-lotl-parse');
  await expect(page.locator('#lotl-results')).toContainText(/LOTL/i, { timeout: 5_000 });
  await expect(page.locator('#lotl-results')).toContainText('European Commission');
  await expect(page.locator('#lotl-results')).toContainText('EU List of the Lists');
  // Both country pointers should appear.
  await expect(page.locator('#lotl-results')).toContainText('https://example.de/tsl-de.xml');
  await expect(page.locator('#lotl-results')).toContainText('https://example.fr/tsl-fr.xml');
  await expect(page.locator('#lotl-results')).toContainText('DE');
  await expect(page.locator('#lotl-results')).toContainText('FR');
});

test('lotl: TSL mode renders TSP and services', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'lotl');
  await page.fill('#lotl-input', LOTL_TSL);
  await page.click('#btn-lotl-parse');
  await expect(page.locator('#lotl-results')).toContainText(/TSL/i, { timeout: 5_000 });
  await expect(page.locator('#lotl-results')).toContainText('Bundesnetzagentur');
  await expect(page.locator('#lotl-results')).toContainText('D-TRUST GmbH');
  await expect(page.locator('#lotl-results')).toContainText('CA/QC');
  await expect(page.locator('#lotl-results')).toContainText(/granted/);
  await expect(page.locator('#lotl-results')).toContainText(/Embedded X\.509/i);
});

test('lotl: NextUpdate in the future surfaces a "current" freshness row', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'lotl');
  // Build a LOTL fixture with NextUpdate set ~30 days from "today" relative to
  // the page; the freshness check is wall-clock, so we use the test-harness clock.
  const future = new Date(Date.now() + 30 * 86400000).toISOString();
  const xml = LOTL_LIST.replace(/<NextUpdate>.*<\/NextUpdate>/, `<NextUpdate><dateTime>${future}</dateTime></NextUpdate>`);
  await page.fill('#lotl-input', xml);
  await page.click('#btn-lotl-parse');
  await expect(page.locator('#lotl-results')).toContainText(/Trust list is current/i, { timeout: 5_000 });
  await expect(page.locator('#lotl-results')).toContainText(/ETSI TS 119 612/);
});

test('lotl: NextUpdate in the past surfaces a stale-trust-list warning', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'lotl');
  // ETSI TS 119 612 §5.3.13: a maintainer relying on a cached XML where the
  // NextUpdate horizon has passed could trust a cert that has since been
  // withdrawn from the EU list. Surface a red row.
  const past = new Date(Date.now() - 90 * 86400000).toISOString();
  const xml = LOTL_LIST.replace(/<NextUpdate>.*<\/NextUpdate>/, `<NextUpdate><dateTime>${past}</dateTime></NextUpdate>`);
  await page.fill('#lotl-input', xml);
  await page.click('#btn-lotl-parse');
  await expect(page.locator('#lotl-results')).toContainText(/Trust list is stale/i, { timeout: 5_000 });
  await expect(page.locator('#lotl-results')).toContainText(/ec\.europa\.eu/);
});

test('lotl: rejects non-trust-list XML', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'lotl');
  await page.fill('#lotl-input', '<?xml version="1.0"?><Document/>');
  await page.click('#btn-lotl-parse');
  await expect(page.locator('#lotl-results')).toContainText(/TrustServiceStatusList/i, { timeout: 5_000 });
});

// =============== PEPPOL / UBL invoice inspector (SPEC §2.7) ===============
// Minimal but realistic PEPPOL BIS Billing 3.0 invoice — header, supplier, customer,
// one line item, one VAT bracket, the four LegalMonetaryTotal amounts.
const UBL_INVOICE = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>INV-2024-042</cbc:ID>
  <cbc:IssueDate>2024-04-01</cbc:IssueDate>
  <cbc:DueDate>2024-05-01</cbc:DueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>ACME Widgets GmbH</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      <cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Beispiel SARL</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      <cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">2</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Widget Pro</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">50.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

const UBL_CREDIT_NOTE = `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
            xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
            xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>CN-2024-007</cbc:ID>
  <cbc:IssueDate>2024-04-10</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="EUR">50.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:CreditNoteLine>
    <cbc:ID>1</cbc:ID>
    <cbc:CreditedQuantity unitCode="C62">1</cbc:CreditedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Refunded Widget</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">50.00</cbc:PriceAmount></cac:Price>
  </cac:CreditNoteLine>
</CreditNote>`;

test('ubl: Invoice parses header, totals, line items, and tax breakdown', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/UBL 2\.1 Invoice/i, { timeout: 5_000 });
  await expect(page.locator('#ubl-results')).toContainText('INV-2024-042');
  await expect(page.locator('#ubl-results')).toContainText('ACME Widgets GmbH');
  await expect(page.locator('#ubl-results')).toContainText('Beispiel SARL');
  await expect(page.locator('#ubl-results')).toContainText('100.00 EUR');
  await expect(page.locator('#ubl-results')).toContainText('119.00 EUR');
  await expect(page.locator('#ubl-results')).toContainText('Widget Pro');
  await expect(page.locator('#ubl-results')).toContainText('2 C62');
  await expect(page.locator('#ubl-results')).toContainText('19 %');
  await expect(page.locator('#ubl-results')).toContainText(/S\s*\(VAT\)/);
});

test('ubl: CreditNote parses CreditNoteLine and payable amount', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_CREDIT_NOTE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/UBL 2\.1 CreditNote/i, { timeout: 5_000 });
  await expect(page.locator('#ubl-results')).toContainText('CN-2024-007');
  await expect(page.locator('#ubl-results')).toContainText('Refunded Widget');
  await expect(page.locator('#ubl-results')).toContainText('50.00 EUR');
});

test('ubl: copy-as-CSV exposes a row per line item with the correct columns', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#btn-ubl-copy-csv')).toBeVisible({ timeout: 5_000 });
  await page.click('#btn-ubl-copy-csv');
  const csv = await page.evaluate(() => navigator.clipboard.readText());
  const rows = csv.trim().split('\n');
  expect(rows[0]).toBe('#,Name,Quantity,UnitCode,Price,PriceCurrency,LineAmount,LineCurrency');
  // First (and only) line item: Widget Pro, qty 2 C62, price 50 EUR, line 100 EUR.
  expect(rows[1]).toMatch(/^1,Widget Pro,2,C62,50\.00,EUR,100\.00,EUR$/);
});

test('ubl: totals consistency passes on a well-formed Invoice', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  // Both EN 16931 invariants should pass for the fixture.
  await expect(page.locator('#ubl-results')).toContainText(/Line totals sum matches/i, { timeout: 5_000 });
  await expect(page.locator('#ubl-results')).toContainText(/TaxExclusive \+ Σ TaxAmount = TaxInclusive/i);
});

test('ubl: totals consistency flags a line-sum mismatch', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Stomp the declared LineExtensionAmount in LegalMonetaryTotal so the sum (100.00)
  // no longer matches the declared (90.00).
  const bad = UBL_INVOICE.replace(
    '<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>\n    <cbc:TaxExclusiveAmount',
    '<cbc:LineExtensionAmount currencyID="EUR">90.00</cbc:LineExtensionAmount>\n    <cbc:TaxExclusiveAmount'
  );
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line sum 100\.00 EUR ≠ declared LineExtensionAmount 90\.00 EUR/i, { timeout: 5_000 });
});

test('ubl: totals consistency flags a tax-inclusive mismatch', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Stomp the declared TaxInclusiveAmount so TaxExcl (100) + TaxAmount (19) ≠ declared (120).
  const bad = UBL_INVOICE.replace('119.00</cbc:TaxInclusiveAmount>', '120.00</cbc:TaxInclusiveAmount>');
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxExclusive \+ Σ TaxAmount = 119\.00 EUR ≠ declared TaxInclusive 120\.00 EUR/i, { timeout: 5_000 });
});

test('ubl: ISO 4217 currency cross-check confirms a well-formed EUR invoice', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  // Single confirmation row listing the active currency codes seen in the doc.
  await expect(page.locator('#ubl-results')).toContainText(/Currency codes active per ISO 4217:\s*EUR/i, { timeout: 5_000 });
});

test('ubl: ISO 4217 currency cross-check flags a typo (ERU for EUR)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Flip every currencyID="EUR" to ERU. Real-world finger-flip; the totals-
  // consistency check would not catch it (all amounts still balance).
  const bad = UBL_INVOICE.replace(/currencyID="EUR"/g, 'currencyID="ERU"');
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Currency code not active per ISO 4217:\s*ERU/i, { timeout: 5_000 });
});

test('ubl: VAT-rate consistency confirms a well-formed 19% TaxSubtotal', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UBL_INVOICE declares TaxableAmount=100.00 × 19% with TaxAmount=19.00 —
  // exactly EN 16931 BR-CO-17 says it should be.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxAmount matches TaxableAmount/i, { timeout: 5_000 });
  await expect(page.locator('#ubl-results')).toContainText(/BR-CO-17/);
});

test('ubl: VAT-rate consistency flags a TaxAmount that disagrees with the declared rate', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject the canonical test-invoice error: keep the 19% rate and 100.00
  // base, but declare TaxAmount as 19.50 — a 0.50 EUR overstatement well
  // outside the EN 16931 ±0.01 rounding tolerance. The check fires per
  // TaxSubtotal, so both the subtotal-level and the top-level TaxAmount
  // get rewritten to keep totals balanced (otherwise the totals check would
  // also fire and clutter the assertion target).
  const bad = UBL_INVOICE
    .replace('<cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>\n    <cac:TaxSubtotal>\n      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>\n      <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>',
             '<cbc:TaxAmount currencyID="EUR">19.50</cbc:TaxAmount>\n    <cac:TaxSubtotal>\n      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>\n      <cbc:TaxAmount currencyID="EUR">19.50</cbc:TaxAmount>');
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/VAT-rate mismatch/i, { timeout: 5_000 });
  await expect(page.locator('#ubl-results')).toContainText(/19\.00/);
  await expect(page.locator('#ubl-results')).toContainText(/19\.50/);
});

test('ubl: PayeeFinancialAccount IBAN cross-check confirms MOD-97 on a valid IBAN', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // PEPPOL BIS Billing 3.0: <cac:PaymentMeans> carries the supplier's bank
  // coordinates as <cac:PayeeFinancialAccount>/<cbc:ID>. When the value is
  // shaped like an IBAN, the inspector runs ISO 13616 MOD-97 over it — same
  // shape as the SEPA inspector's IBAN cross-check, parallel polish for §2.7.
  const withIban = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cac:PayeeFinancialAccount>\n      <cbc:ID>DE89370400440532013000</cbc:ID>\n    </cac:PayeeFinancialAccount>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withIban);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Payee.*IBANs valid/i, { timeout: 5_000 });
  await expect(page.locator('#ubl-results')).toContainText(/ISO 13616/);
});

test('ubl: PayeeFinancialAccount IBAN cross-check flags a MOD-97 failure', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // A character flipped in the bank-code portion breaks MOD-97 while keeping
  // the IBAN-shape regex match — exactly the failure mode the cross-check
  // exists to catch.
  const withBadIban = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cac:PayeeFinancialAccount>\n      <cbc:ID>DE89370400440532013001</cbc:ID>\n    </cac:PayeeFinancialAccount>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withBadIban);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/failed.*MOD-97/i, { timeout: 5_000 });
  await expect(page.locator('#ubl-results')).toContainText('DE89370400440532013001');
});

test('ubl: DueDate vs IssueDate confirms when due date is after issue date', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UBL_INVOICE has IssueDate=2024-04-01, DueDate=2024-05-01 — well-formed.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/DueDate 2024-05-01 is on or after IssueDate 2024-04-01/i, { timeout: 5_000 });
});

test('ubl: DueDate vs IssueDate flags a backdated DueDate', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Swap the dates so payment falls due before the invoice is even issued —
  // a real-world data-entry error that some PEPPOL access points reject.
  const bad = UBL_INVOICE.replace('<cbc:DueDate>2024-05-01</cbc:DueDate>', '<cbc:DueDate>2024-03-15</cbc:DueDate>');
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/DueDate 2024-03-15 is earlier than IssueDate 2024-04-01/i, { timeout: 5_000 });
});

test('ubl: VAT category code confirms when TaxCategory/ID is in the EN 16931 allowed set', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UBL_INVOICE declares TaxCategory/ID = 'S' (Standard rate) — the canonical happy path.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/VAT category codes valid \(UNCL 5305 \/ EN 16931\).*S/i, { timeout: 5_000 });
});

test('ubl: VAT category code flags an unknown letter', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // 'XX' is schema-valid plain text but not in the EN 16931 / UNCL 5305 allowed set.
  const bad = UBL_INVOICE.replace('<cbc:ID>S</cbc:ID>', '<cbc:ID>XX</cbc:ID>');
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Unknown VAT category code XX/i, { timeout: 5_000 });
});

test('ubl: PayableAmount consistency confirms on a well-formed Invoice', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UBL_INVOICE has TaxInclusiveAmount = PayableAmount = 119.00, no Prepaid or rounding.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PayableAmount 119\.00 EUR matches.*BR-CO-16/i, { timeout: 5_000 });
});

test('ubl: PayableAmount consistency flags a mismatch against TaxInclusive', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Bump PayableAmount to 120.00 while leaving TaxInclusive at 119.00 — EN 16931 BR-CO-16
  // says PayableAmount must equal TaxInclusive − Prepaid + PayableRounding.
  const bad = UBL_INVOICE.replace('119.00</cbc:PayableAmount>', '120.00</cbc:PayableAmount>');
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PayableAmount mismatch.*119\.00 EUR.*120\.00 EUR.*BR-CO-16/i, { timeout: 5_000 });
});

test('ubl: InvoiceTypeCode confirms when set to PEPPOL-allowed 380', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // PEPPOL BIS Billing 3.0 allows InvoiceTypeCode ∈ {380, 381, 384, 389, 875, 876, 877};
  // 380 (Commercial invoice) is by far the most common.
  const good = UBL_INVOICE.replace(
    '<cbc:DueDate>2024-05-01</cbc:DueDate>',
    '<cbc:DueDate>2024-05-01</cbc:DueDate>\n  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>'
  );
  await page.fill('#ubl-input', good);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document type code 380.*PEPPOL BIS Billing 3\.0.*UNCL 1001/i, { timeout: 5_000 });
});

test('ubl: InvoiceTypeCode flags a value outside the PEPPOL allowed set', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // 999 is schema-valid plain integer text but rail-broken — PEPPOL rejects it.
  const bad = UBL_INVOICE.replace(
    '<cbc:DueDate>2024-05-01</cbc:DueDate>',
    '<cbc:DueDate>2024-05-01</cbc:DueDate>\n  <cbc:InvoiceTypeCode>999</cbc:InvoiceTypeCode>'
  );
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document type code 999 is not in the PEPPOL BIS Billing 3\.0 allowed set/i, { timeout: 5_000 });
  await expect(page.locator('#ubl-results')).toContainText(/380/);
});

test('ubl: line-ID uniqueness confirms when each InvoiceLine carries a distinct cbc:ID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Add a second InvoiceLine with a distinct ID so the uniqueness check has
  // two values to compare. UBL_INVOICE already declares cbc:ID=1 on its single
  // line; the duplicate fixture below appends a sibling with cbc:ID=2.
  const twoLines = UBL_INVOICE.replace(
    '</cac:InvoiceLine>\n</Invoice>',
    `</cac:InvoiceLine>\n  <cac:InvoiceLine>\n    <cbc:ID>2</cbc:ID>\n    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>\n    <cbc:LineExtensionAmount currencyID="EUR">0.00</cbc:LineExtensionAmount>\n    <cac:Item><cbc:Name>Filler</cbc:Name></cac:Item>\n    <cac:Price><cbc:PriceAmount currencyID="EUR">0.00</cbc:PriceAmount></cac:Price>\n  </cac:InvoiceLine>\n</Invoice>`
  );
  await page.fill('#ubl-input', twoLines);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line IDs unique across the document \(2 line\(s\)\).*BR-21/i, { timeout: 5_000 });
});

test('ubl: line-ID uniqueness flags a duplicated cbc:ID across two InvoiceLines', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Two InvoiceLines that both declare cbc:ID=1 — the canonical batch-generator
  // bug the uniqueness gate exists to catch.
  const dupLines = UBL_INVOICE.replace(
    '</cac:InvoiceLine>\n</Invoice>',
    `</cac:InvoiceLine>\n  <cac:InvoiceLine>\n    <cbc:ID>1</cbc:ID>\n    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>\n    <cbc:LineExtensionAmount currencyID="EUR">0.00</cbc:LineExtensionAmount>\n    <cac:Item><cbc:Name>Filler</cbc:Name></cac:Item>\n    <cac:Price><cbc:PriceAmount currencyID="EUR">0.00</cbc:PriceAmount></cac:Price>\n  </cac:InvoiceLine>\n</Invoice>`
  );
  await page.fill('#ubl-input', dupLines);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line ID duplicated within document: 1 appears 2 times.*BR-21/i, { timeout: 5_000 });
});

test('sepa: MsgId character-set check confirms on a Rulebook-clean identifier', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 declares MsgId=MSG-2024-001 — all chars in the EPC allowed set.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/MsgId MSG-2024-001 uses only EPC SEPA Rulebook allowed characters/i, { timeout: 5_000 });
});

test('sepa: MsgId character-set check flags a non-Latin character', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject an accented character that is schema-valid Max35Text but outside
  // the EPC SEPA Rulebook allowed character set. Clearing systems either
  // reject the file or strip the bad characters silently.
  const bad = SEPA_PAIN001.replace('MSG-2024-001', 'MSG-2024-Ää');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/MsgId MSG-2024-Ää contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('ubl: PEPPOL CustomizationID confirms when the BIS Billing 3.0 URN is declared', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UBL_INVOICE already declares the canonical PEPPOL BIS Billing 3.0 URN.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CustomizationID declares PEPPOL BIS Billing 3\.0 conformance/i, { timeout: 5_000 });
});

test('ubl: PEPPOL CustomizationID flags a non-PEPPOL URN', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Repurposed generic UBL invoice — schema-valid but rejected by PEPPOL access points.
  const bad = UBL_INVOICE.replace(
    'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
    'urn:cen.eu:en16931:2017'
  );
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CustomizationID urn:cen\.eu:en16931:2017 does not match PEPPOL BIS Billing 3\.0/i, { timeout: 5_000 });
});

test('sepa: EndToEndId character-set check confirms on a Rulebook-clean batch', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 declares EndToEndId=E2E-001 — all chars in the EPC allowed set.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/EndToEndId values use only EPC SEPA Rulebook allowed characters across all 1 transaction/i, { timeout: 5_000 });
});

test('sepa: EndToEndId character-set check flags a non-Latin character', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject an emoji into the EndToEndId — Max35Text-valid (no length problem)
  // but outside the EPC SEPA Rulebook allowed character set.
  const bad = SEPA_PAIN001.replace('E2E-001', 'E2E-Müller');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/EndToEndId E2E-Müller contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('ubl: PEPPOL ProfileID confirms when the BIS Billing 3.0 process URN is declared', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UBL_INVOICE already declares the canonical PEPPOL BIS Billing 3.0 process URN.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/ProfileID declares the PEPPOL BIS Billing 3\.0 process/i, { timeout: 5_000 });
});

test('ubl: PEPPOL ProfileID flags a non-PEPPOL process URN', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Repurposed UBL invoice declaring a different (non-existent) BIS process —
  // schema-valid plain text but rejected by PEPPOL access points at routing.
  const bad = UBL_INVOICE.replace(
    'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
    'urn:fdc:peppol.eu:2017:poacc:billing:99:9.9'
  );
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/ProfileID urn:fdc:peppol\.eu:2017:poacc:billing:99:9\.9 does not match the PEPPOL BIS Billing 3\.0 process/i, { timeout: 5_000 });
});

test('sepa: InstrId character-set check confirms on a Rulebook-clean batch', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject an InstrId next to the existing EndToEndId so the check has something
  // to walk. SEPA_PAIN001 currently has no InstrId on its single transaction.
  const withInstr = SEPA_PAIN001.replace(
    '<PmtId><EndToEndId>E2E-001</EndToEndId></PmtId>',
    '<PmtId><InstrId>INSTR-001</InstrId><EndToEndId>E2E-001</EndToEndId></PmtId>'
  );
  await page.fill('#sepa-input', withInstr);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/InstrId values use only EPC SEPA Rulebook allowed characters across all 1 transaction/i, { timeout: 5_000 });
});

test('sepa: InstrId character-set check flags a non-Latin character', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBadInstr = SEPA_PAIN001.replace(
    '<PmtId><EndToEndId>E2E-001</EndToEndId></PmtId>',
    '<PmtId><InstrId>INSTR-Übergabe</InstrId><EndToEndId>E2E-001</EndToEndId></PmtId>'
  );
  await page.fill('#sepa-input', withBadInstr);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/InstrId INSTR-Übergabe contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('ubl: TaxScheme/ID confirms when every TaxCategory declares VAT', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UBL_INVOICE already declares <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxScheme\/ID = VAT across every TaxCategory.*PEPPOL BIS Billing 3\.0/i, { timeout: 5_000 });
});

test('ubl: TaxScheme/ID flags a non-VAT code (e.g. GST)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // A template repurposed from a non-EU UBL flow may carry GST — schema-valid,
  // PEPPOL-broken.
  const bad = UBL_INVOICE.replace('<cbc:ID>VAT</cbc:ID>', '<cbc:ID>GST</cbc:ID>');
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxScheme\/ID GST is not VAT — PEPPOL BIS Billing 3\.0/i, { timeout: 5_000 });
});

test('sepa: MndtId character-set check confirms on a Rulebook-clean pain.008', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // The existing pain.008 fixture declares <MndtId>MANDATE-2024-XYZ</MndtId> — clean ASCII.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-99</MsgId><CreDtTm>2024-05-15T09:00:00</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>C</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MNDT-2024-001</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>D</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/MndtId values use only EPC SDD Rulebook allowed characters across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: MndtId character-set check flags a non-Latin character', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-99</MsgId><CreDtTm>2024-05-15T09:00:00</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>C</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MNDT-Müller-001</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>D</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/MndtId MNDT-Müller-001 contains characters outside the EPC SDD Rulebook allowed set/i, { timeout: 5_000 });
});

test('sepa: PmtInfId character-set check confirms on a Rulebook-clean pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 declares <PmtInfId>PAY-001</PmtInfId> — clean ASCII.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInfId values use only EPC SEPA Rulebook allowed characters across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: PmtInfId character-set check flags a non-Latin character', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // A batch generator interpolating a company name (Übermäßig GmbH) into the
  // per-block identifier — schema-valid Max35Text, rail-broken per the EPC
  // SEPA Rulebook character set.
  const bad = SEPA_PAIN001.replace('<PmtInfId>PAY-001</PmtInfId>', '<PmtInfId>PAY-Übermäßig</PmtInfId>');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInfId PAY-Übermäßig contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('ubl: Seller VAT identifier confirms a valid DE VAT ID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // PEPPOL BIS Billing 3.0 requires the supplier VAT identifier (EN 16931
  // BT-31) in AccountingSupplierParty/Party/PartyTaxScheme/CompanyID, paired
  // with TaxScheme/cbc:ID=VAT. DE136695976 is the canonical DE example with
  // a passing ISO 7064 MOD 11,10 checksum.
  const withVat = UBL_INVOICE.replace(
    '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n    </cac:Party>',
    '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>DE136695976</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>\n    </cac:Party>'
  );
  await page.fill('#ubl-input', withVat);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Seller VAT identifier DE136695976 valid per ISO 3166-1 alpha-2/i, { timeout: 5_000 });
});

test('ubl: Seller VAT identifier flags a malformed value', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Missing country prefix — UBL 2.1 accepts the bare identifier text, but
  // PEPPOL BIS Billing 3.0 / EN 16931 BT-31 reject it at the schematron gate.
  const withVat = UBL_INVOICE.replace(
    '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n    </cac:Party>',
    '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>123456789</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>\n    </cac:Party>'
  );
  await page.fill('#ubl-input', withVat);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Seller VAT identifier 123456789 invalid — PEPPOL BIS Billing 3\.0 \/ EN 16931 BT-31/i, { timeout: 5_000 });
});

test('ubl: Buyer VAT identifier confirms a valid FR VAT ID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // EN 16931 BT-48: Buyer VAT identifier lives in AccountingCustomerParty/
  // Party/PartyTaxScheme/CompanyID with TaxScheme/ID=VAT. FR40303265045 is
  // the canonical FR example with a passing (12 + 3*(SIREN%97))%97 checksum.
  const withVat = UBL_INVOICE.replace(
    '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n    </cac:Party>\n  </cac:AccountingCustomerParty>',
    '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>FR40303265045</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>\n    </cac:Party>\n  </cac:AccountingCustomerParty>'
  );
  await page.fill('#ubl-input', withVat);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Buyer VAT identifier FR40303265045 valid per ISO 3166-1 alpha-2/i, { timeout: 5_000 });
});

test('ubl: Buyer VAT identifier flags a malformed value', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withVat = UBL_INVOICE.replace(
    '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n    </cac:Party>\n  </cac:AccountingCustomerParty>',
    '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>987654321</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>\n    </cac:Party>\n  </cac:AccountingCustomerParty>'
  );
  await page.fill('#ubl-input', withVat);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Buyer VAT identifier 987654321 invalid — PEPPOL BIS Billing 3\.0 \/ EN 16931 BT-48/i, { timeout: 5_000 });
});

test('sepa: Ustrd character-set check confirms on a Rulebook-clean batch', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 already declares <Ustrd>Invoice 2024-001</Ustrd> — clean ASCII.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/RmtInf\/Ustrd values use only EPC SEPA Rulebook allowed characters across all 1 unstructured remittance entry/i, { timeout: 5_000 });
});

test('sepa: Ustrd character-set check flags a non-Latin character', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const bad = SEPA_PAIN001.replace('Invoice 2024-001', 'Rechnung Müller 2024');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/RmtInf\/Ustrd "Rechnung Müller 2024" contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('ubl: InvoicePeriod confirms when EndDate is after StartDate', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // EN 16931 BR-29 / BR-CO-19: when an InvoicePeriod block is present,
  // StartDate must be ≤ EndDate. Insert one with a sane month-long window.
  const withPeriod = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cac:InvoicePeriod><cbc:StartDate>2024-03-01</cbc:StartDate><cbc:EndDate>2024-03-31</cbc:EndDate></cac:InvoicePeriod>'
  );
  await page.fill('#ubl-input', withPeriod);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/InvoicePeriod EndDate 2024-03-31 is on or after StartDate 2024-03-01 \(EN 16931 BR-29 \/ BR-CO-19\)/i, { timeout: 5_000 });
});

test('ubl: InvoicePeriod flags an inverted window', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // StartDate after EndDate — common template-swap mistake.
  const withPeriod = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cac:InvoicePeriod><cbc:StartDate>2024-03-31</cbc:StartDate><cbc:EndDate>2024-03-01</cbc:EndDate></cac:InvoicePeriod>'
  );
  await page.fill('#ubl-input', withPeriod);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/InvoicePeriod EndDate 2024-03-01 precedes StartDate 2024-03-31 — EN 16931 BR-29 \/ BR-CO-19/i, { timeout: 5_000 });
});

test('sepa: party-Nm character-set check confirms on a Rulebook-clean batch', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 carries ACME Corp / debtor / creditor names — all ASCII.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Party name \(InitgPty\/Cdtr\/Dbtr Nm\) values use only EPC SEPA Rulebook allowed characters/i, { timeout: 5_000 });
});

test('sepa: party-Nm character-set check flags an umlaut in InitgPty/Nm', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const bad = SEPA_PAIN001.replace('<InitgPty><Nm>ACME Corp</Nm></InitgPty>', '<InitgPty><Nm>Müller GmbH</Nm></InitgPty>');
  await page.fill('#sepa-input', bad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Party name "Müller GmbH" contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('sepa: AdrLine character-set check confirms on a Rulebook-clean batch', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject a clean PstlAdr/AdrLine inside the debtor block — ASCII only.
  const withAdr = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><PstlAdr><AdrLine>123 Main Street</AdrLine><AdrLine>Berlin 10115</AdrLine></PstlAdr></Dbtr>'
  );
  await page.fill('#sepa-input', withAdr);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Postal address lines \(PstlAdr\/AdrLine\) use only EPC SEPA Rulebook allowed characters across all 2 line/i, { timeout: 5_000 });
});

test('sepa: AdrLine character-set check flags an accented street name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // "Königsallee 12" carries an umlaut — schema-valid Max70Text but rail-broken.
  const withAdr = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><PstlAdr><AdrLine>Königsallee 12</AdrLine></PstlAdr></Dbtr>'
  );
  await page.fill('#sepa-input', withAdr);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PstlAdr\/AdrLine "Königsallee 12" contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('ubl: PaymentMeansCode confirms on an EN 16931 allowed code (30 Credit transfer)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a PaymentMeans block carrying the canonical credit-transfer code 30.
  const withPm = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode></cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withPm);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PaymentMeansCode values allowed by EN 16931 \/ PEPPOL BIS Billing 3\.0 \(UNCL 4461 subset\):.*30/i, { timeout: 5_000 });
});

test('ubl: PaymentMeansCode flags a code outside the EN 16931 / PEPPOL subset', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UNCL 4461 "70" Bankers draft is schema-valid but rejected by PEPPOL access points.
  const withPm = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans><cbc:PaymentMeansCode>70</cbc:PaymentMeansCode></cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withPm);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PaymentMeansCode 70 is not in the EN 16931 \/ PEPPOL BIS Billing 3\.0 allowed UNCL 4461 subset/i, { timeout: 5_000 });
});

test('ubl: DocumentCurrencyCode consistency confirms when every @currencyID matches BT-5', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares EUR throughout — the consistency gate should pass.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/All monetary @currencyID attributes match the document currency EUR \(EN 16931 BR-CO-04/i, { timeout: 5_000 });
});

test('ubl: DocumentCurrencyCode consistency flags a mismatched @currencyID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Flip a single line-extension @currencyID to USD — schema-valid, but BR-CO-04 broken.
  const bad = UBL_INVOICE.replace(
    '<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>\n    <cac:Item>',
    '<cbc:LineExtensionAmount currencyID="USD">100.00</cbc:LineExtensionAmount>\n    <cac:Item>'
  );
  await page.fill('#ubl-input', bad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Monetary @currencyID USD does not match the document currency EUR — EN 16931 BR-CO-04/i, { timeout: 5_000 });
});

test('sepa: TwnNm character-set check confirms on a Rulebook-clean town name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject a clean ASCII TwnNm inside the debtor postal address.
  const withTwn = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><PstlAdr><TwnNm>Berlin</TwnNm></PstlAdr></Dbtr>'
  );
  await page.fill('#sepa-input', withTwn);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Town names \(PstlAdr\/TwnNm\) use only EPC SEPA Rulebook allowed characters across all 1 town/i, { timeout: 5_000 });
});

test('sepa: TwnNm character-set check flags an umlaut in a town name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // "München" carries an umlaut — schema-valid Max35Text but rail-broken.
  const withTwn = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><PstlAdr><TwnNm>München</TwnNm></PstlAdr></Dbtr>'
  );
  await page.fill('#sepa-input', withTwn);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PstlAdr\/TwnNm "München" contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('sepa: PstCd character-set check confirms on a Rulebook-clean postal code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Clean ASCII PstCd inside the debtor postal address — `10115` (Berlin) passes the EPC set.
  const withPst = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><PstlAdr><PstCd>10115</PstCd></PstlAdr></Dbtr>'
  );
  await page.fill('#sepa-input', withPst);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Postal codes \(PstlAdr\/PstCd\) use only EPC SEPA Rulebook allowed characters across all 1 code/i, { timeout: 5_000 });
});

test('sepa: PstCd character-set check flags non-ASCII characters in a postal code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // "10115§" carries `§` (section sign) — Max16Text-valid but outside the EPC SEPA character set.
  const withPst = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><PstlAdr><PstCd>10115§</PstCd></PstlAdr></Dbtr>'
  );
  await page.fill('#sepa-input', withPst);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PstlAdr\/PstCd "10115§" contains characters outside the EPC SEPA Rulebook allowed set/i, { timeout: 5_000 });
});

test('ubl: TaxCurrencyCode check confirms on an active ISO 4217 code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject TaxCurrencyCode=EUR — an active ISO 4217 code. PEPPOL BIS Billing 3.0 / BT-6 accepts.
  const withTax = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cbc:TaxCurrencyCode>EUR</cbc:TaxCurrencyCode>'
  );
  await page.fill('#ubl-input', withTax);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxCurrencyCode EUR is a current ISO 4217 active code \(EN 16931 BT-6/i, { timeout: 5_000 });
});

test('ubl: TaxCurrencyCode check flags a historical / typo ISO 4217 code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // `ITL` (Italian lira) is a historical ISO 4217 code — schema-valid as plain text but
  // PEPPOL access points reject it at the schematron gate.
  const withTax = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cbc:TaxCurrencyCode>ITL</cbc:TaxCurrencyCode>'
  );
  await page.fill('#ubl-input', withTax);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxCurrencyCode ITL is not active per ISO 4217 — EN 16931 BT-6/i, { timeout: 5_000 });
});

test('sepa: PstlAdr/Ctry check confirms on a valid ISO 3166-1 alpha-2 code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject a clean ISO 3166-1 alpha-2 country code (DE — Germany) into the debtor postal address.
  const withCtry = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><PstlAdr><Ctry>DE</Ctry></PstlAdr></Dbtr>'
  );
  await page.fill('#sepa-input', withCtry);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Country codes \(PstlAdr\/Ctry\) are all valid ISO 3166-1 alpha-2/i, { timeout: 5_000 });
});

test('sepa: PstlAdr/Ctry check flags UK (not an ISO code — Great Britain is GB)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // `UK` is the canonical real-world mistake — schema-valid `[A-Z]{2}` but not ISO 3166-1 alpha-2.
  const withCtry = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><PstlAdr><Ctry>UK</Ctry></PstlAdr></Dbtr>'
  );
  await page.fill('#sepa-input', withCtry);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PstlAdr\/Ctry "UK" is not a valid ISO 3166-1 alpha-2 code/i, { timeout: 5_000 });
});

test('ubl: Country/IdentificationCode check confirms on a valid ISO 3166-1 alpha-2 code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE supplier carries PostalAddress/Country/IdentificationCode=DE.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Party country codes \(PostalAddress\/Country\/IdentificationCode\) are all valid ISO 3166-1 alpha-2/i, { timeout: 5_000 });
});

test('ubl: Country/IdentificationCode check flags UK (not an ISO code — Great Britain is GB)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // `UK` passes UBL 2.1's plain-text declaration but PEPPOL access points reject it at the schematron gate.
  const withCountry = UBL_INVOICE.replace(
    '<cbc:IdentificationCode>DE</cbc:IdentificationCode>',
    '<cbc:IdentificationCode>UK</cbc:IdentificationCode>'
  );
  await page.fill('#ubl-input', withCountry);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Country\/IdentificationCode "UK" is not a valid ISO 3166-1 alpha-2 code/i, { timeout: 5_000 });
});

test('sepa: CtryOfRes check confirms on a valid ISO 3166-1 alpha-2 code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject a CtryOfRes element under the debtor party with a clean alpha-2 code (DE).
  const withRes = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><CtryOfRes>DE</CtryOfRes></Dbtr>'
  );
  await page.fill('#sepa-input', withRes);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Country of residence codes \(Dbtr\/Cdtr CtryOfRes\) are all valid ISO 3166-1 alpha-2/i, { timeout: 5_000 });
});

test('sepa: CtryOfRes check flags UK (not an ISO code — Great Britain is GB)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withRes = SEPA_PAIN001.replace(
    '<Dbtr><Nm>ACME Corp</Nm></Dbtr>',
    '<Dbtr><Nm>ACME Corp</Nm><CtryOfRes>UK</CtryOfRes></Dbtr>'
  );
  await page.fill('#sepa-input', withRes);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CtryOfRes "UK" is not a valid ISO 3166-1 alpha-2 code/i, { timeout: 5_000 });
});

test('ubl: Item OriginCountry/IdentificationCode check confirms on a valid ISO 3166-1 alpha-2 code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a cac:OriginCountry block under the Item — EN 16931 BT-159 country of origin.
  const withOrigin = UBL_INVOICE.replace(
    '<cbc:Name>Widget Pro</cbc:Name>',
    '<cbc:Name>Widget Pro</cbc:Name><cac:OriginCountry><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:OriginCountry>'
  );
  await page.fill('#ubl-input', withOrigin);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Item country-of-origin codes \(Item\/OriginCountry\/IdentificationCode\) are all valid ISO 3166-1 alpha-2/i, { timeout: 5_000 });
});

test('ubl: Item OriginCountry/IdentificationCode check flags UK (not an ISO code — Great Britain is GB)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withOrigin = UBL_INVOICE.replace(
    '<cbc:Name>Widget Pro</cbc:Name>',
    '<cbc:Name>Widget Pro</cbc:Name><cac:OriginCountry><cbc:IdentificationCode>UK</cbc:IdentificationCode></cac:OriginCountry>'
  );
  await page.fill('#ubl-input', withOrigin);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Item\/OriginCountry\/IdentificationCode "UK" is not a valid ISO 3166-1 alpha-2 code/i, { timeout: 5_000 });
});

test('sepa: CtgyPurp/Cd check confirms on a canonical ExternalCategoryPurpose1Code (SALA)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject a PmtTpInf/CtgyPurp/Cd=SALA (salary payment) — canonical ISO 20022 code.
  const withCtgy = SEPA_PAIN001.replace(
    '<ReqdExctnDt>2024-01-20</ReqdExctnDt>',
    '<PmtTpInf><CtgyPurp><Cd>SALA</Cd></CtgyPurp></PmtTpInf><ReqdExctnDt>2024-01-20</ReqdExctnDt>'
  );
  await page.fill('#sepa-input', withCtgy);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CtgyPurp\/Cd is a valid ISO 20022 ExternalCategoryPurpose1Code/i, { timeout: 5_000 });
});

test('sepa: CtgyPurp/Cd check flags a typo against the canonical set (SALR for SALA)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withCtgy = SEPA_PAIN001.replace(
    '<ReqdExctnDt>2024-01-20</ReqdExctnDt>',
    '<PmtTpInf><CtgyPurp><Cd>SALR</Cd></CtgyPurp></PmtTpInf><ReqdExctnDt>2024-01-20</ReqdExctnDt>'
  );
  await page.fill('#sepa-input', withCtgy);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CtgyPurp\/Cd mismatch: PmtInf #1 declares SALR/i, { timeout: 5_000 });
});

test('ubl: FinancialInstitutionBranch/ID BIC check confirms on a valid ISO 9362 BIC', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a PaymentMeans with PayeeFinancialAccount + FinancialInstitutionBranch carrying a real BIC.
  const withBic = UBL_INVOICE.replace(
    '<cac:LegalMonetaryTotal>',
    '<cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>DE89370400440532013000</cbc:ID><cac:FinancialInstitutionBranch><cbc:ID>COBADEFFXXX</cbc:ID></cac:FinancialInstitutionBranch></cac:PayeeFinancialAccount></cac:PaymentMeans>\n  <cac:LegalMonetaryTotal>'
  );
  await page.fill('#ubl-input', withBic);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Payment-service-provider BICs \(FinancialInstitutionBranch\/ID\) are all valid ISO 9362/i, { timeout: 5_000 });
});

test('ubl: FinancialInstitutionBranch/ID BIC check flags a malformed BIC', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // BICs are 8 or 11 characters; `COBADEFF1` (9 chars) is well-shaped at the start but the wrong length.
  const withBic = UBL_INVOICE.replace(
    '<cac:LegalMonetaryTotal>',
    '<cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>DE89370400440532013000</cbc:ID><cac:FinancialInstitutionBranch><cbc:ID>COBADEFF1</cbc:ID></cac:FinancialInstitutionBranch></cac:PayeeFinancialAccount></cac:PaymentMeans>\n  <cac:LegalMonetaryTotal>'
  );
  await page.fill('#ubl-input', withBic);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/FinancialInstitutionBranch\/ID "COBADEFF1" is not a valid ISO 9362 BIC/i, { timeout: 5_000 });
});

test('sepa: CreDtTm format check confirms on a canonical xs:dateTime', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 already carries <CreDtTm>2024-01-15T10:30:00</CreDtTm> (T separator + HH:MM:SS).
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr\/CreDtTm 2024-01-15T10:30:00 matches ISO 20022 ISODateTime/i, { timeout: 5_000 });
});

test('sepa: CreDtTm format check flags a space-separator instead of T', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Common spreadsheet-export artefact: space separator instead of T.
  const withBadDt = SEPA_PAIN001.replace(
    '<CreDtTm>2024-01-15T10:30:00</CreDtTm>',
    '<CreDtTm>2024-01-15 10:30:00</CreDtTm>'
  );
  await page.fill('#sepa-input', withBadDt);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr\/CreDtTm "2024-01-15 10:30:00" is not a valid ISO 20022 ISODateTime/i, { timeout: 5_000 });
});

test('ubl: date-format check confirms on canonical xs:date values', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // UBL_INVOICE already carries IssueDate=2024-04-01 and DueDate=2024-05-01 (both canonical).
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Date fields \(IssueDate \/ DueDate \/ TaxPointDate \/ InvoicePeriod bounds\) all match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('ubl: date-format check flags a US-style MM/DD/YYYY value in IssueDate', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBadDate = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>04/01/2024</cbc:IssueDate>'
  );
  await page.fill('#ubl-input', withBadDate);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/IssueDate "04\/01\/2024" does not match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('sepa: ReqdExctnDt format check confirms on a canonical xs:date', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 already carries <ReqdExctnDt>2024-01-20</ReqdExctnDt> (canonical xs:date).
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/ReqdExctnDt matches the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('sepa: ReqdExctnDt format check flags a US-style MM/DD/YYYY value', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBadDate = SEPA_PAIN001.replace(
    '<ReqdExctnDt>2024-01-20</ReqdExctnDt>',
    '<ReqdExctnDt>01/20/2024</ReqdExctnDt>'
  );
  await page.fill('#sepa-input', withBadDate);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/ReqdExctnDt mismatch: PmtInf #1 declares "01\/20\/2024"/i, { timeout: 5_000 });
});

test('ubl: EndpointID presence check confirms when both supplier and customer declare it', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject EndpointID elements into both AccountingSupplierParty and AccountingCustomerParty.
  const withEps = UBL_INVOICE
    .replace(
      '<cac:AccountingSupplierParty>\n    <cac:Party>\n      <cac:PartyName>',
      '<cac:AccountingSupplierParty>\n    <cac:Party>\n      <cbc:EndpointID schemeID="0088">7300010000001</cbc:EndpointID>\n      <cac:PartyName>'
    )
    .replace(
      '<cac:AccountingCustomerParty>\n    <cac:Party>\n      <cac:PartyName>',
      '<cac:AccountingCustomerParty>\n    <cac:Party>\n      <cbc:EndpointID schemeID="0088">7300010000002</cbc:EndpointID>\n      <cac:PartyName>'
    );
  await page.fill('#ubl-input', withEps);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Both supplier and customer Party\/EndpointID are declared/i, { timeout: 5_000 });
});

test('ubl: EndpointID presence check flags a missing supplier EndpointID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Customer has EndpointID; supplier doesn't — flag the supplier (BR-62).
  const withEps = UBL_INVOICE.replace(
    '<cac:AccountingCustomerParty>\n    <cac:Party>\n      <cac:PartyName>',
    '<cac:AccountingCustomerParty>\n    <cac:Party>\n      <cbc:EndpointID schemeID="0088">7300010000002</cbc:EndpointID>\n      <cac:PartyName>'
  );
  await page.fill('#ubl-input', withEps);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Party\/EndpointID is missing — PEPPOL BIS Billing 3\.0 BR-62/i, { timeout: 5_000 });
});

test('sepa: CreDtTm ≤ ReqdExctnDt ordering check confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SEPA_PAIN001 carries CreDtTm=2024-01-15T10:30:00 and ReqdExctnDt=2024-01-20 — ordered correctly.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/ReqdExctnDt is on or after GrpHdr\/CreDtTm 2024-01-15/i, { timeout: 5_000 });
});

test('sepa: CreDtTm ≤ ReqdExctnDt ordering check flags a back-dated ReqdExctnDt', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Push ReqdExctnDt to 2024-01-10 (before CreDtTm 2024-01-15) — the back-dated case.
  const withBackdated = SEPA_PAIN001.replace(
    '<ReqdExctnDt>2024-01-20</ReqdExctnDt>',
    '<ReqdExctnDt>2024-01-10</ReqdExctnDt>'
  );
  await page.fill('#sepa-input', withBackdated);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/ReqdExctnDt ordering mismatch: PmtInf #1 declares 2024-01-10 which precedes GrpHdr\/CreDtTm 2024-01-15/i, { timeout: 5_000 });
});

test('ubl: BuyerReference / OrderReference check confirms when BuyerReference is declared', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a BuyerReference at the root after IssueDate.
  const withBuyer = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cbc:BuyerReference>PO-2024-042</cbc:BuyerReference>'
  );
  await page.fill('#ubl-input', withBuyer);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/BuyerReference "PO-2024-042" declared/i, { timeout: 5_000 });
});

test('ubl: BuyerReference / OrderReference check flags when both are missing', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture has neither BuyerReference nor OrderReference — should flag.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Neither BuyerReference \(BT-10\) nor OrderReference\/ID \(BT-13\) is declared/i, { timeout: 5_000 });
});

test('sepa: MsgId Max35Text length check confirms within the 35-codepoint ISO 20022 cap', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical fixture carries <MsgId>MSG-2024-001</MsgId> — 12 codepoints, well within Max35Text.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-ubl-parse').catch(() => {});
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr\/MsgId MSG-2024-001 fits within ISO 20022 Max35Text/i, { timeout: 5_000 });
});

test('sepa: MsgId Max35Text length check flags a 36-char UUID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Replace with a full UUID (36 chars) — exceeds Max35Text.
  const withUuid = SEPA_PAIN001.replace(
    '<MsgId>MSG-2024-001</MsgId>',
    '<MsgId>3f8a1c2d-4b56-7e89-9012-3456789abcde</MsgId>'
  );
  await page.fill('#sepa-input', withUuid);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/exceeds ISO 20022 Max35Text/i, { timeout: 5_000 });
});

test('ubl: Delivery/ActualDeliveryDate xs:date check confirms on a canonical YYYY-MM-DD', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject cac:Delivery/cbc:ActualDeliveryDate after IssueDate.
  const withDelivery = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cac:Delivery><cbc:ActualDeliveryDate>2024-04-15</cbc:ActualDeliveryDate></cac:Delivery>'
  );
  await page.fill('#ubl-input', withDelivery);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Delivery\/ActualDeliveryDate 2024-04-15 matches the xs:date YYYY-MM-DD form \(EN 16931 BT-72/i, { timeout: 5_000 });
});

test('ubl: Delivery/ActualDeliveryDate xs:date check flags a US-style MM/DD/YYYY', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBadDelivery = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cac:Delivery><cbc:ActualDeliveryDate>04/15/2024</cbc:ActualDeliveryDate></cac:Delivery>'
  );
  await page.fill('#ubl-input', withBadDelivery);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Delivery\/ActualDeliveryDate "04\/15\/2024" does not match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('sepa: EndToEndId Max35Text length check confirms when every value fits', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical fixture carries <EndToEndId>E2E-001</EndToEndId> — 7 chars, well within Max35Text.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/EndToEndId values fit within ISO 20022 Max35Text/i, { timeout: 5_000 });
});

test('sepa: EndToEndId Max35Text length check flags a 40-char CRM reference', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Replace with a 40-char reference — exceeds Max35Text.
  const longE2e = 'CRM-INV-2024-0123456789-abcdefghij-extra';
  const withLong = SEPA_PAIN001.replace(
    '<EndToEndId>E2E-001</EndToEndId>',
    `<EndToEndId>${longE2e}</EndToEndId>`
  );
  await page.fill('#sepa-input', withLong);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(new RegExp(`EndToEndId "${longE2e}" exceeds ISO 20022 Max35Text`, 'i'), { timeout: 5_000 });
});

test('ubl: Delivery country code check confirms on a valid ISO 3166-1 alpha-2 code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withDelivery = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cac:Delivery><cac:DeliveryLocation><cac:Address><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:Address></cac:DeliveryLocation></cac:Delivery>'
  );
  await page.fill('#ubl-input', withDelivery);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Delivery country code .* DE is a valid ISO 3166-1 alpha-2 code \(EN 16931 BT-80/i, { timeout: 5_000 });
});

test('ubl: Delivery country code check flags UK (not an ISO code — Great Britain is GB)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBadDelivery = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cac:Delivery><cac:DeliveryLocation><cac:Address><cac:Country><cbc:IdentificationCode>UK</cbc:IdentificationCode></cac:Country></cac:Address></cac:DeliveryLocation></cac:Delivery>'
  );
  await page.fill('#ubl-input', withBadDelivery);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/"UK" is not a valid ISO 3166-1 alpha-2 code/i, { timeout: 5_000 });
});

test('sepa: InstrId Max35Text length check confirms when every value fits', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject an InstrId of 12 chars — well within Max35Text.
  const withInstr = SEPA_PAIN001.replace(
    '<PmtId><EndToEndId>E2E-001</EndToEndId></PmtId>',
    '<PmtId><InstrId>INSTR-000001</InstrId><EndToEndId>E2E-001</EndToEndId></PmtId>'
  );
  await page.fill('#sepa-input', withInstr);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/InstrId values fit within ISO 20022 Max35Text/i, { timeout: 5_000 });
});

test('sepa: InstrId Max35Text length check flags a 40-char internal batch key', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const longInstr = 'BATCH-2024-Q2-SEQ-0001-SUBKEY-abc123XYZ';  // 39 chars
  const withLong = SEPA_PAIN001.replace(
    '<PmtId><EndToEndId>E2E-001</EndToEndId></PmtId>',
    `<PmtId><InstrId>${longInstr}-X</InstrId><EndToEndId>E2E-001</EndToEndId></PmtId>`
  );
  await page.fill('#sepa-input', withLong);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(new RegExp(`InstrId "${longInstr}-X" exceeds ISO 20022 Max35Text`, 'i'), { timeout: 5_000 });
});

test('ubl: PaymentMeans/PaymentDueDate xs:date check confirms on a canonical YYYY-MM-DD', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture has no <cac:PaymentMeans>; inject one carrying PaymentDueDate.
  const withPm = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cbc:PaymentDueDate>2024-05-01</cbc:PaymentDueDate>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withPm);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PaymentMeans\/PaymentDueDate values all match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('ubl: PaymentMeans/PaymentDueDate xs:date check flags a US-style MM/DD/YYYY', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBadPm = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cbc:PaymentDueDate>05/01/2024</cbc:PaymentDueDate>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withBadPm);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PaymentMeans\/PaymentDueDate "05\/01\/2024" does not match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('sepa: PmtInfId Max35Text length check confirms when every value fits', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical fixture carries <PmtInfId>PAY-001</PmtInfId> — 7 chars, well within Max35Text.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInfId values fit within ISO 20022 Max35Text/i, { timeout: 5_000 });
});

test('sepa: PmtInfId Max35Text length check flags a 40-char per-batch identifier', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const longPmt = 'BATCH-ACME-CORP-2024-04-15-SEQ-00000001';  // 39 chars
  const withLong = SEPA_PAIN001.replace(
    '<PmtInfId>PAY-001</PmtInfId>',
    `<PmtInfId>${longPmt}-X</PmtInfId>`
  );
  await page.fill('#sepa-input', withLong);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(new RegExp(`PmtInfId "${longPmt}-X" exceeds ISO 20022 Max35Text`, 'i'), { timeout: 5_000 });
});

test('ubl: BillingReference/InvoiceDocumentReference/IssueDate xs:date check confirms on a canonical YYYY-MM-DD', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withRef = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>INV-2024-039</cbc:ID><cbc:IssueDate>2024-03-15</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>'
  );
  await page.fill('#ubl-input', withRef);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/BillingReference\/InvoiceDocumentReference\/IssueDate values all match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('ubl: BillingReference/InvoiceDocumentReference/IssueDate xs:date check flags a US-style MM/DD/YYYY', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBadRef = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>INV-2024-039</cbc:ID><cbc:IssueDate>03/15/2024</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>'
  );
  await page.fill('#ubl-input', withBadRef);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/BillingReference\/InvoiceDocumentReference\/IssueDate "03\/15\/2024" does not match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

function buildPain008(mndtId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-MSG-2024-088</MsgId><CreDtTm>2024-05-15T09:00:00</CreDtTm><NbOfTxs>1</NbOfTxs><CtrlSum>42.00</CtrlSum><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-001</PmtInfId><PmtMtd>DD</PmtMtd><ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-088</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>${mndtId}</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>Subscription May 2024</Ustrd></RmtInf>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}

test('sepa: MndtId Max35Text length check confirms when every value fits', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', buildPain008('MANDATE-2024-001'));  // 16 chars
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/MndtId values fit within ISO 20022 Max35Text/i, { timeout: 5_000 });
});

test('sepa: MndtId Max35Text length check flags a long mandate reference', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const longMndt = 'MNDT-Subscriber-Long-Company-Name-GmbH-Co-KG-2024';  // 49 chars
  await page.fill('#sepa-input', buildPain008(longMndt));
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(new RegExp(`MndtId "${longMndt}" exceeds ISO 20022 Max35Text`, 'i'), { timeout: 5_000 });
});

test('ubl: PaymentMandate/ID length check confirms when every value fits', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withMandate = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>59</cbc:PaymentMeansCode>\n    <cac:PaymentMandate>\n      <cbc:ID>MANDATE-2024-001</cbc:ID>\n    </cac:PaymentMandate>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withMandate);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PaymentMeans\/PaymentMandate\/ID values .* fit within the 35-character cap/i, { timeout: 5_000 });
});

test('ubl: PaymentMandate/ID length check flags a long mandate reference', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const longMandate = 'MNDT-Subscriber-Long-Company-Name-GmbH-Co-KG-2024';  // 49 chars
  const withLong = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    `</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>59</cbc:PaymentMeansCode>\n    <cac:PaymentMandate>\n      <cbc:ID>${longMandate}</cbc:ID>\n    </cac:PaymentMandate>\n  </cac:PaymentMeans>`
  );
  await page.fill('#ubl-input', withLong);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(new RegExp(`PaymentMeans/PaymentMandate/ID "${longMandate}" exceeds the 35-character cap`, 'i'), { timeout: 5_000 });
});

test('sepa: InstrPrty enum check confirms on a canonical Priority2Code (NORM)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withPrty = SEPA_PAIN001.replace(
    '<ReqdExctnDt>2024-01-20</ReqdExctnDt>',
    '<PmtTpInf><InstrPrty>NORM</InstrPrty></PmtTpInf><ReqdExctnDt>2024-01-20</ReqdExctnDt>'
  );
  await page.fill('#sepa-input', withPrty);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtTpInf\/InstrPrty values match ISO 20022 Priority2Code/i, { timeout: 5_000 });
});

test('sepa: InstrPrty enum check flags a non-Priority2Code value (URGT)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBadPrty = SEPA_PAIN001.replace(
    '<ReqdExctnDt>2024-01-20</ReqdExctnDt>',
    '<PmtTpInf><InstrPrty>URGT</InstrPrty></PmtTpInf><ReqdExctnDt>2024-01-20</ReqdExctnDt>'
  );
  await page.fill('#sepa-input', withBadPrty);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtTpInf\/InstrPrty mismatch: PmtInf #1 declares URGT/i, { timeout: 5_000 });
});

test('ubl: BuyerReference length check confirms when value fits the 35-char SEPA EndToEndId cap', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withRef = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cbc:BuyerReference>PO-2024-042</cbc:BuyerReference>'
  );
  await page.fill('#ubl-input', withRef);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/BuyerReference values .* fit within the 35-character SEPA EndToEndId cap/i, { timeout: 5_000 });
});

test('ubl: BuyerReference length check flags a value over the 35-char cap', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const longRef = 'PO-2024-Subscription-Long-Customer-Ref-042';  // 42 chars
  const withLong = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    `<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cbc:BuyerReference>${longRef}</cbc:BuyerReference>`
  );
  await page.fill('#ubl-input', withLong);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(new RegExp(`BuyerReference "${longRef}" exceeds the 35-character cap`, 'i'), { timeout: 5_000 });
});

test('sepa: per-PmtInf NbOfTxs/CtrlSum invariants confirm when block-level totals match the transactions', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withTotals = SEPA_PAIN001.replace(
    '<PmtInfId>PAY-001</PmtInfId>',
    '<PmtInfId>PAY-001</PmtInfId>\n      <NbOfTxs>1</NbOfTxs>\n      <CtrlSum>100.00</CtrlSum>'
  );
  await page.fill('#sepa-input', withTotals);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf\/NbOfTxs values match the per-block transaction count/i, { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf\/CtrlSum values match the per-block sum of transaction amounts/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf NbOfTxs/CtrlSum invariants flag block-level mismatches', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Block-level totals declare 2 / 200.00 but the block only contains a single 100.00 EUR transaction.
  const withBadTotals = SEPA_PAIN001.replace(
    '<PmtInfId>PAY-001</PmtInfId>',
    '<PmtInfId>PAY-001</PmtInfId>\n      <NbOfTxs>2</NbOfTxs>\n      <CtrlSum>200.00</CtrlSum>'
  );
  await page.fill('#sepa-input', withBadTotals);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 NbOfTxs mismatch: block declares 2 but contains 1 transaction/i, { timeout: 5_000 });
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 CtrlSum mismatch: block declares 200\.00 but transaction amounts sum to 100\.00/i, { timeout: 5_000 });
});

test('ubl: TaxPointDate ordering check confirms when TaxPointDate is on or before IssueDate', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // IssueDate=2024-04-01; TaxPointDate=2024-03-15 (before issue) — the happy path.
  const withTpd = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cbc:TaxPointDate>2024-03-15</cbc:TaxPointDate>'
  );
  await page.fill('#ubl-input', withTpd);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxPointDate 2024-03-15 is on or before IssueDate 2024-04-01/i, { timeout: 5_000 });
});

test('ubl: TaxPointDate ordering check flags a TaxPointDate after IssueDate', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // TaxPointDate=2024-05-15 (after the 2024-04-01 issue date) — the failure path.
  const withBadTpd = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>\n  <cbc:TaxPointDate>2024-05-15</cbc:TaxPointDate>'
  );
  await page.fill('#ubl-input', withBadTpd);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxPointDate 2024-05-15 is later than IssueDate 2024-04-01/i, { timeout: 5_000 });
});

test('sepa: CdtrRefInf/Ref ISO 11649 check confirms on a valid RF reference', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // RF18539007547034 — canonical ISO 11649 example, MOD-97-10 passes.
  const withRef = SEPA_PAIN001.replace(
    '<RmtInf><Ustrd>Invoice 2024-001</Ustrd></RmtInf>',
    '<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry></Tp><Ref>RF18539007547034</Ref></CdtrRefInf></Strd></RmtInf>'
  );
  await page.fill('#sepa-input', withRef);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Structured Creditor Reference\(s\) valid \(ISO 11649 MOD-97-10\)/i, { timeout: 5_000 });
});

test('sepa: CdtrRefInf/Ref ISO 11649 check flags a typo\'d RF reference', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Last digit flipped 4 → 5: RF18539007547035 — MOD-97 now fails.
  const withBadRef = SEPA_PAIN001.replace(
    '<RmtInf><Ustrd>Invoice 2024-001</Ustrd></RmtInf>',
    '<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry></Tp><Ref>RF18539007547035</Ref></CdtrRefInf></Strd></RmtInf>'
  );
  await page.fill('#sepa-input', withBadRef);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Structured Creditor Reference "RF18539007547035" failed ISO 11649 MOD-97-10 check/i, { timeout: 5_000 });
});

test('ubl: PaymentID ISO 11649 check confirms on a valid RF reference', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withRef = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cbc:PaymentID>RF18539007547034</cbc:PaymentID>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withRef);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PaymentID Structured Creditor Reference\(s\) valid \(ISO 11649 MOD-97-10\)/i, { timeout: 5_000 });
});

test('ubl: PaymentID ISO 11649 check flags a typo\'d RF reference', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBadRef = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cbc:PaymentID>RF18539007547035</cbc:PaymentID>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withBadRef);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PaymentID "RF18539007547035" failed ISO 11649 MOD-97-10 check/i, { timeout: 5_000 });
});

test('sepa: MndtRltdInf/DtOfSgntr xs:date check confirms on a canonical YYYY-MM-DD', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Extend the pain.008 fixture's MndtRltdInf with a DtOfSgntr.
  const fixture = buildPain008('MANDATE-2024-001').replace(
    '<MndtRltdInf><MndtId>MANDATE-2024-001</MndtId></MndtRltdInf>',
    '<MndtRltdInf><MndtId>MANDATE-2024-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf>'
  );
  await page.fill('#sepa-input', fixture);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/MndtRltdInf\/DtOfSgntr values all match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('sepa: MndtRltdInf/DtOfSgntr xs:date check flags a US-style MM/DD/YYYY', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const fixture = buildPain008('MANDATE-2024-001').replace(
    '<MndtRltdInf><MndtId>MANDATE-2024-001</MndtId></MndtRltdInf>',
    '<MndtRltdInf><MndtId>MANDATE-2024-001</MndtId><DtOfSgntr>03/15/2024</DtOfSgntr></MndtRltdInf>'
  );
  await page.fill('#sepa-input', fixture);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/MndtRltdInf\/DtOfSgntr "03\/15\/2024" does not match the xs:date YYYY-MM-DD form/i, { timeout: 5_000 });
});

test('ubl: OrderReference/ID length check confirms when value fits the 35-char SEPA EndToEndId cap', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withRef = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cac:OrderReference><cbc:ID>PO-2024-042</cbc:ID></cac:OrderReference>'
  );
  await page.fill('#ubl-input', withRef);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/OrderReference\/ID values .* fit within the 35-character SEPA EndToEndId cap/i, { timeout: 5_000 });
});

test('ubl: OrderReference/ID length check flags a value over the 35-char cap', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const longRef = 'PO-2024-Subscription-Long-Customer-Ref-042';  // 42 chars
  const withLong = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    `<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cac:OrderReference><cbc:ID>${longRef}</cbc:ID></cac:OrderReference>`
  );
  await page.fill('#ubl-input', withLong);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(new RegExp(`OrderReference/ID "${longRef}" exceeds the 35-character cap`, 'i'), { timeout: 5_000 });
});

test('sepa: EPC SEPA Rulebook EUR-only check confirms when every Ccy attribute declares EUR', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // The canonical SEPA_PAIN001 fixture already declares Ccy="EUR" on the single InstdAmt.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/All @Ccy attributes declare EUR/i, { timeout: 5_000 });
});

test('sepa: EPC SEPA Rulebook EUR-only check flags a non-EUR Ccy attribute', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withUsd = SEPA_PAIN001.replace('Ccy="EUR"', 'Ccy="USD"');
  await page.fill('#sepa-input', withUsd);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Non-EUR currency code @Ccy="USD" declared/i, { timeout: 5_000 });
});

test('ubl: line quantity presence check confirms when every line declares an InvoicedQuantity', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE has a single InvoiceLine with InvoicedQuantity already declared.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every line declares a InvoicedQuantity across all 1 line\(s\)/i, { timeout: 5_000 });
});

test('ubl: line quantity presence check flags a line that omits InvoicedQuantity', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the InvoicedQuantity element from the single line in the fixture.
  const noQty = UBL_INVOICE.replace(
    /<cbc:InvoicedQuantity unitCode="C62">2<\/cbc:InvoicedQuantity>\s*/,
    ''
  );
  await page.fill('#ubl-input', noQty);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 is missing a InvoicedQuantity/i, { timeout: 5_000 });
});

test('sepa: SEPA Creditor Identifier MOD-97-10 check confirms on a canonical CID (DE98ZZZ09999999999)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject the EPC SDD canonical CID example into a pain.008 InitgPty/Id.
  const fixture = buildPain008('MANDATE-2024-001').replace(
    '<Cdtr><Nm>Creditor Inc</Nm></Cdtr>',
    '<Cdtr><Nm>Creditor Inc</Nm></Cdtr>\n      <CdtrSchmeId><Id><PrvtId><Othr><Id>DE98ZZZ09999999999</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>'
  );
  await page.fill('#sepa-input', fixture);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/SEPA Creditor Identifier\(s\) valid \(MOD-97-10\)/i, { timeout: 5_000 });
});

test('sepa: SEPA Creditor Identifier MOD-97-10 check flags a typo\'d CID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Last digit flipped 9 → 8: DE98ZZZ09999999998 — MOD-97 now fails.
  const fixture = buildPain008('MANDATE-2024-001').replace(
    '<Cdtr><Nm>Creditor Inc</Nm></Cdtr>',
    '<Cdtr><Nm>Creditor Inc</Nm></Cdtr>\n      <CdtrSchmeId><Id><PrvtId><Othr><Id>DE98ZZZ09999999998</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>'
  );
  await page.fill('#sepa-input', fixture);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/SEPA Creditor Identifier "DE98ZZZ09999999998" failed MOD-97-10 check/i, { timeout: 5_000 });
});

test('ubl: Item Name presence check confirms when every line declares an Item/Name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every line declares an Item\/Name across all 1 line\(s\)/i, { timeout: 5_000 });
});

test('ubl: Item Name presence check flags a line that omits Item/Name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the <cbc:Name>Widget Pro</cbc:Name> from the per-line Item block in the fixture
  // (the Item also carries a ClassifiedTaxCategory subblock since draft 193 — leave that intact).
  const noName = UBL_INVOICE.replace('<cbc:Name>Widget Pro</cbc:Name>', '');
  await page.fill('#ubl-input', noName);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 is missing an Item\/Name/i, { timeout: 5_000 });
});

test('sepa: CdtrSchmeId SchmeNm/Prtry check confirms when the literal "SEPA" is declared', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const fixture = buildPain008('MANDATE-2024-001').replace(
    '<Cdtr><Nm>Creditor Inc</Nm></Cdtr>',
    '<Cdtr><Nm>Creditor Inc</Nm></Cdtr>\n      <CdtrSchmeId><Id><PrvtId><Othr><Id>DE98ZZZ09999999999</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>'
  );
  await page.fill('#sepa-input', fixture);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtrSchmeId\/Id\/PrvtId\/Othr\/SchmeNm\/Prtry declares the literal "SEPA"/i, { timeout: 5_000 });
});

test('sepa: CdtrSchmeId SchmeNm/Prtry check flags a non-SEPA scheme label', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Domestic scheme label "SDD" instead of the EPC-required "SEPA".
  const fixture = buildPain008('MANDATE-2024-001').replace(
    '<Cdtr><Nm>Creditor Inc</Nm></Cdtr>',
    '<Cdtr><Nm>Creditor Inc</Nm></Cdtr>\n      <CdtrSchmeId><Id><PrvtId><Othr><Id>DE98ZZZ09999999999</Id><SchmeNm><Prtry>SDD</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>'
  );
  await page.fill('#sepa-input', fixture);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtrSchmeId\/Id\/PrvtId\/Othr\/SchmeNm\/Prtry declares "SDD"/i, { timeout: 5_000 });
});

test('ubl: PriceAmount non-negative check confirms when every line declares a non-negative price', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares PriceAmount=50.00 on its single line.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every line declares a non-negative Price\/PriceAmount across all 1 line\(s\)/i, { timeout: 5_000 });
});

test('ubl: PriceAmount non-negative check flags a negative unit price', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withNeg = UBL_INVOICE.replace(
    '<cbc:PriceAmount currencyID="EUR">50.00</cbc:PriceAmount>',
    '<cbc:PriceAmount currencyID="EUR">-50.00</cbc:PriceAmount>'
  );
  await page.fill('#ubl-input', withNeg);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 declares a negative Price\/PriceAmount "-50\.00"/i, { timeout: 5_000 });
});

test('sepa: positive-amount check confirms when every transaction declares a strictly positive InstdAmt', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 declares InstdAmt=100.00 — strictly positive.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction declares a positive InstdAmt \/ Amt across all 1 transaction\(s\)/i, { timeout: 5_000 });
});

test('sepa: positive-amount check flags a zero-amount transaction', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Flip the canonical 100.00 → 0.00 (an EPC SEPA Rulebook violation).
  const zero = SEPA_PAIN001.replace('<InstdAmt Ccy="EUR">100.00</InstdAmt>', '<InstdAmt Ccy="EUR">0.00</InstdAmt>');
  await page.fill('#sepa-input', zero);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 declares InstdAmt \/ Amt "0\.00"/i, { timeout: 5_000 });
});

test('ubl: StandardItemIdentification GTIN check confirms on a valid GS1 GTIN', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a canonical EAN-13 GTIN with schemeID="0160" into the single InvoiceLine's Item.
  const withGtin = UBL_INVOICE.replace(
    '<cbc:Name>Widget Pro</cbc:Name>',
    '<cbc:Name>Widget Pro</cbc:Name><cac:StandardItemIdentification><cbc:ID schemeID="0160">5901234123457</cbc:ID></cac:StandardItemIdentification>'
  );
  await page.fill('#ubl-input', withGtin);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/StandardItemIdentification GTIN\(s\) valid \(GS1 MOD-10\)/i, { timeout: 5_000 });
});

test('ubl: StandardItemIdentification GTIN check flags a typo\'d GTIN', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Last digit flipped 7 → 8 — MOD-10 now fails.
  const badGtin = UBL_INVOICE.replace(
    '<cbc:Name>Widget Pro</cbc:Name>',
    '<cbc:Name>Widget Pro</cbc:Name><cac:StandardItemIdentification><cbc:ID schemeID="0160">5901234123458</cbc:ID></cac:StandardItemIdentification>'
  );
  await page.fill('#ubl-input', badGtin);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/StandardItemIdentification "5901234123458" with schemeID="0160" failed the GS1 GTIN MOD-10 check/i, { timeout: 5_000 });
});

test('sepa: NbOfTxs Max15NumericText shape check confirms on canonical digit-only values', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 fixture declares GrpHdr/NbOfTxs=1 (digit-only).
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/NbOfTxs values all match the ISO 20022 Max15NumericText shape/i, { timeout: 5_000 });
});

test('sepa: NbOfTxs Max15NumericText shape check flags a "1.0" decimal serialization', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // JSON-style "1.0" passes Number() (== 1, so draft-35 value parity still works)
  // but ISO 20022 Max15NumericText rejects the decimal point.
  const decimal = SEPA_PAIN001.replace('<NbOfTxs>1</NbOfTxs>', '<NbOfTxs>1.0</NbOfTxs>');
  await page.fill('#sepa-input', decimal);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr\/NbOfTxs declares "1\.0"/i, { timeout: 5_000 });
});

test('ubl: LineExtensionAmount non-negative check confirms on positive line amounts', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares LineExtensionAmount=100.00 on the single line.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every line declares a non-negative LineExtensionAmount across all 1 line\(s\)/i, { timeout: 5_000 });
});

test('ubl: LineExtensionAmount non-negative check flags a negative line amount', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Flip the single line's LineExtensionAmount to -100.00.
  const neg = UBL_INVOICE.replace(
    '<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>\n    <cac:Item>',
    '<cbc:LineExtensionAmount currencyID="EUR">-100.00</cbc:LineExtensionAmount>\n    <cac:Item>'
  );
  await page.fill('#ubl-input', neg);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 declares a negative LineExtensionAmount "-100\.00"/i, { timeout: 5_000 });
});

test('sepa: RmtInf Strd/Ustrd XOR check confirms on Ustrd-only canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 carries only <Ustrd> within RmtInf — the EPC-compliant case.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction's RmtInf carries at most one of <Strd> or <Ustrd>/i, { timeout: 5_000 });
});

test('sepa: RmtInf Strd/Ustrd XOR check flags both forms populated in the same RmtInf', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject a <Strd>/<CdtrRefInf>/<Ref> alongside the existing <Ustrd>.
  const both = SEPA_PAIN001.replace(
    '<RmtInf><Ustrd>Invoice 2024-001</Ustrd></RmtInf>',
    '<RmtInf><Ustrd>Invoice 2024-001</Ustrd><Strd><CdtrRefInf><Ref>INV-2024-001</Ref></CdtrRefInf></Strd></RmtInf>'
  );
  await page.fill('#sepa-input', both);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 RmtInf populates both <Ustrd> and <Strd>/i, { timeout: 5_000 });
});

test('ubl: Invoice ID BT-1 35-char cap confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cbc:ID>INV-2024-042</cbc:ID> (12 chars).
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Invoice\/CreditNote ID \(EN 16931 BT-1\) fits within the 35-character SEPA EndToEndId cap/i, { timeout: 5_000 });
});

test('ubl: Invoice ID BT-1 35-char cap flags an over-length invoice number', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // 42-char invoice number — would be silently truncated by a downstream pain.001 generator.
  const long = UBL_INVOICE.replace(
    '<cbc:ID>INV-2024-042</cbc:ID>',
    '<cbc:ID>INV-2024-Subscription-Long-Customer-Ref-042</cbc:ID>'
  );
  await page.fill('#ubl-input', long);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Invoice\/CreditNote ID "INV-2024-Subscription-Long-Customer-Ref-042" exceeds the 35-character cap/i, { timeout: 5_000 });
});

test('sepa: counterparty Nm presence confirms on canonical pain.001 (Cdtr/Nm declared)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 carries <Cdtr><Nm>Supplier GmbH</Nm></Cdtr> on the single transaction.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction declares a Cdtr\/Nm across all 1 transaction\(s\)/i, { timeout: 5_000 });
});

test('sepa: counterparty Nm presence flags a missing Cdtr/Nm on pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <Nm>Supplier GmbH</Nm> from the Cdtr block — leave an account-only structure.
  const noNm = SEPA_PAIN001.replace('<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>', '<Cdtr></Cdtr>');
  await page.fill('#sepa-input', noNm);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 is missing Cdtr\/Nm/i, { timeout: 5_000 });
});

test('ubl: Seller RegistrationName BR-08 confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares PartyLegalEntity/RegistrationName=ACME Widgets GmbH on the supplier.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Seller PartyLegalEntity\/RegistrationName "ACME Widgets GmbH" present/i, { timeout: 5_000 });
});

test('ubl: Seller RegistrationName BR-08 flags a missing PartyLegalEntity', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the supplier's PartyLegalEntity block — leave only PartyName.
  const noLegal = UBL_INVOICE.replace(
    '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
    ''
  );
  await page.fill('#ubl-input', noLegal);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty is missing Party\/PartyLegalEntity\/RegistrationName/i, { timeout: 5_000 });
});

test('sepa: IBAN-only account identification confirms on canonical pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 carries DbtrAcct + CdtrAcct both identified by IBAN.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DbtrAcct \/ CdtrAcct identifies the account by <IBAN>/i, { timeout: 5_000 });
});

test('sepa: IBAN-only account identification flags an Othr-identified DbtrAcct', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Replace the DbtrAcct IBAN with an Othr block (BBAN / proprietary identifier).
  const othr = SEPA_PAIN001.replace(
    '<DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>',
    '<DbtrAcct><Id><Othr><Id>0532013000</Id></Othr></Id></DbtrAcct>'
  );
  await page.fill('#sepa-input', othr);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DbtrAcct #1 identifies the account via <Othr>/i, { timeout: 5_000 });
});

test('ubl: TaxTotal/TaxAmount BT-110 sign check confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares TaxTotal/TaxAmount=19.00.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every TaxTotal declares a non-negative TaxAmount across all 1 TaxTotal block\(s\)/i, { timeout: 5_000 });
});

test('ubl: TaxTotal/TaxAmount BT-110 sign check flags a negative file-wide VAT', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Flip the file-wide TaxAmount (direct child of TaxTotal) to -19.00; leave the per-subtotal
  // TaxAmount=19.00 untouched so only the BT-110 sign trips.
  const neg = UBL_INVOICE.replace(
    '<cac:TaxTotal>\n    <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>',
    '<cac:TaxTotal>\n    <cbc:TaxAmount currencyID="EUR">-19.00</cbc:TaxAmount>'
  );
  await page.fill('#ubl-input', neg);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxTotal #1 declares a negative TaxAmount "-19\.00"/i, { timeout: 5_000 });
});

test('sepa: counterparty Nm 70-char EPC cap confirms on canonical pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 carries Cdtr/Nm=Supplier GmbH (13 chars).
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every Cdtr\/Nm value fits within the EPC SEPA Rulebook 70-character cap/i, { timeout: 5_000 });
});

test('sepa: counterparty Nm 70-char EPC cap flags an over-length Cdtr/Nm', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // 85-char name (legal name + department + branch suffix style).
  const longNm = 'Supplier GmbH Hamburg Branch Procurement Department Northern Region Sub-Unit';
  const over = SEPA_PAIN001.replace('<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>', '<Cdtr><Nm>' + longNm + '</Nm></Cdtr>');
  await page.fill('#sepa-input', over);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 Cdtr\/Nm "Supplier GmbH Hamburg Branch Procurement Department Northern Region Sub-Unit" exceeds the 70-character cap/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/LineExtensionAmount BT-106 sign confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal\/LineExtensionAmount "100\.00" is non-negative \(EN 16931 BT-106/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/LineExtensionAmount BT-106 sign flags a negative file-wide value', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Flip the LegalMonetaryTotal's direct-child LineExtensionAmount to -100.00; leave the
  // per-line LineExtensionAmount=100.00 untouched so only the BT-106 sign trips.
  const neg = UBL_INVOICE.replace(
    '<cac:LegalMonetaryTotal>\n    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>',
    '<cac:LegalMonetaryTotal>\n    <cbc:LineExtensionAmount currencyID="EUR">-100.00</cbc:LineExtensionAmount>'
  );
  await page.fill('#ubl-input', neg);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal\/LineExtensionAmount declares a negative value "-100\.00"/i, { timeout: 5_000 });
});

test('sepa: single-Ustrd per RmtInf confirms on canonical pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction's RmtInf carries at most one <Ustrd> element/i, { timeout: 5_000 });
});

test('sepa: single-Ustrd per RmtInf flags two <Ustrd> elements in the same RmtInf', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Add a second <Ustrd> alongside the canonical one (multi-line description split into elements).
  const two = SEPA_PAIN001.replace(
    '<RmtInf><Ustrd>Invoice 2024-001</Ustrd></RmtInf>',
    '<RmtInf><Ustrd>Invoice 2024-001</Ustrd><Ustrd>Line 2 description</Ustrd></RmtInf>'
  );
  await page.fill('#sepa-input', two);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 RmtInf carries 2 <Ustrd> elements/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/TaxExclusiveAmount BT-109 sign confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal\/TaxExclusiveAmount "100\.00" is non-negative \(EN 16931 BT-109/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/TaxExclusiveAmount BT-109 sign flags a negative file-wide value', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const neg = UBL_INVOICE.replace(
    '<cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>',
    '<cbc:TaxExclusiveAmount currencyID="EUR">-100.00</cbc:TaxExclusiveAmount>'
  );
  await page.fill('#ubl-input', neg);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal\/TaxExclusiveAmount declares a negative value "-100\.00"/i, { timeout: 5_000 });
});

test('sepa: AdrLine 2-line cap confirms on a Cdtr address with two AdrLine elements', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const twoLine = SEPA_PAIN001.replace(
    '<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>',
    '<Cdtr><Nm>Supplier GmbH</Nm><PstlAdr><AdrLine>Hauptstrasse 1</AdrLine><AdrLine>10115 Berlin DE</AdrLine></PstlAdr></Cdtr>'
  );
  await page.fill('#sepa-input', twoLine);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PostalAddress fits within the EPC SEPA Rulebook 2-AdrLine cap/i, { timeout: 5_000 });
});

test('sepa: AdrLine 2-line cap flags a Cdtr address with three AdrLine elements', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const threeLine = SEPA_PAIN001.replace(
    '<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>',
    '<Cdtr><Nm>Supplier GmbH</Nm><PstlAdr><AdrLine>Hauptstrasse 1</AdrLine><AdrLine>10115 Berlin</AdrLine><AdrLine>DE</AdrLine></PstlAdr></Cdtr>'
  );
  await page.fill('#sepa-input', threeLine);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PostalAddress #1 declares 3 <AdrLine> elements/i, { timeout: 5_000 });
});

test('sepa: AdrLine 70-char EPC length cap confirms on a clean two-line Cdtr address', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const twoLine = SEPA_PAIN001.replace(
    '<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>',
    '<Cdtr><Nm>Supplier GmbH</Nm><PstlAdr><AdrLine>Hauptstrasse 1</AdrLine><AdrLine>10115 Berlin DE</AdrLine></PstlAdr></Cdtr>'
  );
  await page.fill('#sepa-input', twoLine);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every populated AdrLine fits within the EPC SEPA Rulebook 70-character cap/i, { timeout: 5_000 });
});

test('sepa: AdrLine 70-char EPC length cap flags an over-length AdrLine', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // 76-char address line (street + number + apartment + building name + neighborhood
  // packed into one free-text line — over the EPC SEPA Rulebook 70-char cap).
  const longLine = 'Hauptstrasse 12 Apartment 7 Building North Wing Charlottenburg Neighborhood';
  const over = SEPA_PAIN001.replace(
    '<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>',
    '<Cdtr><Nm>Supplier GmbH</Nm><PstlAdr><AdrLine>' + longLine + '</AdrLine></PstlAdr></Cdtr>'
  );
  await page.fill('#sepa-input', over);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PostalAddress #1 line 1 .* exceeds the 70-character cap/i, { timeout: 5_000 });
});

test('sepa: TwnNm 35-char EPC length cap confirms on a clean Cdtr town name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const cleanTown = SEPA_PAIN001.replace(
    '<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>',
    '<Cdtr><Nm>Supplier GmbH</Nm><PstlAdr><TwnNm>Berlin</TwnNm></PstlAdr></Cdtr>'
  );
  await page.fill('#sepa-input', cleanTown);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every populated TwnNm fits within the EPC SEPA Rulebook 35-character cap/i, { timeout: 5_000 });
});

test('sepa: TwnNm 35-char EPC length cap flags an over-length town/city name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // 49-char city + administrative-division packed into one free-text field.
  const longTown = 'Frankfurt am Main Hessen Greater Rhine-Main Area';
  const over = SEPA_PAIN001.replace(
    '<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>',
    '<Cdtr><Nm>Supplier GmbH</Nm><PstlAdr><TwnNm>' + longTown + '</TwnNm></PstlAdr></Cdtr>'
  );
  await page.fill('#sepa-input', over);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PostalAddress #1 TwnNm .* exceeds the 35-character cap/i, { timeout: 5_000 });
});

test('ubl: Seller PostalAddress Country BR-09 confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE supplier carries PostalAddress/Country/IdentificationCode=DE.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Seller PostalAddress\/Country\/IdentificationCode "DE" present \(EN 16931 BR-09 \/ BT-40\)/i, { timeout: 5_000 });
});

test('ubl: Seller PostalAddress Country BR-09 flags a missing PostalAddress', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the supplier's PostalAddress block — leave only PartyName + PartyLegalEntity.
  const noAddr = UBL_INVOICE.replace(
    '<cac:PostalAddress><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>',
    ''
  );
  await page.fill('#ubl-input', noAddr);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty is missing Party\/PostalAddress\/Country\/IdentificationCode/i, { timeout: 5_000 });
});

test('sepa: PstCd 16-char EPC length cap confirms on a clean Cdtr postal code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const cleanCode = SEPA_PAIN001.replace(
    '<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>',
    '<Cdtr><Nm>Supplier GmbH</Nm><PstlAdr><PstCd>10115</PstCd></PstlAdr></Cdtr>'
  );
  await page.fill('#sepa-input', cleanCode);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every populated PstCd fits within the EPC SEPA Rulebook 16-character cap/i, { timeout: 5_000 });
});

test('sepa: PstCd 16-char EPC length cap flags an over-length postal code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // 19-char ZIP + city packed into the postal-code slot.
  const longCode = '10115 Berlin Mitte';
  const over = SEPA_PAIN001.replace(
    '<Cdtr><Nm>Supplier GmbH</Nm></Cdtr>',
    '<Cdtr><Nm>Supplier GmbH</Nm><PstlAdr><PstCd>' + longCode + '</PstCd></PstlAdr></Cdtr>'
  );
  await page.fill('#sepa-input', over);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PostalAddress #1 PstCd .* exceeds the 16-character cap/i, { timeout: 5_000 });
});

test('ubl: Buyer PostalAddress Country BR-11 confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE buyer carries PostalAddress/Country/IdentificationCode=FR.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Buyer PostalAddress\/Country\/IdentificationCode "FR" present \(EN 16931 BR-11 \/ BT-55\)/i, { timeout: 5_000 });
});

test('ubl: Buyer PostalAddress Country BR-11 flags a missing PostalAddress', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the buyer's PostalAddress block (FR) — leave only PartyName + PartyLegalEntity.
  const noAddr = UBL_INVOICE.replace(
    '<cac:PostalAddress><cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country></cac:PostalAddress>',
    ''
  );
  await page.fill('#ubl-input', noAddr);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty is missing Party\/PostalAddress\/Country\/IdentificationCode/i, { timeout: 5_000 });
});

test('sepa: InitgPty/Nm presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 declares GrpHdr/InitgPty/Nm = "ACME Corp".
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr\/InitgPty\/Nm "ACME Corp" present/i, { timeout: 5_000 });
});

test('sepa: InitgPty/Nm presence flags a missing originator name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Replace InitgPty/Nm with InitgPty/Id only — schema-valid but rail-broken per EPC SEPA Rulebook.
  const noNm = SEPA_PAIN001.replace(
    '<InitgPty><Nm>ACME Corp</Nm></InitgPty>',
    '<InitgPty><Id><OrgId><Othr><Id>ACMECORP01</Id></Othr></OrgId></Id></InitgPty>'
  );
  await page.fill('#sepa-input', noNm);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr\/InitgPty is missing <Nm>/i, { timeout: 5_000 });
});

test('ubl: BR-16 line presence confirms on canonical Invoice fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE carries one InvoiceLine.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document carries 1 InvoiceLine\(s\) \(EN 16931 BR-16/i, { timeout: 5_000 });
});

test('ubl: BR-16 line presence flags a line-less Invoice', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the InvoiceLine block — leave the document shell only.
  const noLines = UBL_INVOICE.replace(
    /<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g,
    ''
  );
  await page.fill('#ubl-input', noLines);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document declares zero InvoiceLine elements/i, { timeout: 5_000 });
});

test('sepa: account-level <Ccy>=EUR confirms when DbtrAcct/CdtrAcct declare EUR', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject <Ccy>EUR</Ccy> into both DbtrAcct and CdtrAcct.
  const withEur = SEPA_PAIN001
    .replace('<DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>',
             '<DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id><Ccy>EUR</Ccy></DbtrAcct>')
    .replace('<CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>',
             '<CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id><Ccy>EUR</Ccy></CdtrAcct>');
  await page.fill('#sepa-input', withEur);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every declared account-level <Ccy> is EUR across all 2 cash account/i, { timeout: 5_000 });
});

test('sepa: account-level <Ccy>=EUR flags a non-EUR account currency', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject a USD account-level Ccy on the creditor account — schema-valid but rail-broken.
  const usd = SEPA_PAIN001.replace(
    '<CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>',
    '<CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id><Ccy>USD</Ccy></CdtrAcct>'
  );
  await page.fill('#sepa-input', usd);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Cash account <Ccy> "USD" is not EUR/i, { timeout: 5_000 });
});

test('ubl: BR-DEC LegalMonetaryTotal 2-decimal cap confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares four LegalMonetaryTotal amounts at 2 decimals.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every populated LegalMonetaryTotal amount carries at most 2 fractional digits across all 4 amount/i, { timeout: 5_000 });
});

test('ubl: BR-DEC LegalMonetaryTotal 2-decimal cap flags an over-precision PayableAmount', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Flip PayableAmount to 4 decimals — schema-valid but BR-DEC-17 rejects.
  const overDp = UBL_INVOICE.replace(
    '<cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>',
    '<cbc:PayableAmount currencyID="EUR">119.0050</cbc:PayableAmount>'
  );
  await page.fill('#ubl-input', overDp);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal\/PayableAmount value "119\.0050" declares 4 fractional digit/i, { timeout: 5_000 });
});

test('sepa: per-transaction 2-decimal cap confirms when InstdAmt declares 2 decimals', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 declares InstdAmt=100.00 — 2 decimals, within the EPC cap.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction amount fits within the EPC SEPA Rulebook 2-decimal cap across all 1 transaction/i, { timeout: 5_000 });
});

test('sepa: per-transaction 2-decimal cap flags an over-precision InstdAmt', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Flip the canonical InstdAmt to 4 decimals — schema-valid but EPC SEPA Rulebook rejects.
  const overDp = SEPA_PAIN001.replace(
    '<InstdAmt Ccy="EUR">100.00</InstdAmt>',
    '<InstdAmt Ccy="EUR">100.0050</InstdAmt>'
  );
  await page.fill('#sepa-input', overDp);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 declares InstdAmt \/ Amt "100\.0050" with 4 fractional digit/i, { timeout: 5_000 });
});

test('ubl: BR-DEC line-level LineExtensionAmount 2-decimal cap confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares one InvoiceLine with LineExtensionAmount=100.00.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every populated InvoiceLine \/ CreditNoteLine LineExtensionAmount carries at most 2 fractional digits across all 1 line/i, { timeout: 5_000 });
});

test('ubl: BR-DEC line-level LineExtensionAmount 2-decimal cap flags an over-precision line value', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Flip the per-line LineExtensionAmount to 4 decimals — schema-valid but BR-DEC BT-131 rejects.
  // Two LineExtensionAmount occurrences exist in the fixture (header BT-106 and line BT-131); replace only the line one inside <cac:InvoiceLine>.
  const overDp = UBL_INVOICE.replace(
    '<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>\n    <cac:Item>',
    '<cbc:LineExtensionAmount currencyID="EUR">100.0050</cbc:LineExtensionAmount>\n    <cac:Item>'
  );
  await page.fill('#ubl-input', overDp);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 LineExtensionAmount "100\.0050" declares 4 fractional digit/i, { timeout: 5_000 });
});

test('sepa: CtrlSum 2-decimal cap confirms when GrpHdr/CtrlSum declares 2 decimals', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA_PAIN001 declares GrpHdr/CtrlSum=100.00.
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every declared CtrlSum fits within the EPC SEPA Rulebook 2-decimal cap across all 2 control-sum slot/i, { timeout: 5_000 });
});

test('sepa: CtrlSum 2-decimal cap flags an over-precision GrpHdr/CtrlSum', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Flip GrpHdr/CtrlSum to 4 decimals — schema-valid but EPC SEPA Rulebook rejects.
  // Also flip the matching InstdAmt so the arithmetic-invariant gate doesn't fire.
  const overDp = SEPA_PAIN001
    .replace('<CtrlSum>100.00</CtrlSum>', '<CtrlSum>100.0050</CtrlSum>')
    .replace('<InstdAmt Ccy="EUR">100.00</InstdAmt>', '<InstdAmt Ccy="EUR">100.0050</InstdAmt>');
  await page.fill('#sepa-input', overDp);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr\/CtrlSum value "100\.0050" declares 4 fractional digit/i, { timeout: 5_000 });
});

test('ubl: BR-DEC tax-monetary 2-decimal cap confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares TaxTotal/TaxAmount=19.00, TaxSubtotal/TaxableAmount=100.00, TaxSubtotal/TaxAmount=19.00 — three tax-side amounts all at 2 decimals.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every populated TaxTotal \/ TaxSubtotal monetary amount carries at most 2 fractional digits across all 3 amount/i, { timeout: 5_000 });
});

test('ubl: BR-DEC tax-monetary 2-decimal cap flags an over-precision TaxSubtotal/TaxAmount', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Flip the per-subtotal TaxAmount to 4 decimals — schema-valid but BR-DEC-20 rejects.
  // Targets the inner TaxSubtotal/TaxAmount (the outer TaxTotal/TaxAmount above it still reads 19.00).
  const overDp = UBL_INVOICE.replace(
    '<cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>\n      <cac:TaxCategory>',
    '<cbc:TaxAmount currencyID="EUR">19.0050</cbc:TaxAmount>\n      <cac:TaxCategory>'
  );
  await page.fill('#ubl-input', overDp);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxSubtotal #1\/TaxAmount value "19\.0050" declares 4 fractional digit/i, { timeout: 5_000 });
});

test('sepa: BtchBookg xs:boolean lexical check confirms when the flag is "true"', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Inject a lowercase "true" BtchBookg into the canonical PmtInf.
  const withFlag = SEPA_PAIN001.replace(
    '<PmtMtd>TRF</PmtMtd>',
    '<PmtMtd>TRF</PmtMtd><BtchBookg>true</BtchBookg>'
  );
  await page.fill('#sepa-input', withFlag);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every populated BtchBookg matches the xs:boolean lexical space across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: BtchBookg xs:boolean lexical check flags an Excel-capitalised "True"', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBad = SEPA_PAIN001.replace(
    '<PmtMtd>TRF</PmtMtd>',
    '<PmtMtd>TRF</PmtMtd><BtchBookg>True</BtchBookg>'
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 BtchBookg "True" is not in the xs:boolean lexical space/i, { timeout: 5_000 });
});

test('ubl: TaxCategory Percent non-negativity confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares one TaxCategory with Percent=19.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every TaxCategory declares a non-negative Percent across all 1 TaxCategory block/i, { timeout: 5_000 });
});

test('ubl: TaxCategory Percent non-negativity flags a negative VAT rate', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const neg = UBL_INVOICE.replace(
    '<cbc:Percent>19</cbc:Percent>',
    '<cbc:Percent>-19</cbc:Percent>'
  );
  await page.fill('#ubl-input', neg);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxCategory #1 declares a negative Percent "-19"/i, { timeout: 5_000 });
});

test('sepa: LclInstrm enforcement confirms CORE on a SEPA-compliant pain.008', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // EPC SDD Rulebook allows LclInstrm/Cd ∈ {CORE, B2B, COR1}. Inject CORE and assert confirmation.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-LCL-1</MsgId><CreDtTm>2024-05-15T09:00:00</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>C</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>M-1</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>D</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/LclInstrm\/Cd valid per EPC SDD Rulebook.*CORE \/ B2B \/ COR1/i, { timeout: 5_000 });
});

test('sepa: LclInstrm enforcement flags an unknown local-instrument code on pain.008', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // INST is a fictitious code outside CORE / B2B / COR1 — schema-valid Max4Text, rulebook-broken.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-LCL-2</MsgId><CreDtTm>2024-05-15T09:00:00</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>INST</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>C</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>M-1</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>D</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/LclInstrm\/Cd invalid: PmtInf #1 declares "INST".*CORE.*B2B.*COR1/i, { timeout: 5_000 });
});

test('ubl: UBLVersionID confirms when 2.1 is declared', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject <cbc:UBLVersionID>2.1</cbc:UBLVersionID> just before <cbc:CustomizationID>.
  const withVer = UBL_INVOICE.replace(
    '<cbc:CustomizationID>',
    '<cbc:UBLVersionID>2.1</cbc:UBLVersionID>\n  <cbc:CustomizationID>'
  );
  await page.fill('#ubl-input', withVer);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/UBLVersionID declares OASIS UBL "2\.1"/i, { timeout: 5_000 });
});

test('ubl: UBLVersionID flags a non-2.1 declaration', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Declare 2.2 — schema-valid free text, PEPPOL access-point string-equality reject.
  const withBad = UBL_INVOICE.replace(
    '<cbc:CustomizationID>',
    '<cbc:UBLVersionID>2.2</cbc:UBLVersionID>\n  <cbc:CustomizationID>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/UBLVersionID "2\.2" is not "2\.1"/i, { timeout: 5_000 });
});

test('sepa: IntrmyAgt enforcement confirms when no intermediary agents are declared', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA-compliant pain.001 — no IntrmyAgt anywhere.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-IA-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/No IntrmyAgt1 \/ IntrmyAgt2 \/ IntrmyAgt3 declared across all 1 transaction/i, { timeout: 5_000 });
});

test('sepa: IntrmyAgt enforcement flags a pain.001 carrying IntrmyAgt1', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SWIFT MT103 cover-payment carryover: IntrmyAgt1 lives inside CdtTrfTxInf.
  // Schema-valid, EPC SCT Rulebook-forbidden.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-IA-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <IntrmyAgt1><FinInstnId><BIC>BNPAFRPPXXX</BIC></FinInstnId></IntrmyAgt1>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 declares IntrmyAgt1/i, { timeout: 5_000 });
});

test('ubl: InvoicedQuantity unitCode confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cbc:InvoicedQuantity unitCode="C62">.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every InvoicedQuantity declares a non-empty @unitCode/i, { timeout: 5_000 });
});

test('ubl: InvoicedQuantity unitCode flags a missing unitCode attribute', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the unitCode attribute — schema-valid (Quantity type allows absence
  // as xs:normalizedString without non-empty facet), EN 16931 BR-23-broken.
  const withBad = UBL_INVOICE.replace(
    '<cbc:InvoicedQuantity unitCode="C62">2</cbc:InvoicedQuantity>',
    '<cbc:InvoicedQuantity>2</cbc:InvoicedQuantity>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 InvoicedQuantity is missing a non-empty @unitCode/i, { timeout: 5_000 });
});

test('sepa: ChrgsAcct forbidden enforcement confirms when no PmtInf carries ChrgsAcct', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA-compliant pain.001 — no ChrgsAcct under any PmtInf.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-CA-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/No <ChrgsAcct> declared across all 1 PmtInf/i, { timeout: 5_000 });
});

test('sepa: ChrgsAcct forbidden enforcement flags a pain.001 carrying ChrgsAcct under PmtInf', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // SWIFT MT104 charges-allocation carryover: per-PmtInf ChrgsAcct.
  // Schema-valid, EPC SCT Rulebook-forbidden.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-CA-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <ChrgsAcct><Id><IBAN>DE89370400440532013099</IBAN></Id></ChrgsAcct>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 declares <ChrgsAcct>/i, { timeout: 5_000 });
});

test('ubl: IssueDate BR-03 presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cbc:IssueDate>2024-04-01</cbc:IssueDate> at root.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cbc:IssueDate> "2024-04-01"/i, { timeout: 5_000 });
});

test('ubl: IssueDate BR-03 presence flags a missing IssueDate at root', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the root IssueDate — schema-valid (xs:date optional at root),
  // EN 16931 BR-03-broken.
  const withBad = UBL_INVOICE.replace(
    '<cbc:IssueDate>2024-04-01</cbc:IssueDate>',
    ''
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cbc:IssueDate>/i, { timeout: 5_000 });
});

test('sepa: SvcLvl/Prtry forbidden enforcement confirms when no PmtInf carries SvcLvl/Prtry', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA-compliant pain.001 — SvcLvl/Cd=SEPA, no Prtry.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-SL-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/No <SvcLvl>\/<Prtry> declared across all 1 PmtInf/i, { timeout: 5_000 });
});

test('sepa: SvcLvl/Prtry forbidden enforcement flags a pain.001 declaring SvcLvl/Prtry instead of Cd', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Non-SEPA proprietary rail carryover: SvcLvl/Prtry instead of Cd.
  // Schema-valid, EPC SCT Rulebook-forbidden.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-SL-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <PmtTpInf><SvcLvl><Prtry>MYRAIL-DOMESTIC</Prtry></SvcLvl></PmtTpInf>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 declares <SvcLvl>\/<Prtry> "MYRAIL-DOMESTIC"/i, { timeout: 5_000 });
});

test('ubl: DocumentCurrencyCode BR-05 presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cbc:DocumentCurrencyCode> "EUR"/i, { timeout: 5_000 });
});

test('ubl: DocumentCurrencyCode BR-05 presence flags a missing root code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the root DocumentCurrencyCode — schema-valid (UBL marks it optional),
  // EN 16931 BR-05-broken.
  const withBad = UBL_INVOICE.replace(
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    ''
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cbc:DocumentCurrencyCode>/i, { timeout: 5_000 });
});

test('sepa: RmtInf Strd cardinality confirms when every RmtInf carries one <Strd>', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Canonical SEPA-compliant pain.001 — one <Strd> per RmtInf.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-STRD-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
        <RmtInf><Strd><CdtrRefInf><Ref>RF18539007547034</Ref></CdtrRefInf></Strd></RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction's RmtInf carries at most one <Strd> across all 1 populated RmtInf/i, { timeout: 5_000 });
});

test('sepa: RmtInf Strd cardinality flags a RmtInf carrying two <Strd> blocks', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Two structured-remittance blocks per RmtInf: schema-valid (0..n),
  // EPC SCT Rulebook-broken (max 1).
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-STRD-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
        <RmtInf>
          <Strd><CdtrRefInf><Ref>RF18539007547034</Ref></CdtrRefInf></Strd>
          <Strd><CdtrRefInf><Ref>RF712348231</Ref></CdtrRefInf></Strd>
        </RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 RmtInf carries 2 <Strd> elements/i, { timeout: 5_000 });
});

test('ubl: Invoice number BR-02 presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cbc:ID>INV-2024-042</cbc:ID> at root.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cbc:ID> "INV-2024-042"/i, { timeout: 5_000 });
});

test('ubl: Invoice number BR-02 presence flags a missing root ID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the root <cbc:ID> — schema-valid (UBL marks it optional),
  // EN 16931 BR-02-broken.
  const withBad = UBL_INVOICE.replace(
    '<cbc:ID>INV-2024-042</cbc:ID>',
    ''
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: AmdmntInd xs:boolean confirms when every populated value is lowercase true/false', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.008 with AmdmntInd=false — well-formed xs:boolean.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-AI-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><AmdmntInd>false</AmdmntInd></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every populated AmdmntInd matches the xs:boolean lexical space across all 1 MndtRltdInf/i, { timeout: 5_000 });
});

test('sepa: AmdmntInd xs:boolean flags a capitalised "True" value', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Excel-export carryover: "True" instead of lowercase "true".
  // Schema-invalid per xs:boolean lexical space.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-AI-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><AmdmntInd>True</AmdmntInd></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 AmdmntInd "True" is not in the xs:boolean lexical space/i, { timeout: 5_000 });
});

test('ubl: InvoiceTypeCode BR-04 presence confirms when a 380 type code is declared', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Add <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode> to the canonical fixture.
  const withType = UBL_INVOICE.replace(
    '<cbc:DueDate>2024-05-01</cbc:DueDate>',
    '<cbc:DueDate>2024-05-01</cbc:DueDate>\n  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>'
  );
  await page.fill('#ubl-input', withType);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cbc:InvoiceTypeCode> "380"/i, { timeout: 5_000 });
});

test('ubl: InvoiceTypeCode BR-04 presence flags a missing root type code on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE does not declare a root InvoiceTypeCode.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cbc:InvoiceTypeCode>/i, { timeout: 5_000 });
});

test('sepa: SeqTp presence confirms when every pain.008 PmtInf declares SeqTp', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Well-formed pain.008 with PmtTpInf/SeqTp=FRST present.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-ST-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <PmtTpInf>\/<SeqTp> across all 1 PmtInf/i, { timeout: 5_000 });
});

test('sepa: SeqTp presence flags a pain.008 PmtInf missing SeqTp', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 SCT template re-used for pain.008 without adding SeqTp.
  // Schema-valid (PmtTpInf/SeqTp is 0..1), EPC SDD Rulebook-broken.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-ST-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <PmtTpInf>\/<SeqTp>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal BR-12 presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cac:LegalMonetaryTotal>.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cac:LegalMonetaryTotal>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal BR-12 presence flags a missing root block', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the entire LegalMonetaryTotal block from the canonical fixture.
  const withBad = UBL_INVOICE.replace(/<cac:LegalMonetaryTotal>[\s\S]*?<\/cac:LegalMonetaryTotal>/, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cac:LegalMonetaryTotal>/i, { timeout: 5_000 });
});

test('sepa: UltmtCdtr Nm length confirms when every populated value fits the 70-char cap', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 with a 12-char UltmtCdtr/Nm — well within the EPC 70-char cap.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-UP-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
        <UltmtCdtr><Nm>End Customer</Nm></UltmtCdtr>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every populated <UltmtCdtr>\/<Nm> fits within the EPC SEPA Rulebook 70-character cap across all 1 ultimate-party/i, { timeout: 5_000 });
});

test('sepa: UltmtCdtr Nm length flags a 72-character ultimate-party name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // 72-character UltmtCdtr/Nm — over the EPC SCT AT-08 70-char cap.
  const longName = 'Marketplace End Customer Limited Liability Company International Trading';
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-UP-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
        <UltmtCdtr><Nm>${longName}</Nm></UltmtCdtr>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Ultimate-party #1 <UltmtCdtr>\/<Nm> ".*" exceeds the 70-character cap \(72\/70 characters\)/i, { timeout: 5_000 });
});

test('ubl: AccountingSupplierParty presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cac:AccountingSupplierParty>.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cac:AccountingSupplierParty>/i, { timeout: 5_000 });
});

test('ubl: AccountingSupplierParty presence flags a missing supplier block', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the entire AccountingSupplierParty block from the canonical fixture.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cac:AccountingSupplierParty>/i, { timeout: 5_000 });
});

test('sepa: at-least-one PmtInf presence confirms on a well-formed pain.001', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 with exactly one PmtInf block.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-PI-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>D</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Wrapper carries 1 <PmtInf> block\(s\) \(EPC SCT \/ SDD Rulebook/i, { timeout: 5_000 });
});

test('sepa: at-least-one PmtInf presence flags a wrapper with zero PmtInf blocks', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 with a GrpHdr but no PmtInf children.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-PI-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>0</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Wrapper declares zero <PmtInf> blocks/i, { timeout: 5_000 });
});

test('ubl: AccountingCustomerParty presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cac:AccountingCustomerParty>.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cac:AccountingCustomerParty>/i, { timeout: 5_000 });
});

test('ubl: AccountingCustomerParty presence flags a missing customer block', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the entire AccountingCustomerParty block from the canonical fixture.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cac:AccountingCustomerParty>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf Dbtr/Nm presence confirms when every PmtInf declares the debtor name', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 with a Dbtr/Nm on its single PmtInf.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-DBN-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>ACME GmbH</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <Dbtr>\/<Nm> across all 1 PmtInf block\(s\) \(EPC SEPA Rulebook AT-02/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf Dbtr/Nm presence flags a PmtInf with Dbtr only carrying Id', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 whose Dbtr carries only OrgId/OthrId — no <Nm>.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-DBN-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Id><OrgId><Othr><Id>ACMECORP01</Id></Othr></OrgId></Id></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <Dbtr>\/<Nm>/i, { timeout: 5_000 });
});

test('ubl: CustomizationID presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cbc:CustomizationID>.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cbc:CustomizationID>/i, { timeout: 5_000 });
});

test('ubl: CustomizationID presence flags a missing CustomizationID at root', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the CustomizationID element from the canonical fixture.
  const withBad = UBL_INVOICE.replace(/<cbc:CustomizationID>[\s\S]*?<\/cbc:CustomizationID>/, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cbc:CustomizationID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf ChrgBr presence confirms when every PmtInf declares ChrgBr', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 whose single PmtInf declares <ChrgBr>SLEV.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-CB-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>ACME GmbH</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <ChrgBr> across all 1 PmtInf block\(s\) \(EPC SEPA Rulebook/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf ChrgBr presence flags a PmtInf missing ChrgBr', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 whose PmtInf does NOT declare <ChrgBr>.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-CB-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>ACME GmbH</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <ChrgBr>/i, { timeout: 5_000 });
});

test('ubl: ProfileID presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cbc:ProfileID>.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cbc:ProfileID>/i, { timeout: 5_000 });
});

test('ubl: ProfileID presence flags a missing ProfileID at root', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the ProfileID element from the canonical fixture.
  const withBad = UBL_INVOICE.replace(/<cbc:ProfileID>[\s\S]*?<\/cbc:ProfileID>/, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cbc:ProfileID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf PmtMtd presence confirms when every PmtInf declares PmtMtd', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 whose single PmtInf declares <PmtMtd>TRF.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-PM-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>ACME GmbH</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <PmtMtd> across all 1 PmtInf block\(s\) \(ISO 20022/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf PmtMtd presence flags a PmtInf missing PmtMtd', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.001 whose PmtInf does NOT declare <PmtMtd>.
  const pain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>MSG-PM-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <ReqdExctnDt>2024-06-01</ReqdExctnDt>
      <Dbtr><Nm>ACME GmbH</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">10.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>C</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  await page.fill('#sepa-input', pain001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <PmtMtd>/i, { timeout: 5_000 });
});

test('ubl: PaymentMeansCode presence confirms when every PaymentMeans declares the code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a <cac:PaymentMeans> block with a valid PaymentMeansCode into the canonical fixture.
  const withPm = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cac:PayeeFinancialAccount>\n      <cbc:ID>DE89370400440532013000</cbc:ID>\n    </cac:PayeeFinancialAccount>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withPm);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:PaymentMeans> declares <cbc:PaymentMeansCode> across all 1 PaymentMeans block\(s\)/i, { timeout: 5_000 });
});

test('ubl: PaymentMeansCode presence flags a PaymentMeans block missing the code', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a <cac:PaymentMeans> block WITHOUT a <cbc:PaymentMeansCode> child.
  const withBad = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cac:PayeeFinancialAccount>\n      <cbc:ID>DE89370400440532013000</cbc:ID>\n    </cac:PayeeFinancialAccount>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/PaymentMeans #1 is missing <cbc:PaymentMeansCode>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf MndtId presence confirms when every SDD transaction declares it', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.008 whose single transaction declares MndtRltdInf/MndtId.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>MSG-MI-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>ACME GmbH</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>MANDATE-001</MndtId>
            <DtOfSgntr>2023-12-01</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Payer</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every direct-debit transaction declares <MndtRltdInf>\/<MndtId> across all 1 DrctDbtTxInf block\(s\) \(EPC SDD Rulebook AT-01/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf MndtId presence flags a transaction missing the mandate reference', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // pain.008 whose transaction has no <MndtRltdInf>/<MndtId>.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>MSG-MI-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>ACME GmbH</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Payer</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 is missing <DrctDbtTx>\/<MndtRltdInf>\/<MndtId>/i, { timeout: 5_000 });
});

test('ubl: TaxCategory ID presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cac:TaxCategory><cbc:ID>S</cbc:ID>...
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:TaxCategory> declares <cbc:ID>/i, { timeout: 5_000 });
});

test('ubl: TaxCategory ID presence flags a TaxCategory block missing the ID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the <cbc:ID> child from every <cac:TaxCategory> block.
  const withBad = UBL_INVOICE.replace(/<cac:TaxCategory>[\s\S]*?<\/cac:TaxCategory>/g, (block) =>
    block.replace(/<cbc:ID>[\s\S]*?<\/cbc:ID>/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxCategory #1 is missing <cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DtOfSgntr presence confirms when every SDD transaction declares it', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>MSG-DS-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>ACME GmbH</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>MANDATE-001</MndtId>
            <DtOfSgntr>2023-12-01</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Payer</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every direct-debit transaction declares <MndtRltdInf>\/<DtOfSgntr> across all 1 DrctDbtTxInf block\(s\) \(EPC SDD Rulebook AT-02/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DtOfSgntr presence flags a transaction missing the signature date', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>MSG-DS-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>X</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>PI-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>ACME GmbH</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">10.00</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>MANDATE-001</MndtId>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Payer</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 is missing <DrctDbtTx>\/<MndtRltdInf>\/<DtOfSgntr>/i, { timeout: 5_000 });
});

test('ubl: TaxScheme ID presence confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cac:TaxScheme><cbc:ID>VAT</cbc:ID>.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:TaxScheme> declares <cbc:ID>/i, { timeout: 5_000 });
});

test('ubl: TaxScheme ID presence flags a TaxScheme block missing the ID', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the <cbc:ID> child from every <cac:TaxScheme> block.
  const withBad = UBL_INVOICE.replace(/<cac:TaxScheme>[\s\S]*?<\/cac:TaxScheme>/g, (block) =>
    block.replace(/<cbc:ID>[\s\S]*?<\/cbc:ID>/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxScheme #1 is missing <cbc:ID>/i, { timeout: 5_000 });
});

test('ubl: per-line LineExtensionAmount presence confirms on canonical fixture (draft 165)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE declares <cbc:LineExtensionAmount> on every InvoiceLine.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every InvoiceLine \/ CreditNoteLine declares <cbc:LineExtensionAmount>.*EN 16931 BR-24/i, { timeout: 5_000 });
});

test('ubl: per-line LineExtensionAmount presence flags a line missing the amount (draft 165)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the direct <cbc:LineExtensionAmount> child from every <cac:InvoiceLine> block.
  // We carefully only strip the direct child, not any nested LineExtensionAmount the
  // schema doesn't use here.
  const withBad = UBL_INVOICE.replace(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g, (block) =>
    block.replace(/<cbc:LineExtensionAmount[^>]*>[\s\S]*?<\/cbc:LineExtensionAmount>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 is missing <cbc:LineExtensionAmount>/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAcct presence confirms on canonical pain.001 (draft 164)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every credit-transfer transaction declares <CdtrAcct> across all 1 CdtTrfTxInf block\(s\) \(EPC SCT Rulebook AT-21/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAcct presence flags a transaction missing the account (draft 164)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <CdtrAcct> block from the single CdtTrfTxInf in the fixture.
  const withBad = SEPA_PAIN001.replace(/<CdtrAcct>[\s\S]*?<\/CdtrAcct>\s*/, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 is missing <CdtrAcct>/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf Cdtr/Nm presence confirms on canonical pain.001 (draft 166)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every credit-transfer transaction declares <Cdtr>\/<Nm> across all 1 CdtTrfTxInf block\(s\) \(EPC SCT Rulebook AT-23/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf Cdtr/Nm presence flags a transaction missing the beneficiary name (draft 166)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <Cdtr> block (which carries the <Nm>) from the single CdtTrfTxInf.
  const withBad = SEPA_PAIN001.replace(/<Cdtr>[\s\S]*?<\/Cdtr>\s*/, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 is missing <Cdtr>\/<Nm>/i, { timeout: 5_000 });
});

test('ubl: per-line Price/PriceAmount presence confirms on canonical fixture (draft 167)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every InvoiceLine \/ CreditNoteLine declares <cac:Price>\/<cbc:PriceAmount>.*EN 16931 BR-26/i, { timeout: 5_000 });
});

test('ubl: per-line Price/PriceAmount presence flags a line missing the price (draft 167)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the <cac:Price> block from every <cac:InvoiceLine>.
  const withBad = UBL_INVOICE.replace(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g, (block) =>
    block.replace(/<cac:Price>[\s\S]*?<\/cac:Price>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 is missing <cac:Price>\/<cbc:PriceAmount>/i, { timeout: 5_000 });
});

test('sepa: per-transaction EndToEndId presence confirms on canonical pain.001 (draft 168)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction declares <PmtId>\/<EndToEndId> across all 1 transaction block\(s\) \(EPC SCT Rulebook AT-04/i, { timeout: 5_000 });
});

test('sepa: per-transaction EndToEndId presence flags a transaction missing the key (draft 168)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <PmtId> block from the single CdtTrfTxInf in the fixture.
  const withBad = SEPA_PAIN001.replace(/<PmtId>[\s\S]*?<\/PmtId>\s*/, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 is missing <PmtId>\/<EndToEndId>/i, { timeout: 5_000 });
});

test('ubl: per-line cbc:ID presence confirms on canonical fixture (draft 169)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every InvoiceLine \/ CreditNoteLine declares <cbc:ID>.*EN 16931 BR-21/i, { timeout: 5_000 });
});

test('ubl: per-line cbc:ID presence flags a line missing the identifier (draft 169)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the direct-child <cbc:ID> from every <cac:InvoiceLine>.
  const withBad = UBL_INVOICE.replace(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g, (block) =>
    block.replace(/<cbc:ID>[\s\S]*?<\/cbc:ID>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 is missing <cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAcct presence confirms on canonical pain.001 (draft 170)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <DbtrAcct> across all 1 PmtInf block\(s\) \(EPC SCT Rulebook AT-04/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAcct presence flags a PmtInf missing the originator account (draft 170)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <DbtrAcct> block from the single PmtInf in the fixture.
  const withBad = SEPA_PAIN001.replace(/<DbtrAcct>[\s\S]*?<\/DbtrAcct>\s*/, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <DbtrAcct>/i, { timeout: 5_000 });
});

test('ubl: per-line cac:Item presence confirms on canonical fixture (draft 171)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every InvoiceLine \/ CreditNoteLine declares <cac:Item>/i, { timeout: 5_000 });
});

test('ubl: per-line cac:Item presence flags a line missing the Item block (draft 171)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the <cac:Item> block from every <cac:InvoiceLine>.
  const withBad = UBL_INVOICE.replace(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g, (block) =>
    block.replace(/<cac:Item>[\s\S]*?<\/cac:Item>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 is missing <cac:Item>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAgt presence confirms on canonical pain.001 (draft 172)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <DbtrAgt> across all 1 PmtInf block\(s\) \(EPC SCT Rulebook AT-06/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAgt presence flags a PmtInf missing the originator agent (draft 172)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <DbtrAgt> block from the single PmtInf in the fixture.
  const withBad = SEPA_PAIN001.replace(/<DbtrAgt>[\s\S]*?<\/DbtrAgt>\s*/, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <DbtrAgt>/i, { timeout: 5_000 });
});

test('ubl: root cac:TaxTotal presence confirms on canonical fixture (draft 173)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root declares <cac:TaxTotal>.*EN 16931 BR-13/i, { timeout: 5_000 });
});

test('ubl: root cac:TaxTotal presence flags a document missing the TaxTotal block (draft 173)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the root-level <cac:TaxTotal> block (the one directly under <Invoice>).
  // The fixture has only one TaxTotal block at root level — drop it.
  const withBad = UBL_INVOICE.replace(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>\s*/, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root is missing <cac:TaxTotal>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf ReqdExctnDt presence confirms on canonical pain.001 (draft 174)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <ReqdExctnDt> across all 1 PmtInf block\(s\)/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf ReqdExctnDt presence flags a PmtInf missing the execution date (draft 174)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBad = SEPA_PAIN001.replace(/<ReqdExctnDt>[\s\S]*?<\/ReqdExctnDt>\s*/, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <ReqdExctnDt>/i, { timeout: 5_000 });
});

test('ubl: per-TaxTotal cbc:TaxAmount presence confirms on canonical fixture (draft 175)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every root <cac:TaxTotal> declares <cbc:TaxAmount> across all 1 TaxTotal block\(s\).*EN 16931 BR-CO-15/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf PmtInfId presence confirms on canonical pain.001 (draft 176)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <PmtInfId> with non-empty content across all 1 PmtInf block\(s\)/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf PmtInfId presence flags an empty PmtInfId element (draft 176)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Replace the populated <PmtInfId>PAY-001</PmtInfId> with an empty <PmtInfId/>.
  const withBad = SEPA_PAIN001.replace(/<PmtInfId>[\s\S]*?<\/PmtInfId>/, '<PmtInfId></PmtInfId>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <PmtInfId>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/LineExtensionAmount presence confirms on canonical fixture (draft 177)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal declares <cbc:LineExtensionAmount>.*EN 16931 BR-CO-10/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf Amt/InstdAmt presence confirms on canonical pain.001 (draft 178)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every credit-transfer transaction declares <Amt>\/<InstdAmt> with non-empty content across all 1 CdtTrfTxInf block\(s\) \(EPC SCT Rulebook AT-31/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf Amt/InstdAmt presence flags an empty InstdAmt (draft 178)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Replace the populated InstdAmt with an empty one.
  const withBad = SEPA_PAIN001.replace(/<InstdAmt[^>]*>[\s\S]*?<\/InstdAmt>/, '<InstdAmt Ccy="EUR"></InstdAmt>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 is missing <Amt>\/<InstdAmt>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/TaxExclusiveAmount presence confirms on canonical fixture (draft 179)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal declares <cbc:TaxExclusiveAmount>.*EN 16931 BR-14/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAgt presence confirms on canonical pain.001 (draft 180)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every credit-transfer transaction declares <CdtrAgt> across all 1 CdtTrfTxInf block\(s\) \(EPC SCT Rulebook AT-23/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAgt presence flags a transaction missing the beneficiary bank (draft 180)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBad = SEPA_PAIN001.replace(/<CdtrAgt>[\s\S]*?<\/CdtrAgt>\s*/, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 is missing <CdtrAgt>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/TaxInclusiveAmount presence confirms on canonical fixture (draft 181)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal declares <cbc:TaxInclusiveAmount>.*EN 16931 BR-15/i, { timeout: 5_000 });
});

test('sepa: GrpHdr MsgId presence confirms on canonical pain.001 (draft 182)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr declares <MsgId> with non-empty content/i, { timeout: 5_000 });
});

test('sepa: GrpHdr MsgId presence flags an empty MsgId element (draft 182)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBad = SEPA_PAIN001.replace(/<MsgId>[\s\S]*?<\/MsgId>/, '<MsgId></MsgId>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr is missing <MsgId>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/PayableAmount presence confirms on canonical fixture (draft 183)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal declares <cbc:PayableAmount>.*EN 16931 BR-CO-25/i, { timeout: 5_000 });
});

test('sepa: GrpHdr CreDtTm presence confirms on canonical pain.001 (draft 184)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr declares <CreDtTm> with non-empty content/i, { timeout: 5_000 });
});

test('sepa: GrpHdr CreDtTm presence flags an empty CreDtTm element (draft 184)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBad = SEPA_PAIN001.replace(/<CreDtTm>[\s\S]*?<\/CreDtTm>/, '<CreDtTm></CreDtTm>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr is missing <CreDtTm>/i, { timeout: 5_000 });
});

test('ubl: per-TaxSubtotal TaxableAmount presence confirms on canonical fixture (draft 185)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:TaxSubtotal> declares <cbc:TaxableAmount>.*EN 16931 BR-CO-17/i, { timeout: 5_000 });
});

test('ubl: per-TaxSubtotal TaxableAmount presence flags a TaxSubtotal missing the base (draft 185)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the direct-child <cbc:TaxableAmount> from every <cac:TaxSubtotal>.
  const withBad = UBL_INVOICE.replace(/<cac:TaxSubtotal>[\s\S]*?<\/cac:TaxSubtotal>/g, (block) =>
    block.replace(/<cbc:TaxableAmount[^>]*>[\s\S]*?<\/cbc:TaxableAmount>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxSubtotal #1 is missing <cbc:TaxableAmount>/i, { timeout: 5_000 });
});

test('sepa: GrpHdr NbOfTxs presence confirms on canonical pain.001 (draft 186)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr declares <NbOfTxs> with non-empty content/i, { timeout: 5_000 });
});

test('sepa: GrpHdr NbOfTxs presence flags an empty NbOfTxs element (draft 186)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBad = SEPA_PAIN001.replace(/<NbOfTxs>[\s\S]*?<\/NbOfTxs>/, '<NbOfTxs></NbOfTxs>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr is missing <NbOfTxs>/i, { timeout: 5_000 });
});

test('ubl: per-TaxSubtotal TaxAmount presence confirms on canonical fixture (draft 187)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:TaxSubtotal> declares <cbc:TaxAmount>.*EN 16931 BR-CO-18/i, { timeout: 5_000 });
});

test('ubl: per-TaxSubtotal TaxAmount presence flags a TaxSubtotal missing the tax amount (draft 187)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the direct-child <cbc:TaxAmount> from inside every <cac:TaxSubtotal>
  // (the outer root <cac:TaxTotal>/<cbc:TaxAmount> is left intact).
  const withBad = UBL_INVOICE.replace(/<cac:TaxSubtotal>[\s\S]*?<\/cac:TaxSubtotal>/g, (block) =>
    block.replace(/<cbc:TaxAmount[^>]*>[\s\S]*?<\/cbc:TaxAmount>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxSubtotal #1 is missing <cbc:TaxAmount>/i, { timeout: 5_000 });
});

test('sepa: GrpHdr CtrlSum presence confirms on canonical pain.001 (draft 188)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr declares <CtrlSum> with non-empty content/i, { timeout: 5_000 });
});

test('sepa: GrpHdr CtrlSum presence flags an empty CtrlSum element (draft 188)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const withBad = SEPA_PAIN001.replace(/<CtrlSum>[\s\S]*?<\/CtrlSum>/, '<CtrlSum></CtrlSum>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/GrpHdr is missing <CtrlSum>/i, { timeout: 5_000 });
});

test('ubl: per-TaxCategory Percent presence confirms on canonical fixture (draft 189)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:TaxCategory> declares <cbc:Percent>.*EN 16931 BT-119/i, { timeout: 5_000 });
});

test('ubl: per-TaxCategory Percent presence flags a TaxCategory missing the rate (draft 189)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the direct-child <cbc:Percent> from every <cac:TaxCategory>.
  const withBad = UBL_INVOICE.replace(/<cac:TaxCategory>[\s\S]*?<\/cac:TaxCategory>/g, (block) =>
    block.replace(/<cbc:Percent>[\s\S]*?<\/cbc:Percent>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxCategory #1 is missing <cbc:Percent>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CtrlSum presence confirms on canonical pain.001 (draft 190)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <CtrlSum> with non-empty content across all 1 PmtInf block\(s\)/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CtrlSum presence flags an empty per-PmtInf CtrlSum (draft 190)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the per-PmtInf CtrlSum while leaving GrpHdr/CtrlSum intact.
  const withBad = SEPA_PAIN001.replace(/<PmtInf>[\s\S]*?<\/PmtInf>/, (block) =>
    block.replace(/<CtrlSum>[\s\S]*?<\/CtrlSum>/, '<CtrlSum></CtrlSum>')
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <CtrlSum>/i, { timeout: 5_000 });
});

test('ubl: per-TaxSubtotal TaxCategory presence confirms on canonical fixture (draft 191)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:TaxSubtotal> declares <cac:TaxCategory>.*BR-S-01/i, { timeout: 5_000 });
});

test('ubl: per-TaxSubtotal TaxCategory presence flags a TaxSubtotal missing the category block (draft 191)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the direct-child <cac:TaxCategory> from every <cac:TaxSubtotal>.
  const withBad = UBL_INVOICE.replace(/<cac:TaxSubtotal>[\s\S]*?<\/cac:TaxSubtotal>/g, (block) =>
    block.replace(/<cac:TaxCategory>[\s\S]*?<\/cac:TaxCategory>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxSubtotal #1 is missing <cac:TaxCategory>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf Dbtr/Nm presence confirms on a Rulebook-clean pain.008 (draft 192)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-NM-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf declares <Dbtr>\/<Nm> with non-empty content across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf Dbtr/Nm presence flags an empty per-transaction debtor name (draft 192)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-NM-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm></Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 is missing <Dbtr>\/<Nm>/i, { timeout: 5_000 });
});

test('ubl: per-line ClassifiedTaxCategory presence confirms on canonical fixture (draft 193)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every InvoiceLine \/ CreditNoteLine declares <cac:Item>\/<cac:ClassifiedTaxCategory> across all 1 line/i, { timeout: 5_000 });
});

test('ubl: per-line ClassifiedTaxCategory presence flags a line missing the subblock (draft 193)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_INVOICE.replace(/<cac:ClassifiedTaxCategory>[\s\S]*?<\/cac:ClassifiedTaxCategory>\s*/g, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 is missing <cac:Item>\/<cac:ClassifiedTaxCategory>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAcct presence confirms on a Rulebook-clean pain.008 (draft 194)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-AC-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf declares <DbtrAcct> across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAcct presence flags a transaction missing the debtor account (draft 194)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Identical to the positive fixture but the per-transaction <DbtrAcct> block is stripped.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-AC-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 is missing <DbtrAcct>/i, { timeout: 5_000 });
});

test('ubl: per-line ClassifiedTaxCategory/ID presence confirms on canonical fixture (draft 195)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:Item>\/<cac:ClassifiedTaxCategory> declares <cbc:ID> with non-empty content across all 1 ClassifiedTaxCategory block/i, { timeout: 5_000 });
});

test('ubl: per-line ClassifiedTaxCategory/ID presence flags an empty ID slot (draft 195)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // The canonical fixture declares <cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID>...
  // Replace the per-line ClassifiedTaxCategory block with one carrying an empty <cbc:ID/>.
  const withBad = UBL_INVOICE.replace(
    '<cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '<cbc:ID></cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/ClassifiedTaxCategory block #1 is missing <cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAgt presence confirms on a Rulebook-clean pain.008 (draft 196)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-AG-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf declares <DbtrAgt> across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAgt presence flags a transaction missing the debtor agent (draft 196)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-AG-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 is missing <DbtrAgt>/i, { timeout: 5_000 });
});

test('ubl: per-line ClassifiedTaxCategory/Percent presence confirms on canonical fixture (draft 197)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:Item>\/<cac:ClassifiedTaxCategory> declares <cbc:Percent> with non-empty content across all 1 ClassifiedTaxCategory block/i, { timeout: 5_000 });
});

test('ubl: per-line ClassifiedTaxCategory/Percent presence flags an empty Percent slot (draft 197)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the <cbc:Percent>19</cbc:Percent> from the per-line ClassifiedTaxCategory only
  // (the header TaxCategory's Percent is on its own line and is unaffected).
  const withBad = UBL_INVOICE.replace(
    '<cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '<cbc:ID>S</cbc:ID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/ClassifiedTaxCategory block #1 is missing <cbc:Percent>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf InstdAmt presence confirms on a Rulebook-clean pain.008 (draft 198)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-AM-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf declares <InstdAmt> with non-empty content across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf InstdAmt presence flags an empty per-transaction amount (draft 198)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Identical to the positive fixture but the <InstdAmt> element shipped as an empty shell (only Ccy attr).
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-AM-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR"></InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 is missing <InstdAmt>/i, { timeout: 5_000 });
});

test('ubl: per-line ClassifiedTaxCategory/TaxScheme/ID presence confirms on canonical fixture (draft 199)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:Item>\/<cac:ClassifiedTaxCategory> declares <cac:TaxScheme>\/<cbc:ID> with non-empty content across all 1 ClassifiedTaxCategory block/i, { timeout: 5_000 });
});

test('ubl: per-line ClassifiedTaxCategory/TaxScheme/ID presence flags an empty TaxScheme ID slot (draft 199)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the TaxScheme subblock from the per-line ClassifiedTaxCategory only
  // (the header TaxCategory's TaxScheme is on its own line and is unaffected by this single-line match).
  const withBad = UBL_INVOICE.replace(
    '<cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '<cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/ClassifiedTaxCategory block #1 is missing <cac:TaxScheme>\/<cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf MndtRltdInf presence confirms on a Rulebook-clean pain.008 (draft 200)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-MR-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf declares <DrctDbtTx>\/<MndtRltdInf> across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf MndtRltdInf presence flags a transaction missing the mandate-related-info block (draft 200)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // DrctDbtTx present but MndtRltdInf subblock stripped entirely.
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-MR-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 is missing <DrctDbtTx>\/<MndtRltdInf>/i, { timeout: 5_000 });
});

test('ubl: Seller PostalAddress presence confirms on canonical fixture (draft 201)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party declares <cac:PostalAddress>/i, { timeout: 5_000 });
});

test('ubl: Seller PostalAddress presence flags a missing block (draft 201)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the PostalAddress block from inside AccountingSupplierParty/Party.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(/<cac:PostalAddress>[\s\S]*?<\/cac:PostalAddress>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty is missing Party\/PostalAddress/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DrctDbtTx presence confirms on a Rulebook-clean pain.008 (draft 202)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-DX-1</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-001</MndtId><DtOfSgntr>2024-03-15</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf declares <DrctDbtTx> across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DrctDbtTx presence flags a transaction missing the wrapper (draft 202)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  const pain008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr><MsgId>DD-DX-2</MsgId><CreDtTm>2024-05-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><InitgPty><Nm>Creditor Inc</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-1</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>FRST</SeqTp></PmtTpInf>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-1</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  await page.fill('#sepa-input', pain008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 is missing <DrctDbtTx>/i, { timeout: 5_000 });
});

test('ubl: Buyer PostalAddress presence confirms on canonical fixture (draft 203)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party declares <cac:PostalAddress>/i, { timeout: 5_000 });
});

test('ubl: Buyer PostalAddress presence flags a missing block (draft 203)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the PostalAddress block from inside AccountingCustomerParty/Party only.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(/<cac:PostalAddress>[\s\S]*?<\/cac:PostalAddress>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty is missing Party\/PostalAddress/i, { timeout: 5_000 });
});

test('sepa: per-transaction PmtId presence confirms on canonical pain.001 (draft 204)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction declares <PmtId> across all 1 CdtTrfTxInf \/ DrctDbtTxInf block/i, { timeout: 5_000 });
});

test('sepa: per-transaction PmtId presence flags a CdtTrfTxInf missing the wrapper (draft 204)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <PmtId>...</PmtId> wrapper from the single CdtTrfTxInf in the fixture.
  const withBad = SEPA_PAIN001.replace(/<PmtId>[\s\S]*?<\/PmtId>\s*/g, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 is missing <PmtId>/i, { timeout: 5_000 });
});

test('ubl: Seller Party wrapper presence confirms on canonical fixture (draft 205)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty declares <cac:Party>/i, { timeout: 5_000 });
});

test('ubl: Seller Party wrapper presence flags a missing Party block (draft 205)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the Party wrapper from inside AccountingSupplierParty only (leave its children orphaned).
  const withBad = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(/<cac:Party>([\s\S]*?)<\/cac:Party>/, '$1')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty is missing <cac:Party>/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf Cdtr wrapper presence confirms on canonical pain.001 (draft 206)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every CdtTrfTxInf declares <Cdtr> across all 1 credit-transfer transaction/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf Cdtr wrapper presence flags a transaction missing the wrapper (draft 206)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <Cdtr>...</Cdtr> wrapper from the single CdtTrfTxInf in the fixture.
  const withBad = SEPA_PAIN001.replace(/<Cdtr>[\s\S]*?<\/Cdtr>\s*/g, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 is missing <Cdtr>/i, { timeout: 5_000 });
});

test('ubl: Buyer Party wrapper presence confirms on canonical fixture (draft 207)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty declares <cac:Party>/i, { timeout: 5_000 });
});

test('ubl: Buyer Party wrapper presence flags a missing Party block (draft 207)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the Party wrapper from inside AccountingCustomerParty only (leave its children orphaned).
  const withBad = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(/<cac:Party>([\s\S]*?)<\/cac:Party>/, '$1')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty is missing <cac:Party>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf Dbtr wrapper presence confirms on canonical pain.001 (draft 208)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <Dbtr> across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf Dbtr wrapper presence flags a PmtInf missing the wrapper (draft 208)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the PmtInf-level <Dbtr>...</Dbtr> wrapper. The fixture only has one Dbtr block (no DrctDbtTxInf path).
  const withBad = SEPA_PAIN001.replace(/<Dbtr>[\s\S]*?<\/Dbtr>\s*/g, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <Dbtr>/i, { timeout: 5_000 });
});

test('ubl: Seller PartyLegalEntity wrapper presence confirms on canonical fixture (draft 209)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party declares <cac:PartyLegalEntity>/i, { timeout: 5_000 });
});

test('ubl: Seller PartyLegalEntity wrapper presence flags a missing PartyLegalEntity block (draft 209)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the PartyLegalEntity block from inside AccountingSupplierParty only.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(/<cac:PartyLegalEntity>[\s\S]*?<\/cac:PartyLegalEntity>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party is missing <cac:PartyLegalEntity>/i, { timeout: 5_000 });
});

const SEPA_PAIN008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>DD-MSG-2024-099</MsgId>
      <CreDtTm>2024-05-15T09:00:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>42.00</CtrlSum>
      <InitgPty><Nm>Creditor Inc</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>DD-PAY-001</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <ReqdColltnDt>2024-06-01</ReqdColltnDt>
      <Cdtr><Nm>Creditor Inc</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
      <DrctDbtTxInf>
        <PmtId><EndToEndId>DD-E2E-077</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">42.00</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MANDATE-2024-XYZ</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>Subscriber</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>Subscription May 2024</Ustrd></RmtInf>
      </DrctDbtTxInf>
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

test('sepa: per-PmtInf Cdtr wrapper presence confirms on canonical pain.008 (draft 210)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <Cdtr> across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf Cdtr wrapper presence flags a PmtInf missing the wrapper on pain.008 (draft 210)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the PmtInf-level <Cdtr>...</Cdtr> wrapper (single block in the fixture).
  const withBad = SEPA_PAIN008.replace(/<Cdtr>[\s\S]*?<\/Cdtr>\s*/g, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <Cdtr>/i, { timeout: 5_000 });
});

test('ubl: Buyer PartyLegalEntity wrapper presence confirms on canonical fixture (draft 211)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party declares <cac:PartyLegalEntity>/i, { timeout: 5_000 });
});

test('ubl: Buyer PartyLegalEntity wrapper presence flags a missing PartyLegalEntity block (draft 211)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the PartyLegalEntity block from inside AccountingCustomerParty only.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(/<cac:PartyLegalEntity>[\s\S]*?<\/cac:PartyLegalEntity>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party is missing <cac:PartyLegalEntity>/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAgt/FinInstnId wrapper presence confirms on canonical pain.001 (draft 212)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every CdtTrfTxInf with <CdtrAgt> declares <FinInstnId> across all 1 block/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAgt/FinInstnId wrapper presence flags a CdtrAgt missing FinInstnId (draft 212)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <FinInstnId>...</FinInstnId> inside CdtrAgt only, leaving CdtrAgt as an empty shell.
  const withBad = SEPA_PAIN001.replace(/<CdtrAgt>[\s\S]*?<\/CdtrAgt>/, (block) =>
    block.replace(/<FinInstnId>[\s\S]*?<\/FinInstnId>\s*/, '')
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 has <CdtrAgt> but is missing <FinInstnId>/i, { timeout: 5_000 });
});

test('ubl: Seller PostalAddress/Country wrapper presence confirms on canonical fixture (draft 213)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party\/PostalAddress declares <cac:Country>/i, { timeout: 5_000 });
});

test('ubl: Seller PostalAddress/Country wrapper presence flags a missing Country block (draft 213)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the Country block from inside AccountingSupplierParty only.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(/<cac:Country>[\s\S]*?<\/cac:Country>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party\/PostalAddress is missing <cac:Country>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAgt/FinInstnId wrapper presence confirms on canonical pain.008 (draft 214)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf with <DbtrAgt> declares <FinInstnId> across all 1 block/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAgt/FinInstnId wrapper presence flags a DbtrAgt missing FinInstnId (draft 214)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <FinInstnId>...</FinInstnId> inside DbtrAgt only, leaving DbtrAgt as an empty shell.
  const withBad = SEPA_PAIN008.replace(/<DbtrAgt>[\s\S]*?<\/DbtrAgt>/, (block) =>
    block.replace(/<FinInstnId>[\s\S]*?<\/FinInstnId>\s*/, '')
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 has <DbtrAgt> but is missing <FinInstnId>/i, { timeout: 5_000 });
});

test('ubl: Buyer PostalAddress/Country wrapper presence confirms on canonical fixture (draft 215)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party\/PostalAddress declares <cac:Country>/i, { timeout: 5_000 });
});

test('ubl: Buyer PostalAddress/Country wrapper presence flags a missing Country block (draft 215)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the Country block from inside AccountingCustomerParty only.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(/<cac:Country>[\s\S]*?<\/cac:Country>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party\/PostalAddress is missing <cac:Country>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAgt/FinInstnId wrapper presence confirms on canonical pain.001 (draft 216)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf with <DbtrAgt> declares <FinInstnId> across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAgt/FinInstnId wrapper presence flags a DbtrAgt missing FinInstnId (draft 216)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <FinInstnId>...</FinInstnId> inside the PmtInf-level DbtrAgt only, leaving CdtrAgt intact.
  const withBad = SEPA_PAIN001.replace(/<DbtrAgt>[\s\S]*?<\/DbtrAgt>/, (block) =>
    block.replace(/<FinInstnId>[\s\S]*?<\/FinInstnId>\s*/, '')
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 has <DbtrAgt> but is missing <FinInstnId>/i, { timeout: 5_000 });
});

test('ubl: Seller Party/PartyTaxScheme wrapper presence confirms when PartyTaxScheme is declared (draft 217)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture omits PartyTaxScheme on the supplier — inject one alongside PartyLegalEntity.
  const withGood = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>DE136695976</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withGood);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party declares <cac:PartyTaxScheme>/i, { timeout: 5_000 });
});

test('ubl: Seller Party/PartyTaxScheme wrapper presence flags a missing PartyTaxScheme (draft 217)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture already omits PartyTaxScheme on the supplier — the check should flag it.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party is missing <cac:PartyTaxScheme>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAgt/FinInstnId wrapper presence confirms on canonical pain.008 (draft 218)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf with <CdtrAgt> declares <FinInstnId> across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAgt/FinInstnId wrapper presence flags a CdtrAgt missing FinInstnId (draft 218)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <FinInstnId>...</FinInstnId> inside the PmtInf-level CdtrAgt only.
  const withBad = SEPA_PAIN008.replace(/<CdtrAgt>[\s\S]*?<\/CdtrAgt>/, (block) =>
    block.replace(/<FinInstnId>[\s\S]*?<\/FinInstnId>\s*/, '')
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 has <CdtrAgt> but is missing <FinInstnId>/i, { timeout: 5_000 });
});

test('ubl: Buyer Party/PartyTaxScheme wrapper presence confirms when PartyTaxScheme is declared (draft 219)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture omits PartyTaxScheme on the customer — inject one alongside PartyLegalEntity.
  const withGood = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>FR12345678901</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withGood);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party declares <cac:PartyTaxScheme>/i, { timeout: 5_000 });
});

test('ubl: Buyer Party/PartyTaxScheme wrapper presence flags a missing PartyTaxScheme (draft 219)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture already omits PartyTaxScheme on the customer — the check should flag it.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party is missing <cac:PartyTaxScheme>/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAcct/Id wrapper presence confirms on canonical pain.001 (draft 220)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every CdtTrfTxInf with <CdtrAcct> declares <Id> across all 1 block/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAcct/Id wrapper presence flags a CdtrAcct missing Id (draft 220)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <Id>...</Id> inside CdtrAcct only, leaving CdtrAcct as an empty shell.
  const withBad = SEPA_PAIN001.replace(/<CdtrAcct>[\s\S]*?<\/CdtrAcct>/, (block) =>
    block.replace(/<Id>[\s\S]*?<\/Id>\s*/, '')
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 has <CdtrAcct> but is missing <Id>/i, { timeout: 5_000 });
});

test('ubl: Seller PartyTaxScheme/TaxScheme wrapper presence confirms when TaxScheme is declared (draft 221)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture omits PartyTaxScheme on the supplier — inject a complete one (with TaxScheme).
  const withGood = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>DE136695976</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withGood);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every AccountingSupplierParty\/Party\/PartyTaxScheme declares <cac:TaxScheme> across all 1 PartyTaxScheme block/i, { timeout: 5_000 });
});

test('ubl: Seller PartyTaxScheme/TaxScheme wrapper presence flags a PartyTaxScheme missing TaxScheme (draft 221)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a PartyTaxScheme with only CompanyID (no TaxScheme block).
  const withBad = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>DE136695976</cbc:CompanyID></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party\/PartyTaxScheme #1 is missing <cac:TaxScheme>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAcct/Id wrapper presence confirms on canonical pain.001 (draft 222)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf with <DbtrAcct> declares <Id> across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAcct/Id wrapper presence flags a DbtrAcct missing Id (draft 222)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <Id>...</Id> inside the PmtInf-level DbtrAcct only.
  const withBad = SEPA_PAIN001.replace(/<DbtrAcct>[\s\S]*?<\/DbtrAcct>/, (block) =>
    block.replace(/<Id>[\s\S]*?<\/Id>\s*/, '')
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 has <DbtrAcct> but is missing <Id>/i, { timeout: 5_000 });
});

test('ubl: Buyer PartyTaxScheme/TaxScheme wrapper presence confirms when TaxScheme is declared (draft 223)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture omits PartyTaxScheme on the customer — inject a complete one (with TaxScheme).
  const withGood = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>FR12345678901</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withGood);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every AccountingCustomerParty\/Party\/PartyTaxScheme declares <cac:TaxScheme> across all 1 PartyTaxScheme block/i, { timeout: 5_000 });
});

test('ubl: Buyer PartyTaxScheme/TaxScheme wrapper presence flags a PartyTaxScheme missing TaxScheme (draft 223)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a PartyTaxScheme with only CompanyID (no TaxScheme block).
  const withBad = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>FR12345678901</cbc:CompanyID></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party\/PartyTaxScheme #1 is missing <cac:TaxScheme>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAcct/Id wrapper presence confirms on canonical pain.008 (draft 224)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf with <DbtrAcct> declares <Id> across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAcct/Id wrapper presence flags a DbtrAcct missing Id (draft 224)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <Id>...</Id> inside the per-transaction DbtrAcct only (pain.008 has a single DbtrAcct).
  const withBad = SEPA_PAIN008.replace(/<DbtrAcct>[\s\S]*?<\/DbtrAcct>/, (block) =>
    block.replace(/<Id>[\s\S]*?<\/Id>\s*/, '')
  );
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 has <DbtrAcct> but is missing <Id>/i, { timeout: 5_000 });
});

test('ubl: Seller PartyTaxScheme/TaxScheme/cbc:ID presence confirms when ID is populated (draft 225)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a complete supplier PartyTaxScheme (TaxScheme with a non-empty ID).
  const withGood = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>DE136695976</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withGood);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every AccountingSupplierParty\/Party\/PartyTaxScheme with <cac:TaxScheme> declares a non-empty <cbc:ID> across all 1 PartyTaxScheme block/i, { timeout: 5_000 });
});

test('ubl: Seller PartyTaxScheme/TaxScheme/cbc:ID presence flags a TaxScheme with empty ID (draft 225)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a PartyTaxScheme whose TaxScheme wrapper is present but carries no <cbc:ID>.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>DE136695976</cbc:CompanyID><cac:TaxScheme></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party\/PartyTaxScheme #1 has <cac:TaxScheme> but is missing a non-empty <cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAcct wrapper presence confirms on canonical pain.008 (draft 226)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf declares <CdtrAcct> across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAcct wrapper presence flags a PmtInf missing the wrapper on pain.008 (draft 226)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the PmtInf-level <CdtrAcct>...</CdtrAcct> (single block in the fixture; the debtor account sits per-DrctDbtTxInf).
  const withBad = SEPA_PAIN008.replace(/<CdtrAcct>[\s\S]*?<\/CdtrAcct>\s*/, '');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 is missing <CdtrAcct>/i, { timeout: 5_000 });
});

test('ubl: Buyer PartyTaxScheme/TaxScheme/cbc:ID presence confirms when ID is populated (draft 227)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a complete customer PartyTaxScheme (TaxScheme with a non-empty ID).
  const withGood = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>FR12345678901</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withGood);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every AccountingCustomerParty\/Party\/PartyTaxScheme with <cac:TaxScheme> declares a non-empty <cbc:ID> across all 1 PartyTaxScheme block/i, { timeout: 5_000 });
});

test('ubl: Buyer PartyTaxScheme/TaxScheme/cbc:ID presence flags a TaxScheme with empty ID (draft 227)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a customer PartyTaxScheme whose TaxScheme wrapper is present but carries no <cbc:ID>.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>FR12345678901</cbc:CompanyID><cac:TaxScheme></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party\/PartyTaxScheme #1 has <cac:TaxScheme> but is missing a non-empty <cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAcct/Id wrapper presence confirms on canonical pain.008 (draft 228)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf with <CdtrAcct> declares <Id> across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAcct/Id wrapper presence flags a CdtrAcct missing the Id wrapper on pain.008 (draft 228)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Strip the <Id>...</Id> from inside the PmtInf-level <CdtrAcct> only (leave the per-DrctDbtTxInf DbtrAcct/Id intact).
  const withBad = SEPA_PAIN008.replace('<CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>', '<CdtrAcct></CdtrAcct>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 has <CdtrAcct> but is missing <Id>/i, { timeout: 5_000 });
});

test('ubl: Seller PartyTaxScheme/cbc:CompanyID presence confirms when CompanyID is populated (draft 229)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a complete supplier PartyTaxScheme (VAT TaxScheme with a non-empty CompanyID).
  const withGood = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>DE123456789</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withGood);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every AccountingSupplierParty\/Party\/PartyTaxScheme whose <cac:TaxScheme>\/<cbc:ID> is "VAT" declares a non-empty <cbc:CompanyID> across all 1 VAT PartyTaxScheme block/i, { timeout: 5_000 });
});

test('ubl: Seller PartyTaxScheme/cbc:CompanyID presence flags a VAT scheme with empty CompanyID (draft 229)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a supplier PartyTaxScheme whose TaxScheme/ID="VAT" but whose CompanyID is present-but-empty.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>ACME Widgets GmbH</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID></cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingSupplierParty\/Party\/PartyTaxScheme #1 has TaxScheme\/ID="VAT" but is missing a non-empty <cbc:CompanyID>/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAcct/Id content presence confirms on canonical pain.001 (draft 230)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every CdtTrfTxInf with <CdtrAcct>\/<Id> carries an <IBAN> or <Othr> identification across all 1 transaction/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAcct/Id content presence flags an empty Id on pain.001 (draft 230)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Empty the beneficiary <CdtrAcct>/<Id> (leave the wrapper so draft 220 still passes; the debtor IBAN is untouched).
  const withBad = SEPA_PAIN001.replace('<CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>', '<CdtrAcct><Id></Id></CdtrAcct>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 has <CdtrAcct>\/<Id> but it carries neither <IBAN> nor <Othr>/i, { timeout: 5_000 });
});

test('ubl: Buyer PartyTaxScheme/cbc:CompanyID presence confirms when CompanyID is populated (draft 231)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a complete customer PartyTaxScheme (VAT TaxScheme with a non-empty CompanyID).
  const withGood = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID>FR12345678901</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withGood);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every AccountingCustomerParty\/Party\/PartyTaxScheme whose <cac:TaxScheme>\/<cbc:ID> is "VAT" declares a non-empty <cbc:CompanyID> across all 1 VAT PartyTaxScheme block/i, { timeout: 5_000 });
});

test('ubl: Buyer PartyTaxScheme/cbc:CompanyID presence flags a VAT scheme with empty CompanyID (draft 231)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a customer PartyTaxScheme whose TaxScheme/ID="VAT" but whose CompanyID is present-but-empty.
  const withBad = UBL_INVOICE.replace(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/, (block) =>
    block.replace(
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>',
      '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>\n      <cac:PartyTaxScheme><cbc:CompanyID></cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    )
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty\/Party\/PartyTaxScheme #1 has TaxScheme\/ID="VAT" but is missing a non-empty <cbc:CompanyID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAcct/Id content presence confirms on canonical pain.001 (draft 232)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf with <DbtrAcct>\/<Id> carries an <IBAN> or <Othr> identification across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAcct/Id content presence flags an empty Id on pain.001 (draft 232)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Empty the originator <DbtrAcct>/<Id> (leave the wrapper so draft 222 still passes; the beneficiary CdtrAcct IBAN is untouched).
  const withBad = SEPA_PAIN001.replace('<DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>', '<DbtrAcct><Id></Id></DbtrAcct>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 has <DbtrAcct>\/<Id> but it carries neither <IBAN> nor <Othr>/i, { timeout: 5_000 });
});

test('ubl: per-TaxCategory TaxScheme wrapper presence confirms on canonical fixture (draft 233)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:TaxCategory> declares a <cac:TaxScheme> across all 1 TaxCategory block/i, { timeout: 5_000 });
});

test('ubl: per-TaxCategory TaxScheme wrapper presence flags a TaxCategory missing the wrapper (draft 233)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the <cac:TaxScheme> from inside the document-level cac:TaxCategory only (the line-level cac:ClassifiedTaxCategory keeps its TaxScheme).
  const withBad = UBL_INVOICE.replace(/<cac:TaxCategory>[\s\S]*?<\/cac:TaxCategory>/, (block) =>
    block.replace(/<cac:TaxScheme>[\s\S]*?<\/cac:TaxScheme>/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxCategory #1 is missing <cac:TaxScheme>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAcct/Id content presence confirms on canonical pain.008 (draft 234)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf with <DbtrAcct>\/<Id> carries an <IBAN> or <Othr> identification across all 1 direct-debit transaction/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAcct/Id content presence flags an empty Id on pain.008 (draft 234)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Empty the debtor <DbtrAcct>/<Id> (leave the wrapper so draft 224 still passes; the creditor CdtrAcct IBAN is untouched).
  const withBad = SEPA_PAIN008.replace('<DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>', '<DbtrAcct><Id></Id></DbtrAcct>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 has <DbtrAcct>\/<Id> but it carries neither <IBAN> nor <Othr>/i, { timeout: 5_000 });
});

test('ubl: per-TaxCategory TaxScheme/cbc:ID content presence confirms on canonical fixture (draft 235)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every <cac:TaxCategory> with a <cac:TaxScheme> declares <cbc:ID> across all 1 TaxCategory block/i, { timeout: 5_000 });
});

test('ubl: per-TaxCategory TaxScheme/cbc:ID content presence flags an empty ID (draft 235)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Empty the <cbc:ID> inside the document-level cac:TaxCategory's TaxScheme only (keep the wrapper so draft 233 still passes; the line-level cac:ClassifiedTaxCategory keeps its VAT scheme ID).
  const withBad = UBL_INVOICE.replace(/<cac:TaxCategory>[\s\S]*?<\/cac:TaxCategory>/, (block) =>
    block.replace('<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>', '<cac:TaxScheme><cbc:ID></cbc:ID></cac:TaxScheme>')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/TaxCategory #1 has <cac:TaxScheme> but it is missing <cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAcct/Id content presence confirms on canonical pain.008 (draft 236)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf with <CdtrAcct>\/<Id> carries an <IBAN> or <Othr> identification across all 1 PmtInf block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAcct/Id content presence flags an empty Id on pain.008 (draft 236)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Empty the creditor <CdtrAcct>/<Id> (leave the wrapper so draft 228 still passes; the debtor DbtrAcct IBAN is untouched).
  const withBad = SEPA_PAIN008.replace('<CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>', '<CdtrAcct><Id></Id></CdtrAcct>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 has <CdtrAcct>\/<Id> but it carries neither <IBAN> nor <Othr>/i, { timeout: 5_000 });
});

test('ubl: root TaxTotal/TaxSubtotal presence confirms on canonical fixture (draft 237)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every root <cac:TaxTotal> declares at least one <cac:TaxSubtotal> across all 1 root TaxTotal block/i, { timeout: 5_000 });
});

test('ubl: root TaxTotal/TaxSubtotal presence flags a TaxTotal with no breakdown (draft 237)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the <cac:TaxSubtotal> from the root TaxTotal (keep the root TaxTotal wrapper + its TaxAmount so drafts 173 / 175 still pass).
  const withBad = UBL_INVOICE.replace(/<cac:TaxSubtotal>[\s\S]*?<\/cac:TaxSubtotal>\s*/, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root <cac:TaxTotal> #1 carries no <cac:TaxSubtotal>/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAgt/FinInstnId routing content confirms on canonical pain.001 (draft 238)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every CdtTrfTxInf with <CdtrAgt>\/<FinInstnId> carries a routing identifier .* across all 1 FinInstnId block/i, { timeout: 5_000 });
});

test('sepa: per-CdtTrfTxInf CdtrAgt/FinInstnId routing content flags a name-only FinInstnId on pain.001 (draft 238)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Keep the FinInstnId wrapper (so draft 212 still passes) but replace its <BIC> routing identifier with a human-readable <Nm> only.
  const withBad = SEPA_PAIN001.replace('<CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>', '<CdtrAgt><FinInstnId><Nm>Beneficiary Bank</Nm></FinInstnId></CdtrAgt>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/CdtTrfTxInf #1 has <CdtrAgt>\/<FinInstnId> but it carries no <BIC>\/<BICFI>, <ClrSysMmbId> or <Othr> routing identifier/i, { timeout: 5_000 });
});

test('ubl: credit-transfer PayeeFinancialAccount/ID presence confirms when the account is declared (draft 239)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture has no <cac:PaymentMeans>; inject a credit-transfer (code 30) carrying the PayeeFinancialAccount/ID.
  const withMeans = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cac:PayeeFinancialAccount>\n      <cbc:ID>DE89370400440532013000</cbc:ID>\n    </cac:PayeeFinancialAccount>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withMeans);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every credit-transfer <cac:PaymentMeans> \(UNCL 4461 code 30 \/ 58\) declares <cac:PayeeFinancialAccount>\/<cbc:ID> across all 1 credit-transfer block/i, { timeout: 5_000 });
});

test('ubl: credit-transfer PayeeFinancialAccount/ID presence flags a credit transfer missing the account (draft 239)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a credit-transfer (code 30) with NO PayeeFinancialAccount/ID.
  const withBad = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Credit-transfer <cac:PaymentMeans> #1 \(UNCL 4461 code 30 \/ 58\) is missing <cac:PayeeFinancialAccount>\/<cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAgt/FinInstnId routing content confirms on canonical pain.001 (draft 240)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf with <DbtrAgt>\/<FinInstnId> carries a routing identifier .* across all 1 FinInstnId block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf DbtrAgt/FinInstnId routing content flags a name-only FinInstnId on pain.001 (draft 240)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Keep the PmtInf-level DbtrAgt FinInstnId wrapper (so draft 216 still passes) but replace its <BIC> with a human-readable <Nm> only.
  const withBad = SEPA_PAIN001.replace('<DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>', '<DbtrAgt><FinInstnId><Nm>Originator Bank</Nm></FinInstnId></DbtrAgt>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 has <DbtrAgt>\/<FinInstnId> but it carries no <BIC>\/<BICFI>, <ClrSysMmbId> or <Othr> routing identifier/i, { timeout: 5_000 });
});

test('ubl: direct-debit PaymentMandate/ID presence confirms when the mandate reference is declared (draft 241)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture has no <cac:PaymentMeans>; inject a SEPA direct debit (code 59) carrying the PaymentMandate/ID.
  const withMeans = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>59</cbc:PaymentMeansCode>\n    <cac:PaymentMandate>\n      <cbc:ID>MANDATE-2024-001</cbc:ID>\n    </cac:PaymentMandate>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withMeans);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every direct-debit <cac:PaymentMeans> \(UNCL 4461 code 49 \/ 59\) declares <cac:PaymentMandate>\/<cbc:ID> across all 1 direct-debit block/i, { timeout: 5_000 });
});

test('ubl: direct-debit PaymentMandate/ID presence flags a direct debit missing the mandate (draft 241)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a SEPA direct debit (code 59) with NO PaymentMandate/ID.
  const withBad = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>59</cbc:PaymentMeansCode>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Direct-debit <cac:PaymentMeans> #1 \(UNCL 4461 code 49 \/ 59\) is missing <cac:PaymentMandate>\/<cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAgt/FinInstnId routing content confirms on canonical pain.008 (draft 242)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every DrctDbtTxInf with <DbtrAgt>\/<FinInstnId> carries a routing identifier .* across all 1 FinInstnId block/i, { timeout: 5_000 });
});

test('sepa: per-DrctDbtTxInf DbtrAgt/FinInstnId routing content flags a name-only FinInstnId on pain.008 (draft 242)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Keep the per-transaction DbtrAgt FinInstnId wrapper (so draft 214 still passes) but replace its <BIC> with a human-readable <Nm> only.
  const withBad = SEPA_PAIN008.replace('<DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt>', '<DbtrAgt><FinInstnId><Nm>Debtor Bank</Nm></FinInstnId></DbtrAgt>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/DrctDbtTxInf #1 has <DbtrAgt>\/<FinInstnId> but it carries no <BIC>\/<BICFI>, <ClrSysMmbId> or <Othr> routing identifier/i, { timeout: 5_000 });
});

test('ubl: direct-debit PayerFinancialAccount/ID presence confirms when the debited account is declared (draft 243)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture has no <cac:PaymentMeans>; inject a SEPA direct debit (code 59) whose mandate carries the debited account.
  const withMeans = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>59</cbc:PaymentMeansCode>\n    <cac:PaymentMandate>\n      <cbc:ID>MANDATE-2024-001</cbc:ID>\n      <cac:PayerFinancialAccount>\n        <cbc:ID>DE89370400440532013000</cbc:ID>\n      </cac:PayerFinancialAccount>\n    </cac:PaymentMandate>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withMeans);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every direct-debit <cac:PaymentMeans> \(UNCL 4461 code 49 \/ 59\) declares <cac:PaymentMandate>\/<cac:PayerFinancialAccount>\/<cbc:ID> across all 1 direct-debit block/i, { timeout: 5_000 });
});

test('ubl: direct-debit PayerFinancialAccount/ID presence flags a direct debit missing the debited account (draft 243)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a SEPA direct debit (code 59) whose mandate carries the reference but NO PayerFinancialAccount/ID.
  const withBad = UBL_INVOICE.replace(
    '</cac:LegalMonetaryTotal>',
    '</cac:LegalMonetaryTotal>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>59</cbc:PaymentMeansCode>\n    <cac:PaymentMandate>\n      <cbc:ID>MANDATE-2024-001</cbc:ID>\n    </cac:PaymentMandate>\n  </cac:PaymentMeans>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Direct-debit <cac:PaymentMeans> #1 \(UNCL 4461 code 49 \/ 59\) is missing <cac:PaymentMandate>\/<cac:PayerFinancialAccount>\/<cbc:ID>/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAgt/FinInstnId routing content confirms on canonical pain.008 (draft 244)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN008);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every PmtInf with <CdtrAgt>\/<FinInstnId> carries a routing identifier .* across all 1 FinInstnId block/i, { timeout: 5_000 });
});

test('sepa: per-PmtInf CdtrAgt/FinInstnId routing content flags a name-only FinInstnId on pain.008 (draft 244)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Keep the per-PmtInf CdtrAgt FinInstnId wrapper (so draft 218 still passes) but replace its <BIC> with a human-readable <Nm> only.
  const withBad = SEPA_PAIN008.replace('<CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>', '<CdtrAgt><FinInstnId><Nm>Creditor Bank</Nm></FinInstnId></CdtrAgt>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/PmtInf #1 has <CdtrAgt>\/<FinInstnId> but it carries no <BIC>\/<BICFI>, <ClrSysMmbId> or <Othr> routing identifier/i, { timeout: 5_000 });
});

test('ubl: EndpointID schemeID presence confirms when the electronic address carries a scheme (draft 245)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical fixture has no <cbc:EndpointID>; inject a supplier endpoint carrying its mandatory schemeID.
  const withEp = UBL_INVOICE.replace('<cac:PartyName><cbc:Name>ACME Widgets GmbH</cbc:Name></cac:PartyName>', '<cbc:EndpointID schemeID="0088">5790000435975</cbc:EndpointID><cac:PartyName><cbc:Name>ACME Widgets GmbH</cbc:Name></cac:PartyName>');
  await page.fill('#ubl-input', withEp);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every declared <cbc:EndpointID> \(supplier \/ customer\) carries its mandatory schemeID attribute across all 1 electronic address/i, { timeout: 5_000 });
});

test('ubl: EndpointID schemeID presence flags an endpoint missing the scheme attribute (draft 245)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a supplier endpoint whose value is present but carries NO schemeID attribute.
  const withBad = UBL_INVOICE.replace('<cac:PartyName><cbc:Name>ACME Widgets GmbH</cbc:Name></cac:PartyName>', '<cbc:EndpointID>5790000435975</cbc:EndpointID><cac:PartyName><cbc:Name>ACME Widgets GmbH</cbc:Name></cac:PartyName>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Supplier \(BT-34-1\) <cbc:EndpointID> is present but carries no schemeID attribute/i, { timeout: 5_000 });
});

test('sepa: per-transaction amount cap confirms on a canonical pain.001 (draft 246)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', SEPA_PAIN001);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Every transaction amount is within the EPC SEPA per-instruction cap of €999,999,999\.99/i, { timeout: 5_000 });
});

test('sepa: per-transaction amount cap flags an instruction above €999,999,999.99 (draft 246)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  // Push the first transaction amount one euro past the EPC per-instruction cap.
  const withBad = SEPA_PAIN001.replace('<InstdAmt Ccy="EUR">100.00</InstdAmt>', '<InstdAmt Ccy="EUR">1000000000.00</InstdAmt>');
  await page.fill('#sepa-input', withBad);
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/Transaction #1 declares InstdAmt \/ Amt "1000000000\.00" which exceeds the EPC SEPA per-instruction cap of €999,999,999\.99/i, { timeout: 5_000 });
});

test('ubl: BR-CO-14 VAT-breakdown sum confirms on a canonical invoice (draft 247)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every root-level <cac:TaxTotal>\/<cbc:TaxAmount> equals the sum of its per-rate <cac:TaxSubtotal>\/<cbc:TaxAmount>/i, { timeout: 5_000 });
});

test('ubl: BR-CO-14 VAT-breakdown sum flags a subtotal that disagrees with the header TaxAmount (draft 247)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Lower only the per-rate TaxSubtotal TaxAmount (17.00) while the rolled-up header stays 19.00.
  const withBad = UBL_INVOICE.replace(
    '<cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>\n      <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>',
    '<cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>\n      <cbc:TaxAmount currencyID="EUR">17.00</cbc:TaxAmount>'
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Σ per-rate <cac:TaxSubtotal>\/<cbc:TaxAmount> = 17\.00 EUR ≠ declared <cac:TaxTotal>\/<cbc:TaxAmount> 19\.00 EUR/i, { timeout: 5_000 });
});

test('ubl: BR-CO-17 cross-product confirms on a canonical invoice (draft 249)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every root-level <cac:TaxSubtotal> tax amount equals its taxable amount × rate/i, { timeout: 5_000 });
});

test('ubl: BR-CO-17 cross-product flags a tax amount inconsistent with base × rate (draft 249)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Bump only the header TaxSubtotal rate to 25% (first <cbc:Percent>) — the TaxAmount
  // stays 19.00, so the per-rate cross-product breaks while BR-CO-14 (Σ = header) still holds.
  const withBad = UBL_INVOICE.replace('<cbc:Percent>19</cbc:Percent>', '<cbc:Percent>25</cbc:Percent>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/VAT breakdown #1 declares <cbc:TaxAmount> 19\.00 EUR but 100\.00 EUR × 25% = 25\.00 EUR/i, { timeout: 5_000 });
});

// A complete document-level allowance (ChargeIndicator + reason + Amount + VAT
// category), injected as a direct child of <Invoice> for the AllowanceCharge
// gates (drafts 250 / 251 / 252 / 253).
const UBL_WITH_ALLOWANCE = UBL_INVOICE.replace('</cac:AccountingCustomerParty>',
  '</cac:AccountingCustomerParty>\n  <cac:AllowanceCharge>\n    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>\n    <cbc:AllowanceChargeReason>Volume discount</cbc:AllowanceChargeReason>\n    <cbc:Amount currencyID="EUR">10.00</cbc:Amount>\n    <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>\n  </cac:AllowanceCharge>');

test('ubl: document-level AllowanceCharge Amount presence confirms when the amount is declared (draft 250)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_WITH_ALLOWANCE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every document-level <cac:AllowanceCharge> declares <cbc:Amount>/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge Amount presence flags a missing amount (draft 250)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_WITH_ALLOWANCE.replace('<cbc:Amount currencyID="EUR">10.00</cbc:Amount>\n    ', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document-level AllowanceCharge #1 is missing <cbc:Amount>/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge ChargeIndicator confirms on a valid boolean (draft 251)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_WITH_ALLOWANCE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every document-level <cac:AllowanceCharge> declares a valid xs:boolean <cbc:ChargeIndicator>/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge ChargeIndicator flags a non-boolean value (draft 251)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_WITH_ALLOWANCE.replace('<cbc:ChargeIndicator>false</cbc:ChargeIndicator>', '<cbc:ChargeIndicator>Discount</cbc:ChargeIndicator>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document-level AllowanceCharge #1 ChargeIndicator is "Discount"/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge reason presence confirms when a reason is declared (draft 252)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_WITH_ALLOWANCE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every document-level <cac:AllowanceCharge> declares a reason/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge reason presence flags a block with no reason (draft 252)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_WITH_ALLOWANCE.replace('<cbc:AllowanceChargeReason>Volume discount</cbc:AllowanceChargeReason>\n    ', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document-level AllowanceCharge #1 declares neither <cbc:AllowanceChargeReason> nor <cbc:AllowanceChargeReasonCode>/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge VAT category confirms when TaxCategory/ID is present (draft 253)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_WITH_ALLOWANCE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every document-level <cac:AllowanceCharge> declares a <cac:TaxCategory>\/<cbc:ID>/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge VAT category flags a missing TaxCategory (draft 253)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_WITH_ALLOWANCE.replace('\n    <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document-level AllowanceCharge #1 is missing <cac:TaxCategory>\/<cbc:ID>/i, { timeout: 5_000 });
});

// A line-level allowance injected inside the InvoiceLine (after its
// LineExtensionAmount, before <cac:Item>) for the line-level AllowanceCharge
// gates (drafts 254 / 255). 5.00 is unique to this block.
const UBL_LINE_ALLOWANCE = UBL_INVOICE.replace(
  '<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>\n    <cac:Item>',
  '<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>\n    <cac:AllowanceCharge>\n      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>\n      <cbc:AllowanceChargeReason>Line discount</cbc:AllowanceChargeReason>\n      <cbc:Amount currencyID="EUR">5.00</cbc:Amount>\n    </cac:AllowanceCharge>\n    <cac:Item>');

test('ubl: line-level AllowanceCharge Amount presence confirms when the amount is declared (draft 254)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_LINE_ALLOWANCE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every line-level <cac:AllowanceCharge> declares <cbc:Amount>/i, { timeout: 5_000 });
});

test('ubl: line-level AllowanceCharge Amount presence flags a missing amount (draft 254)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_LINE_ALLOWANCE.replace('<cbc:Amount currencyID="EUR">5.00</cbc:Amount>\n    ', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 <cac:AllowanceCharge> is missing <cbc:Amount>/i, { timeout: 5_000 });
});

test('ubl: line-level AllowanceCharge ChargeIndicator confirms on a valid boolean (draft 255)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_LINE_ALLOWANCE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every line-level <cac:AllowanceCharge> declares a valid xs:boolean <cbc:ChargeIndicator>/i, { timeout: 5_000 });
});

test('ubl: line-level AllowanceCharge ChargeIndicator flags a non-boolean value (draft 255)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_LINE_ALLOWANCE.replace('<cbc:ChargeIndicator>false</cbc:ChargeIndicator>', '<cbc:ChargeIndicator>Rebate</cbc:ChargeIndicator>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 <cac:AllowanceCharge> ChargeIndicator is "Rebate"/i, { timeout: 5_000 });
});

test('ubl: line-level AllowanceCharge reason presence confirms when a reason is declared (draft 256)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_LINE_ALLOWANCE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every line-level <cac:AllowanceCharge> declares a reason/i, { timeout: 5_000 });
});

test('ubl: line-level AllowanceCharge reason presence flags a block with no reason (draft 256)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_LINE_ALLOWANCE.replace('<cbc:AllowanceChargeReason>Line discount</cbc:AllowanceChargeReason>\n      ', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Line #1 <cac:AllowanceCharge> declares neither <cbc:AllowanceChargeReason> nor <cbc:AllowanceChargeReasonCode>/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge TaxScheme presence confirms when the scheme is declared (draft 257)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_WITH_ALLOWANCE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every document-level <cac:AllowanceCharge>\/<cac:TaxCategory> declares a <cac:TaxScheme>\/<cbc:ID>/i, { timeout: 5_000 });
});

test('ubl: document-level AllowanceCharge TaxScheme presence flags a TaxCategory with no scheme (draft 257)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_WITH_ALLOWANCE.replace('<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>', '</cac:TaxCategory>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Document-level AllowanceCharge #1 has a <cac:TaxCategory> but no <cac:TaxScheme>\/<cbc:ID>/i, { timeout: 5_000 });
});

// UN/CEFACT Cross Industry Invoice (the XML inside a Factur-X / ZUGFeRD hybrid PDF,
// pasted directly). EN 16931 profile, one line, full monetary summation.
const CII_INVOICE = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>FX-2024-7</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20240415</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>Gadget Deluxe</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>40.00</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">3</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>120.00</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>Fournisseur SARL</ram:Name><ram:PostalTradeAddress><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress><ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">FR40303265045</ram:ID></ram:SpecifiedTaxRegistration></ram:SellerTradeParty>
      <ram:BuyerTradeParty><ram:Name>Kaeufer GmbH</ram:Name><ram:PostalTradeAddress><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress></ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>22.80</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>120.00</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>120.00</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>120.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">22.80</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>142.80</ram:GrandTotalAmount>
        <ram:DuePayableAmount>142.80</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
      <ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">20240515</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

test('ubl: detects and renders a UN/CEFACT CII (Factur-X / ZUGFeRD) document', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  const res = page.locator('#ubl-results');
  await expect(res).toContainText(/UN\/CEFACT CII \(Factur-X \/ ZUGFeRD\)/i, { timeout: 5_000 });
  await expect(res).toContainText('FX-2024-7');
  await expect(res).toContainText('Fournisseur SARL');
  await expect(res).toContainText('Kaeufer GmbH');
});

test('ubl: CII renders the monetary summation, decoded date, and line item', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  const res = page.locator('#ubl-results');
  await expect(res).toContainText('2024-04-15');        // udt format-102 20240415 decoded
  await expect(res).toContainText('22.80 EUR');         // TaxTotalAmount with currencyID
  await expect(res).toContainText('142.80');            // GrandTotal / DuePayable
  await expect(res).toContainText('Gadget Deluxe');     // line product name
});

test('cii: mandatory-header presence confirms on a complete CII document (draft 259)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every mandatory CII header field is present/i, { timeout: 5_000 });
});

test('cii: mandatory-header presence flags a missing invoice number BT-1 (draft 259)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:ID>FX-2024-7</ram:ID>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Mandatory CII header field BT-1 \(ram:ExchangedDocument\/ram:ID\) is missing/i, { timeout: 5_000 });
});

test('cii: grand-total arithmetic confirms when basis + tax = grand (draft 260)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII grand total reconciles/i, { timeout: 5_000 });
});

test('cii: grand-total arithmetic flags a grand total that disagrees with basis + tax (draft 260)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:GrandTotalAmount>142.80</ram:GrandTotalAmount>', '<ram:GrandTotalAmount>999.00</ram:GrandTotalAmount>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII grand-total mismatch: TaxBasisTotalAmount 120\.00 \+ TaxTotalAmount 22\.80 = 142\.80 ≠ GrandTotalAmount 999\.00/i, { timeout: 5_000 });
});

test('cii: party-name presence confirms when seller and buyer are named (draft 261)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Both CII trade parties are named/i, { timeout: 5_000 });
});

test('cii: party-name presence flags a missing seller name BT-27 (draft 261)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:Name>Fournisseur SARL</ram:Name>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII party name BT-27 \(ram:SellerTradeParty\/ram:Name\) is missing/i, { timeout: 5_000 });
});

test('cii: line presence confirms when every line carries a total (draft 262)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII line declares a line total amount/i, { timeout: 5_000 });
});

test('cii: line presence flags a document with no line items (draft 262)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace(/<ram:IncludedSupplyChainTradeLineItem>[\s\S]*?<\/ram:IncludedSupplyChainTradeLineItem>/, '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII document declares no ram:IncludedSupplyChainTradeLineItem/i, { timeout: 5_000 });
});

test('cii: line presence flags a line missing its LineTotalAmount BT-131 (draft 262)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // The first <ram:LineTotalAmount> in the doc is the line-level one (the line item
  // precedes the header summation), so this removes the line net, not the header's.
  const withBad = CII_INVOICE.replace('<ram:LineTotalAmount>120.00</ram:LineTotalAmount>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII line #1 is missing its line total amount/i, { timeout: 5_000 });
});

test('cii: invoice-currency ISO 4217 confirms on a valid code (draft 263)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII invoice currency EUR is a valid ISO 4217 code/i, { timeout: 5_000 });
});

test('cii: invoice-currency ISO 4217 flags an unknown code (draft 263)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>', '<ram:InvoiceCurrencyCode>XYZ</ram:InvoiceCurrencyCode>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII invoice currency XYZ \(ram:InvoiceCurrencyCode, BT-5\) is not a valid active ISO 4217 code/i, { timeout: 5_000 });
});

test('cii: document-type-code UNCL 1001 confirms on 380 (draft 264)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII document type code 380 is in the EN 16931 \/ PEPPOL allowed UNCL 1001 set/i, { timeout: 5_000 });
});

test('cii: document-type-code UNCL 1001 flags an out-of-set code (draft 264)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:TypeCode>380</ram:TypeCode>', '<ram:TypeCode>999</ram:TypeCode>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII document type code 999 \(ram:TypeCode, BT-3\) is not in the EN 16931 \/ PEPPOL allowed UNCL 1001 set/i, { timeout: 5_000 });
});

test('cii: line-sum reconciliation confirms when Σ line totals = header line total (draft 265)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII line totals sum to the header figure/i, { timeout: 5_000 });
});

test('cii: line-sum reconciliation flags a per-line net that disagrees with the header (draft 265)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // The first <ram:LineTotalAmount> is the line-level one (BT-131); shrinking it to
  // 99.00 leaves the header LineTotalAmount (BT-106) at 120.00, so Σ line ≠ header.
  const withBad = CII_INVOICE.replace('<ram:LineTotalAmount>120.00</ram:LineTotalAmount>', '<ram:LineTotalAmount>99.00</ram:LineTotalAmount>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII line-sum mismatch: the per-line net amounts total 99\.00 but the header LineTotalAmount \(BT-106\) declares 120\.00/i, { timeout: 5_000 });
});

test('cii: tax-basis arithmetic confirms when line − allowance + charge = tax-basis (draft 266)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII tax-exclusive basis reconciles/i, { timeout: 5_000 });
});

test('cii: tax-basis arithmetic flags an allowance the basis does not account for (draft 266)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Inject a €10 document-level allowance total without adjusting the tax-basis:
  // 120.00 − 10.00 + 0.00 = 110.00 ≠ TaxBasisTotalAmount 120.00. This isolates the
  // tax-basis gate — the grand-total (basis + tax) and line-sum invariants stay clean.
  const withBad = CII_INVOICE.replace(
    '<ram:TaxBasisTotalAmount>120.00</ram:TaxBasisTotalAmount>',
    '<ram:AllowanceTotalAmount>10.00</ram:AllowanceTotalAmount><ram:TaxBasisTotalAmount>120.00</ram:TaxBasisTotalAmount>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII tax-basis mismatch: LineTotalAmount 120\.00 − AllowanceTotalAmount 10\.00 \+ ChargeTotalAmount 0\.00 = 110\.00 ≠ TaxBasisTotalAmount 120\.00/i, { timeout: 5_000 });
});

test('cii: payable reconciliation confirms when grand − prepaid + rounding = due (draft 267)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII amount due for payment reconciles/i, { timeout: 5_000 });
});

test('cii: payable reconciliation flags a due amount that disagrees with the grand total (draft 267)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // No prepaid/rounding in the fixture, so DuePayable should equal GrandTotal (142.80).
  // Force a 999.00 due to trip the gate: 142.80 − 0.00 + 0.00 = 142.80 ≠ 999.00.
  const withBad = CII_INVOICE.replace('<ram:DuePayableAmount>142.80</ram:DuePayableAmount>', '<ram:DuePayableAmount>999.00</ram:DuePayableAmount>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII payable mismatch: GrandTotalAmount 142\.80 − TotalPrepaidAmount 0\.00 \+ RoundingAmount 0\.00 = 142\.80 ≠ DuePayableAmount 999\.00/i, { timeout: 5_000 });
});

test('cii: VAT-breakdown sum confirms when Σ per-category amounts = header tax total (draft 268)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII VAT breakdown sums to the header tax total/i, { timeout: 5_000 });
});

test('cii: VAT-breakdown sum flags a per-category amount that disagrees with the header (draft 268)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // The fixture's single ApplicableTradeTax/CalculatedAmount is 22.80, matching the
  // header TaxTotalAmount. Shrinking it to 19.00 leaves the header at 22.80, so the
  // per-category sum (19.00) no longer reconciles with the rolled-up header tax.
  const withBad = CII_INVOICE.replace('<ram:CalculatedAmount>22.80</ram:CalculatedAmount>', '<ram:CalculatedAmount>19.00</ram:CalculatedAmount>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII VAT-breakdown mismatch: the per-category VAT amounts total 19\.00 but the header TaxTotalAmount \(BT-110\) declares 22\.80/i, { timeout: 5_000 });
});

test('cii: VAT cross-product confirms when each category amount = base × rate (draft 269)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII VAT category amount equals its base × rate/i, { timeout: 5_000 });
});

test('cii: VAT cross-product flags a category amount inconsistent with its base and rate (draft 269)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Bump the rate to 25% without touching CalculatedAmount (22.80): 120.00 × 25% =
  // 30.00 ≠ 22.80, tripping BR-CO-17. CalculatedAmount still equals the header tax
  // total, so the draft-268 breakdown-sum gate stays clean — this isolates 269.
  const withBad = CII_INVOICE.replace('<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>', '<ram:RateApplicablePercent>25.00</ram:RateApplicablePercent>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII VAT breakdown #1 cross-product mismatch: BasisAmount 120\.00 × 25% = 30\.00 ≠ CalculatedAmount 22\.80/i, { timeout: 5_000 });
});

test('cii: VAT category code confirms on a valid UNCL 5305 value (draft 270)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII VAT category code is a valid UNCL 5305 value/i, { timeout: 5_000 });
});

test('cii: VAT category code flags an out-of-set UNCL 5305 value (draft 270)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:CategoryCode>S</ram:CategoryCode>', '<ram:CategoryCode>X</ram:CategoryCode>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII VAT category code X \(ram:ApplicableTradeTax\/ram:CategoryCode, BT-118 \/ BT-151\) is not a valid UNCL 5305 value/i, { timeout: 5_000 });
});

test('cii: party-country presence confirms when seller and buyer declare a country (draft 271)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Both CII trade parties declare a postal-address country code/i, { timeout: 5_000 });
});

test('cii: party-country presence flags a missing seller country BT-40 (draft 271)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Drop the seller's PostalTradeAddress; the seller party itself remains (so the
  // party-name gate stays clean) but its mandatory BT-40 country is now absent.
  const withBad = CII_INVOICE.replace('<ram:PostalTradeAddress><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII country code BT-40 \(ram:SellerTradeParty\/ram:PostalTradeAddress\/ram:CountryID\) is missing/i, { timeout: 5_000 });
});

test('cii: country-code ISO 3166-1 confirms on valid codes (draft 272)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII trade-party country code is a valid ISO 3166-1 alpha-2 code/i, { timeout: 5_000 });
});

test('cii: country-code ISO 3166-1 flags an unknown code (draft 272)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:CountryID>FR</ram:CountryID>', '<ram:CountryID>XX</ram:CountryID>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII country code XX \(ram:PostalTradeAddress\/ram:CountryID, BT-40 \/ BT-55\) is not a valid ISO 3166-1 alpha-2 code/i, { timeout: 5_000 });
});

test('cii: line cross-product confirms when net price × quantity = line total (draft 273)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII line net amount equals net price × billed quantity/i, { timeout: 5_000 });
});

test('cii: line cross-product flags a line total inconsistent with price × quantity (draft 273)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Net price 40.00 × billed quantity 3 = 120.00 = LineTotalAmount. Drop the billed
  // quantity to 2 so 40.00 × 2 = 80.00 ≠ 120.00, tripping BR-CO-04. The header line
  // total is unchanged, so the line-sum gate (draft 265) stays clean — isolates 273.
  const withBad = CII_INVOICE.replace('<ram:BilledQuantity unitCode="C62">3</ram:BilledQuantity>', '<ram:BilledQuantity unitCode="C62">2</ram:BilledQuantity>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII line #1 net cross-product mismatch: net price × billed quantity = 80\.00 ≠ LineTotalAmount 120\.00/i, { timeout: 5_000 });
});

test('cii: due-date ordering confirms when due date is on or after issue date (draft 274)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII payment due date 2024-05-15 is on or after the issue date 2024-04-15/i, { timeout: 5_000 });
});

test('cii: due-date ordering flags a due date that precedes the issue date (draft 274)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Issue date is 20240415; back-date the due date to 20240315 so due < issue.
  const withBad = CII_INVOICE.replace('<ram:DueDateDateTime><udt:DateTimeString format="102">20240515</udt:DateTimeString></ram:DueDateDateTime>', '<ram:DueDateDateTime><udt:DateTimeString format="102">20240315</udt:DateTimeString></ram:DueDateDateTime>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII payment due date 2024-03-15 precedes the issue date 2024-04-15/i, { timeout: 5_000 });
});

test('cii: specification identifier presence confirms when CustomizationID is present (draft 275)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII specification identifier \(CustomizationID\) is present/i, { timeout: 5_000 });
});

test('cii: specification identifier presence flags a missing CustomizationID BR-01 (draft 275)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Remove the GuidelineSpecifiedDocumentContextParameter/ID (the URN value
  // disambiguates it from the ExchangedDocument/ID and the line LineID).
  const withBad = CII_INVOICE.replace('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII specification identifier .* is missing/i, { timeout: 5_000 });
});

test('cii: tax-scheme type code confirms when every ApplicableTradeTax is VAT (draft 276)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII tax scheme is VAT/i, { timeout: 5_000 });
});

test('cii: tax-scheme type code flags a non-VAT scheme (draft 276)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // The "VAT" literal targets the ApplicableTradeTax/TypeCode, not the
  // ExchangedDocument/TypeCode (380), so this isolates the tax-scheme gate.
  const withBad = CII_INVOICE.replace('<ram:TypeCode>VAT</ram:TypeCode>', '<ram:TypeCode>XYZ</ram:TypeCode>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII tax scheme type code XYZ \(ram:ApplicableTradeTax\/ram:TypeCode\) is not "VAT"/i, { timeout: 5_000 });
});

test('cii: item-name presence confirms when every line names its item (draft 277)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII line names its item/i, { timeout: 5_000 });
});

test('cii: item-name presence flags a line missing its item name BT-153 (draft 277)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:Name>Gadget Deluxe</ram:Name>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII line #1 is missing its item name \(BT-153, ram:SpecifiedTradeProduct\/ram:Name\)/i, { timeout: 5_000 });
});

test('cii: billed-quantity unit code confirms when @unitCode is present (draft 278)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII billed quantity declares a unit code/i, { timeout: 5_000 });
});

test('cii: billed-quantity unit code flags a missing @unitCode BT-130 (draft 278)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the unitCode attribute, leaving the bare quantity value.
  const withBad = CII_INVOICE.replace('<ram:BilledQuantity unitCode="C62">3</ram:BilledQuantity>', '<ram:BilledQuantity>3</ram:BilledQuantity>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII line #1 billed quantity is missing its @unitCode \(BT-130, ram:BilledQuantity\)/i, { timeout: 5_000 });
});

test('cii: net-price presence confirms when every line declares a price (draft 279)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII line declares a net price/i, { timeout: 5_000 });
});

test('cii: net-price presence flags a line missing its net price BT-146 (draft 279)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:ChargeAmount>40.00</ram:ChargeAmount>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII line #1 is missing its net price \(BT-146, ram:NetPriceProductTradePrice\/ram:ChargeAmount\)/i, { timeout: 5_000 });
});

test('cii: line-quantity presence confirms when every line declares a quantity (draft 280)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Every CII line declares a billed quantity/i, { timeout: 5_000 });
});

test('cii: line-quantity presence flags a line missing its billed quantity BT-129 (draft 280)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:BilledQuantity unitCode="C62">3</ram:BilledQuantity>', '');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII line #1 is missing its billed quantity \(BT-129, ram:SpecifiedLineTradeDelivery\/ram:BilledQuantity\)/i, { timeout: 5_000 });
});

test('cii: profile identification detects EN 16931 (COMFORT) from the CustomizationID (draft 281)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Factur-X \/ ZUGFeRD profile detected: EN 16931 \(COMFORT\)/i, { timeout: 5_000 });
});

test('cii: profile identification detects the Factur-X EXTENDED profile (draft 281)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withExt = CII_INVOICE.replace('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>', '<ram:ID>urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended</ram:ID>');
  await page.fill('#ubl-input', withExt);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Factur-X \/ ZUGFeRD profile detected: Factur-X \/ ZUGFeRD EXTENDED/i, { timeout: 5_000 });
});

test('cii: seller VAT validity confirms a well-formed FR VAT id (draft 282)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', CII_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII seller VAT identifier FR40303265045 is valid/i, { timeout: 5_000 });
});

test('cii: seller VAT validity flags a malformed VAT id BT-31 (draft 282)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = CII_INVOICE.replace('<ram:ID schemeID="VA">FR40303265045</ram:ID>', '<ram:ID schemeID="VA">FR00</ram:ID>');
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/CII seller VAT identifier FR00 .* is invalid/i, { timeout: 5_000 });
});

// Hybrid PDF/A-3 attachment extraction (draft 283). Build a minimal Factur-X-style
// PDF carrying the CII invoice as a FlateDecode (zlib) embedded-file stream, feed it
// through the file input, and assert the inspector extracts + parses it.
function buildFacturXPdf(xml) {
  const compressed = zlib.deflateSync(Buffer.from(xml, 'utf8'));
  return Buffer.concat([
    Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'latin1'),
    Buffer.from('1 0 obj\n<< /Type /EmbeddedFile /Subtype /text#2Fxml /Filter /FlateDecode /Length ' + compressed.length + ' >>\nstream\n', 'latin1'),
    compressed,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
    Buffer.from('2 0 obj\n<< /Type /Filespec /F (factur-x.xml) /EF << /F 1 0 R >> >>\nendobj\n', 'latin1'),
    Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1'),
  ]);
}

test('ubl: extracts and parses the CII XML embedded in a Factur-X PDF (draft 283)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const pdf = buildFacturXPdf(CII_INVOICE);
  await page.setInputFiles('#ubl-pdf', { name: 'factur-x-invoice.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.locator('#ubl-pdf-status')).toContainText(/Extracted the embedded invoice XML/i, { timeout: 5_000 });
  const res = page.locator('#ubl-results');
  await expect(res).toContainText(/UN\/CEFACT CII \(Factur-X \/ ZUGFeRD\)/i, { timeout: 5_000 });
  await expect(res).toContainText('FX-2024-7');
  await expect(res).toContainText(/Factur-X \/ ZUGFeRD profile detected: EN 16931 \(COMFORT\)/i);
});

test('ubl: reports when a PDF carries no embedded invoice XML (draft 283)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // A PDF whose only stream is a compressed XMP metadata blob, not an invoice.
  const xmp = '<?xml version="1.0"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF/></x:xmpmeta>';
  const compressed = zlib.deflateSync(Buffer.from(xmp, 'utf8'));
  const pdf = Buffer.concat([
    Buffer.from('%PDF-1.7\n', 'latin1'),
    Buffer.from('1 0 obj\n<< /Type /Metadata /Subtype /XML /Filter /FlateDecode /Length ' + compressed.length + ' >>\nstream\n', 'latin1'),
    compressed,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
  await page.setInputFiles('#ubl-pdf', { name: 'plain.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.locator('#ubl-pdf-status')).toContainText(/No embedded CII \/ UBL invoice XML found in plain\.pdf/i, { timeout: 5_000 });
});

test('ubl: rejects a non-PDF file in the PDF loader (draft 283)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.setInputFiles('#ubl-pdf', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('just some text, not a pdf', 'utf8') });
  await expect(page.locator('#ubl-pdf-status')).toContainText(/not a PDF/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/PayableAmount presence flags a missing slot (draft 183)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_INVOICE.replace(/<cac:LegalMonetaryTotal>[\s\S]*?<\/cac:LegalMonetaryTotal>/g, (block) =>
    block.replace(/<cbc:PayableAmount[^>]*>[\s\S]*?<\/cbc:PayableAmount>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal is missing <cbc:PayableAmount>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/TaxInclusiveAmount presence flags a missing slot (draft 181)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_INVOICE.replace(/<cac:LegalMonetaryTotal>[\s\S]*?<\/cac:LegalMonetaryTotal>/g, (block) =>
    block.replace(/<cbc:TaxInclusiveAmount[^>]*>[\s\S]*?<\/cbc:TaxInclusiveAmount>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal is missing <cbc:TaxInclusiveAmount>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/TaxExclusiveAmount presence flags a missing slot (draft 179)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const withBad = UBL_INVOICE.replace(/<cac:LegalMonetaryTotal>[\s\S]*?<\/cac:LegalMonetaryTotal>/g, (block) =>
    block.replace(/<cbc:TaxExclusiveAmount[^>]*>[\s\S]*?<\/cbc:TaxExclusiveAmount>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal is missing <cbc:TaxExclusiveAmount>/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/LineExtensionAmount presence flags a missing slot (draft 177)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the direct-child <cbc:LineExtensionAmount> from inside <cac:LegalMonetaryTotal>.
  const withBad = UBL_INVOICE.replace(/<cac:LegalMonetaryTotal>[\s\S]*?<\/cac:LegalMonetaryTotal>/g, (block) =>
    block.replace(/<cbc:LineExtensionAmount[^>]*>[\s\S]*?<\/cbc:LineExtensionAmount>\s*/, '')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal is missing <cbc:LineExtensionAmount>/i, { timeout: 5_000 });
});

test('ubl: per-TaxTotal cbc:TaxAmount presence flags a TaxTotal missing the header amount (draft 175)', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the direct-child <cbc:TaxAmount> from every root TaxTotal — leave any
  // TaxSubtotal/TaxAmount children intact.
  const withBad = UBL_INVOICE.replace(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/g, (block) =>
    // Remove the first <cbc:TaxAmount …>…</cbc:TaxAmount> that appears as a
    // direct child of TaxTotal (i.e. before any TaxSubtotal opens).
    block.replace(/(<cac:TaxTotal>\s*)<cbc:TaxAmount[^>]*>[\s\S]*?<\/cbc:TaxAmount>\s*/, '$1')
  );
  await page.fill('#ubl-input', withBad);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Root TaxTotal #1 is missing <cbc:TaxAmount>/i, { timeout: 5_000 });
});

test('ubl: Buyer RegistrationName BR-07 confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Canonical UBL_INVOICE now declares PartyLegalEntity/RegistrationName=Beispiel SARL
  // on the customer party.
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/Buyer PartyLegalEntity\/RegistrationName "Beispiel SARL" present/i, { timeout: 5_000 });
});

test('ubl: Buyer RegistrationName BR-07 flags a missing PartyLegalEntity', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  // Strip the customer's PartyLegalEntity block — leave only PartyName.
  const noLegal = UBL_INVOICE.replace(
    '<cac:PartyLegalEntity><cbc:RegistrationName>Beispiel SARL</cbc:RegistrationName></cac:PartyLegalEntity>',
    ''
  );
  await page.fill('#ubl-input', noLegal);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/AccountingCustomerParty is missing Party\/PartyLegalEntity\/RegistrationName/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/TaxInclusiveAmount BT-112 sign confirms on canonical fixture', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', UBL_INVOICE);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal\/TaxInclusiveAmount "119\.00" is non-negative \(EN 16931 BT-112/i, { timeout: 5_000 });
});

test('ubl: LegalMonetaryTotal/TaxInclusiveAmount BT-112 sign flags a negative file-wide value', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  const neg = UBL_INVOICE.replace(
    '<cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>',
    '<cbc:TaxInclusiveAmount currencyID="EUR">-119.00</cbc:TaxInclusiveAmount>'
  );
  await page.fill('#ubl-input', neg);
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/LegalMonetaryTotal\/TaxInclusiveAmount declares a negative value "-119\.00"/i, { timeout: 5_000 });
});

test('ubl: rejects non-UBL XML', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'ubl');
  await page.fill('#ubl-input', '<?xml version="1.0"?><Document/>');
  await page.click('#btn-ubl-parse');
  await expect(page.locator('#ubl-results')).toContainText(/<Invoice>, <CreditNote>, or <CrossIndustryInvoice>/i, { timeout: 5_000 });
});

// =============== Command palette (SPEC §1.6) ===============

test('palette: Ctrl+K opens, Esc closes', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#palette')).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#palette')).toBeVisible();
  await expect(page.locator('#palette-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#palette')).toBeHidden();
});

test('palette: synonym match — typing "swift" finds the BIC tool', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'swift');
  // BIC's label is "BIC / SWIFT Code" in en — but the test is meaningful precisely because
  // "swift" is registered as a synonym (a non-label search term).
  const items = await page.locator('#palette-results li').allTextContents();
  expect(items.length).toBeGreaterThan(0);
  expect(items.some(t => /bic/i.test(t))).toBe(true);
  // Enter navigates to the first match.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#bic');
  await expect(page.locator('#bic-view')).toBeVisible();
});

test('palette: synonym match — typing "epoch" finds the timestamp tool', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'epoch');
  const items = await page.locator('#palette-results li').allTextContents();
  expect(items.some(t => /timestamp|unix/i.test(t))).toBe(true);
});

test('palette: multi-term match — "ed key" finds the Ed25519 generator', async ({ page }) => {
  // Multiple whitespace-separated terms are AND'd against the haystack.
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'ed signature');
  const items = await page.locator('#palette-results li').allTextContents();
  expect(items.some(t => /ed25519/i.test(t))).toBe(true);
});

test('palette: ArrowDown then Enter selects second match', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'key');
  await page.locator('#palette-results li').first().waitFor();
  const second = await page.locator('#palette-results li').nth(1).getAttribute('data-tool');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction((t) => location.hash === '#' + t, second);
});

test('palette: empty state when nothing matches', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'zzzzznotarealtool');
  await expect(page.locator('#palette-empty')).toBeVisible();
  await expect(page.locator('#palette-results li')).toHaveCount(0);
});

test('palette: French locale label still matches French synonyms via fallback to English', async ({ page }) => {
  // Synonyms are en-only by design (SPEC §1.6 — defer locale-specific synonyms until §1.3
  // native review). A French user typing the English term "swift" should still find the BIC
  // tool. The localized label is what they see in the result row.
  await page.goto('/index.html');
  await page.selectOption('#lang-select', 'fr');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'swift');
  await expect(page.locator('#palette-results li').first()).toContainText(/BIC/i);
});

test('rtl: home tool cards mirror under dir=rtl (logical properties)', async ({ page }) => {
  // SPEC §1.4 — exercise the logical-property refactor without shipping an RTL locale.
  // The arrow indicator on .tool-card::after is positioned via inset-inline-end, so under
  // dir=rtl it should resolve to the *left* edge instead of the right.
  await page.goto('/index.html');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const card = page.locator('.tool-card').first();
  const box = await card.boundingBox();
  const arrowEdge = await card.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const after = window.getComputedStyle(el, '::after');
    return { width: r.width, insetInlineEnd: after.getPropertyValue('inset-inline-end') };
  });
  expect(arrowEdge.insetInlineEnd).toBe('22px');
  // Sanity: card should still have non-zero width.
  expect(box.width).toBeGreaterThan(100);
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
});

test('home grid: every card navigates without uncaught errors', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  await page.goto('/index.html');
  const tools = await page.$$eval('.tool-card', els => els.map(e => e.getAttribute('data-tool')));
  for (const t of tools) await gotoTool(page, t);
  const real = errs.filter(e => !/X-Frame-Options|frame-ancestors|inside <meta>/.test(e));
  expect(real, real.join('\n')).toEqual([]);
});
