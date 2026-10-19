# Spec Delta — data-integrity-jcs-proof-verification

## Purpose

Verify W3C Verifiable Credentials Data Model 2.0 documents carrying a Data Integrity 1.0 proof in the JCS cryptosuites `eddsa-jcs-2022` and `ecdsa-jcs-2019`, using an in-page RFC 8785 JSON Canonicalization Scheme implementation and Web Crypto, entirely in the browser.

## ADDED Requirements

### Requirement: JCS canonicalization
The tool SHALL canonicalize JSON per RFC 8785: object members sorted by UTF-16 code units of their names, numbers serialized as ECMAScript `Number.prototype.toString` (§3.2.2.3), strings escaped per §3.2.2.2, no insignificant whitespace, and SHALL reject documents containing non-finite numbers.

#### Scenario: RFC 8785 §3.2.3 example
- **WHEN** the RFC 8785 §3.2.3 input object is canonicalized
- **THEN** the output equals the RFC's published canonical string byte for byte

#### Scenario: Member ordering
- **WHEN** an object has members `"é"`, `"z"`, and `"A"` (A)
- **THEN** they serialize in the order `A`, `z`, `é`

### Requirement: Proof parsing and suite dispatch
The tool SHALL read `proof` (`type: DataIntegrityProof`, `cryptosuite`, `verificationMethod`, `proofPurpose`, `created`, `expires`, `challenge`, `domain`, `proofValue`) per W3C Data Integrity 1.0 §2.1, SHALL dispatch `eddsa-jcs-2022` and `ecdsa-jcs-2019`, and SHALL report `eddsa-rdfc-2022`, `ecdsa-rdfc-2019`, `ecdsa-sd-2023`, and `bbs-2023` as "requires RDF Dataset Canonicalization — not supported in-page".

#### Scenario: RDFC suite
- **WHEN** `cryptosuite` is `eddsa-rdfc-2022`
- **THEN** the proof card renders every field and the verification row reads the unsupported message naming RDFC-1.0

#### Scenario: Proof set
- **WHEN** `proof` is an array of two proofs
- **THEN** each proof is verified independently and listed with its own result

### Requirement: Hash data construction
The tool SHALL compute the signed data as `H(JCS(proofOptions)) ‖ H(JCS(document without proof))`, where `proofOptions` is the proof without `proofValue` plus the document's `@context` (vc-di-eddsa §3.3.4 / §3.3.5 for `eddsa-jcs-2022`; vc-di-ecdsa §3.4.4 / §3.4.5 for `ecdsa-jcs-2019`), using SHA-256 for Ed25519 and P-256 keys and SHA-384 for P-384 keys, and SHALL display both intermediate hashes.

#### Scenario: Tampered credential subject
- **WHEN** one character of `credentialSubject` is changed
- **THEN** the signature gate is ✗ and the document hash differs from the one shown for the untampered input

#### Scenario: Context carried into proof options
- **WHEN** the document's `@context` is removed from the pasted proof options view
- **THEN** the displayed proof-options hash changes, demonstrating that `@context` is part of the hashed options (vc-di-eddsa §3.3.5)

### Requirement: Signature verification
The tool SHALL decode `proofValue` as multibase (`z` base58-btc, Data Integrity 1.0 §2.1), SHALL obtain the public key from `verificationMethod` when it is a `did:key` (via the DID decoder) or from a pasted JWK / multikey, and SHALL verify Ed25519 or ECDSA P-256 / P-384 via Web Crypto.

#### Scenario: eddsa-jcs-2022 test vector
- **WHEN** a document and proof from the W3C vc-di-eddsa test suite for `eddsa-jcs-2022` are pasted
- **THEN** the signature gate is ✓ and the two intermediate hashes are shown in hex

#### Scenario: verificationMethod not resolvable
- **WHEN** `verificationMethod` is a `did:web` URL
- **THEN** the row reads "key not embedded — paste the controller's public key (JWK or multikey)" and no fetch occurs

### Requirement: Proof metadata gates
The tool SHALL display ✓ / ✗ rows for: `proofPurpose` is `assertionMethod` or `authentication` (Data Integrity 1.0 §2.1); `created` parses and is not in the future; `expires`, when present, is in the future; `challenge` and `domain` equal user-entered expectations when supplied (§2.1, §4.3); the document's `@context` begins with `https://www.w3.org/ns/credentials/v2` (VC Data Model 2.0 §4.2).

#### Scenario: Expired proof
- **WHEN** `expires` is in the past
- **THEN** the gate is ✗ with "expired … ago" via `Intl.RelativeTimeFormat`, independent of the signature result

#### Scenario: Domain mismatch
- **WHEN** the expected domain entered is `verifier.example` and the proof's `domain` is `other.example`
- **THEN** the gate is ✗ citing §4.3

### Requirement: Offline operation and verdict language
The tool SHALL verify without any network request and SHALL phrase a fully ✓ result as "proof verifies for the key in `verificationMethod` / the key you pasted — this does not establish that the key belongs to the issuer named in `issuer`".

#### Scenario: Input never leaves the page
- **WHEN** a document with `@context` and `verificationMethod` URLs is verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓
- **THEN** the summary is the sentence above and contains neither "valid credential" nor "trusted"
