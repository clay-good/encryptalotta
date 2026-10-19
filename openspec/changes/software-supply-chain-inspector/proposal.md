# Proposal — Supply-Chain Artifact Inspector (SBOM / Sigstore / in-toto / minisign)

## Why

The EU **Cyber Resilience Act** makes software bills of materials and signed release evidence a legal matter: vulnerability-reporting duties apply from **11 September 2026**, and the SBOM and CE-marking obligations from **11 December 2027**. Downstream teams now receive CycloneDX or SPDX files, Sigstore bundles, in-toto / SLSA provenance and minisign or cosign signatures with every release — and have no way to read them except `cosign`, `syft` and `jq` on a laptop, or a web viewer that uploads the artifact. The site is itself a publisher of exactly these artifacts: `sbom.json` (CycloneDX 1.5) pins the four vendored libraries by SHA-256 / 384 / 512, and `RELEASES.md` is minisign-signed — but today only a Node script (`scripts/verify-release-signature.js`) can verify it. The page already carries every primitive this needs: the hand-rolled ASN.1 / X.509 reader, BLAKE2b, SHA-2 and Ed25519 / ECDSA / RSA via Web Crypto, the JSON pretty-printer and the ZIP reader.

## What Changes

- **New tool `supply` — "Supply-Chain Artifact Inspector (SBOM / Sigstore / in-toto / minisign)"** in Keys, after the TLS Certificate Parser. Tool count **57 → 58**.
- **SBOM viewing and hash check**: CycloneDX 1.4–1.6 JSON / XML and SPDX 2.3 JSON (SPDX 3.0 JSON-LD structurally) → component table (name, version, PURL, licenses, hashes), dependency-graph counts, metadata / tools, CycloneDX VEX `vulnerabilities`; drop the artifact files and the declared SHA-256 / 384 / 512 are recomputed and compared. The site's own `sbom.json` plus the four vendored libraries is the worked all-✓ example.
- **DSSE and in-toto attestation decoding**: DSSE envelope (payloadType, decoded payload, signatures with keyid), in-toto Statement v1 with subjects and digests, SLSA provenance v1 fields rendered; signatures verified over PAE(`DSSEv1`, payloadType, payload) with a pasted public key (ECDSA P-256 / Ed25519 / RSA via Web Crypto); "subject digest matches dropped file" check.
- **Sigstore bundle inspection**: bundle v0.3 JSON — verificationMaterial (leaf X.509 certificate through the existing certificate parser with Fulcio OIDC extensions `1.3.6.1.4.1.57264.1.*` decoded, or public-key hint), tlogEntries (Rekor `hashedrekord` / `intoto` / `dsse` bodies, inclusion proof, signed checkpoint), RFC 3161 timestamps through the timestamp decoder from `eidas-signature-cryptographic-verification`; five offline verification rows (artifact digest, signature with leaf key, RFC 6962 Merkle inclusion to the checkpoint root, checkpoint signature with a pasted Rekor key, leaf chains to a pasted Fulcio root with signing time inside validity).
- **minisign / signify verification**: parse `.minisig` and signify signatures and `RWS…` public keys; verify legacy `Ed` (Ed25519 over the file) and prehashed `ED` (Ed25519 over BLAKE2b-512) plus the global signature over the trusted comment; key-id mismatch gate. `RELEASES.md` + `RELEASES.md.minisig` + the key pinned in SECURITY.md is the worked example — an in-browser way to verify the release manifest.
- **cosign key-based signatures**: `.sig` = Base64 ECDSA P-256 over SHA-256 of the blob with a pasted `cosign.pub`.
- Related-tool links: Supply-Chain Inspector ↔ TLS Certificate Parser ↔ Hash & Checksum ↔ Ed25519 ↔ JWT ↔ PGP Verify.

Out of scope (and the §7 non-goal it respects): no fetching of Rekor, Fulcio, the Sigstore TUF root, OSV / NVD or any registry (§0.1 / §7.5 — the user pastes the Rekor and Fulcio public material, exactly as the LOTL viewer makes the user paste the trust list); no vulnerability *scanning* or "is this dependency affected" lookup; no SBOM *generation* (`syft`'s job; the site's own SBOM comes from `scripts/build-sbom.js`); no keyless signing, no OIDC flow, no key generation for cosign; no npm / PyPI / Maven registry signatures (npm provenance is a Sigstore bundle and *is* covered); no CE-marking or CRA "compliance checklist" (§7.2). The inspector decodes and verifies against material the user supplies; it never says who a key belongs to.

## Capabilities

### New Capabilities
- `sbom-viewing-and-hash-check`: CycloneDX / SPDX rendering, format-version gate, declared-vs-computed hash cross-check against dropped files.
- `dsse-and-in-toto-attestation-decoding`: DSSE envelope, in-toto Statement v1 and SLSA provenance v1 rendering; PAE signature verification with a pasted key; subject-digest check.
- `sigstore-bundle-inspection`: bundle v0.3 decoding (certificate, Rekor entries, inclusion proof, checkpoint, timestamps) and the five offline verification rows against user-supplied roots.
- `minisign-and-signify-verification`: `.minisig` / signify parsing and Ed25519 verification (legacy and prehashed) with trusted-comment authentication.
- `cosign-key-signature-verification`: cosign key-based `.sig` verification with a pasted `cosign.pub`.

### Modified Capabilities
- none (the TLS Certificate Parser gains Fulcio extension OIDs in its OID table, which widens its display but changes no existing requirement; the release-signature Node script and audit gate are unchanged).

## Impact

- `index.html`: one new view, ~900 lines of inline JS (CycloneDX / SPDX mappers, DSSE / PAE, in-toto / SLSA renderer, Sigstore bundle mapper, Rekor body decoders, RFC 6962 inclusion-proof recompute, checkpoint note parser, minisign / signify parser, cosign verifier), ~90 STRINGS keys × 5 locales + 5 en SEO keys; ~15 new OIDs in the certificate parser's table.
- Reuses: hand-rolled ASN.1 / DER reader and X.509 parser (`tls-cert`), `blake2b()`, SHA-2 via `crypto.subtle.digest`, Ed25519 / ECDSA P-256 / RSA verify via `crypto.subtle.verify`, the raw-Ed25519 → SPKI 12-byte prefix from the JWK ↔ PEM tool, `jsonPretty()`, the XML parser path from the UBL / LOTL inspectors for CycloneDX XML, the RFC 3161 timestamp decoder from `eidas-signature-cryptographic-verification`, the SEPA / UBL gate framework, `Intl.DateTimeFormat`, STRINGS i18n.
- No new vendored file, no CSP change, page weight +~22 KB gzipped.
- Tests: new `tests/specs/NN-supply.spec.js` (number assigned at implementation; 29+) — the repo's own `sbom.json` against the four vendored files (all ✓), a tampered-byte SBOM mismatch, the existing minisign fixtures under `tests/fixtures/minisign/` (produced by the reference `minisign 0.12`) plus `RELEASES.md` with `minisign.pub`, a DSSE envelope signed with a test Ed25519 key, a hand-built Sigstore bundle fixture with a two-leaf Merkle tree, a cosign `.sig` fixture, and the "no network" assertion the suite already uses.
