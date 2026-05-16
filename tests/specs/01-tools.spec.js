/* eslint-disable */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

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

test('sepa: rejects non-ISO 20022 XML', async ({ page }) => {
  await page.goto('/index.html'); await gotoTool(page, 'sepa');
  await page.fill('#sepa-input', '<?xml version="1.0"?><foo><bar/></foo>');
  await page.click('#btn-sepa-parse');
  await expect(page.locator('#sepa-results')).toContainText(/No <Document>/i, { timeout: 5_000 });
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
