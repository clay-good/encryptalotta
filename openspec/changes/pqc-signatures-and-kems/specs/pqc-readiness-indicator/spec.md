# Spec Delta — pqc-readiness-indicator

## Purpose

Tell users whether a key or certificate they inspect relies on algorithms that NIST IR 8547 (draft, November 2024) schedules for deprecation, and refresh the PGP generator's regulator-preset help text to reflect the 2025 BSI recommendation and the OpenPGP PQC situation.

## ADDED Requirements

### Requirement: Quantum-safe row in Key Info
The Key Info tool SHALL add a "Quantum-safe" row to every inspected PGP key, reporting "no" for RSA, DSA, ElGamal, ECDSA, EdDSA, ECDH and Curve25519 algorithms with the NIST IR 8547 (draft) wording "deprecated after 2030, disallowed after 2035", and "yes" for RFC 9980 composite or standalone PQC algorithms should a future library version produce them.

#### Scenario: Curve25519 PGP key
- **WHEN** an Ed25519 / Curve25519 PGP public key is inspected
- **THEN** the row reads "Quantum-safe: no — ECC; NIST IR 8547 (draft) deprecates after 2030, disallows after 2035" and links to the Post-Quantum Crypto tool

#### Scenario: RSA 4096 PGP key
- **WHEN** an RSA-4096 key is inspected
- **THEN** the row reads "no — RSA" with the same dates, and the key-size row is unchanged

### Requirement: Quantum-safe row in the TLS Certificate Parser
The TLS Certificate Parser SHALL add the same row for X.509 certificates based on the subject public key algorithm and the signature algorithm, SHALL report "hybrid — exempt from the 2035 disallow" when a composite or hybrid algorithm OID is recognised, and SHALL say "unknown algorithm" rather than guessing for unrecognised OIDs.

#### Scenario: ECDSA P-256 leaf certificate
- **WHEN** a certificate with an `id-ecPublicKey` P-256 key and `ecdsa-with-SHA256` signature is parsed
- **THEN** the row reads "Quantum-safe: no — ECC key and ECDSA signature; NIST IR 8547 (draft)"

#### Scenario: Unknown algorithm OID
- **WHEN** the subject public key algorithm OID is not in the parser's table
- **THEN** the row reads "Quantum-safe: unknown algorithm (OID shown)" and does not say "no"

### Requirement: Wording source and single implementation
The row text SHALL be produced by one shared function used by both tools, SHALL name NIST IR 8547 as a draft, and SHALL NOT use the words "insecure", "broken", or "safe" about the inspected key.

#### Scenario: Identical wording across tools
- **WHEN** an RSA-2048 key appears in a PGP key and in an X.509 certificate
- **THEN** both rows carry the same reason text from `pqcReadiness()`

#### Scenario: Clean result is not phrased as safe
- **WHEN** a key is reported "yes" or "hybrid"
- **THEN** the row says "quantum-safe algorithm per FIPS 203 / 204 — this does not establish who holds the key or that the certificate chains anywhere" and never the bare word "safe"

### Requirement: Regulator-preset help refresh
The PGP generator's BSI TR-02102-1 preset help text SHALL state that the 2025 edition recommends ML-KEM and ML-DSA (or SLH-DSA) with post-quantum key agreement only in hybrid with a classical scheme, and the generator help SHALL state that OpenPGP PQC is RFC 9980 and that OpenPGP.js 6.3.2 does not implement it, so PQC PGP key generation is not offered.

#### Scenario: BSI preset selected
- **WHEN** the user selects the BSI preset
- **THEN** `#regulator-preset-help` includes the 2025-edition sentence, still auto-fills the classical algorithm and size, and links to the Post-Quantum Crypto tool

#### Scenario: No PQC option appears
- **WHEN** the algorithm select is opened
- **THEN** no ML-KEM / ML-DSA / RFC 9980 option exists, and the help text explains why in one sentence

### Requirement: Offline operation
The readiness row and help text SHALL be computed from the parsed key material and static strings only, with no lookup of any kind.

#### Scenario: Input never leaves the page
- **WHEN** a certificate is parsed and the row rendered while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)
