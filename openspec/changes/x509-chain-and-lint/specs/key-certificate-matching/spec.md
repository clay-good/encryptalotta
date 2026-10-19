# Spec Delta — key-certificate-matching

## Purpose

Tell the user whether a certificate, a CSR, and a private key belong together by comparing SubjectPublicKeyInfo fingerprints (RFC 5280 §4.1.2.7; PKCS#8 RFC 5958; PKCS#1 RFC 8017; SEC1 EC keys), with the private key handled as a secret field that never leaves the page.

## ADDED Requirements

### Requirement: Public-key extraction
The tool SHALL extract the SPKI DER from a certificate (via the certificate parser), from a CSR (via the CSR decoder), and from an unencrypted private key in PKCS#8 (`BEGIN PRIVATE KEY`), PKCS#1 RSA (`BEGIN RSA PRIVATE KEY`), or SEC1 EC (`BEGIN EC PRIVATE KEY`) form, using Web Crypto import / export for RSA and EC and the fixed 12-byte prefix for Ed25519 / X25519, and SHALL compute its SHA-256 fingerprint.

#### Scenario: PKCS#8 RSA key
- **WHEN** an unencrypted PKCS#8 RSA-2048 key is pasted
- **THEN** the key row shows "RSA 2048" and a SHA-256 SPKI fingerprint, and no modulus or private component is displayed

#### Scenario: SEC1 EC key without public point
- **WHEN** a SEC1 P-256 key omits the optional public key
- **THEN** the public key is derived through Web Crypto and the fingerprint is still shown

#### Scenario: Encrypted key
- **WHEN** a `BEGIN ENCRYPTED PRIVATE KEY` or `Proc-Type: 4,ENCRYPTED` block is pasted
- **THEN** the row reads "encrypted — decrypt it with the Key Format Converter first" and nothing is attempted

### Requirement: Fingerprint comparison
The tool SHALL compare the SPKI fingerprints of whichever two or three inputs are present and SHALL report match or mismatch per pair with the fingerprints shown, using constant-time comparison.

#### Scenario: Matching triple
- **WHEN** the fixture certificate, its CSR, and its private key are pasted
- **THEN** three pair rows read "match" and the summary reads "certificate, CSR, and private key share one public key (SPKI SHA-256 <hex>)"

#### Scenario: Wrong key
- **WHEN** a private key from another pair is pasted with the certificate
- **THEN** the pair row reads "mismatch — the private key does not correspond to this certificate's public key" with both fingerprints

#### Scenario: Only two inputs
- **WHEN** only a certificate and a CSR are present
- **THEN** one pair row is shown and the key row reads "no private key supplied"

### Requirement: Secret handling
The private-key field SHALL be masked, SHALL be registered with the page's `clearSensitiveFields()` so it is emptied on `beforeunload`, SHALL never be placed in the URL, `localStorage`, or any result row, and parsed key buffers SHALL be zero-filled after the SPKI is derived.

#### Scenario: Cleared on unload
- **WHEN** the page is unloaded with a key in `#tls-cert-private-key`
- **THEN** the field is empty on the next read and no copy exists in storage

#### Scenario: Nothing private in results
- **WHEN** a private key is matched
- **THEN** `#tls-cert-match-results` contains only the algorithm, size, and public fingerprint

### Requirement: Offline operation
All parsing and comparison SHALL run in the page; the key material SHALL never be sent anywhere.

#### Scenario: Input never leaves the page
- **WHEN** a private key is pasted and matched while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
A match SHALL be reported as the inputs sharing one public key and SHALL NOT be described as the key being secure, the certificate being valid, or the holder being identified.

#### Scenario: Clean result wording
- **WHEN** all present pairs match
- **THEN** the summary ends with "This confirms the inputs belong together; it does not establish that the certificate is valid or who controls the key."
