// ===================================================================
// 23 — Release-manifest signing (SPEC §4.2). scripts/verify-release-
// signature.js is a dependency-free minisign verifier that audit-release.js
// runs in CI. The fixtures under tests/fixtures/minisign/ were produced by
// the reference `minisign 0.12` with a throwaway key (secret discarded), so
// these cases pin interoperability, not just self-consistency.
// ===================================================================

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FX = path.join(ROOT, 'tests/fixtures/minisign');
const { verifyMinisign } = createRequire(import.meta.url)(path.join(ROOT, 'scripts/verify-release-signature.js'));
const read = f => fs.readFileSync(path.join(FX, f));
const text = f => read(f).toString('utf8');

test('minisign: verifies a prehashed (ED) signature and its trusted comment', () => {
  const r = verifyMinisign(read('msg.txt'), text('msg.txt.minisig'), text('test.pub'));
  expect(r).toMatchObject({ ok: true, keyId: '922C5652E9187228', trustedComment: 'trusted test comment', prehashed: true });
});

test('minisign: verifies a legacy (Ed) signature', () => {
  const r = verifyMinisign(read('msg-legacy.txt'), text('msg-legacy.txt.minisig'), text('test.pub'));
  expect(r).toMatchObject({ ok: true, prehashed: false });
});

test('minisign: a one-byte change to the file fails', () => {
  const tampered = Buffer.from(read('msg.txt'));
  tampered[tampered.length - 2] ^= 0x20;
  expect(verifyMinisign(tampered, text('msg.txt.minisig'), text('test.pub'))).toMatchObject({ ok: false, error: 'file signature does not verify' });
});

test('minisign: an edited trusted comment fails', () => {
  const sig = text('msg.txt.minisig').replace('trusted test comment', 'trusted TEST comment');
  expect(verifyMinisign(read('msg.txt'), sig, text('test.pub'))).toMatchObject({ ok: false, error: 'trusted-comment signature does not verify' });
});

test('minisign: a signature from a different key is rejected by key id', () => {
  const r = verifyMinisign(read('msg.txt'), text('msg.txt.minisig'), text('other.pub'));
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/^signed by key 922C5652E9187228, expected [0-9A-F]{16}$/);
});

test('minisign: malformed inputs are reported, not thrown', () => {
  expect(verifyMinisign(read('msg.txt'), 'junk', text('test.pub')).error).toBe('malformed signature');
  expect(verifyMinisign(read('msg.txt'), text('msg.txt.minisig'), 'junk').error).toBe('malformed public key');
});

test('release: if RELEASES.md is committed it verifies against minisign.pub', () => {
  const rel = path.join(ROOT, 'RELEASES.md');
  test.skip(!fs.existsSync(rel), 'no RELEASES.md yet');
  const r = verifyMinisign(fs.readFileSync(rel), fs.readFileSync(rel + '.minisig', 'utf8'), fs.readFileSync(path.join(ROOT, 'minisign.pub'), 'utf8'));
  expect(r.ok, r.error).toBe(true);
});
