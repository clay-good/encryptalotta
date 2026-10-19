# Proposal — Post-Quantum Crypto (ML-KEM / ML-DSA)

## Why

NIST finalised FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), and FIPS 205 (SLH-DSA) in August 2024, and the draft NIST IR 8547 (November 2024) deprecates RSA, ECDSA, ECDH, and DH after 2030 and disallows them after 2035. BSI TR-02102-1 (2025 edition) already recommends ML-KEM and ML-DSA, with post-quantum key agreement only in hybrid with a classical scheme. Chrome, Edge, and Firefox negotiate the TLS hybrid X25519MLKEM768 today. Yet no browser ships ML-KEM or ML-DSA in Web Crypto: the WICG "Modern Algorithms" draft (editor's draft 14 September 2026) names them, Chrome ran an origin trial in June 2026, and nothing is in a stable release. Developers who want to see what an ML-KEM ciphertext or an ML-DSA signature looks like, check a key size, or reproduce a FIPS KAT currently paste material into online demos or install a toolchain.

The page already carries every building block the two algorithms need: a hand-rolled Keccak with SHA3-256 / SHA3-512 / SHAKE128 / SHAKE256 (Hash & Checksum tool), X25519 and HKDF via Web Crypto, hex / Base64 codecs, and the THREAT-MODEL.md "store now, decrypt later" paragraph that already tells users today's PGP keys are not post-quantum. This change gives that paragraph a tool.

## What Changes

- **New tool `pqc` — "Post-Quantum Crypto (ML-KEM / ML-DSA)"** in Keys, after X25519. Tool count **57 → 58**.
- **ML-KEM-768 / ML-KEM-1024** (FIPS 203): generate an encapsulation / decapsulation key pair, encapsulate to a pasted encapsulation key (ciphertext + shared secret), decapsulate a pasted ciphertext. Keys and ciphertexts shown as hex and Base64 with their byte lengths (ek 1184 / 1568, dk 2400 / 3168, ct 1088 / 1568, ss 32). A **hybrid X25519MLKEM768** panel concatenates the ML-KEM-768 and X25519 shared secrets in the order the TLS key-share draft uses and optionally feeds the 64 bytes through the page's HKDF, labelled as the TLS construction; a generic hybrid-KEM combiner (draft-irtf-cfrg-hybrid-kems / X-Wing) is labelled separately when selected.
- **ML-DSA-65 / ML-DSA-87** (FIPS 204): generate a key pair, sign a message (text or file), verify a signature against a pasted public key; optional context string (FIPS 204 §5.2, ≤ 255 bytes); pure (non-prehashed) mode only.
- **Pure JS first** (§7.6) on the existing Keccak; when a browser exposes `crypto.subtle.supports('ML-DSA-65')` / `'ML-KEM-768'` the tool prefers Web Crypto and says which engine produced the result.
- **PQC readiness indicator**: Key Info and the TLS Certificate Parser gain a "Quantum-safe" row (no for RSA / ECC with the NIST IR 8547 dates; hybrids exempt). The PGP generator's regulator-preset help text is refreshed (BSI 2025 edition recommends ML-KEM / ML-DSA in hybrid; OpenPGP PQC is RFC 9980 and OpenPGP.js 6.3.2 does not implement it, so PQC PGP key generation is explicitly not offered).

Out of scope, and the §7 non-goal each respects: no SLH-DSA (FIPS 205) in this change — its pure-JS signing cost is seconds, and §7.6 forbids WASM until a real user asks; no PQC PGP key generation (library gap, no vendored dependency added, §0.2); no KEM-based file encryption format (no invented formats; age / PGP remain the encryption tools); no network key exchange of any kind (§0.1).

## Capabilities

### New Capabilities
- `ml-kem-key-encapsulation`: ML-KEM-768 / -1024 key generation, encapsulation, decapsulation per FIPS 203, hex + Base64 key formats, FIPS 203 known-answer self-test, optional X25519MLKEM768 hybrid shared-secret combination.
- `ml-dsa-signatures`: ML-DSA-65 / -87 key generation, signing, verification per FIPS 204, FIPS 204 known-answer self-test, Web Crypto preferred when the browser exposes it.
- `pqc-readiness-indicator`: a "Quantum-safe" row in Key Info and the TLS Certificate Parser keyed to NIST IR 8547, plus the regulator-preset help-text refresh in the PGP generator.

### Modified Capabilities
- none (Key Info, the TLS Certificate Parser, and the PGP generator gain a row or a sentence; no OpenSpec baseline exists for them yet, so the additions are specified as the new capability above).

## Impact

- `index.html`: one new view, ~1,100 lines of inline JS (ML-KEM: K-PKE, NTT over Z_3329, compress / decompress, FO transform; ML-DSA: NTT over Z_8380417, power2round / decompose / hint encoding, rejection loop; shared polynomial-ring helpers), ~45 STRINGS keys × 5 locales + 5 en SEO keys, three STRINGS keys for the readiness rows.
- Reuses: `keccak()`, `shake128()`, `shake256()`, SHA3-256 / SHA3-512 (hand-rolled, Hash tool), X25519 + HKDF-SHA-256 via Web Crypto (X25519 tool), hex / Base64 codecs, `clearSensitiveFields()` for the decapsulation / signing keys, `Intl.NumberFormat` for timings.
- No new vendored file, no CSP change, page weight +~14 KB gzipped.
- Tests: new `tests/specs/29-pqc.spec.js` (number assigned at implementation) — FIPS 203 / 204 KATs from the NIST ACVP vector sets via the deterministic-seed input, round trips, tampered-ciphertext and tampered-signature cases, hybrid combination against an X25519 vector, the readiness row on an RSA certificate, wall-clock budget assertions, and the network-silence assertion the suite already uses.
