# Tasks — Post-Quantum Crypto (ML-KEM / ML-DSA)

## 1. Shared polynomial-ring helpers

- [ ] 1.1 `pqcBytesToBits` / `pqcBitsToBytes`, `pqcByteEncode(d)` / `pqcByteDecode(d)` (FIPS 203 Algorithms 5–6, reused by FIPS 204 packing), hex / Base64 in and out through the existing codecs.
- [ ] 1.2 Montgomery / Barrett reduction helpers for q = 3329 (16-bit, `Math.imul` safe) and q = 8380417 (23-bit, split multiplication to stay under 2^53).
- [ ] 1.3 Keccak wrappers: `pqcG` (SHA3-512), `pqcH` (SHA3-256), `pqcJ` (SHAKE256-32), `pqcPrf`, `pqcXof` (incremental SHAKE128 squeeze for matrix sampling) over the page's `keccak()`.

## 2. ML-KEM engine (FIPS 203)

- [ ] 2.1 NTT / inverse NTT over Z_3329 with the ζ table (Algorithms 9–10), `MultiplyNTTs` / `BaseCaseMultiply` (Algorithms 11–12), `SampleNTT` and `SamplePolyCBD_η` (Algorithms 7–8), Compress_d / Decompress_d.
- [ ] 2.2 K-PKE KeyGen / Encrypt / Decrypt (Algorithms 13–15) parameterised for k = 3 (768) and k = 4 (1024).
- [ ] 2.3 `mlkemKeyGen(d, z)`, `mlkemEncaps(ek, m)`, `mlkemDecaps(dk, c)` (Algorithms 16–18 via the `_internal` variants) with the mandated ek modulus check and dk hash check, implicit rejection by constant-time select.
- [ ] 2.4 Hybrid: `hybridX25519Mlkem768(mlkemSs, x25519Ss)` concatenation labelled per the TLS key-share draft, optional HKDF-SHA-256 via the X25519 tool's path; `xwingCombine(...)` per draft-irtf-cfrg-hybrid-kems / X-Wing with the draft name in the label constant.
- [ ] 2.5 Node-side check against the NIST ACVP ML-KEM keyGen and encapDecap vectors for both parameter sets; cross-check once against `@noble/post-quantum` (dev dependency).

## 3. ML-DSA engine (FIPS 204)

- [ ] 3.1 NTT / inverse NTT over Z_8380417 (Algorithms 41–42), `Power2Round`, `Decompose`, `HighBits` / `LowBits`, `MakeHint` / `UseHint` (Algorithms 35–40), `ExpandA` / `ExpandS` / `ExpandMask` (Algorithms 32–34), `SampleInBall` (Algorithm 29).
- [ ] 3.2 Encodings: `pkEncode` / `pkDecode`, `skEncode` / `skDecode`, `sigEncode` / `sigDecode`, `w1Encode`, `HintBitPack` / `HintBitUnpack` (Algorithms 22–28) for ML-DSA-65 (k=6, l=5, η=4) and ML-DSA-87 (k=8, l=7, η=2).
- [ ] 3.3 `mldsaKeyGen(ξ)`, `mldsaSign(sk, M, ctx, rnd)`, `mldsaVerify(pk, M, sig, ctx)` (Algorithms 1–3 via 6–8), strict rejection on length, hint count, and z / h bounds.
- [ ] 3.4 Web Crypto preference: `pqcWebCryptoAvailable(name)` probing `crypto.subtle.supports?.()` in try/catch; dispatch per operation with an "engine" result row.
- [ ] 3.5 Node-side check against the NIST ACVP ML-DSA keyGen / sigGen (deterministic) / sigVer vectors for both parameter sets; cross-check once against `@noble/post-quantum`.

## 4. View

- [ ] 4.1 `#pqc-view`: algorithm tabs (`#pqc-mode` ML-KEM / ML-DSA / Hybrid), parameter select `#pqc-param`, key fields `#pqc-ek` / `#pqc-dk` (masked) / `#pqc-pk` / `#pqc-sk` (masked), `#pqc-ct`, `#pqc-ss`, `#pqc-message` (text or file), `#pqc-ctx`, `#pqc-signature`, advanced `#pqc-seed`; buttons `#btn-pqc-keygen`, `#btn-pqc-encaps`, `#btn-pqc-decaps`, `#btn-pqc-sign`, `#btn-pqc-verify`, `#btn-pqc-selftest`; results `#pqc-results` with byte lengths, engine, wall-clock via `Intl.NumberFormat`.
- [ ] 4.2 Register `#pqc-dk` / `#pqc-sk` / `#pqc-seed` with `clearSensitiveFields()`; zero-fill key `Uint8Array`s after export; no URL / `localStorage` persistence.
- [ ] 4.3 Info panel: FIPS 203 / 204 citations, side-channel caveat, SLH-DSA deferral note, hybrid-definition labels, verdict wording.

## 5. Readiness indicator

- [ ] 5.1 `pqcReadiness(alg, bits, isHybrid)` → `{status, reason}` with the NIST IR 8547 (draft) wording; call from Key Info rendering and `tlsRenderCert()`; link to `pqc`.
- [ ] 5.2 Refresh `#regulator-preset-help` text for the BSI preset (TR-02102-1 2025 edition: ML-KEM / ML-DSA in hybrid) and add the RFC 9980 / OpenPGP.js 6.3.2 sentence to the generator help; no behaviour change in key generation.

## 6. Tests

- [ ] 6.1 `tests/specs/29-pqc.spec.js` (number assigned at implementation): ACVP KATs through `#pqc-seed` for ML-KEM-768 / -1024 and ML-DSA-65 / -87; encaps → decaps round trip; tampered ciphertext yields a different secret with no error; tampered signature and wrong-context rejection; hybrid concatenation against a known X25519 pair; `#btn-pqc-selftest` green; sign + verify wall clock < 1,000 ms; readiness row on an RSA-2048 certificate and on an Ed25519 PGP key; network-silence assertion; XSS payload in the context field rendered inert.
- [ ] 6.2 Register `pqc` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters.

## 7. Wiring and gates

- [ ] 7.1 ~45 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; readiness-row keys in Key Info and TLS parser.
- [ ] 7.2 TOOL_ORDER (after `x25519`), TOOL_TO_GROUP keys, TOOL_SYNONYMS (`pqc post-quantum kyber dilithium ml-kem ml-dsa fips 203 204 lattice hybrid x25519mlkem768`), RELATED_TOOLS (pqc ↔ x25519 ↔ ed25519 ↔ key-info ↔ tls-cert), JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 7.3 README: Features list (Keys 12 → 13), standards cheat sheet rows (FIPS 203, FIPS 204, NIST IR 8547 draft, BSI TR-02102-1 2025, RFC 9980), Per-Tool Security Notes paragraph, THREAT-MODEL.md quantum paragraph cross-link; SPEC-INTERNATIONAL.md status note.
- [ ] 7.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
