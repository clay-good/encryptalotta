# Design — X.509 chain validation, linting, CRL / OCSP, key matching

## Context

`tlsCertParseDer(der)` returns subject, issuer, SAN, validity, SPKI algorithm, and fingerprints for one certificate, built on the hand-rolled ASN.1 reader that `asn1` and `csr` also use. The CSR decoder shows the verification pattern: slice the `tbs` bytes from the original DER, convert ECDSA signatures to raw `r ‖ s` with `ecDerSigToRaw()`, verify with `crypto.subtle.verify`. The PKCS#7 certs-only path already yields a certificate array. What is missing is everything that relates certificates to each other and to policy: ordering a bundle into a path, checking constraints along it, linting the leaf against the CA/B Forum Baseline Requirements, reading the two revocation-data formats, and matching a key to a certificate.

The governing texts are RFC 5280 (§4.2 extensions, §5 CRL, §6 path validation), RFC 6960 (OCSP), RFC 6962 (CT, extension 1.3.6.1.4.1.11129.2.4.2), and the CA/B Forum TLS Baseline Requirements as amended by ballot SC-081v3 (April 2025): maximum validity 398 days, then 200 days for certificates issued on or after 15 March 2026, 100 days from 15 March 2027, 47 days from 15 March 2029; serial numbers with at least 64 bits of CSPRNG output (BR §7.1); no SHA-1 signatures; RSA at least 2048 bits; SAN required and CN, when present, taken from the SAN.

## Goals / Non-Goals

**Goals:**
- A pasted bundle (leaf + intermediates, with or without root) is ordered and validated with per-link rows, each citing the RFC 5280 clause.
- The lint reads like the SEPA / UBL gate lists: one row per rule, ✓ / ✗ / ⚠, clause named, dated rules evaluated against the certificate's own `notBefore`.
- CRL and OCSP responses are readable without `openssl crl -text` and can answer "is this serial listed?" for a pasted certificate.
- Key matching never displays or persists private-key material beyond the masked input field.

**Non-Goals:**
- No root store. Validation ends at an anchor the user pasted or at the bundle's own self-signed root, always labelled as such.
- No fetching of AIA, CRL distribution points, or OCSP responders (§7.5); the URLs are displayed for the user.
- No policy-mapping or policy-constraints processing beyond displaying the policy OIDs (RFC 5280 §6.1.3 (d)–(f) is deferred; almost no TLS client enforces it).
- No S/MIME, code-signing, or EV-specific BR gates; no lint of CA certificates beyond the pathLen and keyUsage rules that affect path validation.
- No private-key format conversion or encrypted-key decryption here — that is the `pkcs12-and-key-format-converter` change; this change accepts unencrypted PKCS#8, PKCS#1, and SEC1 only and links to the converter for everything else.

## Decisions

1. **Path building by SKI / AKI first, then issuer DN, over the pasted set only.** Candidates for the next issuer are matched on `authorityKeyIdentifier.keyIdentifier` = `subjectKeyIdentifier`, falling back to byte-equal issuer / subject DNs (RFC 5280 §7.1 name comparison simplified to DER equality plus case-insensitive PrintableString, as every browser does). Ambiguous forks (cross-signed intermediates) are reported and the shortest path to an anchor is taken. Rejected: requiring the user to paste certificates in order.
2. **Validation per RFC 5280 §6.1 in order: signature, validity at the chosen time, basic constraints and pathLenConstraint, keyUsage keyCertSign on CAs, name constraints (permitted / excluded for dNSName, rFC822Name, iPAddress, directoryName; URI and other name forms reported as unchecked), critical-extension check.** Each is a gate row with the §6.1.3 / §6.1.4 sub-item. Validation time defaults to now and is editable (`#tls-cert-validation-time`) so an expired-at-signing-time question can be answered.
3. **Web Crypto for all signature and digest work; pure JS for ASN.1, DN comparison, name constraints, and the lint.** Algorithms: RSASSA-PKCS1-v1_5 with SHA-256 / 384 / 512, RSA-PSS, ECDSA P-256 / 384 / 521 via `ecDerSigToRaw()`, Ed25519 where the browser supports it. SHA-1-signed links: verified with RSASSA-PKCS1-v1_5 / SHA-1 (importable in current browsers) and labelled "legacy SHA-1 — collision-weak; BR §7.1.3.2 forbids it", so an old private-PKI chain still gets a real answer while the lint row fails. ECDSA-with-SHA-1 and MD5 are not importable and are reported as "not verified — algorithm not available in Web Crypto". Rejected: a BigInt RSA fallback for those (adds code to verify something the lint condemns).
4. **Dated lifetime ladder keyed to `notBefore`.** `brMaxLifetimeDays(notBefore)` returns 398 / 200 / 100 / 47 using the SC-081v3 dates; lifetime is `notAfter − notBefore` in whole days with the BR's inclusive-second convention. The row shows the cap that applied at issuance and the measured lifetime. Future steps are shown as ⚠ "would exceed the cap from <date>" when the certificate is still within the current cap, so operators see what is coming.
5. **Serial entropy is a heuristic and is labelled one.** The gate passes when the serial's positive magnitude is ≥ 64 bits and fails below; it cannot prove randomness and says "≥ 64 bits — consistent with BR §7.1; randomness itself is not checkable". Rejected: silent pass.
6. **CT SCT count from the embedded `SignedCertificateTimestampList` only.** The gate reports the number of SCTs and their log IDs (hex); it does not verify SCT signatures (log public keys would be a bundled list — same objection as a root store) and says so.
7. **CRL / OCSP decoding reuses the ASN.1 reader; signature verification needs a pasted certificate.** CRL: issuer, thisUpdate, nextUpdate, extensions (CRL number, delta CRL indicator, authority key identifier, issuing distribution point), revoked entries (serial, revocationDate, reasonCode names per RFC 5280 §5.3.1). OCSP: `OCSPResponse` status → `BasicOCSPResponse` → responderID (byName / byKey), producedAt, per-`SingleResponse` certStatus (good / revoked with time and reason / unknown), thisUpdate, nextUpdate, nonce (RFC 6960 §4.4.1), embedded responder certificates. Both verify over the sliced `tbsCertList` / `tbsResponseData` with the pasted issuer or the embedded responder certificate.
8. **Key matching by SPKI DER.** For PKCS#8 the SPKI is derived with Web Crypto `importKey` + `exportKey('spki')` (RSA, EC) or by hand for Ed25519 / X25519 (same 12-byte prefix as the JWK tool); for PKCS#1 RSA the modulus and exponent are read with the ASN.1 reader and compared; for SEC1 EC the public point is read when present and otherwise derived through Web Crypto. Comparison is SHA-256 over the SPKI DER (the same fingerprint the JWK thumbprint and HPKP used). Rejected: comparing `n` / `x` fields per algorithm (one code path per format).
9. **Secret handling.** `#tls-cert-private-key` is a masked textarea registered with `clearSensitiveFields()`; the parsed key material is zero-filled after the SPKI is derived; nothing is placed in the URL, `localStorage`, or the result rows beyond the public fingerprint.

## Risks / Trade-offs

- **"Valid chain" misread as "trusted".** Mitigation: the anchor row always reads either "anchor supplied by you" or "bundle's own self-signed root — not a trust decision", and the summary wording is fixed by the spec.
- **DN comparison corner cases.** Different string types or ordering in RDNs break naive equality; the fallback to SKI / AKI covers nearly all real chains, and a mismatch row says which comparison failed.
- **BR drift.** The ballot schedule may be amended. Dates live in one constant table and the row names SC-081v3; a future ballot is a table edit.
- **Large CRLs.** Some public CRLs exceed 10 MB. The walker streams the `revokedCertificates` SEQUENCE lazily and renders the first 500 entries plus the serial lookup result; a note gives the total count.
- **OCSP without a nonce.** Most responders omit it; the row reads "no nonce — replay freshness relies on nextUpdate" rather than failing.
- **Private key in a browser field.** The only private-key input on the site outside PGP and age; the panel repeats the THREAT-MODEL.md endpoint caveat and recommends the portable build for production keys.
