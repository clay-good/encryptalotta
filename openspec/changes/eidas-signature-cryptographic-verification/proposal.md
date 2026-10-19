# Proposal — eIDAS signature cryptographic verification (CAdES / PAdES / XAdES)

## Why

The TLS Certificate Parser already decodes the three eIDAS signature families: CMS / CAdES SignedData (RFC 5652, ETSI EN 319 122), PAdES signatures pulled from a PDF's `/Contents` (EN 319 142), and XAdES / XML-DSig (EN 319 132). It reports structure and signer identity only; the README says so in bold: "no cryptographic-verification or revocation checking". A user holding a signed invoice, contract, or court filing therefore still has to upload it to a validation portal to learn the one thing that matters: does the signature math hold over these bytes, and does the signer chain to a listed trust service? The site has every primitive for that answer — the hand-rolled ASN.1 reader, Web Crypto RSA / ECDSA / Ed25519 verification (already used by the CSR decoder's self-signature check), SHA-2 digests, the PDF byte reader, and an ETSI TS 119 612 trust-list parser (`lotl` tool). This change joins them.

## What Changes

- **Extends the shipped TLS Certificate Parser (`tls-cert`); no new top-level tool.** No OpenSpec baseline exists for it yet, so every behaviour below is written as a new capability.
- **CAdES / PAdES verification**: for each SignerInfo, recompute the message digest over the content (CAdES: the eContent or detached file the user loads; PAdES: the PDF bytes covered by `/ByteRange`), compare with the `message-digest` signed attribute, verify the signature over the DER of `signedAttrs` re-tagged as an explicit SET (RFC 5652 §5.4) with Web Crypto RSA-PKCS1-v1_5, RSA-PSS, ECDSA (P-256 / 384 / 521), or Ed25519, check `signing-time` against the signer certificate's validity, and build the certificate chain among the embedded certificates. Verdict per signer: "math verifies", "digest mismatch", "signature does not verify", or "unsupported algorithm".
- **RFC 3161 timestamp decoding**: decode `signature-time-stamp` unsigned attributes (CAdES-T / PAdES-T) and standalone `.tsr` / TimeStampToken input: TSTInfo fields, TSA certificate via ESSCertIDv2 (RFC 5816), TSA signature math, and the imprint match against the signature value.
- **Trust-list anchoring**: the user pastes an ETSI TS 119 612 LOTL / TSL (the `lotl` parser is reused by function call); the inspector matches the signer's issuing CA to a service digital identity by SKI, subject, or certificate digest and reports the service type and its status (granted / withdrawn) at the signing time. Qualified status is only ever reported relative to the pasted list.
- **XML-DSig / XAdES verification (slice 2)**: C14N 1.0, 1.1, and exclusive C14N 1.0 hand-rolled over the DOM, reference digest recomputation with the enveloped-signature transform, SignedInfo signature verification; scoped to XAdES-B-B / B-T.

Out of scope, and the §7 non-goal each respects: no trust-list or CRL / OCSP fetching (§7.5 — the user pastes everything); no "legally valid" verdict (THREAT-MODEL.md verdict language; eIDAS Article 32 validation requires revocation data at signing time that the page cannot obtain); no LT / LTA archive-timestamp chain validation (slice 3 at the earliest); no XSLT or XPath-filter transforms; no PDF incremental-update forensics (that belongs to a PDF metadata tool); no WASM (§7.6).

## Capabilities

### New Capabilities
- `cades-pades-signature-verification`: message-digest recomputation, signedAttrs signature verification (RFC 5652 §5.4), signing-time validity check, embedded-certificate chain building, and per-signer verdict for CAdES (EN 319 122) and PAdES (EN 319 142) signatures.
- `rfc3161-timestamp-token-decoding`: TimeStampToken / TSTInfo decoding (RFC 3161), ESSCertIDv2 TSA certificate binding (RFC 5816), TSA signature verification, and imprint matching for CAdES-T / PAdES-T (EN 319 422).
- `trust-list-anchoring`: matching the signer's CA to a service entry in a user-pasted ETSI TS 119 612 trust list and reporting service type and status at signing time.
- `xml-dsig-verification`: canonicalization (C14N 1.0 / 1.1 / exclusive 1.0), reference digest recomputation, and SignedInfo signature verification for XML-DSig and XAdES-B-B / B-T (EN 319 132) — slice 2.

### Modified Capabilities
- none (the existing structure-only decode stays as the first panel; verification rows are appended below it).

## Impact

- `index.html`: ~900 lines of inline JS across the `tls-cert` CMS path (`cmsParse()` gains signedAttrs byte offsets, a verify step, and chain building), the PDF `/ByteRange` reader, a new `tstParse()`, the `lotl` matcher, and ~400 lines for C14N + XML-DSig in slice 2; ~35 STRINGS keys × 5 locales (no new SEO keys — no new tool).
- Reuses: hand-rolled ASN.1 / DER reader (`tls-cert`, `asn1`, `csr`), `ecDerSigToRaw()` from the CSR decoder, Web Crypto `verify` for RSASSA-PKCS1-v1_5 / RSA-PSS / ECDSA / Ed25519, SHA-256 / 384 / 512 via Web Crypto, the PDF `/Contents` extractor, `xadesSignatures()` DOM walk, `lotlRenderTsl()` parsing, `Intl.DateTimeFormat` for times, STRINGS i18n table.
- No new vendored file, no CSP change, page weight +~10 KB gzipped (slice 1) +~4 KB (slice 2).
- Tests: new `tests/specs/30-eidas-verify.spec.js` (number assigned at implementation) — fixtures generated once with OpenSSL `cms -sign` (RSA, RSA-PSS, ECDSA P-256, Ed25519), a detached CAdES over a text file, a PAdES PDF signed with a test key, an RFC 3161 token from `openssl ts -reply` with a local test TSA, a minimal TS 119 612 TSL naming the test CA, tampered-content and tampered-signature variants, and the network-silence assertion the suite already uses.
