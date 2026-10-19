# Tasks — Supply-Chain Artifact Inspector

## 1. Shared key, digest and signature helpers

- [ ] 1.1 `supplyImportPublicKey(text) → CryptoKey + {kind, spkiDer}` accepting PEM SPKI, raw 32-byte Ed25519 (JWK tool's 12-byte prefix), `ssh-ed25519` / `ecdsa-sha2-nistp256` lines (SSH Key Parser wire reader), `RWS…` minisign keys; `spkiSha256(key)` for keyid comparison.
- [ ] 1.2 `ecdsaDerToRaw(sig, curve)` via the ASN.1 reader; `supplyDigest(file, alg)` over SHA-256 / 384 / 512 (Web Crypto), BLAKE2b-512 and SHA3-256 (inline); constant-time compare reused from the Hash tool.
- [ ] 1.3 Family auto-detection (`supplyDetect(text | bytes, fileName)`) with manual override.

## 2. SBOM engine

- [ ] 2.1 CycloneDX 1.4–1.6 JSON and XML (DOMParser path from the UBL inspector) → component model; `metadata`, `tools`, `dependencies[]`, `vulnerabilities[]` (VEX) mappers; format-version gate.
- [ ] 2.2 SPDX 2.3 JSON → component model (`packages[]`, `externalRefs` purl, `checksums[]`, `relationships[]`); SPDX 3.0 JSON-LD structural walk of `@graph` `software_Package` elements with the "structural read" gate.
- [ ] 2.3 Hash cross-check: match dropped files by name then by declared hash; compute; MD5 / SHA-1 declared → ⚠ "not computed"; "SBOM has no hashes" ⚠; all-✓ summary wording.
- [ ] 2.4 Verify against the repo's `sbom.json` + `openpgp.min.js`, `qrcode.js`, `secrets.min.js`, `js-yaml.min.js` (all ✓) and a one-byte-tampered copy (✗).

## 3. Attestation, Sigstore, minisign and cosign engines

- [ ] 3.1 `dsseParse(json)`, `dssePae(type, payload)` (DSSE v1.0 byte layout), `dsseVerify(envelope, key)`; in-toto Statement v1 and SLSA provenance v1 renderer; subject-digest-vs-dropped-file check.
- [ ] 3.2 `sigstoreBundleParse(json)`: mediaType version, `verificationMaterial` (certificate → `tls-cert` parser with ~15 Fulcio OIDs `1.3.6.1.4.1.57264.1.1/8–22` added to the OID table; `publicKey` hint), `tlogEntries[]` (kindVersion, `canonicalizedBody` decoded for `hashedrekord` / `intoto` / `dsse`, `inclusionProof`, checkpoint signed-note parse), `rfc3161Timestamps[]` → the timestamp decoder from `eidas-signature-cryptographic-verification`, `messageSignature` / `dsseEnvelope` content.
- [ ] 3.3 Verification rows: (a) artifact digest, (b) signature with leaf key, (c) RFC 6962 §2.1 inclusion fold to `rootHash` and checkpoint root, (d) checkpoint signature with pasted Rekor key (4-byte hint check), (e) leaf → intermediates → pasted Fulcio root minimal path check + signing time within validity (integratedTime or RFC 3161 genTime).
- [ ] 3.4 `minisignParse(sigText, pubText)` / `minisignVerify(fileBytes, sig, pub)` mirroring `scripts/verify-release-signature.js` (legacy `Ed`, prehashed `ED` via inline BLAKE2b, global signature over `sig ‖ trusted comment`, key-id mismatch gate); signify two-line form; SECURITY.md key preset.
- [ ] 3.5 `cosignVerifyBlob(blob, sigB64, pubPem)` — DER ECDSA → raw, `crypto.subtle.verify` ECDSA SHA-256; RSA / Ed25519 key variants.
- [ ] 3.6 Fixtures: existing `tests/fixtures/minisign/*` (reference `minisign 0.12`), `RELEASES.md` + `minisign.pub`; a DSSE envelope signed with a throwaway Ed25519 key; a hand-built bundle with a 2-leaf Merkle tree, self-made Fulcio-style root + leaf and a checkpoint signed with a throwaway P-256 key; a cosign `.sig` made with a throwaway key (secrets discarded, noted in the fixture README).

## 4. View

- [ ] 4.1 `#supply-view`: `#supply-input` textarea + `#supply-file` (artifact JSON / XML / .minisig / .sig), `#supply-artifacts` multi-file drop (the files being described or signed), `#supply-key` textarea (public key / Fulcio root / Rekor key, with `#btn-supply-key-preset-release`), `#supply-family` select (auto / sbom / dsse / sigstore / minisign / cosign), `#btn-supply-inspect`, `#btn-supply-verify`, `#supply-results` (component table, attestation tree, certificate block, log-entry block, timestamp block), `#supply-gates`.
- [ ] 4.2 `createElement` / `textContent` only; PURLs and URIs rendered as text; component table virtualized above 2,000 rows.
- [ ] 4.3 Summary wording per the verdict-language requirements ("verifies against the key / root you supplied — this does not establish that the key belongs to the publisher"); link rows to TLS Certificate Parser, Hash & Checksum, Ed25519, JWT, PGP Verify, LOTL viewer.

## 5. Tests

- [ ] 5.1 `tests/specs/NN-supply.spec.js` (number assigned at implementation; 29+): own SBOM all-✓ and tampered ✗; SPDX 2.3 sample from the SPDX examples repository; CycloneDX 1.3 ⚠ gate; no-hashes ⚠; DSSE verify ✓ / wrong key ✗ / PAE byte layout; SLSA v1 fields rendered; bundle fixture rows (a)–(e) ✓, wrong Rekor key ✗ (d), altered inclusion hash ✗ (c), timestamp outside validity ✗ (e), v0.2 bundle "not available" rows; `RELEASES.md` verifies with the pinned key, minisign fixtures (prehashed, legacy, tampered file, edited trusted comment, wrong key id); cosign ✓ / ✗; verdict wording; network-silence assertion; XSS payload in a component name rendered inert.
- [ ] 5.2 Register `supply` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS (10,000-component SBOM), 11-xss rosters.

## 6. Wiring and gates

- [ ] 6.1 ~90 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; CLDR plural groups for "n components", "n hashes matched", "n log entries".
- [ ] 6.2 TOOL_ORDER (after `tls-cert`), TOOL_TO_GROUP keys, TOOL_SYNONYMS (`sbom cyclonedx spdx sigstore cosign rekor fulcio in-toto dsse slsa provenance attestation minisign signify release signature supply chain cra`), RELATED_TOOLS both directions, JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 6.3 README: Features list, standards cheat sheet rows (CycloneDX 1.6 / ECMA-424, SPDX 2.3 / 3.0, DSSE v1.0, in-toto Statement v1, SLSA v1, Sigstore bundle v0.3, RFC 6962, minisign / signify, cosign), Per-Tool Security Notes paragraph (user-supplied roots; release-key preset is a convenience), Releases section pointing to the in-page verifier beside the Node script; SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js` (release-signature gate unchanged); full Playwright suite green.
