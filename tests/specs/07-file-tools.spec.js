/* eslint-disable */
// File-fixture E2E coverage for the tools that only operate on file uploads/downloads.
// Each test generates its binary fixture programmatically (no shipped binaries) so the
// suite stays self-contained and the assertions are deterministic.
//
// Tools covered here:
//   - encrypt + decrypt (PGP, recipient public key)            — round-trip byte identity
//   - sign + verify (file mode + detached signature)           — happy + tamper detection
//   - stego (hide + reveal in PNG cover)                       — round-trip payload identity
//   - exif (strip EXIF metadata from JPEG)                     — output is well-formed image, EXIF gone
//   - hash (SHA-256 of file fixture)                           — FIPS 180-4 vector
//
// (password-encrypt is already exercised in 03-vectors.spec.js.)

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const PASS = 'CorrectHorseBatteryStaple-9!';
let FIXTURE = null;

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}

// Reuse the PGP keypair from 01-tools.spec.js if present; otherwise generate fresh.
async function ensureFixture(browser) {
  const pubPath = 'reports/fixture-pub.asc';
  const privPath = 'reports/fixture-priv.asc';
  if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
    return {
      pub: fs.readFileSync(pubPath, 'utf8'),
      priv: fs.readFileSync(privPath, 'utf8'),
      pass: PASS,
    };
  }
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
  const f = {
    pub: await page.locator('#public-key-display').textContent(),
    priv: await page.locator('#private-key-display').textContent(),
    pass: PASS,
  };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(pubPath, f.pub);
  fs.writeFileSync(privPath, f.priv);
  await ctx.close();
  return f;
}

// Generate a PNG of given size as a Buffer using the page's canvas. Avoids needing
// a PNG-encoder dep in Node.
async function generatePngBuffer(page, width, height, kind = 'noise') {
  const dataUrl = await page.evaluate(({ w, h, kind }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const buf = img.data;
    if (kind === 'noise') {
      // Pseudo-random noise gives lots of LSB bits to flip without visible artifacts.
      let seed = 0x42424242;
      for (let i = 0; i < buf.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        buf[i] = (seed >>> 0) & 0xff;
        buf[i+1] = (seed >>> 8) & 0xff;
        buf[i+2] = (seed >>> 16) & 0xff;
        buf[i+3] = 0xff;
      }
    } else { // solid red — used for EXIF test where content doesn't matter
      for (let i = 0; i < buf.length; i += 4) {
        buf[i] = 220; buf[i+1] = 50; buf[i+2] = 80; buf[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }, { w: width, h: height, kind });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function generateJpegWithExifBuffer(page, width, height) {
  // Make a JPEG via canvas, then splice an Exif APP1 segment between the SOI marker
  // (FFD8) and the next segment. Real cameras put EXIF here. The exif tool re-encodes
  // the image, dropping all APP segments — that's what we'll verify.
  const dataUrl = await page.evaluate(({ w, h }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cf3848';
    ctx.fillRect(0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.9);
  }, { w: width, h: height });
  const cleanJpeg = Buffer.from(dataUrl.split(',')[1], 'base64');
  // Build a minimal APP1/Exif segment: FFE1 <len> "Exif\0\0" + a tiny TIFF block.
  // The TIFF block is intentionally small/valid: II (little-endian), 0x002A magic,
  // offset to first IFD = 8, then a single Make tag (0x010F) with an inline value.
  const tiff = Buffer.from([
    0x49, 0x49, 0x2a, 0x00,                         // "II*\0" little-endian + magic
    0x08, 0x00, 0x00, 0x00,                         // IFD0 offset = 8
    0x01, 0x00,                                     // 1 directory entry
    0x0f, 0x01, 0x02, 0x00,                         // Tag 0x010F (Make), type ASCII
    0x05, 0x00, 0x00, 0x00,                         // count = 5
    'T'.charCodeAt(0), 'E'.charCodeAt(0), 'S'.charCodeAt(0), 'T'.charCodeAt(0), 0x00,  // "TEST\0"
    0x00, 0x00, 0x00, 0x00,                         // next IFD offset = 0
  ]);
  const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const len = exifPayload.length + 2; // length field is inclusive of itself
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff]),
    exifPayload,
  ]);
  // Insert APP1 after the SOI (first 2 bytes).
  return Buffer.concat([cleanJpeg.subarray(0, 2), app1, cleanJpeg.subarray(2)]);
}

test.beforeAll(async ({ browser }) => {
  FIXTURE = await ensureFixture(browser);
});

// =================================================================
// 1. encrypt + decrypt (PGP file round-trip)
// =================================================================

test('encrypt + decrypt: PGP file round-trip is byte-identical', async ({ page }) => {
  const plaintext = Buffer.concat([
    Buffer.from('header line\n'),
    Buffer.from(Array.from({ length: 256 }, (_, i) => i)),  // full byte sweep
    Buffer.from('\nUTF-8: αβγ 漢字 🔐\n', 'utf8'),
  ]);
  fs.mkdirSync('reports', { recursive: true });
  const inPath = 'reports/pgp-roundtrip-input.bin';
  fs.writeFileSync(inPath, plaintext);

  await page.goto('/index.html');
  await gotoTool(page, 'encrypt');
  await page.fill('#encrypt-public-key', FIXTURE.pub);
  await page.setInputFiles('#encrypt-files', inPath);
  const dlEnc = page.waitForEvent('download', { timeout: 30_000 });
  await page.click('#btn-encrypt');
  await page.waitForFunction(() => {
    const r = document.getElementById('encrypt-result');
    return r && !r.classList.contains('hidden');
  }, { timeout: 60_000 });
  await page.locator('#encrypt-result button').filter({ hasText: /Download|\.pgp/i }).first().click();
  const enc = await dlEnc;
  const encPath = 'reports/pgp-roundtrip-ciphertext.pgp';
  await enc.saveAs(encPath);
  const armored = fs.readFileSync(encPath, 'utf8');
  expect(armored).toMatch(/-----BEGIN PGP MESSAGE-----/);

  // Now decrypt
  await page.reload();
  await gotoTool(page, 'decrypt');
  await page.fill('#decrypt-private-key', FIXTURE.priv);
  await page.fill('#decrypt-passphrase', PASS);
  await page.setInputFiles('#decrypt-files', encPath);
  const dlDec = page.waitForEvent('download', { timeout: 30_000 });
  await page.click('#btn-decrypt');
  await page.waitForFunction(() => {
    const r = document.getElementById('decrypt-result');
    return r && !r.classList.contains('hidden');
  }, { timeout: 60_000 });
  await page.locator('#decrypt-result button').filter({ hasText: /Download/i }).first().click();
  const dec = await dlDec;
  const decPath = 'reports/pgp-roundtrip-recovered.bin';
  await dec.saveAs(decPath);

  const recovered = fs.readFileSync(decPath);
  expect(recovered.length).toBe(plaintext.length);
  expect(recovered.equals(plaintext)).toBe(true);
});

// =================================================================
// 2. sign + verify (detached signature on a file)
// =================================================================

test('sign + verify: detached signature on a file', async ({ page }) => {
  const content = 'This is the file content.\nLine two.\nASCII so we can paste it into verify.';
  const inPath = 'reports/sign-fixture.txt';
  fs.writeFileSync(inPath, content, 'utf8');

  await page.goto('/index.html');
  await gotoTool(page, 'sign');
  await page.fill('#sign-private-key', FIXTURE.priv);
  await page.fill('#sign-passphrase', PASS);
  // Switch to "file" mode
  await page.locator('#sign-view input[name="sign-type"][value="file"]').check();
  await page.setInputFiles('#sign-files', inPath);
  // Sign-file mode produces a detached .sig per file; capture the download.
  const dlSig = page.waitForEvent('download', { timeout: 30_000 });
  await page.click('#btn-sign');
  await page.waitForFunction(() => {
    const r = document.getElementById('sign-result');
    return r && !r.classList.contains('hidden');
  }, { timeout: 30_000 });
  await page.locator('#sign-result button').filter({ hasText: /Download|\.sig|signature/i }).first().click();
  const sigDl = await dlSig;
  const sigPath = 'reports/sign-fixture.txt.sig';
  await sigDl.saveAs(sigPath);
  const sigArmored = fs.readFileSync(sigPath, 'utf8');
  expect(sigArmored).toMatch(/-----BEGIN PGP SIGNATURE-----/);

  // Verify (detached): paste original content + signature
  await page.reload();
  await gotoTool(page, 'verify');
  await page.fill('#verify-public-key', FIXTURE.pub);
  await page.locator('#verify-view input[name="verify-type"][value="detached"]').check();
  await page.fill('#verify-original-message', content);
  await page.fill('#verify-signature', sigArmored);
  await page.click('#btn-verify');
  await expect(page.locator('#verify-result')).toContainText(/valid|verified|signature|✓/i, { timeout: 15_000 });

  // Negative: tampered content should fail
  await page.fill('#verify-original-message', content + 'TAMPER');
  await page.click('#btn-verify');
  await expect(page.locator('#verify-result')).toContainText(/invalid|fail|mismatch|not\s+valid|✗/i, { timeout: 15_000 });
});

// =================================================================
// 3. stego (hide + reveal in PNG cover)
// =================================================================

test('stego: hide + reveal round-trip on PNG cover', async ({ page }) => {
  await page.goto('/index.html');
  // Generate a 256×256 noise PNG for cover (~262 KB pixel data → ~32 KB LSB capacity).
  const coverBuf = await generatePngBuffer(page, 256, 256, 'noise');
  const coverPath = 'reports/stego-cover.png';
  fs.writeFileSync(coverPath, coverBuf);

  const payload = 'Top-secret payload — αβγ 漢字 🔒. Length is reasonable for the LSB capacity test.';

  await gotoTool(page, 'stego');
  await page.click('#stego-mode-hide');
  await page.setInputFiles('#stego-cover', coverPath);
  await page.fill('#stego-payload', payload);
  // Don't set a password — the tool's "no password" path should work too.
  const dl = page.waitForEvent('download', { timeout: 30_000 });
  await page.click('#btn-stego-hide');
  await dl.then(async d => {
    const stegoPath = 'reports/stego-with-payload.png';
    await d.saveAs(stegoPath);
    expect(fs.statSync(stegoPath).size).toBeGreaterThan(coverBuf.length / 2);
  });

  // Reveal
  await page.reload();
  await gotoTool(page, 'stego');
  await page.click('#stego-mode-reveal');
  await page.setInputFiles('#stego-stego-image', 'reports/stego-with-payload.png');
  await page.click('#btn-stego-reveal');
  await page.waitForFunction(p => {
    const out = document.getElementById('stego-output');
    return out && (out.value || '').includes(p);
  }, payload, { timeout: 15_000 });
});

// =================================================================
// 4. exif (strip EXIF metadata from JPEG)
// =================================================================

test('exif: strips EXIF APP1 segment from JPEG', async ({ page }) => {
  await page.goto('/index.html');
  const jpegWithExif = await generateJpegWithExifBuffer(page, 64, 64);
  const inPath = 'reports/exif-input.jpg';
  fs.writeFileSync(inPath, jpegWithExif);
  // Sanity: confirm the fixture really has the APP1/Exif marker we built.
  expect(jpegWithExif.indexOf(Buffer.from('Exif\0\0', 'binary'))).toBeGreaterThan(0);

  await gotoTool(page, 'exif');
  await page.setInputFiles('#exif-files', inPath);
  await page.selectOption('#exif-format', 'image/jpeg');   // force JPEG output regardless of "match"
  // Trigger processing first; the per-file Download button is rendered into #exif-results.
  await page.click('#btn-exif-process');
  await page.waitForSelector('#exif-results button', { timeout: 30_000 });
  // Now arm the download listener and click the per-file Download button.
  const dl = page.waitForEvent('download', { timeout: 15_000 });
  await page.locator('#exif-results button').first().click();
  const cleaned = await dl;
  const outPath = 'reports/exif-output.jpg';
  await cleaned.saveAs(outPath);
  const out = fs.readFileSync(outPath);

  // Output must still be a valid JPEG
  expect(out[0]).toBe(0xff);
  expect(out[1]).toBe(0xd8);
  // The Exif identifier must be gone
  expect(out.indexOf(Buffer.from('Exif\0\0', 'binary')), 'EXIF marker should be stripped from output').toBe(-1);
  // And the literal "TEST" string we put into the IFD0 Make tag must also be gone
  expect(out.indexOf(Buffer.from('TEST\0', 'binary'))).toBe(-1);
});

// =================================================================
// 5. hash file (FIPS 180-4 vector)
// =================================================================

test('hash file: SHA-256 of "abc" file matches FIPS 180-4 §B.1', async ({ page }) => {
  const inPath = 'reports/hash-fixture.txt';
  fs.writeFileSync(inPath, 'abc');

  await page.goto('/index.html'); await gotoTool(page, 'hash');
  await page.setInputFiles('#hash-file', inPath);
  await page.click('#btn-hash-compute');
  await page.waitForFunction(() => {
    const r = document.getElementById('hash-results');
    return r && !r.classList.contains('hidden') && (r.textContent || '').length > 50;
  }, { timeout: 5_000 });
  const out = (await page.locator('#hash-results').textContent()).toLowerCase();
  expect(out).toContain('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  // While we're here, verify all four hashes are emitted (file mode currently goes through the
  // same algos[] loop as text mode, so this guards against regressions in either path).
  expect(out).toContain('a9993e364706816aba3e25717850c26c9cd0d89d');                // SHA-1
  expect(out).toContain('cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7'); // SHA-384
  expect(out).toContain('ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'); // SHA-512
});
