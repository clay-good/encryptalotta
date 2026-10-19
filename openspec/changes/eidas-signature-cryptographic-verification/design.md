# Design — eIDAS signature cryptographic verification

## Context

`cmsParse(der)` already walks ContentInfo → SignedData → certificates → SignerInfos and returns digest / signature algorithm names and the `signing-time` attribute. `xadesSignatures(xmlText)` walks `ds:Signature` elements with `DOMParser` and reports methods, references, and `xades:SigningTime`. The PAdES path locates each `/Sig` dictionary and extracts `/Contents` as hex. None of them keep byte offsets, and none call `crypto.subtle.verify`. The CSR decoder shows the pattern to follow: slice the signed bytes out of the original DER, never re-encode, convert ECDSA DER signatures to raw `r ‖ s` with `ecDerSigToRaw()`, verify with Web Crypto.

Three signed-bytes rules matter here:
- CMS: when `signedAttrs` is present, the signature is over the DER of the attributes with the `[0] IMPLICIT` tag replaced by a universal SET (0x31) and the same length bytes (RFC 5652 §5.4). When absent, it is over the content itself.
- PAdES: the signed bytes are the PDF slices named by `/ByteRange [a b c d]` — offsets a..a+b and c..c+d — which exclude the `/Contents` hex string (EN 319 142-1 §5; ISO 32000-1 §12.8.1).
- XML-DSig: the signature is over the canonicalized `ds:SignedInfo`; each `ds:Reference` digest is over the canonicalized, transformed referenced node set (W3C XML Signature Syntax and Processing 1.1).

Trust anchoring: ETSI TS 119 612 TSLs list a TSP's services with `ServiceDigitalIdentity` (X509Certificate, X509SKI, X509SubjectName), a `ServiceTypeIdentifier` URI, a `ServiceStatus` URI, a `StatusStartingTime`, and a `ServiceHistory`. The `lotl` tool already parses them for display.

## Goals / Non-Goals

**Goals:**
- A per-signer verdict grounded in bytes: digest recomputed, signature verified, chain built, time checked, each as its own row with the clause it implements.
- Timestamps decoded and verified the same way; the imprint check closes the loop between signature and TSA.
- Qualified / non-qualified reported only relative to a list the user pasted, with the status that was in force at the signing or timestamp time.
- The same gate-row shape (`{ok, label, detail, clause}`) as the SEPA / UBL inspectors so the UI is familiar.

**Non-Goals:**
- No revocation checking (no CRL / OCSP fetch, §7.5). A pasted CRL / OCSP is the `x509-chain-and-lint` change's job; this change links to it.
- No eIDAS Article 32 "valid / indeterminate / invalid" status and no "legally valid" wording. ETSI EN 319 102-1 validation needs revocation freshness and policy constraints the page cannot evaluate.
- No LT / LTA: archive time-stamps, `ats-hash-index`, DSS dictionaries, and document time-stamps are decoded but not validated.
- No XPath / XSLT / XPath Filter 2 transforms; only `enveloped-signature`, C14N 1.0 / 1.1 / exclusive 1.0 (with or without comments). Other transforms yield "unsupported transform".
- No JAdES (TS 119 182-1) — the JWT tool's territory.

## Decisions

1. **Keep byte offsets in the ASN.1 walk; never re-encode.** `cmsParse()` returns `{start, end}` for `signedAttrs`, `eContent`, each certificate, and each `signature` OCTET STRING. The signed-attrs bytes are copied and byte 0 replaced by 0x31. Rationale: re-encoding risks DER canonicalization differences (the CSR decoder learned this). Rejected: rebuilding the SET from parsed attributes.
2. **Web Crypto for every signature and digest; pure JS for ASN.1, PDF, and XML.** RSASSA-PKCS1-v1_5 with SHA-256 / 384 / 512 and, for archived documents, SHA-1 (`RSASSA-PKCS1-v1_5` with `SHA-1` is importable and verifies in current browsers; the row is labelled "legacy SHA-1 — collision-weak, no longer permitted by EN 319 122 for new signatures"), RSA-PSS (parameters read from the `signatureAlgorithm` AlgorithmIdentifier: hash, MGF1 hash, salt length), ECDSA P-256 / 384 / 521 with `ecDerSigToRaw()`, Ed25519 where the browser supports it (the Ed25519 tool's capability banner is reused). Rejected: hand-rolled RSA (~300 lines of BigInt for no gain).
3. **PAdES digest over `/ByteRange` with a coverage gate.** The reader parses `/ByteRange` from the signature dictionary, hashes the two slices with `crypto.subtle.digest`, and adds a row "ByteRange covers the whole file except /Contents: yes / no" — a `no` means bytes were appended after signing (an incremental update) and the row says so without calling it tampering. Rejected: hashing the whole PDF (always mismatches by construction).
4. **Chain building among embedded certificates only**, by issuer-DN / AKI → subject / SKI matching, verifying each link with Web Crypto, stopping at a self-signed certificate or a certificate whose issuer is absent ("chain ends at <subject>; issuer not embedded"). A pasted trust anchor is accepted as an extra certificate. Full RFC 5280 path validation (name constraints, policy) belongs to `x509-chain-and-lint`; this change reuses that engine when present and falls back to link verification otherwise.
5. **Timestamp verification is the CMS verifier applied recursively.** A TimeStampToken is a SignedData whose eContentType is `id-ct-TSTInfo`; `tstParse()` decodes TSTInfo (RFC 3161 §2.4.2) and the same verify function runs over it. The imprint row hashes the signer's `signature` OCTET STRING value with the `messageImprint.hashAlgorithm` and compares (EN 319 122-1 §5.3 for CAdES-T; EN 319 142-1 for the PAdES signature-time-stamp). ESSCertIDv2 (RFC 5816) binds the TSA certificate by SHA-256 by default; ESSCertID (SHA-1) is accepted and labelled.
6. **Trust-list matching order: certificate digest → SKI → subject DN.** The issuing CA certificate of the signer (or the TSA certificate) is compared to each `ServiceDigitalIdentity`; a digest match is "exact", SKI "by key identifier", subject "by name only" with a warning. Status at signing time comes from `ServiceHistory` walked backwards from `StatusStartingTime`. Service type URIs are mapped to short names (CA/QC, TSA/QTST, …) from TS 119 612 §5.5.1; unknown URIs are shown raw.
7. **Verdict composition.** The summary row is built from the gate rows: all ✓ → "signature math verifies and the signer's CA chains to <service> (<type>, <status> at <time>) in the list you supplied". Without a list → "signature math verifies; no trust list supplied, so nothing is said about who the signer is". Never "valid", "qualified signature", or "legally binding".
8. **C14N hand-rolled over the DOM (slice 2).** Namespace-declaration propagation, attribute ordering by namespace URI then local name, character escaping tables, and the exclusive-C14N `InclusiveNamespaces PrefixList` are ~350 lines. Rejected: `XMLSerializer` (not canonical) and a vendored library (none small enough; xmldsigjs needs a build step).
9. **Detached content from a file input.** CAdES detached signatures (no eContent) and the common `.p7s` + original-file pair take the original through `#tls-cert-content-file`; the digest row says "detached — digest over the loaded file".

## Risks / Trade-offs

- **Looks like a validator.** Users may read "math verifies" as "valid". Mitigation: the summary always carries the "this does not establish…" clause, the info panel explains ETSI EN 319 102-1 and what is missing (revocation, policy), and no green banner is used — rows only.
- **Legacy algorithms in real documents.** Many archived PAdES files use SHA-1 / RSA. The tool recomputes the digest (Web Crypto has SHA-1) and reports the signature as unsupported rather than silently skipping.
- **PDF corner cases.** Multiple revisions, cross-reference streams, `/Contents` with whitespace in the hex. The reader is byte-oriented and tolerant: it reports what it could not parse per signature and continues.
- **C14N bugs.** Canonicalization has many edge cases (namespace inheritance, xml: attributes, CDATA). Mitigation: the W3C C14N 1.0 / 1.1 test-suite examples in the Playwright spec; the slice-2 flag keeps slice 1 shippable on its own.
- **Web Crypto Ed25519 support varies.** Same banner as the Ed25519 tool; the row reads "Ed25519 unsupported in this browser" rather than "does not verify".
