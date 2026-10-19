# Spec Delta — key-info-deep-view

## Purpose

Extend Key Info with a per-component view of an OpenPGP key — subkeys, user IDs, certifications, revocations, preferences — and a ✓ / ✗ gate list for weak or obsolete choices per RFC 9580 §9 and BSI TR-02102-1 (2025), including the quantum-safe row shared with the `pqc-readiness-indicator` capability, entirely in the browser.

## ADDED Requirements

### Requirement: Component listing
The tool SHALL list the primary key and every subkey with algorithm, size or curve, creation date, expiration date (or "never"), key flags from the binding or direct-key signature (RFC 9580 §5.2.3.29), and revocation status; and every user ID with its newest self-certification date, the number of third-party certifications (count only), and revocation status — dates via `Intl.DateTimeFormat` with an `Intl.RelativeTimeFormat` phrase.

#### Scenario: Two subkeys with distinct flags
- **WHEN** a key with a signing subkey and an encryption subkey is pasted
- **THEN** the subkey rows read "sign" and "encrypt communications, encrypt storage" respectively with their own expiry dates

#### Scenario: Revoked user ID
- **WHEN** a user ID carries a 0x30 Certification Revocation signature from the primary key
- **THEN** that row is marked revoked with the reason code and date, and the primary user ID is chosen from the remaining ones

### Requirement: Preferences and features
The tool SHALL render the primary user's self-signature preferences — symmetric, hash, compression, and AEAD ciphersuite lists (§5.2.3.14, §5.2.3.16, §5.2.3.17, §5.2.3.15), features bits (§5.2.3.32), key server preferences, and preferred key server — each algorithm by its §9 name in preference order.

#### Scenario: Preference order shown
- **WHEN** the self-signature lists symmetric algorithms 9, 8, 7
- **THEN** the row reads "AES-256, AES-192, AES-128" in that order

### Requirement: Algorithm gates
The tool SHALL display independent ✓ / ✗ rows for: no self-signature uses MD5 or SHA-1 (RFC 9580 §9.5 — SHA-1 MUST NOT be used for new signatures); no component uses DSA or ElGamal (§9.1, deprecated); every RSA component is at least 3072 bits (BSI TR-02102-1, 2025); key version is 4 or 6 (v3 unsupported); the first preferred symmetric algorithm is not 3DES, IDEA, or CAST5; features include SEIPD v2 (⚠ when absent, not ✗).

#### Scenario: SHA-1 self-signature
- **WHEN** the user-ID self-signature hash algorithm is 2 (SHA-1)
- **THEN** the gate is ✗ citing RFC 9580 §9.5 and the Maintain tab's "set expiry (re-sign)" is offered as the fix, since re-signing produces SHA-2 signatures

#### Scenario: RSA 2048
- **WHEN** the primary key is RSA 2048
- **THEN** the gate is ✗ "2048 bits — BSI TR-02102-1 (2025) recommends at least 3000" and the detail notes the key still works with current software

### Requirement: Lifecycle gates
The tool SHALL display independent ✓ / ✗ rows for: no component is expired; no component is revoked (✗ with the reason); at least one non-expired, non-revoked subkey or primary carries an encryption flag; the primary key does not itself carry the encrypt flags (⚠); expiry set at all (⚠ when "never").

#### Scenario: Expired encryption subkey
- **WHEN** the only encryption subkey's expiration date is in the past
- **THEN** the expiry gate is ✗ "expired 3 months ago" and the encryption-capability gate is ✗ "no usable encryption subkey — senders cannot encrypt to this key"

### Requirement: Quantum-safe row
The tool SHALL show the quantum-safe row provided by the `pqc-readiness-indicator` capability (change `pqc-signatures-and-kems`) for the primary and each subkey, and until that capability ships SHALL show a local row with identical wording: "RSA / ECC — not post-quantum; NIST IR 8547 deprecates these after 2030 (OpenPGP PQC is RFC 9980; OpenPGP.js 6.3.2 does not implement it)".

#### Scenario: Curve25519 key
- **WHEN** an Ed25519 / X25519 key is inspected
- **THEN** the quantum-safe row reads "not post-quantum" with the IR 8547 note and no ✗ mark (it is information, not a defect)

### Requirement: Offline operation and verdict language
The tool SHALL inspect without any network request and SHALL phrase an all-✓ result as "no weak or expired components per the checks listed — this does not establish who controls the key or that the user IDs are truthful".

#### Scenario: Input never leaves the page
- **WHEN** a key is inspected while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓
- **THEN** the summary is the sentence above and contains neither "safe", "trusted", nor "verified identity"
