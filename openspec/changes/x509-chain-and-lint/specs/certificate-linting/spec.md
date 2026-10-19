# Spec Delta — certificate-linting

## Purpose

Check a TLS server certificate against the CA/B Forum TLS Baseline Requirements (as amended by ballot SC-081v3, April 2025) and RFC 5280 profile rules, presented as the site's ✓ / ✗ gate rows with the clause each rule comes from.

## ADDED Requirements

### Requirement: Dated lifetime gate
The tool SHALL compute the certificate lifetime from `notBefore` to `notAfter` and compare it with the cap that applied at issuance: 398 days before 15 March 2026, 200 days from 15 March 2026, 100 days from 15 March 2027, 47 days from 15 March 2029 (SC-081v3, BR §6.3.2), and SHALL add a ⚠ row when the lifetime would exceed any later scheduled cap (naming the earliest one it would breach).

#### Scenario: 400-day certificate issued 2026-04-01
- **WHEN** a leaf with `notBefore` 2026-04-01 and a 400-day lifetime is linted
- **THEN** the lifetime row is ✗ "400 days exceeds the 200-day cap for certificates issued from 15 March 2026 (SC-081v3)"

#### Scenario: 90-day certificate issued 2026-04-01
- **WHEN** the lifetime is 90 days with the same issuance date
- **THEN** the lifetime row is ✓ and a ⚠ row reads "would exceed the 47-day cap that applies from 15 March 2029"

#### Scenario: 46-day certificate issued 2029-04-01
- **WHEN** `notBefore` is 2029-04-01 and the lifetime 46 days
- **THEN** the lifetime row is ✓ with no warning

### Requirement: Algorithm and key gates
The tool SHALL display ✓ / ✗ rows for: signature algorithm is not SHA-1 or MD5 (BR §7.1.3.2); RSA modulus ≥ 2048 bits (BR §6.1.5); RSA public exponent odd, ≥ 3, and ≤ 2^64 − 1 (BR §6.1.6); EC curve is P-256, P-384, or P-521 (BR §6.1.5); the certificate's own Quantum-safe row from the PQC readiness indicator when present.

#### Scenario: 1024-bit RSA leaf
- **WHEN** a leaf with a 1024-bit RSA key is linted
- **THEN** the key-size row is ✗ "1024 bits < 2048 (BR §6.1.5)"

#### Scenario: SHA-1 signature
- **WHEN** the signature algorithm is `sha1WithRSAEncryption`
- **THEN** the algorithm row is ✗ citing BR §7.1.3.2

### Requirement: Name gates
The tool SHALL display ✓ / ✗ rows for: subjectAltName present and non-empty (BR §7.1.2.7.12); every dNSName is LDH syntax with at most one wildcard in the left-most label (BR §7.1.2.7.12, §3.2.2.6); a wildcard is not a bare public-suffix wildcard (`*.com`, `*.co.uk`) using a small inline suffix table; CN, when present, equals one SAN entry (BR §7.1.4.3); no iPAddress in dNSName and iPAddress length 4 or 16.

#### Scenario: Missing SAN
- **WHEN** a certificate has a CN but no subjectAltName extension
- **THEN** the SAN row is ✗ and the CN-in-SAN row reads "not evaluated — no SAN"

#### Scenario: CN not in SAN
- **WHEN** CN is `example.org` and the SAN lists only `www.example.org`
- **THEN** the CN row is ✗ citing BR §7.1.4.3

#### Scenario: Public-suffix wildcard
- **WHEN** a dNSName is `*.co.uk`
- **THEN** the wildcard row is ✗ "wildcard over a public suffix"

### Requirement: Identifier gates
The tool SHALL display ✓ / ✗ / ⚠ rows for: serial number positive with ≥ 64 bits of magnitude (BR §7.1.2.7.1 / §7.1, labelled as a heuristic); authorityKeyIdentifier present (BR §7.1.2.7.6); subjectKeyIdentifier present (⚠ if absent).

#### Scenario: Short serial
- **WHEN** the serial number is `0x7F`
- **THEN** the serial row is ✗ "7 bits of magnitude < 64 (BR §7.1) — consistent with a sequential serial"

#### Scenario: Compliant serial
- **WHEN** the serial has 72 bits of magnitude
- **THEN** the row is ✓ "≥ 64 bits — consistent with BR §7.1; randomness itself is not checkable"

#### Scenario: Missing AKI
- **WHEN** a leaf has no authorityKeyIdentifier extension
- **THEN** the AKI row is ✗ citing BR §7.1.2.7.6

### Requirement: Usage and constraint gates
The tool SHALL display ✓ / ✗ / ⚠ rows for: extendedKeyUsage present and including serverAuth without anyExtendedKeyUsage (BR §7.1.2.7.10); keyUsage consistent with the key type (digitalSignature for EC; digitalSignature and / or keyEncipherment for RSA; no keyCertSign on a leaf); basicConstraints absent or cA=FALSE on a leaf; cA=TRUE without pathLenConstraint on a subordinate CA (⚠, BR §7.1.2.10.4).

#### Scenario: EKU with anyExtendedKeyUsage
- **WHEN** the EKU contains `anyExtendedKeyUsage`
- **THEN** the EKU row is ✗ citing BR §7.1.2.7.10

#### Scenario: Leaf with keyCertSign
- **WHEN** a leaf's keyUsage includes keyCertSign
- **THEN** the keyUsage row is ✗ and names the bit

### Requirement: Certificate Transparency gate
The tool SHALL read the `SignedCertificateTimestampList` extension (1.3.6.1.4.1.11129.2.4.2, RFC 6962 §3.3), SHALL report the number of SCTs with each log ID in hex and timestamp, SHALL mark fewer than two SCTs as ⚠ (browser policy expectation, not a BR rule), and SHALL state that SCT signatures are not verified.

#### Scenario: Three SCTs
- **WHEN** a public leaf with three embedded SCTs is linted
- **THEN** the CT row is ✓ "3 SCTs embedded (log IDs listed) — signatures not verified; no log key list is bundled"

#### Scenario: No SCTs
- **WHEN** no SCT extension is present
- **THEN** the CT row is ⚠ "no embedded SCTs — a browser may require them via OCSP stapling or TLS extension instead"

### Requirement: Offline operation
The lint SHALL use only the certificate bytes and inline tables; no public-suffix list, CT log list, or CA data is fetched.

#### Scenario: Input never leaves the page
- **WHEN** a certificate is linted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
An all-✓ lint SHALL be summarised as "conforms to the checked CA/B Forum BR gates" and SHALL NOT describe the certificate as trusted, safe, or issued by a compliant CA.

#### Scenario: Clean result wording
- **WHEN** every gate row is ✓
- **THEN** the summary reads "Conforms to the n Baseline Requirements gates checked here (SC-081v3 edition). This does not establish who issued the certificate or that it chains to a root you trust."
