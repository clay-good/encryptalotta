# Spec Delta — cades-pades-signature-verification

## Purpose

Verify the cryptographic content of CAdES (ETSI EN 319 122, CMS RFC 5652) and PAdES (ETSI EN 319 142, ISO 32000-1 §12.8) signatures in the browser: digest recomputation, signature verification over the signed attributes, signing-time plausibility, and chain building among embedded certificates.

## ADDED Requirements

### Requirement: Message-digest recomputation
For each SignerInfo the tool SHALL hash the signed content with the SignerInfo's `digestAlgorithm` using Web Crypto and compare it in constant time with the `message-digest` signed attribute (RFC 5652 §11.2). The content is the `eContent` when present, the loaded detached file otherwise, or the PDF `/ByteRange` slices for PAdES.

#### Scenario: Attached CAdES digest matches
- **WHEN** an OpenSSL `cms -sign` attached SignedData is pasted
- **THEN** the digest row is ✓ "message-digest matches SHA-256 of eContent (RFC 5652 §11.2)"

#### Scenario: Detached CAdES over a loaded file
- **WHEN** a `.p7s` without eContent is pasted and the original file is loaded in the content-file input
- **THEN** the digest row is computed over the loaded file and labelled "detached"; without a loaded file the row reads "detached — load the signed file to check the digest"

#### Scenario: Tampered content
- **WHEN** one byte of the content differs from what was signed
- **THEN** the digest row is ✗ "digest mismatch" and the signature row is still evaluated and reported separately

### Requirement: Signature verification over signedAttrs
The tool SHALL verify each SignerInfo's `signature` over the DER of `signedAttrs` with its leading `[0] IMPLICIT` tag replaced by the universal SET tag 0x31 (RFC 5652 §5.4), using Web Crypto RSASSA-PKCS1-v1_5, RSA-PSS (parameters from the AlgorithmIdentifier), ECDSA P-256 / 384 / 521 (DER signature converted to raw r ‖ s), or Ed25519; the bytes SHALL be sliced from the original DER, never re-encoded.

#### Scenario: RSA-PSS signer verifies
- **WHEN** a SignedData made with `openssl cms -sign -keyopt rsa_padding_mode:pss` is pasted
- **THEN** the signature row is ✓ and names RSA-PSS with the hash, MGF1 hash, and salt length read from the parameters

#### Scenario: ECDSA P-256 signer verifies
- **WHEN** a SignedData signed with an ECDSA P-256 key is pasted
- **THEN** the signature row is ✓ "ECDSA P-256 / SHA-256 verifies via Web Crypto (DER signature converted to raw r ‖ s)"

#### Scenario: Tampered signature
- **WHEN** one byte of the `signature` OCTET STRING is altered
- **THEN** the signature row is ✗ "signature does not verify" while the digest row remains ✓

#### Scenario: Legacy SHA-1 signer
- **WHEN** the signature algorithm is `sha1WithRSAEncryption` (common in archived PAdES files)
- **THEN** the signature is verified with Web Crypto RSASSA-PKCS1-v1_5 / SHA-1 and the row carries the label "legacy SHA-1 — collision-weak; not permitted for new signatures"

#### Scenario: Unsupported algorithm
- **WHEN** the signature algorithm OID is one the mapping does not know (for example a GOST or SM2 OID)
- **THEN** the signature row reads "unsupported algorithm — not verified" with the OID, and no other row is affected

### Requirement: PAdES byte-range coverage
For a PAdES signature the tool SHALL read `/ByteRange [a b c d]` from the signature dictionary, SHALL hash the two slices as the signed content, and SHALL report whether the ranges cover the whole file except the `/Contents` string (EN 319 142-1 §5; ISO 32000-1 §12.8.1).

#### Scenario: Ranges cover the file
- **WHEN** a PDF with one signature whose `/ByteRange` ends at the file length is loaded
- **THEN** the coverage row is ✓ "ByteRange covers the file except /Contents" and the digest row is computed over the two slices

#### Scenario: Bytes after the signed range
- **WHEN** the file is longer than `c + d`
- **THEN** the coverage row reads "n bytes follow the signed range (incremental update after signing)" without using the word "tampered", and the signature is still verified over its own range

### Requirement: Signing-time plausibility
When a `signing-time` signed attribute (RFC 5652 §11.3) or a `xades:SigningTime` is present, the tool SHALL compare it with the signer certificate's `notBefore` / `notAfter` and report the result, labelled as a claimed time; it SHALL use the timestamp genTime instead when a verified RFC 3161 token is present.

#### Scenario: Claimed time inside validity
- **WHEN** signing-time falls within the signer certificate's validity period
- **THEN** the row is ✓ "claimed signing time <Intl date> within certificate validity — claimed by the signer, not proven"

#### Scenario: Claimed time outside validity
- **WHEN** signing-time is after `notAfter`
- **THEN** the row is ✗ and names both dates

### Requirement: Chain building among embedded certificates
The tool SHALL locate the signer certificate by `IssuerAndSerialNumber` or `SubjectKeyIdentifier`, SHALL build a chain among the SignedData's certificates (and an optionally pasted anchor) by issuer / authority-key-identifier matching, SHALL verify each link's signature with Web Crypto, and SHALL state where the chain ends.

#### Scenario: Chain to an embedded self-signed root
- **WHEN** the SignedData embeds leaf, intermediate, and root
- **THEN** three chain rows are shown with each link ✓ and the last reads "self-signed root <subject> (embedded — not a trust decision)"

#### Scenario: Issuer missing
- **WHEN** the intermediate's issuer certificate is not embedded and no anchor is pasted
- **THEN** the chain ends with "issuer <DN> not embedded; paste it as an anchor to continue"

### Requirement: Offline operation
All hashing, verification, and PDF reading SHALL happen in the page; the tool SHALL never fetch certificates, CRLs, OCSP responses, or trust lists.

#### Scenario: Input never leaves the page
- **WHEN** a PAdES PDF is loaded and verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
The per-signer summary SHALL be "signature math verifies" (plus the chain statement) and SHALL NOT use "valid", "legally valid", "qualified", or "trusted" unless a trust list supplied by the user establishes the qualifier.

#### Scenario: Clean result without a trust list
- **WHEN** every row for a signer is ✓ and no trust list is pasted
- **THEN** the summary reads "Signature math verifies over these bytes (RFC 5652 §5.4). No trust list supplied — this does not establish who the signer is or whether the signature is legally valid."
