/* eslint-disable */
// ===================================================================
// 12 — Citation integrity audit (executable).
//
// The app makes normative claims ("MOD-97 per ISO 13616", "600,000
// iterations per OWASP", "alg:none rejected per RFC 8725"). Those
// citations are part of the product's trust surface, so they get the
// same regression protection as code. This spec parses the shipped
// text (README.md + index.html) and the vector suite and asserts:
//
//   * Freshness — current standards are cited; superseded ones are not
//     presented as current (OpenPGP 9580 not 4880; UUID 9562 not 4122).
//   * Formatting — uniform "RFC NNNN" spacing; standards carry their
//     part-number suffix (BSI TR-02102-1).
//   * Presence — the inline citations a user relies on (VIES, OWASP,
//     NIST, RFC 6238/8032/7748) are still in the build.
//   * Correctness — the vector suite cites the right RFC numbers.
//
// Genuine content fixes that this spec-only session cannot apply are
// recorded as test.fixme() with the exact edit, so they stay visible
// and turn green the moment the source is corrected.
// ===================================================================

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VECTORS = fs.readFileSync(path.join(ROOT, 'tests/specs/03-vectors.spec.js'), 'utf8');

// ---------- Formatting ----------
test.describe('citation formatting', () => {
  test('every RFC reference uses the "RFC NNNN" form (a space, never "RFCNNNN")', () => {
    const bad = [...README.matchAll(/RFC\d{3,4}/g), ...INDEX.matchAll(/RFC\d{3,4}/g)].map(m => m[0]);
    expect(bad, `missing-space RFC citations: ${[...new Set(bad)].join(', ')}`).toEqual([]);
  });

  test('NIST SP references use the "NIST SP 800-NNN" form', () => {
    // Catch a compacted "SP800-57" regression.
    const bad = [...README.matchAll(/SP800-\d/g), ...INDEX.matchAll(/SP800-\d/g)].map(m => m[0]);
    expect(bad).toEqual([]);
  });

  test.fixme('BSI TR-02102 always carries its part suffix "-1"', () => {
    // FIX: index.html:115 (meta description) reads "BSI TR-02102" — the only
    // bare occurrence among 24 correct "BSI TR-02102-1". Append "-1" there.
    const bareReadme = (README.match(/TR-02102(?!-)/g) || []).length;
    const bareIndex = (INDEX.match(/TR-02102(?!-)/g) || []).length;
    expect(bareReadme + bareIndex, 'found bare "TR-02102" without the "-1" part suffix').toBe(0);
  });

  test.fixme('BIP-0039 is the canonical spelling in prose (not the colloquial "BIP39")', () => {
    // FIX: README + index.html mix "BIP39" (62×) and "BIP-0039" (13×). The formal
    // BIP name is "BIP-0039"; normalize prose/help-text to it (UI element ids and
    // i18n keys may keep "bip39"). This is a consistency normalization, not a bug.
    const colloquial = (README.match(/\bBIP39\b/g) || []).length;
    expect(colloquial, 'prose still uses the colloquial "BIP39"').toBe(0);
  });
});

// ---------- Freshness ----------
test.describe('citation freshness', () => {
  test('OpenPGP cites RFC 9580 (current), 4880 only as superseded', () => {
    expect(README).toMatch(/RFC 9580/);
    // Any line that mentions 4880 must also mention 9580 — never standalone-current.
    for (const line of README.split('\n')) {
      if (/4880/.test(line)) {
        expect(line, `RFC 4880 cited without RFC 9580 context: "${line.trim()}"`).toMatch(/9580/);
      }
    }
  });

  test('UUID cites RFC 9562 (2024) and not RFC 4122 as the current standard', () => {
    expect(README).toMatch(/RFC 9562/);
    // RFC 9562 obsoletes RFC 4122; the README should not present 4122 as current.
    expect(README).not.toMatch(/RFC 4122/);
  });

  test('SHA family cites FIPS 180-4 (current revision)', () => {
    expect(README).toMatch(/FIPS 180-4/);
    expect(README).not.toMatch(/FIPS 180-[123]\b/); // older revisions
  });

  test('TOTP/HOTP cite RFC 6238 / RFC 4226', () => {
    expect(README).toMatch(/RFC 6238/);
    expect(README).toMatch(/RFC 4226/);
  });

  test('CBOR / COSE / CWT cite RFC 8949 / 9052 / 8392', () => {
    expect(README).toMatch(/RFC 8949/);
    expect(README).toMatch(/RFC 9052/);
    expect(README).toMatch(/RFC 8392/);
  });
});

// ---------- Presence of the inline citations users rely on ----------
test.describe('inline citations present in the shipped app', () => {
  const MUST_CONTAIN = [
    ['VIES (EU VAT verification link)', /ec\.europa\.eu\/taxation_customs\/vies|VIES/],
    ['OWASP (PBKDF2 floor)', /OWASP/],
    ['NIST SP 800-132 (PBKDF2)', /NIST SP 800-132/],
    ['BSI TR-02102-1 (key presets)', /BSI TR-02102-1/],
    ['ANSSI RGS (key presets)', /ANSSI/],
    ['RFC 6238 (TOTP)', /RFC 6238/],
    ['RFC 8032 (Ed25519)', /RFC 8032/],
    ['RFC 7748 (X25519)', /RFC 7748/],
    ['RFC 8725 (JWT alg:none BCP)', /RFC 8725/],
    ['ISO 9362 (BIC)', /ISO 9362/],
  ];
  for (const [label, re] of MUST_CONTAIN) {
    test(`index.html still cites ${label}`, () => {
      expect(INDEX, `${label} citation missing from index.html`).toMatch(re);
    });
  }
});

// ---------- Correctness of the vector suite's own citations ----------
test.describe('vector-suite citations', () => {
  test('JWT example is attributed to RFC 7515 (JWS), never the typo "RFC 7514"', () => {
    expect(VECTORS).toMatch(/RFC 7515/);
    expect(VECTORS).not.toMatch(/RFC 7514/);
  });

  test('PBKDF2 vectors cite RFC 6070 and RFC 7914/RFC 8018', () => {
    expect(VECTORS).toMatch(/RFC 6070/);
    expect(VECTORS).toMatch(/RFC (7914|8018)/);
  });

  test('Base16/32/64 progression cites RFC 4648', () => {
    expect(VECTORS).toMatch(/RFC 4648/);
  });
});

// ---------- Improvement marker: linkable sources ----------
test.fixme('regulator-preset help text should carry a verifiable reference (URL or §)', () => {
  // FIX: preset notes (e.g. 'preset.note.bsi') say "Verify against the BSI document"
  // but provide no link or document section. Add a URL or a precise section ref so a
  // user can trace the iteration-count / curve claim. See the citation punch-list.
  const noteBlock = INDEX.match(/'preset\.note\.bsi':\s*'([^']*)'/);
  expect(noteBlock, "preset.note.bsi string not found").not.toBeNull();
  expect(noteBlock[1], 'BSI preset note lacks a linkable reference')
    .toMatch(/https?:\/\/|§\s*\d/);
});
