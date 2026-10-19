# Spec Delta — rfc3161-timestamp-token-decoding

## Purpose

Decode and verify RFC 3161 TimeStampTokens — standalone or embedded as `signature-time-stamp` attributes in CAdES-T / PAdES-T (ETSI EN 319 122 / 142, EN 319 422) — including the TSA certificate binding of RFC 5816 and the imprint match against the signature they timestamp.

## ADDED Requirements

### Requirement: TSTInfo decoding
The tool SHALL recognise a SignedData whose eContentType is `id-ct-TSTInfo` (1.2.840.113549.1.9.16.1.4), SHALL also accept a TimeStampResp (`.tsr`) and surface its PKIStatus, and SHALL display the TSTInfo fields per RFC 3161 §2.4.2: version, policy OID, messageImprint (hash algorithm and value), serialNumber, genTime (rendered via `Intl.DateTimeFormat` with the raw GeneralizedTime), accuracy, ordering, nonce, and tsa GeneralName.

#### Scenario: OpenSSL test TSA token decodes
- **WHEN** a token produced by `openssl ts -reply` with a local test TSA is pasted
- **THEN** the rows show version 1, the configured policy OID, `SHA-256` imprint, the serial, the genTime, accuracy in seconds / millis / micros where present, and the TSA name

#### Scenario: TimeStampResp with failure status
- **WHEN** a `.tsr` whose PKIStatus is not granted (0) or grantedWithMods (1) is pasted
- **THEN** the tool shows the status and failInfo and states that no token is present

### Requirement: TSA certificate binding
The tool SHALL read the `signing-certificate-v2` attribute (ESSCertIDv2, RFC 5816) and bind the TSA certificate by the stated hash (SHA-256 by default), SHALL accept the SHA-1 `signing-certificate` attribute (ESSCertID, RFC 2634) with a legacy label, and SHALL report when the referenced certificate is not embedded.

#### Scenario: ESSCertIDv2 matches the embedded certificate
- **WHEN** the token embeds the TSA certificate and its SHA-256 equals the ESSCertIDv2 hash
- **THEN** the row is ✓ "TSA certificate bound by ESSCertIDv2 (RFC 5816)" and the certificate subject is shown

#### Scenario: Legacy ESSCertID
- **WHEN** only a SHA-1 ESSCertID is present
- **THEN** the row is ✓ with the label "ESSCertID (SHA-1, RFC 2634 — legacy)"

### Requirement: TSA signature verification
The tool SHALL verify the TSA's SignerInfo with the same engine as CAdES (RFC 5652 §5.4 signedAttrs rule, Web Crypto RSA / RSA-PSS / ECDSA / Ed25519) and SHALL build the TSA certificate chain among embedded certificates.

#### Scenario: TSA signature verifies
- **WHEN** the test TSA token is pasted
- **THEN** the signature row is ✓ and the chain rows end at the test CA with "self-signed root (embedded — not a trust decision)"

#### Scenario: Altered genTime
- **WHEN** one byte inside TSTInfo is changed
- **THEN** the TSA signature row is ✗ and the decoded fields are still displayed

### Requirement: Imprint match for CAdES-T and PAdES-T
For a `signature-time-stamp` unsigned attribute (1.2.840.113549.1.9.16.2.14) the tool SHALL hash the parent SignerInfo's `signature` OCTET STRING value with the token's `messageImprint.hashAlgorithm` and compare in constant time with `hashedMessage` (EN 319 122-1 §5.3; EN 319 142-1 for PAdES).

#### Scenario: Imprint matches
- **WHEN** a CAdES-T fixture is pasted
- **THEN** the row is ✓ "timestamp imprint matches the signature value — the signature existed at <genTime>" and the level row reads "CAdES-T"

#### Scenario: Imprint mismatch
- **WHEN** the token belongs to a different signature
- **THEN** the row is ✗ "imprint does not match this signature" and the level row falls back to "CAdES-BES / B-B"

### Requirement: Standalone imprint check
For a standalone token the tool SHALL let the user load a file or paste bytes and SHALL report whether the token's imprint equals the hash of that input.

#### Scenario: File matches token
- **WHEN** the file that was timestamped is loaded
- **THEN** the row reads "imprint matches SHA-256 of the loaded file"

### Requirement: Offline operation
Decoding and verification SHALL happen entirely in the page; the TSA is never contacted and no certificate is fetched.

#### Scenario: Input never leaves the page
- **WHEN** a token is decoded and verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
A fully verified token SHALL be summarised as "TSA signature math verifies and the imprint matches" and SHALL NOT be described as proving the time unless the TSA chains to a service in a user-supplied trust list.

#### Scenario: Clean result wording
- **WHEN** all timestamp rows are ✓ and no trust list is pasted
- **THEN** the summary reads "Timestamp token verifies (RFC 3161) and its imprint matches. The time is asserted by <TSA name>; this does not establish that the TSA is trustworthy."
