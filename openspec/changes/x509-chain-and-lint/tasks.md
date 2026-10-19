# Tasks — X.509 chain validation, linting, CRL / OCSP, key matching

## 1. Certificate set and path engine

- [ ] 1.1 `x509SplitInput(text | bytes)` — multi-PEM splitter, DER, and the existing PKCS#7 certs-only path → array of `{der, info}` via `tlsCertParseDer()`; extend the parser output with SKI, AKI, basicConstraints (cA, pathLen), keyUsage bits, EKU OIDs, nameConstraints, policies, CRL distribution points, AIA URLs, SCT list, raw `tbsCertificate` offsets, serial bytes.
- [ ] 1.2 `x509BuildPath(certs, anchor?)` — SKI / AKI then DN matching, fork detection, shortest path to anchor or self-signed root; result labels the anchor kind.
- [ ] 1.3 `x509ValidatePath(path, atTime)` — RFC 5280 §6.1 gate rows: signature (Web Crypto, `ecDerSigToRaw()`), validity at time, basicConstraints / pathLen, keyUsage keyCertSign, name constraints (dNSName / rFC822Name / iPAddress / directoryName; others "unchecked"), unknown critical extensions.
- [ ] 1.4 Node-side check against a generated three-tier test PKI (valid, expired intermediate, name-constraint violation, pathLen violation, wrong-key intermediate).

## 2. Lint engine

- [ ] 2.1 `brMaxLifetimeDays(notBefore)` with the SC-081v3 table (398; 200 from 2026-03-15; 100 from 2027-03-15; 47 from 2029-03-15) and lifetime measured per BR convention.
- [ ] 2.2 Gate functions (`{ok, label, detail, clause}` rows): lifetime cap, upcoming-cap warning, SHA-1 signature, RSA < 2048, RSA exponent (even, < 3, or > 2^64), missing SAN, CN not in SAN, SAN entry syntax (dNSName LDH, iPAddress length), wildcard rules (left-most label only, not a public-suffix bare wildcard), serial ≥ 64 bits positive, AKI present, SKI present, EKU present with serverAuth, keyUsage consistent with key type (digitalSignature for EC; digitalSignature / keyEncipherment for RSA), basicConstraints absent or cA=false on leaves, CA without pathLen (⚠), CT SCT count and log IDs.
- [ ] 2.3 Node-side check against the lint fixtures (clean leaf, 400-day leaf dated 2026-04-01, 46-day leaf dated 2029-04-01, SHA-1, 1024-bit, 8-bit serial, missing SAN, CN ∉ SAN, `*.co.uk`).

## 3. CRL and OCSP engine

- [ ] 3.1 `crlParse(der)` — RFC 5280 §5: version, signature algorithm, issuer, thisUpdate, nextUpdate, lazy `revokedCertificates` walk (serial, revocationDate, reasonCode, invalidityDate), extensions (CRL number, delta indicator, AKI, IDP); `crlLookup(crl, serial)`.
- [ ] 3.2 `ocspParse(der)` — RFC 6960: responseStatus, BasicOCSPResponse, responderID, producedAt, SingleResponses (certID hash alg / issuer hashes / serial, certStatus, thisUpdate, nextUpdate), nonce, embedded certs; accept DER, Base64, and the `.ors` file.
- [ ] 3.3 Signature verification over sliced `tbsCertList` / `tbsResponseData` against a pasted issuer certificate or embedded responder certificate (with the OCSP-signing EKU check, RFC 6960 §4.2.2.2).
- [ ] 3.4 Node-side check against an OpenSSL-generated CRL (one `keyCompromise` entry) and OCSP responses (good / revoked / unknown, with and without nonce).

## 4. Key matching engine

- [ ] 4.1 `spkiFromPrivateKey(pem)` — PKCS#8 (RSA / EC via Web Crypto import + export; Ed25519 / X25519 by hand), PKCS#1 RSA (ASN.1 read), SEC1 EC (public point or Web Crypto derivation); encrypted inputs → "encrypted — use the Key Format Converter".
- [ ] 4.2 `spkiFingerprint(spkiDer)` SHA-256 hex; compare certificate SPKI, CSR SPKI (reuse the CSR decoder), and private-key SPKI; zero-fill key buffers after use.

## 5. View

- [ ] 5.1 In `#tls-cert-view`: chain panel (`#tls-cert-bundle` accepts multi-PEM / PKCS#7 / files, `#tls-cert-anchor`, `#tls-cert-validation-time`, `#btn-tls-cert-validate`, `#tls-cert-chain-gates`), lint panel (`#tls-cert-lint-gates`, auto-run on the leaf), revocation panel (`#tls-cert-revocation` textarea / file, `#tls-cert-revocation-issuer`, `#btn-tls-cert-revocation`, `#tls-cert-revocation-results`), key-match panel (`#tls-cert-private-key` masked, `#tls-cert-csr`, `#btn-tls-cert-match`, `#tls-cert-match-results`).
- [ ] 5.2 Register `#tls-cert-private-key` with `clearSensitiveFields()`; validity dates via `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`; AIA / CRL DP URLs rendered as text, not links.
- [ ] 5.3 Summary wording per the verdict-language requirements; links to `csr`, `asn1`, `pem-der`, the Key Format Converter when shipped.

## 6. Tests

- [ ] 6.1 Fixture PKI under `tests/fixtures/x509/` from a documented OpenSSL script (committed outputs, script re-runnable).
- [ ] 6.2 `tests/specs/31-x509-chain.spec.js` (number assigned at implementation): ordered and shuffled bundle validation, anchor supplied vs embedded root wording, validation-time override, each lint fixture's rows, CRL serial hit / miss, OCSP good / revoked / nonce rows, CRL and OCSP signature rows with and without issuer, key / cert / CSR match and mismatch, private-key field cleared on unload, network-silence assertion, XSS payload in a SAN rendered inert.

## 7. Wiring and gates

- [ ] 7.1 ~55 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts); no new SEO keys (no new tool); CLDR plural groups for "n of m links verify" and "n revoked entries".
- [ ] 7.2 TOOL_SYNONYMS additions on `tls-cert` (`chain bundle fullchain verify lint cabforum baseline crl ocsp revoked revocation key match modulus`), RELATED_TOOLS (`tls-cert` ↔ `csr` ↔ `asn1` ↔ `pem-der` ↔ `jwk`), JSON-LD featureList text update; audit gate 20 tool count unchanged at 57.
- [ ] 7.3 README: TLS Certificate Parser paragraph extended, standards cheat sheet rows (RFC 5280 §5 / §6, RFC 6960, RFC 6962, CA/B Forum BR + SC-081v3), Per-Tool Security Notes paragraph on the private-key field; SPEC-INTERNATIONAL.md status note.
- [ ] 7.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
