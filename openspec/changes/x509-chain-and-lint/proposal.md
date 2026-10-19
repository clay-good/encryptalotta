# Proposal — X.509 chain validation, certificate linting, CRL / OCSP decoding, key matching

## Why

The TLS Certificate Parser decodes one certificate at a time and shows its fields. The questions people actually bring to it are different: "does this chain actually validate to this root?", "why did the CA reject my certificate?", "is this serial revoked in the CRL I downloaded?", "does this private key belong to this certificate?". Today each of those goes to `openssl verify`, an online linter, or a revocation-check site — the last two see the certificate, and the key question often ends with a private key pasted into a web page. The site already has the primitives: a hand-rolled ASN.1 / DER reader shared by the certificate, CSR, and ASN.1 tools, Web Crypto RSA / ECDSA / Ed25519 verification with the DER → raw `r ‖ s` conversion the CSR decoder uses, SHA-2 digests, and the SEPA / UBL ✓ / ✗ gate framework. The CA/B Forum's lifetime ladder (ballot SC-081v3, April 2025: 398 → 200 days from 15 March 2026 → 100 from 15 March 2027 → 47 from 15 March 2029) makes a dated lint especially useful right now.

## What Changes

- **Extends the shipped TLS Certificate Parser (`tls-cert`); no new top-level tool.** No OpenSpec baseline exists for it yet, so each behaviour is written as a new capability.
- **Chain and path validation**: multi-PEM or PKCS#7 input; RFC 5280 §6 path building and validation to a user-pasted trust anchor or the chain's own self-signed root; basic constraints and pathLen, key usage, name constraints, validity at a chosen time, and per-link signature verification via Web Crypto.
- **Certificate linting**: CA/B Forum Baseline Requirements gates in the SEPA / UBL gate style — the dated lifetime ladder, SHA-1 signatures, RSA < 2048 or weak exponent, missing SAN, CN not in SAN, serial entropy < 64 bits, missing AKI / SKI, EKU present, keyUsage consistency, wildcard rules, CA certificate without pathLen, CT SCT count (RFC 6962).
- **CRL and OCSP decoding**: CRL (RFC 5280 §5) fields and revoked serials with reasons, delta indicator, "is this certificate's serial in this CRL"; OCSP response (RFC 6960) responder, producedAt, per-certificate status, thisUpdate / nextUpdate, nonce; signature verification of both against the pasted issuer or responder certificate.
- **Key ↔ certificate matching**: paste a certificate, a CSR, and / or a private key and compare SPKI fingerprints; the private key never leaves the page and is cleared on unload like the page's other secret fields.

Out of scope, and the §7 non-goal each respects: no fetching of AIA issuers, CRLs, or OCSP responses (§7.5; the user pastes the file); no "trusted" verdict without a user-supplied anchor (THREAT-MODEL.md); no bundled root store (a Mozilla / Microsoft root list would be a trust decision made for the user and 200+ KB against the budget); no certificate issuance or signing; no WASM (§7.6); the lint covers TLS server certificates (BR), not S/MIME or code-signing BRs.

## Capabilities

### New Capabilities
- `certificate-chain-path-validation`: RFC 5280 §6 path building and validation over pasted certificates with a user-supplied or embedded self-signed anchor, including name / basic / key-usage constraints and validity at a chosen time.
- `certificate-linting`: CA/B Forum Baseline Requirements gates for TLS server certificates, including the SC-081v3 lifetime ladder, in the site's ✓ / ✗ gate style.
- `crl-and-ocsp-decoding`: RFC 5280 §5 CRL and RFC 6960 OCSP response decoding, serial lookup, and signature verification against a pasted issuer / responder certificate.
- `key-certificate-matching`: SPKI fingerprint comparison between a certificate, a CSR, and a private key (PKCS#8 / PKCS#1 / SEC1) without the key leaving the page.

### Modified Capabilities
- none (the single-certificate decode is unchanged; the new panels are added below it).

## Impact

- `index.html`: ~1,000 lines of inline JS — multi-PEM / PKCS#7 splitter, path builder and validator, name-constraints matcher (dNSName, rFC822Name, iPAddress, directoryName), ~20 lint gate functions, CRL and OCSP ASN.1 walkers, SPKI extractor for private-key formats; ~55 STRINGS keys × 5 locales (no new SEO keys — no new tool).
- Reuses: hand-rolled ASN.1 / DER reader (`tls-cert`, `asn1`, `csr`), `tlsCertParseDer()`, `ecDerSigToRaw()`, Web Crypto `verify` / `digest` / `importKey` (RSASSA-PKCS1-v1_5, RSA-PSS, ECDSA, Ed25519), the PKCS#7 certs-only path, the SEPA / UBL gate framework (`{ok, label, detail, clause}` rows), `clearSensitiveFields()`, `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` for validity, STRINGS i18n table.
- No new vendored file, no CSP change, page weight +~12 KB gzipped.
- Tests: new `tests/specs/31-x509-chain.spec.js` (number assigned at implementation) — a three-tier test PKI generated once with OpenSSL (valid chain, expired intermediate, name-constraint violation, pathLen violation, missing SAN, SHA-1 leaf, 1024-bit RSA, 8-bit serial, 400-day leaf dated 2026-04-01, 46-day leaf, wildcard in a public suffix), a CRL listing one leaf with `keyCompromise`, an OCSP response for good and revoked serials with nonce, matching and non-matching key / cert / CSR triples, and the network-silence assertion the suite already uses.
