# Spec Delta — webauthn-assertion-verification

## Purpose

Verify a WebAuthn authentication assertion (`navigator.credentials.get()`) — signature, signCount, challenge, and origin — against a public key the user supplies, following the relying-party procedure of WebAuthn Level 3 §7.2, entirely in the browser.

## ADDED Requirements

### Requirement: Assertion input ingestion
The tool SHALL accept an assertion as `PublicKeyCredential.toJSON()` output (`response.authenticatorData`, `response.clientDataJSON`, `response.signature`, optional `response.userHandle`) or as separately pasted fields in base64url, base64, or hex, plus a credential public key as a COSE_Key (hex / base64url), a JWK, or an SPKI PEM.

#### Scenario: toJSON() assertion
- **WHEN** the user pastes the full JSON with a `response.signature` member
- **THEN** the tool switches to the assertion panel, fills the three fields, shows `userHandle` as hex and UTF-8 when present, and waits for a key

#### Scenario: Key in three encodings
- **WHEN** the same P-256 key is supplied as COSE hex, as a JWK, and as PEM in three runs
- **THEN** all three runs reach the same verification result and the key is displayed as JWK in each case

### Requirement: Signature verification
The tool SHALL verify the signature over `authenticatorData ‖ SHA-256(clientDataJSON)` (Level 3 §6.3.4, §7.2 step 20) via Web Crypto: ES256 / ES384 / ES512 as ECDSA with DER `ECDSA-Sig-Value` converted to raw `r‖s`, RS256 as RSASSA-PKCS1-v1_5 with SHA-256, EdDSA as Ed25519 (RFC 9053 §2; RFC 8812 §2), choosing the algorithm from the key's `alg` when present or its curve / type otherwise.

#### Scenario: Valid ES256 assertion
- **WHEN** the fixture assertion and its matching JWK are supplied
- **THEN** the signature gate is ✓ and names ES256 and the 64-byte raw signature derived from the DER input

#### Scenario: Mutated signature
- **WHEN** one byte of the signature is changed
- **THEN** the signature gate is ✗ with the message "signature does not verify for the supplied key" and the remaining gates still evaluate

#### Scenario: EdDSA on a browser without Ed25519
- **WHEN** the key is OKP Ed25519 and `crypto.subtle` rejects the `Ed25519` algorithm
- **THEN** the gate reads "not verified — this browser's Web Crypto lacks Ed25519" with the same banner the Ed25519 tool shows

### Requirement: Client data checks
The tool SHALL render `clientDataJSON` as in registration, SHALL require `type` to be `webauthn.get` (§7.2 step 11), and SHALL compare `challenge` and `origin` against user-entered expected values when provided (§7.2 steps 12–13), accepting the expected challenge as base64url or raw bytes in hex.

#### Scenario: Challenge mismatch
- **WHEN** the expected challenge entered differs from `clientDataJSON.challenge`
- **THEN** the challenge gate is ✗ citing §7.2 step 12 and both values are shown

#### Scenario: Wrong ceremony type
- **WHEN** `clientDataJSON.type` is `webauthn.create`
- **THEN** the type gate is ✗ stating that an assertion requires `webauthn.get`

### Requirement: Authenticator data checks
The tool SHALL parse `authenticatorData` per §6.1, SHALL check `rpIdHash` against a user-entered RP ID (§7.2 step 15), SHALL require UP (step 16), SHALL report UV as ✓ when set and ⚠ when clear, SHALL flag BS set without BE as ✗, and SHALL compare `signCount` with a user-entered previous count (§7.2 step 23): greater is ✓, equal or lower is ✗ "possible cloned authenticator", both zero is ⚠ "authenticator does not implement a counter".

#### Scenario: Counter regression
- **WHEN** the assertion's `signCount` is 41 and the previous count entered is 41
- **THEN** the counter gate is ✗ citing §7.2 step 23 and the detail reads "possible cloned authenticator — the relying party decides policy"

#### Scenario: Zero counters
- **WHEN** both counts are 0
- **THEN** the counter gate is ⚠ and explains that many platform passkeys (BE set) return 0 by design

### Requirement: Offline operation and verdict language
The tool SHALL verify without any network request and SHALL phrase a fully ✓ result as "signature verifies for the key you supplied — this does not prove which authenticator or user produced it".

#### Scenario: Input never leaves the page
- **WHEN** an assertion is verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓
- **THEN** the summary line is exactly the sentence above and contains neither "safe" nor "authenticated user"
